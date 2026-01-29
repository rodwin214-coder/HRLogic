import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../services/supabaseApi';
import { CustomFieldDefinition, CustomFieldType } from '../../types';

const CustomFieldsSetup: React.FC = () => {
    const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
    const [editingDefId, setEditingDefId] = useState<string | null>(null);
    
    // Form state
    const [name, setName] = useState('');
    const [type, setType] = useState<CustomFieldType>(CustomFieldType.TEXT);
    const [options, setOptions] = useState('');
    
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const fetchData = useCallback(async () => {
        const defsData = await api.getCustomFieldDefinitions();
        setDefinitions(defsData);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const validate = useCallback(() => {
        const newErrors: { [key: string]: string } = {};
        if (!name.trim()) newErrors.name = 'Field Name is required.';
        if (type === CustomFieldType.DROPDOWN && !options.trim()) {
            newErrors.options = 'Comma-separated options are required for Dropdown type.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [name, type, options]);
    
    useEffect(() => {
        validate();
    }, [name, type, options, validate]);

    const resetForm = () => {
        setName('');
        setType(CustomFieldType.TEXT);
        setOptions('');
        setEditingDefId(null);
        setErrors({});
    };

    const handleEdit = (def: CustomFieldDefinition) => {
        setEditingDefId(def.id);
        setName(def.name);
        setType(def.type);
        setOptions(def.options?.join(', ') || '');
        window.scrollTo(0, 0);
    };

    const handleDelete = (defId: string) => {
        if (window.confirm('Are you sure you want to delete this custom field? This will not remove existing data from employees, but the field will no longer be visible or editable.')) {
            api.deleteCustomFieldDefinition(defId);
            fetchData();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        
        const defData = {
            name,
            type,
            options: type === CustomFieldType.DROPDOWN ? options.split(',').map(opt => opt.trim()) : undefined,
        };

        if (editingDefId) {
            api.updateCustomFieldDefinition({ ...defData, id: editingDefId });
        } else {
            api.addCustomFieldDefinition(defData);
        }
        
        resetForm();
        fetchData();
    };

    return (
        <div className="card">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Custom Employee Fields</h2>
            <p className="text-sm text-slate-600 mb-6">
                Add custom fields to collect additional information on employee profiles. These fields will appear in the "Additional Information" section of each employee's profile.
            </p>
            
            <form onSubmit={handleSubmit} className="mb-8 p-4 border rounded-lg bg-slate-50">
                <h3 className="text-lg font-semibold mb-4 text-slate-700">{editingDefId ? 'Edit Field' : 'Add New Field'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Field Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., T-Shirt Size" required className={`mt-1 input-field ${errors.name ? 'invalid' : ''}`} />
                        {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Field Type</label>
                        <select value={type} onChange={e => setType(e.target.value as CustomFieldType)} className="mt-1 input-field">
                            {Object.values(CustomFieldType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                     <div>
                        {type === CustomFieldType.DROPDOWN && (
                            <div className="animate-fade-in">
                                <label className="block text-sm font-medium text-slate-700">Options</label>
                                <input value={options} onChange={e => setOptions(e.target.value)} placeholder="Small, Medium, Large" className={`mt-1 input-field ${errors.options ? 'invalid' : ''}`} />
                                <p className="text-xs text-slate-500 mt-1">Enter comma-separated values.</p>
                                {errors.options && <p className="text-xs text-red-600 mt-1">{errors.options}</p>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    {editingDefId && (
                        <button type="button" onClick={resetForm} className="btn btn-secondary">
                            Cancel
                        </button>
                    )}
                    <button type="submit" disabled={Object.keys(errors).length > 0} className="btn btn-primary">
                        {editingDefId ? 'Update Field' : 'Add Field'}
                    </button>
                </div>
            </form>
            
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Existing Fields</h3>
            <div className="space-y-3">
                {definitions.length > 0 ? definitions.map(def => (
                    <div key={def.id} className="p-4 border rounded-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div>
                            <p className="font-semibold text-slate-800">{def.name}</p>
                            <p className="text-sm text-slate-600">
                                Type: <span className="font-medium bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs">{def.type}</span>
                            </p>
                             {def.type === CustomFieldType.DROPDOWN && (
                                <p className="text-xs text-slate-500 mt-1">Options: {def.options?.join(', ')}</p>
                            )}
                        </div>
                        <div className="flex gap-4 flex-shrink-0">
                             <button onClick={() => handleEdit(def)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Edit</button>
                             <button onClick={() => handleDelete(def.id)} className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors">Delete</button>
                        </div>
                    </div>
                )) : (
                    <p className="text-slate-500 text-center py-4">No custom fields have been added yet.</p>
                )}
            </div>
        </div>
    );
};

export default CustomFieldsSetup;