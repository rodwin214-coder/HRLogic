import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PasswordResetEmailRequest {
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
    const { employeeEmail, employeeName, companyName, companyCode }: PasswordResetEmailRequest = await req.json();

    const emailSubject = `Password Reset Request - ${companyName}`;
    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials { background-color: white; padding: 20px; border-left: 4px solid #dc2626; margin: 20px 0; }
    .credential-item { margin: 10px 0; }
    .credential-label { font-weight: bold; color: #1f2937; }
    .credential-value { font-family: monospace; background-color: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 5px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
    .warning { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
    .info { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hello ${employeeName},</p>

      <p>We received a request to reset your password for your WorkLogix account at <strong>${companyName}</strong>.</p>

      <div class="credentials">
        <h3>Your Account Information</h3>

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
        <strong>⚠️ Security Notice:</strong> For security reasons, passwords cannot be reset via email. Please contact your employer or system administrator to reset your password.
      </div>

      <div class="info">
        <strong>📋 What to do next:</strong>
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Contact your employer or HR department</li>
          <li>Request a password reset for your account</li>
          <li>They will provide you with a new temporary password</li>
          <li>Log in with the temporary password and change it immediately</li>
        </ol>
      </div>

      <p><strong>Did not request a password reset?</strong></p>
      <p>If you did not request this password reset, please contact your employer immediately as someone may be trying to access your account.</p>

      <p>Best regards,<br>The WorkLogix Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    console.log('=== PASSWORD RESET EMAIL ===');
    console.log('To:', employeeEmail);
    console.log('Subject:', emailSubject);
    console.log('Company:', companyName);
    console.log('Company Code:', companyCode);
    console.log('============================');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset email logged successfully',
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
    console.error('Error processing password reset email:', error);
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
