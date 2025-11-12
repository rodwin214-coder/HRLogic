import React, { useState, useContext, useCallback } from 'react';
import { UserContext } from '../../App';
import * as api from '../../services/mockApi';
import { Employee } from '../../types';

interface CompleteProfileModalProps {
    onSuccess: () => void;
}

const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({ onSuccess }) => {
    const { user } = useContext(UserContext);
    const [formData, setFormData] = useState<Employee | null>(user);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const validate = useCallback(() => {
        if (!formData) return false;
        const newErrors: { [key: string]: string } = {};
        if (!formData.firstName.trim() || formData.firstName === 'Invited') newErrors.firstName = 'First Name is required.';
        if (!formData.lastName.trim() || formData.lastName === 'User') newErrors.lastName = 'Last Name is required.';
        if (!formData.birthdate) newErrors.birthdate = 'Birthdate is required.';
        if (!formData.mobileNumber.trim()) newErrors.mobileNumber = 'Mobile Number is required.';
        if (!formData.address.trim()) newErrors.address = 'Address is required.';
        if (!formData.department.trim() || formData.department === 'Unassigned') newErrors.department = 'Department is required.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (formData) {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (user && formData && validate()) {
            // Employee is filling their own info for the first time, so they are the "editor"
            api.updateEmployee(formData, user.id);
            onSuccess();
        }
    };
    
    if (!formData) return null;

    const EditField: React.FC<{label: string, name: keyof Employee, value?: any, type?: string, required?: boolean}> = ({label, name, value, type="text", required=false}) => (
        <div>
            <label className="block text-sm font-medium text-slate-700">{label}</label>
            <input name={name} value={String(value || '')} onChange={handleChange} type={type} required={required} className={`mt-1 input-field ${errors[name] ? 'invalid' : ''}`} />
             {errors[name] && <p className="text-xs text-red-600 mt-1">{errors[name]}</p>}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-100 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6 border-b">
                    <h2 className="text-2xl font-bold text-slate-800">Welcome! Let's set up your profile.</h2>
                    <p className="text-slate-600 mt-1">Please complete your information to continue.</p>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-700 border-b pb-2 mb-4">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <EditField label="First Name" name="firstName" value={formData.firstName} required />
                            <EditField label="Middle Name" name="middleName" value={formData.middleName} />
                            <EditField label="Last Name" name="lastName" value={formData.lastName} required />
                            <EditField label="Birthdate" name="birthdate" value={formData.birthdate} type="date" required />
                            <EditField label="Mobile Number" name="mobileNumber" value={formData.mobileNumber} required />
                            <div className="md:col-span-2">
                                <EditField label="Address" name="address" value={formData.address} required />
                            </div>
                        </div>
                    </div>

                    <div>
                         <h3 className="text-lg font-semibold text-slate-700 border-b pb-2 mb-4">Employment & Government IDs</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <EditField label="Department" name="department" value={formData.department} required />
                            <EditField label="TIN #" name="tinNumber" value={formData.tinNumber} />
                            <EditField label="SSS #" name="sssNumber" value={formData.sssNumber} />
                            <EditField label="Pag-ibig #" name="pagibigNumber" value={formData.pagibigNumber} />
                            <EditField label="PhilHealth #" name="philhealthNumber" value={formData.philhealthNumber} />
                         </div>
                    </div>
                    
                    <div className="flex justify-end pt-4 border-t">
                        <button type="submit" className="btn btn-primary">Save and Continue</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CompleteProfileModal;
