import React, { useState, useEffect, useContext, useCallback } from 'react';
import Modal from '../common/Modal';
import { Employee, AttendanceRecord } from '../../types';
import * as api from '../../services/mockApi';
import { UserContext } from '../../App';

interface ManualAttendanceModalProps {
    onClose: () => void;
    onSuccess: () => void;
    recordToEdit?: AttendanceRecord;
}

// Helper to format date for datetime-local input
const toDateTimeLocal = (isoString?: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // Adjust for timezone offset
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - timezoneOffset);
    return localDate.toISOString().slice(0, 16);
};

const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({ onClose, onSuccess, recordToEdit }) => {
    const { user: editor } = useContext(UserContext);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [employeeId, setEmployeeId] = useState(recordToEdit?.employeeId || '');
    const [clockIn, setClockIn] = useState(toDateTimeLocal(recordToEdit?.clockInTime));
    const [clockOut, setClockOut] = useState(toDateTimeLocal(recordToEdit?.clockOutTime));
    const [reason, setReason] = useState(recordToEdit?.manualEntryReason || '');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        setEmployees(api.getEmployees());
    }, []);

    const validate = useCallback(() => {
        const newErrors: { [key: string]: string } = {};
        if (!employeeId) newErrors.employeeId = 'Please select an employee.';
        if (!clockIn) newErrors.clockIn = 'Clock-in time is required.';
        if (clockOut && new Date(clockOut) < new Date(clockIn)) {
            newErrors.clockOut = 'Clock-out time cannot be before clock-in time.';
        }
        if (!reason.trim()) newErrors.reason = 'A reason is required for this action.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [employeeId, clockIn, clockOut, reason]);
    
    useEffect(() => {
        validate();
    }, [validate]);

    const handleSubmit = () => {
        if (!validate() || !editor) return;

        if (recordToEdit) {
            // Editing existing record
            const updatedRecord: AttendanceRecord = {
                ...recordToEdit,
                clockInTime: new Date(clockIn).toISOString(),
                clockOutTime: clockOut ? new Date(clockOut).toISOString() : undefined,
                manualEntryReason: reason,
            };
            api.updateAttendance(updatedRecord, reason, editor.id);
        } else {
            // Adding new record
            const newRecordData = {
                employeeId,
                clockInTime: new Date(clockIn).toISOString(),
                clockOutTime: clockOut ? new Date(clockOut).toISOString() : undefined,
                manualEntryReason: reason,
            };
            api.addManualAttendance(newRecordData, editor.id);
        }
        onSuccess();
    };
    
    const isFormValid = Object.keys(errors).length === 0;

    return (
        <Modal isOpen={true} onClose={onClose} title={recordToEdit ? "Edit Attendance Record" : "Add Manual Entry"}>
            <form onSubmit={e => {e.preventDefault(); handleSubmit()}} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Employee</label>
                    <select
                        value={employeeId}
                        onChange={e => setEmployeeId(e.target.value)}
                        disabled={!!recordToEdit}
                        className={`mt-1 input-field ${errors.employeeId ? 'invalid' : ''} ${recordToEdit ? 'bg-slate-100' : ''}`}
                    >
                        <option value="">Select an employee</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                                {emp.firstName} {emp.lastName} ({emp.employeeId})
                            </option>
                        ))}
                    </select>
                     {errors.employeeId && <p className="text-xs text-red-600 mt-1">{errors.employeeId}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                         <label className="block text-sm font-medium text-slate-700">Clock In Time</label>
                         <input type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)} className={`mt-1 input-field ${errors.clockIn ? 'invalid' : ''}`}/>
                         {errors.clockIn && <p className="text-xs text-red-600 mt-1">{errors.clockIn}</p>}
                    </div>
                     <div>
                         <label className="block text-sm font-medium text-slate-700">Clock Out Time (Optional)</label>
                         <input type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)} className={`mt-1 input-field ${errors.clockOut ? 'invalid' : ''}`}/>
                         {errors.clockOut && <p className="text-xs text-red-600 mt-1">{errors.clockOut}</p>}
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Reason for Manual Entry/Edit</label>
                    <textarea 
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={3}
                        className={`mt-1 input-field ${errors.reason ? 'invalid' : ''}`}
                        placeholder="e.g., Employee forgot to clock in, Correcting a mistaken entry..."
                    />
                    {errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason}</p>}
                </div>
                 <div className="flex justify-end gap-2 pt-4 border-t">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" disabled={!isFormValid} className="btn btn-primary">
                        {recordToEdit ? 'Save Changes' : 'Add Entry'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ManualAttendanceModal;
