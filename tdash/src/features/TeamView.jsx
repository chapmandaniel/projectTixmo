import React, { useState, useEffect } from 'react';
import { UserPlus, Edit3, Trash2, Shield, User, Lock } from 'lucide-react';
import TeamMemberWizard from './TeamMemberWizard';
import StatusBadge from '../components/StatusBadge';
import api from '../lib/api';
import { CURRENT_USER } from '../data/mockData'; // Keeping for current user check, ideally get from context

const TeamView = ({ isDark, user: currentUser }) => { // Accept currentUser from props or context
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [error, setError] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/users');
            setUsers(res.data.data.users || []);
        } catch (err) {
            console.error(err);
            setError('Failed to load team members');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDeleteUser = async (userId) => {
        if (window.confirm('Are you sure you want to remove this member? This action cannot be undone.')) {
            try {
                await api.delete(`/users/${userId}`);
                fetchUsers();
            } catch (err) {
                alert('Failed to delete user');
            }
        }
    };

    const handleWizardSuccess = () => {
        fetchUsers();
        setIsWizardOpen(false);
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'OWNER':
                return { icon: Lock, color: isDark ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'bg-pink-50 text-pink-700' };
            case 'ADMIN':
                return { icon: Shield, color: isDark ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-50 text-orange-700' };
            case 'TEAM_MEMBER':
                return { icon: User, color: isDark ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-blue-50 text-blue-700' };
            default:
                return { icon: User, color: isDark ? 'bg-slate-500/10 text-slate-300 border border-slate-500/20' : 'bg-slate-50 text-slate-700' };
        }
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {isWizardOpen && (
                <TeamMemberWizard
                    onClose={() => setIsWizardOpen(false)}
                    onSuccess={handleWizardSuccess}
                    isDark={isDark}
                />
            )}

            <div className="flex justify-between items-end">
                <div>
                    <h2 className={`text-3xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Team Members</h2>
                    <p className={`mt-1 text-lg font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>Manage your organization's users and permissions.</p>
                </div>
                <button
                    onClick={() => setIsWizardOpen(true)}
                    className={`flex items-center space-x-2 px-4 py-2 text-sm font-light tracking-wide rounded-md transition-all shadow-md ${isDark ? 'bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 shadow-pink-500/20 text-white' : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-400/20'}`}
                >
                    <UserPlus size={16} />
                    <span>Add Member</span>
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-900/20">
                    {error}
                </div>
            )}

            <div className={`rounded-md border overflow-hidden ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40]' : 'bg-white shadow-sm shadow-gray-200/50'}`}>
                <div className="overflow-x-auto">
                    <table className={`w-full text-left font-light tracking-wide text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                        <thead className={`${isDark ? 'bg-[#2b2b40] text-[#a1a5b7] border-b border-[#3a3a5a]' : 'bg-gray-50 text-gray-400'} text-xs uppercase font-light tracking-wider`}>
                            <tr>
                                <th className="px-6 py-4 font-light">Member</th>
                                <th className="px-6 py-4 font-light">Role</th>
                                <th className="px-6 py-4 font-light">Title</th>
                                <th className="px-6 py-4 font-light">Status</th>
                                <th className="px-6 py-4 text-right font-light">Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-[#2b2b40]' : 'divide-gray-50'}`}>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-xs opacity-50">Loading team members...</td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-xs opacity-50">No team members found.</td>
                                </tr>
                            ) : (
                                users.map((user) => {
                                    const badge = getRoleBadge(user.role);
                                    const Icon = badge.icon;
                                    return (
                                        <tr key={user.id} className={`transition-colors ${isDark ? 'hover:bg-[#232336]' : 'hover:bg-gray-50'}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-light ${isDark ? 'bg-[#2b2b40] text-gray-300 border border-[#3a3a5a]' : 'bg-gray-100 text-gray-600'}`}>
                                                        {user.firstName?.[0]}{user.lastName?.[0]}
                                                    </div>
                                                    <div>
                                                        <p className={`font-light text-base ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{user.firstName} {user.lastName}</p>
                                                        <p className={`text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'opacity-70'}`}>{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`flex items-center text-xs font-light tracking-wide px-2.5 py-1 rounded-sm w-fit ${badge.color}`}>
                                                    <Icon size={12} className="mr-1.5" />
                                                    {user.role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-light">
                                                {user.title || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-light tracking-wide border ${user.emailVerified
                                                    ? (isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-emerald-50 text-emerald-700')
                                                    : (isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700')
                                                    }`}>
                                                    {user.emailVerified ? 'Active' : 'Pending'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {/* Allow deleting anyone except self for now, backend enforces rules */}
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-red-900/20 text-gray-500 hover:text-red-400' : 'hover:bg-rose-50 text-gray-500 hover:text-rose-600'}`}
                                                    title="Remove Member"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeamView;
