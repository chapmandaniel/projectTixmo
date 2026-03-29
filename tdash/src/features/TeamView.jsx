import React, { useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2,
    Clock3,
    Lock,
    Shield,
    Trash2,
    User,
    UserPlus,
    Users,
} from 'lucide-react';
import TeamMemberWizard from './TeamMemberWizard';
import api from '../lib/api';

const TeamView = ({ isDark, user: currentUser }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [error, setError] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/users');
            setUsers(res.data.data.users || []);
            setError('');
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
        if (!window.confirm('Are you sure you want to remove this member? This action cannot be undone.')) {
            return;
        }

        try {
            await api.delete(`/users/${userId}`);
            fetchUsers();
        } catch (err) {
            alert('Failed to delete user');
        }
    };

    const handleWizardSuccess = () => {
        fetchUsers();
        setIsWizardOpen(false);
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'OWNER':
                return { icon: Lock, color: isDark ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'bg-pink-50 text-pink-700 border border-pink-100' };
            case 'ADMIN':
                return { icon: Shield, color: isDark ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-50 text-orange-700 border border-orange-100' };
            case 'TEAM_MEMBER':
                return { icon: User, color: isDark ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-blue-50 text-blue-700 border border-blue-100' };
            default:
                return { icon: User, color: isDark ? 'bg-slate-500/10 text-slate-300 border border-slate-500/20' : 'bg-slate-50 text-slate-700 border border-slate-100' };
        }
    };

    const stats = useMemo(() => {
        const active = users.filter((member) => member.emailVerified).length;
        const pending = users.filter((member) => !member.emailVerified).length;
        const admins = users.filter((member) => member.role === 'OWNER' || member.role === 'ADMIN').length;

        return [
            { id: 'total', label: 'Members', value: users.length, icon: Users, accent: 'from-fuchsia-500 to-cyan-400' },
            { id: 'active', label: 'Active', value: active, icon: CheckCircle2, accent: 'from-emerald-400 to-teal-500' },
            { id: 'pending', label: 'Pending', value: pending, icon: Clock3, accent: 'from-amber-400 to-orange-500' },
            { id: 'admins', label: 'Admins', value: admins, icon: Shield, accent: 'from-pink-500 to-rose-400' },
        ];
    }, [users]);

    return (
        <div className="space-y-8 animate-fade-in max-w-[1500px] mx-auto pb-12">
            {isWizardOpen && (
                <TeamMemberWizard
                    onClose={() => setIsWizardOpen(false)}
                    onSuccess={handleWizardSuccess}
                    isDark={isDark}
                />
            )}

            <section className={`relative overflow-hidden rounded-md border p-6 sm:p-8 ${isDark ? 'bg-[#1e1e2d] border-[#2b2b40] shadow-2xl shadow-black/20' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl" />
                    <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                </div>
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className={`flex flex-wrap items-baseline gap-3 text-3xl sm:text-4xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            <span className="inline-flex items-center gap-2">
                                <span>Team Members</span>
                                <Users className={`h-6 w-6 sm:h-7 sm:w-7 ${isDark ? 'text-pink-300' : 'text-pink-700'}`} />
                            </span>
                        </h2>
                        <p className={`mt-3 max-w-2xl text-sm leading-7 ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                            Manage organization access, role coverage, and pending invites from one roster.
                        </p>
                    </div>

                    <button
                        onClick={() => setIsWizardOpen(true)}
                        className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm transition-colors ${isDark ? 'bg-pink-500 text-white hover:bg-pink-400' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                    >
                        <UserPlus size={16} />
                        <span>Add member</span>
                    </button>
                </div>
            </section>

            {error && (
                <div className={`rounded-md border px-4 py-3 text-sm font-light ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    {error}
                </div>
            )}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.id} className={`relative overflow-hidden rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                            <div className={`absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r ${stat.accent}`} />
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-[#8f94aa]' : 'text-gray-500'}`}>{stat.label}</p>
                                    <p className={`mt-3 text-3xl font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{stat.value}</p>
                                </div>
                                <div className={`flex h-11 w-11 items-center justify-center rounded-md ${isDark ? 'bg-[#151521]' : 'bg-gray-50'}`}>
                                    <Icon size={18} className={isDark ? 'text-gray-200' : 'text-gray-700'} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </section>

            <section className={`rounded-md border p-5 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white shadow-sm'}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className={`text-2xl font-light tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Team directory</h3>
                        <p className={`mt-1 text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>
                            Everyone with access, their role, and whether they have completed their invite.
                        </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'border border-white/10 bg-white/5 text-[#8f94aa]' : 'border border-gray-200 bg-gray-50 text-gray-500'}`}>
                        {users.length} members
                    </span>
                </div>

                {loading ? (
                    <div className={`mt-5 rounded-md border border-dashed px-4 py-16 text-center text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-[#8f94aa]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                        Loading team members...
                    </div>
                ) : users.length === 0 ? (
                    <div className={`mt-5 rounded-md border border-dashed px-4 py-16 text-center text-sm font-light ${isDark ? 'border-[#2b2b40] bg-[#151521] text-[#8f94aa]' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                        No team members found.
                    </div>
                ) : (
                    <div className="mt-5 space-y-3">
                        {users.map((member) => {
                            const badge = getRoleBadge(member.role);
                            const Icon = badge.icon;
                            const isCurrentUser = currentUser?.id === member.id;

                            return (
                                <div key={member.id} className={`rounded-md border px-4 py-4 ${isDark ? 'border-[#2b2b40] bg-[#151521]' : 'border-gray-200 bg-gray-50'}`}>
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex min-w-0 items-center gap-4">
                                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-light ${isDark ? 'bg-[#232336] text-gray-200 border border-[#3a3a5a]' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                                {member.firstName?.[0]}{member.lastName?.[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className={`truncate text-base font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                                        {member.firstName} {member.lastName}
                                                    </p>
                                                    {isCurrentUser && (
                                                        <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${isDark ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-400/20' : 'bg-cyan-50 text-cyan-700 border border-cyan-100'}`}>
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`truncate text-sm font-light ${isDark ? 'text-[#a1a5b7]' : 'text-gray-500'}`}>{member.email}</p>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[36rem]">
                                            <div className={`rounded-md border px-3 py-2 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                                                <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Role</div>
                                                <div className={`mt-2 inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-light tracking-wide w-fit ${badge.color}`}>
                                                    <Icon size={12} />
                                                    {member.role.replace('_', ' ')}
                                                </div>
                                            </div>

                                            <div className={`rounded-md border px-3 py-2 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                                                <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Title</div>
                                                <div className={`mt-2 text-sm font-light ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                                    {member.title || '-'}
                                                </div>
                                            </div>

                                            <div className={`rounded-md border px-3 py-2 ${isDark ? 'border-[#2b2b40] bg-[#1e1e2d]' : 'border-gray-200 bg-white'}`}>
                                                <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Status</div>
                                                <div className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-light tracking-wide border ${
                                                    member.emailVerified
                                                        ? (isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-100')
                                                        : (isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-100')
                                                }`}>
                                                    {member.emailVerified ? 'Active' : 'Pending'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => handleDeleteUser(member.id)}
                                                disabled={isCurrentUser}
                                                className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                                                    isCurrentUser
                                                        ? (isDark ? 'bg-[#232336] text-[#5e6278] cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                                                        : (isDark ? 'hover:bg-red-900/20 text-gray-500 hover:text-red-400' : 'hover:bg-rose-50 text-gray-500 hover:text-rose-600')
                                                }`}
                                                title={isCurrentUser ? 'You cannot remove your own account' : 'Remove member'}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
};

export default TeamView;
