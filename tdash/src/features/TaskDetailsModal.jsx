import React, { useState, useRef, useEffect } from 'react';
import { Users, Check, X, Edit3, Download, Plus, Paperclip, Send } from 'lucide-react';
import { MOCK_USERS } from '../data/mockData';

const TaskDetailsModal = ({ task, onClose, onUpdate, isDark }) => {
    const [message, setMessage] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.content);
    const [editDescription, setEditDescription] = useState(task.description || '');
    const [editTag, setEditTag] = useState(task.tag);
    const [editPriority, setEditPriority] = useState(task.priority);
    const messagesEndRef = useRef(null);

    const priorityColors = {
        High: isDark ? 'text-rose-400 bg-rose-400/10' : 'text-rose-600 bg-rose-50',
        Medium: isDark ? 'text-amber-400 bg-amber-400/10' : 'text-amber-600 bg-amber-50',
        Low: isDark ? 'text-emerald-400 bg-emerald-400/10' : 'text-emerald-600 bg-emerald-50',
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [task.messages]);

    const handleSaveEdit = () => {
        onUpdate({
            ...task,
            content: editTitle,
            description: editDescription,
            tag: editTag,
            priority: editPriority
        });
        setIsEditing(false);
    };

    const handleAssign = (userId) => {
        onUpdate({
            ...task,
            assignee: userId
        });
    };

    const handleSend = () => {
        if (!message.trim()) return;
        const newMsg = {
            id: Date.now(),
            text: message,
            sender: 'You',
            time: 'Just now'
        };
        onUpdate({
            ...task,
            messages: [...(task.messages || []), newMsg]
        });
        setMessage('');
    };

    const handleAttach = () => {
        const newAttachment = {
            id: Date.now(),
            url: `https://picsum.photos/seed/${Date.now()}/200/200`,
            name: `Image-${Date.now()}.jpg`
        };
        onUpdate({
            ...task,
            attachments: [...(task.attachments || []), newAttachment]
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-2xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden ${isDark ? 'bg-[#1e1e1e] border border-[#333]' : 'bg-white'}`}>

                {/* Header */}
                <div className={`p-6 border-b flex flex-col space-y-4 ${isDark ? 'border-[#333]' : 'border-gray-100'}`}>

                    {/* Top Row: Meta & Controls */}
                    <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                            {isEditing ? (
                                <>
                                    <input
                                        value={editTag}
                                        onChange={(e) => setEditTag(e.target.value)}
                                        className={`text-xs px-2 py-0.5 rounded font-medium outline-none border ${isDark ? 'bg-[#252525] border-[#333] text-indigo-300' : 'bg-white border-gray-200 text-indigo-600'} w-24`}
                                    />
                                    <select
                                        value={editPriority}
                                        onChange={(e) => setEditPriority(e.target.value)}
                                        className={`text-xs px-2 py-0.5 rounded font-medium outline-none border ${isDark ? 'bg-[#252525] border-[#333] text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}
                                    >
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </>
                            ) : (
                                <>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                                        {task.tag}
                                    </span>
                                    <div className={`flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority] || 'text-gray-500'}`}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                        <span>{task.priority}</span>
                                    </div>
                                </>
                            )}
                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>ID: {task.id}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                            {/* Assigned To Dropdown */}
                            <div className="relative group">
                                <select
                                    value={task.assignee || ''}
                                    onChange={(e) => handleAssign(e.target.value)}
                                    className={`appearance-none pl-8 pr-4 py-1.5 rounded-lg text-xs font-medium outline-none cursor-pointer transition-colors ${isDark ? 'bg-[#252525] text-gray-300 hover:bg-[#333]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                    <option value="" disabled>Unassigned</option>
                                    {MOCK_USERS.map(user => (
                                        <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>
                                    ))}
                                </select>
                                <Users size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            </div>

                            {/* Edit Toggle */}
                            {isEditing ? (
                                <>
                                    <button onClick={handleSaveEdit} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`} title="Save">
                                        <Check size={16} />
                                    </button>
                                    <button onClick={() => setIsEditing(false)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-rose-100 text-rose-600 hover:bg-rose-200'}`} title="Cancel">
                                        <X size={16} />
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`} title="Edit Task">
                                    <Edit3 size={16} />
                                </button>
                            )}

                            <div className={`w-px h-4 mx-1 ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div>

                            <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:bg-[#333] hover:text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-900'}`}>
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Title & Description Area */}
                    <div>
                        {isEditing ? (
                            <div className="space-y-3 animate-fade-in">
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className={`w-full text-xl font-semibold bg-transparent outline-none border-b pb-1 ${isDark ? 'text-gray-100 border-indigo-500' : 'text-gray-900 border-indigo-600'}`}
                                />
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className={`w-full text-sm bg-transparent outline-none resize-none h-24 p-2 rounded-lg ${isDark ? 'text-gray-300 bg-[#252525]' : 'text-gray-600 bg-gray-50'}`}
                                    placeholder="Add a description..."
                                />
                            </div>
                        ) : (
                            <div className="animate-fade-in">
                                <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{task.content}</h2>
                                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {task.description || "No description provided."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                    {/* Attachments */}
                    <div>
                        <h3 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Attachments</h3>
                        <div className="grid grid-cols-4 gap-3">
                            {task.attachments?.map(att => (
                                <div key={att.id} className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer">
                                    <img src={att.url} alt="attachment" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Download size={16} className="text-white" />
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={handleAttach}
                                className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-colors ${isDark ? 'border-[#333] hover:border-indigo-500/50 hover:bg-[#252525]' : 'border-gray-200 hover:border-indigo-400 hover:bg-indigo-50'}`}
                            >
                                <Plus size={24} className={isDark ? 'text-gray-600' : 'text-gray-300'} />
                                <span className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Add</span>
                            </button>
                        </div>
                    </div>

                    {/* Activity / Messages */}
                    <div>
                        <h3 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Activity Log</h3>
                        <div className="space-y-4">
                            {task.messages?.map((msg, idx) => (
                                <div key={msg.id} className={`flex space-x-3 ${msg.sender === 'You' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-light shrink-0 ${msg.sender === 'You'
                                            ? (isDark ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white')
                                            : (isDark ? 'bg-[#333] text-gray-300' : 'bg-gray-100 text-gray-600')
                                        }`}>
                                        {msg.sender.charAt(0)}
                                    </div>
                                    <div className={`max-w-[70%]`}>
                                        <div className={`flex items-baseline space-x-2 mb-1 ${msg.sender === 'You' ? 'justify-end' : ''}`}>
                                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{msg.sender}</span>
                                            <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{msg.time}</span>
                                        </div>
                                        <div className={`p-3 rounded-xl text-sm ${msg.sender === 'You'
                                                ? (isDark ? 'bg-indigo-500/20 text-indigo-200 rounded-tr-none' : 'bg-indigo-50 text-indigo-900 rounded-tr-none')
                                                : (isDark ? 'bg-[#252525] text-gray-300 rounded-tl-none' : 'bg-gray-50 text-gray-700 rounded-tl-none')
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </div>

                {/* Footer / Input */}
                <div className={`p-4 border-t ${isDark ? 'bg-[#252525] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`flex items-center p-2 rounded-xl border ${isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200'}`}>
                        <button
                            onClick={handleAttach}
                            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-500 hover:text-indigo-400 hover:bg-[#333]' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'}`}
                        >
                            <Paperclip size={20} />
                        </button>
                        <input
                            type="text"
                            placeholder="Write a comment..."
                            className={`flex-1 bg-transparent border-none outline-none px-3 text-sm ${isDark ? 'text-gray-200 placeholder-gray-600' : 'text-gray-700 placeholder-gray-400'}`}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!message.trim()}
                            className={`p-2 rounded-lg transition-all ${message.trim()
                                    ? (isDark ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-indigo-600 text-white shadow-md')
                                    : (isDark ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed')
                                }`}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailsModal;
