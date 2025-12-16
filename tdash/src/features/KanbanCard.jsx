import React from 'react';
import { Trash2, MessageSquare, Paperclip, Maximize2 } from 'lucide-react';
import { MOCK_USERS } from '../data/mockData';

const KanbanCard = ({ item, isDark, onDelete, onExpand, isCompact }) => {
    const priorityColors = {
        High: isDark ? 'text-rose-400 bg-rose-400/10' : 'text-rose-600 bg-rose-50',
        Medium: isDark ? 'text-amber-400 bg-amber-400/10' : 'text-amber-600 bg-amber-50',
        Low: isDark ? 'text-emerald-400 bg-emerald-400/10' : 'text-emerald-600 bg-emerald-50',
    };

    // Find assignee user object
    const assignee = MOCK_USERS.find(u => u.id === item.assignee);

    // Compact View
    if (isCompact) {
        return (
            <div
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                }}
                className={`group flex items-center justify-between p-3 rounded-lg mb-2 cursor-grab active:cursor-grabbing transition-all hover:-translate-y-0.5 ${isDark ? 'bg-[#252525] shadow-sm shadow-black/20 hover:bg-[#2a2a2a]' : 'bg-white shadow-sm border border-gray-100 hover:shadow-md'}`}
            >
                <div className="flex items-center space-x-3 overflow-hidden">
                    <span className={`text-sm font-medium truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {item.content}
                    </span>
                </div>

                <button
                    onClick={() => onExpand(item)}
                    className={`flex-shrink-0 flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${isDark ? 'bg-[#333] text-gray-400 hover:bg-[#404040] hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900'}`}
                >
                    <span>View</span>
                </button>
            </div>
        );
    }

    // Default View
    return (
        <div
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', item.id);
                e.dataTransfer.effectAllowed = 'move';
            }}
            className={`group relative p-4 rounded-lg mb-3 cursor-grab active:cursor-grabbing transition-all hover:-translate-y-0.5 ${isDark ? 'bg-[#252525] shadow-md shadow-black/20 hover:bg-[#2a2a2a]' : 'bg-white shadow-sm border border-gray-100 hover:shadow-md'}`}
        >
            <div className="flex justify-between items-start mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                    {item.tag}
                </span>
                <button
                    onClick={() => onDelete(item.id)}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${isDark ? 'hover:bg-white/10 text-gray-500 hover:text-rose-400' : 'hover:bg-gray-100 text-gray-400 hover:text-rose-500'}`}
                    title="Delete Task"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            <p className={`text-sm mb-4 font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{item.content}</p>

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded ${priorityColors[item.priority] || 'text-gray-500'}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{item.priority}</span>
                    </div>
                    {assignee && (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-light ${isDark ? 'bg-[#333] text-gray-300' : 'bg-gray-100 text-gray-600'}`} title={`Assigned to ${assignee.firstName}`}>
                            {assignee.firstName[0]}{assignee.lastName[0]}
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-3">
                    {(item.messages?.length > 0 || item.attachments?.length > 0) && (
                        <div className={`flex items-center space-x-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {item.messages?.length > 0 && <MessageSquare size={12} />}
                            {item.attachments?.length > 0 && <Paperclip size={12} />}
                        </div>
                    )}

                    <button
                        onClick={() => onExpand(item)}
                        className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${isDark ? 'bg-[#333] text-gray-300 hover:bg-[#404040] hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'}`}
                    >
                        <span>View</span>
                        <Maximize2 size={10} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KanbanCard;
