import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationEmailRequest {
  employeeEmail: string;
  employeeName: string;
  companyName: string;
  companyCode: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { employeeEmail, employeeName, companyName, companyCode }: InvitationEmailRequest = await req.json();

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
      </div>

      <div class="warning">
        <strong>⚠️ Important:</strong> Please contact your employer to obtain your temporary password. For security reasons, passwords are not sent via email.
      </div>

      <p><strong>What to do next:</strong></p>
      <ol>
        <li>Contact your employer to get your temporary password</li>
        <li>Visit the WorkLogix login page</li>
        <li>Enter your company code, email, and the temporary password</li>
        <li>Complete your profile and change your password after logging in</li>
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

    console.log('=== INVITATION EMAIL ===');
    console.log('To:', employeeEmail);
    console.log('Subject:', emailSubject);
    console.log('Company:', companyName);
    console.log('Company Code:', companyCode);
    console.log('========================');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation email logged successfully',
        email: {
          to: employeeEmail,
          subject: emailSubject,
          companyCode: companyCode,
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing invitation email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
