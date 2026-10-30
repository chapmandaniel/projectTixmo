import React, { useCallback, useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import api from '../lib/api';
import {
    DashboardButton,
    DashboardEmptyState,
    DashboardSurface,
    DashboardTextInput,
    DashboardTitleBar,
} from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';

const unwrap = (response) => response?.data?.data ?? response?.data;

const IntegrationsView = ({ isDark, user }) => {
    const theme = getDashboardTheme(isDark);
    const allowed = ['OWNER', 'ADMIN'].includes(user?.role);
    const organizationId = user?.organizationId || '';
    const [connection, setConnection] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [vendorVenueId, setVendorVenueId] = useState('fixture');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [preview, setPreview] = useState([]);
    const [selected, setSelected] = useState({});
    const [tierNames, setTierNames] = useState({});
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [soldCounts, setSoldCounts] = useState([]);

    const load = useCallback(async () => {
        if (!allowed || !organizationId) return;
        const response = await api.get(`/organizations/${organizationId}/showpass`);
        setConnection(unwrap(response));
    }, [allowed, organizationId]);

    useEffect(() => {
        load().catch((requestError) => {
            setError(requestError.response?.data?.message || 'Unable to load the Showpass connection.');
        });
    }, [load]);

    const connect = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const response = await api.post(`/organizations/${organizationId}/showpass/connection`, {
                apiKey,
                vendorVenueId,
                ...(webhookSecret ? { webhookSecret } : {}),
            });
            setConnection(unwrap(response));
            setApiKey('');
            setNotice('Showpass key saved.');
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Showpass rejected the API key.');
        } finally {
            setBusy(false);
        }
    };

    const loadPreview = async () => {
        setBusy(true);
        setError('');
        try {
            const response = await api.get(`/organizations/${organizationId}/showpass/preview`, {
                params: { vendorVenueId },
            });
            const events = unwrap(response)?.events || [];
            setPreview(events);
            const nextSelected = {};
            const nextTiers = {};
            events.forEach((item) => {
                nextSelected[item.externalItemId] = item.status !== 'existing';
                item.ticketTypes.forEach((ticket) => {
                    nextTiers[ticket.externalTicketTypeId] = nextTiers[ticket.externalTicketTypeId] || ticket.name;
                });
            });
            setSelected(nextSelected);
            setTierNames((current) => ({ ...nextTiers, ...current }));
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to preview Showpass events.');
        } finally {
            setBusy(false);
        }
    };

    const saveMapping = async () => {
        const ticketTypeMappings = Object.entries(tierNames).map(([externalTicketTypeId, tierName]) => ({
            externalTicketTypeId,
            tierName,
        }));
        const response = await api.put(`/organizations/${organizationId}/showpass/config`, {
            vendorVenueId,
            ticketTypeMappings,
            ...(webhookSecret ? { webhookSecret } : {}),
        });
        return unwrap(response);
    };

    const importSelected = async () => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            await saveMapping();
            const externalItemIds = Object.entries(selected).filter(([, on]) => on).map(([id]) => id);
            const response = await api.post(`/organizations/${organizationId}/showpass/import`, {
                vendorVenueId,
                externalItemIds,
            });
            const body = unwrap(response);
            setNotice(`Imported ${body.count} event${body.count === 1 ? '' : 's'}.`);
            await loadPreview();
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Import failed.');
        } finally {
            setBusy(false);
        }
    };

    const syncNow = async () => {
        setBusy(true);
        setError('');
        try {
            const response = await api.post(`/organizations/${organizationId}/showpass/sync`);
            const body = unwrap(response);
            await load();
            if (body?.status === 'REVOKED' || body?.lastError) {
                setError(body.lastError || 'Showpass sync failed.');
            } else {
                setNotice('Sync finished.');
            }
            const counts = await api.get(`/organizations/${organizationId}/showpass/sold-counts`);
            setSoldCounts(unwrap(counts) || []);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Showpass sync failed.');
            await load().catch(() => {});
        } finally {
            setBusy(false);
        }
    };

    const failed = connection?.status === 'REVOKED' || connection?.status === 'ERROR';

    return (
        <div className={`mx-auto max-w-7xl space-y-6 ${theme.textPrimary}`}>
            <DashboardTitleBar
                isDark={isDark}
                title="Integrations"
                description="Connect Showpass and import its events into Tixmo. Showpass keeps selling the tickets."
                icon={Link2}
            />
            {!allowed || !organizationId ? (
                <DashboardEmptyState
                    isDark={isDark}
                    title="Owner or administrator access required"
                    description="Ask an organization owner to connect Showpass."
                />
            ) : (
                <>
                    {(error || failed) && (
                        <p role="alert">{error || connection.lastError || 'Showpass sync failed.'}</p>
                    )}
                    {notice && <p role="status">{notice}</p>}
                    <DashboardSurface isDark={isDark} className="space-y-4 p-5 sm:p-6">
                        <h2 className="text-xl font-light">Showpass connection</h2>
                        {connection ? (
                            <p>
                                Connected. Key ending {connection.keyLast4}. Status {connection.status}.
                                {connection.lastSyncAt ? ` Last sync ${new Date(connection.lastSyncAt).toLocaleString()}.` : ''}
                            </p>
                        ) : (
                            <p className={theme.textSecondary}>No Showpass key saved yet.</p>
                        )}
                        <form className="grid gap-3 sm:grid-cols-2" onSubmit={connect}>
                            <label className="block space-y-2 text-sm">API key
                                <DashboardTextInput isDark={isDark} type="password" autoComplete="off" aria-label="Showpass API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required minLength={8} />
                            </label>
                            <label className="block space-y-2 text-sm">Showpass venue id
                                <DashboardTextInput isDark={isDark} aria-label="Showpass venue id" value={vendorVenueId} onChange={(e) => setVendorVenueId(e.target.value)} required />
                            </label>
                            <label className="block space-y-2 text-sm sm:col-span-2">Webhook secret
                                <DashboardTextInput isDark={isDark} type="password" autoComplete="off" aria-label="Showpass webhook secret" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
                            </label>
                            <DashboardButton isDark={isDark} type="submit" disabled={busy}>Save Showpass key</DashboardButton>
                        </form>
                    </DashboardSurface>
                    {connection && (
                        <DashboardSurface isDark={isDark} className="space-y-4 p-5 sm:p-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-xl font-light">Preview</h2>
                                <DashboardButton isDark={isDark} variant="secondary" type="button" disabled={busy} onClick={loadPreview}>Load preview</DashboardButton>
                                <DashboardButton isDark={isDark} variant="secondary" type="button" disabled={busy} onClick={syncNow}>Sync now</DashboardButton>
                            </div>
                            {preview.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr>
                                                <th className="p-3">Import</th>
                                                <th className="p-3">Fixture</th>
                                                <th className="p-3">Event</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3">Timezone</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.map((item) => (
                                                <tr key={item.fixtureId} className={`border-t ${theme.divider}`}>
                                                    <td className="p-3">
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Import ${item.fixtureId}`}
                                                            checked={Boolean(selected[item.externalItemId])}
                                                            onChange={(e) => setSelected((current) => ({ ...current, [item.externalItemId]: e.target.checked }))}
                                                        />
                                                    </td>
                                                    <td className="p-3">{item.fixtureId}</td>
                                                    <td className="p-3">{item.name}</td>
                                                    <td className="p-3">{item.status}</td>
                                                    <td className="p-3">{item.timezone}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {preview.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-lg font-light">Ticket type mapping</h3>
                                    {preview.flatMap((item) => item.ticketTypes.map((ticket) => (
                                        <label key={`${item.fixtureId}-${ticket.externalTicketTypeId}`} className="block space-y-1 text-sm">
                                            {item.name}: {ticket.name}
                                            <DashboardTextInput
                                                isDark={isDark}
                                                aria-label={`Tier name for ${ticket.externalTicketTypeId}`}
                                                value={tierNames[ticket.externalTicketTypeId] || ''}
                                                onChange={(e) => setTierNames((current) => ({ ...current, [ticket.externalTicketTypeId]: e.target.value }))}
                                            />
                                        </label>
                                    )))}
                                    <DashboardButton isDark={isDark} type="button" disabled={busy} onClick={importSelected}>Import selected events</DashboardButton>
                                </div>
                            )}
                            {soldCounts.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-light">Sold totals</h3>
                                    <ul>
                                        {soldCounts.map((row) => (
                                            <li key={`${row.eventId}-${row.externalTicketTypeId}`}>
                                                {row.fixtureId} ticket {row.externalTicketTypeId}: {row.soldCount}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </DashboardSurface>
                    )}
                </>
            )}
        </div>
    );
};

export default IntegrationsView;
