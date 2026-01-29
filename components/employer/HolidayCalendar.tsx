

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as api from '../../services/supabaseApi';
import { Holiday, AppRequest, Employee, RequestStatus, RequestType, LeaveRequest } from '../../types';
import Modal from '../common/Modal';

const HolidayForm: React.FC<{onClose: () => void; onSave: () => void}> = ({onClose, onSave}) => {
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [country, setCountry] = useState('PH');
    const [type, setType] = useState<'Regular' | 'Special'>('Regular');
    const [isFormValid, setIsFormValid] = useState(false);

    useEffect(() => {
        setIsFormValid(name.trim() !== '' && date !== '');
    }, [name, date]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isFormValid) {
            api.addHoliday({ name, date, country, type });
            onSave();
            onClose();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Holiday Name" required className="input-field" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="input-field" />
            <select value={country} onChange={e => setCountry(e.target.value)} className="input-field select-dark">
                <option value="PH">Philippines</option>
                <option value="AU">Australia</option>
                <option value="UK">United Kingdom</option>
            </select>
            <select value={type} onChange={e => setType(e.target.value as 'Regular' | 'Special')} className="input-field select-dark">
                <option value="Regular">Regular</option>
                <option value="Special">Special</option>
            </select>
             <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={!isFormValid} className="btn btn-primary">Add Holiday</button>
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
    const [holidayTypeFilter, setHolidayTypeFilter] = useState<'All' | 'Regular' | 'Special'>('All');

    const fetchData = useCallback(() => {
        setHolidays(api.getHolidays());
        setApprovedLeaves(api.getRequests().filter(r => r.status === RequestStatus.APPROVED && r.type === RequestType.LEAVE) as LeaveRequest[]);
        setEmployees(api.getEmployees());
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


    return (
        <div className="card">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-2">
                <h2 className="text-xl font-bold text-slate-800">Company Calendar</h2>
                 <div className="flex items-center gap-2">
                    <div className="flex items-center p-1 bg-slate-100 rounded-lg">
                        <button onClick={() => setHolidayTypeFilter('All')} className={`px-3 py-1 text-sm rounded-md transition-colors ${holidayTypeFilter === 'All' ? 'bg-white shadow-sm font-semibold text-indigo-600' : 'text-slate-600 hover:bg-slate-200'}`}>All</button>
                        <button onClick={() => setHolidayTypeFilter('Regular')} className={`px-3 py-1 text-sm rounded-md transition-colors ${holidayTypeFilter === 'Regular' ? 'bg-white shadow-sm font-semibold text-indigo-600' : 'text-slate-600 hover:bg-slate-200'}`}>Regular</button>
                        <button onClick={() => setHolidayTypeFilter('Special')} className={`px-3 py-1 text-sm rounded-md transition-colors ${holidayTypeFilter === 'Special' ? 'bg-white shadow-sm font-semibold text-indigo-600' : 'text-slate-600 hover:bg-slate-200'}`}>Special</button>
                    </div>
                    {canAddHoliday && (
                        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">Add Holiday</button>
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
                                    <div key={h.id} className={`text-xs p-1 rounded truncate ${h.type === 'Regular' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{h.name}</div>
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
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Holiday">
                    <HolidayForm onClose={() => setIsModalOpen(false)} onSave={fetchData} />
                </Modal>
            )}
        </div>
    );
};

export default HolidayCalendar;