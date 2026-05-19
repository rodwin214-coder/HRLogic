

import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import RequestManagement from './RequestManagement';
import EmployeeManagement from './EmployeeManagement';
import { Reports } from './Reports';
import HolidayCalendar from './HolidayCalendar';
import ShiftManagement from './ShiftManagement';
import CompanyProfile from './CompanyProfile';
import LeaveSetup from './LeaveSetup';
import { UserContext } from '../../App';
import * as api from '../../services/supabaseApi';
import { CompanyProfile as CompanyProfileType, RequestStatus } from '../../types';
import CustomFieldsSetup from './CustomFieldsSetup';
import NotificationBell from '../common/NotificationBell';
import PayrollModule from './PayrollModule';

type Tab = 'notifications' | 'employees' | 'reports' | 'company' | 'shifts' | 'leavePolicy' | 'calendar' | 'customFields' | 'payroll';

const SETTINGS_TABS: Tab[] = ['shifts', 'leavePolicy', 'customFields', 'company'];
const SETTINGS_LABELS: Record<string, string> = {
    shifts: 'Shifts',
    leavePolicy: 'Leave Policy',
    customFields: 'Custom Fields',
    company: 'Company Profile',
};

const EmployerDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('notifications');
    const [companyProfile, setCompanyProfile] = useState<CompanyProfileType | null>(null);
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    const { user, logout } = useContext(UserContext);

    const fetchData = useCallback(async () => {
        const [profile, requests] = await Promise.all([
            api.getCompanyProfile(),
            api.getRequests()
        ]);
        setCompanyProfile(profile);
        const pendingCount = requests.filter(r => r.status === RequestStatus.PENDING).length;
        setPendingRequestCount(pendingCount);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData, activeTab]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
                setSettingsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const isSettingsActive = SETTINGS_TABS.includes(activeTab);

    const TabButton: React.FC<{ tabId: Tab; children: React.ReactNode }> = ({ tabId, children }) => {
        const isActive = activeTab === tabId;
        return (
            <button
                onClick={() => setActiveTab(tabId)}
                className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    isActive
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                }`}
            >
                {children}
            </button>
        );
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <header className="mb-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-4">
                    {companyProfile && (
                        <img
                            src={companyProfile.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(companyProfile.name)}&background=0D8ABC&color=fff&size=64`}
                            alt={`${companyProfile.name} logo`}
                            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                        />
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Employer Dashboard</h1>
                        <p className="text-slate-500">Welcome back, {user?.firstName}!</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {user && <NotificationBell userId={user.id} />}
                    <button onClick={logout} className="btn btn-secondary">Log Out</button>
                </div>
            </header>

            <div className="mb-6">
                <nav className="flex flex-wrap gap-2 p-2 bg-slate-100 rounded-lg">
                    <TabButton tabId="notifications">
                        <div className="flex items-center gap-2">
                            <span>Notifications</span>
                            {pendingRequestCount > 0 && (
                                <span className="flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                                    {pendingRequestCount}
                                </span>
                            )}
                        </div>
                    </TabButton>
                    <TabButton tabId="employees">Employees</TabButton>
                    <TabButton tabId="reports">Reports</TabButton>
                    <TabButton tabId="calendar">Holidays</TabButton>
                    <TabButton tabId="payroll">Payroll</TabButton>

                    {/* Settings dropdown */}
                    <div className="relative" ref={settingsRef}>
                        <button
                            onClick={() => setSettingsOpen(o => !o)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                isSettingsActive
                                    ? 'bg-white text-blue-700 shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Settings
                            {isSettingsActive && (
                                <span className="text-xs text-blue-500">· {SETTINGS_LABELS[activeTab]}</span>
                            )}
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform duration-150 ${settingsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {settingsOpen && (
                            <div className="absolute left-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                                {SETTINGS_TABS.map(tabId => (
                                    <button
                                        key={tabId}
                                        onClick={() => { setActiveTab(tabId); setSettingsOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                            activeTab === tabId
                                                ? 'bg-blue-50 text-blue-700 font-semibold'
                                                : 'text-gray-700 hover:bg-gray-50 font-medium'
                                        }`}
                                    >
                                        {SETTINGS_LABELS[tabId]}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </nav>
            </div>

            <main>
                <div className={activeTab === 'notifications' ? '' : 'hidden'}><RequestManagement /></div>
                <div className={activeTab === 'employees' ? '' : 'hidden'}><EmployeeManagement /></div>
                <div className={activeTab === 'reports' ? '' : 'hidden'}><Reports /></div>
                <div className={activeTab === 'company' ? '' : 'hidden'}><CompanyProfile /></div>
                <div className={activeTab === 'shifts' ? '' : 'hidden'}><ShiftManagement /></div>
                <div className={activeTab === 'leavePolicy' ? '' : 'hidden'}><LeaveSetup /></div>
                <div className={activeTab === 'customFields' ? '' : 'hidden'}><CustomFieldsSetup /></div>
                <div className={activeTab === 'calendar' ? '' : 'hidden'}><HolidayCalendar canAddHoliday={true} /></div>
                <div className={activeTab === 'payroll' ? '' : 'hidden'}><PayrollModule /></div>
            </main>
        </div>
    );
};

export default EmployerDashboard;
