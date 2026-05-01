import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Route: create employee (uses service role to bypass RLS)
    if (body.action === "create-employee") {
      return await handleCreateEmployee(body);
    }

    // Route: send invitation email
    return await handleSendEmail(body);
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleCreateEmployee(body: {
  callerEmail: string;
  companyId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  shiftId?: string | null;
  dateHired: string;
  employmentType: string;
  passwordHash: string;
  role: string;
}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Verify caller is an employer for this company
  const { data: caller } = await supabase
    .from("user_accounts")
    .select("role, company_id")
    .eq("email", body.callerEmail)
    .maybeSingle();

  if (!caller || caller.role !== "employer" || caller.company_id !== body.companyId) {
    return new Response(
      JSON.stringify({ error: "Permission denied" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check for duplicate email
  const { data: existing } = await supabase
    .from("user_accounts")
    .select("id")
    .eq("email", body.email)
    .eq("company_id", body.companyId)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ error: "DUPLICATE_EMAIL: An employee with this email already exists in your company." }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Insert employee (service role bypasses RLS)
  const { data: newEmployee, error: empError } = await supabase
    .from("employees")
    .insert([{
      company_id: body.companyId,
      employee_id: body.employeeId,
      email: body.email,
      first_name: body.firstName,
      last_name: body.lastName,
      department: body.department,
      shift_id: body.shiftId || null,
      date_hired: body.dateHired,
      employment_type: body.employmentType,
      status: "Active",
    }])
    .select()
    .single();

  if (empError) {
    console.error("Employee insert error:", empError);
    throw new Error(empError.message);
  }

  // Insert user account
  const { error: accountError } = await supabase
    .from("user_accounts")
    .insert([{
      company_id: body.companyId,
      employee_id: newEmployee.id,
      email: body.email,
      password_hash: body.passwordHash,
      role: body.role || "employee",
    }]);

  if (accountError) {
    console.error("User account insert error:", accountError);
    throw new Error(accountError.message);
  }

  return new Response(
    JSON.stringify({ data: newEmployee }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleSendEmail(body: {
  employeeEmail: string;
  employeeName: string;
  companyName: string;
  companyCode: string;
}) {
  const { employeeEmail, employeeName, companyName, companyCode } = body;

  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured. Email will be logged but not sent.");
    console.log("=== INVITATION EMAIL (NOT SENT) ===");
    console.log("To:", employeeEmail);
    console.log("Subject:", `Welcome to ${companyName} - Your Account Has Been Created`);
    console.log("Company:", companyName);
    console.log("Company Code:", companyCode);
    console.log("===================================");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email service not configured. Please set up Resend API key.",
        logged: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const emailSubject = `Welcome to ${companyName} - Your Account Has Been Created`;
  const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials { background-color: white; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0; }
    .credential-item { margin: 10px 0; }
    .credential-label { font-weight: bold; color: #1f2937; }
    .credential-value { font-family: monospace; background-color: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 5px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
    .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to WorkLogix</h1>
    </div>
    <div class="content">
      <p>Hello ${employeeName},</p>

      <p>Your employer, <strong>${companyName}</strong>, has created an account for you on WorkLogix, our employee management platform.</p>

      <div class="credentials">
        <h3>Your Login Credentials</h3>

        <div class="credential-item">
          <div class="credential-label">Company Code:</div>
          <div class="credential-value">${companyCode}</div>
        </div>

        <div class="credential-item">
          <div class="credential-label">Email:</div>
          <div class="credential-value">${employeeEmail}</div>
        </div>

        <div class="credential-item">
          <div class="credential-label">Temporary Password:</div>
          <div class="credential-value">qwerty123</div>
        </div>
      </div>

      <div class="warning">
        <strong>Important:</strong> Please change your password immediately after your first login for security purposes.
      </div>

      <p><strong>What to do next:</strong></p>
      <ol>
        <li>Visit the WorkLogix login page</li>
        <li>Enter your company code, email, and the temporary password above</li>
        <li>Complete your profile and change your password</li>
      </ol>

      <p>If you have any questions or need assistance, please contact your employer or system administrator.</p>

      <p>Best regards,<br>The WorkLogix Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "WorkLogix <onboarding@resend.dev>",
      to: [employeeEmail],
      subject: emailSubject,
      html: emailBody,
    }),
  });

  if (!resendResponse.ok) {
    const errorData = await resendResponse.json();
    throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
  }

  const resendData = await resendResponse.json();
  console.log("Email sent successfully via Resend:", resendData);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Invitation email sent successfully",
      emailId: resendData.id,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
