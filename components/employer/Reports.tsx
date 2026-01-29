
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as api from '../../services/supabaseApi';
import { AttendanceRecord, Employee, Shift, AppRequest, Holiday, RequestType, RequestStatus, CompanyProfile, WorkSchedule } from '../../types';
import ManualAttendanceModal from './ManualAttendanceModal';

const StatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
    const statusClasses = {
        [RequestStatus.PENDING]: 'status-badge-pending',
        [RequestStatus.APPROVED]: 'status-badge-approved',
        [RequestStatus.REJECTED]: 'status-badge-rejected',
    };
    return <span className={`status-badge ${statusClasses[status]}`}>{status}</span>;
}

// Define a type for the payroll summary items
type PayrollSummaryItem = {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    totalHours: string;
    otHours: string;
    leaveDays: number;
    grossPay: string;
};


export const Reports: React.FC = () => {
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [requests, setRequests] = useState<AppRequest[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [recordToEdit, setRecordToEdit] = useState<AttendanceRecord | undefined>(undefined);
    
    // Payroll state
    const [payrollSummary, setPayrollSummary] = useState<PayrollSummaryItem[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processMessage, setProcessMessage] = useState('');

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(lastDayOfMonth);

    const fetchData = useCallback(() => {
        setAttendance(api.getAttendance());
        setEmployees(api.getEmployees());
        setShifts(api.getShifts());
        setRequests(api.getRequests());
        setHolidays(api.getHolidays());
        setCompanyProfile(api.getCompanyProfile());
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getEmployee = (id: string) => employees.find(e => e.id === id);
    const getShift = (id: string) => shifts.find(s => s.id === id);
    
    const handleOpenAddModal = () => {
        setRecordToEdit(undefined);
        setIsManualModalOpen(true);
    };

    const handleOpenEditModal = (record: AttendanceRecord) => {
        setRecordToEdit(record);
        setIsManualModalOpen(true);
    };

    const handleModalSuccess = () => {
        setIsManualModalOpen(false);
        setRecordToEdit(undefined);
        fetchData();
    };

    const handleGeneratePayroll = () => {
        setIsGenerating(true);
        setProcessMessage('');
        // Simulate a short delay for calculation
        setTimeout(() => {
            const summary = api.calculatePayrollSummary(startDate, endDate);
            setPayrollSummary(summary);
            setIsGenerating(false);
        }, 500);
    };

    const handleProcessPayroll = async () => {
        if (payrollSummary.length === 0) return;
        
        setIsProcessing(true);
        setProcessMessage('');
        const result = await api.processPayrollAndNotify(payrollSummary);
        setIsProcessing(false);
        
        if(result.successCount > 0) {
            setProcessMessage(`${result.successCount} of ${payrollSummary.length} payslip notifications sent successfully.`);
        } else {
             setProcessMessage(`Failed to send notifications. Please check your EmailJS configuration.`);
        }
    };


    const filteredAttendance = useMemo(() => {
        return attendance.filter(record => {
            const recordDate = record.clockInTime.split('T')[0];
            return recordDate >= startDate && recordDate <= endDate;
        }).sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime());
    }, [attendance, startDate, endDate]);

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const reqDate = req.type === RequestType.LEAVE ? req.startDate : req.date;
             if (req.type === RequestType.LEAVE) {
                return !(new Date(req.endDate) < new Date(startDate) || new Date(req.startDate) > new Date(endDate));
            }
            return reqDate >= startDate && reqDate <= endDate;
        }).sort((a, b) => new Date(b.dateFiled).getTime() - new Date(a.dateFiled).getTime());
    }, [requests, startDate, endDate]);

     const filteredAbsences = useMemo(() => {
        const absences: { employee: Employee; date: string }[] = [];
        const holidaysSet = new Set(holidays.map(h => h.date));
        
        const attendanceMap = new Map<string, Set<string>>();
        filteredAttendance.forEach(a => {
            const date = a.clockInTime.split('T')[0];
            if (!attendanceMap.has(a.employeeId)) {
                attendanceMap.set(a.employeeId, new Set());
            }
            attendanceMap.get(a.employeeId)!.add(date);
        });

        const onLeaveMap = new Map<string, Set<string>>();
        filteredRequests.forEach(req => {
            if (req.type === RequestType.LEAVE && req.status === RequestStatus.APPROVED) {
                if (!onLeaveMap.has(req.employeeId)) {
                    onLeaveMap.set(req.employeeId, new Set());
                }
                let currentDate = new Date(req.startDate + 'T00:00:00');
                const stopDate = new Date(req.endDate + 'T00:00:00');
                while (currentDate <= stopDate) {
                    onLeaveMap.get(req.employeeId)!.add(currentDate.toISOString().split('T')[0]);
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
        });

        let currentDay = new Date(startDate + 'T00:00:00');
        const endDay = new Date(endDate + 'T00:00:00');
        const workSchedule = companyProfile?.workSchedule;

        while (currentDay <= endDay) {
            const dayOfWeek = currentDay.getDay(); // Sun=0, ..., Sat=6
            const dateStr = currentDay.toISOString().split('T')[0];

            let isWorkDay = false;
            switch (workSchedule) {
                case WorkSchedule.MONDAY_TO_SATURDAY:
                    isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 6;
                    break;
                case WorkSchedule.MONDAY_TO_SUNDAY:
                    isWorkDay = true;
                    break;
                case WorkSchedule.MONDAY_TO_FRIDAY:
                default:
                    isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 5;
                    break;
            }

            if (isWorkDay && !holidaysSet.has(dateStr)) {
                employees.forEach(employee => {
                    const hasAttendance = attendanceMap.get(employee.id)?.has(dateStr);
                    const isOnLeave = onLeaveMap.get(employee.id)?.has(dateStr);
                    
                    if (!hasAttendance && !isOnLeave) {
                        absences.push({ employee, date: dateStr });
                    }
                });
            }
            currentDay.setDate(currentDay.getDate() + 1);
        }
        return absences;
    }, [startDate, endDate, holidays, filteredAttendance, filteredRequests, employees, companyProfile]);

    const calculateStatus = (record: AttendanceRecord): { totalHours: string; status: string } => {
        if (!record.clockOutTime) return { totalHours: 'N/A', status: 'Not Clocked Out' };

        const clockIn = new Date(record.clockInTime);
        const clockOut = new Date(record.clockOutTime);
        const diffMs = clockOut.getTime() - clockIn.getTime();
        const totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
        
        const employee = getEmployee(record.employeeId);
        const shift = employee ? getShift(employee.shiftId) : undefined;
        let status = 'On Time';
        if (shift) {
            const [shiftHour, shiftMin] = shift.startTime.split(':').map(Number);
            if (clockIn.getHours() > shiftHour || (clockIn.getHours() === shiftHour && clockIn.getMinutes() > shiftMin)) {
                status = 'Late';
            }
        }
        
        return { totalHours, status };
    };
    
    const exportToCSV = (exportType: 'all' | 'attendance' | 'requests' | 'absences') => {
        let csvContent = "data:text/csv;charset=utf-8,";
        let fileName = `report_${startDate}_to_${endDate}.csv`;
        
        const escapeCSV = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;

        switch(exportType) {
            case 'attendance':
                fileName = `attendance_${startDate}_to_${endDate}.csv`;
                csvContent += "Employee,Date,Clock In,Clock In Location,Clock Out,Total Hours,Status\n";
                filteredAttendance.forEach(record => {
                    const employee = getEmployee(record.employeeId);
                    const empName = employee ? `${employee.firstName} ${employee.lastName}` : "Unknown";
                    const date = new Date(record.clockInTime).toLocaleDateString();
                    const clockIn = new Date(record.clockInTime).toLocaleTimeString();
                    const location = record.clockInLocation ? `${record.clockInLocation.latitude}, ${record.clockInLocation.longitude}` : 'N/A';
                    const clockOut = record.clockOutTime ? new Date(record.clockOutTime).toLocaleTimeString() : 'N/A';
                    const { totalHours, status } = calculateStatus(record);
                    csvContent += [empName, date, clockIn, location, clockOut, totalHours, status].map(escapeCSV).join(",") + "\n";
                });
                break;
            case 'requests':
                fileName = `requests_${startDate}_to_${endDate}.csv`;
                csvContent += "Employee,Type,Details,Date Filed,Status\n";
                filteredRequests.forEach(req => {
                    const employee = getEmployee(req.employeeId);
                    const empName = employee ? `${employee.firstName} ${employee.lastName}` : "Unknown";
                    const date = req.type === RequestType.LEAVE ? `${req.startDate} to ${req.endDate}` : req.date;
                    const details = req.type === RequestType.LEAVE ? `${req.leaveType}` : `${req.hours} hrs`;
                    csvContent += [empName, req.type, `${date}, ${details}`, new Date(req.dateFiled).toLocaleDateString(), req.status].map(escapeCSV).join(",") + "\n";
                });
                break;
            case 'absences':
                 fileName = `absences_${startDate}_to_${endDate}.csv`;
                 csvContent += "Employee,Date of Absence,Status\n";
                 filteredAbsences.forEach(({employee, date}) => {
                     csvContent += [`${employee.firstName} ${employee.lastName}`, date, "Absent"].map(escapeCSV).join(",") + "\n";
                 });
                 break;
            case 'all':
            default:
                csvContent += "Report Type,Employee,Date,Details,Status/Total Hours\n";
                filteredAttendance.forEach(record => {
                    const employee = getEmployee(record.employeeId);
                    const empName = employee ? `${employee.firstName} ${employee.lastName}` : "Unknown";
                    const date = new Date(record.clockInTime).toLocaleDateString();
                    const locationInfo = record.clockInLocation ? ` Location: (${record.clockInLocation.latitude.toFixed(5)}, ${record.clockInLocation.longitude.toFixed(5)})` : '';
                    const details = `Clock In: ${new Date(record.clockInTime).toLocaleTimeString()}, Clock Out: ${record.clockOutTime ? new Date(record.clockOutTime).toLocaleTimeString() : 'N/A'}${locationInfo}`;
                    const { totalHours } = calculateStatus(record);
                    csvContent += ["Attendance", empName, date, details, totalHours].map(escapeCSV).join(",") + "\n";
                });
                filteredRequests.forEach(req => {
                    const employee = getEmployee(req.employeeId);
                    const empName = employee ? `${employee.firstName} ${employee.lastName}` : "Unknown";
                    const date = req.type === RequestType.LEAVE ? `${req.startDate} to ${req.endDate}` : req.date;
                    const details = req.type === RequestType.LEAVE ? `${req.leaveType}` : `${req.hours} hrs`;
                    csvContent += [req.type, empName, date, details, req.status].map(escapeCSV).join(",") + "\n";
                });
                filteredAbsences.forEach(({employee, date}) => {
                    csvContent += ["Absence", `${employee.firstName} ${employee.lastName}`, date, "No clock-in or approved leave", "Absent"].map(escapeCSV).join(",") + "\n";
                });
                break;
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExportMenuOpen(false);
    };

    return (
        <div className="card space-y-8">
             {/* Payroll Section */}
            <div className="p-4 border-2 border-dashed rounded-lg bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Payroll Processing</h2>
                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 bg-slate-100 p-3 rounded-md">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Period:</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field"/>
                        <span>to</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field"/>
                    </div>
                    <button onClick={handleGeneratePayroll} disabled={isGenerating} className="btn btn-secondary w-full md:w-auto">
                        {isGenerating ? 'Generating...' : 'Generate Summary'}
                    </button>
                </div>

                {payrollSummary.length > 0 && (
                    <div className="animate-fade-in">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-gray-600">Employee</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-600">Total Hours</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-600">OT Hours</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-600">Leave Days</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-600">Gross Pay (Est.)</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {payrollSummary.map(item => (
                                        <tr key={item.employeeId}>
                                            <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-800">{item.employeeName}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right">{item.totalHours}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right">{item.otHours}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right">{item.leaveDays}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right font-semibold">
                                                {parseFloat(item.grossPay) > 0 ? `$${parseFloat(item.grossPay).toLocaleString()}` : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 text-xs text-slate-500">
                            <strong>Note:</strong> Gross Pay is an estimate based on the latest monthly salary record, assuming a 40-hour work week. Overtime is calculated at 1.5x the hourly rate. This does not include taxes or other deductions.
                        </div>
                        <div className="mt-4 flex flex-col md:flex-row justify-end items-center gap-4">
                            {processMessage && <p className="text-sm font-semibold text-green-700">{processMessage}</p>}
                            <button onClick={handleProcessPayroll} disabled={isProcessing} className="btn btn-primary bg-green-600 hover:bg-green-700 w-full md:w-auto">
                                {isProcessing ? 'Processing...' : 'Process Payroll & Notify Employees'}
                            </button>
                        </div>
                         <div className="mt-2 text-xs text-slate-500 text-right">
                            Requires a configured EmailJS template for payslips.
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h2 className="text-xl font-bold text-slate-800">Historical Data & Reports</h2>
                 <div className="flex items-center gap-2">
                    <button onClick={handleOpenAddModal} className="btn btn-secondary">
                        + Manual Entry
                    </button>
                    <div className="relative ml-2">
                        <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="bg-blue-600 text-white hover:bg-blue-700 text-sm btn">
                            Export Data
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {isExportMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                                <button onClick={() => exportToCSV('all')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Export All</button>
                                <button onClick={() => exportToCSV('attendance')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Attendance Only</button>
                                <button onClick={() => exportToCSV('requests')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Requests Only</button>
                                <button onClick={() => exportToCSV('absences')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Absences Only</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Attendance Log */}
            <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Attendance Log</h3>
                <div className="overflow-x-auto">
                     <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                           {filteredAttendance.length > 0 ? filteredAttendance.map(record => {
                               const { totalHours, status } = calculateStatus(record);
                               const employee = getEmployee(record.employeeId);
                               return (
                                <tr key={record.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(record.clockInTime).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(record.clockInTime).toLocaleTimeString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {record.clockInLocation ? (
                                            <a 
                                                href={`https://www.google.com/maps?q=${record.clockInLocation.latitude},${record.clockInLocation.longitude}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-indigo-600 hover:text-indigo-900 hover:underline inline-flex items-center gap-1"
                                                title={`Lat: ${record.clockInLocation.latitude}, Lon: ${record.clockInLocation.longitude}`}
                                            >
                                                View on Map
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </a>
                                        ) : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.clockOutTime ? new Date(record.clockOutTime).toLocaleTimeString() : '---'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{totalHours}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status === 'Late' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                            {status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 max-w-xs truncate" title={record.manualEntryReason}>
                                        {record.manualEntryReason ? <span className="text-blue-600 font-semibold">Edited</span> : '---'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleOpenEditModal(record)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    </td>
                                </tr>
                               )
                           }) : (
                                <tr><td colSpan={9} className="text-center py-4 text-sm text-gray-500">No attendance records in this period.</td></tr>
                           )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Absences Log */}
             <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Absences</h3>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date of Absence</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                           {filteredAbsences.length > 0 ? filteredAbsences.map(({employee, date}) => (
                                <tr key={`${employee.id}-${date}`}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{employee.firstName} {employee.lastName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{new Date(date + 'T00:00:00').toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">No attendance or approved leave.</td>
                                </tr>
                           )) : (
                                <tr>
                                    <td colSpan={3} className="text-center py-4 text-sm text-gray-500">No unexplained absences in this period.</td>
                                </tr>
                           )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Requests Log */}
            <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Requests Log</h3>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Filed</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredRequests.length > 0 ? filteredRequests.map(req => {
                                const employee = getEmployee(req.employeeId);
                                return (
                                <tr key={req.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{req.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {req.type === RequestType.LEAVE ? `${req.leaveType}: ${req.startDate} to ${req.endDate}` : req.type === RequestType.CHANGE_REQUEST ? `Update Info` : `${req.hours} hrs on ${req.date}`}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(req.dateFiled).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusBadge status={req.status} /></td>
                                </tr>
                            )}) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-sm text-gray-500">No requests filed in this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {isManualModalOpen && (
                <ManualAttendanceModal 
                    onClose={() => setIsManualModalOpen(false)}
                    onSuccess={handleModalSuccess}
                    recordToEdit={recordToEdit}
                />
            )}
        </div>
    );
};
