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
import { cloneDefaultPhrases } from './mockWorkspace';
import { loadSocialConfig, pollPlanForWorkspace, workspaceForScene } from './socialClient';
import { successivePolls } from './pollSchedule';

const DISMISS_REASONS = ['Not an issue', 'Duplicate', 'Spam/irrelevant', 'Handled elsewhere'];
const TEAM = ['Avery Stone', 'Sam R.', 'Parker Reed'];
const HOLDS = [
    { value: '', label: 'Automatic' },
    { value: 'NORMAL', label: 'Hold NORMAL' },
    { value: 'ON_SALE_DAY', label: 'Hold ON-SALE DAY' },
    { value: 'EVENT_DAY', label: 'Hold EVENT DAY' },
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

const SocialCommandCenter = ({ isDark, user, preview = false }) => {
    const theme = getDashboardTheme(isDark);
    const location = useLocation();
    const [params, setParams] = useSearchParams();
    const filters = readSocialFilters(params);
    const [config, setConfig] = useState(preview ? previewConfig : null);
    const [issues, setIssues] = useState([]);
    const [notes, setNotes] = useState({});
    const [phrases, setPhrases] = useState(cloneDefaultPhrases);
    const [hold, setHold] = useState('');
    const [holdUntil, setHoldUntil] = useState('2027-07-11');
    const [highEmail, setHighEmail] = useState(true);
    const [digest, setDigest] = useState(false);
    const [selected, setSelected] = useState([]);
    const [dismissReason, setDismissReason] = useState(DISMISS_REASONS[0]);
    const [connectPage, setConnectPage] = useState('Harbourfest');
    const [connectIg, setConnectIg] = useState(true);

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

    const workspace = useMemo(() => workspaceForScene(filters.scene), [filters.scene]);
    useEffect(() => {
        setIssues(workspace.issues);
        setPhrases(cloneDefaultPhrases());
    }, [workspace]);

    const poll = config?.enabled ? pollPlanForWorkspace(config, workspace) : null;
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
    const admin = user?.role === 'OWNER' || user?.role === 'ADMIN';
    const visiblePosts = workspace.posts.filter((post) => filters.account === 'all' || post.account === filters.account);
    const commentById = Object.fromEntries(workspace.comments.map((comment) => [comment.id, comment]));
    const activeIssue = issues.find((issue) => issue.id === detail.id);
    const activePost = workspace.posts.find((post) => post.id === detail.id);
    const pollStamps = poll ? successivePolls(new Date(workspace.now), poll.intervalMs, 2).join(',') : '';

    const patchIssue = (id, changer) => {
        setIssues((current) => current.map((issue) => (issue.id === id ? changer(issue) : issue)));
    };
    const log = (issue, text) => ({
        ...issue,
        activity: [...issue.activity, { at: workspace.now, text }],
    });

    const assignIssue = (issue, name) => patchIssue(issue.id, (current) => log({
        ...current,
        assignee: name,
        state: name ? (current.state === 'NEW' ? 'IN_PROGRESS' : current.state) : current.state,
    }, name ? `Assigned to ${name}.` : 'Unassigned. State stays In progress.'));

    const applyBulk = (action) => {
        setIssues((current) => current.map((issue) => {
            if (!selected.includes(issue.id)) return issue;
            if (action === 'handled') return log({ ...issue, state: 'HANDLED' }, 'Marked handled.');
            if (action === 'dismiss') return log({ ...issue, state: 'DISMISSED' }, `Dismissed: ${dismissReason}.`);
            return log({ ...issue, assignee: 'Sam R.', state: issue.state === 'NEW' ? 'IN_PROGRESS' : issue.state }, 'Assigned to Sam R.');
        }));
        setSelected([]);
    };

    const overview = (
        <>
            {workspace.banners.map((banner) => (
                <div key={banner} className={cn('flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3', theme.panel)}>
                    <p>{banner}</p>
                    <DashboardButton isDark={isDark} variant="secondary" onClick={() => update({ tab: 'settings', connect: '1' })}>Reconnect</DashboardButton>
                </div>
            ))}
            {workspace.rateLimit ? <DashboardChip isDark={isDark}>{workspace.rateLimit}</DashboardChip> : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                    ['Reach', workspace.kpis.reach, workspace.kpis.detail],
                    ['Engagements', workspace.kpis.engagements, workspace.kpis.detail],
                    ['Followers', workspace.kpis.followers, workspace.scene === 'syncing' ? 'Syncing' : ''],
                    ['Open issues', workspace.scene === 'syncing' ? '—' : String(needsAction), workspace.scene === 'syncing' ? 'Syncing' : ''],
                    ['Unanswered', workspace.kpis.unanswered, workspace.scene === 'syncing' ? 'Syncing' : ''],
                ].map(([label, value, detail]) => (
                    <DashboardStat key={label} isDark={isDark} label={label} value={value} detail={detail || undefined} />
                ))}
            </div>
            {workspace.permissionNote ? (
                <DashboardEmptyState isDark={isDark} title="Insights unavailable" description={workspace.permissionNote} />
            ) : null}
            <DashboardSection isDark={isDark} title="Trend" description="Facebook and Instagram series. Markers come from event dates only.">
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
            </DashboardSection>
            <div className="grid gap-4 lg:grid-cols-2">
                <DashboardSection isDark={isDark} title="Active waves" description="Opened from keyword volume, not from sentiment.">
                    {issues.filter((issue) => issue.kind === 'WAVE' && (issue.state === 'NEW' || issue.state === 'IN_PROGRESS')).length === 0 ? (
                        <DashboardEmptyState isDark={isDark} compact title="No active waves" description="No topic is at the current mode threshold." />
                    ) : issues.filter((issue) => issue.kind === 'WAVE' && (issue.state === 'NEW' || issue.state === 'IN_PROGRESS')).map((issue) => (
                        <p key={issue.id} className="text-sm font-light leading-6">{issue.ruleText}</p>
                    ))}
                </DashboardSection>
                <DashboardSection isDark={isDark} title="Issues by topic">
                    {workspace.topics.length === 0 ? <p className={theme.textSecondary}>No issues in this range.</p> : workspace.topics.map((row) => (
                        <p key={row.topic} className="text-sm font-light">{row.topic}: {row.count}</p>
                    ))}
                </DashboardSection>
            </div>
        </>
    );

    const issueList = issues.filter((issue) => {
        if (filters.view === 'unanswered') return issue.unanswered && issue.state !== 'HANDLED' && issue.state !== 'DISMISSED';
        if (filters.view === 'waves') return issue.kind === 'WAVE';
        return issue.state === 'NEW' || issue.state === 'IN_PROGRESS';
    });

    const issuesPanel = detail.kind === 'issues' && activeIssue ? (
        <DashboardSection isDark={isDark} title={`${activeIssue.topic} issue`} description={activeIssue.ruleText} actions={<Link className={theme.textSecondary} to={href(root)}>Back</Link>}>
            <div className="mb-4 flex flex-wrap gap-2">
                <TextChip isDark={isDark}>{activeIssue.severity}</TextChip>
                <TextChip isDark={isDark}>{activeIssue.state}</TextChip>
                {activeIssue.unanswered ? <TextChip isDark={isDark}>{workspace.unansweredLabel}</TextChip> : null}
            </div>
            {activeIssue.commentIds.map((id) => {
                const comment = commentById[id];
                if (!comment) return null;
                return (
                    <div key={id} className="mb-4">
                        <p className="text-sm font-light"><span className={theme.textPrimary}>{comment.handle}</span> {comment.text}</p>
                        <p hidden data-testid="classifier-label-slot">{comment.label === '' ? 'empty' : comment.label}</p>
                        <a className={cn('mt-2 inline-flex text-sm underline', theme.textSecondary)} href={workspace.posts.find((post) => post.id === comment.postId)?.permalink} target="_blank" rel="noreferrer">
                            Reply on {comment.postId.includes('ig') ? 'Instagram' : 'Facebook'} ↗
                        </a>
                    </div>
                );
            })}
            <div className="mt-4 flex flex-wrap gap-2">
                <label className="text-sm font-light">
                    Assignee
                    <DashboardSelect isDark={isDark} className="ml-2" aria-label="Assignee" value={activeIssue.assignee} onChange={(event) => assignIssue(activeIssue, event.target.value)}>
                        <option value="">Unassigned</option>
                        {TEAM.map((name) => <option key={name} value={name}>{name}</option>)}
                    </DashboardSelect>
                </label>
                <DashboardButton isDark={isDark} variant="secondary" onClick={() => patchIssue(activeIssue.id, (issue) => log({ ...issue, state: 'HANDLED' }, 'Marked handled.'))}>Handled</DashboardButton>
                <DashboardButton isDark={isDark} variant="secondary" onClick={() => patchIssue(activeIssue.id, (issue) => log({ ...issue, state: 'IN_PROGRESS' }, 'Reopened.'))}>Reopen</DashboardButton>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2">
                <label className="text-sm font-light">
                    Dismiss reason
                    <DashboardSelect isDark={isDark} className="mt-1" aria-label="Dismiss reason" value={dismissReason} onChange={(event) => setDismissReason(event.target.value)}>
                        {DISMISS_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
                    </DashboardSelect>
                </label>
                <DashboardButton isDark={isDark} variant="danger" onClick={() => patchIssue(activeIssue.id, (issue) => log({ ...issue, state: 'DISMISSED' }, `Dismissed: ${dismissReason}.`))}>Dismiss</DashboardButton>
            </div>
            <div className="mt-6">
                <p className={cn('mb-2 text-sm font-light', theme.textSecondary)}>Team-only notes. These are not posted to Facebook or Instagram. Do not paste an email address or an order number.</p>
                <CommentThread
                    isDark={isDark}
                    comments={notes[activeIssue.id] || []}
                    currentUser={user}
                    placeholder="Team-only note. This is not posted."
                    onAddComment={async ({ content }) => {
                        setNotes((current) => ({
                            ...current,
                            [activeIssue.id]: [...(current[activeIssue.id] || []), { id: `${activeIssue.id}-${(current[activeIssue.id] || []).length + 1}`, content, author: user?.firstName || 'Team' }],
                        }));
                        patchIssue(activeIssue.id, (issue) => log(issue, 'Internal note added. Not posted.'));
                    }}
                />
            </div>
            <ul className="mt-4 space-y-1 text-sm font-light">
                {activeIssue.activity.map((entry) => <li key={`${entry.at}-${entry.text}`}>{entry.text}</li>)}
            </ul>
        </DashboardSection>
    ) : (
        <DashboardSection
            isDark={isDark}
            title="Issues"
            description={workspace.unansweredLabel}
            actions={(
                <div className="flex flex-wrap gap-2">
                    {['needs-action', 'unanswered', 'waves'].map((view) => (
                        <DashboardButton key={view} isDark={isDark} variant={filters.view === view ? 'primary' : 'secondary'} onClick={() => update({ view })}>
                            {view === 'needs-action' ? 'Needs action' : view === 'unanswered' ? workspace.unansweredLabel : 'Waves'}
                        </DashboardButton>
                    ))}
                </div>
            )}
        >
            {workspace.scene === 'no-issues' || issueList.length === 0 ? (
                <DashboardEmptyState isDark={isDark} title="No issues" description="Nothing in this view needs action." />
            ) : (
                <>
                    <div className="mb-3 flex flex-wrap gap-2">
                        <DashboardButton isDark={isDark} variant="secondary" onClick={() => applyBulk('assign')}>Bulk assign</DashboardButton>
                        <DashboardButton isDark={isDark} variant="secondary" onClick={() => applyBulk('handled')}>Bulk handled</DashboardButton>
                        <DashboardButton isDark={isDark} variant="danger" onClick={() => applyBulk('dismiss')}>Bulk dismiss</DashboardButton>
                    </div>
                    <div className="overflow-x-auto">
                        {issueList.map((issue) => (
                            <div key={issue.id} className={cn('flex flex-wrap items-center gap-3 border-t py-3', theme.divider)}>
                                <input aria-label={`Select ${issue.topic}`} type="checkbox" checked={selected.includes(issue.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, issue.id] : current.filter((id) => id !== issue.id))} />
                                <TextChip isDark={isDark}>{issue.severity}</TextChip>
                                <TextChip isDark={isDark}>{issue.state}</TextChip>
                                <Link className="text-sm font-light underline" to={href(`${root}/issues/${issue.id}`)}>{issue.topic}</Link>
                                <span className={cn('text-sm font-light', theme.textSecondary)}>{issue.ruleText}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </DashboardSection>
    );

    const postsPanel = detail.kind === 'posts' && activePost ? (
        <DashboardSection isDark={isDark} title={`${activePost.platform} post`} description="Metrics are dashboard labels from the sandbox mock. Graph field names are not claimed." actions={<Link className={theme.textSecondary} to={href(root, { tab: 'posts' })}>Back</Link>}>
            <div className="grid gap-3 sm:grid-cols-3">
                {['Reach', 'Engagements', 'Views', 'Saves', 'Shares'].map((label) => (
                    <DashboardStat key={label} isDark={isDark} label={label} value={activePost.insights === 'pending' ? 'Pending' : activePost[label.toLowerCase()] || '—'} detail={activePost.insights === 'pending' ? 'Insights pending' : activePost.engagementRate} />
                ))}
            </div>
            <div className="mt-4 flex gap-2">
                <DashboardButton isDark={isDark} variant={filters.view === 'needs-action' ? 'primary' : 'secondary'} onClick={() => update({ view: 'needs-action' })}>Flagged</DashboardButton>
                <DashboardButton isDark={isDark} variant={filters.view === 'unanswered' ? 'primary' : 'secondary'} onClick={() => update({ view: 'unanswered' })}>{workspace.unansweredLabel}</DashboardButton>
            </div>
            <div className="mt-4 space-y-4">
                {workspace.comments.filter((comment) => comment.postId === activePost.id && (filters.view !== 'unanswered' || comment.unanswered)).map((comment) => (
                    <div key={comment.id}>
                        <p className="text-sm font-light"><span>{comment.handle}</span> {comment.text}</p>
                        <p hidden data-testid="classifier-label-slot">{comment.label === '' ? 'empty' : comment.label}</p>
                        <a className={cn('text-sm underline', theme.textSecondary)} href={activePost.permalink} target="_blank" rel="noreferrer">
                            Reply on {activePost.platform === 'Instagram' ? 'Instagram' : 'Facebook'} ↗
                        </a>
                    </div>
                ))}
            </div>
        </DashboardSection>
    ) : (
        <DashboardSection isDark={isDark} title="Posts" description="Reach, engagement rate, comments, and open issues.">
            {workspace.scene === 'no-data' || visiblePosts.length === 0 ? (
                <DashboardEmptyState isDark={isDark} title="No data in this range" description="No posts match the event, date range, and account filters." />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm font-light">
                        <thead>
                            <tr className={theme.textTertiary}>
                                {['Post', 'Reach', 'Engagement rate', 'Comments', 'Open issues'].map((heading) => <th key={heading} className="py-2 pr-4 font-light">{heading}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {visiblePosts.map((post) => (
                                <tr key={post.id} className={cn('border-t', theme.divider)}>
                                    <td className="py-2 pr-4"><Link className="underline" to={href(`${root}/posts/${post.id}`, { tab: 'posts' })}>{post.platform} {post.postedAt}</Link></td>
                                    <td className="py-2 pr-4">{post.reach}</td>
                                    <td className="py-2 pr-4">{post.engagementRate}</td>
                                    <td className="py-2 pr-4">{post.comments}</td>
                                    <td className="py-2">{post.openIssues}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </DashboardSection>
    );

    const connectStep = filters.connect;
    const connectPanel = (
        <DashboardSection isDark={isDark} title={`Sandbox connect, step ${connectStep || '1'} of 4`} description="Sandbox-branded. Tixmo does not post or reply from this dashboard.">
            {connectStep === '2' ? (
                <label className="text-sm font-light">Sandbox Page
                    <DashboardSelect isDark={isDark} className="mt-1" aria-label="Sandbox Page" value={connectPage} onChange={(event) => setConnectPage(event.target.value)}>
                        <option>Harbourfest</option>
                    </DashboardSelect>
                </label>
            ) : null}
            {connectStep === '3' ? (
                <label className="flex items-center gap-2 text-sm font-light">
                    <input type="checkbox" checked={connectIg} onChange={(event) => setConnectIg(event.target.checked)} />
                    Linked Instagram professional account harbourfest
                </label>
            ) : null}
            {connectStep === '4' ? (
                <div className="space-y-2 text-sm font-light">
                    <p>Facebook Harbourfest: CONNECTED. Last sync 2027-07-10T18:29:00.000Z.</p>
                    <p>Instagram harbourfest: CONNECTED. Last sync 2027-07-10T18:29:00.000Z.</p>
                    <p>Mapped to Harbourfest 2027.</p>
                </div>
            ) : null}
            {connectStep !== '2' && connectStep !== '3' && connectStep !== '4' ? (
                <p className="text-sm font-light">Start a sandbox connection for a Facebook Page and its linked Instagram professional account.</p>
            ) : null}
            <div className="mt-4">
                <DashboardButton isDark={isDark} onClick={() => update({ connect: String(Math.min(4, Number(connectStep || 1) + 1)), tab: 'settings' })}>
                    {connectStep === '4' ? 'Done' : 'Continue'}
                </DashboardButton>
            </div>
        </DashboardSection>
    );

    const settingsPanel = (
        <div className="space-y-4">
            {workspace.scene === 'no-accounts' ? (
                <DashboardEmptyState
                    isDark={isDark}
                    title="No accounts connected"
                    description="Connect a sandbox Facebook Page to start. Tixmo does not post or reply from this dashboard."
                    action={admin ? <DashboardButton isDark={isDark} onClick={() => update({ connect: '1' })}>Connect sandbox account</DashboardButton> : <p>An org admin connects accounts.</p>}
                />
            ) : null}
            {connectStep ? connectPanel : null}
            <DashboardSection isDark={isDark} title="Connected accounts" description="Sandbox tokens only. This screen never shows a token.">
                {workspace.accounts.length === 0 ? <p className={theme.textSecondary}>No sandbox accounts yet.</p> : workspace.accounts.map((account) => (
                    <p key={account.id} className="text-sm font-light">{account.platform} {account.name}: {account.status}. Last sync {account.lastSync}.</p>
                ))}
                {admin ? <DashboardButton isDark={isDark} className="mt-3" variant="secondary" onClick={() => update({ connect: '1' })}>Connect sandbox account</DashboardButton> : <p className="mt-3 text-sm font-light">An org admin connects accounts.</p>}
            </DashboardSection>
            <DashboardSection isDark={isDark} title="Alert rules and threshold mode" description="Named modes only. With All events, Overview uses the tightest mode.">
                <p className="text-sm font-light">Mode: {workspace.modeLabel}{filters.event === 'all' ? ` · ${workspace.modeEventName}` : ''}</p>
                {workspace.scheduleNote ? <p className="mt-2 text-sm font-light">{workspace.scheduleNote}</p> : null}
                {workspace.onSaleNote || workspace.events.some((event) => !event.onSale) ? <p className="mt-2 text-sm font-light">{workspace.onSaleNote || 'Quiet Hall has no on-sale date. ON-SALE DAY does not trigger.'}</p> : null}
                <div className="mt-3 overflow-x-auto">
                    {workspace.events.map((event) => <p key={event.id} className="text-sm font-light">{event.name}: {event.modeLabel}{event.scheduled ? '' : '. No schedule dates.'}</p>)}
                </div>
                {admin ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                        <label className="text-sm font-light">Hold
                            <DashboardSelect isDark={isDark} className="mt-1" aria-label="Threshold hold" value={hold} onChange={(event) => setHold(event.target.value)}>
                                {HOLDS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                            </DashboardSelect>
                        </label>
                        <label className="text-sm font-light">Until
                            <DashboardTextInput isDark={isDark} className="mt-1" type="date" aria-label="Hold until" value={holdUntil} onChange={(event) => setHoldUntil(event.target.value)} />
                        </label>
                    </div>
                ) : null}
                <div className="mt-4 space-y-2">
                    {Object.entries(phrases).map(([topic, list]) => (
                        <p key={topic} className="text-sm font-light">{topic}: {list.join(', ')}</p>
                    ))}
                    {admin ? <DashboardButton isDark={isDark} variant="secondary" onClick={() => setPhrases(cloneDefaultPhrases())}>Reset to defaults</DashboardButton> : null}
                </div>
            </DashboardSection>
            <DashboardSection isDark={isDark} title="Notifications" description="In-app badge and the Overview strip stay on. HIGH email is on by default.">
                <label className="flex items-center gap-2 text-sm font-light">
                    <input type="checkbox" checked={highEmail} onChange={(event) => setHighEmail(event.target.checked)} disabled={!admin} />
                    HIGH email to the assignee and owners, or to org admins if unassigned
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm font-light">
                    <input type="checkbox" checked={digest} onChange={(event) => setDigest(event.target.checked)} />
                    Daily digest
                </label>
            </DashboardSection>
            <DashboardSection isDark={isDark} title="Polling" description="Phase 1 does not poll. The cadence is configuration only.">
                <p data-testid="poll-plan" data-running="false" data-interval={poll?.intervalMs || ''} data-polls={pollStamps} className="text-sm font-light">
                    Not running. Every {poll ? Math.round(poll.intervalMs / 60000) : 5} min. Lookback {poll ? Math.round(poll.lookbackMs / 3600000) : 0} h. Next planned {poll?.nextPollAt}.
                </p>
            </DashboardSection>
        </div>
    );

    const panels = { overview, issues: issuesPanel, posts: postsPanel, settings: settingsPanel };
    const selectedEvent = filters.event === 'all' ? 'all' : filters.event;

    return (
        <div data-testid="social-command-center" data-query={search} data-scene={filters.scene} data-running="false">
            <DashboardPage>
                <DashboardTitleBar
                    isDark={isDark}
                    title="Social"
                    description="Sandbox command center. Tixmo does not post or reply from this dashboard."
                    icon={MessageCircle}
                    badges={(
                        <>
                            <DashboardChip isDark={isDark}>Sandbox</DashboardChip>
                            <TextChip isDark={isDark}>{workspace.modeLabel}</TextChip>
                            {needsAction > 0 ? <DashboardChip isDark={isDark}>{needsAction} need action</DashboardChip> : null}
                        </>
                    )}
                />
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
                        <DashboardSelect isDark={isDark} className="mt-1" aria-label="Event" value={selectedEvent} onChange={(event) => update({ event: event.target.value })}>
                            <option value="all">All events</option>
                            {workspace.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                        </DashboardSelect>
                    </label>
                    <label className="text-sm font-light">Date range
                        <DashboardSelect isDark={isDark} className="mt-1" aria-label="Date range" value={filters.range} onChange={(event) => update({ range: event.target.value })}>
                            <option value="today">Today</option>
                            <option value="7d">7 days</option>
                            <option value="28d">28 days</option>
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
                    <DashboardEmptyState isDark={isDark} title="No accounts connected" description="Connect a sandbox account to see the command center." action={<Link to={href(root, { tab: 'settings' })}>Go to Settings</Link>} />
                ) : panels[tab]}
            </DashboardPage>
        </div>
    );
};

export default SocialCommandCenter;
