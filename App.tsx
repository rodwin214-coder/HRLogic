

import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { UserRole, Employee } from './types';
import * as api from './services/supabaseApi';
import { WORKLOGIX_LOGO_BASE64 } from './services/supabaseApi';
import ForgotPasswordModal from './components/common/ForgotPasswordModal';

const EmployeeDashboard = lazy(() => import('./components/employee/EmployeeDashboard'));
const EmployerDashboard = lazy(() => import('./components/employer/EmployerDashboard'));

interface UserContextType {
    user: Employee | null;
    role: UserRole | null;
    companyCode: string;
    logout: () => void;
    refreshUser: () => void;
}

export const UserContext = React.createContext<UserContextType>({
    user: null,
    role: null,
    companyCode: '',
    logout: () => {},
    refreshUser: () => {}
});

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<{ user: Employee | null; role: UserRole | null; companyCode: string }>({
        user: null,
        role: null,
        companyCode: ''
    });
    const [isRegistering, setIsRegistering] = useState(false);
    const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [companyCode, setCompanyCode] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [apiError, setApiError] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Check for a logged-in user in localStorage on initial load
    useEffect(() => {
        const loggedInUserId = localStorage.getItem('loggedInUserId');
        const loggedInCompanyCode = localStorage.getItem('loggedInCompanyCode');
        const loggedInEmail = localStorage.getItem('loggedInEmail');

        if (loggedInUserId && loggedInCompanyCode && loggedInEmail) {
            // Auto-login with stored credentials
            const initSession = async () => {
                try {
                    // Initialize company context
                    await api.initializeCompanyContext(loggedInCompanyCode);
                    await api.setCurrentUserEmail(loggedInEmail);

                    const userProfile = await api.getEmployeeById(loggedInUserId);

                    if (userProfile) {
                        const account = await api.getUserAccountByEmployeeId(loggedInUserId);
                        if (account) {
                            setCurrentUser({ user: userProfile, role: account.role, companyCode: loggedInCompanyCode });
                            setCompanyCode(loggedInCompanyCode);
                        }
                    }
                } catch (err) {
                    console.error('Auto-login error:', err);
                }
                setIsLoading(false);
            };
            initSession();
        } else {
            setIsLoading(false);
        }
    }, []);

    const validate = useCallback(() => {
        const newErrors: { [key: string]: string } = {};
        if (!companyCode.trim()) {
            newErrors.companyCode = isRegistering ? 'Company Code is required (will be created).' : 'Company Code is required.';
        } else if (!/^[a-z0-9_-]+$/.test(companyCode)) {
            newErrors.companyCode = 'Company Code can only contain lowercase letters, numbers, hyphens, and underscores.';
        }
        if (isRegistering) {
            if (!companyName.trim()) newErrors.companyName = 'Company Name is required.';
            if (!firstName.trim()) newErrors.firstName = 'First Name is required.';
            if (!lastName.trim()) newErrors.lastName = 'Last Name is required.';
        }
        if (!email.trim()) newErrors.email = 'Email Address is required.';
        else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Email address is invalid.';
        if (!password) newErrors.password = 'Password is required.';
        else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [companyCode, companyName, firstName, lastName, email, password, isRegistering]);

    useEffect(() => {
        if (!currentUser.user) { // Only validate when login form is visible
             validate();
        }
    }, [companyCode, companyName, firstName, lastName, email, password, isRegistering, validate, currentUser]);

    const handleLogin = useCallback(async () => {
        setApiError('');
        if (!validate()) return;

        try {
            const result = await api.loginUser(companyCode, email, password);
            if ('error' in result) {
                setApiError(result.error);
            } else {
                setCurrentUser({ user: result.user, role: result.role, companyCode });
                if (rememberMe) {
                    localStorage.setItem('loggedInUserId', result.user.id);
                    localStorage.setItem('loggedInCompanyCode', companyCode);
                    localStorage.setItem('loggedInEmail', email);
                }
            }
        } catch (err: any) {
            setApiError(err.message || 'Login failed. Please try again.');
        }
    }, [companyCode, email, password, rememberMe, validate]);

    const handleRegister = useCallback(async () => {
        setApiError('');
        if (!validate()) return;

        try {
            const result = await api.registerEmployer(companyCode, companyName, firstName, lastName, email, password);
            if ('error' in result) {
                setApiError(result.error);
            } else {
                // Auto-login after registration
                setCurrentUser({ user: result.user, role: result.role, companyCode });
                if (rememberMe) {
                    localStorage.setItem('loggedInUserId', result.user.id);
                    localStorage.setItem('loggedInCompanyCode', companyCode);
                    localStorage.setItem('loggedInEmail', email);
                }
            }
        } catch (err: any) {
            setApiError(err.message || 'Registration failed. Please try again.');
        }
    }, [companyCode, companyName, firstName, lastName, email, password, rememberMe, validate]);

    const handleLogout = useCallback(() => {
        setCurrentUser({ user: null, role: null, companyCode: '' });
        localStorage.removeItem('loggedInUserId');
        localStorage.removeItem('loggedInCompanyCode');
        localStorage.removeItem('loggedInEmail');
        // Clear form fields on logout
        setCompanyCode('');
        setCompanyName('');
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setApiError('');
        setErrors({});
        setIsRegistering(false);
    }, []);

    const refreshUser = useCallback(async () => {
        if (currentUser.user) {
            try {
                const refreshedUser = await api.getEmployeeById(currentUser.user.id);
                if (refreshedUser) {
                    setCurrentUser(prev => ({ ...prev, user: refreshedUser }));
                } else {
                    handleLogout(); // User was deleted or not found
                }
            } catch (err) {
                handleLogout();
            }
        }
    }, [currentUser.user, handleLogout]);

    const userContextValue = useMemo(() => ({
        ...currentUser,
        logout: handleLogout,
        refreshUser
    }), [currentUser, handleLogout, refreshUser]);

    const isFormValid = Object.keys(errors).length === 0;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--color-primary))]"></div>
                    <p className="mt-4 text-slate-600">Loading application...</p>
                </div>
            </div>
        );
    }

    if (!currentUser.user) {
        return (
            <>
                {isForgotPasswordOpen && <ForgotPasswordModal onClose={() => setIsForgotPasswordOpen(false)} />}
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <div className="bg-white p-8 rounded-xl shadow-lg mb-4">
                            <div className="flex flex-col items-center justify-center mb-6">
                                <img src={WORKLOGIX_LOGO_BASE64} alt="WorkLogix Logo" className="h-24 w-auto mb-2" />
                            </div>

                            <p className="text-slate-500 mb-6 text-center">{isRegistering ? 'Create a new company account' : 'Sign in to your account'}</p>

                            <form onSubmit={(e) => { e.preventDefault(); isRegistering ? handleRegister() : handleLogin(); }} className="space-y-4">
                                <div>
                                    <label htmlFor="companyCode" className="block text-sm font-medium text-slate-700">
                                        Company Code {isRegistering && <span className="text-xs text-slate-500">(choose a unique code)</span>}
                                    </label>
                                    <input
                                        id="companyCode"
                                        type="text"
                                        value={companyCode}
                                        onChange={(e) => setCompanyCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                                        required
                                        placeholder={isRegistering ? "e.g., acme-corp" : "Enter your company code"}
                                        className={`mt-1 input-field ${errors.companyCode ? 'invalid' : ''}`}
                                    />
                                    {errors.companyCode && <p className="text-xs text-red-600 mt-1">{errors.companyCode}</p>}
                                </div>
                                {isRegistering && (
                                    <>
                                        <div>
                                            <label htmlFor="companyName" className="block text-sm font-medium text-slate-700">Company Name</label>
                                            <input
                                                id="companyName"
                                                type="text"
                                                value={companyName}
                                                onChange={(e) => setCompanyName(e.target.value)}
                                                required
                                                placeholder="Your Company Name"
                                                className={`mt-1 input-field ${errors.companyName ? 'invalid' : ''}`}
                                            />
                                            {errors.companyName && <p className="text-xs text-red-600 mt-1">{errors.companyName}</p>}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">First Name</label>
                                                <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={`mt-1 input-field ${errors.firstName ? 'invalid' : ''}`}/>
                                                {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
                                            </div>
                                            <div>
                                                <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">Last Name</label>
                                                <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={`mt-1 input-field ${errors.lastName ? 'invalid' : ''}`}/>
                                                {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
                                            </div>
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email Address</label>
                                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={`mt-1 input-field ${errors.email ? 'invalid' : ''}`}/>
                                    {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                                </div>
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label htmlFor="password"className="block text-sm font-medium text-slate-700">Password</label>
                                         <button type="button" onClick={() => setIsForgotPasswordOpen(true)} className="text-xs font-medium text-[rgb(var(--color-primary))] hover:opacity-80">
                                            Forgot Password?
                                        </button>
                                    </div>
                                    <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={`mt-1 input-field ${errors.password ? 'invalid' : ''}`}/>
                                    {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
                                </div>

                                {!isRegistering && (
                                    <div className="flex items-center">
                                        <input
                                            id="rememberMe"
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-[rgb(var(--color-primary))] focus:ring-[rgb(var(--color-primary))]"
                                        />
                                        <label htmlFor="rememberMe" className="ml-2 block text-sm text-slate-700">
                                            Remember me
                                        </label>
                                    </div>
                                )}

                                {apiError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">{apiError}</p>}

                                <button type="submit" disabled={!isFormValid} className="w-full btn btn-primary mt-2">
                                    {isRegistering ? 'Create Company Account' : 'Login'}
                                </button>
                            </form>

                            <div className="mt-6 text-sm text-slate-500 text-center">
                                <p>
                                    {isRegistering ? 'Already have an account?' : "Don't have a company account?"}
                                    <button onClick={() => { setIsRegistering(!isRegistering); setApiError(''); setErrors({}) }} className="font-semibold text-[rgb(var(--color-primary))] hover:opacity-80 ml-1">
                                        {isRegistering ? 'Log In' : 'Create Company'}
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <UserContext.Provider value={userContextValue}>
            <div className="min-h-screen">
                <Suspense fallback={
                    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--color-primary))]"></div>
                            <p className="mt-4 text-slate-600">Loading dashboard...</p>
                        </div>
                    </div>
                }>
                    {currentUser.role === UserRole.EMPLOYEE && <EmployeeDashboard />}
                    {currentUser.role === UserRole.EMPLOYER && <EmployerDashboard />}
                </Suspense>
            </div>
        </UserContext.Provider>
    );
}

export default App;
