import React, { useState, useCallback, useEffect } from 'react';
import Modal from '../common/Modal';
import * as api from '../../services/mockApi';

interface AddEmployeeModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        department: '',
    });
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [apiError, setApiError] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const validate = useCallback(() => {
        const newErrors: { [key: string]: string } = {};
        if (!formData.firstName.trim()) newErrors.firstName = 'First Name is required.';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last Name is required.';
        if (!formData.email.trim()) {
            newErrors.email = 'Email Address is required.';
        } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
            newErrors.email = 'Email address is invalid.';
        }
        if (!formData.department.trim()) newErrors.department = 'Department is required.';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    useEffect(() => {
        validate();
    }, [formData, validate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddEmployee = () => {
        if (!validate()) return;
        
        setIsAdding(true);
        setApiError('');
        const result = api.inviteEmployee(formData);
        
        if ('error' in result) {
            setApiError(result.error);
        } else {
            onSuccess(); // This refreshes the parent list and closes the modal
        }
        setIsAdding(false);
    };

    const isFormValid = Object.keys(errors).length === 0;

    return (
        <Modal isOpen={true} onClose={onClose} title="Add New Employee">
            <form onSubmit={(e) => { e.preventDefault(); handleAddEmployee(); }} className="space-y-4">
                <p className="text-sm text-slate-600">
                    An invitation email will be sent to the employee with a default password of 'password123'. They will be prompted to complete their profile upon first login.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">First Name</label>
                        <input name="firstName" value={formData.firstName} onChange={handleChange} required className={`mt-1 input-field ${errors.firstName ? 'invalid' : ''}`}/>
                        {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Last Name</label>
                        <input name="lastName" value={formData.lastName} onChange={handleChange} required className={`mt-1 input-field ${errors.lastName ? 'invalid' : ''}`}/>
                        {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Email Address</label>
                    <input name="email" type="email" value={formData.email} onChange={handleChange} required className={`mt-1 input-field ${errors.email ? 'invalid' : ''}`}/>
                    {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Department</label>
                    <input name="department" value={formData.department} onChange={handleChange} required className={`mt-1 input-field ${errors.department ? 'invalid' : ''}`}/>
                    {errors.department && <p className="text-xs text-red-600 mt-1">{errors.department}</p>}
                </div>

                {apiError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">{apiError}</p>}

                <div className="text-xs text-slate-500 bg-slate-100 p-2 rounded-md">
                    <strong>Note:</strong> Email invitations are sent via EmailJS. To enable this, you must add your free API keys to <code>services/mockApi.ts</code> and <code>index.html</code>.
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" disabled={!isFormValid || isAdding} className="btn btn-primary">
                        {isAdding ? 'Adding Employee...' : 'Add Employee'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddEmployeeModal;