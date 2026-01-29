import React, { useState, useEffect, useMemo, useContext } from 'react';
import * as api from '../../services/supabaseApi';
import { AttendanceRecord, AppRequest, RequestType, RequestStatus, Holiday, Shift } from '../../types';
import { UserContext } from '../../App';

const StatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
    const statusClasses = {
        [RequestStatus.PENDING]: 'status-badge-pending',
        [RequestStatus.APPROVED]: 'status-badge-approved',
        [RequestStatus.REJECTED]: 'status-badge-rejected',
    };
    return <span className={`status-badge ${statusClasses[status]}`}>{status}</span>;
}

const EmployeeReport: React.FC = () => {
    const { user } = useContext(UserContext);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [requests, setRequests] = useState<AppRequest[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(lastDayOfMonth);

    useEffect(() => {
        const loadData = async () => {
            if (user) {
                const [attendanceData, requestsData, holidaysData] = await Promise.all([
                    api.getAttendance(),
                    api.getRequests(),
                    api.getHolidays()
                ]);

                setAttendance(attendanceData.filter(r => r.employeeId === user.id));
                setRequests(requestsData.filter(r => r.employeeId === user.id));
                setHolidays(holidaysData);
            }
        };
        loadData();
    }, [user]);

    const calculateTotalHours = (record: AttendanceRecord): string => {
        if (!record.clockOutTime) return 'N/A';
        const clockIn = new Date(record.clockInTime);
        const clockOut = new Date(record.clockOutTime);
        const diffMs = clockOut.getTime() - clockIn.getTime();
        return (diffMs / (1000 * 60 * 60)).toFixed(2);
    };

    const filteredAttendance = useMemo(() => {
        return attendance
            .filter(record => {
                const recordDate = record.clockInTime.split('T')[0];
                return recordDate >= startDate && recordDate <= endDate;
            })
            .sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime());
    }, [attendance, startDate, endDate]);

    const filteredRequests = useMemo(() => {
        return requests
            .filter(req => {
                const reqDate = req.type === RequestType.LEAVE ? req.startDate : req.date;
                return reqDate >= startDate && reqDate <= endDate;
            })
            .sort((a, b) => new Date(b.dateFiled).getTime() - new Date(a.dateFiled).getTime());
    }, [requests, startDate, endDate]);

     const filteredAbsences = useMemo(() => {
        const absences: string[] = [];
        const holidaysSet = new Set(holidays.map(h => h.date));
        const attendanceSet = new Set(filteredAttendance.map(a => a.clockInTime.split('T')[0]));
        const onLeaveSet = new Set<string>();

        filteredRequests.forEach(req => {
            if (req.type === RequestType.LEAVE && req.status === RequestStatus.APPROVED) {
                let currentDate = new Date(req.startDate);
                const stopDate = new Date(req.endDate);
                while (currentDate <= stopDate) {
                    onLeaveSet.add(currentDate.toISOString().split('T')[0]);
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
        });

        let currentDay = new Date(startDate);
        const endDay = new Date(endDate);
        while (currentDay <= endDay) {
            const dayOfWeek = currentDay.getDay();
            const dateStr = currentDay.toISOString().split('T')[0];

            // Check if it's a weekday (Monday=1, Friday=5)
            if (dayOfWeek > 0 && dayOfWeek < 6) {
                if (!holidaysSet.has(dateStr) && !attendanceSet.has(dateStr) && !onLeaveSet.has(dateStr)) {
                    absences.push(dateStr);
                }
            }
            currentDay.setDate(currentDay.getDate() + 1);
        }
        return absences;
    }, [startDate, endDate, holidays, filteredAttendance, filteredRequests]);

    const summaryStats = useMemo(() => {
        if (filteredAttendance.length === 0) {
            return { totalHours: 0, clockIns: 0, averageHours: 0 };
        }

        const totalHours = filteredAttendance.reduce((acc, record) => {
            const hoursStr = calculateTotalHours(record);
            const hours = parseFloat(hoursStr);
            return isNaN(hours) ? acc : acc + hours;
        }, 0);

        const clockIns = filteredAttendance.length;
        const averageHours = clockIns > 0 ? totalHours / clockIns : 0;

        return {
            totalHours,
            clockIns,
            averageHours,
        };
    }, [filteredAttendance]);
    
    const exportToCSV = (exportType: 'all' | 'attendance' | 'requests' | 'absences') => {
        let csvContent = "data:text/csv;charset=utf-8,";
        let fileName = `my_report_${startDate}_to_${endDate}.csv`;

        switch(exportType) {
            case 'attendance':
                fileName = `my_attendance_${startDate}_to_${endDate}.csv`;
                csvContent += "Date,Clock In,Clock Out,Total Hours\n";
                filteredAttendance.forEach(record => {
                    const date = new Date(record.clockInTime).toLocaleDateString();
                    const clockIn = new Date(record.clockInTime).toLocaleTimeString();
                    const clockOut = record.clockOutTime ? new Date(record.clockOutTime).toLocaleTimeString() : 'N/A';
                    const totalHours = calculateTotalHours(record);
                    csvContent += [date, clockIn, clockOut, totalHours].join(",") + "\n";
                });
                break;
            case 'requests':
                fileName = `my_leaves_${startDate}_to_${endDate}.csv`;
                csvContent += "Type,Details,Date Filed,Status\n";
                filteredRequests.forEach(req => {
                    const date = req.type === RequestType.LEAVE ? `${req.startDate} to ${req.endDate}` : req.date;
                    const details = req.type === RequestType.LEAVE ? `${req.leaveType}` : `${req.hours} hrs`;
                    csvContent += [req.type, `"${date}"`, `"${details}"`, req.status].join(",") + "\n";
                });
                break;
            case 'absences':
                 fileName = `my_absences_${startDate}_to_${endDate}.csv`;
                 csvContent += "Date of Absence,Status\n";
                 filteredAbsences.forEach(dateStr => {
                     csvContent += [dateStr, "Absent"].join(",") + "\n";
                 });
                 break;
            case 'all':
            default:
                csvContent += "Report Type,Date,Details,Status/Total Hours\n";
                filteredAttendance.forEach(record => {
                    const date = new Date(record.clockInTime).toLocaleDateString();
                    const details = `Clock In: ${new Date(record.clockInTime).toLocaleTimeString()}, Clock Out: ${record.clockOutTime ? new Date(record.clockOutTime).toLocaleTimeString() : 'N/A'}`;
                    const totalHours = calculateTotalHours(record);
                    csvContent += ["Attendance", date, `"${details}"`, totalHours].join(",") + "\n";
                });
                filteredRequests.forEach(req => {
                    const date = req.type === RequestType.LEAVE ? `${req.startDate} to ${req.endDate}` : req.date;
                    const details = req.type === RequestType.LEAVE ? `${req.leaveType}` : `${req.hours} hrs`;
                    csvContent += [req.type, `"${date}"`, `"${details}"`, req.status].join(",") + "\n";
                });
                filteredAbsences.forEach(dateStr => {
                    csvContent += ["Absence", dateStr, "No clock-in or approved leave", "Absent"].join(",") + "\n";
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
            <div>
                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                    <h2 className="text-xl font-bold text-slate-800">My Reports</h2>
                    <div className="flex items-center gap-2">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field text-sm"/>
                        <span className="text-slate-500">to</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field text-sm"/>
                        <div className="relative ml-2">
                            <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="bg-green-600 text-white hover:bg-green-700 text-sm btn">
                                Export
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {isExportMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                                    <button onClick={() => exportToCSV('all')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Export All</button>
                                    <button onClick={() => exportToCSV('attendance')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Attendance Only</button>
                                    <button onClick={() => exportToCSV('requests')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Leaves Only</button>
                                    <button onClick={() => exportToCSV('absences')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Absences Only</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Statistics */}
            <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Summary for Selected Period</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                        <p className="text-sm text-slate-500">Total Hours Worked</p>
                        <p className="text-2xl font-bold text-indigo-600">{summaryStats.totalHours.toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                        <p className="text-sm text-slate-500">Total Clock-Ins</p>
                        <p className="text-2xl font-bold text-indigo-600">{summaryStats.clockIns}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                        <p className="text-sm text-slate-500">Average Daily Hours</p>
                        <p className="text-2xl font-bold text-indigo-600">{summaryStats.averageHours.toFixed(2)}</p>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                           {filteredAttendance.length > 0 ? filteredAttendance.map(record => (
                                <tr key={record.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(record.clockInTime).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(record.clockInTime).toLocaleTimeString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.clockOutTime ? new Date(record.clockOutTime).toLocaleTimeString() : '---'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{calculateTotalHours(record)}</td>
                                </tr>
                           )) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-4 text-sm text-gray-500">No attendance records in this period.</td>
                                </tr>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date of Absence</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                           {filteredAbsences.length > 0 ? filteredAbsences.map(dateStr => (
                                <tr key={dateStr}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{new Date(dateStr + 'T00:00:00').toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">No attendance or approved leave found on this workday.</td>
                                </tr>
                           )) : (
                                <tr>
                                    <td colSpan={2} className="text-center py-4 text-sm text-gray-500">No unexplained absences in this period.</td>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Filed</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredRequests.length > 0 ? filteredRequests.map(req => (
                                <tr key={req.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{req.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {req.type === RequestType.LEAVE ? `${req.leaveType}: ${req.startDate} to ${req.endDate}` : req.type === RequestType.CHANGE_REQUEST ? `Update Info` : `${req.hours} hrs on ${req.date}`}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(req.dateFiled).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusBadge status={req.status} /></td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-4 text-sm text-gray-500">No requests filed in this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default EmployeeReport;