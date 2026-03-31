

import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import * as api from '../../services/supabaseApi';
import { AppRequest, Employee, RequestStatus, RequestType, ChangeRequest, LeaveType, OtUtRequest } from '../../types';
import { UserContext } from '../../App';

const ChangeRequestDetails: React.FC<{ request: ChangeRequest, originalEmployee?: Employee }> = ({ request, originalEmployee }) => {
    if (!originalEmployee) return <p className="text-sm text-slate-500">Could not load employee details.</p>;
    
    // Create a map for human-readable labels
    const fieldLabels: { [key: string]: string } = {
        firstName: 'First Name',
        middleName: 'Middle Name',
        lastName: 'Last Name',
        address: 'Address',
        birthdate: 'Birthdate',
        mobileNumber: 'Mobile Number',
        department: 'Department',
        tinNumber: 'TIN #',
        sssNumber: 'SSS #',
        pagibigNumber: 'Pag-ibig #',
        philhealthNumber: 'PhilHealth #',
    };

    return (
        <div className="text-sm text-slate-600 mt-2 p-3 bg-slate-50 rounded-md border">
            <p className="font-semibold text-slate-800 mb-2">Requested Changes:</p>
            <ul className="space-y-1">
                {Object.entries(request.changes).map(([key, value]) => {
                    const originalValue = originalEmployee[key as keyof Employee] || 'N/A';
                    const label = fieldLabels[key] || key;
                    return (
                        <li key={key} className="flex flex-col">
                           <span className="font-medium text-slate-700">{label}:</span>
                           <div className="flex items-center gap-2">
                             <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full line-through">{String(originalValue)}</span>
                             <span className="text-xs">→</span>
                             <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{String(value)}</span>
                           </div>
                        </li>
                    );
                })}
            </ul>
             <p className="text-xs text-slate-500 mt-3 pt-2 border-t">Reason: {request.reason}</p>
        </div>
    );
};

type RequestFilter = RequestStatus | 'All';

const RequestManagement: React.FC = () => {
    const [requests, setRequests] = useState<AppRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filter, setFilter] = useState<RequestFilter>(RequestStatus.PENDING);
    const { user: editor } = useContext(UserContext);

    const fetchData = useCallback(async () => {
        const [requestsData, employeesData] = await Promise.all([
            api.getRequests(),
            api.getEmployees()
        ]);
        setRequests(requestsData.sort((a,b) => new Date(b.dateFiled).getTime() - new Date(a.dateFiled).getTime()));
        setEmployees(employeesData);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getEmployee = (employeeId: string) => {
        return employees.find(e => e.id === employeeId);
    };

    const handleUpdateStatus = async (requestId: string, status: RequestStatus) => {
        if (!editor) {
            alert("Cannot process request: editor is not identified.");
            return;
        }

        const request = requests.find(r => r.id === requestId);
        if (!request) return;

        // Add a confirmation check for leave requests with insufficient balance
        if (status === RequestStatus.APPROVED && request.type === RequestType.LEAVE) {
            const balance = await api.calculateLeaveBalance(request.employeeId);
            const startDate = new Date(request.startDate);
            const endDate = new Date(request.endDate);
            // Simple day diff calculation, inclusive. In a real app, this would exclude weekends/holidays.
            const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1;

            let availableBalance = 0;
            if (request.leaveType === LeaveType.VACATION) {
                availableBalance = balance.vacation.available;
            } else if (request.leaveType === LeaveType.SICK) {
                availableBalance = balance.sick.available;
            }

            if (availableBalance < duration) {
                if (!window.confirm(
                    `Employee has insufficient ${request.leaveType} balance.\n\n` +
                    `Available: ${availableBalance.toFixed(1)} days\n` +
                    `Requested: ${duration} days\n\n` +
                    `Approve anyway? This may result in a negative balance.`
                )) {
                    return; // Abort if manager cancels
                }
            }
        }

        // Add a confirmation check for Overtime/Undertime requests
        if (status === RequestStatus.APPROVED && (request.type === RequestType.OVERTIME || request.type === RequestType.UNDERTIME)) {
            const employee = getEmployee(request.employeeId);
            const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'this employee';
            const requestTypeText = request.type.toLowerCase();
            const otUtRequest = request as OtUtRequest;
            const holidayInfo = otUtRequest.holidayType ? ` (${otUtRequest.holidayType} Holiday Pay)` : '';

            if (!window.confirm(
                `Are you sure you want to approve ${otUtRequest.hours} hours of ${requestTypeText}${holidayInfo} for ${employeeName} on ${otUtRequest.date}?`
            )) {
                return; // Abort if manager cancels
            }
        }

        try {
            await api.updateRequestStatus(requestId, status, editor.id);
            await fetchData();
        } catch (error) {
            console.error('Failed to update request status:', error);
            alert('Failed to update request status. Please try again.');
        }
    };


    const filteredRequests = useMemo(() => {
        if (filter === 'All') {
            return requests;
        }
        return requests.filter(r => r.status === filter);
    }, [requests, filter]);

    const filterStatuses: RequestFilter[] = ['All', ...Object.values(RequestStatus)];

    return (
        <div className="card">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Request Management</h2>
            
            <div className="flex space-x-2 mb-4 border-b pb-4">
                {filterStatuses.map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filter === status ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                        {status} ({status === 'All' ? requests.length : requests.filter(r => r.status === status).length})
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredRequests.length > 0 ? filteredRequests.map(req => {
                    const employee = getEmployee(req.employeeId);
                    return (
                    <div key={req.id} className="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <img 
                                src={employee?.profilePicture || `https://ui-avatars.com/api/?name=${employee?.firstName}+${employee?.lastName}&background=random`}
                                alt="profile"
                                className="w-12 h-12 rounded-full object-cover"
                            />
                            <div>
                                <p className="font-semibold text-slate-900">{employee?.firstName} {employee?.lastName}</p>
                                <p className="text-sm text-slate-600">
                                    <span className="font-medium">{req.type} Request</span>
                                </p>
                                 <p className="text-xs text-slate-400 mt-1">Filed: {new Date(req.dateFiled).toLocaleString()}</p>
                            </div>
                        </div>
                        <div>
                            {req.type !== RequestType.CHANGE_REQUEST && (
                                <div className="text-sm p-3 bg-slate-50 rounded-md border">
                                    <p className="font-medium text-slate-700">
                                       {req.type === RequestType.LEAVE ? `${req.leaveType} from ${req.startDate} to ${req.endDate}` : `${req.hours} hrs on ${req.date}`}
                                    </p>
                                    {req.holidayType && (
                                        <p className="text-xs text-blue-600 font-semibold mt-1 bg-blue-50 px-2 py-0.5 rounded inline-block">
                                            {req.holidayType} Holiday Pay
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1">Reason: {req.reason}</p>
                                </div>
                            )}

                            {req.type === RequestType.CHANGE_REQUEST && (
                                <ChangeRequestDetails request={req} originalEmployee={employee} />
                            )}
                        </div>
                        {req.status === RequestStatus.PENDING && (
                            <div className="flex justify-end gap-2 flex-shrink-0 pt-2 border-t mt-2">
                                <button onClick={() => handleUpdateStatus(req.id, RequestStatus.APPROVED)} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-green-200">Approve</button>
                                <button onClick={() => handleUpdateStatus(req.id, RequestStatus.REJECTED)} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-red-200">Reject</button>
                            </div>
                        )}
                    </div>
                )}) : (
                     <p className="text-slate-500 text-center py-8 col-span-full">No {filter.toLowerCase()} requests.</p>
                )}
            </div>
        </div>
    );
};

export default RequestManagement;