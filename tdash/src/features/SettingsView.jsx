import React, { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import api from '../lib/api';
import { DashboardButton, DashboardEmptyState, DashboardSelect, DashboardSurface, DashboardTextInput, DashboardTitleBar } from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';

const SettingsView = ({ isDark, user }) => {
    const theme = getDashboardTheme(isDark);
    const allowed = ['OWNER', 'ADMIN'].includes(user?.role);
    const [organizationId, setOrganizationId] = useState(user?.organizationId || '');
    const [organizations, setOrganizations] = useState([]);
    const [events, setEvents] = useState([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(0);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [restoringId, setRestoringId] = useState(null);
    const [notice, setNotice] = useState('');
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        if (!allowed || user?.organizationId) return;
        let active = true;
        const fetchOrganizations = async () => {
            try {
                const list = [];
                let current = 1, last = 1;
                do {
                    const response = await api.get('/organizations', { params: { page: current, limit: 100 } });
                    const data = response.data.data || response.data;
                    list.push(...(data.organizations || []));
                    last = data.pagination?.pages || 1;
                    current += 1;
                } while (current <= last && active);
                if (active) setOrganizations(list);
            } catch (requestError) {
                if (active) setError(requestError.response?.data?.message || 'Unable to load organizations.');
            }
        };
        fetchOrganizations();
        return () => { active = false; };
    }, [allowed, user?.organizationId]);

    useEffect(() => {
        if (!allowed || !organizationId) return;
        let active = true;
        setLoading(true);
        setError('');
        api.get('/events/deleted', { params: { organizationId, page, limit: 20, search: query || undefined } })
            .then((response) => {
                if (!active) return;
                const data = response.data.data || response.data;
                setEvents(data.events || []);
                setPages(data.pagination?.pages || 0);
            }).catch((requestError) => {
                if (active) { setEvents([]); setError(requestError.response?.data?.message || 'Unable to load deleted events.'); }
            }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [allowed, organizationId, page, query, refresh]);

    const restore = useCallback(async (id) => {
        setRestoringId(id);
        setActionError('');
        setNotice('');
        try {
            await api.post(`/events/${id}/restore`);
            setNotice('Event restored as a draft.');
            setPage(1);
            setRefresh((value) => value + 1);
        } catch (requestError) {
            setActionError(requestError.response?.data?.message || 'Unable to restore this event.');
        } finally { setRestoringId(null); }
    }, []);

    return (
        <div className={`mx-auto max-w-7xl space-y-6 ${theme.textPrimary}`}>
            <DashboardTitleBar isDark={isDark} title="Settings" description="Restore deleted events for your organization." icon={Settings} />
            <p className={theme.textSecondary}><a href="/settings/integrations">Vendor integrations</a></p>
            <DashboardSurface isDark={isDark} className="space-y-5 p-5 sm:p-6">
                <h2 className="text-xl font-light">Recycle bin</h2>
                {!allowed ? <DashboardEmptyState isDark={isDark} title="Owner or administrator access required" description="Ask your organization owner to restore a deleted event." /> : <>
                    {!user?.organizationId && <label className="block space-y-2 text-sm">Organization
                        <DashboardSelect isDark={isDark} aria-label="Organization" value={organizationId} onChange={(e) => { setOrganizationId(e.target.value); setPage(1); setEvents([]); setActionError(''); setNotice(''); }}>
                            <option value="">Choose an organization</option>
                            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                        </DashboardSelect>
                    </label>}
                    <form className="flex flex-wrap items-center gap-3" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}>
                        <DashboardTextInput isDark={isDark} aria-label="Search deleted events" placeholder="Search event name" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" maxLength={200} />
                        <DashboardButton isDark={isDark} type="submit" disabled={!organizationId || loading}>Search</DashboardButton>
                        <DashboardButton isDark={isDark} variant="secondary" disabled={!organizationId || loading} onClick={() => setRefresh((value) => value + 1)}>Refresh</DashboardButton>
                    </form>
                    {(error || actionError) && <p role="alert">{actionError || error}</p>}
                    {notice && <p role="status">{notice}</p>}
                    {!organizationId ? <p className={theme.textSecondary}>Select an organization to load its deleted events.</p> : loading ? <p role="status">Loading deleted events…</p> : !error && events.length === 0 ? <DashboardEmptyState isDark={isDark} title="No deleted events found" description={query ? 'Try another event name.' : 'Deleted events appear here until they are restored.'} /> : !error && <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm"><thead><tr><th className="p-3">Event</th><th className="p-3">Deleted</th><th className="p-3">Action</th></tr></thead><tbody>
                            {events.map((event) => <tr key={event.id} className={`border-t ${theme.divider}`}>
                                <td className="p-3">{event.name}<p className={theme.textSecondary}>{event.venue?.name}</p></td>
                                <td className="p-3">{new Date(event.deletedAt).toLocaleString()}</td>
                                <td className="p-3"><DashboardButton isDark={isDark} variant="secondary" disabled={Boolean(restoringId)} onClick={() => restore(event.id)}>{restoringId === event.id ? 'Restoring…' : 'Restore'}</DashboardButton></td>
                            </tr>)}
                        </tbody></table>
                    </div>}
                    {pages > 1 && <div className="flex items-center gap-3"><DashboardButton isDark={isDark} variant="secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</DashboardButton><span>Page {page} of {pages}</span><DashboardButton isDark={isDark} variant="secondary" disabled={loading || page >= pages} onClick={() => setPage((value) => value + 1)}>Next</DashboardButton></div>}
                    <p className={`text-xs ${theme.textSecondary}`}>Restoring an event makes it a draft. Review its dates and tickets before publishing.</p>
                </>}
            </DashboardSurface>
        </div>
    );
};
export default SettingsView;
