import React, { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { UserContext } from '../../App';
import * as api from '../../services/mockApi';
import { AppRequest, AttendanceRecord, LeaveType, RequestType, RequestStatus, LeaveBalance, EmploymentType, Task, TaskStatus, Employee } from '../../types';
import ClockInOut from './ClockInOut';
import Modal from '../common/Modal';
import HolidayCalendar from '../employer/HolidayCalendar';
import EmployeeReport from './EmployeeReport';
import EmployeeProfile from './EmployeeProfile';
import CompleteProfileModal from './CompleteProfileModal';

const MyTasks: React.FC = () => {
    const { user } = useContext(UserContext);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', assigneeId: user?.id || '' });
    const [colleagues, setColleagues] = useState<Employee[]>([]);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const fetchTasks = useCallback(() => {
        if (user) {
            setTasks(api.getTasksForEmployee(user.id));
        }
    }, [user]);

    useEffect(() => {
        fetchTasks();
        if (user) {
            const allEmployees = api.getEmployees();
            const departmentColleagues = allEmployees.filter(e => e.department === user.department && e.status === 'Active');
            setColleagues(departmentColleagues);
        }
    }, [fetchTasks, user]);
    
    const handleStatusChange = (task: Task, newStatus: TaskStatus) => {
        const updatedTask = { ...task, status: newStatus };
        if (newStatus === TaskStatus.COMPLETED && !task.dateCompleted) {
            updatedTask.dateCompleted = new Date().toISOString();
        }
        api.updateTask(updatedTask);
        fetchTasks();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewTask(prev => ({ ...prev, [name]: value }));
    };

    const validateNewTask = () => {
        const newErrors: { [key: string]: string } = {};
        if (!newTask.title.trim()) newErrors.title = 'Title is required.';
        if (!newTask.dueDate) newErrors.dueDate = 'Due date is required.';
        if (!newTask.assigneeId) newErrors.assigneeId = 'An assignee is required.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddTask = () => {
        if (!user || !validateNewTask()) return;

        const { title, description, dueDate, assigneeId } = newTask;

        const taskData = {
            title,
            description,
            dueDate,
            employeeId: assigneeId,
            status: TaskStatus.TODO,
            dateCreated: new Date().toISOString(),
        };
        api.addTask(taskData);
        setNewTask({ title: '', description: '', dueDate: '', assigneeId: user.id });
        setShowAddForm(false);
        fetchTasks();
    };

    const groupedTasks = useMemo(() => {
        return tasks.reduce((acc, task) => {
            if (!acc[task.status]) {
                acc[task.status] = [];
            }
            acc[task.status].push(task);
            return acc;
        }, {} as Record<TaskStatus, Task[]>);
    }, [tasks]);

    const StatusColumn: React.FC<{ status: TaskStatus; title: string; tasks: Task[] }> = ({ status, title, tasks = [] }) => {
        const statusColors = {
            [TaskStatus.TODO]: "border-t-slate-400",
            [TaskStatus.IN_PROGRESS]: "border-t-blue-500",
            [TaskStatus.COMPLETED]: "border-t-green-500",
        };
        return (
            <div className="flex-1 p-3 bg-slate-100 rounded-lg">
                <h3 className={`font-semibold text-slate-800 text-center pb-2 mb-3 border-b-2 ${statusColors[status]}`}>{title} ({tasks.length})</h3>
                <div className="space-y-3 h-[400px] overflow-y-auto">
                    {tasks.map(task => (
                        <div key={task.id} className="p-3 bg-white rounded-md shadow-sm border">
                            <p className="font-semibold text-slate-900">{task.title}</p>
                            <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                            <p className="text-xs text-slate-400 mt-2">Due: {task.dueDate}</p>
                            <select
                                value={task.status}
                                onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                                className="mt-2 w-full text-xs p-1 border rounded-md bg-slate-50"
                            >
                                {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="card">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-800">My Tasks</h2>
                <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-secondary">
                    {showAddForm ? 'Cancel' : '+ Add Task'}
                </button>
            </div>

            {showAddForm && (
                <div className="p-4 border rounded-lg bg-slate-50 space-y-3 mb-4 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Title</label>
                        <input name="title" value={newTask.title} onChange={handleInputChange} className={`input-field mt-1 ${errors.title ? 'invalid' : ''}`} />
                        {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Description (Optional)</label>
                        <textarea name="description" value={newTask.description} onChange={handleInputChange} rows={2} className="input-field mt-1"></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Due Date</label>
                        <input type="date" name="dueDate" value={newTask.dueDate} onChange={handleInputChange} className={`input-field mt-1 ${errors.dueDate ? 'invalid' : ''}`} />
                        {errors.dueDate && <p className="text-xs text-red-600 mt-1">{errors.dueDate}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Assign To</label>
                        <select 
                            name="assigneeId" 
                            value={newTask.assigneeId} 
                            onChange={handleInputChange} 
                            className={`input-field mt-1 ${errors.assigneeId ? 'invalid' : ''}`}
                        >
                            {colleagues.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.id === user?.id ? `Myself (${c.firstName} ${c.lastName})` : `${c.firstName} ${c.lastName}`}
                                </option>
                            ))}
                        </select>
                        {errors.assigneeId && <p className="text-xs text-red-600 mt-1">{errors.assigneeId}</p>}
                    </div>
                    <div className="text-right">
                        <button onClick={handleAddTask} className="btn btn-primary">Add Task</button>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4">
                <StatusColumn status={TaskStatus.TODO} title="To Do" tasks={groupedTasks[TaskStatus.TODO]} />
                <StatusColumn status={TaskStatus.IN_PROGRESS} title="In Progress" tasks={groupedTasks[TaskStatus.IN_PROGRESS]} />
                <StatusColumn status={TaskStatus.COMPLETED} title="Completed" tasks={groupedTasks[TaskStatus.COMPLETED]} />
            </div>
        </div>
    );
};

const RequestForm: React.FC<{ type: RequestType; onClose: () => void; onSubmit: () => void }> = ({ type, onClose, onSubmit }) => {
    const { user } = useContext(UserContext);
    const [reason, setReason] = useState('');
    const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.VACATION);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [otUtDate, setOtUtDate] = useState('');
    const [hours, setHours] = useState<number | string>(1);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const validate = useCallback(() => {
        const newErrors: { [key: string]: string } = {};
        if (!reason.trim()) newErrors.reason = 'Reason is required.';

        if (type === RequestType.LEAVE) {
            if (!startDate) newErrors.startDate = 'Start date is required.';
            if (!endDate) newErrors.endDate = 'End date is required.';
            if (startDate && endDate && startDate > endDate) {
                newErrors.endDate = 'End date cannot be before start date.';
            }
        } else { // Overtime or Undertime
            if (!otUtDate) newErrors.otUtDate = 'Date is required.';
            if (!hours) newErrors.hours = 'Hours are required.';
            else if (Number(hours) <= 0) newErrors.hours = 'Hours must be positive.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [reason, type, startDate, endDate, otUtDate, hours]);
    
    useEffect(() => {
        validate();
    }, [reason, startDate, endDate, otUtDate, hours, validate]);

    const handleSubmit = () => {
        if (!user || !validate()) return;
        
        if (type === RequestType.LEAVE) {
            const request = { employeeId: user.id, type: RequestType.LEAVE, leaveType, startDate, endDate, reason };
            api.addRequest(request);
        } else {
            const request = { employeeId: user.id, type, date: otUtDate, hours: Number(hours), reason };
            api.addRequest(request);
        }
        onSubmit();
        onClose();
    };
    
    const isFormValid = Object.keys(errors).length === 0;

    return (
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
            {type === RequestType.LEAVE ? (
                <>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Leave Type</label>
                        <select value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)} className="mt-1 block w-full input-field">
                            {Object.values(LeaveType).map(lt => <option key={lt} value={lt}>{lt}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Start Date</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={`mt-1 input-field ${errors.startDate ? 'invalid' : ''}`} />
                            {errors.startDate && <p className="text-xs text-red-600 mt-1">{errors.startDate}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">End Date</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className={`mt-1 input-field ${errors.endDate ? 'invalid' : ''}`} />
                            {errors.endDate && <p className="text-xs text-red-600 mt-1">{errors.endDate}</p>}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Date</label>
                        <input type="date" value={otUtDate} onChange={e => setOtUtDate(e.target.value)} required className={`mt-1 input-field ${errors.otUtDate ? 'invalid' : ''}`} />
                        {errors.otUtDate && <p className="text-xs text-red-600 mt-1">{errors.otUtDate}</p>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Hours</label>
                        <input type="number" min="0.5" step="0.5" value={hours} onChange={e => setHours(e.target.value)} required className={`mt-1 input-field ${errors.hours ? 'invalid' : ''}`} />
                        {errors.hours && <p className="text-xs text-red-600 mt-1">{errors.hours}</p>}
                    </div>
                </>
            )}
             <div>
                <label className="block text-sm font-medium text-slate-700">Reason</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} required rows={3} className={`mt-1 input-field ${errors.reason ? 'invalid' : ''}`}></textarea>
                {errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={!isFormValid} className="btn btn-primary">Submit Request</button>
            </div>
        </form>
    );
};

const StatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
    const statusClasses = {
        [RequestStatus.PENDING]: 'status-badge-pending',
        [RequestStatus.APPROVED]: 'status-badge-approved',
        [RequestStatus.REJECTED]: 'status-badge-rejected',
    };
    return <span className={`status-badge ${statusClasses[status]}`}>{status}</span>;
}

type RightPaneTab = 'profile' | 'tasks' | 'requests' | 'calendar' | 'reports';

const EmployeeDashboard: React.FC = () => {
    const { user, logout, refreshUser } = useContext(UserContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<RequestType>(RequestType.LEAVE);
    const [requests, setRequests] = useState<AppRequest[]>([]);
    const [todaysRecord, setTodaysRecord] = useState<AttendanceRecord | undefined>(undefined);
    const [activeRightTab, setActiveRightTab] = useState<RightPaneTab>('profile');
    const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
    const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

    const fetchData = useCallback(() => {
        if (user) {
            setRequests(api.getRequests().filter(r => r.employeeId === user.id).sort((a,b) => new Date(b.dateFiled).getTime() - new Date(a.dateFiled).getTime()));
            setTodaysRecord(api.getTodaysAttendance(user.id));
            setLeaveBalance(api.calculateLeaveBalance(user.id));
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            if (user.firstName === 'Invited' && user.lastName === 'User') {
                setNeedsProfileCompletion(true);
            } else {
                setNeedsProfileCompletion(false);
                fetchData();
            }
        }
    }, [user, fetchData]);

    const openModal = (type: RequestType) => {
        setModalType(type);
        setIsModalOpen(true);
    };

    const TabButton: React.FC<{tabId: RightPaneTab; children: React.ReactNode}> = ({ tabId, children }) => {
        const isActive = activeRightTab === tabId;
        return (
            <button
              onClick={() => setActiveRightTab(tabId)}
              className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                isActive
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
              }`}
            >
              {children}
            </button>
        );
    }

    if (!user) return <div>Loading...</div>;

    if (needsProfileCompletion) {
        return <CompleteProfileModal onSuccess={refreshUser} />;
    }

    const isLeaveAllowed = user.employmentType === EmploymentType.FULL_TIME;

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <header className="mb-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
                 <div className="flex items-center gap-4">
                     <img
                        src={user.profilePicture || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=random`}
                        alt="Profile"
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                    />
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Welcome, {user.firstName}!</h1>
                        <p className="text-slate-500">Employee Dashboard</p>
                    </div>
                </div>
                <button 
                    onClick={logout} 
                    className="btn btn-secondary"
                >
                    Log Out
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <ClockInOut todaysRecord={todaysRecord} onUpdate={fetchData} />
                    
                    {leaveBalance && isLeaveAllowed && (
                         <div className="card">
                            <h2 className="text-xl font-bold text-slate-800 mb-4">Leave Balances</h2>
                            <div className="space-y-4">
                               <div className="flex items-start gap-4 p-4 bg-indigo-50 rounded-lg">
                                    <div className="bg-indigo-100 p-2 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                                    <div>
                                        <p className="font-semibold text-indigo-800">Vacation Leave</p>
                                        <p className="font-bold text-indigo-600 text-2xl">{leaveBalance.vacation.available.toFixed(1)} <span className="text-sm font-medium">days</span></p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 bg-teal-50 rounded-lg">
                                    <div className="bg-teal-100 p-2 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg></div>
                                    <div>
                                        <p className="font-semibold text-teal-800">Sick Leave</p>
                                        <p className="font-bold text-teal-600 text-2xl">{leaveBalance.sick.available.toFixed(1)} <span className="text-sm font-medium">days</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="card">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">File a Request</h2>
                        <div className="space-y-3">
                            <button 
                                onClick={() => isLeaveAllowed && openModal(RequestType.LEAVE)} 
                                disabled={!isLeaveAllowed}
                                title={!isLeaveAllowed ? "Only full-time employees are eligible for leave." : ""}
                                className="w-full text-center bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                            >
                                File Leave
                            </button>
                            <button onClick={() => openModal(RequestType.OVERTIME)} className="w-full text-center bg-teal-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-teal-700">File Overtime</button>
                            <button onClick={() => openModal(RequestType.UNDERTIME)} className="w-full text-center bg-orange-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-orange-600">File Undertime</button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="mb-6">
                        <nav className="flex flex-wrap gap-2 p-2 bg-slate-100 rounded-lg">
                            <TabButton tabId="profile">My Profile</TabButton>
                            <TabButton tabId="tasks">My Tasks</TabButton>
                            <TabButton tabId="requests">My Requests</TabButton>
                            <TabButton tabId="calendar">Company Calendar</TabButton>
                            <TabButton tabId="reports">My Reports</TabButton>
                        </nav>
                    </div>
                    
                    {activeRightTab === 'profile' && (
                        <EmployeeProfile />
                    )}

                    {activeRightTab === 'tasks' && (
                        <MyTasks />
                    )}

                    {activeRightTab === 'requests' && (
                        <div className="card">
                            <h2 className="text-xl font-bold text-slate-800 mb-4">My Requests</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Filed</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {requests.length > 0 ? requests.map(req => (
                                            <tr key={req.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{req.type}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {req.type === RequestType.LEAVE ? `${req.leaveType}: ${req.startDate} to ${req.endDate}` : req.type === RequestType.CHANGE_REQUEST ? `Update Info` : `${req.hours} hrs on ${req.date}`}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(req.dateFiled).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusBadge status={req.status} /></td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="text-center py-8 text-sm text-gray-500">No requests found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    
                    {activeRightTab === 'calendar' && (
                        <HolidayCalendar />
                    )}

                    {activeRightTab === 'reports' && (
                        <EmployeeReport />
                    )}
                </div>
            </div>
             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`File ${modalType}`}>
                <RequestForm type={modalType} onClose={() => setIsModalOpen(false)} onSubmit={fetchData} />
            </Modal>
        </div>
    );
}

export default EmployeeDashboard;
