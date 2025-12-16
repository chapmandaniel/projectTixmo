import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import InputField from '../components/InputField';
import { MOCK_USERS } from '../data/mockData';

const CreateTaskModal = ({ onClose, onCreate, isDark }) => {
    const [formData, setFormData] = useState({
        title: '',
        content: '', // Maps to Description
        priority: 'Medium',
        tag: 'General',
        assignee: '',
        attachments: []
    });

    const handleCreate = () => {
        if (!formData.title) return;
        onCreate(formData);
    };

    const handleAddImage = () => {
        // Simulate adding an image
        const newImage = {
            id: Date.now(),
            url: `https://picsum.photos/seed/${Date.now()}/200/200`,
            name: `Image-${Date.now()}.jpg`
        };
        setFormData(prev => ({ ...prev, attachments: [...prev.attachments, newImage] }));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-md rounded-2xl flex flex-col shadow-2xl overflow-hidden ${isDark ? 'bg-[#1e1e1e] border border-[#333]' : 'bg-white'}`}>
                <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'border-[#333]' : 'border-gray-100'}`}>
                    <h2 className={`text-lg font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        Create New Task
                    </h2>
                    <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-400 hover:bg-[#333] hover:text-white' : 'text-gray-400 hover:bg-gray-100'}`}>
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-1">
                    <InputField
                        label="Task Title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Short summary..."
                        isDark={isDark}
                    />
                    <InputField
                        label="Description"
                        type="textarea"
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Detailed explanation..."
                        isDark={isDark}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <InputField
                            label="Priority"
                            type="select"
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                            options={[
                                { value: 'High', label: 'High' },
                                { value: 'Medium', label: 'Medium' },
                                { value: 'Low', label: 'Low' }
                            ]}
                            isDark={isDark}
                        />
                        <InputField
                            label="Tag"
                            value={formData.tag}
                            onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                            isDark={isDark}
                        />
                    </div>

                    <InputField
                        label="Assign To"
                        type="select"
                        value={formData.assignee}
                        onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                        options={MOCK_USERS.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
                        isDark={isDark}
                    />

                    <div>
                        <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Attachments</label>
                        <div className="flex flex-wrap gap-2">
                            {formData.attachments.map(att => (
                                <div key={att.id} className="w-16 h-16 rounded-lg overflow-hidden border border-gray-700 relative group">
                                    <img src={att.url} alt="att" className="w-full h-full object-cover" />
                                </div>
                            ))}
                            <button
                                onClick={handleAddImage}
                                className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${isDark ? 'border-[#333] hover:border-gray-500 text-gray-500' : 'border-gray-200 hover:border-gray-400 text-gray-400'}`}
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`p-6 border-t flex justify-end space-x-3 ${isDark ? 'bg-[#252525] border-[#333]' : 'bg-gray-50 border-gray-100'}`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        className={`px-6 py-2 text-sm font-medium text-white rounded-lg shadow-lg transition-all ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
                    >
                        Create Task
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTaskModal;
