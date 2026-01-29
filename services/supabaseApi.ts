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
    TaskStatus,
    LeavePolicy,
    CustomFieldDefinition,
    EmployeeStatus,
    EmploymentType,
    RequestStatus,
    RequestType,
    LeaveType,
    LeaveBalance,
    WorkSchedule,
    AuditLog,
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

export const setCurrentCompanyId = (companyId: string) => {
    currentCompanyId = companyId;
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

// Public function to initialize company context by company code
export const initializeCompanyContext = async (companyCode: string): Promise<boolean> => {
    try {
        const company = await getCompanyByCode(companyCode);
        if (company) {
            currentCompanyId = company.id;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error initializing company context:', error);
        return false;
    }
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
        companyId: dbEmployee.company_id,
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
        const defaultPassword = 'qwerty123';
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

export const updateEmployee = async (updatedEmployee: Employee, editorId: string): Promise<Employee> => {
    try {
        if (!currentCompanyId) {
            throw new Error('Company not found. Please log in again.');
        }

        // Get original employee for audit logging
        const originalEmployee = await getEmployeeById(updatedEmployee.id);

        // Update employee record
        const { data, error } = await supabase
            .from('employees')
            .update({
                employee_id: updatedEmployee.employeeId,
                email: updatedEmployee.email,
                first_name: updatedEmployee.firstName,
                middle_name: updatedEmployee.middleName,
                last_name: updatedEmployee.lastName,
                address: updatedEmployee.address,
                birthdate: updatedEmployee.birthdate || null,
                mobile_number: updatedEmployee.mobileNumber,
                department: updatedEmployee.department,
                tin_number: updatedEmployee.tinNumber,
                sss_number: updatedEmployee.sssNumber,
                pagibig_number: updatedEmployee.pagibigNumber,
                philhealth_number: updatedEmployee.philhealthNumber,
                date_hired: updatedEmployee.dateHired,
                date_terminated: updatedEmployee.dateTerminated || null,
                status: updatedEmployee.status,
                employment_type: updatedEmployee.employmentType,
                shift_id: updatedEmployee.shiftId || null,
                work_schedule: updatedEmployee.workSchedule,
                profile_picture: updatedEmployee.profilePicture,
                vacation_leave_adjustment: updatedEmployee.vacationLeaveAdjustment || 0,
                sick_leave_adjustment: updatedEmployee.sickLeaveAdjustment || 0,
                custom_fields: updatedEmployee.customFields || {},
                updated_at: new Date().toISOString(),
            })
            .eq('id', updatedEmployee.id)
            .select()
            .single();

        if (error) throw error;

        // Create audit log if original employee exists
        if (originalEmployee) {
            const changes: any[] = [];
            const auditFields: (keyof Employee)[] = [
                'employeeId', 'email', 'firstName', 'middleName', 'lastName', 'address',
                'birthdate', 'mobileNumber', 'department', 'tinNumber', 'sssNumber',
                'pagibigNumber', 'philhealthNumber', 'dateHired', 'dateTerminated',
                'status', 'employmentType', 'shiftId', 'workSchedule'
            ];

            auditFields.forEach(field => {
                const oldValue = String(originalEmployee[field] ?? '');
                const newValue = String(updatedEmployee[field] ?? '');
                if (oldValue !== newValue) {
                    changes.push({ field, oldValue, newValue });
                }
            });

            if (changes.length > 0) {
                await supabase
                    .from('audit_logs')
                    .insert({
                        company_id: currentCompanyId,
                        employee_id: updatedEmployee.id,
                        editor_id: editorId,
                        changes,
                    });
            }
        }

        // Handle salary history updates
        if (updatedEmployee.salaryHistory && updatedEmployee.salaryHistory.length > 0) {
            const latestSalary = updatedEmployee.salaryHistory[0];
            const originalLatest = originalEmployee?.salaryHistory?.[0];

            // Check if this is a new salary entry
            if (!originalLatest ||
                latestSalary.effectiveDate !== originalLatest.effectiveDate ||
                latestSalary.basicSalary !== originalLatest.basicSalary) {
                await supabase
                    .from('salary_history')
                    .insert({
                        employee_id: updatedEmployee.id,
                        effective_date: latestSalary.effectiveDate,
                        basic_salary: latestSalary.basicSalary,
                        allowance: latestSalary.allowance || 0,
                        other_benefits: latestSalary.otherBenefits || 0,
                    });
            }
        }

        return await convertDbEmployeeToEmployee(data);
    } catch (error: any) {
        console.error('Error updating employee:', error);
        throw error;
    }
};

export const deleteEmployee = async (employeeId: string): Promise<void> => {
    try {
        // Delete user account first (due to foreign key constraint)
        await supabase
            .from('user_accounts')
            .delete()
            .eq('employee_id', employeeId);

        // Delete employee record (cascading deletes will handle related records)
        const { error } = await supabase
            .from('employees')
            .delete()
            .eq('id', employeeId);

        if (error) throw error;
    } catch (error: any) {
        console.error('Error deleting employee:', error);
        throw error;
    }
};

export const bulkDeleteEmployees = async (employeeIds: string[]): Promise<void> => {
    try {
        // Delete all at once
        await Promise.all(employeeIds.map(id => deleteEmployee(id)));
    } catch (error: any) {
        console.error('Error bulk deleting employees:', error);
        throw error;
    }
};

export const bulkImportEmployees = async (csvData: string): Promise<{ successCount: number, errorCount: number, errors: string[] }> => {
    try {
        if (!currentCompanyId) {
            return { successCount: 0, errorCount: 1, errors: ['Company not found. Please log in again.'] };
        }

        const lines = csvData.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            return { successCount: 0, errorCount: 1, errors: ['CSV file is empty or has no data rows.'] };
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const requiredHeaders = ['firstName', 'lastName', 'email'];
        for (const required of requiredHeaders) {
            if (!headers.includes(required)) {
                return { successCount: 0, errorCount: 1, errors: [`Missing required header: ${required}`] };
            }
        }

        const results = { successCount: 0, errorCount: 0, errors: [] as string[] };
        const defaultPassword = 'qwerty123';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

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

            // Check if email already exists
            const { data: existingAccount } = await supabase
                .from('user_accounts')
                .select('email')
                .eq('company_id', currentCompanyId)
                .eq('email', entry.email)
                .maybeSingle();

            if (existingAccount) {
                results.errorCount++;
                results.errors.push(`Row ${i + 1}: Email ${entry.email} already exists.`);
                continue;
            }

            try {
                // Generate employee ID
                const generatedEmployeeId = `emp${Date.now()}_${i}`;

                // Create employee record
                const { data: newEmployee, error: employeeError } = await supabase
                    .from('employees')
                    .insert([{
                        company_id: currentCompanyId,
                        employee_id: generatedEmployeeId,
                        email: entry.email,
                        first_name: entry.firstName || '',
                        middle_name: entry.middleName || null,
                        last_name: entry.lastName || '',
                        department: entry.department || '',
                        address: entry.address || null,
                        mobile_number: entry.mobileNumber || null,
                        date_hired: entry.dateHired || new Date().toISOString().split('T')[0],
                        status: EmployeeStatus.ACTIVE,
                        employment_type: entry.employmentType || EmploymentType.PROBATIONARY,
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
                        email: entry.email,
                        password_hash: passwordHash,
                        role: UserRole.EMPLOYEE,
                    }]);

                if (accountError) throw accountError;

                results.successCount++;
            } catch (error: any) {
                results.errorCount++;
                results.errors.push(`Row ${i + 1}: ${error.message}`);
            }
        }

        return results;
    } catch (error: any) {
        console.error('Error bulk importing employees:', error);
        return { successCount: 0, errorCount: 1, errors: [error.message] };
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

export const addRequest = async (requestData: Omit<AppRequest, 'id' | 'status' | 'dateFiled'>): Promise<AppRequest> => {
    try {
        if (!currentCompanyId) {
            throw new Error('Company context not set');
        }

        const { data, error } = await supabase
            .from('requests')
            .insert([{
                company_id: currentCompanyId,
                employee_id: requestData.employeeId,
                request_type: requestData.type,
                status: RequestStatus.PENDING,
                date_filed: new Date().toISOString(),
                leave_type: requestData.leaveType,
                start_date: requestData.startDate,
                end_date: requestData.endDate,
                date: requestData.date,
                hours: requestData.hours,
                reason: requestData.reason,
                changes: requestData.changes,
            }])
            .select()
            .single();

        if (error) throw error;
        return {
            id: data.id,
            employeeId: data.employee_id,
            type: data.request_type,
            status: data.status,
            dateFiled: data.date_filed,
            leaveType: data.leave_type,
            startDate: data.start_date,
            endDate: data.end_date,
            date: data.date,
            hours: parseFloat(data.hours || 0),
            reason: data.reason,
            changes: data.changes,
        };
    } catch (error) {
        console.error('Error adding request:', error);
        throw error;
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
            .gte('clock_in_time', `${today}T00:00:00Z`)
            .lte('clock_in_time', `${today}T23:59:59Z`)
            .order('clock_in_time', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error fetching today\'s attendance:', error);
            return undefined;
        }

        if (!data) return undefined;

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

export const clockIn = async (record: Omit<AttendanceRecord, 'id'>, companyId: string): Promise<AttendanceRecord> => {
    // Check if already clocked in today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('employee_id', record.employeeId)
        .gte('clock_in_time', `${today}T00:00:00Z`)
        .lte('clock_in_time', `${today}T23:59:59Z`)
        .maybeSingle();

    if (existingRecord) {
        throw new Error('You have already clocked in today.');
    }

    const { data, error } = await supabase
        .from('attendance_records')
        .insert([{
            company_id: companyId,
            employee_id: record.employeeId,
            clock_in_time: record.clockInTime,
            clock_in_photo: record.clockInPhoto,
            clock_in_location: record.clockInLocation,
        }])
        .select()
        .single();

    if (error) {
        console.error('Clock in error:', error);
        throw error;
    }
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
        clockOutLocation: { latitude: number; longitude: number; accuracy?: number };
        endOfDayNotes?: string;
    }
): Promise<AttendanceRecord | undefined> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data: record, error: fetchError } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('clock_in_time', `${today}T00:00:00Z`)
            .lte('clock_in_time', `${today}T23:59:59Z`)
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

export const addTask = async (taskData: Omit<Task, 'id'>): Promise<Task> => {
    try {
        if (!currentCompanyId) {
            throw new Error('Company context not set');
        }

        const { data, error } = await supabase
            .from('tasks')
            .insert([{
                company_id: currentCompanyId,
                employee_id: taskData.employeeId,
                title: taskData.title,
                description: taskData.description,
                due_date: taskData.dueDate,
                status: taskData.status || TaskStatus.TODO,
                date_created: taskData.dateCreated || new Date().toISOString(),
                date_completed: taskData.dateCompleted,
            }])
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
        console.error('Error adding task:', error);
        throw error;
    }
};

export const addHoliday = async (holiday: Omit<Holiday, 'id'>): Promise<Holiday> => {
    console.warn('addHoliday: Not yet implemented in Supabase');
    return { ...holiday, id: 'temp-id' };
};

export const changePassword = (employeeId: string, currentPassword: string, newPassword: string): { success: boolean, message: string } => {
    console.warn('changePassword: Not yet implemented in Supabase');
    return { success: false, message: 'Password change not yet implemented' };
};

export const getCustomFieldDefinitions = async (): Promise<CustomFieldDefinition[]> => {
    console.warn('getCustomFieldDefinitions: Not yet implemented in Supabase');
    return [];
};

export const updateProfilePicture = async (employeeId: string, base64Image: string): Promise<void> => {
    console.warn('updateProfilePicture: Not yet implemented in Supabase');
};

export const updateRequestStatus = async (requestId: string, status: RequestStatus, editorId: string): Promise<AppRequest | undefined> => {
    try {
        const { data: request, error: fetchError } = await supabase
            .from('requests')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();

        if (fetchError || !request) {
            console.error('Error fetching request:', fetchError);
            return undefined;
        }

        const { data, error } = await supabase
            .from('requests')
            .update({ status })
            .eq('id', requestId)
            .select()
            .single();

        if (error) {
            console.error('Error updating request status:', error);
            return undefined;
        }

        if (status === RequestStatus.APPROVED && request.request_type === RequestType.CHANGE_REQUEST && request.changes) {
            const updateData: any = {};
            Object.entries(request.changes).forEach(([key, value]) => {
                const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                updateData[snakeKey] = value;
            });

            const { error: employeeUpdateError } = await supabase
                .from('employees')
                .update(updateData)
                .eq('id', request.employee_id);

            if (employeeUpdateError) {
                console.error('Error updating employee:', employeeUpdateError);
            }
        }

        return {
            id: data.id,
            employeeId: data.employee_id,
            type: data.request_type,
            status: data.status,
            dateFiled: data.date_filed,
            leaveType: data.leave_type,
            startDate: data.start_date,
            endDate: data.end_date,
            date: data.date,
            hours: parseFloat(data.hours || 0),
            reason: data.reason,
            changes: data.changes,
        } as AppRequest;
    } catch (error) {
        console.error('Error in updateRequestStatus:', error);
        return undefined;
    }
};

export const resetEmployeePassword = (employeeId: string, newPassword: string): { success: boolean, message: string } => {
    console.warn('resetEmployeePassword: Not yet implemented in Supabase');
    return { success: false, message: 'Password reset not yet implemented' };
};

export const adjustLeaveBalance = (employeeId: string, leaveType: string, days: number, reason: string, adjustedBy: string): void => {
    console.warn('adjustLeaveBalance: Not yet implemented in Supabase');
};

export const getAuditLogsForEmployee = async (employeeId: string): Promise<AuditLog[]> => {
    console.warn('getAuditLogsForEmployee: Not yet implemented in Supabase');
    return [];
};

export const bulkInviteEmployees = async (csvData: string): Promise<{ successCount: number, errors: string[] }> => {
    console.warn('bulkInviteEmployees: Not yet implemented in Supabase');
    return { successCount: 0, errors: ['Bulk invite not yet implemented'] };
};

export const updateAttendance = async (record: AttendanceRecord): Promise<void> => {
    console.warn('updateAttendance: Not yet implemented in Supabase');
};

export const addManualAttendance = async (record: Omit<AttendanceRecord, 'id'>, reason: string, addedBy: string): Promise<void> => {
    console.warn('addManualAttendance: Not yet implemented in Supabase');
};

export const calculatePayrollSummary = (attendance: AttendanceRecord[], employees: Employee[], shifts: Shift[], startDate: string, endDate: string): any => {
    console.warn('calculatePayrollSummary: Not yet implemented in Supabase');
    return { employees: [], totalPayroll: 0 };
};

export const processPayrollAndNotify = async (payrollData: any): Promise<void> => {
    console.warn('processPayrollAndNotify: Not yet implemented in Supabase');
};

export const deleteShift = async (shiftId: string): Promise<void> => {
    console.warn('deleteShift: Not yet implemented in Supabase');
};

export const updateShift = async (shift: Shift): Promise<Shift> => {
    console.warn('updateShift: Not yet implemented in Supabase');
    return shift;
};

export const addShift = async (shift: Omit<Shift, 'id'>): Promise<Shift> => {
    console.warn('addShift: Not yet implemented in Supabase');
    return { ...shift, id: 'temp-id' };
};

export const getLeavePolicy = async (): Promise<LeavePolicy | undefined> => {
    console.warn('getLeavePolicy: Not yet implemented in Supabase');
    return undefined;
};

export const updateLeavePolicy = async (policy: LeavePolicy): Promise<void> => {
    console.warn('updateLeavePolicy: Not yet implemented in Supabase');
};

export const deleteCustomFieldDefinition = async (defId: string): Promise<void> => {
    console.warn('deleteCustomFieldDefinition: Not yet implemented in Supabase');
};

export const updateCustomFieldDefinition = async (def: CustomFieldDefinition): Promise<void> => {
    console.warn('updateCustomFieldDefinition: Not yet implemented in Supabase');
};

export const addCustomFieldDefinition = async (def: Omit<CustomFieldDefinition, 'id'>): Promise<CustomFieldDefinition> => {
    console.warn('addCustomFieldDefinition: Not yet implemented in Supabase');
    return { ...def, id: 'temp-id' };
};

export const requestPasswordReminder = async (email: string): Promise<{ success: boolean, message: string }> => {
    console.warn('requestPasswordReminder: Not yet implemented in Supabase');
    return { success: false, message: 'Password reminder not yet implemented' };
};

// Export the WORKLOGIX_LOGO_BASE64 for compatibility
export { WORKLOGIX_LOGO_BASE64 } from './mockApi';

// Note: This is a starter implementation. You'll need to implement additional functions
// based on your application's needs. The key functions for authentication and basic
// employee management are provided above.
