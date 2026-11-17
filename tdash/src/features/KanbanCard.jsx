import React from 'react';
import { Trash2, MessageSquare, Paperclip, Maximize2, CalendarClock } from 'lucide-react';
import MemberAvatar from '../components/dashboard/MemberAvatar';

const DAY = 86400000;
const dueInfo = (dueDate, status, now = Date.now()) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;
    const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOf(due) - startOf(new Date(now))) / DAY);
    const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : due.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const tone = status === 'DONE' ? 'done' : days < 0 ? 'overdue' : days <= 1 ? 'soon' : 'later';
    return { label: tone === 'overdue' ? `Overdue · ${label}` : label, tone };
};

const KanbanCard = ({ item, isDark, onDelete, onExpand, isCompact, users = [] }) => {
    const priorityColors = {
        High: isDark ? 'text-rose-400 bg-rose-400/10' : 'text-rose-600 bg-rose-50',
        Medium: isDark ? 'text-amber-400 bg-amber-400/10' : 'text-amber-600 bg-amber-50',
        Low: isDark ? 'text-emerald-400 bg-emerald-400/10' : 'text-emerald-600 bg-emerald-50',
    };
    priorityColors.HIGH = priorityColors.High;
    priorityColors.MEDIUM = priorityColors.Medium;
    priorityColors.LOW = priorityColors.Low;
    const priorityLabel = item.priority ? `${String(item.priority)[0]}${String(item.priority).slice(1).toLowerCase()}` : '';

    const due = dueInfo(item.dueDate, item.status);
    const dueTone = {
        overdue: isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700',
        soon: isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700',
        later: isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600',
        done: isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700',
    };

    // Find assignee user object
    const assignee = users.find(u => u.id === item.assignee) || (item.assigneeDetails?.id === item.assignee ? item.assigneeDetails : null);

    // Compact View
    if (isCompact) {
        return (
            <div
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                }}
                className={`group flex items-center justify-between p-3 rounded-md mb-2 cursor-grab active:cursor-grabbing transition-all border ${isDark ? 'bg-[#151521] border-[#2b2b40]/60 hover:border-[#3a3a5a] hover:bg-[#232336] shadow-sm' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'}`}
            >
                <div className="flex items-center space-x-3 overflow-hidden">
                    <span className={`text-sm font-light truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {item.content}
                        {item.eventName ? <span className="ml-2 text-xs">{item.eventName}</span> : null}
                    </span>
                </div>

                <button
                    onClick={() => onExpand(item)}
                    className={`flex-shrink-0 flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-light transition-colors border ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60 text-[#a1a5b7] hover:bg-[#2b2b40] hover:text-gray-200' : 'bg-gray-50 border-gray-200/60 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
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
            className={`group relative p-4 rounded-md mb-3 cursor-grab active:cursor-grabbing transition-all border ${isDark ? 'bg-[#151521] border-[#2b2b40]/60 hover:border-[#3a3a5a] hover:bg-[#232336] shadow-sm' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'}`}
        >
            <div className="flex justify-between items-start mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-medium ${isDark ? 'bg-[rgb(var(--brand-accent-rgb)/0.1)] text-[var(--brand-accent-soft)] border border-[rgb(var(--brand-accent-rgb)/0.2)]' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                    {item.tag}
                </span>
                <button
                    onClick={() => onDelete(item.id)}
                    className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all ${isDark ? 'hover:bg-rose-500/10 text-gray-500 hover:text-rose-400' : 'hover:bg-rose-50 text-gray-400 hover:text-rose-500'}`}
                    title="Delete Task"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            <p className={`text-sm mb-4 font-light leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{item.content}</p>

            {(item.eventName || due) && (
                <div className="-mt-2 mb-3 flex flex-wrap items-center gap-1.5 text-[11px] font-light" data-testid="kanban-card-meta">
                    {item.eventName && (
                        <span className={`max-w-full truncate rounded px-1.5 py-0.5 ${isDark ? 'bg-[rgb(var(--brand-accent-rgb)/0.14)] text-[var(--brand-accent-soft)]' : 'bg-pink-50 text-pink-700'}`}>{item.eventName}</span>
                    )}
                    {due && (
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${dueTone[due.tone]}`}>
                            <CalendarClock size={11} />
                            {due.label}
                        </span>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className={`flex items-center space-x-1.5 text-xs px-2 py-1 rounded border ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60' : 'bg-gray-50 border-gray-200/60'} ${priorityColors[item.priority] || 'text-gray-500'}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="font-light">{priorityLabel}</span>
                    </div>
                    {assignee && (
                        <MemberAvatar
                            size="xs"
                            firstName={assignee.firstName}
                            lastName={assignee.lastName}
                            email={assignee.email}
                            title={`Assigned to ${[assignee.firstName, assignee.lastName].filter(Boolean).join(' ') || assignee.email}`}
                        />
                    )}
                </div>

                <div className="flex items-center space-x-3">
                    {item.messages?.length > 0 && (
                        <span className={`text-xs font-light ${isDark ? 'text-gray-400' : 'text-gray-500'}`} data-testid="kanban-comment-count">{item.messages.length}</span>
                    )}
                    {(item.messages?.length > 0 || item.attachments?.length > 0) && (
                        <div className={`flex items-center space-x-1.5 text-xs font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-400'}`}>
                            {item.messages?.length > 0 && <MessageSquare size={14} />}
                            {item.attachments?.length > 0 && <Paperclip size={14} />}
                        </div>
                    )}

                    <button
                        onClick={() => onExpand(item)}
                        className={`opacity-0 group-hover:opacity-100 flex items-center space-x-1 px-2 py-1.5 rounded-md text-xs font-light transition-colors border ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]/60 text-[#a1a5b7] hover:bg-[#2b2b40] hover:text-gray-200' : 'bg-gray-50 border-gray-200/60 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
                    >
                        <span>View</span>
                        <Maximize2 size={10} className="ml-1" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KanbanCard;
