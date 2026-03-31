
export enum UserRole {
  EMPLOYEE = 'employee',
  EMPLOYER = 'employer',
}

export interface UserAccount {
    email: string;
    password: string; // In a real app, this would be a hash
    role: UserRole;
    employeeId: string;
}

export enum LeaveType {
  CLIENT_HOLIDAY = 'Client Holiday Leave',
  SICK = 'Sick Leave',
  VACATION = 'Vacation Leave',
  EMERGENCY = 'Emergency Leave',
  UNPAID = 'Unpaid Leave',
}

export enum RequestType {
    LEAVE = 'Leave',
    OVERTIME = 'Overtime',
    UNDERTIME = 'Undertime',
    CHANGE_REQUEST = 'Information Change',
}

export enum RequestStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export enum EmployeeStatus {
    ACTIVE = 'Active',
    TERMINATED = 'Terminated',
}

export enum EmploymentType {
    FULL_TIME = 'Full-Time',
    PART_TIME = 'Part-Time',
    PROBATIONARY = 'Probationary',
    INTERN = 'Intern',
}

export enum TaskStatus {
    TODO = 'To Do',
    IN_PROGRESS = 'In Progress',
    COMPLETED = 'Completed',
}

export interface Task {
    id: string;
    employeeId: string;
    title: string;
    description?: string;
    dueDate: string; // "YYYY-MM-DD"
    status: TaskStatus;
    dateCreated: string; // ISO String
    dateCompleted?: string; // ISO String
}

export interface Shift {
    id: string;
    name: string;
    startTime: string; // "HH:MM"
    endTime: string; // "HH:MM"
}

export interface SalaryHistoryRecord {
    id: string;
    effectiveDate: string; // "YYYY-MM-DD"
    basicSalary: number;
    allowance: number;
    otherBenefits: number;
}

export enum CustomFieldType {
    TEXT = 'Text',
    NUMBER = 'Number',
    DATE = 'Date',
    DROPDOWN = 'Dropdown',
}

export interface CustomFieldDefinition {
    id: string;
    name: string;
    type: CustomFieldType;
    options?: string[]; // For dropdown type
}

export interface Employee {
    id: string;
    companyId: string;
    employeeId: string;
    email: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    address: string;
    birthdate: string;
    mobileNumber: string;
    department: string;
    tinNumber: string;
    sssNumber: string;
    pagibigNumber: string;
    philhealthNumber: string;
    dateHired: string;
    dateTerminated?: string;
    status: EmployeeStatus;
    employmentType: EmploymentType;
    salaryHistory: SalaryHistoryRecord[];
    shiftId: string;
    workSchedule?: WorkSchedule;
    profilePicture?: string; // base64 string
    // For simplicity, we'll store file names. In a real app, this would be a link to storage.
    files: string[];
    notes?: string;
    vacationLeaveAdjustment?: number;
    sickLeaveAdjustment?: number;
    customFields?: { [key: string]: string | number | boolean };
}

export interface BaseRequest {
    id: string;
    employeeId: string;
    type: RequestType;
    status: RequestStatus;
    dateFiled: string;
}

export interface LeaveRequest extends BaseRequest {
    type: RequestType.LEAVE;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
}

export interface OtUtRequest extends BaseRequest {
    type: RequestType.OVERTIME | RequestType.UNDERTIME;
    date: string;
    hours: number;
    reason: string;
}

export interface ChangeRequest extends BaseRequest {
    type: RequestType.CHANGE_REQUEST;
    changes: Partial<Omit<Employee, 'id' | 'files' | 'profilePicture' | 'status' | 'employeeId'>>;
    reason: string;
}


export type AppRequest = LeaveRequest | OtUtRequest | ChangeRequest;

export interface GeolocationData {
    latitude: number;
    longitude: number;
    accuracy?: number;
}

export interface AttendanceRecord {
    id: string;
    employeeId: string;
    clockInTime: string;
    clockInPhoto?: string; // base64 string - Made optional for manual entry
    clockInLocation?: GeolocationData; // Made optional for manual entry
    clockOutTime?: string;
    clockOutPhoto?: string; // base64 string
    clockOutLocation?: GeolocationData;
    endOfDayNotes?: string;
    manualEntryReason?: string; // To store reason for manual entry/edit
    status?: 'On Time' | 'Late'; // Only for first clock-in of the day
}

export interface Holiday {
    id: string;
    name: string;
    date: string; // "YYYY-MM-DD"
    country: string; // e.g., 'PH', 'AU', 'UK'
    type: 'Regular' | 'Special';
}

export enum WorkSchedule {
    MONDAY_TO_FRIDAY = 'Monday to Friday',
    MONDAY_TO_SATURDAY = 'Monday to Saturday',
    MONDAY_TO_SUNDAY = 'Monday to Sunday',
}

export interface CompanyProfile {
    id: string;
    name: string;
    address: string;
    contactNumber: string;
    email: string;
    tin: string;
    logo?: string; // base64 string
    workSchedule: WorkSchedule;
    gracePeriodMinutes?: number;
}

export interface AuditLogChange {
    field: string;
    oldValue: string;
    newValue: string;
}

export interface AuditLog {
    id: string;
    employeeId: string;
    editorId: string;
    timestamp: string;
    changes: AuditLogChange[];
}

export interface LeavePolicy {
    id: string;
    baseVacationDaysPerYear: number;
    baseSickDaysPerYear: number;
    tenureBonusEnabled: boolean;
    tenureBonusYearsInterval: number; // Add 1 day for every X years of service
    maxTenureBonusDays: number;
}

export interface LeaveBalance {
    vacation: {
        accrued: number;
        used: number;
        available: number;
    };
    sick: {
        accrued: number;
        used: number;
        available: number;
    };
}

export interface EmployeeFile {
    id: string;
    companyId: string;
    employeeId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileData: string; // base64 encoded
    description?: string;
    uploadedBy: string;
    uploadedAt: string;
}
