import React, { useState, useContext, useCallback, useEffect } from 'react';
import Modal from '../common/Modal';
import { UserContext } from '../../App';
import * as api from '../../services/mockApi';

interface ChangePasswordModalProps {
    onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
    const { user } = useContext(UserContext);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [apiMessage, setApiMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const validate = useCallback(() => {
        const newErrors: { [key: string]: string } = {};
        if (!currentPassword) newErrors.currentPassword = 'Current password is required.';
        if (!newPassword) {
            newErrors.newPassword = 'New password is required.';
        } else if (newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters long.';
        }
        if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [currentPassword, newPassword, confirmPassword]);

    useEffect(() => {
        validate();
    }, [currentPassword, newPassword, confirmPassword, validate]);
    
    const isFormValid = Object.keys(errors).length === 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setApiMessage(null);
        if (!user || !validate()) return;
        
        const result = api.changePassword(user.id, currentPassword, newPassword);

        if (result.success) {
            setApiMessage({ type: 'success', text: result.message });
            setTimeout(() => {
                onClose();
            }, 2000); // Close modal after 2 seconds on success
        } else {
            setApiMessage({ type: 'error', text: result.message });
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Change Password">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Current Password</label>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className={`mt-1 input-field ${errors.currentPassword ? 'invalid' : ''}`}
                        required
                    />
                    {errors.currentPassword && <p className="text-xs text-red-600 mt-1">{errors.currentPassword}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">New Password</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className={`mt-1 input-field ${errors.newPassword ? 'invalid' : ''}`}
                        required
                    />
                    {errors.newPassword && <p className="text-xs text-red-600 mt-1">{errors.newPassword}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Confirm New Password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={`mt-1 input-field ${errors.confirmPassword ? 'invalid' : ''}`}
                        required
                    />
                    {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>}
                </div>
                
                {apiMessage && (
                    <p className={`text-sm p-3 rounded-md border ${apiMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {apiMessage.text}
                    </p>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" disabled={!isFormValid} className="btn btn-primary">Update Password</button>
                </div>
            </form>
        </Modal>
    );
};

export default ChangePasswordModal;
