import React, { useState, useEffect, useCallback } from 'react';
import { Employee, CompanyProfile, PayrollOpeningBalance } from '../../types';
import {
    getAllYTDRecords, getOpeningBalance, upsertOpeningBalance,
    getEmployees, getCompanyProfile,
} from '../../services/supabaseApi';
import { WORKLOGIX_LOGO_BASE64 } from '../../services/supabaseApi';
import { openPayslip } from '../../services/payslipUtils';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) => '₱' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtN = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function printHTML(html: string) {
    openPayslip(html);
}

function reportHeader(company: CompanyProfile | null, title: string, subtitle: string) {
    const logo = company?.logo
        ? `<img src="${company.logo}" style="height:40px;object-fit:contain;"/>`
        : `<div style="font-size:18px;font-weight:700;color:#0f2c52;">${company?.name ?? ''}</div>`;
    return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb;">
      ${logo}
      <div style="flex:1;">
        <div style="font-size:15px;font-weight:700;">${company?.name ?? ''}</div>
        <div style="font-size:10px;color:#6b7280;">${company?.address ?? ''} · TIN: ${(company as any)?.tin ?? '_______________'}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:14px;font-weight:700;color:#0f2c52;">${title}</div>
        <div style="font-size:11px;color:#6b7280;">${subtitle}</div>
      </div>
    </div>`;
}

function printBtn(extra = '') {
    return `<div class="no-print" style="margin-bottom:14px;">
      <button onclick="window.print()" style="background:#0f2c52;color:white;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;margin-right:8px;">Print / Save PDF</button>
      <button onclick="window.close()" style="border:1px solid #d1d5db;padding:8px 18px;border-radius:6px;cursor:pointer;">Close</button>${extra}
    </div>`;
}

const BASE_STYLES = `
  body{font-family:Arial,sans-serif;color:#111;padding:20px;font-size:11px;}
  @media print{.no-print{display:none!important;}@page{margin:12mm;}}
  table{width:100%;border-collapse:collapse;}
  th{background:#f3f4f6;padding:5px 7px;text-align:left;font-size:9px;text-transform:uppercase;color:#6b7280;white-space:nowrap;}
  td{padding:4px 7px;border-bottom:1px solid #f3f4f6;}
  tfoot td{font-weight:700;background:#f9fafb;}
  .right{text-align:right;}
`;

// ─── Opening Balance Modal ────────────────────────────────────────────────────

interface OBModalProps {
    employee: Employee;
    year: number;
    onClose: () => void;
    onSaved: () => void;
}

const OpeningBalanceModal: React.FC<OBModalProps> = ({ employee, year, onClose, onSaved }) => {
    const empty: PayrollOpeningBalance = {
        companyId: '', employeeId: employee.id, year,
        obBasicPay: 0, obGrossPay: 0, obTaxableIncome: 0, obWithholdingTax: 0,
        obSss: 0, obPhilhealth: 0, obPagibig: 0, obNetPay: 0, obThirteenthMonth: 0, notes: '',
    };
    const [form, setForm] = useState<PayrollOpeningBalance>(empty);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getOpeningBalance(employee.id, year).then(ob => {
            if (ob) setForm(ob);
            setLoading(false);
        });
    }, [employee.id, year]);

    const set = (k: keyof PayrollOpeningBalance, v: string) =>
        setForm(prev => ({ ...prev, [k]: k === 'notes' ? v : parseFloat(v) || 0 }));

    const save = async () => {
        setSaving(true);
        try {
            await upsertOpeningBalance(form);
            onSaved();
            onClose();
        } catch (e) {
            alert('Failed to save opening balance.');
        }
        setSaving(false);
    };

    const fields: { key: keyof PayrollOpeningBalance; label: string }[] = [
        { key: 'obBasicPay', label: 'Basic Pay (YTD before system start)' },
        { key: 'obGrossPay', label: 'Gross Pay' },
        { key: 'obTaxableIncome', label: 'Taxable Income' },
        { key: 'obWithholdingTax', label: 'Withholding Tax (BIR)' },
        { key: 'obSss', label: 'SSS Contributions (EE)' },
        { key: 'obPhilhealth', label: 'PhilHealth Contributions (EE)' },
        { key: 'obPagibig', label: 'Pag-IBIG Contributions (EE)' },
        { key: 'obNetPay', label: 'Net Pay' },
        { key: 'obThirteenthMonth', label: '13th Month Accrual' },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Opening Balance</h2>
                        <p className="text-xs text-gray-500">{employee.firstName} {employee.lastName} · {year}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>
                {loading ? (
                    <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
                ) : (
                    <div className="overflow-y-auto flex-1 p-5">
                        <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                            Enter cumulative payroll totals from January 1, {year} up to the date this employee was entered into the system. These are added to in-system payroll for complete year-to-date figures.
                        </p>
                        <div className="space-y-3">
                            {fields.map(f => (
                                <div key={f.key} className="flex items-center gap-3">
                                    <label className="text-sm text-gray-700 flex-1">{f.label}</label>
                                    <div className="relative w-40">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                                        <input type="number" min="0" step="0.01"
                                            value={form[f.key] as number}
                                            onChange={e => set(f.key, e.target.value)}
                                            className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
                                    </div>
                                </div>
                            ))}
                            <div>
                                <label className="text-sm text-gray-700">Notes</label>
                                <input type="text" value={form.notes}
                                    onChange={e => set('notes', e.target.value)}
                                    placeholder="e.g., Entered system on March 1"
                                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={saving}
                        className="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                        style={{ background: 'rgb(15,44,82)' }}>
                        {saving ? 'Saving...' : 'Save Opening Balance'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── YTD Report Row ─────────────────────────────────────────────────────────

interface YTDRow {
    employeeId: string;
    ytdBasicPay: number; ytdGrossPay: number; ytdTaxableIncome: number;
    ytdWithholdingTax: number; ytdSss: number; ytdPhilhealth: number;
    ytdPagibig: number; ytdNetPay: number; ytdThirteenthMonth: number;
    periodCount: number;
}

// ─── Generate BIR 2316 HTML ──────────────────────────────────────────────────

function generate2316HTML(emp: Employee, ytd: YTDRow, year: number, company: CompanyProfile | null): string {
    const tin = (emp as any).tin ?? '___-___-___-___';
    const empTin = (company as any)?.tin ?? '___-___-___-___';
    const totalContrib = ytd.ytdSss + ytd.ytdPhilhealth + ytd.ytdPagibig;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>BIR Form 2316 – ${emp.firstName} ${emp.lastName}</title>
<style>
  ${BASE_STYLES}
  .box{border:1px solid #374151;padding:3px 6px;min-height:22px;display:inline-block;min-width:120px;}
  .label{font-size:8px;color:#6b7280;display:block;margin-bottom:1px;}
  .field{margin-bottom:8px;}
  .section-header{background:#e5e7eb;padding:4px 8px;font-weight:700;font-size:10px;text-transform:uppercase;margin:12px 0 6px;letter-spacing:.05em;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  h1{font-size:14px;font-weight:700;text-align:center;margin:0 0 2px;}
  h2{font-size:10px;text-align:center;color:#4b5563;margin:0 0 12px;}
  .total-box{background:#f9fafb;border:1.5px solid #374151;padding:6px 10px;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:12px;margin-top:8px;}
</style></head><body>
${printBtn()}
<div style="border:2px solid #0f2c52;padding:16px;">
<h1>BIR FORM 2316</h1>
<h2>Certificate of Compensation Payment / Tax Withheld<br/>For Compensation Payment With or Without Tax Withheld (January 1 – December 31, ${year})</h2>

<div class="section-header">Part I – Employee Information</div>
<div class="grid3">
  <div class="field"><span class="label">1. For the Period</span><span class="box">Jan 1 – Dec 31, ${year}</span></div>
  <div class="field"><span class="label">2. TIN of Employee</span><span class="box">${tin}</span></div>
  <div class="field"><span class="label">3. Employee Name</span><span class="box">${emp.lastName}, ${emp.firstName}</span></div>
</div>
<div class="grid2">
  <div class="field"><span class="label">4. Address</span><span class="box">${(emp as any).address ?? '___'}</span></div>
  <div class="field"><span class="label">5. SSS No.</span><span class="box">${(emp as any).sssNo ?? '___'}</span></div>
</div>
<div class="grid3">
  <div class="field"><span class="label">6. PhilHealth No.</span><span class="box">${(emp as any).philhealthNo ?? '___'}</span></div>
  <div class="field"><span class="label">7. Pag-IBIG No.</span><span class="box">${(emp as any).pagibigNo ?? '___'}</span></div>
  <div class="field"><span class="label">8. Employment Status</span><span class="box">${(emp as any).employmentType ?? 'Regular'}</span></div>
</div>

<div class="section-header">Part II – Employer Information</div>
<div class="grid3">
  <div class="field"><span class="label">9. Employer TIN</span><span class="box">${empTin}</span></div>
  <div class="field"><span class="label">10. Employer Name</span><span class="box">${company?.name ?? '___'}</span></div>
  <div class="field"><span class="label">11. Employer Address</span><span class="box">${company?.address ?? '___'}</span></div>
</div>

<div class="section-header">Part III – Compensation Income and Tax Withheld</div>
<table>
  <thead><tr><th>Description</th><th class="right">This Employer</th></tr></thead>
  <tbody>
    <tr><td>12. Gross Compensation Income</td><td class="right">₱${fmtN(ytd.ytdGrossPay)}</td></tr>
    <tr><td>13. Less: Non-Taxable / Exempt Compensation</td><td class="right">₱${fmtN(Math.max(0, ytd.ytdGrossPay - ytd.ytdTaxableIncome))}</td></tr>
    <tr><td>&nbsp;&nbsp;13a. SSS Contributions (EE)</td><td class="right">₱${fmtN(ytd.ytdSss)}</td></tr>
    <tr><td>&nbsp;&nbsp;13b. PhilHealth Contributions (EE)</td><td class="right">₱${fmtN(ytd.ytdPhilhealth)}</td></tr>
    <tr><td>&nbsp;&nbsp;13c. Pag-IBIG Contributions (EE)</td><td class="right">₱${fmtN(ytd.ytdPagibig)}</td></tr>
    <tr><td>&nbsp;&nbsp;13d. Total Contributions (13a + 13b + 13c)</td><td class="right">₱${fmtN(totalContrib)}</td></tr>
    <tr><td>14. Taxable Compensation Income (12 − 13d)</td><td class="right">₱${fmtN(ytd.ytdTaxableIncome)}</td></tr>
  </tbody>
</table>

<div class="section-header">Tax Withheld</div>
<table>
  <tbody>
    <tr><td>15. Tax Required to be Withheld</td><td class="right">₱${fmtN(ytd.ytdWithholdingTax)}</td></tr>
    <tr><td>16. Amount of Tax Withheld as Adjusted</td><td class="right">₱${fmtN(ytd.ytdWithholdingTax)}</td></tr>
  </tbody>
</table>
<div class="total-box">
  <span>17. Total Tax Withheld for the Year</span>
  <span>₱${fmtN(ytd.ytdWithholdingTax)}</span>
</div>

<div class="section-header">Part IV – Certification</div>
<p style="font-size:9px;color:#4b5563;margin-bottom:16px;">I declare, under the penalties of perjury, that this certificate has been made in good faith, verified by me, and to the best of my knowledge and belief, is true and correct, pursuant to the provisions of the National Internal Revenue Code, as amended, and the regulations issued under authority thereof.</p>

<div class="grid2" style="margin-top:20px;">
  <div style="border-top:1px solid #374151;padding-top:4px;text-align:center;font-size:9px;">Signature of Authorized Representative / Employer<br/><br/>${company?.name ?? ''}</div>
  <div style="border-top:1px solid #374151;padding-top:4px;text-align:center;font-size:9px;">Signature of Employee<br/><br/>${emp.firstName} ${emp.lastName}</div>
</div>

<p style="font-size:8px;color:#9ca3af;text-align:center;margin-top:16px;">This is a system-generated BIR Form 2316 equivalent. Please verify figures with your authorized representative before filing.</p>
</div>
</body></html>`;
}

// ─── Generate Employment Certification HTML ──────────────────────────────────

function generateEmpCertHTML(emp: Employee, ytd: YTDRow, year: number, company: CompanyProfile | null): string {
    const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    const hireDate = (emp as any).hireDate
        ? new Date((emp as any).hireDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        : '_______________';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Employment Certification – ${emp.firstName} ${emp.lastName}</title>
<style>
  ${BASE_STYLES}
  body{font-size:12px;line-height:1.7;}
  .letterhead{text-align:center;margin-bottom:24px;border-bottom:2px solid #0f2c52;padding-bottom:12px;}
  .title{font-size:16px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:.1em;margin:20px 0 8px;}
  .subtitle{font-size:10px;text-align:center;color:#6b7280;margin-bottom:24px;}
  .body{max-width:600px;margin:0 auto;}
  .sig-line{border-top:1px solid #374151;width:240px;margin-top:40px;}
</style></head><body>
${printBtn()}
<div class="letterhead">
  ${company?.logo ? `<img src="${company.logo}" style="height:50px;object-fit:contain;margin-bottom:6px;display:block;margin:0 auto 6px;"/>` : ''}
  <div style="font-size:18px;font-weight:700;">${company?.name ?? 'Company Name'}</div>
  <div style="font-size:10px;color:#6b7280;">${company?.address ?? ''}</div>
</div>

<div class="title">Certificate of Employment</div>
<div class="subtitle">This is to certify that:</div>

<div class="body">
<p>This is to certify that <strong>${emp.firstName} ${emp.lastName}</strong> (the <em>"Employee"</em>), is/was a bona fide employee of <strong>${company?.name ?? '___'}</strong> (the <em>"Company"</em>), a company duly organized under Philippine law.</p>

<p>The Employee's details are as follows:</p>

<table style="width:auto;margin:12px 0 20px;">
  <tr><td style="padding:3px 16px 3px 0;color:#4b5563;">Employee Name:</td><td><strong>${emp.firstName} ${emp.lastName}</strong></td></tr>
  <tr><td style="padding:3px 16px 3px 0;color:#4b5563;">Position / Designation:</td><td><strong>${(emp as any).position ?? emp.department ?? '___'}</strong></td></tr>
  <tr><td style="padding:3px 16px 3px 0;color:#4b5563;">Department:</td><td><strong>${emp.department ?? '___'}</strong></td></tr>
  <tr><td style="padding:3px 16px 3px 0;color:#4b5563;">Employment Status:</td><td><strong>${(emp as any).employmentType ?? 'Regular'}</strong></td></tr>
  <tr><td style="padding:3px 16px 3px 0;color:#4b5563;">Date of Hire:</td><td><strong>${hireDate}</strong></td></tr>
  <tr><td style="padding:3px 16px 3px 0;color:#4b5563;">Monthly Basic Salary:</td><td><strong>₱${fmtN((emp as any).salary ?? 0)}</strong></td></tr>
</table>

<p>This certification is issued upon the request of the Employee for whatever legal purpose it may serve.</p>

<p style="margin-top:24px;">Issued this <strong>${today}</strong> at <strong>${company?.address ?? '___'}</strong>.</p>

<div style="margin-top:40px;">
  <div class="sig-line"></div>
  <p style="margin:4px 0;font-size:11px;"><strong>${company?.name ?? ''}</strong></p>
  <p style="margin:0;font-size:10px;color:#6b7280;">Authorized Representative</p>
</div>
</div>

<p style="font-size:9px;color:#9ca3af;text-align:center;margin-top:30px;">System-generated · ${company?.name ?? ''}</p>
</body></html>`;
}

// ─── Main AnnualReports Component ────────────────────────────────────────────

interface AnnualReportsProps {
    employees: Employee[];
    company: CompanyProfile | null;
}

const AnnualReports: React.FC<AnnualReportsProps> = ({ employees, company }) => {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [ytdRows, setYtdRows] = useState<YTDRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [obEmployee, setObEmployee] = useState<Employee | null>(null);
    const [search, setSearch] = useState('');

    const empMap = new Map(employees.map(e => [e.id, e]));

    const load = useCallback(async () => {
        setLoading(true);
        const rows = await getAllYTDRecords(year);
        setYtdRows(rows);
        setLoading(false);
    }, [year]);

    useEffect(() => { load(); }, [load]);

    const filtered = ytdRows.filter(row => {
        const e = empMap.get(row.employeeId);
        if (!e) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || (e.department ?? '').toLowerCase().includes(q);
    });

    // Include all employees even those with no payroll records (show zeros)
    const allRows: YTDRow[] = employees
        .filter(e => e.status !== 'Terminated' || ytdRows.some(r => r.employeeId === e.id))
        .map(e => ytdRows.find(r => r.employeeId === e.id) ?? {
            employeeId: e.id, ytdBasicPay: 0, ytdGrossPay: 0, ytdTaxableIncome: 0,
            ytdWithholdingTax: 0, ytdSss: 0, ytdPhilhealth: 0, ytdPagibig: 0,
            ytdNetPay: 0, ytdThirteenthMonth: 0, periodCount: 0,
        });

    const displayRows = search ? filtered : allRows;

    const totals = displayRows.reduce((acc, r) => ({
        ytdBasicPay: acc.ytdBasicPay + r.ytdBasicPay,
        ytdGrossPay: acc.ytdGrossPay + r.ytdGrossPay,
        ytdTaxableIncome: acc.ytdTaxableIncome + r.ytdTaxableIncome,
        ytdWithholdingTax: acc.ytdWithholdingTax + r.ytdWithholdingTax,
        ytdSss: acc.ytdSss + r.ytdSss,
        ytdPhilhealth: acc.ytdPhilhealth + r.ytdPhilhealth,
        ytdPagibig: acc.ytdPagibig + r.ytdPagibig,
        ytdNetPay: acc.ytdNetPay + r.ytdNetPay,
        ytdThirteenthMonth: acc.ytdThirteenthMonth + r.ytdThirteenthMonth,
    }), { ytdBasicPay: 0, ytdGrossPay: 0, ytdTaxableIncome: 0, ytdWithholdingTax: 0, ytdSss: 0, ytdPhilhealth: 0, ytdPagibig: 0, ytdNetPay: 0, ytdThirteenthMonth: 0 });

    const printYTDReport = () => {
        const rows = displayRows.map(row => {
            const e = empMap.get(row.employeeId);
            const name = e ? `${e.lastName}, ${e.firstName}` : row.employeeId;
            return `<tr>
              <td>${name}</td><td>${e?.department ?? ''}</td>
              <td class="right">₱${fmtN(row.ytdGrossPay)}</td>
              <td class="right">₱${fmtN(row.ytdTaxableIncome)}</td>
              <td class="right">₱${fmtN(row.ytdSss)}</td>
              <td class="right">₱${fmtN(row.ytdPhilhealth)}</td>
              <td class="right">₱${fmtN(row.ytdPagibig)}</td>
              <td class="right">₱${fmtN(row.ytdWithholdingTax)}</td>
              <td class="right">₱${fmtN(row.ytdThirteenthMonth)}</td>
              <td class="right" style="font-weight:600;">₱${fmtN(row.ytdNetPay)}</td>
            </tr>`;
        }).join('');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>YTD Summary ${year}</title>
<style>${BASE_STYLES} .right{text-align:right;}</style></head><body>
${printBtn()}
${reportHeader(company, `Year-to-Date Payroll Summary`, `January 1 – December 31, ${year}`)}
<table>
  <thead><tr><th>Employee</th><th>Dept.</th><th class="right">Gross Pay</th><th class="right">Taxable Inc.</th><th class="right">SSS (EE)</th><th class="right">PhilHealth (EE)</th><th class="right">Pag-IBIG (EE)</th><th class="right">W/Tax</th><th class="right">13th Mo.</th><th class="right">Net Pay</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <td colspan="2">TOTAL (${displayRows.length})</td>
    <td class="right">₱${fmtN(totals.ytdGrossPay)}</td>
    <td class="right">₱${fmtN(totals.ytdTaxableIncome)}</td>
    <td class="right">₱${fmtN(totals.ytdSss)}</td>
    <td class="right">₱${fmtN(totals.ytdPhilhealth)}</td>
    <td class="right">₱${fmtN(totals.ytdPagibig)}</td>
    <td class="right">₱${fmtN(totals.ytdWithholdingTax)}</td>
    <td class="right">₱${fmtN(totals.ytdThirteenthMonth)}</td>
    <td class="right">₱${fmtN(totals.ytdNetPay)}</td>
  </tr></tfoot>
</table>
<p style="margin-top:12px;font-size:9px;color:#9ca3af;text-align:center;">System-generated · ${company?.name ?? ''} · Includes opening balances where entered</p>
</body></html>`;
        printHTML(html);
    };

    const print2316All = () => {
        const pages = displayRows.map((row, i) => {
            const e = empMap.get(row.employeeId);
            if (!e) return '';
            const inner = generate2316HTML(e, row, year, company);
            const body = inner.replace(/<!DOCTYPE[\s\S]*?<body[^>]*>/i, '').replace('</body></html>', '');
            return `<div style="page-break-after:${i < displayRows.length - 1 ? 'always' : 'auto'}">${body}</div>`;
        }).join('');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>BIR 2316 Bulk – ${year}</title>
<style>${BASE_STYLES} .no-print{display:block;} @media print{.no-print{display:none!important;}} .box{border:1px solid #374151;padding:3px 6px;min-height:22px;display:inline-block;min-width:120px;} .label{font-size:8px;color:#6b7280;display:block;margin-bottom:1px;} .field{margin-bottom:8px;} .section-header{background:#e5e7eb;padding:4px 8px;font-weight:700;font-size:10px;text-transform:uppercase;margin:12px 0 6px;letter-spacing:.05em;} .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;} .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;} h1{font-size:14px;font-weight:700;text-align:center;margin:0 0 2px;} h2{font-size:10px;text-align:center;color:#4b5563;margin:0 0 12px;} .total-box{background:#f9fafb;border:1.5px solid #374151;padding:6px 10px;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:12px;margin-top:8px;} .right{text-align:right;} .sig-line{border-top:1px solid #374151;width:240px;margin-top:40px;} .letterhead{text-align:center;margin-bottom:24px;border-bottom:2px solid #0f2c52;padding-bottom:12px;} .title{font-size:16px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:.1em;margin:20px 0 8px;} .subtitle{font-size:10px;text-align:center;color:#6b7280;margin-bottom:24px;} .body{max-width:600px;margin:0 auto;}</style></head>
<body>
<div class="no-print" style="margin-bottom:12px;"><button onclick="window.print()" style="background:#0f2c52;color:white;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;margin-right:8px;">Print All</button><button onclick="window.close()" style="border:1px solid #d1d5db;padding:8px 18px;border-radius:6px;cursor:pointer;">Close</button></div>
${pages}
</body></html>`;
        printHTML(html);
    };

    return (
        <div className="space-y-6">
            {/* Header controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Annual Reports</h2>
                    <p className="text-sm text-gray-500">Year-to-date cumulative payroll data, BIR 2316, and employment certifications</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 font-medium">Year</label>
                    <select value={year} onChange={e => setYear(Number(e.target.value))}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: `YTD Total Gross (${year})`, value: fmt(totals.ytdGrossPay), color: 'text-blue-700' },
                    { label: `YTD Net Pay`, value: fmt(totals.ytdNetPay), color: 'text-green-700' },
                    { label: `YTD W/Tax (BIR)`, value: fmt(totals.ytdWithholdingTax), color: 'text-red-600' },
                    { label: `YTD 13th Month`, value: fmt(totals.ytdThirteenthMonth), color: 'text-amber-700' },
                ].map(s => (
                    <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-500">{s.label}</p>
                        <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Actions row */}
            <div className="flex flex-wrap gap-3">
                <button onClick={printYTDReport}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                    style={{ background: 'rgb(15,44,82)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print YTD Summary
                </button>
                <button onClick={print2316All}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border-2 hover:bg-gray-50 transition-colors"
                    style={{ borderColor: 'rgb(15,44,82)', color: 'rgb(15,44,82)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Generate All BIR 2316
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* YTD Table */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Employee', 'Dept.', 'Gross Pay', 'Taxable Inc.', 'SSS (EE)', 'PhilHealth', 'Pag-IBIG', 'W/Tax', '13th Mo.', 'Net Pay', 'Actions'].map(h => (
                                    <th key={h} className="px-3 py-3 text-right first:text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {displayRows.map(row => {
                                const e = empMap.get(row.employeeId);
                                if (!e) return null;
                                return (
                                    <tr key={row.employeeId} className="hover:bg-gray-50">
                                        <td className="px-3 py-2.5">
                                            <p className="font-medium text-gray-900">{e.lastName}, {e.firstName}</p>
                                            <p className="text-xs text-gray-400">{row.periodCount} period{row.periodCount !== 1 ? 's' : ''}</p>
                                        </td>
                                        <td className="px-3 py-2.5 text-gray-500 text-xs">{e.department}</td>
                                        <td className="px-3 py-2.5 text-right">{fmt(row.ytdGrossPay)}</td>
                                        <td className="px-3 py-2.5 text-right text-gray-600">{fmt(row.ytdTaxableIncome)}</td>
                                        <td className="px-3 py-2.5 text-right text-red-600">{fmt(row.ytdSss)}</td>
                                        <td className="px-3 py-2.5 text-right text-red-600">{fmt(row.ytdPhilhealth)}</td>
                                        <td className="px-3 py-2.5 text-right text-red-600">{fmt(row.ytdPagibig)}</td>
                                        <td className="px-3 py-2.5 text-right text-red-700 font-medium">{fmt(row.ytdWithholdingTax)}</td>
                                        <td className="px-3 py-2.5 text-right text-amber-700">{fmt(row.ytdThirteenthMonth)}</td>
                                        <td className="px-3 py-2.5 text-right font-semibold text-green-700">{fmt(row.ytdNetPay)}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1 justify-end">
                                                <button
                                                    onClick={() => setObEmployee(e)}
                                                    title="Set Opening Balance"
                                                    className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors whitespace-nowrap">
                                                    OB
                                                </button>
                                                <button
                                                    onClick={() => printHTML(generate2316HTML(e, row, year, company))}
                                                    title="BIR Form 2316"
                                                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors whitespace-nowrap">
                                                    2316
                                                </button>
                                                <button
                                                    onClick={() => printHTML(generateEmpCertHTML(e, row, year, company))}
                                                    title="Employment Certificate"
                                                    className="px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded hover:bg-teal-100 transition-colors whitespace-nowrap">
                                                    Cert
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold text-sm">
                            <tr>
                                <td className="px-3 py-2.5" colSpan={2}>TOTAL ({displayRows.length})</td>
                                <td className="px-3 py-2.5 text-right">{fmt(totals.ytdGrossPay)}</td>
                                <td className="px-3 py-2.5 text-right text-gray-600">{fmt(totals.ytdTaxableIncome)}</td>
                                <td className="px-3 py-2.5 text-right text-red-700">{fmt(totals.ytdSss)}</td>
                                <td className="px-3 py-2.5 text-right text-red-700">{fmt(totals.ytdPhilhealth)}</td>
                                <td className="px-3 py-2.5 text-right text-red-700">{fmt(totals.ytdPagibig)}</td>
                                <td className="px-3 py-2.5 text-right text-red-800">{fmt(totals.ytdWithholdingTax)}</td>
                                <td className="px-3 py-2.5 text-right text-amber-800">{fmt(totals.ytdThirteenthMonth)}</td>
                                <td className="px-3 py-2.5 text-right text-green-800">{fmt(totals.ytdNetPay)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            <p className="text-xs text-gray-400">
                * YTD totals include opening balances (pre-system data) plus all Finalized/Paid payroll periods in {year}. Click "OB" to enter opening balances for employees added mid-year.
            </p>

            {/* Opening Balance Modal */}
            {obEmployee && (
                <OpeningBalanceModal
                    employee={obEmployee}
                    year={year}
                    onClose={() => setObEmployee(null)}
                    onSaved={load}
                />
            )}
        </div>
    );
};

export default AnnualReports;
