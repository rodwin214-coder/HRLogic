import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { Employee, EmployeeFile } from '../../types';
import { getEmployeeFiles, uploadEmployeeFile, deleteEmployeeFile } from '../../services/supabaseApi';

interface EmployeeFilesModalProps {
    employee: Employee;
    currentUserId: string;
    onClose: () => void;
}

const EmployeeFilesModal: React.FC<EmployeeFilesModalProps> = ({ employee, currentUserId, onClose }) => {
    const [files, setFiles] = useState<EmployeeFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [description, setDescription] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadFiles();
    }, [employee.id]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const employeeFiles = await getEmployeeFiles(employee.id);
            setFiles(employeeFiles);
        } catch (err) {
            setError('Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB');
            return;
        }

        setUploading(true);
        setError('');

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Data = e.target?.result as string;

                const result = await uploadEmployeeFile(
                    employee.id,
                    file.name,
                    file.type,
                    file.size,
                    base64Data,
                    description || undefined,
                    currentUserId
                );

                if ('error' in result) {
                    setError(result.error);
                } else {
                    setFiles([result, ...files]);
                    setDescription('');
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                }
                setUploading(false);
            };
            reader.onerror = () => {
                setError('Failed to read file');
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            setError('Failed to upload file');
            setUploading(false);
        }
    };

    const handleDeleteFile = async (fileId: string) => {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            await deleteEmployeeFile(fileId);
            setFiles(files.filter(f => f.id !== fileId));
        } catch (err) {
            setError('Failed to delete file');
        }
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

    return (
        <Modal onClose={onClose} title={`Files - ${employee.firstName} ${employee.lastName}`}>
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-3">Upload New File</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description (Optional)
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g., Contract, Resume, ID Card"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileUpload}
                                disabled={uploading}
                                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer disabled:opacity-50"
                            />
                            <p className="text-xs text-gray-500 mt-1">Maximum file size: 10MB</p>
                        </div>
                        {uploading && (
                            <div className="text-blue-600 text-sm">
                                Uploading...
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                )}

                <div>
                    <h3 className="font-semibold text-gray-900 mb-3">
                        Uploaded Files ({files.length})
                    </h3>
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">
                            Loading files...
                        </div>
                    ) : files.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                            No files uploaded yet
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {file.fileName}
                                                </p>
                                                {file.description && (
                                                    <p className="text-xs text-gray-600 truncate">
                                                        {file.description}
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-500">
                                                    {formatFileSize(file.fileSize)} • {formatDate(file.uploadedAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 ml-4">
                                        <button
                                            onClick={() => handleDownloadFile(file)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                            title="Download"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFile(file.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                            title="Delete"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default EmployeeFilesModal;
