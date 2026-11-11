import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import CommentThread from '../../components/CommentThread';
import DashboardPlaceholderView from '../DashboardPlaceholderView';
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardPage,
    DashboardSection,
    DashboardSelect,
    DashboardStat,
    DashboardTextInput,
    DashboardTitleBar,
} from '../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';
import { readSocialFilters, writeSocialSearch } from './filters';
import { cloneDefaultPhrases, cloneDefaultThresholds } from './mockWorkspace';
import {
    loadSocialConfig,
    loadWorkspace,
    phrasesForWorkspace,
    pollPlanForWorkspace,
    shouldUseLiveWorkspace,
    teamForWorkspace,
    thresholdsForWorkspace,
    workspaceForScene,
} from './socialClient';
import * as socialApi from './socialClient';
import { successivePolls } from './pollSchedule';

const DISMISS_REASONS = ['Not an issue', 'Duplicate', 'Spam/irrelevant', 'Handled elsewhere'];
const TEAM = ['Avery Stone', 'Sam R.', 'Parker Reed', 'Alex P.'];
const TOPICS = ['Ticketing', 'Refunds', 'Access/Entry', 'Lineup', 'Safety', 'Other'];
const SEVERITIES = ['HIGH', 'MED', 'LOW'];
const HOLDS = [
    { value: '', label: 'Automatic' },
    { value: 'NORMAL', label: 'Hold NORMAL' },
    { value: 'ON_SALE_DAY', label: 'Hold ON-SALE DAY' },
    { value: 'EVENT_DAY', label: 'Hold EVENT DAY' },
];
const MODE_LABEL = { NORMAL: 'NORMAL', ON_SALE_DAY: 'ON-SALE DAY', EVENT_DAY: 'EVENT DAY' };
const THRESHOLD_ROWS = [
    ['multiplier', 'Topic spike: × baseline'],
    ['minimum', 'Topic spike: min comments'],
    ['unanswered', 'Unanswered after'],
];

const previewConfig = {
    enabled: true,
    ready: true,
    phase: 'mock',
    environment: 'sandbox',
    sandboxOnly: true,
    retentionDays: 14,
    emailCapture: false,
    poll: {
        intervalMs: 5 * 60 * 1000,
        eventDayIntervalMs: 60 * 1000,
        lookbackMs: 14 * 24 * 60 * 60 * 1000,
        eventDayLookbackMs: 48 * 60 * 60 * 1000,
    },
};

const basePath = (pathname) => (pathname.startsWith('/preview/social') ? '/preview/social' : '/social');

const detailFromPath = (pathname) => {
    const match = pathname.match(/\/(?:preview\/)?social\/(issues|posts)\/([^/]+)/);
    if (!match) return { kind: '', id: '' };
    return { kind: match[1], id: decodeURIComponent(match[2]) };
};

const TextChip = ({ isDark, children }) => (
    <DashboardChip isDark={isDark} className="font-mono tracking-normal">[{children}]</DashboardChip>
);

const formatWhen = (iso) => {
    if (!iso) return '—';
    const date = new Date(iso);
    const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/St_Johns',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
    const offset = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/St_Johns',
        timeZoneName: 'shortOffset',
    }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value;
    return `${formatted} ${offset === 'GMT-2:30' ? 'NDT' : 'NST'}`;
};

const formatDay = (day) => {
    if (!day) return '';
    const [year, month, date] = day.split('-').map(Number);
    if (!year || !month || !date) return day;
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, date)));
};

const ageOf = (iso, now) => {
    const minutes = Math.max(0, Math.round((Date.parse(now) - Date.parse(iso)) / 60000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours}h`;
};

const stateText = (issue) => {
    if (issue.state === 'IN_PROGRESS') return issue.assignee ? `IN PROGRESS → ${issue.assignee}` : 'IN PROGRESS';
    if (issue.state === 'HANDLED') return 'HANDLED';
    if (issue.state === 'DISMISSED') return 'DISMISSED';
    return 'NEW';
};

const accountShort = (platform) => (platform === 'Instagram' ? 'IG' : 'FB');

const SocialCommandCenter = ({ isDark, user, preview = false }) => {
    const theme = getDashboardTheme(isDark);
    const location = useLocation();
    const [params, setParams] = useSearchParams();
    const filters = readSocialFilters(params);
    const [config, setConfig] = useState(preview ? previewConfig : null);
    const [issues, setIssues] = useState([]);
    const [notes, setNotes] = useState({});
    const [phrases, setPhrases] = useState(cloneDefaultPhrases);
    const [thresholds, setThresholds] = useState(cloneDefaultThresholds);
    const [hold, setHold] = useState('');
    const [holdUntil, setHoldUntil] = useState('2027-07-11');
    const [highEmail, setHighEmail] = useState(true);
    const [digest, setDigest] = useState(false);
    const [digestTime, setDigestTime] = useState('09:00');
    const [selected, setSelected] = useState([]);
    const [dismissReason, setDismissReason] = useState(DISMISS_REASONS[0]);
    const [connectPage, setConnectPage] = useState('harbourfest-test');
    const [editions, setEditions] = useState(['harbourfest-2027']);
    const [removed, setRemoved] = useState([]);
    const [disconnectId, setDisconnectId] = useState('');
    const [bulkPrompt, setBulkPrompt] = useState('');
    const [bulkResult, setBulkResult] = useState('');
    const [assignOpen, setAssignOpen] = useState(false);
    const [editingThresholds, setEditingThresholds] = useState(false);
    const [flagFor, setFlagFor] = useState('');
    const [flagTopic, setFlagTopic] = useState('Lineup');
    const [flagSeverity, setFlagSeverity] = useState('LOW');
    const [flaggedIds, setFlaggedIds] = useState({});
    const [live, setLive] = useState({ status: 'idle', workspace: null, source: 'mock' });
    const [reloadTick, setReloadTick] = useState(0);
    const [actionError, setActionError] = useState('');
    const [sandboxToken, setSandboxToken] = useState('');

    useEffect(() => {
        if (preview) return undefined;
        let cancelled = false;
        loadSocialConfig().then((next) => {
            if (!cancelled) setConfig(next);
        });
        return () => {
            cancelled = true;
        };
    }, [preview]);

    const mockWorkspace = useMemo(
        () => workspaceForScene(filters.scene, filters.graphError),
        [filters.scene, filters.graphError],
    );
    const liveEligible = !preview && shouldUseLiveWorkspace(config, filters);
    const liveKey = liveEligible ? [filters.event, filters.range, filters.from, filters.to, filters.account].join('|') : '';

    useEffect(() => {
        if (!liveEligible) {
            setLive({ status: 'idle', workspace: null, source: 'mock' });
            return undefined;
        }
        let cancelled = false;
        setLive((current) => (current.workspace ? current : { ...current, status: 'loading' }));
        loadWorkspace(config, {
            event: filters.event,
            range: filters.range,
            from: filters.from,
            to: filters.to,
            account: filters.account,
            scene: filters.scene,
            sceneRequested: filters.sceneRequested,
            graphError: filters.graphError,
        }).then(({ workspace: next, source }) => {
            if (!cancelled) setLive({ status: 'ready', workspace: next, source });
        }).catch(() => {
            if (!cancelled) setLive((current) => ({ ...current, status: current.workspace ? 'ready' : 'error' }));
        });
        return () => {
            cancelled = true;
        };
    }, [liveEligible, liveKey, reloadTick, config]);

    const workspace = liveEligible && live.workspace ? live.workspace : mockWorkspace;
    const isLive = liveEligible && live.source === 'live' && workspace === live.workspace;
    const awaitingLive = liveEligible && !live.workspace && live.status !== 'error';
    const query = params.toString();
    useEffect(() => {
        setIssues(workspace.issues);
        setPhrases(phrasesForWorkspace(workspace));
        setThresholds(thresholdsForWorkspace(workspace));
        setHold(workspace.hold?.mode || '');
        setHoldUntil(workspace.hold?.until || '2027-07-11');
        setRemoved([]);
        setFlaggedIds({});
    }, [workspace]);

    useEffect(() => {
        setBulkResult('');
        setActionError('');
    }, [mockWorkspace, liveKey]);
    useEffect(() => {
        const next = new URLSearchParams(query);
        setSelected((next.get('selected') || '').split(',').filter(Boolean));
        setDisconnectId(next.get('disconnect') || '');
        setAssignOpen(next.get('assign') === 'open');
        setEditingThresholds(next.get('thresholds') === 'edit');
        setFlagFor(next.get('flag') || '');
        setBulkPrompt(next.get('bulk') === 'confirm' ? 'assign' : '');
    }, [query]);

    const poll = config?.enabled ? pollPlanForWorkspace(config, { ...workspace, mode: hold || workspace.mode }) : null;
    const needsAction = issues.filter((issue) => issue.state === 'NEW' || issue.state === 'IN_PROGRESS').length;

    useEffect(() => {
        if (!config?.enabled) return undefined;
        window.dispatchEvent(new CustomEvent('tixmo:social-needs-action', { detail: { count: needsAction } }));
        return () => {
            window.dispatchEvent(new CustomEvent('tixmo:social-needs-action', { detail: { count: 0 } }));
        };
    }, [config?.enabled, needsAction]);

    if (!config) {
        return <DashboardPage><p className={theme.textSecondary}>Loading Social.</p></DashboardPage>;
    }
    if (config.enabled === true && awaitingLive) {
        return <DashboardPage><p className={theme.textSecondary}>Loading Social.</p></DashboardPage>;
    }
    if (config.enabled === true && liveEligible && live.status === 'error' && !live.workspace) {
        return (
            <DashboardPage>
                <DashboardEmptyState
                    isDark={isDark}
                    title="Social data could not be loaded"
                    description="The Social workspace did not respond. Try again in a moment."
                    action={<DashboardButton isDark={isDark} variant="secondary" onClick={() => setReloadTick((tick) => tick + 1)}>Try again</DashboardButton>}
                />
            </DashboardPage>
        );
    }
    if (config.enabled !== true) {
        return (
            <DashboardPlaceholderView
                isDark={isDark}
                title="Social"
                icon={MessageCircle}
                description="This module is outside the V1 beta scope and is hidden from the main workspace until the launch path is stable."
                badgeLabel="Outside V1 beta"
            />
        );
    }

    const root = basePath(location.pathname);
    const detail = detailFromPath(location.pathname);
    const tab = detail.kind === 'issues' ? 'issues' : detail.kind === 'posts' ? 'posts' : filters.tab;
    const search = params.toString();
    const href = (pathname, patch = {}) => ({
        pathname,
        search: writeSocialSearch(params, patch).toString(),
    });
    const update = (patch) => setParams(writeSocialSearch(params, patch));
    const role = preview && params.get('role') === 'member' ? 'TEAM_MEMBER' : user?.role;
    const admin = role === 'OWNER' || role === 'ADMIN';
    const actor = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Team';
    const team = teamForWorkspace(workspace, TEAM);
    const teamNames = team.map((member) => member.name);
    const teamIdFor = (name) => (name ? team.find((member) => member.name === name)?.id || name : null);
    const bulkAssignee = team.find((member) => member.name === 'Sam R.') || team[0] || { id: 'Sam R.', name: 'Sam R.' };
    const accounts = workspace.accounts.filter((account) => !removed.includes(account.id));
    const postById = Object.fromEntries(workspace.posts.map((post) => [post.id, post]));
    const commentById = Object.fromEntries(workspace.comments.map((comment) => [comment.id, comment]));
    const visiblePosts = workspace.posts.filter((post) => filters.account === 'all' || post.account === filters.account);
    const activeIssue = issues.find((issue) => issue.id === detail.id);
    const activePost = workspace.posts.find((post) => post.id === detail.id);
    const shownMode = hold ? MODE_LABEL[hold] : workspace.modeLabel;
    const modeSentence = `Alert mode: ${shownMode}${shownMode === 'NORMAL' ? '' : ' (tighter)'}${filters.event === 'all' ? ` · ${workspace.modeEventName}` : ''} · ${hold ? `held until ${formatDay(holdUntil)}` : 'auto from event dates'}`;
    const pollStamps = poll ? successivePolls(new Date(workspace.now), poll.intervalMs, 2).join(',') : '';
    const openWave = issues.find((issue) => issue.kind === 'WAVE' && issue.severity === 'HIGH' && (issue.state === 'NEW' || issue.state === 'IN_PROGRESS'));

    const reloadLive = () => setReloadTick((tick) => tick + 1);
    const runLive = async (task) => {
        setActionError('');
        try {
            await task();
            return true;
        } catch (error) {
            const status = error?.response?.status;
            setActionError(status === 403 ? 'Only org admins can make that change.' : 'That change could not be saved. Nothing was changed.');
            return false;
        }
    };

    const patchIssue = (id, changer) => {
        setIssues((current) => current.map((issue) => (issue.id === id ? changer(issue) : issue)));
    };
    const changeIssue = async (id, body, changer) => {
        if (!isLive) {
            patchIssue(id, changer);
            return;
        }
        if (await runLive(() => socialApi.patchIssue(id, body))) {
            patchIssue(id, changer);
            reloadLive();
        }
    };
    const log = (issue, text) => ({
        ...issue,
        activity: [...issue.activity, { at: workspace.now, text }],
    });
    const issueMatchesAccount = (issue) => {
        if (filters.account === 'all') return true;
        return issue.commentIds.some((id) => postById[commentById[id]?.postId]?.account === filters.account);
    };
    const issueList = issues.filter((issue) => {
        if (!issueMatchesAccount(issue)) return false;
        if (filters.topic !== 'all' && issue.topic !== filters.topic) return false;
        if (filters.severity !== 'all' && issue.severity !== filters.severity) return false;
        if (filters.assignee === 'unassigned' && issue.assignee) return false;
        if (filters.assignee !== 'all' && filters.assignee !== 'unassigned' && issue.assignee !== filters.assignee) return false;
        if (filters.status !== 'all' && issue.state !== filters.status) return false;
        if (filters.view === 'unanswered') return issue.unanswered && issue.state !== 'HANDLED' && issue.state !== 'DISMISSED';
        if (filters.view === 'waves') return issue.kind === 'WAVE';
        if (filters.view === 'handled') return issue.state === 'HANDLED';
        if (filters.view === 'all') return true;
        return issue.state === 'NEW' || issue.state === 'IN_PROGRESS';
    });
    const unansweredRows = issues
        .filter((issue) => issue.unanswered && issue.state !== 'HANDLED' && issue.state !== 'DISMISSED' && issueMatchesAccount(issue))
        .map((issue) => ({ issue, comment: commentById[issue.commentIds[0]], post: postById[commentById[issue.commentIds[0]]?.postId] }))
        .filter((row) => row.comment)
        .sort((left, right) => Date.parse(left.comment.at) - Date.parse(right.comment.at));

    const assignIssue = (issue, name) => changeIssue(issue.id, { assigneeId: teamIdFor(name) }, (current) => log({
        ...current,
        assignee: name,
        state: name ? (current.state === 'NEW' ? 'IN_PROGRESS' : current.state) : current.state,
    }, name ? `Assigned to ${name} by ${actor}.` : `Unassigned by ${actor}. State stays In progress.`));

    const applyBulk = async (action) => {
        const count = selected.length;
        if (isLive) {
            const ok = await runLive(() => socialApi.bulkIssues({
                issueIds: selected,
                action,
                assigneeId: action === 'assign' ? bulkAssignee.id : undefined,
                dismissReason: action === 'dismiss' ? dismissReason : undefined,
            }));
            if (!ok) return;
            reloadLive();
        }
        setIssues((current) => current.map((issue) => {
            if (!selected.includes(issue.id)) return issue;
            if (action === 'handled') return log({ ...issue, state: 'HANDLED' }, `Marked handled by ${actor}.`);
            if (action === 'dismiss') return log({ ...issue, state: 'DISMISSED' }, `Dismissed: ${dismissReason}. By ${actor}.`);
            return log({ ...issue, assignee: bulkAssignee.name, state: issue.state === 'NEW' ? 'IN_PROGRESS' : issue.state }, `Assigned to ${bulkAssignee.name} by ${actor}.`);
        }));
        setSelected([]);
        setBulkPrompt('');
        setBulkResult(action === 'handled'
            ? `Marked ${count} issues handled.`
            : action === 'dismiss'
                ? `Dismissed ${count} issues: ${dismissReason}.`
                : `Assigned ${count} issues to ${bulkAssignee.name}.`);
    };

    const saveFlag = (comment) => {
        const id = `manual-${comment.id}`;
        setIssues((current) => (current.some((issue) => issue.id === id) ? current : [{
            id,
            kind: 'SINGLE',
            topic: flagTopic,
            severity: flagSeverity,
            state: 'NEW',
            ruleText: `Manual flag by ${actor}. Topic ${flagTopic}, severity ${flagSeverity}.`,
            matched: '',
            commentIds: [comment.id],
            count: 1,
            assignee: '',
            unanswered: false,
            openedAt: workspace.now,
            topTerms: '',
            volume: '1',
            baseline: '1',
            activity: [{ at: workspace.now, text: `Opened by manual flag by ${actor} (topic ${flagTopic}, severity ${flagSeverity}, mode ${shownMode}).` }],
        }, ...current]));
        setFlaggedIds((current) => ({ ...current, [comment.id]: id }));
        setFlagFor('');
    };

    const modeLine = (
        <p data-testid="mode-line" className="text-sm font-light">
            {modeSentence}
            {' · '}
            <Link className="underline" to={href(root, { tab: 'settings' })}>Change</Link>
        </p>
    );

    const replyLink = (post) => (
        <a className={cn('text-sm underline', theme.textSecondary)} href={post?.permalink || 'https://example.test/sandbox'} target="_blank" rel="noreferrer">
            Reply on {post?.platform === 'Instagram' ? 'Instagram' : 'Facebook'} ↗
        </a>
    );

    const overview = (
        <>
            {modeLine}
            {workspace.banners.map((banner) => (
                <div key={banner} className={cn('flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3', theme.panel)}>
                    <p>{banner}</p>
                    <DashboardButton isDark={isDark} variant="secondary" onClick={() => update({ tab: 'settings', connect: '2' })}>Reconnect sandbox Page</DashboardButton>
                </div>
            ))}
            {workspace.rateLimit ? (
                <span data-testid="rate-limit-chip" data-graph-error={workspace.graphErrorCode || ''}>
                    <DashboardChip isDark={isDark}>{workspace.rateLimit}</DashboardChip>
                </span>
            ) : null}
            {workspace.syncProgress ? <p data-testid="sync-progress" className="text-sm font-light">{workspace.syncProgress}</p> : null}
            {openWave && workspace.scene !== 'syncing' ? (
                <div data-testid="alert-strip" className={cn('flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3', theme.panel)}>
                    <p className="text-sm font-light">
                        <TextChip isDark={isDark}>HIGH</TextChip>
                        {' '}
                        {openWave.topic} wave · {openWave.count} comments in last hour (rule: &quot;{openWave.matched}&quot;)
                    </p>
                    <Link className="text-sm underline" to={href(`${root}/issues/${openWave.id}`)}>View wave</Link>
                </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                    ['Reach', workspace.kpis.reach, workspace.kpis.reachDetail],
                    ['Engagements', workspace.kpis.engagements, workspace.kpis.engagementDetail],
                    ['Followers', workspace.kpis.followers, workspace.kpis.followerDetail],
                    ['Open issues', workspace.scene === 'syncing' ? '—' : String(needsAction), workspace.scene === 'syncing' ? 'Syncing' : workspace.kpis.openDetail],
                    [`Unanswered > ${workspace.unansweredLimit}`, workspace.scene === 'syncing' ? '—' : workspace.kpis.unanswered, workspace.scene === 'syncing' ? 'Syncing' : `${workspace.kpis.unansweredDetail}${workspace.oldestUnanswered ? ` · oldest ${workspace.oldestUnanswered}` : ''}`],
                ].map(([label, value, detailText]) => (
                    <DashboardStat key={label} isDark={isDark} label={label} value={value} detail={detailText || undefined} />
                ))}
            </div>
            {workspace.permissionNote ? (
                <DashboardEmptyState
                    isDark={isDark}
                    title="Insights unavailable"
                    description={workspace.permissionNote}
                    action={admin ? <DashboardButton isDark={isDark} variant="secondary" onClick={() => update({ tab: 'settings', connect: '2' })}>Reconnect sandbox Page</DashboardButton> : null}
                />
            ) : null}
            <DashboardSection isDark={isDark} title="Trend" description="Facebook and Instagram series. Markers come from event dates only.">
                {workspace.trend.length === 0 ? <p className={theme.textSecondary}>Syncing</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm font-light">
                            <thead>
                                <tr className={theme.textTertiary}>
                                    <th className="py-2 pr-4 font-light">Day</th>
                                    <th className="py-2 pr-4 font-light">Facebook</th>
                                    <th className="py-2 pr-4 font-light">Instagram</th>
                                    <th className="py-2 font-light">Marker</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workspace.trend.map((row) => (
                                    <tr key={row.day} className={cn('border-t', theme.divider)}>
                                        <td className="py-2 pr-4">{row.day}</td>
                                        <td className="py-2 pr-4">{row.facebook}</td>
                                        <td className="py-2 pr-4">{row.instagram}</td>
                                        <td className="py-2">{row.marker || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </DashboardSection>
            <div className="grid gap-4 lg:grid-cols-2">
                <DashboardSection isDark={isDark} title="Active waves" description="Comment volume in the current window. Below limit means the topic is under the mode threshold." actions={<Link className="text-sm underline" to={href(root, { tab: 'issues', view: 'waves' })}>View all waves</Link>}>
                    {workspace.waves.length === 0 ? (
                        <DashboardEmptyState isDark={isDark} compact title="No active waves" description="No topic is at the current mode threshold." />
                    ) : (
                        <table className="w-full text-left text-sm font-light">
                            <thead>
                                <tr className={theme.textTertiary}>
                                    <th className="py-2 pr-4 font-light">Topic</th>
                                    <th className="py-2 pr-4 font-light">Comments</th>
                                    <th className="py-2 font-light">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workspace.waves.map((row) => (
                                    <tr key={row.topic} className={cn('border-t', theme.divider)}>
                                        <td className="py-2 pr-4">{row.topic}</td>
                                        <td className="py-2 pr-4">{row.count}</td>
                                        <td className="py-2">{row.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </DashboardSection>
                <DashboardSection isDark={isDark} title="Top posts" description="By reach, in this range." actions={<Link className="text-sm underline" to={href(root, { tab: 'posts' })}>All posts</Link>}>
                    {visiblePosts.length === 0 ? <p className={theme.textSecondary}>No posts in this range.</p> : (
                        <div data-testid="top-posts" className="space-y-3">
                            {visiblePosts.slice(0, 3).map((post, index) => (
                                <p key={post.id} className="text-sm font-light">
                                    {index + 1}. &quot;{post.caption}&quot; {accountShort(post.platform)} · Reach {post.reach} · Eng {post.engagementRate}
                                    <span className={cn('block', theme.textSecondary)}>{post.comments} comments · {post.flagged} flagged</span>
                                </p>
                            ))}
                        </div>
                    )}
                </DashboardSection>
            </div>
            <DashboardSection isDark={isDark} title="Open issues by topic">
                {workspace.topics.length === 0 ? <p className={theme.textSecondary}>No issues in this range.</p> : (
                    <p className="text-sm font-light">{workspace.topics.map((row) => `${row.topic} ${row.count}`).join(' · ')}</p>
                )}
            </DashboardSection>
        </>
    );

    const issueFor = (commentId) => issues.find((issue) => issue.commentIds.includes(commentId));

    const issuesPanel = detail.kind === 'issues' && activeIssue ? (
        <DashboardSection
            isDark={isDark}
            title={activeIssue.kind === 'WAVE' ? `${activeIssue.topic} wave` : `${activeIssue.topic} issue`}
            description={`Opened ${formatWhen(activeIssue.openedAt)} · ${activeIssue.count || activeIssue.commentIds.length} comments · ${activeIssue.topic}`}
            actions={<Link className={theme.textSecondary} to={href(root, { tab: 'issues' })}>Back to Issues</Link>}
        >
            <div className="mb-4 flex flex-wrap gap-2">
                <TextChip isDark={isDark}>{activeIssue.severity}</TextChip>
                <TextChip isDark={isDark}>{stateText(activeIssue)}</TextChip>
                {activeIssue.kind === 'WAVE' ? <TextChip isDark={isDark}>WAVE</TextChip> : null}
                {activeIssue.unanswered ? <TextChip isDark={isDark}>{workspace.unansweredLabel}</TextChip> : null}
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
                <div>
                    <h3 className="mb-3 text-sm font-light">Comments in this issue ({activeIssue.count || activeIssue.commentIds.length})</h3>
                    {activeIssue.commentIds.map((id) => {
                        const comment = commentById[id];
                        const post = postById[comment?.postId];
                        if (!comment) return null;
                        return (
                            <div key={id} className={cn('mb-4 rounded-md border p-3', theme.panel)}>
                                <p className="text-sm font-light">{comment.handle} · {accountShort(post?.platform)} · {formatWhen(comment.at)}{post ? ` · on "${post.caption}"` : ''}</p>
                                <p className="mt-2 text-sm font-light">{comment.text}</p>
                                <p className={cn('mt-1 text-sm font-light', theme.textSecondary)}>Matched: {activeIssue.matched ? `"${activeIssue.matched}"` : '—'}{comment.unanswered ? ' · UNANSWERED' : ''}</p>
                                <p hidden data-testid="classifier-label-slot">{comment.label === '' ? 'empty' : comment.label}</p>
                                <div className="mt-2">{replyLink(post)}</div>
                            </div>
                        );
                    })}
                    {activeIssue.kind === 'WAVE' && activeIssue.count > activeIssue.commentIds.length ? (
                        <p className={cn('text-sm font-light', theme.textSecondary)}>{activeIssue.count - activeIssue.commentIds.length} more comments are in this window.</p>
                    ) : null}
                </div>
                <div id="issue-assignee" data-testid="issue-assignee" className="scroll-mt-24">
                    <h3 className="mb-3 text-sm font-light">Decision</h3>
                    <div className="flex flex-wrap gap-2">
                        <DashboardButton isDark={isDark} variant="secondary" onClick={() => changeIssue(activeIssue.id, { status: 'HANDLED' }, (issue) => log({ ...issue, state: 'HANDLED' }, `Marked handled by ${actor}.`))}>Mark handled</DashboardButton>
                        <DashboardButton isDark={isDark} variant="secondary" onClick={() => changeIssue(activeIssue.id, { status: 'IN_PROGRESS' }, (issue) => log({ ...issue, state: 'IN_PROGRESS' }, `Reopened by ${actor}.`))}>Reopen</DashboardButton>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end gap-2">
                        <label className="text-sm font-light">
                            Dismiss reason
                            <DashboardSelect isDark={isDark} className="mt-1" aria-label="Dismiss reason" value={dismissReason} onChange={(event) => setDismissReason(event.target.value)}>
                                {DISMISS_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
                            </DashboardSelect>
                        </label>
                        <DashboardButton isDark={isDark} variant="danger" onClick={() => changeIssue(activeIssue.id, { status: 'DISMISSED', dismissReason }, (issue) => log({ ...issue, state: 'DISMISSED' }, `Dismissed: ${dismissReason}. By ${actor}.`))}>Dismiss</DashboardButton>
                    </div>
                    <label className="mt-4 block text-sm font-light">
                        Assignee
                        <DashboardSelect isDark={isDark} className="mt-1" aria-label="Assignee" value={activeIssue.assignee} onChange={(event) => assignIssue(activeIssue, event.target.value)}>
                            <option value="">Unassigned</option>
                            {teamNames.map((name) => <option key={name} value={name}>{name}</option>)}
                        </DashboardSelect>
                    </label>
                    <DashboardButton isDark={isDark} className="mt-2" variant="secondary" aria-expanded={assignOpen} onClick={() => setAssignOpen((open) => !open)}>Assign</DashboardButton>
                    {assignOpen ? (
                        <ul aria-label="Team members" className="mt-2 space-y-1">
                            {teamNames.map((name) => (
                                <li key={name}>
                                    <DashboardButton isDark={isDark} variant="subtle" onClick={() => { assignIssue(activeIssue, name); setAssignOpen(false); }}>{name}</DashboardButton>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <label className="mt-4 block text-sm font-light">
                        Severity
                        <DashboardSelect isDark={isDark} className="mt-1" aria-label="Severity" value={activeIssue.severity} onChange={(event) => changeIssue(activeIssue.id, { severity: event.target.value }, (issue) => log({ ...issue, severity: event.target.value }, `Severity changed from ${issue.severity} to ${event.target.value}.`))}>
                            {SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
                        </DashboardSelect>
                    </label>
                    <label className="mt-4 block text-sm font-light">
                        Topic
                        <DashboardSelect isDark={isDark} className="mt-1" aria-label="Topic" value={activeIssue.topic} onChange={(event) => changeIssue(activeIssue.id, { topic: event.target.value }, (issue) => log({ ...issue, topic: event.target.value }, `Topic changed from ${issue.topic} to ${event.target.value}.`))}>
                            {TOPICS.map((topic) => <option key={topic}>{topic}</option>)}
                        </DashboardSelect>
                    </label>
                    {activeIssue.kind === 'WAVE' ? (
                        <div className="mt-4 text-sm font-light">
                            <p>Wave volume (comments / 15m)</p>
                            <p className="mt-1">{activeIssue.volume} · baseline {activeIssue.baseline}</p>
                            <p className="mt-2">Top terms: {activeIssue.topTerms}</p>
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="mt-6">
                <p className={cn('mb-2 text-sm font-light', theme.textSecondary)}>Internal notes. Team only, not posted. Do not paste an email address or an order number.</p>
                <CommentThread
                    isDark={isDark}
                    comments={notes[activeIssue.id] || []}
                    currentUser={user}
                    placeholder="Team-only note. This is not posted."
                    emptyTitle="No notes yet"
                    emptyHint="Notes stay in Tixmo and are not posted."
                    onAddComment={async ({ content }) => {
                        if (isLive && !(await runLive(() => socialApi.patchIssue(activeIssue.id, { note: content })))) return;
                        setNotes((current) => ({
                            ...current,
                            [activeIssue.id]: [...(current[activeIssue.id] || []), { id: `${activeIssue.id}-${(current[activeIssue.id] || []).length + 1}`, content, author: user?.firstName || 'Team' }],
                        }));
                        patchIssue(activeIssue.id, (issue) => log(issue, `Internal note added by ${actor}. Not posted.`));
                    }}
                />
            </div>
            <div className="mt-6" data-testid="activity-log">
                <h3 className="mb-2 text-sm font-light">Activity</h3>
                <ul className="space-y-1 text-sm font-light">
                    {activeIssue.activity.map((entry) => <li key={`${entry.at}-${entry.text}`}>{formatWhen(entry.at)} {entry.text}</li>)}
                </ul>
            </div>
        </DashboardSection>
    ) : (
        <DashboardSection
            isDark={isDark}
            title="Issues"
            description={filters.view === 'unanswered'
                ? `${workspace.unansweredLabel}. Limit: ${workspace.unansweredLimit} (${shownMode}). Sorted oldest first.`
                : filters.view === 'handled'
                    ? 'Handled issues.'
                    : filters.view === 'waves'
                        ? 'Keyword-spike waves.'
                        : filters.view === 'all'
                            ? 'Every state: New, In progress, Handled, and Dismissed.'
                            : 'Needs action: New and In progress.'}
            actions={(
                <div className="flex flex-wrap gap-2">
                    {[
                        ['needs-action', 'Needs action'],
                        ['unanswered', workspace.unansweredLabel],
                        ['waves', 'Waves'],
                        ['handled', 'Handled'],
                        ['all', 'All'],
                    ].map(([view, label]) => (
                        <DashboardButton key={view} isDark={isDark} variant={filters.view === view ? 'primary' : 'secondary'} onClick={() => update({ view })}>
                            {label}
                        </DashboardButton>
                    ))}
                </div>
            )}
        >
            <div className="mb-4 flex flex-wrap gap-3">
                <label className="text-sm font-light">Status
                    <DashboardSelect isDark={isDark} className="mt-1" aria-label="Status" value={filters.status} onChange={(event) => update({ status: event.target.value })}>
                        <option value="all">All statuses</option>
                        <option value="NEW">NEW</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="HANDLED">HANDLED</option>
                        <option value="DISMISSED">DISMISSED</option>
                    </DashboardSelect>
                </label>
                <label className="text-sm font-light">Topic
                    <DashboardSelect isDark={isDark} className="mt-1" aria-label="Topic filter" value={filters.topic} onChange={(event) => update({ topic: event.target.value })}>
                        <option value="all">All topics</option>
                        {TOPICS.map((topic) => <option key={topic}>{topic}</option>)}
                    </DashboardSelect>
                </label>
                <label className="text-sm font-light">Severity
                    <DashboardSelect isDark={isDark} className="mt-1" aria-label="Severity filter" value={filters.severity} onChange={(event) => update({ severity: event.target.value })}>
                        <option value="all">All severities</option>
                        {SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
                    </DashboardSelect>
                </label>
                <label className="text-sm font-light">Assignee
                    <DashboardSelect isDark={isDark} className="mt-1" aria-label="Assignee filter" value={filters.assignee} onChange={(event) => update({ assignee: event.target.value })}>
                        <option value="all">Anyone</option>
                        <option value="unassigned">Unassigned</option>
                        {teamNames.map((name) => <option key={name}>{name}</option>)}
                    </DashboardSelect>
                </label>
            </div>
            {filters.view === 'unanswered' ? (
                unansweredRows.length === 0 ? (
                    <DashboardEmptyState isDark={isDark} title="Nothing unanswered" description="No question is past the limit without a Page reply." />
                ) : (
                    <>
                        <ul className="space-y-3 md:hidden" data-testid="unanswered-cards">
                            {unansweredRows.map(({ issue, comment, post }) => (
                                <li key={issue.id} className={cn('rounded-md border p-3 text-sm font-light', theme.panel)}>
                                    <p>Age {ageOf(comment.at, workspace.now)}</p>
                                    <p>Topic {issue.topic}</p>
                                    <p>Comment {comment.text}</p>
                                    <p>Post {post ? `${accountShort(post.platform)} ${post.caption}` : '—'}</p>
                                    <p>Assignee {issue.assignee || '—'}</p>
                                    <div className="mt-2">{replyLink(post)}</div>
                                </li>
                            ))}
                        </ul>
                        <div className="hidden overflow-x-auto md:block" data-testid="unanswered-table">
                            <table className="w-full text-left text-sm font-light">
                                <thead>
                                    <tr className={theme.textTertiary}>
                                        {['Age', 'Topic', 'Comment', 'Post', 'Assignee', 'Action'].map((heading) => <th key={heading} className="py-2 pr-4 font-light">{heading}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {unansweredRows.map(({ issue, comment, post }) => (
                                        <tr key={issue.id} className={cn('border-t', theme.divider)}>
                                            <td className="py-2 pr-4">{ageOf(comment.at, workspace.now)}</td>
                                            <td className="py-2 pr-4">{issue.topic}</td>
                                            <td className="py-2 pr-4">{comment.text}</td>
                                            <td className="py-2 pr-4">{post ? `${accountShort(post.platform)} ${post.caption}` : '—'}</td>
                                            <td className="py-2 pr-4">{issue.assignee || '—'}</td>
                                            <td className="py-2">{replyLink(post)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )
            ) : workspace.scene === 'no-issues' || issueList.length === 0 ? (
                <DashboardEmptyState isDark={isDark} title="Nothing needs action" description="No open complaints or unanswered questions for this event." />
            ) : (
                <>
                    <div className="mb-3 flex flex-wrap gap-2">
                        <DashboardButton isDark={isDark} variant="secondary" onClick={() => setBulkPrompt('assign')}>Bulk assign</DashboardButton>
                        <DashboardButton isDark={isDark} variant="secondary" onClick={() => setBulkPrompt('handled')}>Bulk handled</DashboardButton>
                        <DashboardButton isDark={isDark} variant="danger" onClick={() => setBulkPrompt('dismiss')}>Bulk dismiss</DashboardButton>
                    </div>
                    {bulkPrompt ? (
                        <div data-testid="bulk-confirm" className={cn('mb-3 rounded-md border p-3 text-sm font-light', theme.panel)}>
                            <p>
                                {bulkPrompt === 'handled' && `Mark ${selected.length} selected issues handled?`}
                                {bulkPrompt === 'dismiss' && `Dismiss ${selected.length} selected issues as ${dismissReason}?`}
                                {bulkPrompt === 'assign' && `Assign ${selected.length} selected issues to ${bulkAssignee.name}?`}
                            </p>
                            <div className="mt-2 flex gap-2">
                                <DashboardButton isDark={isDark} onClick={() => applyBulk(bulkPrompt)}>Confirm</DashboardButton>
                                <DashboardButton isDark={isDark} variant="secondary" onClick={() => setBulkPrompt('')}>Cancel</DashboardButton>
                            </div>
                        </div>
                    ) : null}
                    {bulkResult ? <p data-testid="bulk-result" className="mb-3 text-sm font-light">{bulkResult}</p> : null}
                    <div className="overflow-x-auto">
                        {issueList.map((issue) => (
                            <div key={issue.id} className={cn('flex flex-wrap items-center gap-3 border-t py-3', theme.divider)}>
                                <input aria-label={`Select ${issue.topic}`} type="checkbox" checked={selected.includes(issue.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, issue.id] : current.filter((id) => id !== issue.id))} />
                                <TextChip isDark={isDark}>{issue.severity}</TextChip>
                                <TextChip isDark={isDark}>{stateText(issue)}</TextChip>
                                {issue.kind === 'WAVE' ? <TextChip isDark={isDark}>WAVE</TextChip> : null}
                                {issue.unanswered ? <TextChip isDark={isDark}>UNANSWERED</TextChip> : null}
                                <Link className="text-sm font-light underline" to={href(`${root}/issues/${issue.id}`)}>{issue.topic}{issue.kind === 'WAVE' ? ` · ${issue.count} comments` : ''}</Link>
                                <span className={cn('text-sm font-light', theme.textSecondary)}>{issue.ruleText}</span>
                                <span className={cn('text-sm font-light', theme.textSecondary)}>{formatWhen(issue.openedAt)} · {issue.assignee || 'Unassigned'}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </DashboardSection>
    );

    const postCards = (posts) => (
        <ul className="space-y-3 md:hidden" data-testid="posts-cards">
            {posts.map((post) => (
                <li key={post.id} className={cn('rounded-md border p-3 text-sm font-light', theme.panel)}>
                    <Link className="underline" to={href(`${root}/posts/${post.id}`, { tab: 'posts' })}>&quot;{post.caption}&quot;</Link>
                    <p className="mt-2">Acct {accountShort(post.platform)}</p>
                    <p>Posted {formatWhen(post.postedAt)}</p>
                    <p>Reach {post.reach}</p>
                    <p>Engagement rate {post.engagementRate}</p>
                    <p>Comments {post.comments}</p>
                    <p>Open issues {post.openIssues}</p>
                    {post.insights === 'pending' ? <p>Insights pending (not reported yet)</p> : null}
                </li>
            ))}
        </ul>
    );

    const postsPanel = detail.kind === 'posts' && activePost ? (
        <DashboardSection
            isDark={isDark}
            title={`"${activePost.caption}"`}
            description={`${accountShort(activePost.platform)} · posted ${formatWhen(activePost.postedAt)}`}
            actions={(
                <div className="flex flex-wrap gap-3">
                    <a className={cn('text-sm underline', theme.textSecondary)} href={activePost.permalink} target="_blank" rel="noreferrer">Open on {activePost.platform === 'Instagram' ? 'Instagram' : 'Facebook'} ↗</a>
                    <Link className={theme.textSecondary} to={href(root, { tab: 'posts' })}>Back to Posts</Link>
                </div>
            )}
        >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <DashboardStat isDark={isDark} label="Reach" value={activePost.insights === 'pending' ? '—' : activePost.reach} detail={activePost.insights === 'pending' ? 'Insights pending' : activePost.engagementRate} />
                <DashboardStat isDark={isDark} label="Views" value={activePost.insights === 'pending' ? '—' : activePost.views} detail={activePost.insights === 'pending' ? 'Not reported yet' : 'Views'} />
                <DashboardStat isDark={isDark} label="Engagements" value={activePost.insights === 'pending' ? '—' : activePost.engagements} detail={activePost.insights === 'pending' ? 'Insights pending' : 'Reactions and shares'} />
                <DashboardStat isDark={isDark} label="Saves" value={activePost.insights === 'pending' ? '—' : activePost.saves} detail={activePost.insights === 'pending' ? 'Insights pending' : `Shares ${activePost.shares}`} />
                <DashboardStat isDark={isDark} label="Comments" value={String(activePost.comments)} detail={`Flagged ${activePost.flagged}`} />
            </div>
            <p className="mt-4 text-sm font-light">Engagement over time, comments per hour since posting: {activePost.hourly}</p>
            <div className="mt-4 flex flex-wrap gap-2">
                {[
                    ['all', 'All'],
                    ['flagged', `Flagged (${activePost.flagged})`],
                    ['unanswered', `Unanswered (${workspace.comments.filter((comment) => comment.postId === activePost.id && comment.unanswered).length})`],
                ].map(([value, label]) => (
                    <DashboardButton key={value} isDark={isDark} variant={filters.comments === value ? 'primary' : 'secondary'} onClick={() => update({ comments: value })}>{label}</DashboardButton>
                ))}
            </div>
            <div className="mt-4 space-y-4">
                {workspace.comments.filter((comment) => {
                    if (comment.postId !== activePost.id) return false;
                    const flagged = comment.flagged || flaggedIds[comment.id];
                    if (filters.comments === 'flagged') return flagged;
                    if (filters.comments === 'unanswered') return comment.unanswered;
                    return true;
                }).map((comment) => {
                    const linked = issueFor(comment.id) || (flaggedIds[comment.id] ? issues.find((issue) => issue.id === flaggedIds[comment.id]) : null);
                    const flagged = comment.flagged || Boolean(flaggedIds[comment.id]);
                    return (
                        <div key={comment.id} className={cn('rounded-md border p-3', theme.panel)}>
                            <p className="text-sm font-light">
                                {flagged ? `[FLAGGED${linked ? ` · ${linked.topic} · in issue` : ''}] ` : ''}
                                {comment.handle} · {formatWhen(comment.at)}
                            </p>
                            <p className="mt-2 text-sm font-light">{comment.text}</p>
                            <p hidden data-testid="classifier-label-slot">{comment.label === '' ? 'empty' : comment.label}</p>
                            {comment.pageReplyAt ? <p className={cn('mt-2 text-sm font-light', theme.textSecondary)}>Page replied {formatWhen(comment.pageReplyAt)}</p> : null}
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                {linked ? <Link className="text-sm underline" to={href(`${root}/issues/${linked.id}`)}>Open issue</Link> : null}
                                {replyLink(activePost)}
                                {!flagged ? (
                                    <DashboardButton isDark={isDark} variant="secondary" onClick={() => setFlagFor(comment.id)}>Flag</DashboardButton>
                                ) : null}
                            </div>
                            {flagFor === comment.id ? (
                                <div className="mt-3 flex flex-wrap items-end gap-2">
                                    <label className="text-sm font-light">Topic
                                        <DashboardSelect isDark={isDark} className="mt-1" aria-label="Flag topic" value={flagTopic} onChange={(event) => setFlagTopic(event.target.value)}>
                                            {TOPICS.map((topic) => <option key={topic}>{topic}</option>)}
                                        </DashboardSelect>
                                    </label>
                                    <label className="text-sm font-light">Severity
                                        <DashboardSelect isDark={isDark} className="mt-1" aria-label="Flag severity" value={flagSeverity} onChange={(event) => setFlagSeverity(event.target.value)}>
                                            {SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
                                        </DashboardSelect>
                                    </label>
                                    <DashboardButton isDark={isDark} onClick={() => saveFlag(comment)}>Save flag</DashboardButton>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </DashboardSection>
    ) : (
        <DashboardSection isDark={isDark} title="Posts" description="Caption, account, posted time, reach, engagement rate, comments, and open issues.">
            {workspace.scene === 'no-data' || visiblePosts.length === 0 ? (
                <DashboardEmptyState isDark={isDark} title="No data in this range" description="No posts or insights in this range." />
            ) : (
                <>
                    {postCards(visiblePosts)}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[720px] text-left text-sm font-light">
                            <thead>
                                <tr className={theme.textTertiary}>
                                    {['Post', 'Acct', 'Posted', 'Reach', 'Eng. rate', 'Comments', 'Open issues'].map((heading) => <th key={heading} className="py-2 pr-4 font-light">{heading}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {visiblePosts.map((post) => (
                                    <tr key={post.id} className={cn('border-t', theme.divider)}>
                                        <td className="py-2 pr-4"><Link className="underline" to={href(`${root}/posts/${post.id}`, { tab: 'posts' })}>&quot;{post.caption}&quot;</Link></td>
                                        <td className="py-2 pr-4">{accountShort(post.platform)}</td>
                                        <td className="py-2 pr-4">{formatWhen(post.postedAt)}</td>
                                        <td className="py-2 pr-4">{post.reach}{post.insights === 'pending' ? ' · Insights pending (not reported yet)' : ''}</td>
                                        <td className="py-2 pr-4">{post.engagementRate}</td>
                                        <td className="py-2 pr-4">{post.comments}</td>
                                        <td className="py-2">{post.openIssues}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </DashboardSection>
    );

    const connectStep = filters.connect;
    const chosenPage = workspace.sandboxPages.find((page) => page.id === connectPage) || workspace.sandboxPages[0];
    const connectPanel = (
        <DashboardSection isDark={isDark} title="SANDBOX · TEST DATA" description="Tixmo reads posts, comments, and insights. It never posts.">
            <p className="text-sm font-light">Sandbox connect, step {connectStep || '1'} of 4</p>
            {!connectStep || connectStep === '1' ? (
                <div className="mt-3 space-y-2 text-sm font-light">
                    <p>Connect a sandbox Page</p>
                    <p>v1 uses test accounts from the Tixmo sandbox only. No real social accounts can be connected yet.</p>
                </div>
            ) : null}
            {connectStep === '2' ? (
                <fieldset className="mt-3 space-y-3 text-sm font-light">
                    <legend>Pick a test account</legend>
                    {workspace.sandboxPages.map((page) => (
                        <label key={page.id} className="flex items-start gap-2">
                            <input type="radio" name="sandbox-page" checked={connectPage === page.id} onChange={() => setConnectPage(page.id)} />
                            <span>Platform: {page.platformLabel} &quot;{page.name}&quot;. Linked: {page.linked}.</span>
                        </label>
                    ))}
                    {isLive ? (
                        <label className="block">Sandbox access token
                            <DashboardTextInput isDark={isDark} className="mt-1" type="password" autoComplete="off" aria-label="Sandbox access token" value={sandboxToken} onChange={(event) => setSandboxToken(event.target.value)} />
                        </label>
                    ) : null}
                    <p>Access used (read-only): posts, comments, insights.</p>
                </fieldset>
            ) : null}
            {connectStep === '3' ? (
                <div className="mt-3 space-y-3 text-sm font-light">
                    <p>Map to event. &quot;{chosenPage?.name}&quot;{chosenPage?.linked && chosenPage.linked !== 'none' ? ` + ${chosenPage.linked}` : ''}.</p>
                    {editions.map((edition, index) => (
                        <label key={`${edition}-${index}`} className="block">Event
                            <DashboardSelect isDark={isDark} className="mt-1" aria-label={index === 0 ? 'Map to event' : `Edition ${index + 1}`} value={edition} onChange={(event) => setEditions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}>
                                {workspace.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                            </DashboardSelect>
                        </label>
                    ))}
                    <DashboardButton isDark={isDark} variant="secondary" onClick={() => setEditions((current) => [...current, 'harbourfest-2026'])}>+ add another edition</DashboardButton>
                    <p>Posts and issues map to an edition by its date range. You can move a post manually later.</p>
                </div>
            ) : null}
            {connectStep === '4' ? (
                <div className="mt-3 space-y-2 text-sm font-light">
                    <p>Syncing test data…</p>
                    <p>Posts ✓ Comments 60% Insights …</p>
                </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
                {connectStep === '2' || connectStep === '3' ? <DashboardButton isDark={isDark} variant="secondary" onClick={() => update({ connect: String(Math.max(1, Number(connectStep) - 1)) })}>{connectStep === '2' ? 'Cancel' : 'Back'}</DashboardButton> : null}
                <DashboardButton isDark={isDark} onClick={() => (isLive && connectStep === '3' ? finishConnect() : update(connectStep === '4' ? { connect: '', tab: 'overview' } : { connect: String(Math.min(4, Number(connectStep || 1) + 1)), tab: 'settings' }))}>
                    {connectStep === '3' ? 'Connect & sync' : connectStep === '4' ? 'Go to Overview' : connectStep === '2' ? 'Next' : 'Connect sandbox Page'}
                </DashboardButton>
            </div>
        </DashboardSection>
    );

    const disconnectAccount = accounts.find((account) => account.id === disconnectId);
    const confirmDisconnect = async (account) => {
        if (isLive && !(await runLive(() => socialApi.disconnectAccount(account.id)))) return;
        setRemoved((current) => [...current, account.id]);
        setDisconnectId('');
        if (isLive) reloadLive();
    };
    const syncAccounts = async () => {
        if (await runLive(() => socialApi.syncNow())) reloadLive();
    };
    const finishConnect = async () => {
        const eventIds = [...new Set(editions)];
        const ok = await runLive(() => socialApi.connectAccount({
            accessToken: sandboxToken.trim() || chosenPage?.accessToken,
            pageId: chosenPage?.id,
            eventIds,
        }));
        setSandboxToken('');
        if (!ok) return;
        reloadLive();
        update({ connect: '4', tab: 'settings' });
    };
    const changeHold = async (mode, until) => {
        if (isLive && !(await runLive(() => socialApi.setHold({ mode, until })))) return;
        setHold(mode);
        if (isLive) reloadLive();
    };
    const persistThresholds = async (next) => {
        if (isLive && !(await runLive(() => socialApi.saveThresholds(next)))) return false;
        setEditingThresholds(false);
        if (isLive) reloadLive();
        return true;
    };
    const resetKeywords = async () => {
        const defaults = cloneDefaultPhrases();
        if (isLive && !(await runLive(() => socialApi.saveKeywords(defaults)))) return;
        setPhrases(defaults);
        if (isLive) reloadLive();
    };
    const settingsPanel = (
        <div className="space-y-4">
            {workspace.scene === 'no-accounts' ? (
                <div>
                    <p className="mb-3 text-sm font-light">SANDBOX · TEST DATA</p>
                    <DashboardEmptyState
                        isDark={isDark}
                        title="No sandbox Page connected"
                        description="Connect a sandbox test Page to see reach and catch complaints early."
                        action={admin ? <DashboardButton isDark={isDark} onClick={() => update({ connect: '1' })}>Connect sandbox Page</DashboardButton> : <p>An org admin connects accounts.</p>}
                    />
                </div>
            ) : null}
            {connectStep ? connectPanel : null}
            <DashboardSection isDark={isDark} title="Connected accounts · SANDBOX · test data" description="Sandbox tokens only. This screen never shows a token.">
                {accounts.length === 0 ? <p className={theme.textSecondary}>No sandbox accounts yet.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm font-light">
                            <thead>
                                <tr className={theme.textTertiary}>
                                    {['Account', 'Status', 'Last sync', 'Actions'].map((heading) => <th key={heading} className="py-2 pr-4 font-light">{heading}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.map((account) => (
                                    <tr key={account.id} className={cn('border-t', theme.divider)}>
                                        <td className="py-2 pr-4">{account.platformLabel} &quot;{account.name}&quot;</td>
                                        <td className="py-2 pr-4">{account.status}{account.attention ? `: ${account.attention}` : ''}</td>
                                        <td className="py-2 pr-4">{formatWhen(account.lastSync)}</td>
                                        <td className="py-2">
                                            {admin && account.status !== 'CONNECTED' ? <DashboardButton isDark={isDark} variant="secondary" onClick={() => update({ connect: '2' })}>Reconnect sandbox Page</DashboardButton> : null}
                                            {admin && account.status === 'CONNECTED' ? <DashboardButton isDark={isDark} variant="danger" onClick={() => setDisconnectId(account.id)}>Disconnect</DashboardButton> : null}
                                            {!admin ? <span>Org admins manage connections.</span> : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {disconnectAccount ? (
                    <div data-testid="disconnect-confirm" className={cn('mt-3 rounded-md border p-3 text-sm font-light', theme.panel)}>
                        <p>Disconnect sandbox Page &apos;{disconnectAccount.name}&apos;? Polling stops and its stored access is deleted.</p>
                        <div className="mt-2 flex gap-2">
                            <DashboardButton isDark={isDark} variant="danger" onClick={() => confirmDisconnect(disconnectAccount)}>Confirm disconnect</DashboardButton>
                            <DashboardButton isDark={isDark} variant="secondary" onClick={() => setDisconnectId('')}>Cancel</DashboardButton>
                        </div>
                    </div>
                ) : null}
                {admin ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <DashboardButton isDark={isDark} variant="secondary" onClick={() => update({ connect: '1' })}>Connect sandbox Page</DashboardButton>
                        {isLive ? <DashboardButton isDark={isDark} variant="secondary" onClick={syncAccounts}>Sync now</DashboardButton> : null}
                    </div>
                ) : <p className="mt-3 text-sm font-light">An org admin connects accounts.</p>}
            </DashboardSection>
            <DashboardSection isDark={isDark} title="Alert rules and threshold mode" description="Named modes only. With All events, Overview uses the tightest mode and names that event.">
                <p className="text-sm font-light">Current mode: {shownMode}{shownMode === 'NORMAL' ? '' : ' (tighter)'}</p>
                <p className="mt-2 text-sm font-light">Source: {hold ? `held until ${formatDay(holdUntil)}` : 'automatic from event dates'}</p>
                <p className="mt-2 text-sm font-light">Dates used: {workspace.datesUsed}</p>
                {workspace.scheduleNote ? <p className="mt-2 text-sm font-light">{workspace.scheduleNote}</p> : null}
                {workspace.onSaleNote ? <p className="mt-2 text-sm font-light">{workspace.onSaleNote}</p> : null}
                {!workspace.onSaleNote && (filters.event === 'all' || filters.event === 'quiet-hall') ? <p className="mt-2 text-sm font-light">Quiet Hall has no on-sale date. ON-SALE DAY does not trigger.</p> : null}
                <div className="mt-3 space-y-1">
                    {workspace.events.map((event) => <p key={event.id} className="text-sm font-light">{event.name}: {event.modeLabel}{event.scheduled ? '' : '. No schedule dates.'}</p>)}
                </div>
                {admin ? (
                    <fieldset className="mt-4 space-y-2 text-sm font-light">
                        <legend>Mode</legend>
                        {HOLDS.map((option) => (
                            <label key={option.label} className="flex items-center gap-2">
                                <input type="radio" name="threshold-hold" value={option.value} checked={hold === option.value} onChange={() => changeHold(option.value, holdUntil)} />
                                {option.label}
                            </label>
                        ))}
                        {hold ? (
                            <label className="block">Until
                                <DashboardTextInput isDark={isDark} className="mt-1" type="date" aria-label="Hold until" value={holdUntil} onChange={(event) => setHoldUntil(event.target.value)} onBlur={() => { if (isLive && hold && holdUntil !== workspace.hold?.until) changeHold(hold, holdUntil); }} />
                            </label>
                        ) : null}
                        <p>Each hold runs until the date. Precedence is EVENT DAY, then ON-SALE DAY, then NORMAL.</p>
                    </fieldset>
                ) : <p className="mt-3 text-sm font-light">An org admin edits the mode and thresholds.</p>}
                <ul className="mt-3 space-y-1 text-sm font-light">
                    {workspace.modeLog.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <div className="mt-4 overflow-x-auto" data-testid="thresholds">
                    <table className="w-full text-left text-sm font-light">
                        <thead>
                            <tr className={theme.textTertiary}>
                                {['Thresholds by mode', 'NORMAL', 'ON-SALE DAY', 'EVENT DAY'].map((heading) => <th key={heading} className="py-2 pr-4 font-light">{heading}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {THRESHOLD_ROWS.map(([key, label]) => (
                                <tr key={key} className={cn('border-t', theme.divider)}>
                                    <td className="py-2 pr-4">{label}</td>
                                    {['NORMAL', 'ON_SALE_DAY', 'EVENT_DAY'].map((mode) => (
                                        <td key={mode} className="py-2 pr-4">
                                            {editingThresholds ? (
                                                <DashboardTextInput isDark={isDark} aria-label={`${label} ${MODE_LABEL[mode]}`} value={thresholds[mode][key]} onChange={(event) => setThresholds((current) => ({ ...current, [mode]: { ...current[mode], [key]: event.target.value } }))} />
                                            ) : thresholds[mode][key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="mt-2 text-sm font-light">What counts as a day: a calendar day in the event timezone. Event day runs from 6 hours before the start through the end.</p>
                    {admin ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <DashboardButton isDark={isDark} variant="secondary" onClick={() => setEditingThresholds(true)}>Edit thresholds</DashboardButton>
                            {isLive && editingThresholds ? <DashboardButton isDark={isDark} onClick={() => persistThresholds(thresholds)}>Save thresholds</DashboardButton> : null}
                            <DashboardButton isDark={isDark} variant="secondary" onClick={async () => { const defaults = cloneDefaultThresholds(); if (await persistThresholds(defaults)) setThresholds(defaults); }}>Reset to defaults</DashboardButton>
                        </div>
                    ) : null}
                </div>
                <div className="mt-4 space-y-2">
                    <p className="text-sm font-light">Topics and keywords. The v1 cut is the source for the default lists.</p>
                    {Object.entries(phrases).map(([topic, list]) => (
                        <p key={topic} className="text-sm font-light">{topic}: {list.join(', ')}</p>
                    ))}
                    <p className="text-sm font-light">Other: question marks with no topic, and manual flags.</p>
                    <p className="text-sm font-light">Sentiment sorts within a severity only. It never opens an issue by itself.</p>
                    {admin ? <DashboardButton isDark={isDark} variant="secondary" onClick={resetKeywords}>Reset keywords</DashboardButton> : null}
                </div>
            </DashboardSection>
            <DashboardSection isDark={isDark} title="Notifications" description="In-app badge and the Overview alert strip stay on. HIGH email is on by default.">
                <p className="mb-3 text-sm font-light">Emails contain issue details and a link only, never comment text or commenter names.</p>
                <label className="flex items-center gap-2 text-sm font-light">
                    <input type="checkbox" checked={highEmail} onChange={(event) => setHighEmail(event.target.checked)} disabled={!admin && role !== 'TEAM_MEMBER'} />
                    HIGH email to the assignee and owners, or to org admins when unassigned
                </label>
                <label className="mt-3 flex flex-wrap items-center gap-2 text-sm font-light">
                    <input type="checkbox" checked={digest} onChange={(event) => setDigest(event.target.checked)} />
                    Daily digest
                    <DashboardTextInput isDark={isDark} type="time" aria-label="Digest time" value={digestTime} onChange={(event) => setDigestTime(event.target.value)} />
                </label>
                <p className="mt-3 text-sm font-light">Editable by org admins: thresholds and mode.</p>
            </DashboardSection>
            <DashboardSection isDark={isDark} title="Polling" description="Phase 1 does not poll. The cadence is configuration only.">
                <p data-testid="poll-plan" data-running="false" data-interval={poll?.intervalMs || ''} data-polls={pollStamps} className="text-sm font-light">
                    Not running. Every {poll ? Math.round(poll.intervalMs / 60000) : 5} min. Lookback {poll ? Math.round(poll.lookbackMs / 3600000) : 0} h. Next planned {poll?.nextPollAt}.
                </p>
            </DashboardSection>
        </div>
    );

    const panels = { overview, issues: issuesPanel, posts: postsPanel, settings: settingsPanel };

    return (
        <div
            data-testid="social-command-center"
            data-query={search}
            data-scene={workspace.scene || filters.scene}
            data-graph-error={workspace.graphErrorCode || filters.graphError || ''}
            data-running="false"
        >
            <DashboardPage>
                <DashboardTitleBar
                    isDark={isDark}
                    title="Social"
                    description="Tixmo reads sandbox posts, comments, and insights. It never posts or replies from this dashboard."
                    icon={MessageCircle}
                    badges={(
                        <>
                            <DashboardChip isDark={isDark}>SANDBOX · test data</DashboardChip>
                            <TextChip isDark={isDark}>{shownMode} · {hold ? 'held' : workspace.modeSource === 'held' ? 'held' : 'auto'}</TextChip>
                            {workspace.syncedLabel ? <DashboardChip isDark={isDark}>{workspace.syncedLabel}</DashboardChip> : null}
                            {needsAction > 0 ? <DashboardChip isDark={isDark}>{needsAction} need action</DashboardChip> : null}
                        </>
                    )}
                />
                {actionError ? <p role="alert" className="text-sm font-light">{actionError}</p> : null}
                {tab !== 'overview' ? modeLine : null}
                <label hidden>
                    Label
                    <select data-testid="classifier-label-filter" aria-label="Label" defaultValue="">
                        <option value="">Any</option>
                        <option value="positive">positive</option>
                        <option value="negative">negative</option>
                        <option value="neutral">neutral</option>
                        <option value="urgent">urgent</option>
                    </select>
                </label>
                <div className="flex flex-wrap gap-3">
                    <label className="text-sm font-light">Event
                        <DashboardSelect isDark={isDark} className="mt-1" aria-label="Event" value={filters.event} onChange={(event) => update({ event: event.target.value })}>
                            <option value="all">All events</option>
                            {workspace.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                        </DashboardSelect>
                    </label>
                    <label className="text-sm font-light">Date range
                        <DashboardSelect isDark={isDark} className="mt-1" aria-label="Date range" value={filters.range} onChange={(event) => update({ range: event.target.value })}>
                            <option value="today">Today</option>
                            <option value="7d">7 days</option>
                            <option value="28d">28 days</option>
                            <option value="30d">30 days</option>
                            <option value="custom">Custom</option>
                        </DashboardSelect>
                    </label>
                    {filters.range === 'custom' ? (
                        <>
                            <label className="text-sm font-light">From
                                <DashboardTextInput isDark={isDark} className="mt-1" type="date" aria-label="From" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
                            </label>
                            <label className="text-sm font-light">To
                                <DashboardTextInput isDark={isDark} className="mt-1" type="date" aria-label="To" value={filters.to} onChange={(event) => update({ to: event.target.value })} />
                            </label>
                        </>
                    ) : null}
                    <label className="text-sm font-light">Account
                        <DashboardSelect isDark={isDark} className="mt-1" aria-label="Account" value={filters.account} onChange={(event) => update({ account: event.target.value })}>
                            <option value="all">All accounts</option>
                            <option value="facebook">Facebook</option>
                            <option value="instagram">Instagram</option>
                        </DashboardSelect>
                    </label>
                </div>
                <div className="flex flex-wrap gap-2">
                    {[
                        ['overview', 'Overview'],
                        ['issues', 'Issues'],
                        ['posts', 'Posts'],
                        ['settings', 'Settings'],
                    ].map(([id, label]) => (
                        <Link key={id} to={href(root, { tab: id })} className={cn('rounded-md border px-3 py-2 text-sm font-light', tab === id ? theme.navItemActive : theme.navItem)}>
                            {label}
                        </Link>
                    ))}
                </div>
                {workspace.scene === 'no-accounts' && tab === 'overview' ? (
                    <div>
                        <p className="mb-3 text-sm font-light">SANDBOX · TEST DATA</p>
                        <DashboardEmptyState
                            isDark={isDark}
                            title="No sandbox Page connected"
                            description="Connect a sandbox test Page to see reach and catch complaints early."
                            action={<DashboardButton isDark={isDark} onClick={() => update({ tab: 'settings', connect: '1' })}>Connect sandbox Page</DashboardButton>}
                        />
                    </div>
                ) : panels[tab]}
            </DashboardPage>
        </div>
    );
};

export default SocialCommandCenter;
