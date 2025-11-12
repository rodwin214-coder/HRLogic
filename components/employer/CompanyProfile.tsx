
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import * as api from '../../services/mockApi';
import { CompanyProfile as CompanyProfileType, WorkSchedule } from '../../types';
import { UserContext } from '../../App';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// FIX: Moved helper components to the top level to prevent re-creation on re-renders, fixing the input bug.
const ProfileField: React.FC<{label: string, value?: string}> = ({label, value}) => (
    <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="text-md text-slate-800">{value || 'N/A'}</p>
    </div>
);

const EditField: React.FC<{
    label: string, 
    name: keyof Omit<CompanyProfileType, 'id' | 'workSchedule' | 'logo'>, 
    value: string | undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    required?: boolean, 
    error?: string 
}> = ({ label, name, value, onChange, required = false, error }) => (
     <div>
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        <input name={name} value={value} onChange={onChange} required={required} className={`mt-1 input-field ${error ? 'invalid' : ''}`} />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
);


const CompanyProfile: React.FC = () => {
    const [profile, setProfile] = useState<CompanyProfileType | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<CompanyProfileType | null>(null);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { logout } = useContext(UserContext);

    const validate = useCallback(() => {
        if (!formData) return false;
        const newErrors: { [key: string]: string } = {};
        if (!formData.name.trim()) newErrors.name = 'Company Name is required.';
        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid.';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);
    
    useEffect(() => {
        if (isEditing) {
            validate();
        }
    }, [formData, isEditing, validate]);

    useEffect(() => {
        const data = api.getCompanyProfile();
        setProfile(data);
        setFormData(data);
    }, []);

    const handleEditToggle = () => {
        setIsEditing(!isEditing);
        if(!isEditing) {
            setFormData(profile); // Reset form data on cancel
            setErrors({});
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (formData) {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        }
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && formData) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setFormData({ ...formData, logo: base64 });
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData && validate()) {
            const updatedProfile = api.updateCompanyProfile(formData);
            setProfile(updatedProfile);
            setIsEditing(false);
        }
    };

    const handleClearAllData = () => {
        const confirmation = prompt("This is a destructive action that will delete ALL data in the application, including employees, records, and settings. This cannot be undone. To confirm, please type 'DELETE' in the box below.");
        if (confirmation === 'DELETE') {
            api.clearAllData();
            alert("All application data has been cleared. You will now be logged out.");
            logout();
        } else {
            alert("Action cancelled.");
        }
    };
    
    const isFormValid = Object.keys(errors).length === 0;

    if (!profile || !formData) {
        return <div>Loading company profile...</div>;
    }

    return (
        <div className="card">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-xl font-bold text-slate-800">Company Profile</h2>
                {!isEditing && (
                    <button onClick={handleEditToggle} className="btn btn-primary">
                        Edit Profile
                    </button>
                )}
            </div>

            {isEditing ? (
                <form onSubmit={handleSave} className="space-y-6">
                    {/* Logo and Name */}
                     <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative">
                            <img
                                src={formData.logo || `https://ui-avatars.com/api/?name=${formData.name}&background=0D8ABC&color=fff`}
                                alt="Company Logo"
                                className="w-32 h-32 rounded-full object-cover border-4 border-slate-200"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-1 right-1 bg-white p-1.5 rounded-full shadow-md hover:bg-slate-100 transition-colors"
                                aria-label="Change company logo"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleLogoChange}
                                className="hidden"
                                accept="image/png, image/jpeg"
                            />
                        </div>
                        <div className="flex-grow w-full">
                             <EditField label="Company Name" name="name" value={formData.name} onChange={handleChange} required error={errors.name} />
                        </div>
                    </div>
                    {/* Other details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <EditField label="Company TIN" name="tin" value={formData.tin} onChange={handleChange} />
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Work Schedule</label>
                            <select
                                name="workSchedule"
                                value={formData.workSchedule}
                                onChange={handleChange}
                                className="input-field mt-1"
                            >
                                {Object.values(WorkSchedule).map(ws => (
                                    <option key={ws} value={ws}>{ws}</option>
                                ))}
                            </select>
                        </div>
                         <div className="md:col-span-2">
                             <EditField label="Company Address" name="address" value={formData.address} onChange={handleChange} />
                         </div>
                         <EditField label="Contact Number" name="contactNumber" value={formData.contactNumber} onChange={handleChange} />
                         <EditField label="Contact Email" name="email" value={formData.email} onChange={handleChange} error={errors.email} />
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={handleEditToggle} className="btn btn-secondary">Cancel</button>
                        <button type="submit" disabled={!isFormValid} className="bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed btn">Save Changes</button>
                    </div>
                </form>
            ) : (
                <div className="space-y-8">
                     <div className="flex flex-col sm:flex-row items-center gap-6">
                        <img
                            src={profile.logo || `https://ui-avatars.com/api/?name=${profile.name}&background=0D8ABC&color=fff`}
                            alt="Company Logo"
                            className="w-32 h-32 rounded-full object-cover border-4 border-slate-200"
                        />
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800">{profile.name}</h2>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <ProfileField label="Company TIN" value={profile.tin} />
                        <ProfileField label="Work Schedule" value={profile.workSchedule} />
                        <div className="md:col-span-2">
                            <ProfileField label="Company Address" value={profile.address} />
                        </div>
                        <ProfileField label="Contact Number" value={profile.contactNumber} />
                        <ProfileField label="Contact Email" value={profile.email} />
                    </div>
                </div>
            )}

            <div className="mt-12 pt-6 border-t border-red-300">
                <h3 className="text-lg font-bold text-red-700">Danger Zone</h3>
                <p className="text-sm text-slate-600 mt-2">
                    This action is destructive and will permanently delete all application data, including employees, attendance records, requests, and settings. This cannot be undone.
                </p>
                <div className="mt-4">
                    <button 
                        onClick={handleClearAllData} 
                        className="btn bg-red-600 text-white hover:bg-red-700"
                    >
                        Clear All Application Data
                    </button>
                </div>
            </div>

        </div>
    );
};

export default CompanyProfile;