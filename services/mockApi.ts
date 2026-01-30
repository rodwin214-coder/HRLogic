

import { Employee, Shift, Holiday, AppRequest, AttendanceRecord, EmployeeStatus, RequestStatus, RequestType, CompanyProfile, UserAccount, UserRole, AuditLog, AuditLogChange, LeaveBalance, LeaveType, LeavePolicy, EmploymentType, Task, WorkSchedule, CustomFieldDefinition, LeaveRequest, OtUtRequest } from '../types';

// --- EmailJS Configuration ---
// IMPORTANT: Replace these placeholder values with your actual EmailJS credentials.
// You can get these for free at https://www.emailjs.com/
const EMAILJS_SERVICE_ID = 'service_1qyjbpo';
const EMAILJS_TEMPLATE_ID = 'template_s8hvdcv'; // For employee invitations
const EMAILJS_PAYSLIP_TEMPLATE_ID = 'template_s8hvdcv'; // For payroll notifications
const EMAILJS_PASSWORD_RESET_TEMPLATE_ID = 'template_mh8a68e'; // For password resets by employer
const EMAILJS_FORGOT_PASSWORD_TEMPLATE_ID = 'template_mh8a68e'; // For "Forgot Password" reminders, as requested.
// The Public Key should be set in the init() call in index.html

// --- Branding ---
export const WORKLOGIX_LOGO_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiByeD0iNDgiIGZpbGw9IiMwRjJDNTIiLz4KPHBhdGggZD0iTTcyIDE2OEwxMDIgMTAySDEzMEwxMDAgMTY4SDcyWiIgZmlsbD0idXJsKCNwYWludDBfbGluZWFyXzFfMikiLz4KPHBhdGggZD0iTTExOSAxNjVMMTM5IDEwNUwxNjcgMTY1SDExOVoiIGZpbGw9InVybCgjcGFpbnQxX2xpbmVhcl8xXzIpIi8+CjxwYXRoIGQ9Ik0xNzMgMTM4QzE2MyAxMjEgMTQzIDEwMyAxMjggOTNDMTEwIDk5IDEwMCAxMTUgODggMTM4TDEyOCA5M0wxNzMgMTM4WiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4xIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMV8yIiB4MT0iMTAxIiB5MT0iMTAyIiB4Mj0iMTAxIiB5Mj0iMTY4IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiMyMTk2RjMiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMEQ0N0ExIi8+CjwvbGluZWFyR3JhZGllbnQ+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQxX2xpbmVhcl8xXzIiIHgxPSIxNDMiIHkxPSIxMDUiIHgyPSIxNDMiIHkyPSIxNjUiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzRDQUY1MCIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMxQjVFMjAiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K';

// --- EmailJS Configuration ---
// A helper function to send emails. It will silently fail if keys are not configured.
const sendInvitationEmail = (
    name: string,
    email: string,
    defaultPassword: string
) => {
    if (
        // FIX: Cast to string to avoid TypeScript literal type comparison error. This preserves the check for placeholder values.
        (EMAILJS_SERVICE_ID as string) === 'REPLACE_WITH_YOUR_EMAILJS_SERVICE_ID' ||
        (EMAILJS_TEMPLATE_ID as string) === 'REPLACE_WITH_YOUR_INVITATION_TEMPLATE_ID'
    ) {
        console.warn(
            'EmailJS is not configured for invitations. Skipping email invitation. Please set your credentials in services/mockApi.ts and index.html.'
        );
        return;
    }

    const templateParams = {
        to_name: name,
        to_email: email,
        default_password: defaultPassword,
        from_name: getCompanyProfile()?.name || 'WorkLogix',
    };

    // Use the globally available emailjs object from the script in index.html
    (window as any).emailjs
        .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
        .then(
            (response: any) => {
                console.log('SUCCESS! Invitation email sent.', response.status, response.text);
            },
            (error: any) => {
                console.error('FAILED to send invitation email.', error);
            }
        );
};

const sendPasswordResetEmail = (
    name: string,
    email: string,
    newPassword: string
) => {
    if (
        (EMAILJS_SERVICE_ID as string) === 'service_1qyjbpo' &&
        (EMAILJS_PASSWORD_RESET_TEMPLATE_ID as string) === 'REPLACE_WITH_YOUR_PASSWORD_RESET_TEMPLATE_ID'
    ) {
        console.warn(
            'EmailJS is not configured for password resets. Skipping email notification. Please set your credentials in services/mockApi.ts.'
        );
        return;
    }

    const templateParams = {
        to_name: name,
        to_email: email,
        new_password: newPassword,
        from_name: getCompanyProfile()?.name || 'WorkLogix',
    };

    (window as any).emailjs
        .send(EMAILJS_SERVICE_ID, EMAILJS_PASSWORD_RESET_TEMPLATE_ID, templateParams)
        .then(
            (response: any) => {
                console.log('SUCCESS! Password reset email sent.', response.status, response.text);
            },
            (error: any) => {
                console.error('FAILED to send password reset email.', error);
            }
        );
};

const sendForgotPasswordEmail = (
    name: string,
    email: string,
    currentPassword: string
) => {
    if (
        (EMAILJS_SERVICE_ID as string) === 'service_1qyjbpo' &&
        (EMAILJS_FORGOT_PASSWORD_TEMPLATE_ID as string) === 'REPLACE_WITH_YOUR_PASSWORD_RESET_TEMPLATE_ID'
    ) {
        console.warn(
            'EmailJS is not configured for password reminders. Skipping email notification. Please set your credentials in services/mockApi.ts.'
        );
        return Promise.reject('EmailJS not configured.');
    }

    const templateParams = {
        to_name: name,
        to_email: email,
        // The template uses 'new_password', so we send the current password under that key.
        new_password: currentPassword, 
        user_password: currentPassword, // Also send as user_password for more flexible templates
        from_name: getCompanyProfile()?.name || 'WorkLogix',
    };

    return (window as any).emailjs
        .send(EMAILJS_SERVICE_ID, EMAILJS_FORGOT_PASSWORD_TEMPLATE_ID, templateParams);
};


let migrationDone = false;

const initSeedData = () => {
    if (localStorage.getItem('seeded')) return;

    const shifts: Shift[] = [
        { id: 'shift1', name: 'Morning Shift', startTime: '09:00', endTime: '18:00' },
        { id: 'shift2', name: 'Night Shift', startTime: '22:00', endTime: '07:00' },
    ];
    localStorage.setItem('shifts', JSON.stringify(shifts));

    const employees: Employee[] = [];
    localStorage.setItem('employees', JSON.stringify(employees));

    const holidays: Holiday[] = [
        { id: 'hol1', name: 'New Year\'s Day', date: `${new Date().getFullYear()}-01-01`, country: 'PH', type: 'Regular' },
        { id: 'hol2', name: 'Labor Day', date: `${new Date().getFullYear()}-05-01`, country: 'PH', type: 'Regular' },
    ];
    localStorage.setItem('holidays', JSON.stringify(holidays));

    const requests: AppRequest[] = [];
    localStorage.setItem('requests', JSON.stringify(requests));

    const attendance: AttendanceRecord[] = [];
    localStorage.setItem('attendance', JSON.stringify(attendance));
    
    const companyProfile: CompanyProfile = {
        id: 'comp1',
        name: 'WorkLogix',
        address: '123 Business Avenue, Tech City',
        contactNumber: '(02) 8888-8888',
        email: 'contact@worklogix.com',
        tin: '000-123-456-789',
        logo: WORKLOGIX_LOGO_BASE64,
        workSchedule: WorkSchedule.MONDAY_TO_FRIDAY,
    };
    localStorage.setItem('companyProfile', JSON.stringify(companyProfile));

    const userAccounts: UserAccount[] = [];
    localStorage.setItem('userAccounts', JSON.stringify(userAccounts));

    const auditLogs: AuditLog[] = [];
    localStorage.setItem('auditLogs', JSON.stringify(auditLogs));

    const leavePolicy: LeavePolicy = {
        id: 'mainPolicy',
        baseVacationDaysPerYear: 15,
        baseSickDaysPerYear: 10,
        tenureBonusEnabled: true,
        tenureBonusYearsInterval: 2, // 1 day every 2 years
        maxTenureBonusDays: 5,
    };
    localStorage.setItem('leavePolicy', JSON.stringify(leavePolicy));

    const tasks: Task[] = [];
    localStorage.setItem('tasks', JSON.stringify(tasks));
    
    const customFieldDefinitions: CustomFieldDefinition[] = [];
    localStorage.setItem('customFieldDefinitions', JSON.stringify(customFieldDefinitions));

    localStorage.setItem('seeded', 'true');
};

const getFromStorage = <T,>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

const saveToStorage = <T,>(key: string, data: T[]): void => {
    localStorage.setItem(key, JSON.stringify(data));
};

// Initialize
initSeedData();

// --- API Functions ---

// Custom Fields
export const getCustomFieldDefinitions = (): CustomFieldDefinition[] => getFromStorage<CustomFieldDefinition>('customFieldDefinitions');
const saveCustomFieldDefinitions = (defs: CustomFieldDefinition[]): void => saveToStorage('customFieldDefinitions', defs);

export const addCustomFieldDefinition = (def: Omit<CustomFieldDefinition, 'id'>): CustomFieldDefinition => {
    const defs = getCustomFieldDefinitions();
    const newDef = { ...def, id: `cf_${Date.now()}` };
    saveCustomFieldDefinitions([...defs, newDef]);
    return newDef;
};
export const updateCustomFieldDefinition = (updatedDef: CustomFieldDefinition): CustomFieldDefinition => {
    const defs = getCustomFieldDefinitions();
    const index = defs.findIndex(d => d.id === updatedDef.id);
    if (index > -1) {
        defs[index] = updatedDef;
        saveCustomFieldDefinitions(defs);
    }
    return updatedDef;
};
export const deleteCustomFieldDefinition = (defId: string): void => {
    const defs = getCustomFieldDefinitions().filter(d => d.id !== defId);
    saveCustomFieldDefinitions(defs);
    // Note: This doesn't remove the data from existing employees, just the definition.
};


// Audit Logs
const getAuditLogs = (): AuditLog[] => getFromStorage<AuditLog>('auditLogs');
const saveAuditLogs = (logs: AuditLog[]): void => saveToStorage('auditLogs', logs);

export const getAuditLogsForEmployee = (employeeId: string): AuditLog[] => {
    return getAuditLogs().filter(log => log.employeeId === employeeId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};


// User Accounts
// FIX: Export getUserAccounts to be used in App.tsx for auto-login.
export const getUserAccounts = (): UserAccount[] => getFromStorage<UserAccount>('userAccounts');
const saveUserAccounts = (accounts: UserAccount[]): void => saveToStorage('userAccounts', accounts);

export const registerEmployer = (firstName: string, lastName: string, email: string, password: string): { user: Employee, role: UserRole } | { error: string } => {
    const accounts = getUserAccounts();
    if (accounts.some(acc => acc.email.toLowerCase() === email.toLowerCase())) {
        return { error: 'An account with this email already exists.' };
    }

    const role = UserRole.EMPLOYER;
    const dateHired = new Date().toISOString().split('T')[0];
    const companyProfile = getCompanyProfile();
    const employees = getEmployees();
    const existingIds = employees.map(e => parseInt(e.employeeId.replace('EMP-', ''), 10)).filter(n => !isNaN(n));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    
    const newEmployeeData: Omit<Employee, 'id'> = {
        employeeId: `EMP-${String(maxId + 1).padStart(3, '0')}`,
        email,
        firstName,
        lastName,
        address: '',
        birthdate: '',
        mobileNumber: '',
        department: 'Management',
        tinNumber: '',
        sssNumber: '',
        pagibigNumber: '',
        philhealthNumber: '',
        dateHired: dateHired,
        status: EmployeeStatus.ACTIVE,
        employmentType: EmploymentType.FULL_TIME,
        salaryHistory: [{
            id: `sal${Date.now()}`,
            effectiveDate: dateHired,
            basicSalary: 50000, // Default salary for employer
            allowance: 0,
            otherBenefits: 0,
        }],
        shiftId: 'shift1', // default shift
        workSchedule: companyProfile?.workSchedule || WorkSchedule.MONDAY_TO_FRIDAY,
        files: [],
        vacationLeaveAdjustment: 0,
        sickLeaveAdjustment: 0,
        customFields: {},
    };

    const newEmployee = addEmployee(newEmployeeData);

    const newAccount: UserAccount = {
        email,
        password, // In a real app, hash this password!
        role,
        employeeId: newEmployee.id,
    };
    accounts.push(newAccount);
    saveUserAccounts(accounts);
    
    return { user: newEmployee, role };
};

export const loginUser = (email: string, password: string): { user: Employee, role: UserRole } | { error: string } => {
    const accounts = getUserAccounts();
    const account = accounts.find(acc => acc.email.toLowerCase() === email.toLowerCase());

    if (!account) {
        return { error: 'Invalid email or password.' };
    }

    if (account.password !== password) {
         return { error: 'Invalid email or password.' };
    }
    
    const userProfile = getEmployeeById(account.employeeId);
    if (!userProfile) {
        return { error: 'Could not find employee profile associated with this account.' };
    }
    
    if (userProfile.status === EmployeeStatus.TERMINATED) {
        return { error: 'This account has been terminated and is no longer active.' };
    }

    return { user: userProfile, role: account.role };
};

export const changePassword = (employeeId: string, currentPassword: string, newPassword: string): { success: boolean, message: string } => {
    const accounts = getUserAccounts();
    const accountIndex = accounts.findIndex(acc => acc.employeeId === employeeId);

    if (accountIndex === -1) {
        return { success: false, message: 'User account not found.' };
    }

    if (accounts[accountIndex].password !== currentPassword) {
        return { success: false, message: 'Incorrect current password.' };
    }
    
    if (newPassword.length < 8) {
         return { success: false, message: 'New password must be at least 8 characters long.' };
    }

    accounts[accountIndex].password = newPassword;
    saveUserAccounts(accounts);

    return { success: true, message: 'Password changed successfully.' };
};

export const resetEmployeePassword = (employeeId: string, editorId: string): { success: boolean, message: string } => {
    const accounts = getUserAccounts();
    const accountIndex = accounts.findIndex(acc => acc.employeeId === employeeId);

    if (accountIndex === -1) {
        return { success: false, message: 'User account not found.' };
    }
    
    const employee = getEmployeeById(employeeId);
    if (!employee) {
        return { success: false, message: 'Employee profile not found.' };
    }

    const defaultPassword = 'password123';
    accounts[accountIndex].password = defaultPassword;
    saveUserAccounts(accounts);
    
    // Create audit log
    const logs = getAuditLogs();
    const newLog: AuditLog = {
        id: `log_${Date.now()}`,
        employeeId: employeeId,
        editorId,
        timestamp: new Date().toISOString(),
        changes: [
            { field: 'Password Reset', oldValue: '********', newValue: `Reset to default by administrator.` }
        ]
    };
    logs.push(newLog);
    saveAuditLogs(logs);

    // Send email notification
    sendPasswordResetEmail(
        `${employee.firstName} ${employee.lastName}`,
        employee.email,
        defaultPassword
    );

    return { success: true, message: 'Password has been reset successfully.' };
};

export const requestPasswordReminder = async (email: string): Promise<{ success: boolean, message: string }> => {
    const accounts = getUserAccounts();
    const account = accounts.find(acc => acc.email.toLowerCase() === email.toLowerCase());

    if (!account) {
        // To prevent user enumeration, we return a success message even if the email doesn't exist.
        return { success: true, message: "If an account with this email exists, a password reminder has been sent." };
    }
    
    const employee = getEmployeeById(account.employeeId);
    if (!employee) {
        return { success: false, message: "Could not find an associated employee profile." };
    }

    try {
        await sendForgotPasswordEmail(
            `${employee.firstName} ${employee.lastName}`,
            employee.email,
            account.password // Send the current password
        );
         return { success: true, message: "If an account with this email exists, a password reminder has been sent." };
    } catch (error) {
        console.error("Forgot Password email failed:", error);
        return { success: false, message: "Could not send reminder email. Please contact support." };
    }
};


// Shifts
export const getShifts = (): Shift[] => getFromStorage<Shift>('shifts');
export const addShift = (shift: Omit<Shift, 'id'>): Shift => {
    const shifts = getShifts();
    const newShift = { ...shift, id: `shift${Date.now()}` };
    saveToStorage('shifts', [...shifts, newShift]);
    return newShift;
};
export const updateShift = (updatedShift: Shift): Shift => {
    const shifts = getShifts();
    const index = shifts.findIndex(s => s.id === updatedShift.id);
    if (index !== -1) {
        shifts[index] = updatedShift;
        saveToStorage('shifts', shifts);
    }
    return updatedShift;
};
export const deleteShift = (shiftId: string): void => {
    const shifts = getShifts().filter(s => s.id !== shiftId);
    saveToStorage('shifts', shifts);
};

// Holidays
export const getHolidays = (): Holiday[] => getFromStorage<Holiday>('holidays');
export const addHoliday = (holiday: Omit<Holiday, 'id'>): Holiday => {
    const holidays = getHolidays();
    const newHoliday = { ...holiday, id: `hol${Date.now()}` };
    saveToStorage('holidays', [...holidays, newHoliday]);
    return newHoliday;
};

// Requests
export const getRequests = (): AppRequest[] => getFromStorage<AppRequest>('requests');
export const addRequest = (requestData: Omit<AppRequest, 'id' | 'status' | 'dateFiled'>): AppRequest => {
    const requests = getRequests();
    const newRequest = {
        ...requestData,
        id: `req${Date.now()}`,
        status: RequestStatus.PENDING,
        dateFiled: new Date().toISOString(),
    } as AppRequest;
    saveToStorage('requests', [...requests, newRequest]);
    return newRequest;
};
export const updateRequestStatus = (requestId: string, status: RequestStatus, editorId: string): AppRequest | undefined => {
    const requests = getRequests();
    const requestIndex = requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) return undefined;
    
    const request = requests[requestIndex];
    
    requests[requestIndex].status = status;
    saveToStorage('requests', requests);

    // If it's an info change request being approved, apply the changes
    if (request.type === RequestType.CHANGE_REQUEST && status === RequestStatus.APPROVED) {
        const employee = getEmployeeById(request.employeeId);
        if (employee) {
            const updatedEmployee = { ...employee, ...request.changes };
            updateEmployee(updatedEmployee, editorId);
        }
    }
    
    return requests[requestIndex];
};

// Attendance
export const getAttendance = (): AttendanceRecord[] => getFromStorage<AttendanceRecord>('attendance');
const saveAttendance = (records: AttendanceRecord[]): void => saveToStorage('attendance', records);

export const getTodaysAttendance = (employeeId: string): AttendanceRecord | undefined => {
    const today = new Date().toISOString().split('T')[0];
    return getAttendance().find(
        record => record.employeeId === employeeId && record.clockInTime.startsWith(today)
    );
};

export const clockIn = (record: Omit<AttendanceRecord, 'id'>): AttendanceRecord => {
    const records = getAttendance();
    const newRecord = { ...record, id: `att${Date.now()}` };
    saveToStorage('attendance', [...records, newRecord]);
    return newRecord;
};

export const clockOut = (
    employeeId: string, 
    clockOutData: { 
        clockOutPhoto: string; 
        clockOutLocation: { latitude: number; longitude: number };
        endOfDayNotes?: string;
    }
): AttendanceRecord | undefined => {
    const records = getAttendance();
    const today = new Date().toISOString().split('T')[0];
    const recordIndex = records.findIndex(
        r => r.employeeId === employeeId && r.clockInTime.startsWith(today) && !r.clockOutTime
    );

    if (recordIndex !== -1) {
        records[recordIndex] = {
            ...records[recordIndex],
            clockOutTime: new Date().toISOString(),
            clockOutPhoto: clockOutData.clockOutPhoto,
            clockOutLocation: clockOutData.clockOutLocation,
            endOfDayNotes: clockOutData.endOfDayNotes,
        };
        saveToStorage('attendance', records);
        return records[recordIndex];
    }
    return undefined;
};


export const addManualAttendance = (recordData: Omit<AttendanceRecord, 'id' | 'clockInPhoto' | 'clockInLocation' | 'clockOutPhoto' | 'clockOutLocation'>, editorId: string): AttendanceRecord => {
    const attendance = getAttendance();
    const newRecord: AttendanceRecord = {
        ...recordData,
        id: `att_${Date.now()}`,
    };
    attendance.push(newRecord);
    saveAttendance(attendance);

    // Create audit log
    const logs = getAuditLogs();
    const newLog: AuditLog = {
        id: `log_${Date.now()}`,
        employeeId: newRecord.employeeId,
        editorId,
        timestamp: new Date().toISOString(),
        changes: [
            { field: 'Manual Attendance Entry', oldValue: 'None', newValue: `Clocked In: ${new Date(newRecord.clockInTime).toLocaleString()}, Clocked Out: ${newRecord.clockOutTime ? new Date(newRecord.clockOutTime).toLocaleString() : 'N/A'}. Reason: ${recordData.manualEntryReason}` }
        ]
    };
    logs.push(newLog);
    saveAuditLogs(logs);

    return newRecord;
};

export const updateAttendance = (updatedRecord: AttendanceRecord, reason: string, editorId: string): AttendanceRecord => {
    const attendance = getAttendance();
    const index = attendance.findIndex(rec => rec.id === updatedRecord.id);
    if (index === -1) {
        throw new Error('Attendance record not found');
    }

    const originalRecord = attendance[index];
    const changes: AuditLogChange[] = [];

    if (originalRecord.clockInTime !== updatedRecord.clockInTime) {
        changes.push({ field: 'Clock In Time', oldValue: new Date(originalRecord.clockInTime).toLocaleString(), newValue: new Date(updatedRecord.clockInTime).toLocaleString() });
    }
    if (originalRecord.clockOutTime !== updatedRecord.clockOutTime) {
        changes.push({ field: 'Clock Out Time', oldValue: originalRecord.clockOutTime ? new Date(originalRecord.clockOutTime).toLocaleString() : 'N/A', newValue: updatedRecord.clockOutTime ? new Date(updatedRecord.clockOutTime).toLocaleString() : 'N/A' });
    }

    if (changes.length > 0) {
        // Add the reason for the change to the audit log details
        changes.push({ field: 'Reason for Edit', oldValue: originalRecord.manualEntryReason || 'N/A', newValue: reason });
        
        const logs = getAuditLogs();
        const newLog: AuditLog = {
            id: `log_${Date.now()}`,
            employeeId: updatedRecord.employeeId,
            editorId,
            timestamp: new Date().toISOString(),
            changes: changes
        };
        logs.push(newLog);
        saveAuditLogs(logs);
    }
    
    const finalRecord = { ...updatedRecord, manualEntryReason: reason };
    attendance[index] = finalRecord;
    saveAttendance(attendance);

    return finalRecord;
};


// Employees
export const getEmployees = (): Employee[] => getFromStorage<Employee>('employees');
const saveEmployees = (employees: Employee[]): void => saveToStorage('employees', employees);

export const getEmployeeById = (id: string): Employee | undefined => {
    return getEmployees().find(e => e.id === id);
};

export const addEmployee = (employeeData: Omit<Employee, 'id'>): Employee => {
    const employees = getEmployees();
    const newEmployee = { ...employeeData, id: `emp${Date.now()}` };
    saveEmployees([...employees, newEmployee]);
    return newEmployee;
};

export const deleteEmployee = (employeeId: string): void => {
    // This is a comprehensive deletion.
    let employees = getEmployees();
    let accounts = getUserAccounts();
    let attendance = getAttendance();
    let requests = getRequests();
    let tasks = getTasks();
    let logs = getAuditLogs();

    employees = employees.filter(e => e.id !== employeeId);
    accounts = accounts.filter(a => a.employeeId !== employeeId);
    attendance = attendance.filter(a => a.employeeId !== employeeId);
    requests = requests.filter(r => r.employeeId !== employeeId);
    tasks = tasks.filter(t => t.employeeId !== employeeId);
    logs = logs.filter(l => l.employeeId !== employeeId);

    saveEmployees(employees);
    saveUserAccounts(accounts);
    saveAttendance(attendance);
    saveToStorage('requests', requests);
    saveToStorage('tasks', tasks);
    saveAuditLogs(logs);
};

export const bulkDeleteEmployees = (employeeIds: string[]): void => {
    employeeIds.forEach(id => deleteEmployee(id));
};


export const inviteEmployee = (details: { firstName: string, lastName: string, email: string, department: string }): { user: Employee, role: UserRole } | { error: string } => {
    const accounts = getUserAccounts();
    const existingAccount = accounts.find(acc => acc.email.toLowerCase() === details.email.toLowerCase());

    if (existingAccount) {
        const associatedEmployee = getEmployeeById(existingAccount.employeeId);
        if (associatedEmployee && associatedEmployee.status === EmployeeStatus.TERMINATED) {
            // A terminated employee's email can be reused. This involves deleting the old terminated
            // employee and all their associated data to make way for a new invitation.
            deleteEmployee(associatedEmployee.id);
        } else {
            // Account exists and is for an active employee.
            return { error: 'An account with this email already exists for an active employee.' };
        }
    }

    const dateHired = new Date().toISOString().split('T')[0];
    const companyProfile = getCompanyProfile();
    const employees = getEmployees();
    const existingIds = employees.map(e => parseInt(e.employeeId.replace('EMP-', ''), 10)).filter(n => !isNaN(n));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    
    const newEmployeeData: Omit<Employee, 'id'> = {
        employeeId: `EMP-${String(maxId + 1).padStart(3, '0')}`,
        email: details.email,
        firstName: details.firstName,
        lastName: details.lastName,
        address: '',
        birthdate: '',
        mobileNumber: '',
        department: details.department,
        tinNumber: '',
        sssNumber: '',
        pagibigNumber: '',
        philhealthNumber: '',
        dateHired: dateHired,
        status: EmployeeStatus.ACTIVE,
        employmentType: EmploymentType.PROBATIONARY,
        salaryHistory: [{
            id: `sal${Date.now()}`,
            effectiveDate: dateHired,
            basicSalary: 25000, // Default starting salary
            allowance: 0,
            otherBenefits: 0,
        }],
        shiftId: 'shift1', // default shift
        workSchedule: companyProfile?.workSchedule || WorkSchedule.MONDAY_TO_FRIDAY,
        files: [],
        vacationLeaveAdjustment: 0,
        sickLeaveAdjustment: 0,
        customFields: {},
    };

    const newEmployee = addEmployee(newEmployeeData);
    const defaultPassword = 'password123';

    // Get the most recent list of accounts before adding a new one.
    const currentAccounts = getUserAccounts();
    const newAccount: UserAccount = {
        email: details.email,
        password: defaultPassword, // Default password
        role: UserRole.EMPLOYEE,
        employeeId: newEmployee.id,
    };
    currentAccounts.push(newAccount);
    saveUserAccounts(currentAccounts);
    
    // Attempt to send email invitation
    sendInvitationEmail(
        `${details.firstName} ${details.lastName}`,
        details.email,
        defaultPassword
    );

    return { user: newEmployee, role: UserRole.EMPLOYEE };
};

export const bulkInviteEmployees = (emailsCsv: string, employmentType: EmploymentType): { successCount: number; errorCount: number; errors: string[] } => {
    const emails = emailsCsv.split(',').map(e => e.trim()).filter(e => e);
    const results = { successCount: 0, errorCount: 0, errors: [] as string[] };
    let accounts = getUserAccounts(); // Use let
    const defaultPassword = 'password123';

    emails.forEach(email => {
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            results.errorCount++;
            results.errors.push(`Invalid email format: ${email}`);
            return;
        }

        const existingAccount = accounts.find(acc => acc.email.toLowerCase() === email.toLowerCase());
        if (existingAccount) {
            const associatedEmployee = getEmployeeById(existingAccount.employeeId);
            if (associatedEmployee && associatedEmployee.status === EmployeeStatus.TERMINATED) {
                // Terminated employee email can be reused, delete old data first.
                deleteEmployee(associatedEmployee.id);
                // Refresh accounts list for next iteration
                accounts = getUserAccounts();
            } else {
                // Active employee email cannot be reused.
                results.errorCount++;
                results.errors.push(`Email already exists for an active employee: ${email}`);
                return;
            }
        }

        const dateHired = new Date().toISOString().split('T')[0];
        const companyProfile = getCompanyProfile();
        const employees = getEmployees();
        const existingIds = employees.map(e => parseInt(e.employeeId.replace('EMP-', ''), 10)).filter(n => !isNaN(n));
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        
        const newEmployeeData: Omit<Employee, 'id'> = {
            employeeId: `EMP-${String(maxId + 1).padStart(3, '0')}`,
            email,
            firstName: 'Invited',
            lastName: 'User',
            address: '',
            birthdate: '',
            mobileNumber: '',
            department: 'Unassigned',
            tinNumber: '', sssNumber: '', pagibigNumber: '', philhealthNumber: '',
            dateHired: dateHired,
            status: EmployeeStatus.ACTIVE,
            employmentType,
            salaryHistory: [{ id: `sal${Date.now()}`, effectiveDate: dateHired, basicSalary: 25000, allowance: 0, otherBenefits: 0 }],
            shiftId: 'shift1',
            workSchedule: companyProfile?.workSchedule || WorkSchedule.MONDAY_TO_FRIDAY,
            files: [],
            vacationLeaveAdjustment: 0, sickLeaveAdjustment: 0,
            customFields: {},
        };

        const newEmployee = addEmployee(newEmployeeData);
        const newAccount: UserAccount = {
            email,
            password: defaultPassword,
            role: UserRole.EMPLOYEE,
            employeeId: newEmployee.id,
        };
        // Use the potentially updated accounts list
        accounts.push(newAccount);
        saveUserAccounts(accounts);
        results.successCount++;
        
        // Attempt to send email invitation
        sendInvitationEmail('Invited User', email, defaultPassword);
    });

    return results;
};


export const bulkImportEmployees = (csvData: string): { successCount: number, errorCount: number, errors: string[] } => {
    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return { successCount: 0, errorCount: 1, errors: ['CSV file is empty or has no data rows.'] };
    
    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = ['firstName', 'lastName', 'email'];
    for (const required of requiredHeaders) {
        if (!headers.includes(required)) {
            return { successCount: 0, errorCount: 1, errors: [`Missing required header: ${required}`] };
        }
    }
    
    const results = { successCount: 0, errorCount: 0, errors: [] as string[] };
    let accounts = getUserAccounts(); // Use let
    const allShifts = getShifts();
    const defaultPassword = 'password123';

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const entry = headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
        }, {} as {[key: string]: string});

        if (!entry.email || !/^\S+@\S+\.\S+$/.test(entry.email)) {
            results.errorCount++;
            results.errors.push(`Row ${i + 1}: Invalid email format.`);
            continue;
        }

        const existingAccount = accounts.find(acc => acc.email.toLowerCase() === entry.email.toLowerCase());
        if (existingAccount) {
            const associatedEmployee = getEmployeeById(existingAccount.employeeId);
            if (associatedEmployee && associatedEmployee.status === EmployeeStatus.TERMINATED) {
                // Terminated employee email can be reused, delete old data first.
                deleteEmployee(associatedEmployee.id);
                // Refresh accounts list for next iteration
                accounts = getUserAccounts();
            } else {
                // Active employee email cannot be reused.
                results.errorCount++;
                results.errors.push(`Row ${i + 1}: Email already exists for an active employee: ${entry.email}`);
                continue;
            }
        }

        const employees = getEmployees();
        const existingIds = employees.map(e => parseInt(e.employeeId.replace('EMP-', ''), 10)).filter(n => !isNaN(n));
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        
        let shiftId = 'shift1';
        if (entry.shiftName) {
            const foundShift = allShifts.find(s => s.name.toLowerCase() === entry.shiftName.toLowerCase());
            if (foundShift) {
                shiftId = foundShift.id;
            } else {
                results.errors.push(`Row ${i+1}: Shift "${entry.shiftName}" not found. Assigning default.`);
            }
        }
        
        const newEmployeeData: Omit<Employee, 'id'> = {
            employeeId: entry.employeeId || `EMP-${String(maxId + 1).padStart(3, '0')}`,
            email: entry.email,
            firstName: entry.firstName,
            lastName: entry.lastName,
            address: '', birthdate: '', mobileNumber: '',
            department: entry.department || 'Unassigned',
            tinNumber: '', sssNumber: '', pagibigNumber: '', philhealthNumber: '',
            dateHired: entry.dateHired || new Date().toISOString().split('T')[0],
            status: EmployeeStatus.ACTIVE,
            employmentType: EmploymentType.PROBATIONARY,
            salaryHistory: [{ id: `sal${Date.now()}`, effectiveDate: entry.dateHired || new Date().toISOString().split('T')[0], basicSalary: 25000, allowance: 0, otherBenefits: 0 }],
            shiftId: shiftId,
            workSchedule: Object.values(WorkSchedule).includes(entry.workSchedule as WorkSchedule) ? entry.workSchedule as WorkSchedule : WorkSchedule.MONDAY_TO_FRIDAY,
            files: [],
            vacationLeaveAdjustment: 0, sickLeaveAdjustment: 0, customFields: {},
        };

        const newEmployee = addEmployee(newEmployeeData);
        const newAccount: UserAccount = { email: entry.email, password: defaultPassword, role: UserRole.EMPLOYEE, employeeId: newEmployee.id };
        accounts.push(newAccount);
        saveUserAccounts(accounts);
        results.successCount++;

        // Attempt to send email invitation for imported user
        sendInvitationEmail(
            `${entry.firstName} ${entry.lastName}`,
            entry.email,
            defaultPassword
        );
    }

    return results;
};


export const updateEmployee = (updatedEmployee: Employee, editorId: string): Employee => {
    const employees = getEmployees();
    const index = employees.findIndex(e => e.id === updatedEmployee.id);
    if (index !== -1) {
        const originalEmployee = employees[index];
        const logs = getAuditLogs();
        const changes: AuditLogChange[] = [];

        // Compare fields and log changes
        (Object.keys(updatedEmployee) as Array<keyof Employee>).forEach(key => {
            // Stringify to handle complex types consistently. Exclude fields we don't want to audit this way.
            if (key !== 'salaryHistory' && key !== 'files' && key !== 'customFields') {
                 const originalValue = String(originalEmployee[key] ?? '');
                 const newValue = String(updatedEmployee[key] ?? '');
                 if (originalValue !== newValue) {
                     changes.push({ field: key, oldValue: originalValue, newValue });
                 }
            }
        });
        
        // Specific handling for salary history addition
        if (updatedEmployee.salaryHistory.length > originalEmployee.salaryHistory.length) {
            const newRecord = updatedEmployee.salaryHistory[updatedEmployee.salaryHistory.length - 1];
            changes.push({ field: 'Salary Record Added', oldValue: 'N/A', newValue: `Effective ${newRecord.effectiveDate}, Basic: ${newRecord.basicSalary.toLocaleString()}` });
        }
        
        // Specific handling for custom fields
        const allCustomFieldKeys = new Set([...Object.keys(originalEmployee.customFields || {}), ...Object.keys(updatedEmployee.customFields || {})]);
        allCustomFieldKeys.forEach(fieldId => {
            const oldValue = originalEmployee.customFields?.[fieldId] || 'Not set';
            const newValue = updatedEmployee.customFields?.[fieldId] || 'Not set';
            if (oldValue !== newValue) {
                const defs = getCustomFieldDefinitions();
                const fieldDef = defs.find(d => d.id === fieldId);
                const fieldName = fieldDef ? fieldDef.name : `Custom Field (${fieldId})`;
                changes.push({ field: fieldName, oldValue: String(oldValue), newValue: String(newValue) });
            }
        });


        if (changes.length > 0) {
            const newLog: AuditLog = {
                id: `log_${Date.now()}`,
                employeeId: updatedEmployee.id,
                editorId,
                timestamp: new Date().toISOString(),
                changes: changes
            };
            logs.push(newLog);
            saveAuditLogs(logs);
        }

        employees[index] = updatedEmployee;
        saveEmployees(employees);
    }
    return updatedEmployee;
};

export const deleteSalaryRecord = (salaryRecordId: string): void => {
    const employees = getEmployees();
    for (const employee of employees) {
        const recordIndex = employee.salaryHistory.findIndex(record => record.id === salaryRecordId);
        if (recordIndex !== -1) {
            employee.salaryHistory.splice(recordIndex, 1);
            saveEmployees(employees);
            return;
        }
    }
};

export const updateProfilePicture = (employeeId: string, base64Image: string): void => {
    const employees = getEmployees();
    const index = employees.findIndex(e => e.id === employeeId);
    if (index !== -1) {
        employees[index].profilePicture = base64Image;
        saveEmployees(employees);
    }
};

// Company Profile
export const getCompanyProfile = (): CompanyProfile | null => {
    const data = localStorage.getItem('companyProfile');
    return data ? JSON.parse(data) : null;
};
export const updateCompanyProfile = (profile: CompanyProfile): CompanyProfile => {
    localStorage.setItem('companyProfile', JSON.stringify(profile));
    return profile;
};

// Leave Policy
export const getLeavePolicy = (): LeavePolicy => {
    const data = localStorage.getItem('leavePolicy');
    // Provide a default policy if none exists
    return data ? JSON.parse(data) : {
        id: 'mainPolicy',
        baseVacationDaysPerYear: 15,
        baseSickDaysPerYear: 10,
        tenureBonusEnabled: true,
        tenureBonusYearsInterval: 2,
        maxTenureBonusDays: 5,
    };
};
export const updateLeavePolicy = (policy: LeavePolicy): LeavePolicy => {
    localStorage.setItem('leavePolicy', JSON.stringify(policy));
    return policy;
};

export const adjustLeaveBalance = (employeeId: string, adjustments: { vacation: number; sick: number }, reason: string, editorId: string) => {
    const employee = getEmployeeById(employeeId);
    if (!employee) return;

    const currentVacAdj = employee.vacationLeaveAdjustment || 0;
    const currentSickAdj = employee.sickLeaveAdjustment || 0;

    const newVacAdj = currentVacAdj + adjustments.vacation;
    const newSickAdj = currentSickAdj + adjustments.sick;
    
    const changes: AuditLogChange[] = [];
    if (adjustments.vacation !== 0) {
        changes.push({ field: 'Vacation Leave Adjustment', oldValue: `${currentVacAdj} days`, newValue: `${newVacAdj} days (Changed by ${adjustments.vacation})` });
    }
    if (adjustments.sick !== 0) {
        changes.push({ field: 'Sick Leave Adjustment', oldValue: `${currentSickAdj} days`, newValue: `${newSickAdj} days (Changed by ${adjustments.sick})` });
    }
    
    changes.push({ field: 'Reason for Adjustment', oldValue: 'N/A', newValue: reason });

    const updatedEmployee = {
        ...employee,
        vacationLeaveAdjustment: newVacAdj,
        sickLeaveAdjustment: newSickAdj,
    };
    
    const logs = getAuditLogs();
    const newLog: AuditLog = {
        id: `log_${Date.now()}`,
        employeeId: employeeId,
        editorId,
        timestamp: new Date().toISOString(),
        changes: changes
    };
    logs.push(newLog);
    saveAuditLogs(logs);

    const employees = getEmployees();
    const index = employees.findIndex(e => e.id === employeeId);
    if (index !== -1) {
        employees[index] = updatedEmployee;
        saveEmployees(employees);
    }
};


// Leave Balance Calculation
export const calculateLeaveBalance = (employeeId: string): LeaveBalance => {
    const employee = getEmployeeById(employeeId);
    const policy = getLeavePolicy();
    // FIX: Use a type predicate to correctly type `requests` as `LeaveRequest[]`.
    const requests = getRequests().filter((r): r is LeaveRequest => r.employeeId === employeeId && r.status === RequestStatus.APPROVED && r.type === RequestType.LEAVE);
    
    if (!employee) {
         return {
            vacation: { accrued: 0, used: 0, available: 0 },
            sick: { accrued: 0, used: 0, available: 0 }
        };
    }
    
    const yearsOfService = (new Date().getTime() - new Date(employee.dateHired).getTime()) / (1000 * 60 * 60 * 24 * 365);
    
    let tenureBonus = 0;
    if (policy.tenureBonusEnabled) {
        tenureBonus = Math.floor(yearsOfService / policy.tenureBonusYearsInterval);
        if (tenureBonus > policy.maxTenureBonusDays) {
            tenureBonus = policy.maxTenureBonusDays;
        }
    }
    
    // Pro-rate based on current day of the year
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const today = new Date();
    const dayOfYear = ((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const yearFraction = dayOfYear / 365;
    
    const accruedVacation = (policy.baseVacationDaysPerYear + tenureBonus) * yearFraction;
    const accruedSick = policy.baseSickDaysPerYear * yearFraction;
    
    let usedVacation = 0;
    let usedSick = 0;
    
    requests.forEach(req => {
        // Simple day diff calculation, inclusive. In a real app, this would exclude weekends/holidays.
        const duration = (new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 3600 * 24) + 1;
        if(req.leaveType === LeaveType.VACATION || req.leaveType === LeaveType.CLIENT_HOLIDAY || req.leaveType === LeaveType.EMERGENCY) {
            usedVacation += duration;
        } else if (req.leaveType === LeaveType.SICK) {
            usedSick += duration;
        }
    });

    const vacationAdjustment = employee.vacationLeaveAdjustment || 0;
    const sickAdjustment = employee.sickLeaveAdjustment || 0;

    return {
        vacation: {
            accrued: accruedVacation,
            used: usedVacation,
            available: accruedVacation - usedVacation + vacationAdjustment,
        },
        sick: {
            accrued: accruedSick,
            used: usedSick,
            available: accruedSick - usedSick + sickAdjustment,
        }
    }
};

// Tasks
export const getTasks = (): Task[] => getFromStorage<Task>('tasks');
const saveTasks = (tasks: Task[]): void => saveToStorage('tasks', tasks);

export const getTasksForEmployee = (employeeId: string): Task[] => {
    return getTasks().filter(t => t.employeeId === employeeId)
        .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
};

export const addTask = (taskData: Omit<Task, 'id'>): Task => {
    const tasks = getTasks();
    const newTask = { ...taskData, id: `task_${Date.now()}` };
    saveTasks([...tasks, newTask]);
    return newTask;
};

export const updateTask = (updatedTask: Task): Task => {
    const tasks = getTasks();
    const index = tasks.findIndex(t => t.id === updatedTask.id);
    if (index !== -1) {
        tasks[index] = updatedTask;
        saveTasks(tasks);
    }
    return updatedTask;
};

export const clearAllData = (): void => {
    const appKeys = [
        'shifts',
        'employees',
        'holidays',
        'requests',
        'attendance',
        'companyProfile',
        'userAccounts',
        'auditLogs',
        'leavePolicy',
        'tasks',
        'customFieldDefinitions',
        'seeded'
    ];

    appKeys.forEach(key => localStorage.removeItem(key));

    initSeedData();
};


// --- Payroll Functions ---
export const calculatePayrollSummary = (startDate: string, endDate: string) => {
    const employees = getEmployees().filter(e => e.status === EmployeeStatus.ACTIVE);
    const attendance = getAttendance();
    const requests = getRequests();
    
    return employees.map(emp => {
        const latestSalary = [...emp.salaryHistory].sort((a,b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())[0];
        
        // Using a standard 40-hour week, 52 weeks a year to get an hourly rate from monthly salary
        const hourlyRate = latestSalary ? (latestSalary.basicSalary * 12) / (52 * 40) : 0;

        const empAttendance = attendance.filter(a => {
            const recordDate = a.clockInTime.split('T')[0];
            return a.employeeId === emp.id && recordDate >= startDate && recordDate <= endDate && a.clockOutTime;
        });

        const totalHours = empAttendance.reduce((acc, record) => {
            const diff = new Date(record.clockOutTime!).getTime() - new Date(record.clockInTime).getTime();
            return acc + (diff / (1000 * 60 * 60));
        }, 0);
        
        const otHours = requests.filter((r): r is OtUtRequest => 
            r.employeeId === emp.id && 
            r.type === RequestType.OVERTIME && 
            r.status === RequestStatus.APPROVED &&
            r.date >= startDate && r.date <= endDate
        ).reduce((acc, r) => acc + r.hours, 0);

        const leaveDays = requests.filter((r): r is LeaveRequest => 
            r.employeeId === emp.id && 
            r.type === RequestType.LEAVE && 
            r.status === RequestStatus.APPROVED &&
            !(new Date(r.endDate) < new Date(startDate) || new Date(r.startDate) > new Date(endDate))
        ).reduce((acc, r) => {
            const duration = (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 3600 * 24) + 1;
            return acc + duration;
        }, 0);
        
        const grossPay = (totalHours * hourlyRate) + (otHours * hourlyRate * 1.5);
        
        return {
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeEmail: emp.email,
            totalHours: totalHours.toFixed(2),
            otHours: otHours.toFixed(2),
            leaveDays,
            grossPay: grossPay.toFixed(2),
        };
    });
};

export const processPayrollAndNotify = async (payrollSummary: any[]): Promise<{successCount: number, errorCount: number}> => {
     if (
        // FIX: Cast to string to avoid TypeScript literal type comparison error. This preserves the check for placeholder values.
        (EMAILJS_SERVICE_ID as string) === 'REPLACE_WITH_YOUR_EMAILJS_SERVICE_ID' ||
        (EMAILJS_PAYSLIP_TEMPLATE_ID as string) === 'REPLACE_WITH_YOUR_PAYSLIP_TEMPLATE_ID'
    ) {
        console.warn(
            'EmailJS is not configured for payroll. Skipping email notifications. Please set your credentials in services/mockApi.ts.'
        );
        alert('EmailJS is not configured for payroll. Notifications were not sent. See console for details.');
        return { successCount: 0, errorCount: payrollSummary.length };
    }
    
    const companyProfile = getCompanyProfile();
    let successCount = 0;
    
    for (const summary of payrollSummary) {
         const templateParams = {
            ...summary,
            company_name: companyProfile?.name || 'WorkLogix',
        };

        try {
            await (window as any).emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_PAYSLIP_TEMPLATE_ID, templateParams);
            successCount++;
        } catch (error) {
            console.error(`FAILED to send payslip to ${summary.employeeEmail}.`, error);
        }
    }
    
    return { successCount, errorCount: payrollSummary.length - successCount };
};