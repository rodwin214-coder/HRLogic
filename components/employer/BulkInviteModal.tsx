import React, { useState } from 'react';
import Modal from '../common/Modal';
import * as api from '../../services/supabaseApi';
import { EmploymentType } from '../../types';

interface BulkInviteModalProps {
    onClose: () => void;
    onInvite: () => void;
}

const BulkInviteModal: React.FC<BulkInviteModalProps> = ({ onClose, onInvite }) => {
    const [emails, setEmails] = useState('');
    const [employmentType, setEmploymentType] = useState<EmploymentType>(EmploymentType.PROBATIONARY);
    const [isInviting, setIsInviting] = useState(false);
    const [inviteResult, setInviteResult] = useState<{ successCount: number; errorCount: number; errors: string[] } | null>(null);

    const handleInvite = () => {
        if (!emails.trim()) return;
        setIsInviting(true);
        setInviteResult(null);

        const result = api.bulkInviteEmployees(emails, employmentType);
        
        setInviteResult(result);
        setIsInviting(false);
        if (result.successCount > 0) {
            onInvite(); // Refresh parent list
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Bulk Invite Employees">
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Enter comma-separated email addresses. Each employee will be sent an invitation to complete their profile. Their default password will be <strong>qwerty123</strong>.
                </p>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Email Addresses</label>
                    <textarea
                        value={emails}
                        onChange={(e) => setEmails(e.target.value)}
                        rows={5}
                        className="mt-1 input-field"
                        placeholder="employee1@example.com, employee2@example.com"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Initial Employment Type</label>
                    <select
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                        className="mt-1 input-field"
                    >
                        {Object.values(EmploymentType).map(et => (
                            <option key={et} value={et}>{et}</option>
                        ))}
                    </select>
                </div>
                
                {isInviting && <p className="text-sm text-slate-600 animate-pulse">Sending invites...</p>}
                
                {inviteResult && (
                    <div className="text-sm border-t pt-4 mt-4">
                        <h4 className="font-semibold text-slate-800">Invitation Result</h4>
                        <p className={`font-medium ${inviteResult.successCount > 0 ? 'text-green-600' : 'text-slate-600'}`}>
                            Successfully sent {inviteResult.successCount} invitations.
                        </p>
                        {inviteResult.errorCount > 0 && (
                            <>
                                <p className="font-medium text-red-600 mt-2">Failed invitations: {inviteResult.errorCount}</p>
                                <ul className="list-disc list-inside text-xs text-red-500 max-h-32 overflow-y-auto bg-red-50 p-2 rounded-md mt-1">
                                    {inviteResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </>
                        )}
                    </div>
                )}
                
                <div className="text-xs text-slate-500 bg-slate-100 p-2 rounded-md">
                    <strong>Note:</strong> Email invitations are sent via EmailJS. To enable this, you must add your free API keys to <code>services/mockApi.ts</code> and <code>index.html</code>.
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>
                    <button type="button" onClick={handleInvite} disabled={!emails.trim() || isInviting} className="btn btn-primary">
                        {isInviting ? 'Sending...' : 'Send Invites'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default BulkInviteModal;