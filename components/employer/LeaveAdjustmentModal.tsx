import React, { useState } from 'react';
import Modal from '../common/Modal';
import { Employee } from '../../types';

interface LeaveAdjustmentModalProps {
    employee: Employee;
    onClose: () => void;
    onSave: (adjustments: { vacation: number; sick: number }, reason: string) => void;
}

const LeaveAdjustmentModal: React.FC<LeaveAdjustmentModalProps> = ({ employee, onClose, onSave }) => {
    const [vacationAdjustment, setVacationAdjustment] = useState<number | string>('');
    const [sickAdjustment, setSickAdjustment] = useState<number | string>('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        setError('');
        
        const vacAdj = Number(vacationAdjustment || 0);
        const sickAdj = Number(sickAdjustment || 0);

        if (isNaN(vacAdj) || isNaN(sickAdj)) {
            setError('Adjustments must be valid numbers.');
            return;
        }

        if (vacAdj === 0 && sickAdj === 0) {
            setError('At least one non-zero adjustment value must be provided.');
            return;
        }

        if (!reason.trim()) {
            setError('A reason for the adjustment is required.');
            return;
        }

        onSave({ vacation: vacAdj, sick: sickAdj }, reason);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Adjust Leave for ${employee.firstName} ${employee.lastName}`}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Enter positive numbers to add days or negative numbers to subtract days. This will be recorded in the audit log.
                </p>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700">Vacation Leave Adjustment</label>
                    <input
                        type="number"
                        step="0.5"
                        value={vacationAdjustment}
                        onChange={e => setVacationAdjustment(e.target.value)}
                        className="mt-1 input-field"
                        placeholder="e.g., 2 or -1.5"
                    />
                     <p className="text-xs text-slate-500 mt-1">Current total adjustment: {employee.vacationLeaveAdjustment || 0} days</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700">Sick Leave Adjustment</label>
                    <input
                        type="number"
                        step="0.5"
                        value={sickAdjustment}
                        onChange={e => setSickAdjustment(e.target.value)}
                        className="mt-1 input-field"
                        placeholder="e.g., 1 or -0.5"
                    />
                    <p className="text-xs text-slate-500 mt-1">Current total adjustment: {employee.sickLeaveAdjustment || 0} days</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700">Reason for Adjustment</label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={3}
                        className={`mt-1 input-field ${!reason.trim() && error ? 'invalid' : ''}`}
                        placeholder="e.g., Annual carry-over, special bonus, correction..."
                    />
                </div>
                
                {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md">{error}</p>}
                
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="button" onClick={handleSubmit} className="btn btn-primary">Save Adjustment</button>
                </div>
            </div>
        </Modal>
    );
};

export default LeaveAdjustmentModal;
