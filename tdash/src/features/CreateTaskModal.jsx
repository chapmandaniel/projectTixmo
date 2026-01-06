import React, { useState, useRef } from 'react';
import { X, Plus, Paperclip } from 'lucide-react';
import InputField from '../components/InputField';

const CreateTaskModal = ({ onClose, onCreate, isDark, users = [] }) => {
    const [formData, setFormData] = useState({
        title: '',
        content: '', // Maps to Description
        priority: 'Medium',
        tag: 'General',
        assignee: '',
        attachments: []
    });

    const [error, setError] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const descriptionRef = useRef(null);

    const handleCreate = () => {
        if (!formData.title.trim()) {
            setError('Title is required');
            return;
        }
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

    const handleDescriptionChange = (e) => {
        const val = e.target.value;
        setFormData({ ...formData, content: val });

        const lastWord = val.split(/[\s\n]/).pop();
        if (lastWord.startsWith('@') && lastWord.length > 1) {
            setShowMentions(true);
            setMentionQuery(lastWord.substring(1).toLowerCase());
        } else {
            setShowMentions(false);
        }
    };

    const handleMentionUser = (user) => {
        const words = formData.content.split(/[\s\n]/);
        words.pop(); // Remove the partial mention
        const mention = user.lastName ? `@${user.firstName} ${user.lastName}` : `@${user.firstName}`;
        const newContent = [...words, `${mention} `].join(' '); // Add space after
        setFormData({ ...formData, content: newContent });
        setShowMentions(false);
        descriptionRef.current?.focus();
    };

    const filteredUsers = users.filter(u =>
        u.firstName.toLowerCase().includes(mentionQuery) ||
        u.lastName.toLowerCase().includes(mentionQuery)
    );

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

                <div className="p-6 space-y-4">
                    <InputField
                        label="Task Title"
                        value={formData.title}
                        onChange={(e) => {
                            setFormData({ ...formData, title: e.target.value });
                            setError('');
                        }}
                        placeholder="Short summary..."
                        isDark={isDark}
                        required
                    />
                    {error && <p className="text-xs text-rose-500 px-1 -mt-3">{error}</p>}

                    {/* Description with Mentions */}
                    <div className="relative">
                        <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Description</label>
                        <textarea
                            ref={descriptionRef}
                            value={formData.content}
                            onChange={handleDescriptionChange}
                            placeholder="Detailed explanation... (Type @ to mention)"
                            rows={4}
                            className={`w-full p-3 rounded-lg outline-none transition-all text-sm resize-none ${isDark ? 'bg-[#252525] text-gray-200 placeholder-gray-600 focus:bg-[#2a2a2a]' : 'bg-gray-50 text-gray-900 placeholder-gray-400 focus:bg-white shadow-sm'}`}
                        />
                        {/* Mention Suggestions */}
                        {showMentions && filteredUsers.length > 0 && (
                            <div className={`absolute top-full mt-1 left-0 w-60 rounded-xl shadow-2xl border overflow-hidden z-20 ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200'}`}>
                                <div className={`p-2 text-xs font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Suggested Users</div>
                                {filteredUsers.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleMentionUser(u)}
                                        className={`w-full text-left px-3 py-2 flex items-center space-x-2 hover:bg-indigo-500/10 transition-colors ${isDark ? 'text-gray-200' : 'text-gray-700'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}>
                                            {u.firstName[0]}
                                        </div>
                                        <span className="text-sm">{u.firstName} {u.lastName}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

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
                            type="select"
                            value={formData.tag}
                            onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                            options={[
                                { value: 'General', label: 'General' },
                                { value: 'Design', label: 'Design' },
                                { value: 'Legal', label: 'Legal' },
                                { value: 'Ops', label: 'Ops' },
                                { value: 'Marketing', label: 'Marketing' },
                                { value: 'Dev', label: 'Dev' }
                            ]}
                            isDark={isDark}
                        />
                    </div>

                    <InputField
                        label="Assign To"
                        type="select"
                        value={formData.assignee}
                        onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                        options={users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
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
