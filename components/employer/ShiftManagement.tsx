

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../services/supabaseApi';
import { Shift } from '../../types';

const ShiftManagement: React.FC = () => {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [name, setName] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
    const [isFormValid, setIsFormValid] = useState(false);

    const fetchData = useCallback(async () => {
        const shiftsData = await api.getShifts();
        setShifts(shiftsData);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        setIsFormValid(name.trim() !== '' && startTime !== '' && endTime !== '');
    }, [name, startTime, endTime]);

    const resetForm = () => {
        setName('');
        setStartTime('');
        setEndTime('');
        setEditingShiftId(null);
    };

    const handleEdit = (shift: Shift) => {
        setEditingShiftId(shift.id);
        setName(shift.name);
        setStartTime(shift.startTime);
        setEndTime(shift.endTime);
        window.scrollTo(0, 0); // Scroll to top to see the form
    };

    const handleDelete = (shiftId: string) => {
        if (window.confirm('Are you sure you want to delete this shift?')) {
            api.deleteShift(shiftId);
            fetchData();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isFormValid) {
            if (editingShiftId) {
                api.updateShift({ id: editingShiftId, name, startTime, endTime });
            } else {
                api.addShift({ name, startTime, endTime });
            }
            resetForm();
            fetchData();
        }
    };

    return (
        <div className="card">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Shift Management</h2>
            
            <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-slate-50">
                <h3 className="text-lg font-semibold mb-4 text-slate-700">{editingShiftId ? 'Edit Shift' : 'Add New Shift'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Shift Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Morning Shift" required className="mt-1 input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Start Time</label>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="mt-1 input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">End Time</label>
                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="mt-1 input-field" />
                    </div>
                    <div className="flex gap-2">
                         <button type="submit" disabled={!isFormValid} className="flex-grow btn btn-primary">
                            {editingShiftId ? 'Update' : 'Add'}
                        </button>
                        {editingShiftId && (
                            <button type="button" onClick={resetForm} className="btn btn-secondary">
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            </form>
            
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Existing Shifts</h3>
            <div className="space-y-3">
                {shifts.map(shift => (
                    <div key={shift.id} className="p-4 border rounded-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div>
                            <p className="font-semibold text-slate-800">{shift.name}</p>
                            <p className="text-sm text-slate-600 font-mono">{shift.startTime} - {shift.endTime}</p>
                        </div>
                        <div className="flex gap-4 flex-shrink-0">
                             <button onClick={() => handleEdit(shift)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Edit</button>
                             <button onClick={() => handleDelete(shift.id)} className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ShiftManagement;