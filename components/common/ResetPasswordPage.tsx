import React, { useState, useEffect } from 'react';
import * as api from '../../services/supabaseApi';

interface ResetPasswordPageProps {
    token: string;
    onSuccess: () => void;
}

const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ token, onSuccess }) => {
    const [isValidating, setIsValidating] = useState(true);
    const [isValid, setIsValid] = useState(false);
    const [email, setEmail] = useState('');
    const [companyCode, setCompanyCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const validateToken = async () => {
            const result = await api.validateResetToken(token);
            setIsValidating(false);
            if (result.valid) {
                setIsValid(true);
                setEmail(result.email || '');
                setCompanyCode(result.companyCode || '');
            } else {
                setIsValid(false);
                setError('This password reset link is invalid or has expired.');
            }
        };

        validateToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsSubmitting(true);
        const result = await api.resetPasswordWithToken(token, newPassword);
        setIsSubmitting(false);

        if (result.success) {
            setSuccess(true);
            setTimeout(() => {
                onSuccess();
            }, 3000);
        } else {
            setError(result.message);
        }
    };

    if (isValidating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-slate-600">Validating reset link...</p>
                </div>
            </div>
        );
    }

    if (!isValid) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
                    <div className="text-red-600 text-5xl mb-4">✕</div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Invalid Reset Link</h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <button
                        onClick={onSuccess}
                        className="btn btn-primary"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
                    <div className="text-green-600 text-5xl mb-4">✓</div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Password Reset Successful</h2>
                    <p className="text-slate-600 mb-6">Your password has been reset successfully. Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Reset Your Password</h2>
                <p className="text-sm text-slate-600 mb-6">
                    Company: <span className="font-medium">{companyCode}</span> | Email: <span className="font-medium">{email}</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
                            New Password
                        </label>
                        <input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                            className="mt-1 input-field"
                            placeholder="Enter new password (min 8 characters)"
                        />
                    </div>

                    <div>
                        <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
                            Confirm Password
                        </label>
                        <input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                            minLength={8}
                            className="mt-1 input-field"
                            placeholder="Confirm new password"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary w-full"
                    >
                        {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
