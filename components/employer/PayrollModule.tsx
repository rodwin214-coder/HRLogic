import React, { useState, useEffect, useCallback } from 'react';
import {
    PayrollPeriod, PayrollRecord, PayrollAdjustment, PayFrequency,
    PayrollStatus, AdjustmentType, Employee,
} from '../../types';
import {
    getPayrollPeriods, createPayrollPeriod, updatePayrollPeriodStatus, deletePayrollPeriod,
    getPayrollRecords, upsertPayrollRecord, generatePayrollForPeriod,
    getPayrollAdjustments, addPayrollAdjustment, computeEmployeePayroll,
    getEmployees,
} from '../../services/supabaseApi';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    '₱' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const statusColor: Record<PayrollStatus, string> = {
    Draft: 'bg-amber-100 text-amber-800',
    Finalized: 'bg-blue-100 text-blue-800',
    Paid: 'bg-green-100 text-green-800',
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
        const period = await createPayrollPeriod(form);
        setSaving(false);
        if (!period) { setError('Failed to create period.'); return; }
        onSave(period);
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

const EditRecordModal: React.FC<EditRecordModalProps> = ({ record, employeeName, onClose, onSave, period }) => {
    const [form, setForm] = useState({ ...record });
    const [computing, setComputing] = useState(false);
    const [saving, setSaving] = useState(false);

    const setN = (k: keyof PayrollRecord, v: string) =>
        setForm(prev => ({ ...prev, [k]: parseFloat(v) || 0 }));

    const recompute = async () => {
        setComputing(true);
        const computed = await computeEmployeePayroll({
            employeeId: form.employeeId,
            companyId: form.companyId,
            periodId: form.periodId,
            basicSalary: form.basicSalary,
            daysWorked: form.daysWorked,
            overtimeHours: form.overtimeHours,
            regularHolidayHours: form.regularHolidayHours,
            specialHolidayHours: form.specialHolidayHours,
            nightDiffHours: form.nightDiffHours,
            restDayHours: form.restDayHours,
            allowance: form.allowance,
            deMinimis: form.deMinimis,
            payFrequency: period.payFrequency,
        });
        setForm(prev => ({ ...prev, ...computed, id: prev.id }));
        setComputing(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const saved = await upsertPayrollRecord(form);
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
                    {/* Special Pay */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800 mb-3">Special Hours</h3>
                        <div className="grid grid-cols-3 gap-3">
                            {field('OT Hours', 'overtimeHours')}
                            {field('Regular Holiday Hrs', 'regularHolidayHours')}
                            {field('Special Holiday Hrs', 'specialHolidayHours')}
                            {field('Night Diff Hours', 'nightDiffHours')}
                            {field('Rest Day Hours', 'restDayHours')}
                            {field('Allowance', 'allowance')}
                        </div>
                    </div>
                    {/* Computed */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">Computed Amounts</h3>
                            <button onClick={recompute} disabled={computing}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">
                                {computing ? 'Computing…' : '↻ Recompute'}
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            {field('Basic Pay', 'basicPay', true)}
                            {field('OT Pay', 'overtimePay', true)}
                            {field('Holiday Pay', 'regularHolidayPay', true)}
                            {field('Gross Pay', 'grossPay', true)}
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
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null);
    const [showAdjModal, setShowAdjModal] = useState(false);
    const [tab, setTab] = useState<'records' | 'adjustments' | 'summary'>('records');
    const [search, setSearch] = useState('');

    const empMap = new Map(employees.map(e => [e.id, e]));

    const loadData = useCallback(async () => {
        setLoading(true);
        const [recs, adjs] = await Promise.all([
            getPayrollRecords(period.id),
            getPayrollAdjustments(period.id),
        ]);
        setRecords(recs);
        setAdjustments(adjs);
        setLoading(false);
    }, [period.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleGenerate = async () => {
        setGenerating(true);
        const result = await generatePayrollForPeriod(period, employees);
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
                                        {['Employee', 'Days', 'Basic Pay', 'OT Pay', 'Allowance', 'Gross', 'SSS', 'PhilHealth', 'Pag-IBIG', 'W/Tax', 'Net Pay', ''].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredRecords.map(r => {
                                        const emp = empMap.get(r.employeeId);
                                        return (
                                            <tr key={r.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">
                                                    {emp ? `${emp.lastName}, ${emp.firstName}` : r.employeeId}
                                                    <div className="text-xs text-gray-400">{emp?.department}</div>
                                                </td>
                                                <td className="px-3 py-3 text-gray-600">{r.daysWorked}</td>
                                                <td className="px-3 py-3 text-gray-700">{fmt(r.basicPay)}</td>
                                                <td className="px-3 py-3 text-gray-700">{fmt(r.overtimePay)}</td>
                                                <td className="px-3 py-3 text-gray-700">{fmt(r.allowance)}</td>
                                                <td className="px-3 py-3 font-medium text-gray-900">{fmt(r.grossPay)}</td>
                                                <td className="px-3 py-3 text-red-600">{fmt(r.sssContribution)}</td>
                                                <td className="px-3 py-3 text-red-600">{fmt(r.philhealthContribution)}</td>
                                                <td className="px-3 py-3 text-red-600">{fmt(r.pagibigContribution)}</td>
                                                <td className="px-3 py-3 text-red-600">{fmt(r.withholdingTax)}</td>
                                                <td className="px-3 py-3 font-bold text-green-700">{fmt(r.netPay)}</td>
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
                                        <td className="px-3 py-3">{fmt(records.reduce((s, r) => s + r.overtimePay, 0))}</td>
                                        <td className="px-3 py-3">{fmt(records.reduce((s, r) => s + r.allowance, 0))}</td>
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
