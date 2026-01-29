
import React, { useState, useContext, useEffect, useRef } from 'react';
import { UserContext } from '../../App';
import * as api from '../../services/supabaseApi';
import { Employee, RequestType, LeaveBalance, CustomFieldDefinition, EmployeeFile } from '../../types';
import Modal from '../common/Modal';
import ChangePasswordModal from './ChangePasswordModal';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const ReasonForChangeModal: React.FC<{
    onClose: () => void;
    onSubmit: (reason: string) => void;
}> = ({ onClose, onSubmit }) => {
    const [reason, setReason] = useState('');
    const isFormValid = reason.trim() !== '';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isFormValid) {
            onSubmit(reason);
        }
    };
    
    return (
        <Modal isOpen={true} onClose={onClose} title="Reason for Change">
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Please provide a reason for these changes</label>
                    <textarea 
                        value={reason} 
                        onChange={e => setReason(e.target.value)} 
                        required 
                        rows={3} 
                        className="mt-1 input-field"
                    ></textarea>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button type="submit" disabled={!isFormValid} className="btn btn-primary">Submit Request</button>
                </div>
            </form>
        </Modal>
    )
}

// FIX: Moved helper components to the top level to prevent re-creation on re-renders, fixing the input bug.
const ProfileField: React.FC<{label: string, value?: string}> = ({label, value}) => (
    <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="text-md text-slate-800">{value || 'N/A'}</p>
    </div>
);

const EditField: React.FC<{
    label: string; 
    name: keyof Employee; 
    value: string | number | undefined;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
}> = ({label, name, value, onChange, type="text"}) => (
    <div>
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        <input name={name} value={String(value || '')} onChange={onChange} type={type} className="mt-1 input-field" />
    </div>
);


const EmployeeProfile: React.FC = () => {
    const { user } = useContext(UserContext);
    const [employee, setEmployee] = useState<Employee | null>(user);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Employee | null>(user);
    const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Partial<Employee> | null>(null);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [files, setFiles] = useState<EmployeeFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [fileError, setFileError] = useState('');

    const refreshEmployee = async () => {
        if (user) {
            const [freshData, leaveBalanceData, customFieldDefsData] = await Promise.all([
                api.getEmployeeById(user.id),
                api.calculateLeaveBalance(user.id),
                api.getCustomFieldDefinitions()
            ]);

            if (freshData) {
                setEmployee(freshData);
                setFormData(freshData);
            }
            setLeaveBalance(leaveBalanceData);
            setCustomFieldDefs(customFieldDefsData);
        }
    };

    const loadFiles = async () => {
        if (!user) return;
        setLoadingFiles(true);
        setFileError('');
        try {
            const employeeFiles = await api.getEmployeeFiles(user.id);
            setFiles(employeeFiles);
        } catch (err) {
            console.error('Load files error:', err);
            setFileError(`Failed to load files: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoadingFiles(false);
        }
    };

    useEffect(() => {
        refreshEmployee();
        loadFiles();
    }, [user]);

    const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && employee) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            await api.updateProfilePicture(employee.id, base64);
            await refreshEmployee();
        }
    };
    
    const handleEditToggle = (editing: boolean) => {
        setIsEditing(editing);
        if (!editing) {
            setFormData(employee); // Reset changes on cancel
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (formData) {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        }
    };

    const handleSaveInitiate = () => {
        if (!formData || !employee) return;
        
        const changes: Partial<Employee> = {};
        const editableFields: (keyof Employee)[] = [
            'firstName', 'middleName', 'lastName', 'address', 'birthdate', 
            'mobileNumber', 'tinNumber', 'sssNumber', 'pagibigNumber', 'philhealthNumber'
        ];

        editableFields.forEach(key => {
            const originalValue = employee[key] === null || employee[key] === undefined ? '' : employee[key];
            const newValue = formData[key] === null || formData[key] === undefined ? '' : formData[key];
            if (originalValue !== newValue) {
                // FIX: Cast `changes` to `any` to allow dynamic property assignment.
                // This resolves a TypeScript error where the compiler cannot guarantee type safety
                // for indexed access on an object with multiple property types.
                (changes as any)[key] = newValue;
            }
        });

        if (Object.keys(changes).length > 0) {
            setPendingChanges(changes);
            setIsReasonModalOpen(true);
        } else {
            alert("No changes were made.");
            setIsEditing(false);
        }
    };
    
    const handleSubmitChangeRequest = async (reason: string) => {
        if (!employee || !pendingChanges) return;

        const request = {
            employeeId: employee.id,
            type: RequestType.CHANGE_REQUEST,
            changes: pendingChanges,
            reason,
        };
        await api.addRequest(request);

        alert("Your change request has been submitted for approval.");

        setIsReasonModalOpen(false);
        setPendingChanges(null);
        setIsEditing(false);
        await refreshEmployee();
    };

    const handleDownloadFile = (file: EmployeeFile) => {
        const link = document.createElement('a');
        link.href = file.fileData;
        link.download = file.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    if (!employee || !formData) return <div>Loading profile...</div>;

    return (
        <div className="card space-y-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                    <img
                        src={employee.profilePicture || `https://ui-avatars.com/api/?name=${employee.firstName}+${employee.lastName}&background=random`}
                        alt="Profile"
                        className="w-32 h-32 rounded-full object-cover border-4 border-slate-200"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-1 right-1 bg-white p-1.5 rounded-full shadow-md hover:bg-slate-100 transition-colors"
                        aria-label="Change profile picture"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleProfilePictureChange}
                        className="hidden"
                        accept="image/png, image/jpeg"
                    />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">{employee.firstName} {employee.lastName}</h2>
                    <p className="text-slate-500">{employee.department}</p>
                    <p className="text-sm text-slate-400 font-mono mt-1">ID: {employee.employeeId}</p>
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <h3 className="text-xl font-semibold text-slate-700">My Information</h3>
                     {isEditing ? (
                        <div className="flex gap-2">
                           <button onClick={() => handleEditToggle(false)} className="btn btn-secondary">Cancel</button>
                           <button onClick={handleSaveInitiate} className="btn btn-primary">Save Changes</button>
                        </div>
                     ) : (
                        <button onClick={() => handleEditToggle(true)} className="btn btn-secondary">Edit Profile</button>
                     )}
                </div>
                <div className="space-y-4">
                    {isEditing ? (
                        <>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <EditField label="First Name" name="firstName" value={formData.firstName} onChange={handleChange}/>
                            <EditField label="Middle Name" name="middleName" value={formData.middleName} onChange={handleChange} />
                            <EditField label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} />
                            <EditField label="Birthdate" name="birthdate" value={formData.birthdate} onChange={handleChange} type="date" />
                            <EditField label="Mobile Number" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} />
                         </div>
                         <div className="pt-2">
                             <EditField label="Address" name="address" value={formData.address} onChange={handleChange} />
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                             <EditField label="TIN #" name="tinNumber" value={formData.tinNumber} onChange={handleChange} />
                             <EditField label="SSS #" name="sssNumber" value={formData.sssNumber} onChange={handleChange} />
                             <EditField label="Pag-ibig #" name="pagibigNumber" value={formData.pagibigNumber} onChange={handleChange} />
                             <EditField label="PhilHealth #" name="philhealthNumber" value={formData.philhealthNumber} onChange={handleChange} />
                         </div>
                        </>
                    ) : (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                            <ProfileField label="First Name" value={employee.firstName} />
                            <ProfileField label="Middle Name" value={employee.middleName} />
                            <ProfileField label="Last Name" value={employee.lastName} />
                            <ProfileField label="Birthdate" value={employee.birthdate} />
                            <ProfileField label="Email" value={employee.email} />
                            <ProfileField label="Mobile Number" value={employee.mobileNumber} />
                        </div>
                        <div className="pt-2">
                            <ProfileField label="Address" value={employee.address} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 pt-2">
                            <ProfileField label="TIN #" value={employee.tinNumber} />
                            <ProfileField label="SSS #" value={employee.sssNumber} />
                            <ProfileField label="Pag-ibig #" value={employee.pagibigNumber} />
                            <ProfileField label="PhilHealth #" value={employee.philhealthNumber} />
                        </div>
                        </>
                    )}
                </div>
            </div>

            {customFieldDefs.length > 0 && (
                 <div>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                        <h3 className="text-xl font-semibold text-slate-700">Additional Information</h3>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                        {customFieldDefs.map(def => (
                            <ProfileField key={def.id} label={def.name} value={String(employee.customFields?.[def.id] || 'N/A')} />
                        ))}
                    </div>
                </div>
            )}

            {leaveBalance && (
                 <div>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                        <h3 className="text-xl font-semibold text-slate-700">Leave Balances</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Vacation Leave Card */}
                        <div className="bg-slate-50 p-4 rounded-lg border">
                            <h4 className="font-bold text-lg text-indigo-700 mb-2">Vacation Leave</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>Accrued:</span><span className="font-medium">{leaveBalance.vacation.accrued.toFixed(2)} days</span></div>
                                <div className="flex justify-between"><span>Used:</span><span className="font-medium">{leaveBalance.vacation.used.toFixed(2)} days</span></div>
                                <div className="flex justify-between pt-2 border-t mt-2">
                                    <span className="font-bold">Available:</span>
                                    <span className="font-bold text-xl">{leaveBalance.vacation.available.toFixed(2)} days</span>
                                </div>
                            </div>
                        </div>
                        {/* Sick Leave Card */}
                        <div className="bg-slate-50 p-4 rounded-lg border">
                            <h4 className="font-bold text-lg text-teal-700 mb-2">Sick Leave</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>Accrued:</span><span className="font-medium">{leaveBalance.sick.accrued.toFixed(2)} days</span></div>
                                <div className="flex justify-between"><span>Used:</span><span className="font-medium">{leaveBalance.sick.used.toFixed(2)} days</span></div>
                                <div className="flex justify-between pt-2 border-t mt-2">
                                    <span className="font-bold">Available:</span>
                                    <span className="font-bold text-xl">{leaveBalance.sick.available.toFixed(2)} days</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <h3 className="text-xl font-semibold text-slate-700">My Files</h3>
                </div>
                {fileError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                        {fileError}
                    </div>
                )}
                {loadingFiles ? (
                    <div className="text-center py-8 text-slate-500">Loading files...</div>
                ) : files.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No files uploaded yet</div>
                ) : (
                    <div className="space-y-3">
                        {files.map(file => (
                            <div key={file.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <svg className="w-8 h-8 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-slate-800 truncate">{file.fileName}</p>
                                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                                <span>{formatFileSize(file.fileSize)}</span>
                                                <span>•</span>
                                                <span>{formatDate(file.uploadedAt)}</span>
                                            </div>
                                            {file.description && (
                                                <p className="text-sm text-slate-600 mt-1">{file.description}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDownloadFile(file)}
                                    className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                                    title="Download"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <h3 className="text-xl font-semibold text-slate-700">Security</h3>
                </div>
                <button
                    onClick={() => setIsChangePasswordModalOpen(true)}
                    className="btn btn-secondary"
                >
                    Change Password
                </button>
            </div>
            
             {isReasonModalOpen && (
                <ReasonForChangeModal 
                    onClose={() => setIsReasonModalOpen(false)}
                    onSubmit={handleSubmitChangeRequest}
                />
             )}

            {isChangePasswordModalOpen && (
                <ChangePasswordModal 
                    onClose={() => setIsChangePasswordModalOpen(false)}
                />
            )}
        </div>
    );
};

export default EmployeeProfile;