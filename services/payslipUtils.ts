import { PayrollRecord, PayFrequency, CompanyProfile } from '../types';

export const generatePayslipHTML = (
    r: PayrollRecord,
    employeeName: string,
    employeeId: string,
    department: string,
    periodName: string,
    payDate: string,
    company: CompanyProfile | null,
    payFrequency: PayFrequency,
): string => {
    const f = (n: number) => '₱' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const benefitDivisor = payFrequency === 'semi-monthly' ? 2 : 1;
    const logoHTML = company?.logo
        ? `<img src="${company.logo}" style="height:56px;object-fit:contain;" />`
        : `<div style="width:56px;height:56px;background:#1e40af;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px;">${(company?.name ?? 'C')[0]}</div>`;

    const row = (label: string, value: string, color = '#374151', bold = false) =>
        `<tr><td style="padding:4px 8px;font-size:12px;color:#6b7280;">${label}</td><td style="padding:4px 8px;font-size:12px;color:${color};font-weight:${bold ? '600' : '400'};text-align:right;">${value}</td></tr>`;

    const holidayPay = r.regularHolidayPay + r.specialHolidayPay + r.restDayPay + r.nightDiffPay;
    const tardiness = r.lateDeduction + r.undertimeDeduction;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Payslip – ${employeeName}</title>
<style>
  body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 20px; background: #fff; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
    @page { margin: 15mm; }
  }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 6px 8px; text-align: left; color: #374151; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 10px 0; }
  .net-box { background: #166534; color: white; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
  .gross-box { background: #1d4ed8; color: white; border-radius: 8px; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; margin: 8px 0; }
</style>
</head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:16px;">
  <button onclick="window.print()" style="background:#1d4ed8;color:white;border:none;padding:10px 24px;border-radius:6px;font-size:14px;cursor:pointer;margin-right:8px;">Print / Save as PDF</button>
  <button onclick="window.close()" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db;padding:10px 24px;border-radius:6px;font-size:14px;cursor:pointer;">Close</button>
</div>

<!-- Header -->
<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding-bottom:16px;border-bottom:2px solid #e5e7eb;">
  ${logoHTML}
  <div style="flex:1;">
    <div style="font-size:18px;font-weight:700;color:#111;">${company?.name ?? 'Company'}</div>
    <div style="font-size:11px;color:#6b7280;">${company?.address ?? ''}</div>
    <div style="font-size:11px;color:#6b7280;">${company?.email ?? ''}${company?.contactNumber ? ' · ' + company.contactNumber : ''}</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:16px;font-weight:700;color:#1d4ed8;">PAYSLIP</div>
    <div style="font-size:11px;color:#6b7280;">${periodName}</div>
    <div style="font-size:11px;color:#6b7280;">Pay Date: ${payDate}</div>
  </div>
</div>

<!-- Employee Info -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;background:#f9fafb;padding:12px;border-radius:8px;">
  <div><span style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Employee</span><div style="font-size:14px;font-weight:600;color:#111;">${employeeName}</div></div>
  <div><span style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Employee ID</span><div style="font-size:13px;color:#374151;">${employeeId}</div></div>
  <div><span style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Department</span><div style="font-size:13px;color:#374151;">${department || '—'}</div></div>
  <div><span style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Pay Frequency</span><div style="font-size:13px;color:#374151;">${payFrequency}</div></div>
</div>

<!-- Earnings -->
<table>
  <tr><th colspan="2">Earnings</th></tr>
  ${row('Basic Pay', f(r.basicPay))}
  ${r.overtimePay > 0 ? row('Overtime Pay', f(r.overtimePay), '#1d4ed8') : ''}
  ${holidayPay > 0 ? row('Holiday / Rest Day Pay', f(holidayPay), '#1d4ed8') : ''}
  ${r.allowance > 0 ? row(`Allowance${benefitDivisor > 1 ? ' (÷2)' : ''}`, f(r.allowance), '#15803d') : ''}
  ${r.otherBenefits > 0 ? row(`Other Benefits${benefitDivisor > 1 ? ' (÷2)' : ''}`, f(r.otherBenefits), '#15803d') : ''}
  ${r.deMinimis > 0 ? row('De Minimis Benefits', f(r.deMinimis), '#15803d') : ''}
</table>
<hr class="divider"/>

<!-- Deductions from attendance -->
<table>
  <tr><th colspan="2">Attendance Deductions</th></tr>
  ${r.absentDeduction > 0 ? row(`Absences (${r.absentDays} day${r.absentDays !== 1 ? 's' : ''})`, '-' + f(r.absentDeduction), '#dc2626') : ''}
  ${tardiness > 0 ? row('Late / Undertime', '-' + f(tardiness), '#dc2626') : ''}
  ${r.absentDeduction === 0 && tardiness === 0 ? row('No deductions', '—', '#9ca3af') : ''}
</table>
<hr class="divider"/>

<!-- Gross -->
<div class="gross-box"><span style="font-size:13px;font-weight:600;">GROSS PAY</span><span style="font-size:16px;font-weight:700;">${f(r.grossPay)}</span></div>

<!-- Government -->
${(r.sssContribution > 0 || r.philhealthContribution > 0 || r.pagibigContribution > 0) ? `
<table style="margin-top:8px;">
  <tr><th colspan="2">Government Contributions</th></tr>
  ${r.sssContribution > 0 ? row('SSS', '-' + f(r.sssContribution), '#dc2626') : ''}
  ${r.philhealthContribution > 0 ? row('PhilHealth', '-' + f(r.philhealthContribution), '#dc2626') : ''}
  ${r.pagibigContribution > 0 ? row('Pag-IBIG', '-' + f(r.pagibigContribution), '#dc2626') : ''}
  ${r.withholdingTax > 0 ? row('Withholding Tax (BIR)', '-' + f(r.withholdingTax), '#dc2626') : ''}
</table>
<hr class="divider"/>` : ''}

<!-- Loans -->
${(r.sssLoan > 0 || r.pagibigLoan > 0 || r.cashAdvance > 0 || r.otherDeductions > 0) ? `
<table>
  <tr><th colspan="2">Loans & Other Deductions</th></tr>
  ${r.sssLoan > 0 ? row('SSS Loan', '-' + f(r.sssLoan), '#dc2626') : ''}
  ${r.pagibigLoan > 0 ? row('Pag-IBIG Loan', '-' + f(r.pagibigLoan), '#dc2626') : ''}
  ${r.cashAdvance > 0 ? row('Cash Advance', '-' + f(r.cashAdvance), '#dc2626') : ''}
  ${r.otherDeductions > 0 ? row('Other Deductions', '-' + f(r.otherDeductions), '#dc2626') : ''}
</table>
<hr class="divider"/>` : ''}

<!-- Net Pay -->
<div class="net-box"><span style="font-size:14px;font-weight:600;">NET PAY</span><span style="font-size:20px;font-weight:700;">${f(r.netPay)}</span></div>

${r.thirteenthMonthAccrued > 0 ? `<div style="margin-top:10px;font-size:11px;color:#9ca3af;text-align:right;">13th Month Accrual this period: ${f(r.thirteenthMonthAccrued)}</div>` : ''}

<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;">
  This is a system-generated payslip. · ${company?.name ?? ''} · TIN: ${company?.tin ?? ''}
</div>
</body>
</html>`;
};

export const openPayslip = (html: string) => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
};
