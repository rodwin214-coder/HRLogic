
import React, { useState } from 'react';
import Modal from './Modal';
import * as api from '../../services/supabaseApi';

interface ForgotPasswordModalProps {
    onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ onClose }) => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }

        setIsSubmitting(true);
        const result = await api.requestPasswordReminder(email);
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
                    <p className="text-slate-600 mt-2">Please check your inbox (and spam folder).</p>
                    <button onClick={onClose} className="btn btn-primary mt-6">
                        Close
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-slate-600">
                        Enter your email address below, and we'll send you an email with your password.
                    </p>
                    <div>
                        <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700">Email Address</label>
                        <input
                            id="reset-email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className={`mt-1 input-field ${error ? 'invalid' : ''}`}
                            placeholder="you@example.com"
                        />
                        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
                    </div>
                     <div className="flex justify-end gap-2 pt-4 border-t">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                            {isSubmitting ? 'Sending...' : 'Send Reminder'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default ForgotPasswordModal;
