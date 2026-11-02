import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { defangUrl } from '../lib/defangUrl';
import { isGiveawayProtectionEnabled } from '../lib/runtimeConfig';
import { getDashboardTheme } from '../lib/dashboardTheme';
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardPage,
    DashboardPageHeader,
    DashboardSection,
    DashboardSelect,
    DashboardStat,
    DashboardTextInput,
} from '../components/dashboard/DashboardPrimitives';

const SOCIAL_PLATFORMS = ['X', 'REDDIT', 'FACEBOOK', 'INSTAGRAM'];
const MATCH_PLATFORMS = [...SOCIAL_PLATFORMS, 'LOOKALIKE_DOMAIN'];
const CATEGORIES = ['IMPERSONATION_PROFILE', 'FAKE_CONTEST', 'FALSE_ASSOCIATION', 'LOOKALIKE_DOMAIN'];
const STATUSES = ['NEW', 'CONFIRMED_SCAM', 'FALSE_POSITIVE', 'OFFICIAL'];

const PLATFORM_LABELS = {
    X: 'X',
    REDDIT: 'Reddit',
    FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram',
    LOOKALIKE_DOMAIN: 'Lookalike domain',
};

const CATEGORY_LABELS = {
    IMPERSONATION_PROFILE: 'Impersonation profile',
    FAKE_CONTEST: 'Fake contest',
    FALSE_ASSOCIATION: 'False association',
    LOOKALIKE_DOMAIN: 'Lookalike domain',
};

const STATE_LABELS = {
    OK: 'OK',
    BLOCKED: 'Blocked',
    LOGIN_PROMPT: 'Login prompt',
    CAPTCHA: 'Captcha',
};

const emptyAccount = { platform: 'X', platformAccountId: '', handle: '', profileUrl: '', displayName: '' };
const emptyGiveaway = {
    title: '',
    platform: 'X',
    officialPostUrl: '',
    accountHandle: '',
    startsAt: '',
    endsAt: '',
    notes: '',
};

const dataOf = (response) => response?.data?.data ?? {};

const Plain = ({ value }) => <span>{value || ''}</span>;

const DefangedUrl = ({ value, isDark }) => {
    const shown = defangUrl(value);
    const copy = () => {
        if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(shown);
    };
    return (
        <span className="inline-flex flex-wrap items-center gap-2">
            <span>{shown}</span>
            <DashboardButton isDark={isDark} variant="secondary" onClick={copy} aria-label="Copy defanged URL">
                Copy
            </DashboardButton>
        </span>
    );
};

const BrandProtectionView = ({ isDark = true, user }) => {
    const enabled = isGiveawayProtectionEnabled();
    const allowed = ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role);
    const theme = getDashboardTheme(isDark);
    const [tab, setTab] = useState('official');
    const [events, setEvents] = useState([]);
    const [eventId, setEventId] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [giveaways, setGiveaways] = useState([]);
    const [matches, setMatches] = useState([]);
    const [newCount, setNewCount] = useState(0);
    const [statuses, setStatuses] = useState([]);
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [platformFilter, setPlatformFilter] = useState('');
    const [accountForm, setAccountForm] = useState(emptyAccount);
    const [editingAccountId, setEditingAccountId] = useState('');
    const [giveawayForm, setGiveawayForm] = useState(emptyGiveaway);
    const [editingGiveawayId, setEditingGiveawayId] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const load = async () => {
        if (!enabled || !allowed) return;
        setError('');
        const params = new URLSearchParams();
        if (eventId) params.set('eventId', eventId);
        if (statusFilter) params.set('status', statusFilter);
        if (categoryFilter) params.set('category', categoryFilter);
        if (platformFilter) params.set('platform', platformFilter);
        const matchQuery = params.toString();
        try {
            const [accountRes, giveawayRes, matchRes, statusRes, eventRes] = await Promise.all([
                api.get('/brand-protection/accounts'),
                api.get(`/brand-protection/giveaways${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`),
                api.get(`/brand-protection/matches${matchQuery ? `?${matchQuery}` : ''}`),
                api.get('/brand-protection/checker-status'),
                api.get('/events?limit=100'),
            ]);
            setAccounts(dataOf(accountRes).accounts || []);
            setGiveaways(dataOf(giveawayRes).giveaways || []);
            const matchBody = dataOf(matchRes);
            setMatches(matchBody.matches || []);
            setNewCount(matchBody.newCount || 0);
            setStatuses(dataOf(statusRes).statuses || []);
            const eventBody = eventRes?.data?.data || eventRes?.data || {};
            const eventList = eventBody.events || eventRes?.data?.events || [];
            setEvents(Array.isArray(eventList) ? eventList : []);
        } catch {
            setError('Unable to load brand protection');
        }
    };

    useEffect(() => {
        void load();
    }, [enabled, allowed, eventId, statusFilter, categoryFilter, platformFilter]);

    if (!enabled) return null;

    const saveAccount = async (event) => {
        event.preventDefault();
        setNotice('');
        const payload = {
            platform: accountForm.platform,
            platformAccountId: accountForm.platformAccountId,
            handle: accountForm.handle,
            profileUrl: accountForm.profileUrl,
            ...(accountForm.displayName ? { displayName: accountForm.displayName } : {}),
        };
        try {
            if (editingAccountId) {
                await api.put(`/brand-protection/accounts/${editingAccountId}`, {
                    handle: accountForm.handle,
                    profileUrl: accountForm.profileUrl,
                    displayName: accountForm.displayName || null,
                });
            } else {
                await api.post('/brand-protection/accounts', payload);
            }
            setAccountForm(emptyAccount);
            setEditingAccountId('');
            setNotice('Official account saved');
            await load();
        } catch {
            setError('Unable to save the official account');
        }
    };

    const saveGiveaway = async (event) => {
        event.preventDefault();
        setNotice('');
        const payload = {
            title: giveawayForm.title,
            platform: giveawayForm.platform,
            officialPostUrl: giveawayForm.officialPostUrl,
            accountHandle: giveawayForm.accountHandle,
            startsAt: new Date(giveawayForm.startsAt).toISOString(),
            endsAt: new Date(giveawayForm.endsAt).toISOString(),
            ...(giveawayForm.notes ? { notes: giveawayForm.notes } : {}),
            ...(eventId ? { eventId } : {}),
        };
        try {
            if (editingGiveawayId) await api.put(`/brand-protection/giveaways/${editingGiveawayId}`, payload);
            else await api.post('/brand-protection/giveaways', payload);
            setGiveawayForm(emptyGiveaway);
            setEditingGiveawayId('');
            setNotice('Official giveaway saved');
            await load();
        } catch {
            setError('Unable to save the official giveaway');
        }
    };

    const review = async (id, status) => {
        setError('');
        try {
            await api.post(`/brand-protection/matches/${id}/review`, { status });
            await load();
        } catch {
            setError('Unable to review that match');
        }
    };

    return (
        <DashboardPage>
            <DashboardPageHeader
                isDark={isDark}
                eyebrow="Brand protection"
                title="Brand protection"
                description="Register the accounts and giveaways that are really yours, and review profiles or contests that may be impersonating them."
            />
            {!allowed ? (
                <p className={theme.textSecondary}>Only an owner, admin, or manager can use brand protection.</p>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
            {notice ? <p role="status">{notice}</p> : null}
            {allowed ? (
                <>
                    <DashboardSection isDark={isDark} title="Checker" description="Last report from the signed-out checker for each source.">
                        <div className="mb-4 max-w-sm">
                            <DashboardSelect
                                isDark={isDark}
                                aria-label="Event"
                                value={eventId}
                                onChange={(event) => setEventId(event.target.value)}
                            >
                                <option value="">All events</option>
                                {events.map((event) => (
                                    <option key={event.id} value={event.id}>{event.name}</option>
                                ))}
                            </DashboardSelect>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {MATCH_PLATFORMS.map((platform) => {
                                const row = statuses.find((status) => status.platform === platform);
                                const label = row ? STATE_LABELS[row.state] || row.state : 'No report';
                                return (
                                    <DashboardChip key={platform} isDark={isDark}>
                                        {PLATFORM_LABELS[platform]}: {label}
                                    </DashboardChip>
                                );
                            })}
                        </div>
                    </DashboardSection>
                    <div className="flex flex-wrap gap-2" role="tablist">
                        <DashboardButton
                            isDark={isDark}
                            variant={tab === 'official' ? 'primary' : 'secondary'}
                            role="tab"
                            aria-selected={tab === 'official'}
                            onClick={() => setTab('official')}
                        >
                            Official accounts and giveaways
                        </DashboardButton>
                        <DashboardButton
                            isDark={isDark}
                            variant={tab === 'suspicious' ? 'primary' : 'secondary'}
                            role="tab"
                            aria-selected={tab === 'suspicious'}
                            onClick={() => setTab('suspicious')}
                        >
                            Suspicious profiles and contests
                        </DashboardButton>
                    </div>
                    {tab === 'official' ? (
                        <div className="space-y-6">
                            <DashboardSection isDark={isDark} title="Official accounts" description="A pending account is not official until the checker confirms the code on that platform account id.">
                                <form className="mb-5 grid gap-3 md:grid-cols-2" onSubmit={saveAccount}>
                                    <DashboardSelect isDark={isDark} aria-label="Account platform" value={accountForm.platform} onChange={(event) => setAccountForm({ ...accountForm, platform: event.target.value })}>
                                        {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{PLATFORM_LABELS[platform]}</option>)}
                                    </DashboardSelect>
                                    <DashboardTextInput isDark={isDark} aria-label="Platform account ID" placeholder="Platform account ID" value={accountForm.platformAccountId} onChange={(event) => setAccountForm({ ...accountForm, platformAccountId: event.target.value })} required disabled={Boolean(editingAccountId)} />
                                    <DashboardTextInput isDark={isDark} aria-label="Handle" placeholder="Handle" value={accountForm.handle} onChange={(event) => setAccountForm({ ...accountForm, handle: event.target.value })} required />
                                    <DashboardTextInput isDark={isDark} aria-label="Profile URL" placeholder="Profile URL" value={accountForm.profileUrl} onChange={(event) => setAccountForm({ ...accountForm, profileUrl: event.target.value })} required />
                                    <DashboardTextInput isDark={isDark} aria-label="Display name" placeholder="Display name" value={accountForm.displayName} onChange={(event) => setAccountForm({ ...accountForm, displayName: event.target.value })} />
                                    <DashboardButton isDark={isDark} type="submit">{editingAccountId ? 'Update account' : 'Add account'}</DashboardButton>
                                </form>
                                {!accounts.length ? <DashboardEmptyState isDark={isDark} compact title="No official accounts" description="Add the permanent platform account id for each real profile." /> : null}
                                <ul className="space-y-3">
                                    {accounts.map((account) => (
                                        <li key={account.id} className={`rounded-md border p-3 ${theme.panel}`}>
                                            <p><Plain value={PLATFORM_LABELS[account.platform]} /> · <Plain value={account.handle} /></p>
                                            <p className={theme.textSecondary}>Account id <Plain value={account.platformAccountId} /></p>
                                            <p className={theme.textSecondary}><Plain value={account.displayName} /></p>
                                            <p><DefangedUrl value={account.profileUrl} isDark={isDark} /></p>
                                            <p className={theme.textSecondary}>{account.status}{account.verificationCode ? ` · code ${account.verificationCode}` : ''}</p>
                                            <div className="mt-2 flex gap-2">
                                                <DashboardButton isDark={isDark} variant="secondary" onClick={() => { setEditingAccountId(account.id); setAccountForm({ platform: account.platform, platformAccountId: account.platformAccountId, handle: account.handle, profileUrl: account.profileUrl, displayName: account.displayName || '' }); }}>Edit</DashboardButton>
                                                <DashboardButton isDark={isDark} variant="danger" onClick={() => { void api.delete(`/brand-protection/accounts/${account.id}`).then(load).catch(() => setError('Unable to delete the account')); }}>Delete</DashboardButton>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </DashboardSection>
                            <DashboardSection isDark={isDark} title="Official giveaways" description="A post URL registered here is treated as yours. Handles are display only.">
                                <form className="mb-5 grid gap-3 md:grid-cols-2" onSubmit={saveGiveaway}>
                                    <DashboardTextInput isDark={isDark} aria-label="Giveaway title" placeholder="Title" value={giveawayForm.title} onChange={(event) => setGiveawayForm({ ...giveawayForm, title: event.target.value })} required />
                                    <DashboardSelect isDark={isDark} aria-label="Giveaway platform" value={giveawayForm.platform} onChange={(event) => setGiveawayForm({ ...giveawayForm, platform: event.target.value })}>
                                        {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{PLATFORM_LABELS[platform]}</option>)}
                                    </DashboardSelect>
                                    <DashboardTextInput isDark={isDark} aria-label="Official post URL" placeholder="Official post URL" value={giveawayForm.officialPostUrl} onChange={(event) => setGiveawayForm({ ...giveawayForm, officialPostUrl: event.target.value })} required />
                                    <DashboardTextInput isDark={isDark} aria-label="Giveaway handle" placeholder="Account handle" value={giveawayForm.accountHandle} onChange={(event) => setGiveawayForm({ ...giveawayForm, accountHandle: event.target.value })} required />
                                    <DashboardTextInput isDark={isDark} aria-label="Starts" type="datetime-local" value={giveawayForm.startsAt} onChange={(event) => setGiveawayForm({ ...giveawayForm, startsAt: event.target.value })} required />
                                    <DashboardTextInput isDark={isDark} aria-label="Ends" type="datetime-local" value={giveawayForm.endsAt} onChange={(event) => setGiveawayForm({ ...giveawayForm, endsAt: event.target.value })} required />
                                    <DashboardTextInput isDark={isDark} aria-label="Notes" placeholder="Notes" value={giveawayForm.notes} onChange={(event) => setGiveawayForm({ ...giveawayForm, notes: event.target.value })} />
                                    <DashboardButton isDark={isDark} type="submit">{editingGiveawayId ? 'Update giveaway' : 'Add giveaway'}</DashboardButton>
                                </form>
                                {!giveaways.length ? <DashboardEmptyState isDark={isDark} compact title="No official giveaways" description="Add a contest only when you are the one running it." /> : null}
                                <ul className="space-y-3">
                                    {giveaways.map((giveaway) => (
                                        <li key={giveaway.id} className={`rounded-md border p-3 ${theme.panel}`}>
                                            <p><Plain value={giveaway.title} /></p>
                                            <p className={theme.textSecondary}><Plain value={giveaway.accountHandle} /></p>
                                            <DefangedUrl value={giveaway.officialPostUrl} isDark={isDark} />
                                            <div className="mt-2 flex gap-2">
                                                <DashboardButton isDark={isDark} variant="secondary" onClick={() => { setEditingGiveawayId(giveaway.id); setGiveawayForm({ title: giveaway.title, platform: giveaway.platform, officialPostUrl: giveaway.officialPostUrl, accountHandle: giveaway.accountHandle, startsAt: giveaway.startsAt?.slice(0, 16) || '', endsAt: giveaway.endsAt?.slice(0, 16) || '', notes: giveaway.notes || '' }); }}>Edit</DashboardButton>
                                                <DashboardButton isDark={isDark} variant="danger" onClick={() => { void api.delete(`/brand-protection/giveaways/${giveaway.id}`).then(load).catch(() => setError('Unable to delete the giveaway')); }}>Delete</DashboardButton>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </DashboardSection>
                        </div>
                    ) : (
                        <DashboardSection isDark={isDark} title="Suspicious profiles and contests" description="Post text is shown as text. Source addresses are defanged and are not links.">
                            <div className="mb-4 grid gap-3 md:grid-cols-4">
                                <DashboardStat isDark={isDark} label="New" value={String(newCount)} detail="Unreviewed for the current filters" />
                                <DashboardSelect isDark={isDark} aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                                    <option value="">Any status</option>
                                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                                </DashboardSelect>
                                <DashboardSelect isDark={isDark} aria-label="Category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                                    <option value="">Any category</option>
                                    {CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
                                </DashboardSelect>
                                <DashboardSelect isDark={isDark} aria-label="Platform" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}>
                                    <option value="">Any source</option>
                                    {MATCH_PLATFORMS.map((platform) => <option key={platform} value={platform}>{PLATFORM_LABELS[platform]}</option>)}
                                </DashboardSelect>
                            </div>
                            {!matches.length ? <DashboardEmptyState isDark={isDark} compact title="No suspicious profiles or contests" description="New checker matches for this organization will show up here." /> : null}
                            <ul className="space-y-3">
                                {matches.map((match) => (
                                    <li key={match.id} className={`rounded-md border p-3 ${theme.panel}`}>
                                        <p>{CATEGORY_LABELS[match.category] || match.category} · {PLATFORM_LABELS[match.platform] || match.platform} · {match.status}</p>
                                        <p><Plain value={match.suspectDisplayName} /> <Plain value={match.accountHandle ? `@${match.accountHandle}` : ''} /></p>
                                        <p>Suspect account id <Plain value={match.platformAccountId} /></p>
                                        <p><Plain value={match.matchedText} /></p>
                                        <p className={theme.textSecondary}>Rule <Plain value={match.matchedRule} /></p>
                                        <DefangedUrl value={match.sourceUrl} isDark={isDark} />
                                        {(match.evidencePhones || []).map((phone) => <p key={phone}><Plain value={phone} /></p>)}
                                        {(match.evidenceEmails || []).map((email) => <p key={email}><Plain value={email} /></p>)}
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <DashboardButton isDark={isDark} variant="danger" onClick={() => { void review(match.id, 'CONFIRMED_SCAM'); }}>Mark scam</DashboardButton>
                                            <DashboardButton isDark={isDark} variant="secondary" onClick={() => { void review(match.id, 'FALSE_POSITIVE'); }}>False positive</DashboardButton>
                                            <DashboardButton isDark={isDark} variant="secondary" onClick={() => { void review(match.id, 'OFFICIAL'); }}>Official</DashboardButton>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </DashboardSection>
                    )}
                </>
            ) : null}
        </DashboardPage>
    );
};

export default BrandProtectionView;
