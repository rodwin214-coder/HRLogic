
import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import * as api from '../../services/supabaseApi';
import { Employee, EmployeeStatus, WorkSchedule } from '../../types';
import Modal from '../common/Modal';
import { UserContext } from '../../App';
import EmployeeDetailsModal from './EmployeeDetailsModal';
import AddEmployeeModal from './AddEmployeeModal';
import BulkInviteModal from './BulkInviteModal';
import EmployeeFilesModal from './EmployeeFilesModal';

const BulkImportModal: React.FC<{onClose: () => void, onImport: () => void}> = ({ onClose, onImport }) => {
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{successCount: number; errorCount: number; errors: string[]} | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setCsvFile(e.target.files[0]);
            setImportResult(null); // Reset result when a new file is chosen
        }
    };

    const handleImport = async () => {
        if (!csvFile) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const csvData = event.target?.result as string;
            const result = await api.bulkImportEmployees(csvData);
            setImportResult(result);
            setIsImporting(false);
            if (result.successCount > 0) {
                onImport(); // Refresh the employee list in the parent
            }
        };
        reader.readAsText(csvFile);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Bulk Import Employees">
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Upload a CSV file. Required headers: 'firstName', 'lastName', 'email'.
                    <br />
                    Optional headers: 'employeeId', 'department', 'dateHired', 'shiftName', 'workSchedule'.
                </p>
                <a href="data:text/csv;charset=utf-8,firstName,lastName,email,department,dateHired,shiftName,workSchedule%0AJohn,Doe,john.doe@example.com,Engineering,2023-01-15,Morning%20Shift,Monday%20to%20Friday" download="employee_template.csv" className="text-sm text-indigo-600 hover:underline">Download Template</a>
                <div>
                    <label className="block text-sm font-medium text-slate-700">CSV File</label>
                    <input type="file" accept=".csv" onChange={handleFileChange} className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                </div>
                {isImporting && <p className="text-sm text-slate-600 animate-pulse">Importing...</p>}
                {importResult && (
                    <div className="text-sm border-t pt-4 mt-4">
                        <h4 className="font-semibold text-slate-800">Import Result</h4>
                        <p className={`font-medium ${importResult.successCount > 0 ? 'text-green-600' : 'text-slate-600'}`}>Successfully imported: {importResult.successCount} employees.</p>
                        {importResult.errorCount > 0 && (
                            <>
                                <p className="font-medium text-red-600 mt-2">Failed imports: {importResult.errorCount}</p>
                                <ul className="list-disc list-inside text-xs text-red-500 max-h-32 overflow-y-auto bg-red-50 p-2 rounded-md mt-1">
                                    {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </>
                        )}
                    </div>
                )}
                 <div className="text-xs text-slate-500 bg-slate-100 p-2 rounded-md">
                    <strong>Note:</strong> Imported employees will be sent an invitation email with a default password. This requires EmailJS to be configured in <code>services/mockApi.ts</code> and <code>index.html</code>.
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>
                    <button type="button" onClick={handleImport} disabled={!csvFile || isImporting} className="btn btn-primary">
                        {isImporting ? 'Importing...' : 'Start Import'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};


const EmployeeManagement: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [selectedEmployeeForFiles, setSelectedEmployeeForFiles] = useState<Employee | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const { user: editor } = useContext(UserContext);
    
    const fetchData = useCallback(async () => {
        const employeeList = await api.getEmployees();
        setEmployees(employeeList.sort((a, b) => a.lastName.localeCompare(b.lastName)));
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleStatusChange = async (employeeToUpdate: Employee, newStatus: EmployeeStatus) => {
        if (!editor) {
            alert("Could not perform action: current user not identified.");
            return;
        };

        const action = newStatus === EmployeeStatus.TERMINATED ? 'terminate' : 'reactivate';
        if (window.confirm(`Are you sure you want to ${action} ${employeeToUpdate.firstName} ${employeeToUpdate.lastName}?`)) {
            const updatedEmployeeData = { ...employeeToUpdate, status: newStatus };
            if (newStatus === EmployeeStatus.TERMINATED) {
                updatedEmployeeData.dateTerminated = new Date().toISOString().split('T')[0];
            } else if (newStatus === EmployeeStatus.ACTIVE) {
                updatedEmployeeData.dateTerminated = undefined;
            }
            await api.updateEmployee(updatedEmployeeData, editor.id);
            fetchData();
        }
    };

    const handleDelete = async (employeeToDelete: Employee) => {
        const confirmation = prompt(`This will PERMANENTLY DELETE ${employeeToDelete.firstName} ${employeeToDelete.lastName} and all associated data (attendance, requests, etc.). This action cannot be undone.\n\nTo confirm, please type DELETE below:`);
        if (confirmation === 'DELETE') {
            await api.deleteEmployee(employeeToDelete.id);
            fetchData();
        } else {
            alert('Deletion cancelled.');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedEmployeeIds.length === 0) return;
        const confirmation = prompt(`This will PERMANENTLY DELETE the ${selectedEmployeeIds.length} selected employees and all their associated data. This action cannot be undone.\n\nTo confirm, please type DELETE below:`);
        if (confirmation === 'DELETE') {
            await api.bulkDeleteEmployees(selectedEmployeeIds);
            fetchData();
            setSelectedEmployeeIds([]);
        } else {
            alert('Deletion cancelled.');
        }
    };

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => 
            `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [employees, searchTerm]);

    const handleSelectOne = (employeeId: string, isSelected: boolean) => {
        if (isSelected) {
            setSelectedEmployeeIds(prev => [...prev, employeeId]);
        } else {
            setSelectedEmployeeIds(prev => prev.filter(id => id !== employeeId));
        }
    };

    const handleSelectAll = (isSelected: boolean) => {
        if (isSelected) {
            setSelectedEmployeeIds(filteredEmployees.map(emp => emp.id));
        } else {
            setSelectedEmployeeIds([]);
        }
    };

    const handleBulkAction = async (newStatus: EmployeeStatus) => {
        if (!editor || selectedEmployeeIds.length === 0) return;

        const action = newStatus === EmployeeStatus.TERMINATED ? 'terminate' : 'reactivate';
        if (window.confirm(`Are you sure you want to ${action} the ${selectedEmployeeIds.length} selected employees?`)) {
            const updatePromises = selectedEmployeeIds.map(async (id) => {
                const employee = employees.find(e => e.id === id);
                if (employee && employee.status !== newStatus) {
                    const updatedEmployeeData = { ...employee, status: newStatus };
                    if (newStatus === EmployeeStatus.TERMINATED) {
                        updatedEmployeeData.dateTerminated = new Date().toISOString().split('T')[0];
                    } else if (newStatus === EmployeeStatus.ACTIVE) {
                        updatedEmployeeData.dateTerminated = undefined;
                    }
                    await api.updateEmployee(updatedEmployeeData, editor.id);
                }
            });
            await Promise.all(updatePromises);
            fetchData();
            setSelectedEmployeeIds([]);
        }
    };

    const selectedEmployeesDetails = useMemo(() => {
        return employees.filter(emp => selectedEmployeeIds.includes(emp.id));
    }, [employees, selectedEmployeeIds]);

    const canTerminate = selectedEmployeesDetails.some(emp => emp.status === EmployeeStatus.ACTIVE);
    const canReactivate = selectedEmployeesDetails.some(emp => emp.status === EmployeeStatus.TERMINATED);


    return (
        <div className="card">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h2 className="text-xl font-bold text-slate-800">Employee Management ({employees.length})</h2>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <input 
                        type="text"
                        placeholder="Search employees..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="input-field w-full md:w-64"
                    />
                    <button onClick={() => setIsAddModalOpen(true)} className="btn btn-secondary flex-shrink-0">
                        Add Employee
                    </button>
                    <button onClick={() => setIsInviteModalOpen(true)} className="btn btn-secondary flex-shrink-0">
                        Bulk Invite
                    </button>
                    <button onClick={() => setIsImportModalOpen(true)} className="btn btn-primary flex-shrink-0">
                        Bulk Import
                    </button>
                </div>
            </div>
            
            {selectedEmployeeIds.length > 0 && (
                <div className="bg-slate-100 p-3 rounded-lg mb-4 flex items-center justify-between animate-fade-in">
                    <p className="text-sm font-semibold text-slate-700">{selectedEmployeeIds.length} selected</p>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => handleBulkAction(EmployeeStatus.TERMINATED)} 
                            disabled={!canTerminate}
                            className="btn btn-secondary text-xs bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 disabled:cursor-not-allowed"
                        >
                            Terminate Selected
                        </button>
                        <button 
                            onClick={() => handleBulkAction(EmployeeStatus.ACTIVE)} 
                            disabled={!canReactivate}
                            className="btn btn-secondary text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 disabled:cursor-not-allowed"
                        >
                            Reactivate Selected
                        </button>
                        <button 
                            onClick={handleBulkDelete} 
                            className="btn btn-secondary text-xs bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                        >
                            Delete Selected
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left">
                                <input 
                                    type="checkbox"
                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    checked={filteredEmployees.length > 0 && selectedEmployeeIds.length === filteredEmployees.length}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                        {filteredEmployees.map(employee => (
                            <tr key={employee.id} className={selectedEmployeeIds.includes(employee.id) ? 'bg-indigo-50' : ''}>
                                <td className="px-4 py-4">
                                     <input 
                                        type="checkbox"
                                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        checked={selectedEmployeeIds.includes(employee.id)}
                                        onChange={(e) => handleSelectOne(employee.id, e.target.checked)}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.employeeId}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{employee.lastName}, {employee.firstName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.department}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${employee.status === EmployeeStatus.ACTIVE ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {employee.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => setSelectedEmployee(employee)} className="text-indigo-600 hover:text-indigo-900">Details</button>
                                    <button
                                        onClick={() => {
                                            if (!editor) {
                                                alert('User context not available. Please try logging out and back in.');
                                                return;
                                            }
                                            setSelectedEmployeeForFiles(employee);
                                        }}
                                        className="ml-4 text-blue-600 hover:text-blue-900"
                                    >
                                        Files
                                    </button>
                                    {employee.status === EmployeeStatus.ACTIVE ? (
                                        <button onClick={() => handleStatusChange(employee, EmployeeStatus.TERMINATED)} className="ml-4 text-orange-600 hover:text-orange-900">Terminate</button>
                                    ) : (
                                        <button onClick={() => handleStatusChange(employee, EmployeeStatus.ACTIVE)} className="ml-4 text-green-600 hover:text-green-900">Reactivate</button>
                                    )}
                                    <button onClick={() => handleDelete(employee)} className="ml-4 text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                     </tbody>
                </table>
            </div>

            {isImportModalOpen && (
                <BulkImportModal
                    onClose={() => setIsImportModalOpen(false)}
                    onImport={() => {
                        fetchData();
                        // Keep modal open to show results for user to review
                    }}
                />
            )}
             {isInviteModalOpen && (
                <BulkInviteModal
                    onClose={() => setIsInviteModalOpen(false)}
                    onInvite={() => {
                        fetchData();
                    }}
                />
            )}
            {isAddModalOpen && (
                <AddEmployeeModal 
                    onClose={() => setIsAddModalOpen(false)}
                    onSuccess={() => {
                        fetchData();
                        setIsAddModalOpen(false);
                    }}
                />
            )}
            {selectedEmployee && (
                <EmployeeDetailsModal
                    employeeId={selectedEmployee.id}
                    onClose={() => setSelectedEmployee(null)}
                    onUpdate={fetchData}
                />
            )}
            {selectedEmployeeForFiles && editor && (
                <EmployeeFilesModal
                    employee={selectedEmployeeForFiles}
                    currentUserId={editor.id}
                    onClose={() => setSelectedEmployeeForFiles(null)}
                />
            )}
        </div>
    );
};

export default EmployeeManagement;
