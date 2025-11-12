
import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../services/mockApi';
import { LeavePolicy } from '../../types';

// FIX: Moved helper component to the top level to prevent re-creation on re-renders, fixing the input bug.
const NumberField: React.FC<{
    name: keyof LeavePolicy;
    label: string; 
    value: number | boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string; 
    disabled?: boolean
}> = ({ name, label, value, onChange, error, disabled = false }) => (
     <div>
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        <input 
            name={name} 
            type="number" 
            value={String(value)} 
            onChange={onChange} 
            min="0"
            step="1"
            disabled={disabled}
            className={`mt-1 input-field ${error ? 'invalid' : ''} ${disabled ? 'bg-slate-100 cursor-not-allowed' : ''}`}
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
);

const LeaveSetup: React.FC = () => {
    const [policy, setPolicy] = useState<LeavePolicy | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        const fetchedPolicy = api.getLeavePolicy();
        setPolicy(fetchedPolicy);
        setIsLoading(false);
    }, []);
    
    const validate = useCallback(() => {
        if (!policy) return false;
        const newErrors: { [key: string]: string } = {};

        if (policy.baseVacationDaysPerYear < 0) newErrors.baseVacationDaysPerYear = 'Cannot be negative.';
        if (policy.baseSickDaysPerYear < 0) newErrors.baseSickDaysPerYear = 'Cannot be negative.';
        if (policy.tenureBonusEnabled) {
            if (policy.tenureBonusYearsInterval <= 0) newErrors.tenureBonusYearsInterval = 'Must be greater than 0.';
            if (policy.maxTenureBonusDays < 0) newErrors.maxTenureBonusDays = 'Cannot be negative.';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [policy]);

    useEffect(() => {
        validate();
    }, [policy, validate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!policy) return;
        const { name, value, type, checked } = e.target;
        
        const newValue = type === 'checkbox' ? checked : Number(value);
        setPolicy({ ...policy, [name]: newValue });
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (policy && validate()) {
            api.updateLeavePolicy(policy);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000); // Hide message after 3 seconds
        }
    };
    
    const isFormValid = Object.keys(errors).length === 0;

    if (isLoading) {
        return <p>Loading leave policy...</p>;
    }

    if (!policy) {
        return <p>Could not load leave policy settings.</p>;
    }

    return (
        <div className="card">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Leave Policy Setup</h2>
            <form onSubmit={handleSave} className="space-y-6">
                
                <section className="p-4 border rounded-lg bg-slate-50">
                    <h3 className="text-lg font-semibold mb-4 text-slate-700">Annual Leave Allotment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NumberField name="baseVacationDaysPerYear" label="Base Vacation Days per Year" value={policy.baseVacationDaysPerYear} onChange={handleChange} error={errors.baseVacationDaysPerYear} />
                        <NumberField name="baseSickDaysPerYear" label="Base Sick Days per Year" value={policy.baseSickDaysPerYear} onChange={handleChange} error={errors.baseSickDaysPerYear} />
                    </div>
                </section>

                <section className="p-4 border rounded-lg bg-slate-50">
                    <h3 className="text-lg font-semibold mb-2 text-slate-700">Tenure Bonus (Vacation Leave)</h3>
                    <div className="flex items-center space-x-3 mb-4">
                         <input
                            id="tenureBonusEnabled"
                            name="tenureBonusEnabled"
                            type="checkbox"
                            checked={policy.tenureBonusEnabled}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="tenureBonusEnabled" className="text-sm font-medium text-slate-700">Enable tenure bonus</label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <NumberField name="tenureBonusYearsInterval" label="Add 1 day for every X years of service" value={policy.tenureBonusYearsInterval} onChange={handleChange} error={errors.tenureBonusYearsInterval} disabled={!policy.tenureBonusEnabled} />
                         <NumberField name="maxTenureBonusDays" label="Maximum bonus days" value={policy.maxTenureBonusDays} onChange={handleChange} error={errors.maxTenureBonusDays} disabled={!policy.tenureBonusEnabled} />
                    </div>
                </section>

                <div className="flex justify-end items-center gap-4 pt-4 border-t">
                     {isSaved && <p className="text-green-600 text-sm font-medium">Policy saved successfully!</p>}
                    <button type="submit" disabled={!isFormValid} className="btn btn-primary">
                        Save Policy
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LeaveSetup;
