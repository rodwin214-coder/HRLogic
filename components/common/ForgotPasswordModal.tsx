
import React, { useState } from 'react';
import Modal from './Modal';
import * as api from '../../services/supabaseApi';

interface ForgotPasswordModalProps {
    onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ onClose }) => {
    const [companyCode, setCompanyCode] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!companyCode.trim()) {
            setError('Please enter your company code.');
            return;
        }

        if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }

        setIsSubmitting(true);
        const result = await api.requestPasswordReminder(companyCode, email);
        setIsSubmitting(false);

        if (result.success) {
            setMessage(result.message);
        } else {
            setError(result.message);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Forgot Password">
            {message ? (
                <div className="text-center">
                    <p className="text-lg font-medium text-green-700">{message}</p>
                    <p className="text-slate-600 mt-2">Please check your inbox (and spam folder) for further instructions.</p>
                    <button onClick={onClose} className="btn btn-primary mt-6">
                        Close
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-slate-600">
                        Enter your company code and email address below, and we'll send you instructions to reset your password.
                    </p>
                    <div>
                        <label htmlFor="reset-company-code" className="block text-sm font-medium text-slate-700">Company Code</label>
                        <input
                            id="reset-company-code"
                            type="text"
                            value={companyCode}
                            onChange={e => setCompanyCode(e.target.value)}
                            required
                            className="mt-1 input-field"
                            placeholder="Enter your company code"
                        />
                    </div>
                    <div>
                        <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700">Email Address</label>
                        <input
                            id="reset-email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="mt-1 input-field"
                            placeholder="you@example.com"
                        />
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                     <div className="flex justify-end gap-2 pt-4 border-t">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                            {isSubmitting ? 'Sending...' : 'Send Reset Instructions'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default ForgotPasswordModal;
