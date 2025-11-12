
import { Employee, Shift, Holiday, AppRequest, AttendanceRecord, EmployeeStatus, RequestStatus, RequestType, CompanyProfile, UserAccount, UserRole, AuditLog, AuditLogChange, LeaveBalance, LeaveType, LeavePolicy, EmploymentType, Task, WorkSchedule, CustomFieldDefinition, LeaveRequest } from '../types';

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
        name: 'HR Core Solutions',
        address: '123 Business Avenue, Tech City',
        contactNumber: '(02) 8888-8888',
        email: 'contact@hrcore.com',
        tin: '000-123-456-789',
        logo: '',
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

export const registerUser = (firstName: string, lastName: string, email: string, password: string): { user: Employee, role: UserRole } | { error: string } => {
    const accounts = getUserAccounts();
    if (accounts.some(acc => acc.email.toLowerCase() === email.toLowerCase())) {
        return { error: 'An account with this email already exists.' };
    }

    const role = accounts.length === 0 ? UserRole.EMPLOYER : UserRole.EMPLOYEE;
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
        department: role === UserRole.EMPLOYER ? 'Management' : 'Unassigned',
        tinNumber: '',
        sssNumber: '',
        pagibigNumber: '',
        philhealthNumber: '',
        dateHired: dateHired,
        status: EmployeeStatus.ACTIVE,
        employmentType: role === UserRole.EMPLOYER ? EmploymentType.FULL_TIME : EmploymentType.PROBATIONARY,
        salaryHistory: [{
            id: `sal${Date.now()}`,
            effectiveDate: dateHired,
            basicSalary: 0,
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

export const inviteEmployee = (details: { firstName: string, lastName: string, email: string, department: string }): { user: Employee, role: UserRole } | { error: string } => {
    const accounts = getUserAccounts();
    if (accounts.some(acc => acc.email.toLowerCase() === details.email.toLowerCase())) {
        return { error: 'An account with this email already exists.' };
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
            basicSalary: 0,
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
        email: details.email,
        password: 'password123', // Default password
        role: UserRole.EMPLOYEE,
        employeeId: newEmployee.id,
    };
    accounts.push(newAccount);
    saveUserAccounts(accounts);
    
    return { user: newEmployee, role: UserRole.EMPLOYEE };
};

export const bulkInviteEmployees = (emailsCsv: string, employmentType: EmploymentType): { successCount: number; errorCount: number; errors: string[] } => {
    const emails = emailsCsv.split(',').map(e => e.trim()).filter(e => e);
    const results = { successCount: 0, errorCount: 0, errors: [] as string[] };
    const accounts = getUserAccounts();

    emails.forEach(email => {
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            results.errorCount++;
            results.errors.push(`Invalid email format: ${email}`);
            return;
        }
        if (accounts.some(acc => acc.email.toLowerCase() === email.toLowerCase())) {
            results.errorCount++;
            results.errors.push(`Email already exists: ${email}`);
            return;
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
            salaryHistory: [{ id: `sal${Date.now()}`, effectiveDate: dateHired, basicSalary: 0, allowance: 0, otherBenefits: 0 }],
            shiftId: 'shift1',
            workSchedule: companyProfile?.workSchedule || WorkSchedule.MONDAY_TO_FRIDAY,
            files: [],
            vacationLeaveAdjustment: 0, sickLeaveAdjustment: 0,
            customFields: {},
        };

        const newEmployee = addEmployee(newEmployeeData);
        const newAccount: UserAccount = {
            email,
            password: 'password123',
            role: UserRole.EMPLOYEE,
            employeeId: newEmployee.id,
        };
        accounts.push(newAccount);
        saveUserAccounts(accounts);
        results.successCount++;
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
    const accounts = getUserAccounts();
    const allShifts = getShifts();

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
        if (accounts.some(acc => acc.email.toLowerCase() === entry.email.toLowerCase())) {
            results.errorCount++;
            results.errors.push(`Row ${i + 1}: Email already exists: ${entry.email}`);
            continue;
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
            salaryHistory: [{ id: `sal${Date.now()}`, effectiveDate: entry.dateHired || new Date().toISOString().split('T')[0], basicSalary: 0, allowance: 0, otherBenefits: 0 }],
            shiftId: shiftId,
            workSchedule: Object.values(WorkSchedule).includes(entry.workSchedule as WorkSchedule) ? entry.workSchedule as WorkSchedule : WorkSchedule.MONDAY_TO_FRIDAY,
            files: [],
            vacationLeaveAdjustment: 0, sickLeaveAdjustment: 0, customFields: {},
        };

        const newEmployee = addEmployee(newEmployeeData);
        const newAccount: UserAccount = { email: entry.email, password: 'password123', role: UserRole.EMPLOYEE, employeeId: newEmployee.id };
        accounts.push(newAccount);
        saveUserAccounts(accounts);
        results.successCount++;
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
            changes.push({ field: 'Salary Record Added', oldValue: 'N/A', newValue: `Effective ${newRecord.effectiveDate}, Total: ${newRecord.basicSalary + newRecord.allowance + newRecord.otherBenefits}` });
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
