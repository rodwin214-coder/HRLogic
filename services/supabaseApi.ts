import { supabase } from './supabaseClient';
import * as bcrypt from 'bcryptjs';
import {
    Employee,
    UserAccount,
    UserRole,
    CompanyProfile,
    Shift,
    Holiday,
    AppRequest,
    AttendanceRecord,
    Task,
    LeavePolicy,
    CustomFieldDefinition,
    EmployeeStatus,
    EmploymentType,
    RequestStatus,
    RequestType,
    LeaveType,
    LeaveBalance,
    WorkSchedule,
} from '../types';

// Store current session info
let currentCompanyId: string | null = null;
let currentUserEmail: string | null = null;

export const setCurrentUserEmail = async (email: string) => {
    currentUserEmail = email;
    // Set the session variable for RLS
    try {
        await supabase.rpc('set_config', {
            setting_name: 'app.current_user_email',
            setting_value: email
        } as any);
    } catch (error) {
        // If the function doesn't exist, we'll need to create it
        console.warn('set_config RPC not available, RLS may not work correctly');
    }
};

// Helper to get company by code
const getCompanyByCode = async (companyCode: string): Promise<any | null> => {
    const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('company_code', companyCode)
        .maybeSingle();

    if (error) throw error;
    return data;
};

// Authentication Functions
export const registerEmployer = async (
    companyCode: string,
    companyName: string,
    firstName: string,
    lastName: string,
    email: string,
    password: string
): Promise<{ user: Employee; role: UserRole } | { error: string }> => {
    try {
        // Check if company code already exists
        const existingCompany = await getCompanyByCode(companyCode);
        if (existingCompany) {
            return { error: 'Company code already exists. Please choose a different code.' };
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create company
        const { data: newCompany, error: companyError } = await supabase
            .from('companies')
            .insert([{
                company_code: companyCode,
                name: companyName,
                work_schedule: WorkSchedule.MONDAY_TO_FRIDAY,
            }])
            .select()
            .single();

        if (companyError) throw companyError;
        currentCompanyId = newCompany.id;

        // Create default shifts for the company
        const { data: shifts, error: shiftsError } = await supabase.from('shifts').insert([
            {
                company_id: newCompany.id,
                name: 'Morning Shift',
                start_time: '09:00',
                end_time: '18:00',
            },
            {
                company_id: newCompany.id,
                name: 'Night Shift',
                start_time: '22:00',
                end_time: '07:00',
            },
        ]).select();

        if (shiftsError) throw shiftsError;

        // Get the default shift
        const defaultShift = shifts && shifts.length > 0 ? shifts[0] : null;

        // Create employee record for the employer
        const { data: newEmployee, error: employeeError } = await supabase
            .from('employees')
            .insert([{
                company_id: newCompany.id,
                employee_id: 'EMP-001',
                email,
                first_name: firstName,
                last_name: lastName,
                department: 'Management',
                date_hired: new Date().toISOString().split('T')[0],
                status: EmployeeStatus.ACTIVE,
                employment_type: EmploymentType.FULL_TIME,
                shift_id: defaultShift?.id || null,
                work_schedule: WorkSchedule.MONDAY_TO_FRIDAY,
            }])
            .select()
            .single();

        if (employeeError) throw employeeError;

        // Create salary history
        await supabase.from('salary_history').insert([{
            employee_id: newEmployee.id,
            effective_date: new Date().toISOString().split('T')[0],
            basic_salary: 50000,
            allowance: 0,
            other_benefits: 0,
        }]);

        // Create user account
        await supabase.from('user_accounts').insert([{
            company_id: newCompany.id,
            email,
            password_hash: passwordHash,
            role: UserRole.EMPLOYER,
            employee_id: newEmployee.id,
        }]);

        // Create default leave policy
        await supabase.from('leave_policies').insert([{
            company_id: newCompany.id,
            base_vacation_days_per_year: 15,
            base_sick_days_per_year: 10,
            tenure_bonus_enabled: true,
            tenure_bonus_years_interval: 2,
            max_tenure_bonus_days: 5,
        }]);

        // Set current user email for RLS
        await setCurrentUserEmail(email);

        // Convert to Employee type
        const employee: Employee = await convertDbEmployeeToEmployee(newEmployee);
        return { user: employee, role: UserRole.EMPLOYER };
    } catch (error: any) {
        console.error('Registration error:', error);
        return { error: error.message || 'Registration failed. Please try again.' };
    }
};

export const loginUser = async (
    companyCode: string,
    email: string,
    password: string
): Promise<{ user: Employee; role: UserRole } | { error: string }> => {
    try {
        // Get company
        const company = await getCompanyByCode(companyCode);
        if (!company) {
            return { error: 'Invalid company code.' };
        }
        currentCompanyId = company.id;

        // Get user account
        const { data: account, error: accountError } = await supabase
            .from('user_accounts')
            .select('*')
            .eq('company_id', company.id)
            .eq('email', email)
            .maybeSingle();

        if (accountError || !account) {
            return { error: 'Invalid email or password.' };
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, account.password_hash);
        if (!passwordMatch) {
            return { error: 'Invalid email or password.' };
        }

        // Set current user email for RLS
        await setCurrentUserEmail(email);

        // Get employee profile
        const { data: employeeData, error: employeeError } = await supabase
            .from('employees')
            .select('*')
            .eq('id', account.employee_id)
            .single();

        if (employeeError || !employeeData) {
            return { error: 'Could not find employee profile.' };
        }

        if (employeeData.status === EmployeeStatus.TERMINATED) {
            return { error: 'This account has been terminated and is no longer active.' };
        }

        const employee: Employee = await convertDbEmployeeToEmployee(employeeData);
        return { user: employee, role: account.role };
    } catch (error: any) {
        console.error('Login error:', error);
        return { error: error.message || 'Login failed. Please try again.' };
    }
};

// Helper function to convert database employee to Employee type
const convertDbEmployeeToEmployee = async (dbEmployee: any): Promise<Employee> => {
    // Get salary history
    const { data: salaryHistory } = await supabase
        .from('salary_history')
        .select('*')
        .eq('employee_id', dbEmployee.id)
        .order('effective_date', { ascending: false });

    return {
        id: dbEmployee.id,
        employeeId: dbEmployee.employee_id,
        email: dbEmployee.email,
        firstName: dbEmployee.first_name,
        middleName: dbEmployee.middle_name,
        lastName: dbEmployee.last_name,
        address: dbEmployee.address || '',
        birthdate: dbEmployee.birthdate || '',
        mobileNumber: dbEmployee.mobile_number || '',
        department: dbEmployee.department || '',
        tinNumber: dbEmployee.tin_number || '',
        sssNumber: dbEmployee.sss_number || '',
        pagibigNumber: dbEmployee.pagibig_number || '',
        philhealthNumber: dbEmployee.philhealth_number || '',
        dateHired: dbEmployee.date_hired || '',
        dateTerminated: dbEmployee.date_terminated,
        status: dbEmployee.status || EmployeeStatus.ACTIVE,
        employmentType: dbEmployee.employment_type || EmploymentType.PROBATIONARY,
        salaryHistory: (salaryHistory || []).map((s: any) => ({
            id: s.id,
            effectiveDate: s.effective_date,
            basicSalary: parseFloat(s.basic_salary),
            allowance: parseFloat(s.allowance || 0),
            otherBenefits: parseFloat(s.other_benefits || 0),
        })),
        shiftId: dbEmployee.shift_id || '',
        workSchedule: dbEmployee.work_schedule,
        profilePicture: dbEmployee.profile_picture,
        files: [],
        notes: dbEmployee.notes,
        vacationLeaveAdjustment: parseFloat(dbEmployee.vacation_leave_adjustment || 0),
        sickLeaveAdjustment: parseFloat(dbEmployee.sick_leave_adjustment || 0),
        customFields: dbEmployee.custom_fields || {},
    };
};

// Employee Functions
export const getEmployeeById = async (id: string): Promise<Employee | undefined> => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error || !data) return undefined;
        return await convertDbEmployeeToEmployee(data);
    } catch (error) {
        console.error('Error fetching employee:', error);
        return undefined;
    }
};

export const getUserAccountByEmployeeId = async (employeeId: string): Promise<UserAccount | undefined> => {
    try {
        const { data, error } = await supabase
            .from('user_accounts')
            .select('*')
            .eq('employee_id', employeeId)
            .maybeSingle();

        if (error || !data) return undefined;
        return {
            email: data.email,
            password: '', // Never return password
            role: data.role,
            employeeId: data.employee_id,
        };
    } catch (error) {
        console.error('Error fetching user account:', error);
        return undefined;
    }
};

export const getEmployees = async (): Promise<Employee[]> => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('last_name', { ascending: true });

        if (error) throw error;
        const employees = await Promise.all((data || []).map(convertDbEmployeeToEmployee));
        return employees;
    } catch (error) {
        console.error('Error fetching employees:', error);
        return [];
    }
};

export const inviteEmployee = async (employeeData: {
    firstName: string;
    lastName: string;
    email: string;
    department: string;
}): Promise<Employee | { error: string }> => {
    try {
        if (!currentCompanyId) {
            return { error: 'Company not found. Please log in again.' };
        }

        // Check if email already exists in the company
        const { data: existingAccount } = await supabase
            .from('user_accounts')
            .select('email')
            .eq('company_id', currentCompanyId)
            .eq('email', employeeData.email)
            .maybeSingle();

        if (existingAccount) {
            return { error: 'An employee with this email already exists in your company.' };
        }

        // Generate employee ID (e.g., "emp" + timestamp)
        const generatedEmployeeId = `emp${Date.now()}`;

        // Hash default password
        const defaultPassword = 'password123';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        // Create employee record
        const { data: newEmployee, error: employeeError } = await supabase
            .from('employees')
            .insert([{
                company_id: currentCompanyId,
                employee_id: generatedEmployeeId,
                email: employeeData.email,
                first_name: employeeData.firstName,
                last_name: employeeData.lastName,
                department: employeeData.department,
                date_hired: new Date().toISOString().split('T')[0],
                status: EmployeeStatus.ACTIVE,
                employment_type: EmploymentType.PROBATIONARY,
            }])
            .select()
            .single();

        if (employeeError) throw employeeError;

        // Create user account
        const { error: accountError } = await supabase
            .from('user_accounts')
            .insert([{
                company_id: currentCompanyId,
                employee_id: newEmployee.id,
                email: employeeData.email,
                password_hash: passwordHash,
                role: UserRole.EMPLOYEE,
            }]);

        if (accountError) throw accountError;

        // Convert to Employee type
        const employee = await convertDbEmployeeToEmployee(newEmployee);
        return employee;
    } catch (error: any) {
        console.error('Error inviting employee:', error);
        return { error: error.message || 'Failed to add employee. Please try again.' };
    }
};

// Company Profile Functions
export const getCompanyProfile = async (): Promise<CompanyProfile | null> => {
    try {
        if (!currentCompanyId) return null;

        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('id', currentCompanyId)
            .maybeSingle();

        if (error || !data) return null;

        return {
            id: data.id,
            name: data.name,
            address: data.address || '',
            contactNumber: data.contact_number || '',
            email: data.email || '',
            tin: data.tin || '',
            logo: data.logo,
            workSchedule: data.work_schedule || WorkSchedule.MONDAY_TO_FRIDAY,
        };
    } catch (error) {
        console.error('Error fetching company profile:', error);
        return null;
    }
};

export const updateCompanyProfile = async (profile: CompanyProfile): Promise<CompanyProfile | null> => {
    try {
        if (!currentCompanyId) return null;

        const { data, error } = await supabase
            .from('companies')
            .update({
                name: profile.name,
                address: profile.address,
                contact_number: profile.contactNumber,
                email: profile.email,
                tin: profile.tin,
                logo: profile.logo,
                work_schedule: profile.workSchedule,
            })
            .eq('id', currentCompanyId)
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            address: data.address || '',
            contactNumber: data.contact_number || '',
            email: data.email || '',
            tin: data.tin || '',
            logo: data.logo,
            workSchedule: data.work_schedule || WorkSchedule.MONDAY_TO_FRIDAY,
        };
    } catch (error) {
        console.error('Error updating company profile:', error);
        return null;
    }
};

export const clearAllData = (): void => {
    // This is a stub function for compatibility
    // In a real implementation, this would delete all data for the current company
    console.warn('clearAllData is not implemented for Supabase yet');
};

// Placeholder functions for compatibility
// These should be implemented based on your needs
export const getShifts = async (): Promise<Shift[]> => {
    try {
        const { data, error } = await supabase
            .from('shifts')
            .select('*');

        if (error) throw error;
        return (data || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            startTime: s.start_time,
            endTime: s.end_time,
        }));
    } catch (error) {
        console.error('Error fetching shifts:', error);
        return [];
    }
};

export const getHolidays = async (): Promise<Holiday[]> => {
    try {
        const { data, error } = await supabase
            .from('holidays')
            .select('*')
            .order('date', { ascending: true });

        if (error) throw error;
        return (data || []).map((h: any) => ({
            id: h.id,
            name: h.name,
            date: h.date,
            country: h.country || 'PH',
            type: h.holiday_type || 'Regular',
        }));
    } catch (error) {
        console.error('Error fetching holidays:', error);
        return [];
    }
};

export const getRequests = async (): Promise<AppRequest[]> => {
    try {
        const { data, error } = await supabase
            .from('requests')
            .select('*')
            .order('date_filed', { ascending: false });

        if (error) throw error;
        return (data || []).map((r: any) => ({
            id: r.id,
            employeeId: r.employee_id,
            type: r.request_type,
            status: r.status,
            dateFiled: r.date_filed,
            leaveType: r.leave_type,
            startDate: r.start_date,
            endDate: r.end_date,
            date: r.date,
            hours: parseFloat(r.hours || 0),
            reason: r.reason,
            changes: r.changes,
        })) as AppRequest[];
    } catch (error) {
        console.error('Error fetching requests:', error);
        return [];
    }
};

export const getAttendance = async (): Promise<AttendanceRecord[]> => {
    try {
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .order('clock_in_time', { ascending: false });

        if (error) throw error;
        return (data || []).map((a: any) => ({
            id: a.id,
            employeeId: a.employee_id,
            clockInTime: a.clock_in_time,
            clockInPhoto: a.clock_in_photo,
            clockInLocation: a.clock_in_location,
            clockOutTime: a.clock_out_time,
            clockOutPhoto: a.clock_out_photo,
            clockOutLocation: a.clock_out_location,
            endOfDayNotes: a.end_of_day_notes,
            manualEntryReason: a.manual_entry_reason,
        }));
    } catch (error) {
        console.error('Error fetching attendance:', error);
        return [];
    }
};

export const getTodaysAttendance = async (employeeId: string): Promise<AttendanceRecord | undefined> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('clock_in_time', `${today}T00:00:00`)
            .lt('clock_in_time', `${today}T23:59:59`)
            .maybeSingle();

        if (error || !data) return undefined;
        return {
            id: data.id,
            employeeId: data.employee_id,
            clockInTime: data.clock_in_time,
            clockInPhoto: data.clock_in_photo,
            clockInLocation: data.clock_in_location,
            clockOutTime: data.clock_out_time,
            clockOutPhoto: data.clock_out_photo,
            clockOutLocation: data.clock_out_location,
            endOfDayNotes: data.end_of_day_notes,
            manualEntryReason: data.manual_entry_reason,
        };
    } catch (error) {
        console.error('Error fetching today\'s attendance:', error);
        return undefined;
    }
};

export const clockIn = async (record: Omit<AttendanceRecord, 'id'>): Promise<AttendanceRecord> => {
    if (!currentCompanyId) throw new Error('No company context');

    const { data, error } = await supabase
        .from('attendance_records')
        .insert([{
            company_id: currentCompanyId,
            employee_id: record.employeeId,
            clock_in_time: record.clockInTime,
            clock_in_photo: record.clockInPhoto,
            clock_in_location: record.clockInLocation,
        }])
        .select()
        .single();

    if (error) throw error;
    return {
        id: data.id,
        employeeId: data.employee_id,
        clockInTime: data.clock_in_time,
        clockInPhoto: data.clock_in_photo,
        clockInLocation: data.clock_in_location,
        clockOutTime: data.clock_out_time,
        clockOutPhoto: data.clock_out_photo,
        clockOutLocation: data.clock_out_location,
    };
};

export const clockOut = async (
    employeeId: string,
    clockOutData: {
        clockOutPhoto: string;
        clockOutLocation: { latitude: number; longitude: number };
        endOfDayNotes?: string;
    }
): Promise<AttendanceRecord | undefined> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data: record, error: fetchError } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('clock_in_time', `${today}T00:00:00`)
            .is('clock_out_time', null)
            .maybeSingle();

        if (fetchError || !record) return undefined;

        const { data, error } = await supabase
            .from('attendance_records')
            .update({
                clock_out_time: new Date().toISOString(),
                clock_out_photo: clockOutData.clockOutPhoto,
                clock_out_location: clockOutData.clockOutLocation,
                end_of_day_notes: clockOutData.endOfDayNotes,
            })
            .eq('id', record.id)
            .select()
            .single();

        if (error) throw error;
        return {
            id: data.id,
            employeeId: data.employee_id,
            clockInTime: data.clock_in_time,
            clockInPhoto: data.clock_in_photo,
            clockInLocation: data.clock_in_location,
            clockOutTime: data.clock_out_time,
            clockOutPhoto: data.clock_out_photo,
            clockOutLocation: data.clock_out_location,
            endOfDayNotes: data.end_of_day_notes,
        };
    } catch (error) {
        console.error('Error clocking out:', error);
        return undefined;
    }
};

// Leave balance calculation
export const calculateLeaveBalance = async (employeeId: string): Promise<LeaveBalance> => {
    try {
        const employee = await getEmployeeById(employeeId);
        if (!employee) {
            return {
                vacation: { accrued: 0, used: 0, available: 0 },
                sick: { accrued: 0, used: 0, available: 0 }
            };
        }

        // Get leave policy
        const { data: policyData } = await supabase
            .from('leave_policies')
            .select('*')
            .eq('company_id', currentCompanyId)
            .maybeSingle();

        const policy = policyData || {
            base_vacation_days_per_year: 15,
            base_sick_days_per_year: 10,
            tenure_bonus_enabled: true,
            tenure_bonus_years_interval: 2,
            max_tenure_bonus_days: 5,
        };

        const yearsOfService = (new Date().getTime() - new Date(employee.dateHired).getTime()) / (1000 * 60 * 60 * 24 * 365);

        let tenureBonus = 0;
        if (policy.tenure_bonus_enabled) {
            tenureBonus = Math.floor(yearsOfService / policy.tenure_bonus_years_interval);
            if (tenureBonus > policy.max_tenure_bonus_days) {
                tenureBonus = policy.max_tenure_bonus_days;
            }
        }

        // Pro-rate based on current day of the year
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        const today = new Date();
        const dayOfYear = ((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const yearFraction = dayOfYear / 365;

        const accruedVacation = (policy.base_vacation_days_per_year + tenureBonus) * yearFraction;
        const accruedSick = policy.base_sick_days_per_year * yearFraction;

        // Get approved leave requests
        const { data: requests } = await supabase
            .from('requests')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('request_type', RequestType.LEAVE)
            .eq('status', RequestStatus.APPROVED);

        let usedVacation = 0;
        let usedSick = 0;

        (requests || []).forEach((req: any) => {
            const duration = (new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 3600 * 24) + 1;
            if (req.leave_type === LeaveType.VACATION || req.leave_type === LeaveType.CLIENT_HOLIDAY || req.leave_type === LeaveType.EMERGENCY) {
                usedVacation += duration;
            } else if (req.leave_type === LeaveType.SICK) {
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
        };
    } catch (error) {
        console.error('Error calculating leave balance:', error);
        return {
            vacation: { accrued: 0, used: 0, available: 0 },
            sick: { accrued: 0, used: 0, available: 0 }
        };
    }
};

// Task functions
export const getTasks = (): Task[] => {
    // TODO: Implement with Supabase
    return [];
};

export const getTasksForEmployee = async (employeeId: string): Promise<Task[]> => {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('employee_id', employeeId)
            .order('due_date', { ascending: true });

        if (error) throw error;
        return (data || []).map((t: any) => ({
            id: t.id,
            employeeId: t.employee_id,
            title: t.title,
            description: t.description || '',
            dueDate: t.due_date,
            status: t.status || TaskStatus.TODO,
            dateCreated: t.date_created,
            dateCompleted: t.date_completed,
        }));
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return [];
    }
};

export const updateTask = async (task: Task): Promise<Task> => {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .update({
                title: task.title,
                description: task.description,
                due_date: task.dueDate,
                status: task.status,
                date_completed: task.dateCompleted,
            })
            .eq('id', task.id)
            .select()
            .single();

        if (error) throw error;
        return {
            id: data.id,
            employeeId: data.employee_id,
            title: data.title,
            description: data.description || '',
            dueDate: data.due_date,
            status: data.status || TaskStatus.TODO,
            dateCreated: data.date_created,
            dateCompleted: data.date_completed,
        };
    } catch (error) {
        console.error('Error updating task:', error);
        throw error;
    }
};

// Export the WORKLOGIX_LOGO_BASE64 for compatibility
export { WORKLOGIX_LOGO_BASE64 } from './mockApi';

// Note: This is a starter implementation. You'll need to implement additional functions
// based on your application's needs. The key functions for authentication and basic
// employee management are provided above.
