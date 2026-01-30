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
    EmployeeFile,
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
        console.warn('set_config RPC not available, RLS may not work correctly');
    }
};

const ensureUserContext = async () => {
    if (currentUserEmail) {
        try {
            await supabase.rpc('set_config', {
                setting_name: 'app.current_user_email',
                setting_value: currentUserEmail
            } as any);
        } catch (error) {
            console.warn('Failed to set user context for RLS');
        }
    }
};

const generateNextEmployeeId = async (companyId: string): Promise<string> => {
    const { data: employees, error } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('company_id', companyId);

    if (error) {
        console.error('Error fetching employees for ID generation:', error);
        return 'EMP-00001';
    }

    if (!employees || employees.length === 0) {
        return 'EMP-00001';
    }

    const empIds = employees
        .map(emp => emp.employee_id)
        .filter(id => id && id.startsWith('EMP-'))
        .map(id => {
            const numPart = id.replace('EMP-', '');
            return parseInt(numPart, 10);
        })
        .filter(num => !isNaN(num));

    const maxId = empIds.length > 0 ? Math.max(...empIds) : 0;
    const nextId = maxId + 1;
    return `EMP-${String(nextId).padStart(5, '0')}`;
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

        // Generate employee ID
        const employeeId = await generateNextEmployeeId(newCompany.id);

        // Create employee record for the employer
        const { data: newEmployee, error: employeeError } = await supabase
            .from('employees')
            .insert([{
                company_id: newCompany.id,
                employee_id: employeeId,
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
        await ensureUserContext();
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
        await ensureUserContext();
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
        await ensureUserContext();
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
    shiftId?: string;
}): Promise<Employee | { error: string }> => {
    try {
        await ensureUserContext();
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

        // Generate sequential employee ID
        const generatedEmployeeId = await generateNextEmployeeId(currentCompanyId);

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
                shift_id: employeeData.shiftId || null,
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

        // Send invitation email
        try {
            const { data: company } = await supabase
                .from('companies')
                .select('name, company_code')
                .eq('id', currentCompanyId)
                .single();

            if (company) {
                const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation-email`;
                await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        employeeEmail: employeeData.email,
                        employeeName: `${employeeData.firstName} ${employeeData.lastName}`,
                        companyName: company.name,
                        companyCode: company.company_code,
                    }),
                });
            }
        } catch (emailError) {
            console.error('Failed to send invitation email:', emailError);
        }

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
        await ensureUserContext();
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
        await ensureUserContext();
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
        await ensureUserContext();
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
        await ensureUserContext();
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
        await ensureUserContext();
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
        await ensureUserContext();
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
        await ensureUserContext();
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
        await ensureUserContext();
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
        await ensureUserContext();
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
            status: a.status,
        }));
    } catch (error) {
        console.error('Error fetching attendance:', error);
        return [];
    }
};

export const getTodaysAttendance = async (employeeId: string): Promise<AttendanceRecord | undefined> => {
    try {
        await ensureUserContext();
        const today = new Date().toISOString().split('T')[0];

        // First, try to get an active session (not clocked out yet)
        const { data: activeSession } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('clock_in_time', `${today}T00:00:00Z`)
            .lte('clock_in_time', `${today}T23:59:59Z`)
            .is('clock_out_time', null)
            .order('clock_in_time', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (activeSession) {
            return {
                id: activeSession.id,
                employeeId: activeSession.employee_id,
                clockInTime: activeSession.clock_in_time,
                clockInPhoto: activeSession.clock_in_photo,
                clockInLocation: activeSession.clock_in_location,
                clockOutTime: activeSession.clock_out_time,
                clockOutPhoto: activeSession.clock_out_photo,
                clockOutLocation: activeSession.clock_out_location,
                endOfDayNotes: activeSession.end_of_day_notes,
                manualEntryReason: activeSession.manual_entry_reason,
                status: activeSession.status,
            };
        }

        // If no active session, get the most recent completed session
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
            status: data.status,
        };
    } catch (error) {
        console.error('Error fetching today\'s attendance:', error);
        return undefined;
    }
};

export const getTodaysAllAttendance = async (employeeId: string): Promise<AttendanceRecord[]> => {
    try {
        await ensureUserContext();
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('clock_in_time', `${today}T00:00:00Z`)
            .lte('clock_in_time', `${today}T23:59:59Z`)
            .order('clock_in_time', { ascending: true });

        if (error) {
            console.error('Error fetching all today\'s attendance:', error);
            return [];
        }

        return (data || []).map((record: any) => ({
            id: record.id,
            employeeId: record.employee_id,
            clockInTime: record.clock_in_time,
            clockInPhoto: record.clock_in_photo,
            clockInLocation: record.clock_in_location,
            clockOutTime: record.clock_out_time,
            clockOutPhoto: record.clock_out_photo,
            clockOutLocation: record.clock_out_location,
            endOfDayNotes: record.end_of_day_notes,
            manualEntryReason: record.manual_entry_reason,
            status: record.status,
        }));
    } catch (error) {
        console.error('Error fetching all today\'s attendance:', error);
        return [];
    }
};

export const clockIn = async (record: Omit<AttendanceRecord, 'id'>, companyId: string): Promise<AttendanceRecord> => {
    await ensureUserContext();
    const today = new Date().toISOString().split('T')[0];

    // Check if there's an active session (clocked in but not clocked out)
    const { data: activeSession } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('employee_id', record.employeeId)
        .gte('clock_in_time', `${today}T00:00:00Z`)
        .lte('clock_in_time', `${today}T23:59:59Z`)
        .is('clock_out_time', null)
        .maybeSingle();

    if (activeSession) {
        throw new Error('You have an active session. Please clock out before starting a new session.');
    }

    // Check if this is the first clock-in of the day
    const { data: todaySessions, error: sessionError } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('employee_id', record.employeeId)
        .gte('clock_in_time', `${today}T00:00:00Z`)
        .lte('clock_in_time', `${today}T23:59:59Z`);

    const isFirstClockIn = !todaySessions || todaySessions.length === 0;
    let status: 'On Time' | 'Late' | undefined = undefined;

    // Calculate status only for first clock-in
    if (isFirstClockIn) {
        // Get employee's shift information
        const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('shift_id')
            .eq('id', record.employeeId)
            .maybeSingle();

        if (!empError && employee && employee.shift_id) {
            const { data: shift, error: shiftError } = await supabase
                .from('shifts')
                .select('start_time')
                .eq('id', employee.shift_id)
                .maybeSingle();

            if (!shiftError && shift && shift.start_time) {
                // Parse clock-in time and shift start time
                const clockInTime = new Date(record.clockInTime);
                const clockInHours = clockInTime.getHours();
                const clockInMinutes = clockInTime.getMinutes();

                const [shiftHours, shiftMinutes] = shift.start_time.split(':').map(Number);

                // Calculate total minutes for comparison
                const clockInTotalMinutes = clockInHours * 60 + clockInMinutes;
                const shiftTotalMinutes = shiftHours * 60 + shiftMinutes;

                // Consider on time if within 5 minutes of shift start
                status = clockInTotalMinutes <= (shiftTotalMinutes + 5) ? 'On Time' : 'Late';
            }
        }
    }

    const { data, error } = await supabase
        .from('attendance_records')
        .insert([{
            company_id: companyId,
            employee_id: record.employeeId,
            clock_in_time: record.clockInTime,
            clock_in_photo: record.clockInPhoto,
            clock_in_location: record.clockInLocation,
            status: status,
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
        status: data.status,
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
        await ensureUserContext();
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
            status: data.status,
        };
    } catch (error) {
        console.error('Error clocking out:', error);
        return undefined;
    }
};

// Leave balance calculation
export const calculateLeaveBalance = async (employeeId: string): Promise<LeaveBalance> => {
    try {
        await ensureUserContext();
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
        await ensureUserContext();
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
        await ensureUserContext();
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
        await ensureUserContext();
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
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            throw new Error('Company context not set');
        }

        const { data, error } = await supabase
            .from('holidays')
            .insert([{
                company_id: currentCompanyId,
                name: holiday.name,
                date: holiday.date,
                country: holiday.country || 'PH',
                holiday_type: holiday.type || 'Regular',
            }])
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            date: data.date,
            country: data.country || 'PH',
            type: data.holiday_type || 'Regular',
        };
    } catch (error) {
        console.error('Error adding holiday:', error);
        throw error;
    }
};

export const changePassword = (employeeId: string, currentPassword: string, newPassword: string): { success: boolean, message: string } => {
    console.warn('changePassword: Not yet implemented in Supabase');
    return { success: false, message: 'Password change not yet implemented' };
};

export const getCustomFieldDefinitions = async (): Promise<CustomFieldDefinition[]> => {
    try {
        if (!currentCompanyId) {
            console.error('No company ID set');
            return [];
        }

        await ensureUserContext();
        const { data, error } = await supabase
            .from('custom_field_definitions')
            .select('*')
            .eq('company_id', currentCompanyId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching custom field definitions:', error);
            return [];
        }

        return (data || []).map(field => ({
            id: field.id,
            name: field.name,
            type: field.field_type as CustomFieldType,
            options: field.options || undefined,
        }));
    } catch (error) {
        console.error('Error in getCustomFieldDefinitions:', error);
        return [];
    }
};

export const updateProfilePicture = async (employeeId: string, base64Image: string): Promise<void> => {
    console.warn('updateProfilePicture: Not yet implemented in Supabase');
};

export const updateRequestStatus = async (requestId: string, status: RequestStatus, editorId: string): Promise<AppRequest | undefined> => {
    try {
        await ensureUserContext();
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

        if (status === RequestStatus.APPROVED && data.request_type === RequestType.CHANGE_REQUEST && data.changes) {
            const updateData: any = {};
            Object.entries(data.changes).forEach(([key, value]) => {
                const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                updateData[snakeKey] = value;
            });

            const { error: employeeUpdateError } = await supabase
                .from('employees')
                .update(updateData)
                .eq('id', data.employee_id);

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

export const adjustLeaveBalance = async (employeeId: string, adjustments: { vacation: number; sick: number }, reason: string, adjustedBy: string): Promise<void> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            throw new Error('Company not found. Please log in again.');
        }

        // Get current employee data
        const employee = await getEmployeeById(employeeId);
        if (!employee) {
            throw new Error('Employee not found');
        }

        // Calculate new adjustments (cumulative)
        const currentVacAdj = employee.vacationLeaveAdjustment || 0;
        const currentSickAdj = employee.sickLeaveAdjustment || 0;
        const newVacAdj = currentVacAdj + adjustments.vacation;
        const newSickAdj = currentSickAdj + adjustments.sick;

        // Update employee record with new adjustments
        const { error } = await supabase
            .from('employees')
            .update({
                vacation_leave_adjustment: newVacAdj,
                sick_leave_adjustment: newSickAdj,
                updated_at: new Date().toISOString(),
            })
            .eq('id', employeeId);

        if (error) throw error;

        // Create audit log entry
        await supabase
            .from('audit_logs')
            .insert({
                company_id: currentCompanyId,
                employee_id: employeeId,
                editor_id: adjustedBy,
                changes: [
                    {
                        field: 'Leave Balance Adjustment',
                        oldValue: `Vacation: ${currentVacAdj}, Sick: ${currentSickAdj}`,
                        newValue: `Vacation: ${newVacAdj} (+${adjustments.vacation}), Sick: ${newSickAdj} (+${adjustments.sick})`,
                        reason: reason,
                    }
                ],
            });
    } catch (error) {
        console.error('Error adjusting leave balance:', error);
        throw error;
    }
};

export const getAuditLogsForEmployee = async (employeeId: string): Promise<AuditLog[]> => {
    console.warn('getAuditLogsForEmployee: Not yet implemented in Supabase');
    return [];
};

export const bulkInviteEmployees = async (csvData: string): Promise<{ successCount: number, errors: string[] }> => {
    console.warn('bulkInviteEmployees: Not yet implemented in Supabase');
    return { successCount: 0, errors: ['Bulk invite not yet implemented'] };
};

export const updateAttendance = async (record: AttendanceRecord, reason: string, editorId: string): Promise<void> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            throw new Error('Company not found. Please log in again.');
        }

        const { error } = await supabase
            .from('attendance_records')
            .update({
                clock_in_time: record.clockInTime,
                clock_out_time: record.clockOutTime || null,
                clock_in_photo: record.clockInPhoto || null,
                clock_in_location: record.clockInLocation || null,
                clock_out_photo: record.clockOutPhoto || null,
                clock_out_location: record.clockOutLocation || null,
                end_of_day_notes: record.endOfDayNotes || null,
                manual_entry_reason: reason,
            })
            .eq('id', record.id);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating attendance:', error);
        throw error;
    }
};

export const addManualAttendance = async (record: Omit<AttendanceRecord, 'id'>, reason: string, addedBy: string): Promise<void> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            throw new Error('Company not found. Please log in again.');
        }

        const { error } = await supabase
            .from('attendance_records')
            .insert([{
                company_id: currentCompanyId,
                employee_id: record.employeeId,
                clock_in_time: record.clockInTime,
                clock_out_time: record.clockOutTime || null,
                clock_in_photo: record.clockInPhoto || null,
                clock_in_location: record.clockInLocation || null,
                clock_out_photo: record.clockOutPhoto || null,
                clock_out_location: record.clockOutLocation || null,
                end_of_day_notes: record.endOfDayNotes || null,
                manual_entry_reason: reason,
            }]);

        if (error) throw error;
    } catch (error) {
        console.error('Error adding manual attendance:', error);
        throw error;
    }
};

export const calculatePayrollSummary = async (startDate: string, endDate: string): Promise<any[]> => {
    try {
        const [attendance, employees, requests] = await Promise.all([
            getAttendance(),
            getEmployees(),
            getRequests(),
        ]);

        const filteredAttendance = attendance.filter(record => {
            const recordDate = record.clockInTime.split('T')[0];
            return recordDate >= startDate && recordDate <= endDate;
        });

        const filteredRequests = requests.filter(req => {
            if (req.type === RequestType.LEAVE) {
                return !(new Date(req.endDate) < new Date(startDate) || new Date(req.startDate) > new Date(endDate));
            }
            if (req.type === RequestType.OVERTIME || req.type === RequestType.UNDERTIME) {
                return req.date >= startDate && req.date <= endDate;
            }
            return false;
        });

        const summary = employees.map(emp => {
            const empAttendance = filteredAttendance.filter(a => a.employeeId === emp.id);
            const empRequests = filteredRequests.filter(r => r.employeeId === emp.id);

            let totalHours = 0;
            let otHours = 0;
            let leaveDays = 0;

            empAttendance.forEach(record => {
                if (record.clockOutTime) {
                    const clockIn = new Date(record.clockInTime);
                    const clockOut = new Date(record.clockOutTime);
                    const diffMs = clockOut.getTime() - clockIn.getTime();
                    totalHours += diffMs / (1000 * 60 * 60);
                }
            });

            empRequests.forEach(req => {
                if (req.type === RequestType.OVERTIME && req.status === RequestStatus.APPROVED) {
                    otHours += req.hours;
                    totalHours += req.hours;
                } else if (req.type === RequestType.LEAVE && req.status === RequestStatus.APPROVED) {
                    const start = new Date(req.startDate + 'T00:00:00');
                    const end = new Date(req.endDate + 'T00:00:00');
                    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    leaveDays += days;
                    totalHours += days * 8;
                }
            });

            const latestSalary = emp.salaryHistory.length > 0
                ? emp.salaryHistory.sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())[0]
                : null;

            let grossPay = '0';
            if (latestSalary) {
                const monthlySalary = latestSalary.basicSalary + (latestSalary.allowance || 0) + (latestSalary.otherBenefits || 0);
                const hourlyRate = monthlySalary / 160;
                const regularPay = (totalHours - otHours) * hourlyRate;
                const overtimePay = otHours * hourlyRate * 1.5;
                grossPay = (regularPay + overtimePay).toFixed(2);
            }

            return {
                employeeId: emp.id,
                employeeName: `${emp.firstName} ${emp.lastName}`,
                employeeEmail: emp.email,
                totalHours: totalHours.toFixed(2),
                otHours: otHours.toFixed(2),
                leaveDays,
                grossPay,
            };
        });

        return summary;
    } catch (error) {
        console.error('Error calculating payroll summary:', error);
        return [];
    }
};

export const processPayrollAndNotify = async (payrollData: any): Promise<void> => {
    console.warn('processPayrollAndNotify: Not yet implemented in Supabase');
};

export const deleteShift = async (shiftId: string): Promise<void> => {
    try {
        await ensureUserContext();
        const { error } = await supabase
            .from('shifts')
            .delete()
            .eq('id', shiftId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting shift:', error);
        throw error;
    }
};

export const updateShift = async (shift: Shift): Promise<Shift> => {
    try {
        await ensureUserContext();
        const { data, error } = await supabase
            .from('shifts')
            .update({
                name: shift.name,
                start_time: shift.startTime,
                end_time: shift.endTime,
            })
            .eq('id', shift.id)
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            startTime: data.start_time,
            endTime: data.end_time,
        };
    } catch (error) {
        console.error('Error updating shift:', error);
        throw error;
    }
};

export const addShift = async (shift: Omit<Shift, 'id'>): Promise<Shift> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            throw new Error('Company context not set');
        }

        const { data, error } = await supabase
            .from('shifts')
            .insert([{
                company_id: currentCompanyId,
                name: shift.name,
                start_time: shift.startTime,
                end_time: shift.endTime,
            }])
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            startTime: data.start_time,
            endTime: data.end_time,
        };
    } catch (error) {
        console.error('Error adding shift:', error);
        throw error;
    }
};

export const getLeavePolicy = async (): Promise<LeavePolicy | undefined> => {
    try {
        if (!currentCompanyId) {
            console.error('No company ID set');
            return undefined;
        }

        await ensureUserContext();
        const { data, error } = await supabase
            .from('leave_policies')
            .select('*')
            .eq('company_id', currentCompanyId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching leave policy:', error);
            return undefined;
        }

        if (!data) {
            return undefined;
        }

        return {
            id: data.id,
            baseVacationDaysPerYear: parseFloat(data.base_vacation_days_per_year || 0),
            baseSickDaysPerYear: parseFloat(data.base_sick_days_per_year || 0),
            tenureBonusEnabled: data.tenure_bonus_enabled || false,
            tenureBonusYearsInterval: parseFloat(data.tenure_bonus_years_interval || 0),
            maxTenureBonusDays: parseFloat(data.max_tenure_bonus_days || 0),
        };
    } catch (error) {
        console.error('Error in getLeavePolicy:', error);
        return undefined;
    }
};

export const updateLeavePolicy = async (policy: LeavePolicy): Promise<void> => {
    try {
        if (!currentCompanyId) {
            throw new Error('No company ID set');
        }

        await ensureUserContext();

        const dbPolicy = {
            company_id: currentCompanyId,
            base_vacation_days_per_year: policy.baseVacationDaysPerYear,
            base_sick_days_per_year: policy.baseSickDaysPerYear,
            tenure_bonus_enabled: policy.tenureBonusEnabled,
            tenure_bonus_years_interval: policy.tenureBonusYearsInterval,
            max_tenure_bonus_days: policy.maxTenureBonusDays,
        };

        if (policy.id && policy.id !== 'temp-id') {
            const { error } = await supabase
                .from('leave_policies')
                .update(dbPolicy)
                .eq('id', policy.id);

            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('leave_policies')
                .insert(dbPolicy);

            if (error) throw error;
        }
    } catch (error) {
        console.error('Error updating leave policy:', error);
        throw error;
    }
};

export const deleteCustomFieldDefinition = async (defId: string): Promise<void> => {
    try {
        await ensureUserContext();
        const { error } = await supabase
            .from('custom_field_definitions')
            .delete()
            .eq('id', defId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting custom field definition:', error);
        throw error;
    }
};

export const updateCustomFieldDefinition = async (def: CustomFieldDefinition): Promise<void> => {
    try {
        await ensureUserContext();
        const { error } = await supabase
            .from('custom_field_definitions')
            .update({
                name: def.name,
                field_type: def.type,
                options: def.options || null,
            })
            .eq('id', def.id);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating custom field definition:', error);
        throw error;
    }
};

export const addCustomFieldDefinition = async (def: Omit<CustomFieldDefinition, 'id'>): Promise<CustomFieldDefinition> => {
    try {
        if (!currentCompanyId) {
            throw new Error('No company ID set');
        }

        await ensureUserContext();
        const { data, error } = await supabase
            .from('custom_field_definitions')
            .insert({
                company_id: currentCompanyId,
                name: def.name,
                field_type: def.type,
                options: def.options || null,
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            type: data.field_type as CustomFieldType,
            options: data.options || undefined,
        };
    } catch (error) {
        console.error('Error adding custom field definition:', error);
        throw error;
    }
};

export const requestPasswordReminder = async (companyCode: string, email: string): Promise<{ success: boolean, message: string }> => {
    try {
        const company = await getCompanyByCode(companyCode);
        if (!company) {
            return { success: false, message: 'Invalid company code.' };
        }

        const { data: account } = await supabase
            .from('user_accounts')
            .select('employee_id')
            .eq('company_id', company.id)
            .eq('email', email)
            .maybeSingle();

        if (!account) {
            return { success: false, message: 'No account found with this email address.' };
        }

        const { data: employee } = await supabase
            .from('employees')
            .select('first_name, last_name')
            .eq('id', account.employee_id)
            .single();

        if (!employee) {
            return { success: false, message: 'Employee profile not found.' };
        }

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-password-reset-email`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                employeeEmail: email,
                employeeName: `${employee.first_name} ${employee.last_name}`,
                companyName: company.name,
                companyCode: company.company_code,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to send password reset email');
        }

        return {
            success: true,
            message: 'Password reset instructions have been sent to your email. Please contact your employer to reset your password.'
        };
    } catch (error: any) {
        console.error('Error requesting password reminder:', error);
        return {
            success: false,
            message: 'Failed to send password reminder. Please try again or contact your employer.'
        };
    }
};

// Employee File Management Functions
export const getEmployeeFiles = async (employeeId: string): Promise<EmployeeFile[]> => {
    try {
        await ensureUserContext();
        const { data, error } = await supabase
            .from('employee_files')
            .select('*')
            .eq('employee_id', employeeId)
            .order('uploaded_at', { ascending: false });

        if (error) {
            console.error('Error fetching employee files:', error);
            return [];
        }

        return (data || []).map((file: any) => ({
            id: file.id,
            companyId: file.company_id,
            employeeId: file.employee_id,
            fileName: file.file_name,
            fileType: file.file_type,
            fileSize: parseInt(file.file_size),
            fileData: file.file_data,
            description: file.description,
            uploadedBy: file.uploaded_by,
            uploadedAt: file.uploaded_at,
        }));
    } catch (error) {
        console.error('Error in getEmployeeFiles:', error);
        return [];
    }
};

export const uploadEmployeeFile = async (
    employeeId: string,
    fileName: string,
    fileType: string,
    fileSize: number,
    fileData: string,
    description: string | undefined,
    uploadedBy: string
): Promise<EmployeeFile | { error: string }> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            return { error: 'Company context not set' };
        }

        const { data, error } = await supabase
            .from('employee_files')
            .insert([{
                company_id: currentCompanyId,
                employee_id: employeeId,
                file_name: fileName,
                file_type: fileType,
                file_size: fileSize,
                file_data: fileData,
                description: description || null,
                uploaded_by: uploadedBy,
                uploaded_at: new Date().toISOString(),
            }])
            .select()
            .single();

        if (error) {
            console.error('Error uploading file:', error);
            return { error: error.message || 'Failed to upload file' };
        }

        return {
            id: data.id,
            companyId: data.company_id,
            employeeId: data.employee_id,
            fileName: data.file_name,
            fileType: data.file_type,
            fileSize: parseInt(data.file_size),
            fileData: data.file_data,
            description: data.description,
            uploadedBy: data.uploaded_by,
            uploadedAt: data.uploaded_at,
        };
    } catch (error: any) {
        console.error('Error in uploadEmployeeFile:', error);
        return { error: error.message || 'Failed to upload file' };
    }
};

export const deleteEmployeeFile = async (fileId: string): Promise<void> => {
    try {
        await ensureUserContext();
        const { error } = await supabase
            .from('employee_files')
            .delete()
            .eq('id', fileId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting employee file:', error);
        throw error;
    }
};

// Export the WORKLOGIX_LOGO_BASE64 for compatibility
export { WORKLOGIX_LOGO_BASE64 } from './mockApi';

// Note: This is a starter implementation. You'll need to implement additional functions
// based on your application's needs. The key functions for authentication and basic
// employee management are provided above.
