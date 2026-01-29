
import React, { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { UserContext } from '../../App';
import * as api from '../../services/supabaseApi';
import { Employee, Task, TaskStatus, LeaveBalance, AuditLog, SalaryHistoryRecord, WorkSchedule, EmploymentType, CustomFieldDefinition, CustomFieldType, Shift } from '../../types';
import LeaveAdjustmentModal from './LeaveAdjustmentModal';

type DetailTab = 'profile' | 'salary' | 'tasks' | 'leave' | 'audit';

// --- Helper Components for ProfileTab ---
const ProfileField: React.FC<{label: string, value?: string | number | boolean}> = ({label, value}) => (
    <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-sm text-slate-800">{String(value) || 'N/A'}</p>
    </div>
);

const EditField: React.FC<{label: string, name: keyof Employee, value?: any, type?: string, children?: React.ReactNode}> = ({label, name, value, type="text", children}) => (
     <div>
        <label className="block text-xs font-medium text-slate-700">{label}</label>
        {type === 'select' ? (
            <select name={name} value={value || ''} onChange={() => {}} className="mt-1 input-field text-sm">
                {children}
            </select>
        ) : (
            <input name={name} value={value || ''} onChange={() => {}} type={type} className="mt-1 input-field text-sm" />
        )}
    </div>
);

// --- Profile Tab ---
const ProfileTab: React.FC<{ employee: Employee; onUpdate: () => void }> = ({ employee, onUpdate }) => {
    const { user: editor } = useContext(UserContext);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(employee);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);

    useEffect(() => {
        setFormData(employee);
    }, [employee]);

    useEffect(() => {
        const loadCustomFields = async () => {
            const fields = await api.getCustomFieldDefinitions();
            setCustomFieldDefs(fields);
        };
        const loadShifts = async () => {
            const shiftsData = await api.getShifts();
            setShifts(shiftsData);
        };
        loadCustomFields();
        loadShifts();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCustomFieldChange = (fieldId: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            customFields: {
                ...prev.customFields,
                [fieldId]: value
            }
        }));
    };

    const handleSave = () => {
        if (!editor) return;
        const dataToSave = {
            ...formData,
            workSchedule: formData.workSchedule || undefined
        };
        api.updateEmployee(dataToSave, editor.id);
        onUpdate();
        setIsEditing(false);
    };

    const handleResetPassword = () => {
        if (window.confirm(`Are you sure you want to reset the password for ${employee.firstName} ${employee.lastName}? An email will be sent to them with a new temporary password.`)) {
            if (!editor) return;
            const result = api.resetEmployeePassword(employee.id, editor.id);
            if (result.success) {
                alert('Password has been reset successfully.');
            } else {
                alert(`Error: ${result.message}`);
            }
        }
    }
    
    // Re-define EditField for this component's scope with a working onChange
    const ScopedEditField: React.FC<{label: string, name: keyof Employee, value?: any, type?: string, children?: React.ReactNode}> = ({label, name, value, type="text", children}) => (
        <div>
           <label className="block text-xs font-medium text-slate-700">{label}</label>
           {type === 'select' ? (
               <select name={name} value={value || ''} onChange={handleChange} className="mt-1 input-field text-sm">
                   {children}
               </select>
           ) : (
               <input name={name} value={value || ''} onChange={handleChange} type={type} className="mt-1 input-field text-sm" />
           )}
       </div>
   );

    const CustomEditField: React.FC<{def: CustomFieldDefinition}> = ({def}) => {
        const value = formData.customFields?.[def.id] || '';
        return (
             <div>
                <label className="block text-xs font-medium text-slate-700">{def.name}</label>
                {def.type === CustomFieldType.DROPDOWN ? (
                    <select value={String(value)} onChange={(e) => handleCustomFieldChange(def.id, e.target.value)} className="mt-1 input-field text-sm">
                        <option value="">Select...</option>
                        {def.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                ) : (
                    <input 
                        type={def.type.toLowerCase()} 
                        value={String(value)}
                        onChange={(e) => handleCustomFieldChange(def.id, e.target.value)}
                        className="mt-1 input-field text-sm"
                    />
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold text-slate-700">Personal & Employment Details</h3>
                 {isEditing ? (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className="btn btn-secondary text-sm">Cancel</button>
                        <button onClick={handleSave} className="btn btn-primary text-sm">Save</button>
                    </div>
                 ) : (
                    <button onClick={() => setIsEditing(true)} className="btn btn-secondary text-sm">Edit</button>
                 )}
            </div>
            {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                    {/* Personal Information */}
                    <h4 className="md:col-span-3 text-md font-semibold text-slate-600 border-b pb-1">Personal Information</h4>
                    <ScopedEditField label="First Name" name="firstName" value={formData.firstName} />
                    <ScopedEditField label="Middle Name" name="middleName" value={formData.middleName} />
                    <ScopedEditField label="Last Name" name="lastName" value={formData.lastName} />
                    <ScopedEditField label="Birthdate" name="birthdate" value={formData.birthdate} type="date"/>
                    <ScopedEditField label="Mobile Number" name="mobileNumber" value={formData.mobileNumber} />
                    <div className="md:col-span-3">
                        <ScopedEditField label="Address" name="address" value={formData.address} />
                    </div>

                    {/* Employment Information */}
                    <h4 className="md:col-span-3 text-md font-semibold text-slate-600 border-b pb-1 mt-4">Employment Information</h4>
                    <ScopedEditField label="Date Hired" name="dateHired" value={formData.dateHired} type="date" />
                    <ScopedEditField label="Employment Type" name="employmentType" value={formData.employmentType} type="select">
                        {Object.values(EmploymentType).map(et => ( <option key={et} value={et}>{et}</option> ))}
                    </ScopedEditField>
                    <ScopedEditField label="Department" name="department" value={formData.department} />
                    <ScopedEditField label="Work Schedule" name="workSchedule" value={formData.workSchedule} type="select">
                        <option value="">Use Company Default</option>
                        {Object.values(WorkSchedule).map(ws => ( <option key={ws} value={ws}>{ws}</option> ))}
                    </ScopedEditField>
                    <ScopedEditField label="Work Shift" name="shiftId" value={formData.shiftId} type="select">
                        <option value="">No shift assigned</option>
                        {shifts.map(shift => (
                            <option key={shift.id} value={shift.id}>
                                {shift.name} ({shift.startTime} - {shift.endTime})
                            </option>
                        ))}
                    </ScopedEditField>

                    {/* Government IDs */}
                    <h4 className="md:col-span-3 text-md font-semibold text-slate-600 border-b pb-1 mt-4">Government IDs</h4>
                    <ScopedEditField label="TIN #" name="tinNumber" value={formData.tinNumber} />
                    <ScopedEditField label="SSS #" name="sssNumber" value={formData.sssNumber} />
                    <ScopedEditField label="Pag-ibig #" name="pagibigNumber" value={formData.pagibigNumber} />
                    <ScopedEditField label="PhilHealth #" name="philhealthNumber" value={formData.philhealthNumber} />

                    {/* Custom Fields */}
                    {customFieldDefs.length > 0 && <h4 className="md:col-span-3 text-md font-semibold text-slate-600 border-b pb-1 mt-4">Additional Information</h4>}
                    {customFieldDefs.map(def => <CustomEditField key={def.id} def={def} />)}
                </div>
            ) : (
                 <div className="space-y-6">
                    {/* Personal Information */}
                    <div>
                        <h4 className="text-md font-semibold text-slate-600 border-b pb-1 mb-3">Personal Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6">
                            <ProfileField label="Full Name" value={`${employee.firstName} ${employee.middleName || ''} ${employee.lastName}`} />
                            <ProfileField label="Email" value={employee.email} />
                            <ProfileField label="Mobile Number" value={employee.mobileNumber} />
                            <ProfileField label="Birthdate" value={employee.birthdate} />
                            <div className="md:col-span-3">
                                <ProfileField label="Address" value={employee.address} />
                            </div>
                        </div>
                    </div>
                    
                    {/* Employment Information */}
                    <div>
                        <h4 className="text-md font-semibold text-slate-600 border-b pb-1 mb-3">Employment Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6">
                            <ProfileField label="Employee ID" value={employee.employeeId} />
                            <ProfileField label="Date Hired" value={employee.dateHired} />
                            <ProfileField label="Employment Type" value={employee.employmentType} />
                            <ProfileField label="Department" value={employee.department} />
                            <ProfileField label="Work Schedule" value={employee.workSchedule || 'Company Default'} />
                            <ProfileField
                                label="Work Shift"
                                value={
                                    employee.shiftId
                                        ? shifts.find(s => s.id === employee.shiftId)?.name || 'Unknown'
                                        : 'Not assigned'
                                }
                            />
                        </div>
                    </div>

                    {/* Government IDs */}
                    <div>
                        <h4 className="text-md font-semibold text-slate-600 border-b pb-1 mb-3">Government IDs</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6">
                            <ProfileField label="TIN #" value={employee.tinNumber} />
                            <ProfileField label="SSS #" value={employee.sssNumber} />
                            <ProfileField label="Pag-ibig #" value={employee.pagibigNumber} />
                            <ProfileField label="PhilHealth #" value={employee.philhealthNumber} />
                        </div>
                    </div>
                    
                    {/* Custom Fields */}
                    {customFieldDefs.length > 0 && (
                        <div>
                            <h4 className="text-md font-semibold text-slate-600 border-b pb-1 mb-3">Additional Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6">
                                {customFieldDefs.map(def => (
                                    <ProfileField key={def.id} label={def.name} value={employee.customFields?.[def.id]} />
                                ))}
                            </div>
                        </div>
                    )}
                     {/* Security Actions */}
                    <div className="pt-4">
                        <h4 className="text-md font-semibold text-slate-600 border-b pb-1 mb-3">Security Actions</h4>
                        <button onClick={handleResetPassword} className="btn btn-secondary text-sm border-red-300 text-red-700 hover:bg-red-50">
                            Reset Employee Password
                        </button>
                        <p className="text-xs text-slate-500 mt-1">This will generate a new temporary password ('password123') and email it to the employee.</p>
                    </div>
                </div>
            )}
        </div>
    )
};

// --- Salary Tab ---
const SalaryTab: React.FC<{ employee: Employee; onUpdate: () => void }> = ({ employee, onUpdate }) => {
    const { user: editor } = useContext(UserContext);
    const [isAdding, setIsAdding] = useState(false);
    const initialNewRecordState = {
        id: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        basicSalary: employee.salaryHistory[employee.salaryHistory.length - 1]?.basicSalary || 0,
        allowance: employee.salaryHistory[employee.salaryHistory.length - 1]?.allowance || 0,
        otherBenefits: employee.salaryHistory[employee.salaryHistory.length - 1]?.otherBenefits || 0,
    };
    const [newRecord, setNewRecord] = useState<Omit<SalaryHistoryRecord, 'id'>>(initialNewRecordState);

    const handleAddRecord = () => {
        if (!editor) return;

        const updatedEmployee: Employee = {
            ...employee,
            salaryHistory: [
                ...employee.salaryHistory,
                { ...newRecord, id: `sal${Date.now()}` }
            ]
        };
        api.updateEmployee(updatedEmployee, editor.id);
        onUpdate();
        setIsAdding(false);
        setNewRecord(initialNewRecordState);
    };

    const sortedHistory = [...employee.salaryHistory].sort((a,b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold text-slate-700">Salary History</h3>
                 {!isAdding && <button onClick={() => setIsAdding(true)} className="btn btn-primary text-sm">+ Add Record</button>}
            </div>
            
            {isAdding && (
                <div className="p-4 bg-slate-50 border rounded-lg space-y-3 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs font-medium text-slate-700 block">Effective Date</label>
                            <input type="date" value={newRecord.effectiveDate} onChange={e => setNewRecord({...newRecord, effectiveDate: e.target.value})} className="input-field text-sm mt-1"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-700 block">Basic Salary</label>
                            <input type="number" value={newRecord.basicSalary} onChange={e => setNewRecord({...newRecord, basicSalary: Number(e.target.value)})} className="input-field text-sm mt-1"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-700 block">Allowance</label>
                            <input type="number" value={newRecord.allowance} onChange={e => setNewRecord({...newRecord, allowance: Number(e.target.value)})} className="input-field text-sm mt-1"/>
                        </div>
                         <div>
                            <label className="text-xs font-medium text-slate-700 block">Other Benefits</label>
                            <input type="number" value={newRecord.otherBenefits} onChange={e => setNewRecord({...newRecord, otherBenefits: Number(e.target.value)})} className="input-field text-sm mt-1"/>
                        </div>
                    </div>
                     <div className="flex justify-end gap-2">
                        <button onClick={() => setIsAdding(false)} className="btn btn-secondary text-sm">Cancel</button>
                        <button onClick={handleAddRecord} className="btn btn-primary text-sm">Save Record</button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Effective Date</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Basic Salary</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Allowance</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Other Benefits</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedHistory.map(record => {
                            const total = record.basicSalary + record.allowance + record.otherBenefits;
                            return (
                                <tr key={record.id}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.effectiveDate}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{record.basicSalary.toLocaleString()}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{record.allowance.toLocaleString()}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{record.otherBenefits.toLocaleString()}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">{total.toLocaleString()}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
};

// --- Tasks Tab ---
const TasksTab: React.FC<{ employee: Employee }> = ({ employee }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    
    const fetchTasks = useCallback(async () => {
        const tasksData = await api.getTasksForEmployee(employee.id);
        setTasks(tasksData);
    }, [employee.id]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

     const handleStatusChange = (task: Task, newStatus: TaskStatus) => {
        const updatedTask = { ...task, status: newStatus };
        if (newStatus === TaskStatus.COMPLETED && !task.dateCompleted) {
            updatedTask.dateCompleted = new Date().toISOString();
        }
        api.updateTask(updatedTask);
        fetchTasks();
    };

    const groupedTasks = useMemo(() => {
        return tasks.reduce((acc, task) => {
            acc[task.status] = acc[task.status] || [];
            acc[task.status].push(task);
            return acc;
        }, {} as Record<TaskStatus, Task[]>);
    }, [tasks]);

     const StatusColumn: React.FC<{ status: TaskStatus; title: string; tasks: Task[] }> = ({ status, title, tasks = [] }) => {
        const statusColors = {
            [TaskStatus.TODO]: "border-t-slate-400",
            [TaskStatus.IN_PROGRESS]: "border-t-blue-500",
            [TaskStatus.COMPLETED]: "border-t-green-500",
        };
        return (
            <div className="flex-1 p-3 bg-slate-50 rounded-lg">
                <h3 className={`font-semibold text-slate-800 text-center pb-2 mb-3 border-b-2 ${statusColors[status]}`}>{title} ({tasks.length})</h3>
                <div className="space-y-3 h-[300px] overflow-y-auto">
                    {tasks.map(task => (
                        <div key={task.id} className="p-3 bg-white rounded-md shadow-sm border">
                            <p className="font-semibold text-slate-900">{task.title}</p>
                            <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                            <p className="text-xs text-slate-400 mt-2">Due: {task.dueDate}</p>
                            <select
                                value={task.status}
                                onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                                className="mt-2 w-full text-xs p-1 border rounded-md bg-slate-50"
                            >
                                {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col md:flex-row gap-4">
            <StatusColumn status={TaskStatus.TODO} title="To Do" tasks={groupedTasks[TaskStatus.TODO]} />
            <StatusColumn status={TaskStatus.IN_PROGRESS} title="In Progress" tasks={groupedTasks[TaskStatus.IN_PROGRESS]} />
            <StatusColumn status={TaskStatus.COMPLETED} title="Completed" tasks={groupedTasks[TaskStatus.COMPLETED]} />
        </div>
    );
};

// --- Leave Balance Tab ---
const LeaveBalanceTab: React.FC<{ employee: Employee, onUpdate: () => void }> = ({ employee, onUpdate }) => {
    const { user: editor } = useContext(UserContext);
    const [balance, setBalance] = useState<LeaveBalance | null>(null);
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);

    const calculate = useCallback(async () => {
        const balanceData = await api.calculateLeaveBalance(employee.id);
        setBalance(balanceData);
    }, [employee.id]);

    useEffect(() => {
        calculate();
    }, [calculate, employee]); // Recalculate if employee data changes
    
    const handleSaveAdjustment = (adjustments: { vacation: number; sick: number }, reason: string) => {
        if (!editor) {
            alert("Error: Current user not identified.");
            return;
        }
        api.adjustLeaveBalance(employee.id, adjustments, reason, editor.id);
        setIsAdjustmentModalOpen(false);
        onUpdate(); // This will trigger a re-fetch in the parent, which re-renders this component with fresh data
    };
    
    if(!balance) return <p>Calculating leave balance...</p>;

    return (
        <>
            {isAdjustmentModalOpen && (
                <LeaveAdjustmentModal 
                    employee={employee}
                    onClose={() => setIsAdjustmentModalOpen(false)}
                    onSave={handleSaveAdjustment}
                />
            )}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-700">Leave Balances</h3>
                <button 
                    onClick={() => setIsAdjustmentModalOpen(true)}
                    className="btn btn-secondary text-sm"
                >
                    Adjust Balances
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-4 rounded-lg border">
                    <h4 className="font-bold text-lg text-indigo-700 mb-2">Vacation Leave</h4>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Accrued:</span><span className="font-medium">{balance.vacation.accrued.toFixed(2)} days</span></div>
                        <div className="flex justify-between"><span>Used:</span><span className="font-medium">{balance.vacation.used.toFixed(2)} days</span></div>
                        <div className="flex justify-between"><span>Manual Adjustments:</span><span className={`font-medium ${(employee.vacationLeaveAdjustment || 0) !== 0 ? ((employee.vacationLeaveAdjustment || 0) > 0 ? 'text-green-600' : 'text-red-600') : ''}`}>{employee.vacationLeaveAdjustment || 0} days</span></div>
                        <div className="flex justify-between pt-2 border-t mt-2">
                            <span className="font-bold">Available:</span>
                            <span className="font-bold text-xl">{balance.vacation.available.toFixed(2)} days</span>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border">
                    <h4 className="font-bold text-lg text-teal-700 mb-2">Sick Leave</h4>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Accrued:</span><span className="font-medium">{balance.sick.accrued.toFixed(2)} days</span></div>
                        <div className="flex justify-between"><span>Used:</span><span className="font-medium">{balance.sick.used.toFixed(2)} days</span></div>
                         <div className="flex justify-between"><span>Manual Adjustments:</span><span className={`font-medium ${(employee.sickLeaveAdjustment || 0) !== 0 ? ((employee.sickLeaveAdjustment || 0) > 0 ? 'text-green-600' : 'text-red-600') : ''}`}>{employee.sickLeaveAdjustment || 0} days</span></div>
                        <div className="flex justify-between pt-2 border-t mt-2">
                            <span className="font-bold">Available:</span>
                            <span className="font-bold text-xl">{balance.sick.available.toFixed(2)} days</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};


// --- Audit Log Tab ---
const AuditLogTab: React.FC<{ employeeId: string }> = ({ employeeId }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    useEffect(() => {
        const loadData = async () => {
            const [logsData, employeesData] = await Promise.all([
                api.getAuditLogsForEmployee(employeeId),
                api.getEmployees()
            ]);
            setLogs(logsData);
            setEmployees(employeesData);
        };
        loadData();
    }, [employeeId]);
    
    const getEditorName = (editorId: string) => {
        const editor = employees.find(e => e.id === editorId);
        return editor ? `${editor.firstName} ${editor.lastName}` : 'System';
    };

    return (
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {logs.length > 0 ? logs.map(log => (
                <div key={log.id} className="p-3 border rounded-md bg-white">
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
                        <span>Edited by: <span className="font-semibold">{getEditorName(log.editorId)}</span></span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <ul className="space-y-1">
                        {log.changes.map((change, index) => (
                            <li key={index} className="text-sm">
                                <span className="font-semibold text-slate-700 capitalize">{change.field.replace(/([A-Z])/g, ' $1')}:</span>
                                <span className="ml-2 text-red-600 line-through">{change.oldValue}</span>
                                <span className="mx-1">→</span>
                                <span className="text-green-600">{change.newValue}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )) : (
                <p className="text-slate-500 text-center py-4">No changes recorded for this employee.</p>
            )}
        </div>
    )
}

// --- Main Modal Component ---
interface EmployeeDetailsModalProps {
  employeeId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const EmployeeDetailsModal: React.FC<EmployeeDetailsModalProps> = ({ employeeId, onClose, onUpdate }) => {
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [activeTab, setActiveTab] = useState<DetailTab>('profile');

    const fetchEmployee = useCallback(async () => {
        const data = await api.getEmployeeById(employeeId);
        if (data) setEmployee(data);
    }, [employeeId]);

    useEffect(() => {
        fetchEmployee();
    }, [fetchEmployee]);
    
    const TabButton: React.FC<{tabId: DetailTab; children: React.ReactNode}> = ({ tabId, children }) => {
        return (
            <button onClick={() => setActiveTab(tabId)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-md transition-colors ${activeTab === tabId ? 'bg-white text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {children}
            </button>
        );
    }
    
    if (!employee) return null;

    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-slate-50 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-lg">
                    <div className="flex items-center gap-4">
                        <img src={employee.profilePicture || `https://ui-avatars.com/api/?name=${employee.firstName}+${employee.lastName}&background=random`} alt="Profile" className="w-12 h-12 rounded-full object-cover"/>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{employee.firstName} {employee.lastName}</h2>
                            <p className="text-sm text-slate-500">{employee.department} <span className="font-mono text-slate-400">({employee.employeeId})</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                {/* Tabs */}
                <div className="px-6 border-b bg-slate-100">
                    <nav className="flex gap-2 -mb-px">
                        <TabButton tabId="profile">Profile</TabButton>
                        <TabButton tabId="salary">Salary</TabButton>
                        <TabButton tabId="tasks">Tasks</TabButton>
                        <TabButton tabId="leave">Leave Balances</TabButton>
                        <TabButton tabId="audit">Audit Log</TabButton>
                    </nav>
                </div>
                {/* Content */}
                <div className="p-6 overflow-y-auto bg-white rounded-b-lg flex-grow">
                    {activeTab === 'profile' && <ProfileTab employee={employee} onUpdate={fetchEmployee} />}
                    {activeTab === 'salary' && <SalaryTab employee={employee} onUpdate={fetchEmployee} />}
                    {activeTab === 'tasks' && <TasksTab employee={employee} />}
                    {activeTab === 'leave' && <LeaveBalanceTab employee={employee} onUpdate={fetchEmployee} />}
                    {activeTab === 'audit' && <AuditLogTab employeeId={employee.id} />}
                </div>
            </div>
        </div>
    );
};

export default EmployeeDetailsModal;