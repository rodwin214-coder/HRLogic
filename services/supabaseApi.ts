import { supabase } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
);
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
    DeMinimisType,
    DeMinimisItem,
    PayrollPeriod,
    PayrollRecord,
    PayrollAdjustment,
    PayFrequency,
    PayrollStatus,
    AdjustmentType,
} from '../types';

// Store current session info
let currentCompanyId: string | null = null;
let currentUserEmail: string | null = null;

export const setCurrentUserEmail = async (email: string) => {
    currentUserEmail = email;
};

const ensureUserContext = async () => {
    if (currentUserEmail) {
        await supabase.rpc('set_config', {
            setting_name: 'app.current_user_email',
            setting_value: currentUserEmail
        });
    }
    if (currentCompanyId) {
        await supabase.rpc('set_config', {
            setting_name: 'app.current_company_id',
            setting_value: currentCompanyId
        });
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

// Helper to get company by code with retry logic
const getCompanyByCode = async (companyCode: string, retries = 3): Promise<any | null> => {
    for (let i = 0; i < retries; i++) {
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .eq('company_code', companyCode)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error: any) {
            const isNetworkError = error.message?.includes('fetch') || error.message?.includes('timed out');
            if (i === retries - 1 || !isNetworkError) {
                throw error;
            }
            console.log(`[RETRY] Retrying getCompanyByCode, attempt ${i + 2}/${retries}`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        }
    }
    return null;
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
        console.log('[LOGIN] Step 1: Getting company by code:', companyCode);
        const company = await getCompanyByCode(companyCode);
        if (!company) {
            return { error: 'Invalid company code.' };
        }
        currentCompanyId = company.id;
        console.log('[LOGIN] Step 2: Company found:', company.id);

        console.log('[LOGIN] Step 3: Fetching user account');
        let account = null;
        let accountError = null;

        for (let i = 0; i < 3; i++) {
            try {
                const result = await supabase
                    .from('user_accounts')
                    .select('*')
                    .eq('company_id', company.id)
                    .eq('email', email)
                    .maybeSingle();

                account = result.data;
                accountError = result.error;
                break;
            } catch (error: any) {
                const isNetworkError = error.message?.includes('fetch') || error.message?.includes('timed out');
                if (i < 2 && isNetworkError) {
                    console.log(`[LOGIN] Retry ${i + 1}: Fetching user account`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
                } else {
                    accountError = error;
                    break;
                }
            }
        }

        if (accountError || !account) {
            console.log('[LOGIN] Account error:', accountError);
            return { error: 'Invalid email or password.' };
        }
        console.log('[LOGIN] Step 4: Account found');

        console.log('[LOGIN] Step 5: Verifying password');
        const passwordMatch = await bcrypt.compare(password, account.password_hash);
        if (!passwordMatch) {
            return { error: 'Invalid email or password.' };
        }
        console.log('[LOGIN] Step 6: Password verified');

        console.log('[LOGIN] Step 7: Setting user email for RLS');
        await setCurrentUserEmail(email);

        console.log('[LOGIN] Step 8: Fetching employee profile');
        let employeeData = null;
        let employeeError = null;

        for (let i = 0; i < 3; i++) {
            try {
                const result = await supabase
                    .from('employees')
                    .select('*')
                    .eq('id', account.employee_id)
                    .maybeSingle();

                employeeData = result.data;
                employeeError = result.error;
                break;
            } catch (error: any) {
                const isNetworkError = error.message?.includes('fetch') || error.message?.includes('timed out');
                if (i < 2 && isNetworkError) {
                    console.log(`[LOGIN] Retry ${i + 1}: Fetching employee profile`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
                } else {
                    employeeError = error;
                    break;
                }
            }
        }

        if (employeeError || !employeeData) {
            console.error('[LOGIN] Failed to fetch employee profile:', employeeError);
            return { error: 'Could not find employee profile.' };
        }
        console.log('[LOGIN] Step 9: Employee data fetched');

        if (employeeData.status === EmployeeStatus.TERMINATED) {
            return { error: 'This account has been terminated and is no longer active.' };
        }

        console.log('[LOGIN] Step 10: Converting employee data');
        const employee: Employee = await convertDbEmployeeToEmployee(employeeData);
        console.log('[LOGIN] Step 11: Login successful');
        return { user: employee, role: account.role };
    } catch (error: any) {
        console.error('[LOGIN] Login error:', error);
        const errorMessage = error.message?.includes('timed out')
            ? 'Connection timeout. Please check your internet connection and try again.'
            : error.message || 'Login failed. Please try again.';
        return { error: errorMessage };
    }
};

// Helper function to convert database employee to Employee type
const convertDbEmployeeToEmployee = async (dbEmployee: any): Promise<Employee> => {
    console.log('[CONVERT] Fetching salary history for employee:', dbEmployee.id);
    const { data: salaryHistory, error: salaryError } = await supabase
        .from('salary_history')
        .select('*')
        .eq('employee_id', dbEmployee.id)
        .order('effective_date', { ascending: false });

    if (salaryError) {
        console.error('[CONVERT] Salary history error:', salaryError);
    }
    console.log('[CONVERT] Salary history fetched:', salaryHistory?.length || 0, 'records');

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
        terminationReason: dbEmployee.termination_reason,
        status: dbEmployee.status || EmployeeStatus.ACTIVE,
        employmentType: dbEmployee.employment_type || EmploymentType.PROBATIONARY,
        salaryHistory: (salaryHistory || []).map((s: any) => ({
            id: s.id,
            effectiveDate: s.effective_date,
            basicSalary: parseFloat(s.basic_salary),
            allowance: parseFloat(s.allowance || 0),
            otherBenefits: parseFloat(s.other_benefits || 0),
            hourlyRate: s.hourly_rate != null ? parseFloat(s.hourly_rate) : null,
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
        if (!currentCompanyId) {
            console.error('No company ID set');
            return [];
        }

        // Fetch employees
        const { data: employeesData, error: employeesError } = await supabase
            .from('employees')
            .select('*')
            .eq('company_id', currentCompanyId)
            .order('last_name', { ascending: true });

        if (employeesError) throw employeesError;

        if (!employeesData || employeesData.length === 0) {
            return [];
        }

        // Fetch all salary history for all employees in one query
        const employeeIds = employeesData.map(e => e.id);
        const { data: salaryHistoryData } = await supabase
            .from('salary_history')
            .select('*')
            .in('employee_id', employeeIds)
            .order('effective_date', { ascending: false });

        // Group salary history by employee_id
        const salaryHistoryByEmployee = new Map<string, any[]>();
        (salaryHistoryData || []).forEach((sh: any) => {
            if (!salaryHistoryByEmployee.has(sh.employee_id)) {
                salaryHistoryByEmployee.set(sh.employee_id, []);
            }
            salaryHistoryByEmployee.get(sh.employee_id)!.push(sh);
        });

        // Convert employees with pre-fetched salary history
        const employees = employeesData.map(dbEmployee => {
            const salaryHistory = salaryHistoryByEmployee.get(dbEmployee.id) || [];
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
                salaryHistory: salaryHistory.map((s: any) => ({
                    id: s.id,
                    effectiveDate: s.effective_date,
                    basicSalary: parseFloat(s.basic_salary),
                    allowance: parseFloat(s.allowance || 0),
                    otherBenefits: parseFloat(s.other_benefits || 0),
                    hourlyRate: s.hourly_rate != null ? parseFloat(s.hourly_rate) : null,
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
        });

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
        if (!currentCompanyId || !currentUserEmail) {
            return { error: 'Company not found. Please log in again.' };
        }

        // Generate sequential employee ID
        const generatedEmployeeId = await generateNextEmployeeId(currentCompanyId);

        // Hash default password
        const defaultPassword = 'qwerty123';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        // Check for duplicate email
        const { data: existingAccount } = await supabaseAdmin
            .from('user_accounts')
            .select('id')
            .eq('email', employeeData.email)
            .eq('company_id', currentCompanyId)
            .maybeSingle();

        if (existingAccount) {
            return { error: 'An employee with this email already exists in your company.' };
        }

        // Insert employee using admin client (bypasses RLS)
        const { data: newEmployee, error: empError } = await supabaseAdmin
            .from('employees')
            .insert([{
                company_id: currentCompanyId,
                employee_id: generatedEmployeeId,
                email: employeeData.email,
                first_name: employeeData.firstName,
                last_name: employeeData.lastName,
                department: employeeData.department,
                shift_id: employeeData.shiftId || null,
                date_hired: new Date().toISOString().split('T')[0],
                employment_type: EmploymentType.PROBATIONARY,
                status: 'Active',
            }])
            .select()
            .single();

        if (empError) throw empError;

        // Insert user account using admin client
        const { error: accountError } = await supabaseAdmin
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
                termination_reason: updatedEmployee.terminationReason || null,
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

export const addSalaryRecord = async (
    employeeId: string,
    effectiveDate: string,
    basicSalary: number,
    allowance: number,
    otherBenefits: number,
    hourlyRate?: number | null
): Promise<void> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            throw new Error('Company not found. Please log in again.');
        }

        const { error } = await supabase
            .from('salary_history')
            .insert({
                employee_id: employeeId,
                effective_date: effectiveDate,
                basic_salary: basicSalary,
                allowance: allowance,
                other_benefits: otherBenefits,
                hourly_rate: hourlyRate ?? null,
            });

        if (error) throw error;
    } catch (error: any) {
        console.error('Error adding salary record:', error);
        throw error;
    }
};

export const updateSalaryRecord = async (
    salaryRecordId: string,
    effectiveDate: string,
    basicSalary: number,
    allowance: number,
    otherBenefits: number,
    hourlyRate?: number | null
): Promise<void> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            throw new Error('Company not found. Please log in again.');
        }

        const { error } = await supabase
            .from('salary_history')
            .update({
                effective_date: effectiveDate,
                basic_salary: basicSalary,
                allowance: allowance,
                other_benefits: otherBenefits,
                hourly_rate: hourlyRate ?? null,
            })
            .eq('id', salaryRecordId);

        if (error) throw error;
    } catch (error: any) {
        console.error('Error updating salary record:', error);
        throw error;
    }
};

export const deleteSalaryRecord = async (salaryRecordId: string): Promise<void> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            throw new Error('Company not found. Please log in again.');
        }

        const { error } = await supabase
            .from('salary_history')
            .delete()
            .eq('id', salaryRecordId);

        if (error) throw error;
    } catch (error: any) {
        console.error('Error deleting salary record:', error);
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

            try {
                // Generate employee ID
                const generatedEmployeeId = `emp${Date.now()}_${i}`;

                // Check for duplicate email
                const { data: existingAcct } = await supabaseAdmin
                    .from('user_accounts')
                    .select('id')
                    .eq('email', entry.email)
                    .eq('company_id', currentCompanyId)
                    .maybeSingle();

                if (existingAcct) {
                    throw new Error('An employee with this email already exists in your company.');
                }

                // Insert employee using admin client (bypasses RLS)
                const { data: newEmp, error: bulkEmpError } = await supabaseAdmin
                    .from('employees')
                    .insert([{
                        company_id: currentCompanyId,
                        employee_id: generatedEmployeeId,
                        email: entry.email,
                        first_name: entry.firstName || '',
                        last_name: entry.lastName || '',
                        department: entry.department || '',
                        date_hired: entry.dateHired || new Date().toISOString().split('T')[0],
                        employment_type: entry.employmentType || EmploymentType.PROBATIONARY,
                        status: 'Active',
                    }])
                    .select()
                    .single();

                if (bulkEmpError) throw bulkEmpError;

                const { error: bulkAcctError } = await supabaseAdmin
                    .from('user_accounts')
                    .insert([{
                        company_id: currentCompanyId,
                        employee_id: newEmp.id,
                        email: entry.email,
                        password_hash: passwordHash,
                        role: UserRole.EMPLOYEE,
                    }]);

                if (bulkAcctError) throw bulkAcctError;

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
            gracePeriodMinutes: data.grace_period_minutes ?? 5,
            employerShouldersContributions: data.employer_shoulders_contributions ?? false,
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
                grace_period_minutes: profile.gracePeriodMinutes,
                employer_shoulders_contributions: profile.employerShouldersContributions ?? false,
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
            gracePeriodMinutes: data.grace_period_minutes ?? 5,
            employerShouldersContributions: data.employer_shoulders_contributions ?? false,
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
            holidayType: r.holiday_type ?? undefined,
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
                holiday_type: requestData.holidayType ?? null,
            }])
            .select()
            .single();

        if (error) throw error;

        const { data: employee } = await supabase
            .from('employees')
            .select('first_name, last_name')
            .eq('id', requestData.employeeId)
            .maybeSingle();

        if (employee && currentCompanyId) {
            const employeeName = `${employee.first_name} ${employee.last_name}`;
            let requestTypeText = data.request_type;
            let requestDetails = '';

            if (data.request_type === RequestType.LEAVE) {
                requestDetails = `${data.leave_type} from ${data.start_date} to ${data.end_date}`;
            } else if (data.request_type === RequestType.OVERTIME || data.request_type === RequestType.UNDERTIME) {
                requestDetails = `${data.hours} hours on ${data.date}`;
            }

            const { data: employers } = await supabase
                .from('user_accounts')
                .select('employee_id')
                .eq('company_id', currentCompanyId)
                .eq('role', 'employer');

            if (employers && employers.length > 0) {
                for (const employer of employers) {
                    const { data: settings } = await supabase
                        .from('notification_settings')
                        .select('notify_on_request')
                        .eq('user_id', employer.employee_id)
                        .maybeSingle();

                    if (!settings || settings.notify_on_request !== false) {
                        await createNotification(
                            currentCompanyId,
                            employer.employee_id,
                            'New Request Pending',
                            `${employeeName} submitted a ${requestTypeText} request${requestDetails ? ': ' + requestDetails : ''}`,
                            'request_pending',
                            { requestId: data.id, employeeId: requestData.employeeId, requestType: data.request_type }
                        );
                    }
                }
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
        };
    } catch (error) {
        console.error('Error adding request:', error);
        throw error;
    }
};

export const getAttendance = async (startDate?: string, endDate?: string): Promise<AttendanceRecord[]> => {
    try {
        await ensureUserContext();
        let query = supabase
            .from('attendance_records')
            .select('*');

        if (startDate) {
            query = query.gte('clock_in_time', `${startDate}T00:00:00`);
        }
        if (endDate) {
            query = query.lte('clock_in_time', `${endDate}T23:59:59`);
        }

        const { data, error } = await query.order('clock_in_time', { ascending: false });

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

        // First, check for ANY active session (not clocked out yet), regardless of clock-in date
        // This handles cases where someone clocked in yesterday but didn't clock out
        const { data: activeSession } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
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

        // If no active session, get the most recent completed session from today
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

        // Get all today's sessions
        const { data: todaysSessions, error: todayError } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('clock_in_time', `${today}T00:00:00Z`)
            .lte('clock_in_time', `${today}T23:59:59Z`)
            .order('clock_in_time', { ascending: true });

        if (todayError) {
            console.error('Error fetching today\'s attendance:', todayError);
            return [];
        }

        // Also check for any unclosed session from previous days
        const { data: previousActiveSession, error: activeError } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .lt('clock_in_time', `${today}T00:00:00Z`)
            .is('clock_out_time', null)
            .order('clock_in_time', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (activeError) {
            console.error('Error fetching previous active session:', activeError);
        }

        // Combine sessions - put the previous active session first if it exists
        const allSessions = [];
        if (previousActiveSession) {
            allSessions.push(previousActiveSession);
        }
        if (todaysSessions) {
            allSessions.push(...todaysSessions);
        }

        return allSessions.map((record: any) => ({
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

    // Check if there's ANY active session (clocked in but not clocked out), regardless of clock-in date
    const { data: activeSession } = await supabase
        .from('attendance_records')
        .select('id, clock_in_time')
        .eq('employee_id', record.employeeId)
        .is('clock_out_time', null)
        .maybeSingle();

    if (activeSession) {
        const sessionDate = new Date(activeSession.clock_in_time).toLocaleDateString();
        throw new Error(`You have an active session from ${sessionDate}. Please clock out before starting a new session.`);
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
        // Get employee's shift information and company grace period
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

            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('grace_period_minutes')
                .eq('id', companyId)
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

                // Get grace period from company settings, default to 5 minutes
                const gracePeriod = company?.grace_period_minutes ?? 5;

                // Consider on time if within grace period of shift start
                status = clockInTotalMinutes <= (shiftTotalMinutes + gracePeriod) ? 'On Time' : 'Late';
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

    const { data: employee } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('id', record.employeeId)
        .maybeSingle();

    const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : 'Employee';
    const clockInTimeFormatted = new Date(record.clockInTime).toLocaleTimeString();

    const { data: employers } = await supabase
        .from('user_accounts')
        .select('employee_id')
        .eq('company_id', companyId)
        .eq('role', 'employer');

    if (employers && employers.length > 0) {
        for (const employer of employers) {
            const { data: settings } = await supabase
                .from('notification_settings')
                .select('notify_on_clock_in')
                .eq('user_id', employer.employee_id)
                .maybeSingle();

            if (!settings || settings.notify_on_clock_in !== false) {
                await createNotification(
                    companyId,
                    employer.employee_id,
                    'Employee Clocked In',
                    `${employeeName} clocked in at ${clockInTimeFormatted}${status ? ` (${status})` : ''}`,
                    'clock_in',
                    { employeeId: record.employeeId, status, clockInTime: record.clockInTime }
                );
            }
        }
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
        // Find ANY unclosed session for this employee, regardless of clock-in date
        const { data: record, error: fetchError } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .is('clock_out_time', null)
            .order('clock_in_time', { ascending: false })
            .limit(1)
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

        const { data: employee } = await supabase
            .from('employees')
            .select('first_name, last_name, company_id')
            .eq('id', employeeId)
            .maybeSingle();

        if (employee) {
            const employeeName = `${employee.first_name} ${employee.last_name}`;
            const clockOutTimeFormatted = new Date().toLocaleTimeString();
            const clockInTime = new Date(data.clock_in_time);
            const clockOutTime = new Date(data.clock_out_time);
            const diffMs = clockOutTime.getTime() - clockInTime.getTime();
            const totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

            const { data: employers } = await supabase
                .from('user_accounts')
                .select('employee_id')
                .eq('company_id', employee.company_id)
                .eq('role', 'employer');

            if (employers && employers.length > 0) {
                for (const employer of employers) {
                    const { data: settings } = await supabase
                        .from('notification_settings')
                        .select('notify_on_clock_out')
                        .eq('user_id', employer.employee_id)
                        .maybeSingle();

                    if (!settings || settings.notify_on_clock_out !== false) {
                        await createNotification(
                            employee.company_id,
                            employer.employee_id,
                            'Employee Clocked Out',
                            `${employeeName} clocked out at ${clockOutTimeFormatted} (${totalHours} hours)`,
                            'clock_out',
                            { employeeId, clockOutTime: data.clock_out_time, totalHours }
                        );
                    }
                }
            }
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
            if (req.leave_type === LeaveType.VACATION || req.leave_type === LeaveType.EMERGENCY) {
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

export const updateHoliday = async (holiday: Holiday): Promise<Holiday> => {
    try {
        await ensureUserContext();
        const { data, error } = await supabase
            .from('holidays')
            .update({
                name: holiday.name,
                date: holiday.date,
                country: holiday.country || 'PH',
                holiday_type: holiday.type || 'Regular',
            })
            .eq('id', holiday.id)
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
        console.error('Error updating holiday:', error);
        throw error;
    }
};

export const deleteHoliday = async (holidayId: string): Promise<void> => {
    try {
        await ensureUserContext();
        const { error } = await supabase
            .from('holidays')
            .delete()
            .eq('id', holidayId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting holiday:', error);
        throw error;
    }
};

export const getCustomHolidayTypes = async (): Promise<string[]> => {
    try {
        await ensureUserContext();
        const { data, error } = await supabase
            .from('custom_holiday_types')
            .select('type_name')
            .order('type_name', { ascending: true });

        if (error) throw error;
        return (data || []).map((item: any) => item.type_name);
    } catch (error) {
        console.error('Error fetching custom holiday types:', error);
        return [];
    }
};

export const addCustomHolidayType = async (typeName: string): Promise<void> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            throw new Error('Company context not set');
        }

        const { error } = await supabase
            .from('custom_holiday_types')
            .insert([{
                company_id: currentCompanyId,
                type_name: typeName,
            }]);

        if (error) throw error;
    } catch (error) {
        console.error('Error adding custom holiday type:', error);
        throw error;
    }
};

export const deleteCustomHolidayType = async (typeName: string): Promise<void> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) {
            throw new Error('Company context not set');
        }

        const { error } = await supabase
            .from('custom_holiday_types')
            .delete()
            .eq('company_id', currentCompanyId)
            .eq('type_name', typeName);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting custom holiday type:', error);
        throw error;
    }
};

export const changePassword = async (employeeId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean, message: string }> => {
    try {
        await ensureUserContext();

        const { data: account } = await supabase
            .from('user_accounts')
            .select('password_hash')
            .eq('employee_id', employeeId)
            .maybeSingle();

        if (!account) {
            return { success: false, message: 'Account not found.' };
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, account.password_hash);
        if (!isCurrentPasswordValid) {
            return { success: false, message: 'Current password is incorrect.' };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const { error } = await supabase
            .from('user_accounts')
            .update({ password_hash: hashedPassword })
            .eq('employee_id', employeeId);

        if (error) {
            console.error('Error updating password:', error);
            return { success: false, message: 'Failed to update password.' };
        }

        return { success: true, message: 'Password updated successfully.' };
    } catch (error) {
        console.error('Error changing password:', error);
        return { success: false, message: 'Failed to change password.' };
    }
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
            .maybeSingle();

        if (error) {
            console.error('Error updating request status:', error);
            throw error;
        }

        if (!data) {
            console.error('No request found with id:', requestId);
            throw new Error('Request not found');
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
                throw employeeUpdateError;
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
            holidayType: data.holiday_type ?? undefined,
        } as AppRequest;
    } catch (error) {
        console.error('Error in updateRequestStatus:', error);
        throw error;
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
            getAttendance(startDate, endDate),
            getEmployees(),
            getRequests(),
        ]);

        const filteredAttendance = attendance;

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

        const resetToken = crypto.randomUUID() + '-' + Date.now().toString(36);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        const { error: tokenError } = await supabase
            .from('password_reset_tokens')
            .insert({
                company_id: company.id,
                employee_id: account.employee_id,
                email: email,
                token: resetToken,
                expires_at: expiresAt
            });

        if (tokenError) {
            console.error('Error creating reset token:', tokenError);
            return { success: false, message: 'Failed to create password reset token.' };
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
                resetToken: resetToken
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to send password reset email');
        }

        return {
            success: true,
            message: 'Password reset instructions have been sent to your email.'
        };
    } catch (error: any) {
        console.error('Error requesting password reminder:', error);
        return {
            success: false,
            message: 'Failed to send password reminder. Please try again or contact your employer.'
        };
    }
};

export const validateResetToken = async (token: string): Promise<{ valid: boolean, email?: string, companyCode?: string }> => {
    try {
        const { data: resetToken } = await supabase
            .from('password_reset_tokens')
            .select('email, company_id, expires_at, used_at')
            .eq('token', token)
            .maybeSingle();

        if (!resetToken) {
            return { valid: false };
        }

        if (resetToken.used_at) {
            return { valid: false };
        }

        if (new Date(resetToken.expires_at) < new Date()) {
            return { valid: false };
        }

        const { data: company } = await supabase
            .from('companies')
            .select('company_code')
            .eq('id', resetToken.company_id)
            .single();

        return {
            valid: true,
            email: resetToken.email,
            companyCode: company?.company_code
        };
    } catch (error) {
        console.error('Error validating reset token:', error);
        return { valid: false };
    }
};

export const resetPasswordWithToken = async (token: string, newPassword: string): Promise<{ success: boolean, message: string }> => {
    try {
        const { data: resetToken } = await supabase
            .from('password_reset_tokens')
            .select('*')
            .eq('token', token)
            .maybeSingle();

        if (!resetToken || resetToken.used_at || new Date(resetToken.expires_at) < new Date()) {
            return { success: false, message: 'Invalid or expired reset token.' };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const { error: updateError } = await supabase
            .from('user_accounts')
            .update({ password_hash: hashedPassword })
            .eq('company_id', resetToken.company_id)
            .eq('email', resetToken.email);

        if (updateError) {
            console.error('Error updating password:', updateError);
            return { success: false, message: 'Failed to update password.' };
        }

        await supabase
            .from('password_reset_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('token', token);

        return { success: true, message: 'Password has been reset successfully.' };
    } catch (error) {
        console.error('Error resetting password:', error);
        return { success: false, message: 'Failed to reset password.' };
    }
};

export const getEmployeePassword = async (employeeId: string): Promise<string | null> => {
    try {
        await ensureUserContext();
        const { data: account } = await supabase
            .from('user_accounts')
            .select('password_hash')
            .eq('employee_id', employeeId)
            .maybeSingle();

        return account?.password_hash || null;
    } catch (error) {
        console.error('Error getting employee password:', error);
        return null;
    }
};

export const updateEmployeePassword = async (employeeId: string, newPassword: string): Promise<{ success: boolean, message: string }> => {
    try {
        await ensureUserContext();
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const { error } = await supabase
            .from('user_accounts')
            .update({ password_hash: hashedPassword })
            .eq('employee_id', employeeId);

        if (error) {
            console.error('Error updating employee password:', error);
            return { success: false, message: 'Failed to update password.' };
        }

        return { success: true, message: 'Password updated successfully.' };
    } catch (error) {
        console.error('Error updating employee password:', error);
        return { success: false, message: 'Failed to update password.' };
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

// Notifications API
export const createNotification = async (
    companyId: string,
    userId: string,
    title: string,
    message: string,
    type: string,
    data: Record<string, any> = {}
): Promise<void> => {
    try {
        const { error } = await supabase
            .from('notifications')
            .insert([{
                company_id: companyId,
                user_id: userId,
                title,
                message,
                type,
                data,
                is_read: false
            }]);

        if (error) throw error;
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

export const getNotifications = async (userId: string): Promise<any[]> => {
    try {
        await ensureUserContext();
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    try {
        await ensureUserContext();
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
    try {
        await ensureUserContext();
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) throw error;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
    try {
        await ensureUserContext();
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting notification:', error);
    }
};

export const getNotificationSettings = async (userId: string): Promise<any> => {
    try {
        await ensureUserContext();
        const { data, error } = await supabase
            .from('notification_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching notification settings:', error);
        return null;
    }
};

export const updateNotificationSettings = async (
    userId: string,
    companyId: string,
    settings: {
        notify_on_clock_in?: boolean;
        notify_on_clock_out?: boolean;
        notify_on_request?: boolean;
        notify_on_missed_clock_out?: boolean;
    }
): Promise<void> => {
    try {
        await ensureUserContext();
        const { error } = await supabase
            .from('notification_settings')
            .upsert({
                user_id: userId,
                company_id: companyId,
                ...settings,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
    } catch (error) {
        console.error('Error updating notification settings:', error);
    }
};

// Export the WORKLOGIX_LOGO_BASE64 for compatibility
export { WORKLOGIX_LOGO_BASE64 } from './mockApi';

// ─── Payroll API ─────────────────────────────────────────────────────────────

import {
    PayrollPeriod, PayrollRecord, PayrollAdjustment, PayFrequency, PayrollStatus, AdjustmentType,
} from '../types';

function dbPeriodToPayrollPeriod(r: any): PayrollPeriod {
    return {
        id: r.id,
        companyId: r.company_id,
        periodName: r.period_name,
        payFrequency: r.pay_frequency,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        payDate: r.pay_date,
        status: r.status,
        notes: r.notes ?? '',
        createdAt: r.created_at,
    };
}

function dbRecordToPayrollRecord(r: any): PayrollRecord {
    return {
        id: r.id,
        companyId: r.company_id,
        periodId: r.period_id,
        employeeId: r.employee_id,
        basicSalary: Number(r.basic_salary),
        dailyRate: Number(r.daily_rate),
        daysWorked: Number(r.days_worked),
        hoursWorked: Number(r.hours_worked),
        basicPay: Number(r.basic_pay),
        absentDays: Number(r.absent_days ?? 0),
        absentDeduction: Number(r.absent_deduction ?? 0),
        lateMinutes: Number(r.late_minutes ?? 0),
        lateDeduction: Number(r.late_deduction ?? 0),
        undertimeMinutes: Number(r.undertime_minutes ?? 0),
        undertimeDeduction: Number(r.undertime_deduction ?? 0),
        overtimeHours: Number(r.overtime_hours),
        overtimePay: Number(r.overtime_pay),
        regularHolidayHours: Number(r.regular_holiday_hours),
        regularHolidayPay: Number(r.regular_holiday_pay),
        specialHolidayHours: Number(r.special_holiday_hours),
        specialHolidayPay: Number(r.special_holiday_pay),
        nightDiffHours: Number(r.night_diff_hours),
        nightDiffPay: Number(r.night_diff_pay),
        restDayHours: Number(r.rest_day_hours),
        restDayPay: Number(r.rest_day_pay),
        allowance: Number(r.allowance),
        otherBenefits: Number(r.other_benefits),
        deMinimis: Number(r.de_minimis),
        thirteenthMonthAccrued: Number(r.thirteenth_month_accrued),
        grossPay: Number(r.gross_pay),
        sssContribution: Number(r.sss_contribution),
        philhealthContribution: Number(r.philhealth_contribution),
        pagibigContribution: Number(r.pagibig_contribution),
        totalContributions: Number(r.total_contributions),
        employerContributionsBenefit: Number(r.employer_contributions_benefit ?? 0),
        taxableIncome: Number(r.taxable_income),
        withholdingTax: Number(r.withholding_tax),
        sssLoan: Number(r.sss_loan),
        pagibigLoan: Number(r.pagibig_loan),
        cashAdvance: Number(r.cash_advance),
        otherDeductions: Number(r.other_deductions),
        totalDeductions: Number(r.total_deductions),
        netPay: Number(r.net_pay),
        status: r.status,
        notes: r.notes ?? '',
    };
}

// ─── Attendance Analysis ─────────────────────────────────────────────────────

export interface AttendanceAnalysis {
    scheduledWorkDays: number; // total working days in the period per schedule (excl. weekends/off days)
    daysWorked: number;        // days the employee actually attended
    hoursWorked: number;
    absentDays: number;        // scheduled work days with no attendance and no approved leave
    lateMinutes: number;
    undertimeMinutes: number;
    overtimeHours: number;
    regularHolidayHours: number;
    specialHolidayHours: number;
    restDayHours: number;
    nightDiffHours: number;
}

// Returns the day-of-week numbers (0=Sun) that are working days for a schedule
function workingDayNumbers(schedule: WorkSchedule): number[] {
    // WorkSchedule is statically imported at the top of this file
    if (schedule === WorkSchedule.MONDAY_TO_FRIDAY)   return [1,2,3,4,5];
    if (schedule === WorkSchedule.MONDAY_TO_SATURDAY)  return [1,2,3,4,5,6];
    return [0,1,2,3,4,5,6]; // MONDAY_TO_SUNDAY
}

// Format a Date as "YYYY-MM-DD" using local time (not UTC) to avoid timezone shift
function localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Enumerate every calendar date in [start, end] inclusive as "YYYY-MM-DD"
function dateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const cur = new Date(start + 'T00:00:00');
    const last = new Date(end + 'T00:00:00');
    while (cur <= last) {
        dates.push(localDateStr(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

// Parse "HH:MM" or "HH:MM:SS" time string into total minutes from midnight
function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
}

// 22:00–06:00 PH night differential window
const NIGHT_START = 22 * 60; // 1320
const NIGHT_END   = 6 * 60;  // 360

function nightDiffMinutesInRange(startMin: number, endMin: number): number {
    // Handle spans that cross midnight by normalizing
    let nd = 0;
    const checkMinute = (m: number) => {
        const norm = ((m % 1440) + 1440) % 1440;
        return norm >= NIGHT_START || norm < NIGHT_END;
    };
    for (let m = startMin; m < endMin; m++) {
        if (checkMinute(m)) nd++;
    }
    return nd;
}

export const analyzeAttendanceForPayroll = async (params: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    shift: Shift | null;
    workSchedule: WorkSchedule;
    gracePeriodMinutes: number;
    holidays: Holiday[];
}): Promise<AttendanceAnalysis> => {
    const { employeeId, periodStart, periodEnd, shift, workSchedule, gracePeriodMinutes, holidays } = params;

    // Fetch attendance records, approved OT requests, and approved leave in parallel
    const [{ data: rawRecords }, { data: rawOTRequests }, { data: rawLeaveRequests }] = await Promise.all([
        supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('clock_in_time', `${periodStart}T00:00:00+08:00`)
            .lte('clock_in_time', `${periodEnd}T23:59:59+08:00`),
        supabase
            .from('requests')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('request_type', 'Overtime')
            .eq('status', 'Approved')
            .gte('date', periodStart)
            .lte('date', periodEnd),
        supabase
            .from('requests')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('request_type', 'Leave')
            .eq('status', 'Approved')
            .lte('start_date', periodEnd)
            .gte('end_date', periodStart),
    ]);

    // Build holiday lookup by date for fallback resolution
    const holidayByDate: Record<string, string> = {};
    for (const h of holidays) {
        holidayByDate[h.date] = h.type;
    }

    // Approved OT requests keyed by date — hours and holiday type (from request or holidays table)
    const approvedOT: Record<string, { hours: number; holidayType?: string }> = {};
    for (const r of (rawOTRequests ?? [])) {
        const date = r.date as string;
        const prev = approvedOT[date];
        const hrs = parseFloat(r.hours ?? 0);
        const holidayType = r.holiday_type ?? holidayByDate[date] ?? prev?.holidayType;
        approvedOT[date] = {
            hours: (prev?.hours ?? 0) + hrs,
            holidayType,
        };
    }

    // Build sets of dates covered by approved leave
    // Paid leave → no absent deduction; Unpaid leave → deduction still applies
    const approvedLeaveDates = new Set<string>();
    const unpaidLeaveDates   = new Set<string>();
    for (const r of (rawLeaveRequests ?? [])) {
        const isUnpaid = (r.leave_type as string)?.toLowerCase().includes('unpaid');
        for (const d of dateRange(r.start_date, r.end_date)) {
            if (d >= periodStart && d <= periodEnd) {
                if (isUnpaid) {
                    unpaidLeaveDates.add(d);
                } else {
                    approvedLeaveDates.add(d);
                }
            }
        }
    }

    const records: { date: string; clockInMin: number; clockOutMin: number | null }[] =
        (rawRecords ?? []).map((r: any) => {
            const cin = new Date(r.clock_in_time);
            const cout = r.clock_out_time ? new Date(r.clock_out_time) : null;
            const dateKey = localDateStr(cin); // use local date to avoid UTC timezone shift
            const cinMin = cin.getHours() * 60 + cin.getMinutes();
            const coutMin = cout ? cout.getHours() * 60 + cout.getMinutes() : null;
            return { date: dateKey, clockInMin: cinMin, clockOutMin: coutMin };
        });

    // Group by date — keep first clock-in, last clock-out
    const byDate: Record<string, { clockInMin: number; clockOutMin: number | null }> = {};
    for (const rec of records) {
        if (!byDate[rec.date]) {
            byDate[rec.date] = { clockInMin: rec.clockInMin, clockOutMin: rec.clockOutMin };
        } else {
            if (rec.clockInMin < byDate[rec.date].clockInMin) byDate[rec.date].clockInMin = rec.clockInMin;
            if (rec.clockOutMin !== null) {
                if (byDate[rec.date].clockOutMin === null || rec.clockOutMin > byDate[rec.date].clockOutMin!) {
                    byDate[rec.date].clockOutMin = rec.clockOutMin;
                }
            }
        }
    }

    const holidayMap: Record<string, 'Regular' | 'Special'> = {};
    for (const h of holidays) holidayMap[h.date] = h.type;

    const workDayNums   = workingDayNumbers(workSchedule);
    const shiftStartMin = shift ? timeToMinutes(shift.startTime) : 8 * 60;
    const shiftEndMin   = shift ? timeToMinutes(shift.endTime)   : 17 * 60;

    let scheduledWorkDays = 0;
    let daysWorked        = 0;
    let hoursWorked       = 0;
    let absentDays        = 0;
    let lateMinutes       = 0;
    let undertimeMinutes  = 0;
    let overtimeHours     = 0;
    let regularHolidayHours = 0;
    let specialHolidayHours = 0;
    let restDayHours      = 0;
    let nightDiffHours    = 0;

    for (const date of dateRange(periodStart, periodEnd)) {
        const dayOfWeek    = new Date(date + 'T00:00:00').getDay();
        const isWorkDay    = workDayNums.includes(dayOfWeek);
        const isRestDay    = !isWorkDay;
        const holidayType  = holidayMap[date];
        const attended     = byDate[date];
        const isOnLeave      = approvedLeaveDates.has(date);
        const isOnUnpaidLeave = unpaidLeaveDates.has(date);

        // Count scheduled work days (regular working days only, excl. weekends/off-schedule)
        if (isWorkDay) scheduledWorkDays += 1;

        if (!attended) {
            if (isWorkDay && !holidayType && !isOnLeave) {
                // Absent if no paid leave covering this day.
                // Unpaid leave days are not in approvedLeaveDates, so they still trigger a deduction.
                absentDays += 1;
            }
            continue;
        }

        // Employee clocked in — process the day
        const { clockInMin, clockOutMin } = attended;

        // Overtime beyond shift end only credited with an approved OT request
        const effectiveClockOut  = clockOutMin ?? shiftEndMin;
        const clockOutForRegular = Math.min(effectiveClockOut, shiftEndMin);

        const workedMin = Math.max(0, clockOutForRegular - clockInMin);
        hoursWorked += workedMin / 60;

        // Tardiness: late if clocked in after grace period; deduction = minutes from shift start to actual clock-in
        const graceDeadline = shiftStartMin + gracePeriodMinutes;
        if (isWorkDay && clockInMin > graceDeadline) {
            lateMinutes += clockInMin - shiftStartMin;
        }

        // Undertime: clocked out before shift end (no approved OT on that day)
        const otRequest = approvedOT[date];
        if (clockOutMin !== null && clockOutMin < shiftEndMin && isWorkDay && !otRequest) {
            undertimeMinutes += shiftEndMin - clockOutMin;
        }

        // Rest day earnings (attendance-based, no OT request needed)
        if (isRestDay) {
            restDayHours += workedMin / 60;
        }

        // Holiday pay and OT — sourced from approved OT requests only
        if (otRequest) {
            const approvedHrs    = otRequest.hours;
            const reqHolidayType = otRequest.holidayType;
            if (reqHolidayType === 'Regular') {
                // Regular holiday pay: credit 8 hours (standard day) regardless of filed OT hours
                regularHolidayHours += 8;
            } else if (reqHolidayType === 'Special') {
                specialHolidayHours += approvedHrs;
            } else {
                overtimeHours += approvedHrs;
            }
            hoursWorked += approvedHrs;
        }

        // Night differential (22:00–06:00 window, shift portion only)
        nightDiffHours += nightDiffMinutesInRange(clockInMin, clockOutForRegular) / 60;

        // Count as a worked day only for regular work days and special holidays with attendance
        // Regular holidays are paid regardless of attendance (handled above via basic pay)
        if (isWorkDay || holidayType === 'Special' || isRestDay) daysWorked += 1;
    }

    return {
        scheduledWorkDays: Math.round(scheduledWorkDays * 100) / 100,
        daysWorked:        Math.round(daysWorked * 100) / 100,
        hoursWorked:       Math.round(hoursWorked * 100) / 100,
        absentDays:        Math.round(absentDays * 100) / 100,
        lateMinutes:       Math.round(lateMinutes * 100) / 100,
        undertimeMinutes:  Math.round(undertimeMinutes * 100) / 100,
        overtimeHours:     Math.round(overtimeHours * 100) / 100,
        regularHolidayHours: Math.round(regularHolidayHours * 100) / 100,
        specialHolidayHours: Math.round(specialHolidayHours * 100) / 100,
        restDayHours:      Math.round(restDayHours * 100) / 100,
        nightDiffHours:    Math.round(nightDiffHours * 100) / 100,
    };
};

// PH SSS contribution lookup
export const computeSSSContribution = async (monthlyBasic: number): Promise<number> => {
    const { data } = await supabase
        .from('ph_sss_brackets')
        .select('employee_contribution')
        .lte('range_from', monthlyBasic)
        .order('range_from', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data ? Number(data.employee_contribution) : 0;
};

// PH PhilHealth contribution
export const computePhilHealthContribution = async (monthlyBasic: number): Promise<number> => {
    const { data } = await supabase
        .from('ph_philhealth_config')
        .select('*')
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!data) return 0;
    const income = Math.min(Math.max(monthlyBasic, data.income_floor), data.income_ceiling);
    const total = income * data.premium_rate;
    const employee = total / 2;
    return Math.min(Math.max(employee, data.min_premium / 2), data.max_premium / 2);
};

// PH Pag-IBIG contribution
export const computePagIBIGContribution = async (monthlyBasic: number): Promise<number> => {
    const { data } = await supabase
        .from('ph_pagibig_config')
        .select('*')
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!data) return 0;
    const rate = monthlyBasic <= data.low_income_ceiling
        ? data.low_income_employee_rate
        : data.high_income_employee_rate;
    return Math.min(monthlyBasic * rate, data.max_employee_contribution);
};

// PH Withholding Tax (annualized method)
export const computeWithholdingTax = async (annualTaxableIncome: number): Promise<number> => {
    const { data } = await supabase
        .from('ph_tax_table')
        .select('*')
        .lte('bracket_from', annualTaxableIncome)
        .order('bracket_from', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!data) return 0;
    const excess = annualTaxableIncome - data.excess_over;
    return Number(data.base_tax) + excess * Number(data.rate);
};

// Compute full payroll record for one employee for a period.
// Attendance deductions (absent, late, undertime) reduce basicPay.
// OT/holiday pays from actual attendance are added to gross.
// deMinimisExempt is tax-free; deMinimisExcess is taxable.
export const computeEmployeePayroll = async (params: {
    employeeId: string;
    companyId: string;
    periodId: string;
    basicSalary: number;
    scheduledWorkDays: number;
    daysWorked: number;
    hoursWorked?: number;
    absentDays?: number;
    lateMinutes?: number;
    undertimeMinutes?: number;
    overtimeHours?: number;
    regularHolidayHours?: number;
    specialHolidayHours?: number;
    nightDiffHours?: number;
    restDayHours?: number;
    allowance?: number;
    otherBenefits?: number;
    deMinimisExempt?: number;
    deMinimisExcess?: number;
    payFrequency: PayFrequency;
    workSchedule?: WorkSchedule;
    employerShouldersContributions?: boolean;
    hourlyRateOverride?: number | null;
    shiftHours?: number;
    employmentType?: string;
}): Promise<Omit<PayrollRecord, 'id' | 'createdAt'>> => {
    const {
        employeeId, companyId, periodId, basicSalary,
        scheduledWorkDays, daysWorked,
        hoursWorked: hoursWorkedParam,
        absentDays = 0, lateMinutes = 0, undertimeMinutes = 0,
        overtimeHours = 0, regularHolidayHours = 0, specialHolidayHours = 0,
        nightDiffHours = 0, restDayHours = 0,
        allowance: rawAllowance = 0,
        otherBenefits: rawOtherBenefits = 0,
        deMinimisExempt = 0, deMinimisExcess = 0,
        payFrequency,
        workSchedule = WorkSchedule.MONDAY_TO_FRIDAY,
        employerShouldersContributions = false,
        hourlyRateOverride = null,
        shiftHours = 8,
        employmentType = '',
    } = params;

    const isPartTime = employmentType === EmploymentType.PART_TIME;

    // Allowance and other benefits split in half for semi-monthly (monthly amount ÷ 2)
    const benefitDivisor = payFrequency === 'semi-monthly' ? 2 : 1;
    const allowance     = rawAllowance / benefitDivisor;
    const otherBenefits = rawOtherBenefits / benefitDivisor;

    const monthlyBasic = basicSalary;
    // Daily rate per DOLE formula: monthly × 12 ÷ 52 ÷ working days per week
    const workDaysPerWeek = workingDayNumbers(workSchedule).length;
    const dailyRate    = (monthlyBasic * 12) / 52 / workDaysPerWeek;
    // Use manual override if set; otherwise divide daily rate by actual shift hours (8 for full-time, shift duration for part-time)
    const hourlyRate   = hourlyRateOverride != null ? hourlyRateOverride : dailyRate / shiftHours;
    const minuteRate   = hourlyRate / 60;

    // ── Basic Pay ────────────────────────────────────────────────────────────
    // Part-time: paid strictly for actual hours worked at their hourly rate.
    // Regular employees: semi-monthly = half monthly; others = daily rate × scheduled days.
    const actualHoursWorked = hoursWorkedParam ?? daysWorked * shiftHours;
    const basicPay = isPartTime
        ? actualHoursWorked * hourlyRate
        : payFrequency === 'semi-monthly'
            ? monthlyBasic / 2
            : dailyRate * scheduledWorkDays;

    // ── Attendance Deductions ─────────────────────────────────────────────────
    // Absences: missed scheduled work days with no approved leave (incl. unpaid leave)
    // Part-time has no absence deduction — their pay is already hours-based.
    const absentDeduction    = isPartTime ? 0 : absentDays * dailyRate;
    // Late/undertime deductions don't apply to part-time — pay is already hours-based.
    const lateDeduction      = isPartTime ? 0 : lateMinutes * minuteRate;
    const undertimeDeduction = isPartTime ? 0 : undertimeMinutes * minuteRate;

    // ── OT & Holiday Premiums (PH Labor Code) ────────────────────────────────
    // OT pay is suppressed when holiday hours are present — holiday pay already covers the full day.
    // Part-time: OT hours paid at base rate (1.0×) — no 25% premium.
    const isHolidayDay = regularHolidayHours > 0 || specialHolidayHours > 0;
    const overtimePay       = isHolidayDay ? 0 : isPartTime ? overtimeHours * hourlyRate * 1.0 : overtimeHours * hourlyRate * 1.25;
    const regularHolidayPay = isPartTime ? 0 : regularHolidayHours * hourlyRate * 1.0;
    const specialHolidayPay = isPartTime ? 0 : specialHolidayHours * hourlyRate * 0.30;
    const nightDiffPay      = isPartTime ? 0 : nightDiffHours * hourlyRate * 0.10;
    const restDayPay        = isPartTime ? 0 : restDayHours * hourlyRate * 0.30;

    const thirteenthMonthAccrued = monthlyBasic / 12;
    const totalDeMinimis = deMinimisExempt + deMinimisExcess;

    // ── Contributions — part-time employees are exempt ───────────────────────
    const monthlySss        = isPartTime ? 0 : await computeSSSContribution(monthlyBasic);
    const monthlyPhilhealth = isPartTime ? 0 : await computePhilHealthContribution(monthlyBasic);
    const monthlyPagibig    = isPartTime ? 0 : await computePagIBIGContribution(monthlyBasic);
    const sssContribution        = monthlySss        / benefitDivisor;
    const philhealthContribution = monthlyPhilhealth / benefitDivisor;
    const pagibigContribution    = monthlyPagibig    / benefitDivisor;
    const totalContributions     = sssContribution + philhealthContribution + pagibigContribution;

    // When employer shoulders contributions, the contribution amount is added to
    // gross pay as an employer benefit, then deducted normally — they cancel out
    // so the employee's take-home = basic − tax only.
    const employerContributionsBenefit = employerShouldersContributions ? totalContributions : 0;

    // ── Gross Pay ─────────────────────────────────────────────────────────────
    const grossPay = basicPay
        + overtimePay + regularHolidayPay + specialHolidayPay + nightDiffPay + restDayPay
        - absentDeduction - lateDeduction - undertimeDeduction
        + allowance + otherBenefits + totalDeMinimis
        + employerContributionsBenefit;

    // ── Withholding Tax — BIR Annualized Method (TRAIN Law) ──────────────────
    const monthlyTotalContributions = monthlySss + monthlyPhilhealth + monthlyPagibig;
    const monthlyTaxableComp = isPartTime ? 0 : Math.max(0, monthlyBasic + deMinimisExcess - monthlyTotalContributions);
    const annualTaxable      = monthlyTaxableComp * 12;
    const annualTax          = isPartTime ? 0 : await computeWithholdingTax(annualTaxable);
    const periodsPerMonth: Record<PayFrequency, number> = {
        monthly: 1, 'semi-monthly': 2, 'bi-weekly': 2.1667, weekly: 4.3333,
    };
    const withholdingTax = isPartTime ? 0 : Math.max(0, annualTax / 12 / periodsPerMonth[payFrequency]);

    // ── Net Pay ───────────────────────────────────────────────────────────────
    // Contributions always deducted — when employer shoulders, the benefit added
    // to gross cancels them out, so net = basic − tax only.
    const totalDeductions = totalContributions + withholdingTax;
    const netPay = grossPay - totalDeductions;

    return {
        companyId,
        periodId,
        employeeId,
        basicSalary,
        dailyRate,
        daysWorked,
        hoursWorked: actualHoursWorked,
        basicPay,
        absentDays,
        absentDeduction,
        lateMinutes,
        lateDeduction,
        undertimeMinutes,
        undertimeDeduction,
        overtimeHours,
        overtimePay,
        regularHolidayHours,
        regularHolidayPay,
        specialHolidayHours,
        specialHolidayPay,
        nightDiffHours,
        nightDiffPay,
        restDayHours,
        restDayPay,
        allowance,
        otherBenefits,
        deMinimis: totalDeMinimis,
        thirteenthMonthAccrued,
        grossPay,
        sssContribution,
        philhealthContribution,
        pagibigContribution,
        totalContributions,
        employerContributionsBenefit,
        taxableIncome: monthlyTaxableComp,
        withholdingTax,
        sssLoan: 0,
        pagibigLoan: 0,
        cashAdvance: 0,
        otherDeductions: 0,
        totalDeductions,
        netPay,
        status: 'Draft',
        notes: '',
    };
};

// BIR de minimis monthly ceilings (TRAIN Law / RR 5-2011 as amended)
export const DE_MINIMIS_CEILINGS: Record<DeMinimisType, { label: string; monthlyCeiling: number; note: string }> = {
    rice_subsidy:               { label: 'Rice Subsidy',                  monthlyCeiling: 3000,  note: 'Max ₱3,000/month (RR 5-2011)' },
    uniform_clothing:           { label: 'Uniform & Clothing Allowance',  monthlyCeiling: 500,   note: 'Max ₱6,000/year (₱500/month)' },
    medical_cash_allowance:     { label: 'Medical Cash Allowance',        monthlyCeiling: 750,   note: 'Max ₱1,500/semester (₱750/quarter)' },
    laundry_allowance:          { label: 'Laundry Allowance',             monthlyCeiling: 300,   note: 'Max ₱300/month' },
    employee_achievement_award: { label: 'Employee Achievement Award',    monthlyCeiling: 833,   note: 'Max ₱10,000/year (₱833/month)' },
    christmas_gift:             { label: 'Christmas / Anniversary Gift',  monthlyCeiling: 417,   note: 'Max ₱5,000/year (₱417/month)' },
    meal_allowance_overtime:    { label: 'Meal Allowance (OT)',           monthlyCeiling: 1200,  note: '25% of min. wage per OT meal' },
    actual_medical_benefits:    { label: 'Actual Medical Benefits',       monthlyCeiling: 833,   note: 'Max ₱10,000/year (₱833/month)' },
    other:                      { label: 'Other De Minimis',              monthlyCeiling: 0,     note: 'Enter ceiling manually' },
};

export const computeDeMinimisItem = (
    benefitType: DeMinimisType,
    amountThisPeriod: number,
    customMonthlyCeiling?: number,
): { monthlyCeiling: number; exemptAmount: number; taxableExcess: number } => {
    const cfg = DE_MINIMIS_CEILINGS[benefitType];
    const ceiling = customMonthlyCeiling ?? cfg.monthlyCeiling;
    const exemptAmount = Math.min(amountThisPeriod, ceiling);
    const taxableExcess = Math.max(0, amountThisPeriod - ceiling);
    return { monthlyCeiling: ceiling, exemptAmount, taxableExcess };
};

export const getDeMinimisForPeriodEmployee = async (
    periodId: string,
    employeeId: string,
): Promise<DeMinimisItem[]> => {
    try {
        await ensureUserContext();
        const { data, error } = await supabase
            .from('payroll_de_minimis')
            .select('*')
            .eq('period_id', periodId)
            .eq('employee_id', employeeId);
        if (error) throw error;
        return (data ?? []).map((r: any) => ({
            id: r.id,
            companyId: r.company_id,
            periodId: r.period_id,
            employeeId: r.employee_id,
            benefitType: r.benefit_type,
            description: r.description ?? '',
            amountThisPeriod: Number(r.amount_this_period),
            monthlyCeiling: Number(r.monthly_ceiling),
            exemptAmount: Number(r.exempt_amount),
            taxableExcess: Number(r.taxable_excess),
            createdAt: r.created_at,
        }));
    } catch (err) {
        console.error('getDeMinimisForPeriodEmployee error:', err);
        return [];
    }
};

export const upsertDeMinimisItem = async (item: {
    periodId: string;
    employeeId: string;
    benefitType: DeMinimisType;
    description?: string;
    amountThisPeriod: number;
    customMonthlyCeiling?: number;
}): Promise<DeMinimisItem | null> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) throw new Error('Company ID not set');
        const { monthlyCeiling, exemptAmount, taxableExcess } = computeDeMinimisItem(
            item.benefitType, item.amountThisPeriod, item.customMonthlyCeiling,
        );
        // Delete existing entry of same type for this employee+period, then re-insert
        await supabase
            .from('payroll_de_minimis')
            .delete()
            .eq('period_id', item.periodId)
            .eq('employee_id', item.employeeId)
            .eq('benefit_type', item.benefitType);

        const { data, error } = await supabase
            .from('payroll_de_minimis')
            .insert([{
                company_id: currentCompanyId,
                period_id: item.periodId,
                employee_id: item.employeeId,
                benefit_type: item.benefitType,
                description: item.description ?? DE_MINIMIS_CEILINGS[item.benefitType].label,
                amount_this_period: item.amountThisPeriod,
                monthly_ceiling: monthlyCeiling,
                exempt_amount: exemptAmount,
                taxable_excess: taxableExcess,
            }])
            .select()
            .single();
        if (error) throw error;
        return {
            id: data.id,
            companyId: data.company_id,
            periodId: data.period_id,
            employeeId: data.employee_id,
            benefitType: data.benefit_type,
            description: data.description ?? '',
            amountThisPeriod: Number(data.amount_this_period),
            monthlyCeiling: Number(data.monthly_ceiling),
            exemptAmount: Number(data.exempt_amount),
            taxableExcess: Number(data.taxable_excess),
            createdAt: data.created_at,
        };
    } catch (err) {
        console.error('upsertDeMinimisItem error:', err);
        return null;
    }
};

export const deleteDeMinimisItem = async (id: string): Promise<void> => {
    try {
        await ensureUserContext();
        await supabase.from('payroll_de_minimis').delete().eq('id', id);
    } catch (err) {
        console.error('deleteDeMinimisItem error:', err);
    }
};

export const getPayrollPeriods = async (): Promise<PayrollPeriod[]> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) { console.error('getPayrollPeriods: no company ID'); return []; }
        const { data, error } = await supabase
            .from('payroll_periods')
            .select('*')
            .eq('company_id', currentCompanyId)
            .order('period_start', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(dbPeriodToPayrollPeriod);
    } catch (err) {
        console.error('getPayrollPeriods error:', err);
        return [];
    }
};

export const createPayrollPeriod = async (period: {
    periodName: string;
    payFrequency: PayFrequency;
    periodStart: string;
    periodEnd: string;
    payDate: string;
    notes?: string;
}): Promise<PayrollPeriod | { error: string }> => {
    if (!currentCompanyId) return { error: 'Company ID not set. Please log out and log back in.' };
    const { data, error } = await supabase.rpc('create_payroll_period', {
        p_company_id:    currentCompanyId,
        p_period_name:   period.periodName,
        p_pay_frequency: period.payFrequency,
        p_period_start:  period.periodStart,
        p_period_end:    period.periodEnd,
        p_pay_date:      period.payDate,
        p_notes:         period.notes ?? '',
    });
    if (error) {
        console.error('createPayrollPeriod error:', error);
        return { error: error.message };
    }
    return dbPeriodToPayrollPeriod(data);
};

export const updatePayrollPeriodStatus = async (periodId: string, status: PayrollStatus): Promise<void> => {
    try {
        if (!currentCompanyId) return;
        await ensureUserContext();
        await supabase.rpc('update_payroll_period_status', {
            p_period_id:  periodId,
            p_company_id: currentCompanyId,
            p_status:     status,
        });
        if (status === 'Paid') {
            await supabase
                .from('payroll_records')
                .update({ status: 'Paid', updated_at: new Date().toISOString() })
                .eq('period_id', periodId);
        }
        if (status === 'Draft' || status === 'Finalized') {
            await supabase
                .from('payroll_records')
                .update({ status: 'Draft', updated_at: new Date().toISOString() })
                .eq('period_id', periodId);
        }
    } catch (err) {
        console.error('updatePayrollPeriodStatus error:', err);
    }
};

export const markEmployeesPaid = async (periodId: string, employeeIds: string[]): Promise<void> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId || employeeIds.length === 0) return;
        await supabase
            .from('payroll_records')
            .update({ status: 'Paid', updated_at: new Date().toISOString() })
            .eq('period_id', periodId)
            .in('employee_id', employeeIds);

        // If all records in this period are now Paid, mark the period itself as Paid
        const { data: remaining } = await supabase
            .from('payroll_records')
            .select('id')
            .eq('period_id', periodId)
            .neq('status', 'Paid');
        if (!remaining || remaining.length === 0) {
            await supabase.rpc('update_payroll_period_status', {
                p_period_id:  periodId,
                p_company_id: currentCompanyId,
                p_status:     'Paid',
            });
        }
    } catch (err) {
        console.error('markEmployeesPaid error:', err);
    }
};

export const deletePayrollPeriod = async (periodId: string): Promise<void> => {
    try {
        if (!currentCompanyId) return;
        await ensureUserContext();
        await supabase.from('payroll_adjustments').delete().eq('period_id', periodId);
        await supabase.from('payroll_records').delete().eq('period_id', periodId);
        await supabase.rpc('delete_payroll_period', {
            p_period_id:  periodId,
            p_company_id: currentCompanyId,
        });
    } catch (err) {
        console.error('deletePayrollPeriod error:', err);
    }
};

export const getPayrollRecords = async (periodId: string): Promise<PayrollRecord[]> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) { console.error('getPayrollRecords: no company ID'); return []; }
        const { data, error } = await supabase
            .from('payroll_records')
            .select('*')
            .eq('period_id', periodId)
            .eq('company_id', currentCompanyId);
        if (error) throw error;
        return (data ?? []).map(dbRecordToPayrollRecord);
    } catch (err) {
        console.error('getPayrollRecords error:', err);
        return [];
    }
};

export const getEmployeePayslips = async (employeeId: string): Promise<{ period: PayrollPeriod; record: PayrollRecord; adjustments: PayrollAdjustment[] }[]> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) return [];
        const { data: periods, error: pErr } = await supabase
            .from('payroll_periods')
            .select('*')
            .eq('company_id', currentCompanyId)
            .in('status', ['Finalized', 'Paid'])
            .order('period_start', { ascending: false });
        if (pErr) throw pErr;
        if (!periods || periods.length === 0) return [];

        const periodIds = periods.map((p: any) => p.id);

        const [{ data: records, error: rErr }, { data: adjRows, error: aErr }] = await Promise.all([
            supabase.from('payroll_records').select('*').eq('company_id', currentCompanyId).eq('employee_id', employeeId).in('period_id', periodIds),
            supabase.from('payroll_adjustments').select('*').eq('company_id', currentCompanyId).eq('employee_id', employeeId).in('period_id', periodIds),
        ]);
        if (rErr) throw rErr;
        if (aErr) throw aErr;

        const recordMap = new Map((records ?? []).map((r: any) => [r.period_id, dbRecordToPayrollRecord(r)]));
        const adjsByPeriod = new Map<string, PayrollAdjustment[]>();
        for (const a of (adjRows ?? [])) {
            const list = adjsByPeriod.get(a.period_id) ?? [];
            list.push({ id: a.id, companyId: a.company_id, periodId: a.period_id, employeeId: a.employee_id, adjustmentType: a.adjustment_type, amount: Number(a.amount), description: a.description ?? '', createdAt: a.created_at });
            adjsByPeriod.set(a.period_id, list);
        }

        return periods
            .map((p: any) => ({ period: dbPeriodToPayrollPeriod(p), record: recordMap.get(p.id), adjustments: adjsByPeriod.get(p.id) ?? [] }))
            .filter((x): x is { period: PayrollPeriod; record: PayrollRecord; adjustments: PayrollAdjustment[] } => !!x.record);
    } catch (err) {
        console.error('getEmployeePayslips error:', err);
        return [];
    }
};

export const upsertPayrollRecord = async (record: Omit<PayrollRecord, 'id'>): Promise<PayrollRecord | null> => {
    try {
        const { data, error } = await supabase.rpc('upsert_payroll_record', {
            p_company_id:               record.companyId,
            p_period_id:                record.periodId,
            p_employee_id:              record.employeeId,
            p_basic_salary:             record.basicSalary,
            p_daily_rate:               record.dailyRate,
            p_days_worked:              record.daysWorked,
            p_hours_worked:             record.hoursWorked,
            p_basic_pay:                record.basicPay,
            p_absent_days:              record.absentDays,
            p_absent_deduction:         record.absentDeduction,
            p_late_minutes:             record.lateMinutes,
            p_late_deduction:           record.lateDeduction,
            p_undertime_minutes:        record.undertimeMinutes,
            p_undertime_deduction:      record.undertimeDeduction,
            p_overtime_hours:           record.overtimeHours,
            p_overtime_pay:             record.overtimePay,
            p_regular_holiday_hours:    record.regularHolidayHours,
            p_regular_holiday_pay:      record.regularHolidayPay,
            p_special_holiday_hours:    record.specialHolidayHours,
            p_special_holiday_pay:      record.specialHolidayPay,
            p_night_diff_hours:         record.nightDiffHours,
            p_night_diff_pay:           record.nightDiffPay,
            p_rest_day_hours:           record.restDayHours,
            p_rest_day_pay:             record.restDayPay,
            p_allowance:                record.allowance,
            p_other_benefits:           record.otherBenefits,
            p_de_minimis:               record.deMinimis,
            p_thirteenth_month_accrued: record.thirteenthMonthAccrued,
            p_gross_pay:                record.grossPay,
            p_sss_contribution:         record.sssContribution,
            p_philhealth_contribution:  record.philhealthContribution,
            p_pagibig_contribution:     record.pagibigContribution,
            p_total_contributions:      record.totalContributions,
            p_taxable_income:           record.taxableIncome,
            p_withholding_tax:          record.withholdingTax,
            p_sss_loan:                 record.sssLoan,
            p_pagibig_loan:             record.pagibigLoan,
            p_cash_advance:             record.cashAdvance,
            p_other_deductions:              record.otherDeductions,
            p_total_deductions:              record.totalDeductions,
            p_net_pay:                       record.netPay,
            p_status:                        record.status,
            p_notes:                         record.notes,
            p_employer_contributions_benefit: record.employerContributionsBenefit,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return null;
        return dbRecordToPayrollRecord(row);
    } catch (err) {
        console.error('upsertPayrollRecord error:', err);
        return null;
    }
};

export const generatePayrollForPeriod = async (
    period: PayrollPeriod,
    employees: Employee[],
    options?: {
        shifts?: Shift[];
        workSchedule?: WorkSchedule;
        gracePeriodMinutes?: number;
        holidays?: Holiday[];
        employerShouldersContributions?: boolean;
    }
): Promise<PayrollRecord[]> => {
    // WorkSchedule is statically imported at the top of this file
    const shifts = options?.shifts ?? [];
    const gracePeriodMinutes = options?.gracePeriodMinutes ?? 5;
    const holidays = options?.holidays ?? [];
    const companyWorkSchedule = options?.workSchedule ?? WorkSchedule.MONDAY_TO_FRIDAY;
    const employerShouldersContributions = options?.employerShouldersContributions ?? false;

    const results: PayrollRecord[] = [];
    for (const emp of employees) {
        if (emp.status !== 'Active') continue;
        // Skip employees not yet hired as of the period end date
        if (emp.dateHired && emp.dateHired > period.periodEnd) continue;
        const latestSalary = emp.salaryHistory?.[0];
        if (!latestSalary) continue;

        const shift = shifts.find(s => s.id === emp.shiftId) ?? null;
        const empSchedule = emp.workSchedule ?? companyWorkSchedule;

        // For part-time employees, derive shift hours from their assigned shift instead of assuming 8h
        const shiftHours = (emp.employmentType === EmploymentType.PART_TIME && shift)
            ? (timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime)) / 60
            : 8;

        const attendance = await analyzeAttendanceForPayroll({
            employeeId: emp.id,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            shift,
            workSchedule: empSchedule,
            gracePeriodMinutes,
            holidays,
        });

        const computed = await computeEmployeePayroll({
            employeeId: emp.id,
            companyId: emp.companyId,
            periodId: period.id,
            basicSalary: latestSalary.basicSalary,
            scheduledWorkDays: attendance.scheduledWorkDays,
            daysWorked: attendance.daysWorked,
            hoursWorked: attendance.hoursWorked,
            absentDays: attendance.absentDays,
            lateMinutes: attendance.lateMinutes,
            undertimeMinutes: attendance.undertimeMinutes,
            overtimeHours: attendance.overtimeHours,
            regularHolidayHours: attendance.regularHolidayHours,
            specialHolidayHours: attendance.specialHolidayHours,
            nightDiffHours: attendance.nightDiffHours,
            restDayHours: attendance.restDayHours,
            allowance: latestSalary.allowance,
            otherBenefits: latestSalary.otherBenefits ?? 0,
            payFrequency: period.payFrequency,
            workSchedule: empSchedule,
            employerShouldersContributions,
            hourlyRateOverride: latestSalary.hourlyRate ?? null,
            shiftHours,
            employmentType: emp.employmentType,
        });
        const saved = await upsertPayrollRecord(computed);
        if (saved) results.push(saved);
    }
    return results;
};

export const getPayrollAdjustments = async (periodId: string): Promise<PayrollAdjustment[]> => {
    try {
        await ensureUserContext();
        if (!currentCompanyId) { console.error('getPayrollAdjustments: no company ID'); return []; }
        const { data, error } = await supabase.rpc('get_payroll_adjustments', {
            p_company_id: currentCompanyId,
            p_period_id:  periodId,
        });
        if (error) throw error;
        return (data ?? []).map((r: any) => ({
            id: r.id,
            companyId: r.company_id,
            periodId: r.period_id,
            employeeId: r.employee_id,
            adjustmentType: r.adjustment_type,
            amount: Number(r.amount),
            description: r.description ?? '',
            createdAt: r.created_at,
        }));
    } catch (err) {
        console.error('getPayrollAdjustments error:', err);
        return [];
    }
};

export const addPayrollAdjustment = async (adj: {
    periodId: string;
    employeeId: string;
    adjustmentType: AdjustmentType;
    amount: number;
    description: string;
}): Promise<void> => {
    await ensureUserContext();
    if (!currentCompanyId) throw new Error('Company ID not set');
    const { error } = await supabase.rpc('add_payroll_adjustment', {
        p_company_id:       currentCompanyId,
        p_period_id:        adj.periodId,
        p_employee_id:      adj.employeeId,
        p_adjustment_type:  adj.adjustmentType,
        p_amount:           adj.amount,
        p_description:      adj.description,
    });
    if (error) throw error;
};

// Note: This is a starter implementation. You'll need to implement additional functions
// based on your application's needs. The key functions for authentication and basic
// employee management are provided above.
