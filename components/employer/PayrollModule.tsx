import React, { useState, useEffect, useCallback } from 'react';
import {
    PayrollPeriod, PayrollRecord, PayrollAdjustment, PayFrequency,
    PayrollStatus, AdjustmentType, Employee, DeMinimisItem, DeMinimisType,
    Shift, Holiday, WorkSchedule,
} from '../../types';
import {
    getPayrollPeriods, createPayrollPeriod, updatePayrollPeriodStatus, deletePayrollPeriod,
    getPayrollRecords, upsertPayrollRecord, generatePayrollForPeriod,
    getPayrollAdjustments, addPayrollAdjustment, computeEmployeePayroll,
    getDeMinimisForPeriodEmployee, upsertDeMinimisItem, deleteDeMinimisItem,
    DE_MINIMIS_CEILINGS,
    getEmployees, getShifts, getHolidays, getCompanyProfile,
} from '../../services/supabaseApi';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    '₱' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const statusColor: Record<PayrollStatus, string> = {
    Draft: 'bg-amber-100 text-amber-800',
    Finalized: 'bg-blue-100 text-blue-800',
    Paid: 'bg-green-100 text-green-800',
};

// ─── Payroll Breakdown Modal ─────────────────────────────────────────────────

interface PayrollBreakdownModalProps {
    record: PayrollRecord;
    employeeName: string;
    periodName: string;
    payFrequency: PayFrequency;
    onClose: () => void;
}

const PayrollBreakdownModal: React.FC<PayrollBreakdownModalProps> = ({ record: r, employeeName, periodName, payFrequency, onClose }) => {
    const benefitDivisor = payFrequency === 'semi-monthly' ? 2 : 1;
    const dailyRate = r.dailyRate;
    const hourlyRate = dailyRate / 8;
    const minuteRate = hourlyRate / 60;
    const scheduledWorkDays = r.daysWorked + r.absentDays;

    type Row = { label: string; formula: string; value: number; indent?: boolean; sub?: boolean; bold?: boolean; color?: string };

    const earningsRows: Row[] = [
        { label: 'Monthly Basic Salary', formula: `Given`, value: r.basicSalary, bold: true },
        { label: 'Daily Rate', formula: `₱${r.basicSalary.toFixed(2)} × 12 ÷ 52 wks ÷ work days/wk`, value: dailyRate, indent: true },
        { label: 'Hourly Rate', formula: `${fmt(dailyRate)} ÷ 8 hrs`, value: hourlyRate, indent: true },
        { label: 'Scheduled Work Days', formula: `Days worked (${r.daysWorked}) + Absent days (${r.absentDays})`, value: scheduledWorkDays, indent: true },
        {
            label: 'Basic Pay',
            formula: payFrequency === 'semi-monthly'
                ? `₱${r.basicSalary.toFixed(2)} ÷ 2 (semi-monthly cut-off)`
                : `${fmt(dailyRate)} × ${scheduledWorkDays} sched days`,
            value: r.basicPay, bold: true, color: 'text-blue-700',
        },
    ];

    const premiumRows: Row[] = [];
    if (r.overtimeHours > 0) {
        premiumRows.push({ label: 'Overtime Pay (125%)', formula: `${r.overtimeHours.toFixed(2)} OT hrs × ${fmt(hourlyRate)} × 125%`, value: r.overtimePay, color: 'text-blue-700' });
    }
    if (r.regularHolidayHours > 0) {
        premiumRows.push({ label: 'Regular Holiday Premium (+100%)', formula: `${r.regularHolidayHours.toFixed(2)} hrs × ${fmt(hourlyRate)} × 100%`, value: r.regularHolidayPay, color: 'text-blue-700' });
    }
    if (r.specialHolidayHours > 0) {
        premiumRows.push({ label: 'Special Holiday Premium (+30%)', formula: `${r.specialHolidayHours.toFixed(2)} hrs × ${fmt(hourlyRate)} × 30%`, value: r.specialHolidayPay, color: 'text-blue-700' });
    }
    if (r.nightDiffHours > 0) {
        premiumRows.push({ label: 'Night Differential (+10%)', formula: `${r.nightDiffHours.toFixed(2)} hrs × ${fmt(hourlyRate)} × 10%`, value: r.nightDiffPay, color: 'text-blue-700' });
    }
    if (r.restDayHours > 0) {
        premiumRows.push({ label: 'Rest Day Premium (+30%)', formula: `${r.restDayHours.toFixed(2)} hrs × ${fmt(hourlyRate)} × 30%`, value: r.restDayPay, color: 'text-blue-700' });
    }

    const deductionRows: Row[] = [];
    if (r.absentDays > 0) {
        deductionRows.push({ label: 'Absent Deduction', formula: `${r.absentDays} day(s) × ${fmt(dailyRate)}`, value: -r.absentDeduction, color: 'text-red-600' });
    }
    if (r.lateMinutes > 0) {
        deductionRows.push({ label: 'Late Deduction', formula: `${r.lateMinutes} min × ${fmt(minuteRate)}/min`, value: -r.lateDeduction, color: 'text-red-600' });
    }
    if (r.undertimeMinutes > 0) {
        deductionRows.push({ label: 'Undertime Deduction', formula: `${r.undertimeMinutes} min × ${fmt(minuteRate)}/min`, value: -r.undertimeDeduction, color: 'text-red-600' });
    }

    const benefitRows: Row[] = [];
    if (r.allowance > 0) {
        benefitRows.push({
            label: 'Allowance',
            formula: benefitDivisor > 1 ? `Monthly allowance ÷ ${benefitDivisor} (${payFrequency})` : 'Monthly allowance',
            value: r.allowance, color: 'text-green-700',
        });
    }
    if (r.deMinimis > 0) {
        benefitRows.push({
            label: 'Other Benefits / De Minimis',
            formula: `Non-taxable benefits this period`,
            value: r.deMinimis, color: 'text-green-700',
        });
    }

    const grossCalc = r.basicPay
        + (r.overtimePay + r.regularHolidayPay + r.specialHolidayPay + r.nightDiffPay + r.restDayPay)
        - (r.absentDeduction + r.lateDeduction + r.undertimeDeduction)
        + r.allowance + r.deMinimis;

    const monthlyContrib = r.sssContribution * benefitDivisor + r.philhealthContribution * benefitDivisor + r.pagibigContribution * benefitDivisor;
    const taxableIncome = r.taxableIncome;
    const annualTaxable = taxableIncome * 12;

    const contribRows: Row[] = [
        { label: 'SSS Contribution', formula: benefitDivisor > 1 ? `Monthly SSS ÷ ${benefitDivisor}` : 'Based on monthly salary bracket', value: -r.sssContribution, color: 'text-red-600' },
        { label: 'PhilHealth Contribution', formula: benefitDivisor > 1 ? `Monthly PhilHealth ÷ ${benefitDivisor}` : 'Based on monthly salary', value: -r.philhealthContribution, color: 'text-red-600' },
        { label: 'Pag-IBIG Contribution', formula: benefitDivisor > 1 ? `Monthly Pag-IBIG ÷ ${benefitDivisor}` : 'Based on monthly salary', value: -r.pagibigContribution, color: 'text-red-600' },
    ];

    const taxRows: Row[] = [
        { label: 'Monthly Basic Salary', formula: 'For tax computation base', value: r.basicSalary, indent: true },
        { label: 'Less: Monthly Contributions', formula: `SSS + PhilHealth + Pag-IBIG`, value: -monthlyContrib, indent: true, color: 'text-red-600' },
        { label: 'Monthly Taxable Income', formula: `${fmt(r.basicSalary)} − ${fmt(monthlyContrib)}`, value: taxableIncome, indent: true, bold: true },
        { label: 'Annual Taxable Income', formula: `${fmt(taxableIncome)} × 12 months`, value: annualTaxable, indent: true },
        { label: 'Annual Tax (TRAIN Law)', formula: annualTaxable <= 250000 ? 'Annual income ≤ ₱250,000 → ₱0' : 'Per BIR tax table (RR 8-2018)', value: r.withholdingTax * 12 * (payFrequency === 'semi-monthly' ? 2 : 1), indent: true },
        { label: 'Withholding Tax (this period)', formula: `Annual tax ÷ 12 ÷ ${payFrequency === 'semi-monthly' ? 2 : 1} period(s)/mo`, value: -r.withholdingTax, bold: true, color: 'text-red-600' },
    ];

    const loanRows: Row[] = [];
    if (r.sssLoan > 0) loanRows.push({ label: 'SSS Loan', formula: 'Loan deduction', value: -r.sssLoan, color: 'text-red-600' });
    if (r.pagibigLoan > 0) loanRows.push({ label: 'Pag-IBIG Loan', formula: 'Loan deduction', value: -r.pagibigLoan, color: 'text-red-600' });
    if (r.cashAdvance > 0) loanRows.push({ label: 'Cash Advance', formula: 'Cash advance repayment', value: -r.cashAdvance, color: 'text-red-600' });
    if (r.otherDeductions > 0) loanRows.push({ label: 'Other Deductions', formula: 'Miscellaneous deductions', value: -r.otherDeductions, color: 'text-red-600' });

    const Section: React.FC<{ title: string; accent: string; rows: Row[]; children?: React.ReactNode }> = ({ title, accent, rows, children }) => (
        <div className={`rounded-xl border ${accent} overflow-hidden`}>
            <div className={`px-4 py-2.5 ${accent.replace('border-', 'bg-').replace('-200', '-50')}`}>
                <p className={`text-sm font-semibold ${accent.replace('border-', 'text-').replace('-200', '-900')}`}>{title}</p>
            </div>
            <div className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${row.indent ? 'pl-8 bg-gray-50/50' : ''}`}>
                        <div className="flex-1 min-w-0 mr-4">
                            <p className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-700'} ${row.indent ? 'text-xs' : ''}`}>{row.label}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{row.formula}</p>
                        </div>
                        <p className={`text-sm font-semibold tabular-nums flex-shrink-0 ${row.color ?? (row.value >= 0 ? 'text-gray-800' : 'text-red-600')}`}>
                            {row.value < 0 ? `−${fmt(Math.abs(row.value))}` : fmt(row.value)}
                        </p>
                    </div>
                ))}
                {children}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Payroll Breakdown</h2>
                        <p className="text-xs text-gray-500">{employeeName} · {periodName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                    {/* Basic */}
                    <Section title="Basic Pay" accent="border-blue-200" rows={earningsRows} />

                    {/* Premiums */}
                    {premiumRows.length > 0 && (
                        <Section title="Overtime & Holiday Premiums" accent="border-sky-200" rows={premiumRows} />
                    )}

                    {/* Deductions */}
                    {deductionRows.length > 0 && (
                        <Section title="Attendance Deductions" accent="border-red-200" rows={deductionRows} />
                    )}

                    {/* Benefits */}
                    {benefitRows.length > 0 && (
                        <Section title="Allowances & Benefits" accent="border-green-200" rows={benefitRows} />
                    )}

                    {/* Gross Pay */}
                    <div className="bg-blue-600 rounded-xl px-5 py-3 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-blue-200">Basic Pay + Premiums − Deductions + Benefits</p>
                            <p className="text-sm font-bold text-white">Gross Pay</p>
                        </div>
                        <p className="text-2xl font-bold text-white tabular-nums">{fmt(grossCalc)}</p>
                    </div>

                    {/* Government Contributions */}
                    <Section title="Government Contributions" accent="border-orange-200" rows={contribRows} />

                    {/* Withholding Tax */}
                    <Section title="Withholding Tax (BIR TRAIN Law)" accent="border-yellow-200" rows={taxRows} />

                    {/* Loans / Other */}
                    {loanRows.length > 0 && (
                        <Section title="Loans & Other Deductions" accent="border-red-200" rows={loanRows} />
                    )}

                    {/* Net Pay */}
                    <div className="bg-green-600 rounded-xl px-5 py-3 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-green-200">Gross Pay − Contributions − W/Tax − Loans</p>
                            <p className="text-sm font-bold text-white">Net Pay</p>
                        </div>
                        <p className="text-2xl font-bold text-white tabular-nums">{fmt(r.netPay)}</p>
                    </div>
                </div>

                <div className="flex justify-end px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Create Period Modal ────────────────────────────────────────────────────

interface CreatePeriodModalProps {
    onClose: () => void;
    onSave: (p: PayrollPeriod) => void;
}

const CreatePeriodModal: React.FC<CreatePeriodModalProps> = ({ onClose, onSave }) => {
    const today = new Date();
    const [form, setForm] = useState({
        periodName: '',
        payFrequency: 'semi-monthly' as PayFrequency,
        periodStart: today.toISOString().slice(0, 10),
        periodEnd: '',
        payDate: '',
        notes: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (k: keyof typeof form, v: string) =>
        setForm(prev => ({ ...prev, [k]: v }));

    const handleSave = async () => {
        if (!form.periodName || !form.periodStart || !form.periodEnd || !form.payDate) {
            setError('Please fill in all required fields.');
            return;
        }
        setSaving(true);
        const result = await createPayrollPeriod(form);
        setSaving(false);
        if (!result || 'error' in result) {
            setError((result as any)?.error ?? 'Failed to create period.');
            return;
        }
        onSave(result);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">New Payroll Period</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <div className="p-6 space-y-4">
                    {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Period Name *</label>
                        <input value={form.periodName} onChange={e => set('periodName', e.target.value)}
                            placeholder="e.g. April 1-15, 2025" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pay Frequency *</label>
                        <select value={form.payFrequency} onChange={e => set('payFrequency', e.target.value as PayFrequency)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="semi-monthly">Semi-Monthly (15th & 30th)</option>
                            <option value="monthly">Monthly</option>
                            <option value="bi-weekly">Bi-Weekly</option>
                            <option value="weekly">Weekly</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Period Start *</label>
                            <input type="date" value={form.periodStart} onChange={e => set('periodStart', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Period End *</label>
                            <input type="date" value={form.periodEnd} onChange={e => set('periodEnd', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pay Date *</label>
                        <input type="date" value={form.payDate} onChange={e => set('payDate', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                        {saving ? 'Creating…' : 'Create Period'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Edit Record Modal ──────────────────────────────────────────────────────

interface EditRecordModalProps {
    record: PayrollRecord;
    employeeName: string;
    onClose: () => void;
    onSave: (r: PayrollRecord) => void;
    period: PayrollPeriod;
}

const DE_MINIMIS_TYPES = Object.entries(DE_MINIMIS_CEILINGS) as [DeMinimisType, { label: string; monthlyCeiling: number; note: string }][];

const EditRecordModal: React.FC<EditRecordModalProps> = ({ record, employeeName, onClose, onSave, period }) => {
    const [form, setForm] = useState({ ...record });
    const [deMinimisItems, setDeMinimisItems] = useState<DeMinimisItem[]>([]);
    const [loadingDM, setLoadingDM] = useState(true);
    const [addingType, setAddingType] = useState<DeMinimisType>('rice_subsidy');
    const [addingAmount, setAddingAmount] = useState('');
    const [addingCeiling, setAddingCeiling] = useState('');
    const [computing, setComputing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getDeMinimisForPeriodEmployee(record.periodId, record.employeeId).then(items => {
            setDeMinimisItems(items);
            setLoadingDM(false);
        });
    }, [record.periodId, record.employeeId]);

    const totalExempt = deMinimisItems.reduce((s, i) => s + i.exemptAmount, 0);
    const totalExcess = deMinimisItems.reduce((s, i) => s + i.taxableExcess, 0);

    const setN = (k: keyof PayrollRecord, v: string) =>
        setForm(prev => ({ ...prev, [k]: parseFloat(v) || 0 }));

    const recompute = async () => {
        setComputing(true);
        const computed = await computeEmployeePayroll({
            employeeId: form.employeeId,
            companyId: form.companyId,
            periodId: form.periodId,
            basicSalary: form.basicSalary,
            scheduledWorkDays: form.daysWorked + form.absentDays,
            daysWorked: form.daysWorked,
            hoursWorked: form.hoursWorked,
            absentDays: form.absentDays,
            lateMinutes: form.lateMinutes,
            undertimeMinutes: form.undertimeMinutes,
            overtimeHours: form.overtimeHours,
            regularHolidayHours: form.regularHolidayHours,
            specialHolidayHours: form.specialHolidayHours,
            nightDiffHours: form.nightDiffHours,
            restDayHours: form.restDayHours,
            allowance: form.allowance,
            otherBenefits: (form as any).otherBenefits ?? 0,
            deMinimisExempt: totalExempt,
            deMinimisExcess: totalExcess,
            payFrequency: period.payFrequency,
        });
        setForm(prev => ({ ...prev, ...computed, id: prev.id }));
        setComputing(false);
    };

    const handleAddDeMinimis = async () => {
        if (!addingAmount) return;
        const amount = parseFloat(addingAmount);
        const customCeiling = addingCeiling ? parseFloat(addingCeiling) : undefined;
        const saved = await upsertDeMinimisItem({
            periodId: record.periodId,
            employeeId: record.employeeId,
            benefitType: addingType,
            amountThisPeriod: amount,
            customMonthlyCeiling: customCeiling,
        });
        if (saved) {
            setDeMinimisItems(prev => {
                const filtered = prev.filter(i => i.benefitType !== addingType);
                return [...filtered, saved];
            });
            setAddingAmount('');
            setAddingCeiling('');
        }
    };

    const handleRemoveDeMinimis = async (item: DeMinimisItem) => {
        await deleteDeMinimisItem(item.id);
        setDeMinimisItems(prev => prev.filter(i => i.id !== item.id));
    };

    const handleSave = async () => {
        setSaving(true);
        // Sync de minimis totals into the record before saving
        const updatedForm = {
            ...form,
            deMinimis: totalExempt + totalExcess,
        };
        const saved = await upsertPayrollRecord(updatedForm);
        setSaving(false);
        if (saved) onSave(saved);
    };

    const field = (label: string, key: keyof PayrollRecord, readOnly = false) => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">{label}</label>
            <input type="number" value={Number(form[key]).toFixed(2)} readOnly={readOnly}
                onChange={e => !readOnly && setN(key, e.target.value)}
                className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${readOnly ? 'bg-gray-50 text-gray-500' : ''}`} />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Edit Payroll — {employeeName}</h2>
                        <p className="text-xs text-gray-500">{period.periodName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <div className="overflow-y-auto flex-1 p-6 space-y-6">
                    {/* Basic */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center font-bold">₱</span>
                            Basic Information
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            {field('Basic Salary (Monthly)', 'basicSalary')}
                            {field('Days Worked', 'daysWorked')}
                            {field('Daily Rate', 'dailyRate', true)}
                        </div>
                    </div>

                    {/* Attendance Deductions */}
                    <div className="border border-red-100 rounded-xl overflow-hidden">
                        <div className="bg-red-50 px-4 py-2.5">
                            <h3 className="text-sm font-semibold text-red-900">Attendance Deductions</h3>
                            <p className="text-xs text-red-500 mt-0.5">Auto-computed from clock-in/out records vs. shift schedule</p>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                {field('Absent Days', 'absentDays')}
                                {field('Late (minutes)', 'lateMinutes')}
                                {field('Undertime (minutes)', 'undertimeMinutes')}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {field('Absent Deduction', 'absentDeduction', true)}
                                {field('Late Deduction', 'lateDeduction', true)}
                                {field('Undertime Deduction', 'undertimeDeduction', true)}
                            </div>
                        </div>
                    </div>

                    {/* Special Hours & Pay */}
                    <div className="border border-blue-100 rounded-xl overflow-hidden">
                        <div className="bg-blue-50 px-4 py-2.5">
                            <h3 className="text-sm font-semibold text-blue-900">Special Hours & Premium Pay</h3>
                            <p className="text-xs text-blue-500 mt-0.5">OT 125% · Regular holiday +100% premium · Special holiday +30% premium · Night diff +10% · Rest day +30%</p>
                        </div>
                        <div className="p-4 grid grid-cols-3 gap-3">
                            {field('OT Hours', 'overtimeHours')}
                            {field('OT Pay (125%)', 'overtimePay', true)}
                            <div />
                            {field('Regular Holiday Hrs', 'regularHolidayHours')}
                            {field('Regular Holiday Pay (+100%)', 'regularHolidayPay', true)}
                            <div />
                            {field('Special Holiday Hrs', 'specialHolidayHours')}
                            {field('Special Holiday Pay (+30%)', 'specialHolidayPay', true)}
                            <div />
                            {field('Night Diff Hours', 'nightDiffHours')}
                            {field('Night Diff Pay (+10%)', 'nightDiffPay', true)}
                            <div />
                            {field('Rest Day Hours', 'restDayHours')}
                            {field('Rest Day Pay (+30%)', 'restDayPay', true)}
                            <div />
                        </div>
                    </div>

                    {/* Allowances & Benefits */}
                    <div className="border border-green-100 rounded-xl overflow-hidden">
                        <div className="bg-green-50 px-4 py-2.5">
                            <h3 className="text-sm font-semibold text-green-900">Allowances & Other Benefits</h3>
                            <p className="text-xs text-green-600 mt-0.5">Non-taxable by default · Semi-monthly: half per period</p>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                            {field('Allowance (this period)', 'allowance')}
                            {field('Other Benefits (this period)', 'deMinimis')}
                        </div>
                    </div>

                    {/* De Minimis Benefits */}
                    <div className="border border-teal-200 rounded-xl overflow-hidden">
                        <div className="bg-teal-50 px-4 py-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-teal-900">De Minimis Benefits</h3>
                                <p className="text-xs text-teal-600 mt-0.5">BIR RR 5-2011 · TRAIN Law · Tax-exempt within ceiling</p>
                            </div>
                            <div className="text-right text-xs">
                                <div className="text-teal-700 font-semibold">Exempt: {fmt(totalExempt)}</div>
                                {totalExcess > 0 && <div className="text-red-600">Taxable excess: {fmt(totalExcess)}</div>}
                            </div>
                        </div>
                        <div className="p-4 space-y-3">
                            {loadingDM ? (
                                <p className="text-xs text-gray-400">Loading…</p>
                            ) : deMinimisItems.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No de minimis benefits added yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {deMinimisItems.map(item => {
                                        const cfg = DE_MINIMIS_CEILINGS[item.benefitType];
                                        return (
                                            <div key={item.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-800">{cfg.label}</p>
                                                    <p className="text-xs text-gray-400">{cfg.note}</p>
                                                </div>
                                                <div className="flex items-center gap-4 ml-3 text-xs text-right flex-shrink-0">
                                                    <div>
                                                        <p className="text-gray-500">Given</p>
                                                        <p className="font-medium">{fmt(item.amountThisPeriod)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-teal-600">Exempt</p>
                                                        <p className="font-semibold text-teal-700">{fmt(item.exemptAmount)}</p>
                                                    </div>
                                                    {item.taxableExcess > 0 && (
                                                        <div>
                                                            <p className="text-red-500">Taxable</p>
                                                            <p className="font-semibold text-red-600">{fmt(item.taxableExcess)}</p>
                                                        </div>
                                                    )}
                                                    <button onClick={() => handleRemoveDeMinimis(item)}
                                                        className="text-gray-300 hover:text-red-500 text-base leading-none ml-1">×</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Add de minimis row */}
                            <div className="flex gap-2 items-end pt-1 border-t border-gray-100">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-500 mb-0.5">Benefit Type</label>
                                    <select value={addingType} onChange={e => setAddingType(e.target.value as DeMinimisType)}
                                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500">
                                        {DE_MINIMIS_TYPES.map(([k, v]) => (
                                            <option key={k} value={k}>{v.label} (ceiling: {fmt(v.monthlyCeiling)}/mo)</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-28">
                                    <label className="block text-xs text-gray-500 mb-0.5">Amount</label>
                                    <input type="number" value={addingAmount} onChange={e => setAddingAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
                                </div>
                                {addingType === 'other' && (
                                    <div className="w-28">
                                        <label className="block text-xs text-gray-500 mb-0.5">Custom Ceiling</label>
                                        <input type="number" value={addingCeiling} onChange={e => setAddingCeiling(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
                                    </div>
                                )}
                                <button onClick={handleAddDeMinimis} disabled={!addingAmount}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex-shrink-0">
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Computed Summary */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">Computed Summary</h3>
                            <button onClick={recompute} disabled={computing}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">
                                {computing ? 'Computing…' : '↻ Recompute'}
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                {field('Basic Pay (fixed)', 'basicPay', true)}
                                {field('OT + Holiday Pay', 'overtimePay', true)}
                                {field('Night Diff + Rest Day', 'nightDiffPay', true)}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {field('Absent Deduction', 'absentDeduction', true)}
                                {field('Late Deduction', 'lateDeduction', true)}
                                {field('Undertime Deduction', 'undertimeDeduction', true)}
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                                {field('Allowance', 'allowance', true)}
                                {field('Other Benefits', 'deMinimis', true)}
                                {field('Hours Worked', 'hoursWorked', true)}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                                    <p className="text-xs font-medium text-blue-700">Gross Pay</p>
                                    <p className="text-lg font-bold text-blue-800">{fmt(form.grossPay)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contributions */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800 mb-3">Government Contributions</h3>
                        <div className="grid grid-cols-4 gap-3">
                            {field('SSS', 'sssContribution', true)}
                            {field('PhilHealth', 'philhealthContribution', true)}
                            {field('Pag-IBIG', 'pagibigContribution', true)}
                            {field('W/Tax', 'withholdingTax', true)}
                        </div>
                    </div>

                    {/* Loans */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800 mb-3">Loans & Other Deductions</h3>
                        <div className="grid grid-cols-3 gap-3">
                            {field('SSS Loan', 'sssLoan')}
                            {field('Pag-IBIG Loan', 'pagibigLoan')}
                            {field('Cash Advance', 'cashAdvance')}
                            {field('Other Deductions', 'otherDeductions')}
                            {field('Total Deductions', 'totalDeductions', true)}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                                <p className="text-xs font-medium text-green-700">Net Pay</p>
                                <p className="text-lg font-bold text-green-800">{fmt(form.netPay)}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                        {saving ? 'Saving…' : 'Save Record'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Add Adjustment Modal ────────────────────────────────────────────────────

interface AddAdjustmentModalProps {
    periodId: string;
    employees: Employee[];
    onClose: () => void;
    onSave: () => void;
}

const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
    bonus: 'Bonus',
    commission: 'Commission',
    allowance: 'Additional Allowance',
    sss_loan: 'SSS Loan',
    pagibig_loan: 'Pag-IBIG Loan',
    cash_advance: 'Cash Advance',
    other_deduction: 'Other Deduction',
    other_addition: 'Other Addition',
};

const AddAdjustmentModal: React.FC<AddAdjustmentModalProps> = ({ periodId, employees, onClose, onSave }) => {
    const [form, setForm] = useState({
        employeeId: employees[0]?.id ?? '',
        adjustmentType: 'bonus' as AdjustmentType,
        amount: '',
        description: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!form.employeeId || !form.amount) { setError('Employee and amount are required.'); return; }
        setSaving(true);
        await addPayrollAdjustment({
            periodId,
            employeeId: form.employeeId,
            adjustmentType: form.adjustmentType,
            amount: parseFloat(form.amount),
            description: form.description,
        });
        setSaving(false);
        onSave();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Add Adjustment</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <div className="p-6 space-y-4">
                    {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                        <select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {employees.filter(e => e.status === 'Active').map(e => (
                                <option key={e.id} value={e.id}>{e.lastName}, {e.firstName}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                        <select value={form.adjustmentType} onChange={e => setForm(p => ({ ...p, adjustmentType: e.target.value as AdjustmentType }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {Object.entries(ADJUSTMENT_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                        <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                            placeholder="0.00" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                        {saving ? 'Saving…' : 'Add Adjustment'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Period Detail View ─────────────────────────────────────────────────────

interface PeriodDetailProps {
    period: PayrollPeriod;
    employees: Employee[];
    onBack: () => void;
    onStatusChange: (status: PayrollStatus) => void;
}

const PeriodDetail: React.FC<PeriodDetailProps> = ({ period, employees, onBack, onStatusChange }) => {
    const [records, setRecords] = useState<PayrollRecord[]>([]);
    const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [companySchedule, setCompanySchedule] = useState<WorkSchedule>(WorkSchedule.MONDAY_TO_FRIDAY);
    const [gracePeriodMinutes, setGracePeriodMinutes] = useState(5);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null);
    const [breakdownRecord, setBreakdownRecord] = useState<PayrollRecord | null>(null);
    const [showAdjModal, setShowAdjModal] = useState(false);
    const [tab, setTab] = useState<'records' | 'adjustments' | 'summary'>('records');
    const [search, setSearch] = useState('');

    const empMap = new Map(employees.map(e => [e.id, e]));

    const loadData = useCallback(async () => {
        setLoading(true);
        const [recs, adjs, shiftsData, holidaysData, company] = await Promise.all([
            getPayrollRecords(period.id),
            getPayrollAdjustments(period.id),
            getShifts(),
            getHolidays(),
            getCompanyProfile(),
        ]);
        setRecords(recs);
        setAdjustments(adjs);
        setShifts(shiftsData);
        setHolidays(holidaysData);
        if (company) {
            setCompanySchedule(company.workSchedule);
            setGracePeriodMinutes(company.gracePeriodMinutes ?? 5);
        }
        setLoading(false);
    }, [period.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleGenerate = async () => {
        setGenerating(true);
        const result = await generatePayrollForPeriod(period, employees, {
            shifts,
            workSchedule: companySchedule,
            gracePeriodMinutes,
            holidays,
        });
        setRecords(result);
        setGenerating(false);
    };

    const filteredRecords = records.filter(r => {
        const emp = empMap.get(r.employeeId);
        if (!emp) return false;
        const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        return name.includes(search.toLowerCase());
    });

    const totalGross = records.reduce((s, r) => s + r.grossPay, 0);
    const totalNet = records.reduce((s, r) => s + r.netPay, 0);
    const totalSSS = records.reduce((s, r) => s + r.sssContribution, 0);
    const totalPH = records.reduce((s, r) => s + r.philhealthContribution, 0);
    const totalPIBIG = records.reduce((s, r) => s + r.pagibigContribution, 0);
    const totalTax = records.reduce((s, r) => s + r.withholdingTax, 0);

    const canEdit = period.status === 'Draft';

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="text-gray-500 hover:text-gray-800 text-sm flex items-center gap-1 font-medium">
                    ← Back
                </button>
                <span className="text-gray-300">|</span>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900">{period.periodName}</h2>
                    <p className="text-sm text-gray-500">{period.periodStart} – {period.periodEnd} · Pay Date: {period.payDate}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor[period.status]}`}>{period.status}</span>
                {canEdit && (
                    <button onClick={handleGenerate} disabled={generating}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                        {generating ? 'Generating…' : '⚡ Auto-Generate'}
                    </button>
                )}
                {period.status === 'Draft' && records.length > 0 && (
                    <button onClick={() => onStatusChange('Finalized')}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                        Finalize
                    </button>
                )}
                {period.status === 'Finalized' && (
                    <button onClick={() => onStatusChange('Paid')}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                        Mark Paid
                    </button>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total Gross', value: fmt(totalGross), color: 'bg-blue-50 text-blue-700' },
                    { label: 'Total Net Pay', value: fmt(totalNet), color: 'bg-green-50 text-green-700' },
                    { label: 'Total Deductions', value: fmt(totalGross - totalNet), color: 'bg-red-50 text-red-700' },
                    { label: 'Employees', value: `${records.length}`, color: 'bg-gray-50 text-gray-700' },
                ].map(c => (
                    <div key={c.label} className={`rounded-xl p-4 ${c.color}`}>
                        <p className="text-xs font-medium opacity-70">{c.label}</p>
                        <p className="text-xl font-bold">{c.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-200">
                {(['records', 'adjustments', 'summary'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        {t === 'records' ? `Records (${records.length})` : t === 'adjustments' ? `Adjustments (${adjustments.length})` : 'Gov\'t Summary'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-16 text-gray-400">Loading payroll data…</div>
            ) : tab === 'records' ? (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search employee…"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {canEdit && (
                            <button onClick={() => setShowAdjModal(true)}
                                className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                                + Add Adjustment
                            </button>
                        )}
                    </div>
                    {filteredRecords.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <p className="text-lg">No payroll records yet.</p>
                            <p className="text-sm mt-1">Click "Auto-Generate" to compute payroll for all active employees.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {['Employee', 'Days Worked', 'Basic Pay', 'Holiday Pay', 'OT Pay', 'Less: Absences', 'Less: Tardiness', 'Allowance', 'Other Benefits', 'Gross', 'SSS', 'PhilHealth', 'Pag-IBIG', 'W/Tax', 'Net Pay', ''].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredRecords.map(r => {
                                        const emp = empMap.get(r.employeeId);
                                        const holidayPay = r.regularHolidayPay + r.specialHolidayPay + r.restDayPay + r.nightDiffPay;
                                        const tardiness = r.lateDeduction + r.undertimeDeduction;
                                        return (
                                            <tr key={r.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">
                                                    {emp ? `${emp.lastName}, ${emp.firstName}` : r.employeeId}
                                                    <div className="text-xs text-gray-400">{emp?.department}</div>
                                                </td>
                                                <td className="px-3 py-3 text-gray-600">{r.daysWorked}</td>
                                                <td className="px-3 py-3 text-gray-700">{fmt(r.basicPay)}</td>
                                                <td className="px-3 py-3 text-blue-700">{holidayPay > 0 ? fmt(holidayPay) : '—'}</td>
                                                <td className="px-3 py-3 text-blue-700">{r.overtimePay > 0 ? fmt(r.overtimePay) : '—'}</td>
                                                <td className="px-3 py-3 text-red-600">{r.absentDeduction > 0 ? `-${fmt(r.absentDeduction)}` : '—'}</td>
                                                <td className="px-3 py-3 text-red-600">{tardiness > 0 ? `-${fmt(tardiness)}` : '—'}</td>
                                                <td className="px-3 py-3 text-green-700">{r.allowance > 0 ? fmt(r.allowance) : '—'}</td>
                                                <td className="px-3 py-3 text-green-700">{r.deMinimis > 0 ? fmt(r.deMinimis) : '—'}</td>
                                                <td className="px-3 py-3 font-medium text-gray-900">{fmt(r.grossPay)}</td>
                                                <td className="px-3 py-3 text-red-600">{fmt(r.sssContribution)}</td>
                                                <td className="px-3 py-3 text-red-600">{fmt(r.philhealthContribution)}</td>
                                                <td className="px-3 py-3 text-red-600">{fmt(r.pagibigContribution)}</td>
                                                <td className="px-3 py-3 text-red-600">{fmt(r.withholdingTax)}</td>
                                                <td className="px-3 py-3">
                                                    <button
                                                        onClick={() => setBreakdownRecord(r)}
                                                        className="font-bold text-green-700 hover:text-green-900 hover:underline tabular-nums text-left transition-colors"
                                                        title="Click to view computation breakdown"
                                                    >
                                                        {fmt(r.netPay)}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {canEdit && (
                                                        <button onClick={() => setEditRecord(r)}
                                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-gray-50 font-semibold">
                                    <tr>
                                        <td className="px-3 py-3 text-gray-900">TOTAL</td>
                                        <td></td>
                                        <td className="px-3 py-3">{fmt(records.reduce((s, r) => s + r.basicPay, 0))}</td>
                                        <td className="px-3 py-3">{fmt(records.reduce((s, r) => s + r.regularHolidayPay + r.specialHolidayPay + r.restDayPay + r.nightDiffPay, 0))}</td>
                                        <td className="px-3 py-3">{fmt(records.reduce((s, r) => s + r.overtimePay, 0))}</td>
                                        <td className="px-3 py-3 text-red-700">-{fmt(records.reduce((s, r) => s + r.absentDeduction, 0))}</td>
                                        <td className="px-3 py-3 text-red-700">-{fmt(records.reduce((s, r) => s + r.lateDeduction + r.undertimeDeduction, 0))}</td>
                                        <td className="px-3 py-3 text-green-700">{fmt(records.reduce((s, r) => s + r.allowance, 0))}</td>
                                        <td className="px-3 py-3 text-green-700">{fmt(records.reduce((s, r) => s + r.deMinimis, 0))}</td>
                                        <td className="px-3 py-3">{fmt(totalGross)}</td>
                                        <td className="px-3 py-3 text-red-700">{fmt(totalSSS)}</td>
                                        <td className="px-3 py-3 text-red-700">{fmt(totalPH)}</td>
                                        <td className="px-3 py-3 text-red-700">{fmt(totalPIBIG)}</td>
                                        <td className="px-3 py-3 text-red-700">{fmt(totalTax)}</td>
                                        <td className="px-3 py-3 text-green-700">{fmt(totalNet)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            ) : tab === 'adjustments' ? (
                <div>
                    <div className="flex justify-end mb-3">
                        {canEdit && (
                            <button onClick={() => setShowAdjModal(true)}
                                className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                                + Add Adjustment
                            </button>
                        )}
                    </div>
                    {adjustments.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">No adjustments for this period.</div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {['Employee', 'Type', 'Amount', 'Description', 'Date'].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {adjustments.map(a => {
                                        const emp = empMap.get(a.employeeId);
                                        const isDeduction = ['sss_loan', 'pagibig_loan', 'cash_advance', 'other_deduction'].includes(a.adjustmentType);
                                        return (
                                            <tr key={a.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-3 font-medium text-gray-900">
                                                    {emp ? `${emp.lastName}, ${emp.firstName}` : a.employeeId}
                                                </td>
                                                <td className="px-3 py-3 text-gray-600">{ADJUSTMENT_LABELS[a.adjustmentType]}</td>
                                                <td className={`px-3 py-3 font-medium ${isDeduction ? 'text-red-600' : 'text-green-600'}`}>
                                                    {isDeduction ? '-' : '+'}{fmt(a.amount)}
                                                </td>
                                                <td className="px-3 py-3 text-gray-600">{a.description}</td>
                                                <td className="px-3 py-3 text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                /* Government Contributions Summary */
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { name: 'SSS', total: totalSSS, employer: totalSSS * (9.5 / 4.5), employee: totalSSS, color: 'blue', desc: '4.5% employee · 9.5% employer (2024 rates)' },
                            { name: 'PhilHealth', total: totalPH * 2, employer: totalPH, employee: totalPH, color: 'green', desc: '5% total premium · 50/50 split' },
                            { name: 'Pag-IBIG', total: totalPIBIG * 2, employer: totalPIBIG, employee: totalPIBIG, color: 'orange', desc: '2% employee · 2% employer · Max ₱200' },
                        ].map(c => (
                            <div key={c.name} className={`rounded-xl border border-${c.color}-200 p-5`}>
                                <h3 className={`text-base font-bold text-${c.color}-800 mb-1`}>{c.name}</h3>
                                <p className="text-xs text-gray-500 mb-4">{c.desc}</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Employee Share:</span>
                                        <span className="font-semibold text-red-600">{fmt(c.employee)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Employer Share:</span>
                                        <span className="font-semibold text-gray-800">{fmt(c.employer)}</span>
                                    </div>
                                    <div className="border-t pt-2 flex justify-between text-sm font-bold">
                                        <span>Total Remittance:</span>
                                        <span className={`text-${c.color}-700`}>{fmt(c.total)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-xl border border-gray-200 p-5">
                        <h3 className="text-base font-bold text-gray-800 mb-1">BIR Withholding Tax</h3>
                        <p className="text-xs text-gray-500 mb-4">TRAIN Law (RR 8-2018) · Annualized method · 2023 onwards rates</p>
                        <div className="flex justify-between text-sm font-bold">
                            <span>Total Withheld this Period:</span>
                            <span className="text-red-700">{fmt(totalTax)}</span>
                        </div>
                    </div>
                </div>
            )}

            {breakdownRecord && (
                <PayrollBreakdownModal
                    record={breakdownRecord}
                    employeeName={(() => { const e = empMap.get(breakdownRecord.employeeId); return e ? `${e.firstName} ${e.lastName}` : ''; })()}
                    periodName={period.periodName}
                    payFrequency={period.payFrequency}
                    onClose={() => setBreakdownRecord(null)}
                />
            )}
            {editRecord && (
                <EditRecordModal
                    record={editRecord}
                    employeeName={(() => { const e = empMap.get(editRecord.employeeId); return e ? `${e.firstName} ${e.lastName}` : ''; })()}
                    period={period}
                    onClose={() => setEditRecord(null)}
                    onSave={updated => {
                        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
                        setEditRecord(null);
                    }}
                />
            )}
            {showAdjModal && (
                <AddAdjustmentModal
                    periodId={period.id}
                    employees={employees}
                    onClose={() => setShowAdjModal(false)}
                    onSave={async () => {
                        setShowAdjModal(false);
                        await loadData();
                    }}
                />
            )}
        </div>
    );
};

// ─── Main Payroll Module ─────────────────────────────────────────────────────

const PayrollModule: React.FC = () => {
    const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<PayrollStatus | 'All'>('All');

    const loadAll = useCallback(async () => {
        setLoading(true);
        const [perds, emps] = await Promise.all([getPayrollPeriods(), getEmployees()]);
        setPeriods(perds);
        setEmployees(emps);
        setLoading(false);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    const handleStatusChange = async (period: PayrollPeriod, status: PayrollStatus) => {
        await updatePayrollPeriodStatus(period.id, status);
        setPeriods(prev => prev.map(p => p.id === period.id ? { ...p, status } : p));
        if (selectedPeriod?.id === period.id) setSelectedPeriod(p => p ? { ...p, status } : p);
    };

    const handleDelete = async (periodId: string) => {
        if (!confirm('Delete this payroll period and all its records?')) return;
        setDeletingId(periodId);
        await deletePayrollPeriod(periodId);
        setPeriods(prev => prev.filter(p => p.id !== periodId));
        setDeletingId(null);
    };

    const filtered = filterStatus === 'All' ? periods : periods.filter(p => p.status === filterStatus);

    if (selectedPeriod) {
        return (
            <PeriodDetail
                period={selectedPeriod}
                employees={employees}
                onBack={() => { setSelectedPeriod(null); loadAll(); }}
                onStatusChange={s => handleStatusChange(selectedPeriod, s)}
            />
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Payroll</h2>
                    <p className="text-sm text-gray-500 mt-0.5">PH-compliant · SSS · PhilHealth · Pag-IBIG · BIR TRAIN Law</p>
                </div>
                <button onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                    + New Period
                </button>
            </div>

            {/* Compliance badges */}
            <div className="flex flex-wrap gap-2 mb-6">
                {[
                    { label: 'SSS 2024', desc: '4.5% EE · 9.5% ER' },
                    { label: 'PhilHealth 2024', desc: '5% total premium' },
                    { label: 'Pag-IBIG HDMF', desc: '2% EE · 2% ER' },
                    { label: 'BIR TRAIN Law', desc: 'Annualized w/tax' },
                    { label: 'R.A. 8291 (GSIS)', desc: 'Private sector SSS' },
                    { label: '13th Month Pay', desc: 'P.D. 851 accrual' },
                ].map(b => (
                    <div key={b.label} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-semibold text-gray-700">{b.label}</span>
                        <span className="text-xs text-gray-400 ml-1">· {b.desc}</span>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div className="flex gap-2 mb-4">
                {(['All', 'Draft', 'Finalized', 'Paid'] as const).map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {s}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">Loading payroll periods…</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <div className="text-5xl mb-4">💳</div>
                    <p className="text-gray-500 text-lg font-medium">No payroll periods yet</p>
                    <p className="text-gray-400 text-sm mt-1">Create a payroll period to get started</p>
                    <button onClick={() => setShowCreateModal(true)}
                        className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        Create First Period
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(period => (
                        <div key={period.id}
                            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                            onClick={() => setSelectedPeriod(period)}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 font-bold text-lg">₱</div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{period.periodName}</p>
                                        <p className="text-sm text-gray-500">{period.periodStart} – {period.periodEnd}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-gray-400">Pay Date</p>
                                        <p className="text-sm font-medium text-gray-700">{period.payDate}</p>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-gray-400">Frequency</p>
                                        <p className="text-sm font-medium text-gray-700 capitalize">{period.payFrequency}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor[period.status]}`}>
                                        {period.status}
                                    </span>
                                    <button onClick={e => { e.stopPropagation(); handleDelete(period.id); }}
                                        disabled={deletingId === period.id || period.status !== 'Draft'}
                                        className="text-gray-300 hover:text-red-500 disabled:opacity-30 text-lg leading-none transition-colors ml-1"
                                        title="Delete period">
                                        ×
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <CreatePeriodModal
                    onClose={() => setShowCreateModal(false)}
                    onSave={period => {
                        setPeriods(prev => [period, ...prev]);
                        setShowCreateModal(false);
                        setSelectedPeriod(period);
                    }}
                />
            )}
        </div>
    );
};

export default PayrollModule;
