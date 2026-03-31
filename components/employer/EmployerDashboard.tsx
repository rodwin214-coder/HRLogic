

import React, { useState, useContext, useEffect, useCallback } from 'react';
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

type Tab = 'notifications' | 'employees' | 'reports' | 'company' | 'shifts' | 'leavePolicy' | 'calendar' | 'customFields';

const EmployerDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('notifications');
    const [companyProfile, setCompanyProfile] = useState<CompanyProfileType | null>(null);
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
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
    }, [fetchData, activeTab]); // Re-fetch on tab change to keep count fresh
    
    const TabButton: React.FC<{tabId: Tab; children: React.ReactNode}> = ({ tabId, children }) => {
        const isActive = activeTab === tabId;
        return (
            <button
              onClick={() => setActiveTab(tabId)}
              className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                isActive
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
              }`}
            >
              {children}
            </button>
        );
    }

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
                    <button
                        onClick={logout}
                        className="btn btn-secondary"
                    >
                        Log Out
                    </button>
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
                    <TabButton tabId="company">Company Profile</TabButton>
                    <TabButton tabId="shifts">Shifts</TabButton>
                    <TabButton tabId="leavePolicy">Leave Policy</TabButton>
                    <TabButton tabId="customFields">Custom Fields</TabButton>
                    <TabButton tabId="calendar">Holidays</TabButton>
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
            </main>
        </div>
    );
};

export default EmployerDashboard;