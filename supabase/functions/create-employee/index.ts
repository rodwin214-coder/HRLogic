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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      callerEmail,
      companyId,
      employeeId,
      email,
      firstName,
      lastName,
      department,
      shiftId,
      dateHired,
      employmentType,
      passwordHash,
      role,
    } = await req.json();

    // Verify caller is an employer for this company
    const { data: caller } = await supabase
      .from("user_accounts")
      .select("role, company_id")
      .eq("email", callerEmail)
      .maybeSingle();

    if (!caller || caller.role !== "employer" || caller.company_id !== companyId) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate email
    const { data: existing } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("email", email)
      .eq("company_id", companyId)
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
        company_id: companyId,
        employee_id: employeeId,
        email,
        first_name: firstName,
        last_name: lastName,
        department,
        shift_id: shiftId || null,
        date_hired: dateHired,
        employment_type: employmentType,
        status: "Active",
      }])
      .select()
      .single();

    if (empError) throw empError;

    // Insert user account
    const { error: accountError } = await supabase
      .from("user_accounts")
      .insert([{
        company_id: companyId,
        employee_id: newEmployee.id,
        email,
        password_hash: passwordHash,
        role: role || "employee",
      }]);

    if (accountError) throw accountError;

    return new Response(
      JSON.stringify({ data: newEmployee }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating employee:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
