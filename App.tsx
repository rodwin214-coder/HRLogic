

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { UserRole, Employee } from './types';
import * as api from './services/mockApi';
import EmployeeDashboard from './components/employee/EmployeeDashboard';
import EmployerDashboard from './components/employer/EmployerDashboard';
import ForgotPasswordModal from './components/common/ForgotPasswordModal';
import { WORKLOGIX_LOGO_BASE64 } from './services/mockApi';

interface UserContextType {
    user: Employee | null;
    role: UserRole | null;
    logout: () => void;
    refreshUser: () => void;
}

export const UserContext = React.createContext<UserContextType>({ user: null, role: null, logout: () => {}, refreshUser: () => {} });

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<{ user: Employee | null; role: UserRole | null }>({ user: null, role: null });
    const [isRegistering, setIsRegistering] = useState(false);
    const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [apiError, setApiError] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        // On first run, create default accounts if none exist.
        const accounts = api.getUserAccounts();
        if (accounts.length === 0) {
            // Create default employer
            api.registerEmployer('Admin', 'User', 'admin@work.com', 'password123');
            // Create default employee for testing
            api.inviteEmployee({
                firstName: 'John',
                lastName: 'Doe',
                email: 'employee@work.com',
                department: 'Engineering',
            });
        }
    }, []); // Runs once on mount

    // Check for a logged-in user in localStorage on initial load
    useEffect(() => {
        const loggedInUserId = localStorage.getItem('loggedInUserId');
        if (loggedInUserId) {
            const accounts = api.getUserAccounts();
            const userAccount = accounts.find(acc => acc.employeeId === loggedInUserId);
            if (userAccount) {
                const userProfile = api.getEmployeeById(userAccount.employeeId);
                if (userProfile) {
                    setCurrentUser({ user: userProfile, role: userAccount.role });
                }
            }
        }
        setIsLoading(false);
    }, []);


    const validate = useCallback(() => {
        const newErrors: { [key: string]: string } = {};
        if (isRegistering) {
            if (!firstName.trim()) newErrors.firstName = 'First Name is required.';
            if (!lastName.trim()) newErrors.lastName = 'Last Name is required.';
        }
        if (!email.trim()) newErrors.email = 'Email Address is required.';
        else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Email address is invalid.';
        if (!password) newErrors.password = 'Password is required.';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [firstName, lastName, email, password, isRegistering]);

    useEffect(() => {
        if (!currentUser.user) { // Only validate when login form is visible
             validate();
        }
    }, [firstName, lastName, email, password, isRegistering, validate, currentUser]);

    const handleLogin = useCallback(async () => {
        setApiError('');
        if (!validate()) return;
        
        const result = api.loginUser(email, password);
        if ('error' in result) {
            setApiError(result.error);
        } else {
            setCurrentUser({ user: result.user, role: result.role });
            localStorage.setItem('loggedInUserId', result.user.id);
        }
    }, [email, password, validate]);

    const handleRegister = useCallback(async () => {
        setApiError('');
        if (!validate()) return;

        const result = api.registerEmployer(firstName, lastName, email, password);
        if ('error' in result) {
            setApiError(result.error);
        } else {
            // Auto-login after registration
            setCurrentUser({ user: result.user, role: result.role });
            localStorage.setItem('loggedInUserId', result.user.id);
        }
    }, [firstName, lastName, email, password, validate]);
    
    const handleLogout = useCallback(() => {
        setCurrentUser({ user: null, role: null });
        localStorage.removeItem('loggedInUserId');
        // Clear form fields on logout
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setApiError('');
        setErrors({});
        setIsRegistering(false);
    }, []);

    const refreshUser = useCallback(() => {
        if (currentUser.user) {
            const refreshedUser = api.getEmployeeById(currentUser.user.id);
            if (refreshedUser) {
                setCurrentUser(prev => ({ ...prev, user: refreshedUser }));
            } else {
                handleLogout(); // User was deleted or not found
            }
        }
    }, [currentUser.user, handleLogout]);

    const userContextValue = useMemo(() => ({ ...currentUser, logout: handleLogout, refreshUser }), [currentUser, handleLogout, refreshUser]);
    
    const isFormValid = Object.keys(errors).length === 0;

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
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
                            
                            <p className="text-slate-500 mb-6 text-center">{isRegistering ? 'Create a new Employer account' : 'Sign in to your account'}</p>
                            
                            <form onSubmit={(e) => { e.preventDefault(); isRegistering ? handleRegister() : handleLogin(); }} className="space-y-4">
                                {isRegistering && (
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
                                
                                {apiError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">{apiError}</p>}

                                <button type="submit" disabled={!isFormValid} className="w-full btn btn-primary mt-2">
                                    {isRegistering ? 'Create Employer Account' : 'Login'}
                                </button>
                            </form>

                            <div className="mt-6 text-sm text-slate-500 text-center">
                                <p>
                                    {isRegistering ? 'Already have an account?' : "Don't have an account?"}
                                    <button onClick={() => { setIsRegistering(!isRegistering); setApiError(''); setErrors({}) }} className="font-semibold text-[rgb(var(--color-primary))] hover:opacity-80 ml-1">
                                        {isRegistering ? 'Log In' : 'Sign Up'}
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
                {currentUser.role === UserRole.EMPLOYEE && <EmployeeDashboard />}
                {currentUser.role === UserRole.EMPLOYER && <EmployerDashboard />}
            </div>
        </UserContext.Provider>
    );
}

export default App;