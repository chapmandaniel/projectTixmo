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
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardPage,
    DashboardSection,
    DashboardStripedList,
    DashboardStripedRow,
    DashboardSurface,
    DashboardTitleBar,
} from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';
import { cn } from '../lib/utils';

const TeamView = ({ isDark, user: currentUser }) => {
    const uiTheme = getDashboardTheme(isDark);
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
                return { icon: Lock, color: isDark ? 'bg-pink-500/12 text-pink-300' : 'bg-pink-50 text-pink-700' };
            case 'ADMIN':
                return { icon: Shield, color: isDark ? 'bg-orange-500/12 text-orange-300' : 'bg-orange-50 text-orange-700' };
            case 'TEAM_MEMBER':
                return { icon: User, color: isDark ? 'bg-indigo-500/12 text-indigo-300' : 'bg-blue-50 text-blue-700' };
            default:
                return { icon: User, color: isDark ? 'bg-slate-500/12 text-slate-300' : 'bg-slate-50 text-slate-700' };
        }
    };

    const stats = useMemo(() => {
        const active = users.filter((member) => member.emailVerified).length;
        const pending = users.filter((member) => !member.emailVerified).length;
        const admins = users.filter((member) => member.role === 'OWNER' || member.role === 'ADMIN').length;

        return [
            { id: 'total', label: 'Members', value: users.length, icon: Users, accent: 'brand', iconClassName: 'text-pink-300' },
            { id: 'active', label: 'Active', value: active, icon: CheckCircle2, accent: 'green', iconClassName: 'text-emerald-300' },
            { id: 'pending', label: 'Pending', value: pending, icon: Clock3, accent: 'amber', iconClassName: 'text-amber-300' },
            { id: 'admins', label: 'Admins', value: admins, icon: Shield, accent: 'violet', iconClassName: 'text-violet-300' },
        ];
    }, [users]);

    return (
        <DashboardPage className="mx-auto max-w-[1500px] space-y-8">
            {isWizardOpen && (
                <TeamMemberWizard
                    onClose={() => setIsWizardOpen(false)}
                    onSuccess={handleWizardSuccess}
                    isDark={isDark}
                />
            )}

            <DashboardTitleBar
                isDark={isDark}
                title="Team Members"
                description="Manage organization access, role coverage, and pending invites from one roster."
                icon={Users}
                iconClassName={isDark ? 'text-pink-300' : 'text-pink-700'}
                glowTopClassName="bg-pink-500/10"
                glowBottomClassName="bg-cyan-400/10"
                actions={(
                    <DashboardButton
                        isDark={isDark}
                        onClick={() => setIsWizardOpen(true)}
                        className={cn(
                            isDark ? 'border-pink-500 bg-pink-500 hover:border-pink-400 hover:bg-pink-400' : ''
                        )}
                    >
                        <UserPlus size={16} />
                        <span>Add member</span>
                    </DashboardButton>
                )}
            />

            {error && (
                <div className={`rounded-md border px-4 py-3 text-sm font-light ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    {error}
                </div>
            )}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <DashboardSurface key={stat.id} isDark={isDark} accent={stat.accent} className="p-5">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className={cn('text-[10px] uppercase tracking-[0.18em]', uiTheme.textTertiary)}>{stat.label}</p>
                                    <p className={cn('mt-3 text-3xl font-light tracking-tight', uiTheme.textPrimary)}>{stat.value}</p>
                                </div>
                                <div className={`flex h-11 w-11 items-center justify-center rounded-md ${isDark ? 'bg-[#151521]' : 'bg-gray-50'}`}>
                                    <Icon size={18} className={stat.iconClassName} />
                                </div>
                            </div>
                        </DashboardSurface>
                    );
                })}
            </section>

            <DashboardSection
                isDark={isDark}
                accent="slate"
                title="Team directory"
                description="Everyone with access, their role, and whether they have completed their invite."
                actions={(
                    <DashboardChip isDark={isDark}>
                        {users.length} members
                    </DashboardChip>
                )}
            >
                {loading ? (
                    <DashboardEmptyState
                        isDark={isDark}
                        title="Loading team members"
                        description="Pulling the current organization roster into the shared team workspace."
                        className="mt-1"
                    />
                ) : users.length === 0 ? (
                    <DashboardEmptyState
                        isDark={isDark}
                        title="No team members found"
                        description="Invite a member to start assigning access and role coverage."
                        className="mt-1"
                    />
                ) : (
                    <DashboardStripedList isDark={isDark}>
                        <div className={cn(
                            'hidden px-5 py-3 lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_44px]',
                            isDark ? 'bg-dashboard-panelAlt' : 'bg-slate-100'
                        )}>
                            <div className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Member</div>
                            <div className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Role</div>
                            <div className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Title</div>
                            <div className={cn('text-[10px] uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Status</div>
                            <div />
                        </div>
                        {users.map((member, index) => {
                            const badge = getRoleBadge(member.role);
                            const Icon = badge.icon;
                            const isCurrentUser = currentUser?.id === member.id;

                            return (
                                <DashboardStripedRow
                                    key={member.id}
                                    isDark={isDark}
                                    index={index}
                                    className="px-5 py-4"
                                >
                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_44px] lg:items-center">
                                        <div className="flex min-w-0 items-center gap-4">
                                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-light ${isDark ? 'bg-dashboard-panelAlt text-gray-200' : 'bg-white text-gray-700 shadow-sm'}`}>
                                                {member.firstName?.[0]}{member.lastName?.[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className={cn('truncate text-base font-light', uiTheme.textPrimary)}>
                                                        {member.firstName} {member.lastName}
                                                    </p>
                                                    {isCurrentUser && (
                                                        <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${isDark ? 'bg-cyan-500/12 text-cyan-200' : 'bg-cyan-50 text-cyan-700'}`}>
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={cn('truncate text-sm font-light', uiTheme.textSecondary)}>{member.email}</p>
                                            </div>
                                        </div>

                                        <div className="min-w-0 text-left">
                                            <div className={cn('text-[10px] uppercase tracking-[0.16em] lg:hidden', uiTheme.textTertiary)}>Role</div>
                                            <div className="mt-2 lg:mt-0">
                                                <div className={`inline-flex items-center justify-start gap-1.5 rounded-full px-2.5 py-1 text-xs font-light tracking-wide w-fit ${badge.color}`}>
                                                    <Icon size={12} />
                                                    {member.role.replace('_', ' ')}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="min-w-0 text-left">
                                            <div className={cn('text-[10px] uppercase tracking-[0.16em] lg:hidden', uiTheme.textTertiary)}>Title</div>
                                            <div className={cn('mt-2 truncate text-sm font-light lg:mt-0', member.title ? uiTheme.textPrimary : uiTheme.textMuted)}>
                                                {member.title || '-'}
                                            </div>
                                        </div>

                                        <div className="min-w-0 text-left">
                                            <div className={cn('text-[10px] uppercase tracking-[0.16em] lg:hidden', uiTheme.textTertiary)}>Status</div>
                                            <div className={`mt-2 inline-flex items-center justify-start rounded-full px-2.5 py-1 text-xs font-light tracking-wide w-fit lg:mt-0 ${
                                                    member.emailVerified
                                                        ? (isDark ? 'bg-green-500/12 text-green-300' : 'bg-emerald-50 text-emerald-700')
                                                        : (isDark ? 'bg-amber-500/12 text-amber-300' : 'bg-amber-50 text-amber-700')
                                                }`}>
                                                {member.emailVerified ? 'Active' : 'Pending'}
                                            </div>
                                        </div>

                                        <div className="flex justify-end lg:justify-center">
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
                                </DashboardStripedRow>
                            );
                        })}
                    </DashboardStripedList>
                )}
            </DashboardSection>
        </DashboardPage>
    );
};

export default TeamView;
