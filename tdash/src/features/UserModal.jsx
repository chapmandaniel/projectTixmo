import React, { useState } from 'react';
import { X } from 'lucide-react';
import InputField from '../components/InputField';

const UserModal = ({ user, onClose, onSave, isDark }) => {
    const [formData, setFormData] = useState(user || {
        firstName: '',
        lastName: '',
        email: '',
        role: 'SCANNER' // Default
    });

    const handleSave = () => {
        if (!formData.firstName || !formData.lastName || !formData.email) return;
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-md rounded-2xl flex flex-col shadow-2xl overflow-hidden ${isDark ? 'bg-[#1e1e1e] border border-[#333]' : 'bg-white'}`}>
                <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'border-[#333]' : 'border-gray-100'}`}>
                    <h2 className={`text-lg font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        {user ? 'Edit Member' : 'Invite Member'}
                    </h2>
                    <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-400 hover:bg-[#333] hover:text-white' : 'text-gray-400 hover:bg-gray-100'}`}>
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-1">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField
                            label="First Name"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            isDark={isDark}
                        />
                        <InputField
                            label="Last Name"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            isDark={isDark}
                        />
                    </div>
                    <InputField
                        label="Email Address"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        isDark={isDark}
                    />
                    <InputField
                        label="Role"
                        type="select"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        options={[
                            { value: 'ADMIN', label: 'Admin (Full Access)' },
                            { value: 'PROMOTER', label: 'Promoter (Events & Scanners)' },
                            { value: 'SCANNER', label: 'Scanner (Check-in Only)' }
                        ]}
                        isDark={isDark}
                    />
                </div>

                <div className={`p-6 border-t flex justify-end space-x-3 ${isDark ? 'bg-[#252525] border-[#333]' : 'bg-gray-50 border-gray-100'}`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className={`px-6 py-2 text-sm font-medium text-white rounded-lg shadow-lg transition-all ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
                    >
                        {user ? 'Save Changes' : 'Send Invite'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserModal;
