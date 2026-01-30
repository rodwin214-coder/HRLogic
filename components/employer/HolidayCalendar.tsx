

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as api from '../../services/supabaseApi';
import { Holiday, AppRequest, Employee, RequestStatus, RequestType, LeaveRequest } from '../../types';
import Modal from '../common/Modal';

const HolidayForm: React.FC<{onClose: () => void; onSave: () => void; holiday?: Holiday; customHolidayTypes: string[]}> = ({onClose, onSave, holiday, customHolidayTypes}) => {
    const [name, setName] = useState(holiday?.name || '');
    const [date, setDate] = useState(holiday?.date || '');
    const [country, setCountry] = useState(holiday?.country || 'PH');
    const [type, setType] = useState<string>(holiday?.type || 'Regular');
    const [isFormValid, setIsFormValid] = useState(false);

    useEffect(() => {
        setIsFormValid(name.trim() !== '' && date !== '');
    }, [name, date]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isFormValid) {
            try {
                if (holiday) {
                    await api.updateHoliday({ id: holiday.id, name, date, country, type });
                } else {
                    await api.addHoliday({ name, date, country, type });
                }
                await onSave();
                onClose();
            } catch (error) {
                console.error('Failed to save holiday:', error);
                alert('Failed to save holiday. Please try again.');
            }
        }
    };

    const allTypes = ['Regular', 'Special', ...customHolidayTypes];

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Holiday Name" required className="input-field" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="input-field" />
            <select value={country} onChange={e => setCountry(e.target.value)} className="input-field select-dark">
                <option value="PH">Philippines</option>
                <option value="AU">Australia</option>
                <option value="UK">United Kingdom</option>
            </select>
            <select value={type} onChange={e => setType(e.target.value)} className="input-field select-dark">
                {allTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                ))}
            </select>
             <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={!isFormValid} className="btn btn-primary">{holiday ? 'Update' : 'Add'} Holiday</button>
            </div>
        </form>
    )
};

interface HolidayCalendarProps {
    canAddHoliday?: boolean;
}

const HolidayCalendar: React.FC<HolidayCalendarProps> = ({ canAddHoliday = false }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState<Holiday | undefined>(undefined);
    const [deletingHolidayId, setDeletingHolidayId] = useState<string | null>(null);
    const [holidayTypeFilter, setHolidayTypeFilter] = useState<string>('All');
    const [customHolidayTypes, setCustomHolidayTypes] = useState<string[]>([]);
    const [isAddingCustomType, setIsAddingCustomType] = useState(false);
    const [newCustomType, setNewCustomType] = useState('');

    const fetchData = useCallback(async () => {
        const [holidaysData, requestsData, employeesData] = await Promise.all([
            api.getHolidays(),
            api.getRequests(),
            api.getEmployees()
        ]);
        setHolidays(holidaysData);

        const uniqueTypes = new Set<string>();
        holidaysData.forEach(h => {
            if (h.type && h.type !== 'Regular' && h.type !== 'Special') {
                uniqueTypes.add(h.type);
            }
        });
        setCustomHolidayTypes(Array.from(uniqueTypes));

        setApprovedLeaves(requestsData.filter(r => r.status === RequestStatus.APPROVED && r.type === RequestType.LEAVE) as LeaveRequest[]);
        setEmployees(employeesData);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getEmployeeName = (employeeId: string) => {
        const employee = employees.find(e => e.id === employeeId);
        return employee ? `${employee.firstName[0]}. ${employee.lastName}` : '';
    };

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const grid = [];
        let day = 1;
        for (let i = 0; i < 6; i++) {
            const week = [];
            for (let j = 0; j < 7; j++) {
                if ((i === 0 && j < firstDayOfMonth) || day > daysInMonth) {
                    week.push(null);
                } else {
                    week.push(day++);
                }
            }
            grid.push(week);
            if (day > daysInMonth) break;
        }
        return grid;
    }, [currentDate]);

    const changeMonth = (delta: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + delta);
            return newDate;
        });
    };

    const changeYear = (delta: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setFullYear(prev.getFullYear() + delta);
            return newDate;
        });
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };
    
    const getEventsForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const dayHolidays = holidays.filter(h => {
            if (h.date !== dateStr) return false;
            if (holidayTypeFilter === 'All') return true;
            return h.type === holidayTypeFilter;
        });

        const dayLeaves = approvedLeaves.filter(l => {
            return dateStr >= l.startDate && dateStr <= l.endDate;
        });

        return { dayHolidays, dayLeaves };
    }

    const handleEditHoliday = (holiday: Holiday) => {
        setEditingHoliday(holiday);
        setIsModalOpen(true);
    };

    const handleDeleteHoliday = async (holidayId: string) => {
        if (window.confirm('Are you sure you want to delete this holiday?')) {
            try {
                await api.deleteHoliday(holidayId);
                await fetchData();
            } catch (error) {
                console.error('Failed to delete holiday:', error);
                alert('Failed to delete holiday. Please try again.');
            }
        }
    };

    const handleAddCustomType = () => {
        if (newCustomType.trim() && !customHolidayTypes.includes(newCustomType.trim())) {
            setCustomHolidayTypes([...customHolidayTypes, newCustomType.trim()]);
            setNewCustomType('');
            setIsAddingCustomType(false);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingHoliday(undefined);
    };

    const getHolidayColor = (type: string) => {
        if (type === 'Regular') return 'bg-red-100 text-red-800';
        if (type === 'Special') return 'bg-yellow-100 text-yellow-800';
        return 'bg-green-100 text-green-800';
    };


    return (
        <div className="card">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-2">
                <h2 className="text-xl font-bold text-slate-800">Company Calendar</h2>
                 <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center p-1 bg-slate-100 rounded-lg overflow-x-auto">
                        <button onClick={() => setHolidayTypeFilter('All')} className={`px-3 py-1 text-sm rounded-md transition-colors whitespace-nowrap ${holidayTypeFilter === 'All' ? 'bg-white shadow-sm font-semibold text-blue-600' : 'text-slate-600 hover:bg-slate-200'}`}>All</button>
                        <button onClick={() => setHolidayTypeFilter('Regular')} className={`px-3 py-1 text-sm rounded-md transition-colors whitespace-nowrap ${holidayTypeFilter === 'Regular' ? 'bg-white shadow-sm font-semibold text-blue-600' : 'text-slate-600 hover:bg-slate-200'}`}>Regular</button>
                        <button onClick={() => setHolidayTypeFilter('Special')} className={`px-3 py-1 text-sm rounded-md transition-colors whitespace-nowrap ${holidayTypeFilter === 'Special' ? 'bg-white shadow-sm font-semibold text-blue-600' : 'text-slate-600 hover:bg-slate-200'}`}>Special</button>
                        {customHolidayTypes.map(type => (
                            <button key={type} onClick={() => setHolidayTypeFilter(type)} className={`px-3 py-1 text-sm rounded-md transition-colors whitespace-nowrap ${holidayTypeFilter === type ? 'bg-white shadow-sm font-semibold text-blue-600' : 'text-slate-600 hover:bg-slate-200'}`}>{type}</button>
                        ))}
                    </div>
                    {canAddHoliday && (
                        <>
                            <button onClick={() => setIsAddingCustomType(true)} className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600">+ Add Type</button>
                            <button onClick={() => { setEditingHoliday(undefined); setIsModalOpen(true); }} className="btn btn-primary">Add Holiday</button>
                        </>
                    )}
                </div>
            </div>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-xl font-semibold text-slate-700">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={goToToday} className="px-3 py-1 text-sm font-medium border rounded-md hover:bg-slate-100 transition-colors text-slate-600">Today</button>
                </div>

                <div className="flex items-center gap-1 text-slate-500">
                    <button onClick={() => changeYear(-1)} aria-label="Previous year" className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    </button>
                    <button onClick={() => changeMonth(-1)} aria-label="Previous month" className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button onClick={() => changeMonth(1)} aria-label="Next month" className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <button onClick={() => changeYear(1)} aria-label="Next year" className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center font-semibold text-sm text-slate-600 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
                {calendarGrid.flat().map((day, index) => {
                    const {dayHolidays, dayLeaves} = day ? getEventsForDay(day) : {dayHolidays: [], dayLeaves: []};
                    const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day || 0).toDateString();

                    return (
                        <div key={index} className="h-32 border rounded-md p-1 overflow-y-auto bg-slate-50">
                            {day && (
                                <div className={`text-xs font-bold ${isToday ? 'bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-black'}`}>
                                    {day}
                                </div>
                            )}
                             <div className="text-left mt-1 space-y-1">
                                {dayHolidays.map(h => (
                                    <div key={h.id} className={`text-xs p-1 rounded group flex items-center justify-between ${getHolidayColor(h.type)}`}>
                                        <span className="truncate flex-1" title={h.name}>{h.name}</span>
                                        {canAddHoliday && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditHoliday(h)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {dayLeaves.map(l => (
                                    <div key={l.id} className="text-xs bg-blue-100 text-blue-800 p-1 rounded truncate" title={`${getEmployeeName(l.employeeId)}: ${l.leaveType}`}>
                                        {getEmployeeName(l.employeeId)}: {l.leaveType}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {canAddHoliday && (
                <>
                    <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingHoliday ? 'Edit Holiday' : 'Add Holiday'}>
                        <HolidayForm onClose={handleCloseModal} onSave={fetchData} holiday={editingHoliday} customHolidayTypes={customHolidayTypes} />
                    </Modal>

                    <Modal isOpen={isAddingCustomType} onClose={() => { setIsAddingCustomType(false); setNewCustomType(''); }} title="Add Custom Holiday Type">
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={newCustomType}
                                onChange={e => setNewCustomType(e.target.value)}
                                placeholder="Type name (e.g., Company Holiday)"
                                className="input-field"
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => { setIsAddingCustomType(false); setNewCustomType(''); }} className="btn btn-secondary">Cancel</button>
                                <button type="button" onClick={handleAddCustomType} disabled={!newCustomType.trim()} className="btn btn-primary">Add Type</button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}
        </div>
    );
};

export default HolidayCalendar;