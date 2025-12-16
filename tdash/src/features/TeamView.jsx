import React, { useState } from 'react';
import { UserPlus, Edit3, Trash2, Shield } from 'lucide-react';
import UserModal from './UserModal';
import StatusBadge from '../components/StatusBadge';
import { MOCK_USERS, CURRENT_USER } from '../data/mockData';

const TeamView = ({ isDark }) => {
    const [users, setUsers] = useState(MOCK_USERS);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // RBAC Logic
    const canManage = (targetUserRole) => {
        if (CURRENT_USER.role === 'ADMIN') return true;
        if (CURRENT_USER.role === 'PROMOTER' && targetUserRole === 'SCANNER') return true;
        return false;
    };

    const canAdd = CURRENT_USER.role === 'ADMIN' || CURRENT_USER.role === 'PROMOTER';

    const handleSaveUser = (userData) => {
        if (editingUser) {
            setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...userData } : u));
        } else {
            const newUser = {
                id: `u-${Date.now()}`,
                ...userData,
                status: 'PENDING',
                lastActive: '-'
            };
            setUsers(prev => [...prev, newUser]);
        }
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleDeleteUser = (userId) => {
        if (window.confirm('Are you sure you want to remove this member?')) {
            setUsers(prev => prev.filter(u => u.id !== userId));
        }
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {isModalOpen && (
                <UserModal
                    user={editingUser}
                    onClose={() => { setIsModalOpen(false); setEditingUser(null); }}
                    onSave={handleSaveUser}
                    isDark={isDark}
                />
            )}

            <div className="flex justify-between items-end">
                <div>
                    <h2 className={`text-2xl font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Team Members</h2>
                    <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 text-sm font-normal`}>Manage your organization's users and permissions.</p>
                </div>
                {canAdd && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className={`flex items-center space-x-2 px-4 py-2 text-sm font-normal rounded-lg transition-all shadow-lg ${isDark ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20' : 'bg-gray-800 text-white hover:bg-gray-700 shadow-gray-400/20'}`}
                    >
                        <UserPlus size={16} />
                        <span>Add Member</span>
                    </button>
                )}
            </div>

            <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-[#1e1e1e] shadow-lg shadow-black/20' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
                <div className="overflow-x-auto">
                    <table className={`w-full text-left text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <thead className={`${isDark ? 'bg-[#252525] text-gray-500' : 'bg-gray-50 text-gray-400'} text-xs uppercase font-normal`}>
                            <tr>
                                <th className="px-6 py-3 font-medium">Member</th>
                                <th className="px-6 py-3 font-medium">Role</th>
                                <th className="px-6 py-3 font-medium">Status</th>
                                <th className="px-6 py-3 font-medium">Last Active</th>
                                <th className="px-6 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-[#252525]' : 'divide-gray-50'}`}>
                            {users.map((user) => (
                                <tr key={user.id} className={`transition-colors ${isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-50'}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-light ${isDark ? 'bg-[#333] text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                                {user.firstName[0]}{user.lastName[0]}
                                            </div>
                                            <div>
                                                <p className={`font-light ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{user.firstName} {user.lastName}</p>
                                                <p className="text-xs opacity-70">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`flex items-center text-xs font-medium px-2 py-1 rounded w-fit ${user.role === 'ADMIN' ? (isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-700') :
                                                user.role === 'PROMOTER' ? (isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700') :
                                                    (isDark ? 'bg-slate-500/10 text-slate-300' : 'bg-slate-50 text-slate-700')
                                            }`}>
                                            {user.role === 'ADMIN' && <Shield size={12} className="mr-1" />}
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={user.status} isDark={isDark} />
                                    </td>
                                    <td className="px-6 py-4 text-xs">{user.lastActive}</td>
                                    <td className="px-6 py-4 text-right">
                                        {canManage(user.role) && user.id !== CURRENT_USER.id && (
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                                                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-[#333] text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-rose-500/10 text-gray-500 hover:text-rose-400' : 'hover:bg-rose-50 text-gray-500 hover:text-rose-600'}`}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeamView;
