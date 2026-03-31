
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { Employee } from '../../types';

interface TerminateEmployeeModalProps {
    employee: Employee;
    onClose: () => void;
    onConfirm: (terminationDate: string, terminationReason: string) => void;
}

const TerminateEmployeeModal: React.FC<TerminateEmployeeModalProps> = ({
    employee,
    onClose,
    onConfirm
}) => {
    const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
    const [terminationReason, setTerminationReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!terminationReason.trim()) {
            alert('Please provide a termination reason');
            return;
        }

        setIsSubmitting(true);
        await onConfirm(terminationDate, terminationReason);
        setIsSubmitting(false);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Terminate Employee">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-yellow-800">
                        You are about to terminate <strong>{employee.firstName} {employee.lastName}</strong>.
                        This will prevent them from accessing the system and exclude them from attendance tracking
                        after the termination date.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Termination Date <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        value={terminationDate}
                        onChange={(e) => setTerminationDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="input-field"
                        required
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Employee will be excluded from attendance tracking after this date
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Reason for Termination <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={terminationReason}
                        onChange={(e) => setTerminationReason(e.target.value)}
                        className="input-field min-h-[100px]"
                        placeholder="Please provide the reason for termination..."
                        required
                    />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-secondary"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary bg-orange-600 hover:bg-orange-700"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Processing...' : 'Terminate Employee'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default TerminateEmployeeModal;
