import React, { useState, useEffect } from 'react';
import { Plus, Smartphone, History, PowerOff } from 'lucide-react';
import api from '../lib/api';
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardPage,
    DashboardPageHeader,
    DashboardSurface,
} from '../components/dashboard/DashboardPrimitives';
import RegisterScannerModal from './RegisterScannerModal';
import { cn } from '../lib/utils';

const extractScannerPayload = (body) => {
    const payload = body?.data || body || {};

    if (Array.isArray(payload)) {
        return { items: payload, pages: body?.pagination?.pages || 1 };
    }

    return {
        items: payload.scanners || payload.data?.scanners || [],
        pages: payload.pagination?.pages || body?.pagination?.pages || 1,
    };
};

const extractLogPayload = (body) => {
    const payload = body?.data || body || {};

    if (Array.isArray(payload)) {
        return { items: payload, pages: body?.pagination?.pages || 1 };
    }

    return {
        items: payload.scanLogs || payload.logs || payload.data?.scanLogs || [],
        pages: payload.pagination?.pages || body?.pagination?.pages || 1,
    };
};

const formatDateTime = (value) => {
    if (!value) return 'Never';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Never';

    return date.toLocaleString();
};

const ScannerStatusChip = ({ scanner, isDark }) => (
    <DashboardChip
        isDark={isDark}
        className={scanner.status === 'ACTIVE'
            ? (isDark ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-100 bg-emerald-50 text-emerald-700')
            : (isDark ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-rose-100 bg-rose-50 text-rose-700')}
    >
        {scanner.status}
    </DashboardChip>
);

const ScanResultChip = ({ log, isDark }) => (
    <DashboardChip
        isDark={isDark}
        className={log.success
            ? (isDark ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-100 bg-emerald-50 text-emerald-700')
            : (isDark ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-rose-100 bg-rose-50 text-rose-700')}
    >
        {log.success ? 'SUCCESS' : 'DENIED'}
    </DashboardChip>
);

const ScannersView = ({
    isDark,
    user,
    title = 'Scanner Management',
    description = 'Manage scanning devices and view entry logs.',
    embedded = false,
}) => {
    const [activeTab, setActiveTab] = useState('scanners'); // 'scanners' | 'logs'
    const [scanners, setScanners] = useState([]);
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (activeTab === 'scanners') {
            fetchScanners();
        } else {
            fetchLogs();
        }
    }, [activeTab, page]);

    const fetchScanners = async () => {
        try {
            setIsLoading(true);
            const params = { page, limit: 10 };
            // If user has organizationId, we could pass it, but admin might see all?
            // Usually API filters by user's permission scope automatically.
            const response = await api.get('/scanners', { params });
            if (response.data.success) {
                const payload = extractScannerPayload(response.data);
                setScanners(payload.items);
                setTotalPages(payload.pages);
            }
        } catch (error) {
            console.error('Failed to fetch scanners:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            setIsLoading(true);
            const params = { page, limit: 20 };
            const response = await api.get('/scanners/logs', { params });
            if (response.data.success) {
                const payload = extractLogPayload(response.data);
                setLogs(payload.items);
                setTotalPages(payload.pages);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevoke = async (id) => {
        if (!window.confirm('Are you sure you want to revoke this scanner? It will no longer be able to scan tickets.')) return;
        try {
            await api.delete(`/scanners/${id}`);
            fetchScanners();
        } catch (error) {
            alert('Failed to revoke scanner');
        }
    };

    const wrapperClassName = embedded ? 'space-y-6 animate-fade-in' : 'mx-auto max-w-7xl';

    return (
        <DashboardPage className={wrapperClassName}>
            {isRegisterModalOpen && (
                <RegisterScannerModal
                    onClose={() => setIsRegisterModalOpen(false)}
                    onSuccess={fetchScanners}
                    isDark={isDark}
                />
            )}

            <DashboardPageHeader
                isDark={isDark}
                eyebrow="Field ops"
                title={title}
                description={description}
                icon={Smartphone}
                iconClassName={isDark ? 'text-pink-300' : 'text-rose-700'}
                actions={(
                    <DashboardButton
                        isDark={isDark}
                        className="w-full sm:w-auto"
                        onClick={() => setIsRegisterModalOpen(true)}
                    >
                        <Plus size={18} />
                        Register New Scanner
                    </DashboardButton>
                )}
            />

            <DashboardSurface isDark={isDark} accent="brand" className="p-4 sm:p-5">
                <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                    <button
                        onClick={() => { setActiveTab('scanners'); setPage(1); }}
                        className={cn(
                            'relative inline-flex min-w-max items-center gap-2 rounded-md px-4 py-2.5 text-sm font-light tracking-wide transition-colors',
                            activeTab === 'scanners'
                                ? (isDark ? 'bg-dashboard-control text-white' : 'bg-slate-900 text-white')
                                : (isDark ? 'text-dashboard-muted hover:bg-dashboard-panelAlt hover:text-zinc-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')
                        )}
                    >
                        <Smartphone size={18} />
                        <span>Active Scanners</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('logs'); setPage(1); }}
                        className={cn(
                            'relative inline-flex min-w-max items-center gap-2 rounded-md px-4 py-2.5 text-sm font-light tracking-wide transition-colors',
                            activeTab === 'logs'
                                ? (isDark ? 'bg-dashboard-control text-white' : 'bg-slate-900 text-white')
                                : (isDark ? 'text-dashboard-muted hover:bg-dashboard-panelAlt hover:text-zinc-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')
                        )}
                    >
                        <History size={18} />
                        <span>Scan Logs</span>
                    </button>
                </div>
            </DashboardSurface>

            <DashboardSurface isDark={isDark} accent={activeTab === 'scanners' ? 'brand' : 'blue'} className="p-0">
                {isLoading ? (
                    <div className="p-12 text-center sm:p-20">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-dashboard-accent"></div>
                        <p className={cn('mt-4 text-sm font-light', isDark ? 'text-dashboard-muted' : 'text-slate-500')}>Loading...</p>
                    </div>
                ) : activeTab === 'scanners' ? (
                    scanners.length === 0 ? (
                        <DashboardEmptyState
                            isDark={isDark}
                            title="No scanners registered"
                            description="Register a device to start scanning tickets."
                            className="m-4"
                        />
                    ) : (
                        <>
                            <div className="grid gap-3 p-4 md:hidden" data-testid="scanner-mobile-cards">
                                {scanners.map((scanner) => (
                                    <article
                                        key={scanner.id}
                                        className={cn('rounded-md border p-4', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h3 className={cn('truncate text-base font-light', isDark ? 'text-zinc-100' : 'text-slate-900')}>
                                                    {scanner.name}
                                                </h3>
                                                <p className={cn('mt-1 truncate font-mono text-xs', isDark ? 'text-dashboard-muted' : 'text-slate-500')}>
                                                    {scanner.deviceId || 'No device ID'}
                                                </p>
                                            </div>
                                            <ScannerStatusChip scanner={scanner} isDark={isDark} />
                                        </div>
                                        <div className={cn('mt-4 grid gap-1 text-xs font-light', isDark ? 'text-dashboard-muted' : 'text-slate-500')}>
                                            <span>Last active</span>
                                            <span className={isDark ? 'text-zinc-100' : 'text-slate-800'}>
                                                {formatDateTime(scanner.lastUsedAt || scanner.lastActiveAt)}
                                            </span>
                                        </div>
                                        <DashboardButton
                                            isDark={isDark}
                                            variant="danger"
                                            className="mt-4 w-full"
                                            onClick={() => handleRevoke(scanner.id)}
                                        >
                                            <PowerOff size={16} />
                                            Revoke access
                                        </DashboardButton>
                                    </article>
                                ))}
                            </div>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left">
                                    <thead className={cn('border-b text-xs uppercase tracking-wider', isDark ? 'border-dashboard-borderStrong bg-dashboard-control text-dashboard-muted' : 'border-slate-200 bg-slate-50 text-slate-500')}>
                                        <tr>
                                            <th className="p-4 font-light tracking-wide">Name</th>
                                            <th className="p-4 font-light tracking-wide">Device ID</th>
                                            <th className="p-4 font-light tracking-wide">Status</th>
                                            <th className="p-4 font-light tracking-wide">Last Active</th>
                                            <th className="p-4 text-right font-light tracking-wide">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className={cn('divide-y text-sm font-light tracking-wide', isDark ? 'divide-dashboard-border text-zinc-300' : 'divide-slate-100 text-slate-600')}>
                                        {scanners.map((scanner) => (
                                            <tr key={scanner.id} className={cn('group transition-colors', isDark ? 'hover:bg-dashboard-panelAlt' : 'hover:bg-slate-50')}>
                                                <td className="p-4">{scanner.name}</td>
                                                <td className="p-4 font-mono text-xs opacity-70">{scanner.deviceId || 'N/A'}</td>
                                                <td className="p-4"><ScannerStatusChip scanner={scanner} isDark={isDark} /></td>
                                                <td className="p-4 text-xs">{formatDateTime(scanner.lastUsedAt || scanner.lastActiveAt)}</td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => handleRevoke(scanner.id)}
                                                        className={cn('rounded-md p-2 transition-colors', isDark ? 'text-rose-300 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50')}
                                                        title="Revoke Access"
                                                    >
                                                        <PowerOff size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )
                ) : logs.length === 0 ? (
                    <DashboardEmptyState
                        isDark={isDark}
                        title="No scan logs found"
                        description="Successful and denied scans will appear here after devices start validating tickets."
                        className="m-4"
                    />
                ) : (
                    <>
                        <div className="grid gap-3 p-4 md:hidden" data-testid="scan-log-mobile-cards">
                            {Array.isArray(logs) && logs.map((log) => (
                                <article
                                    key={log.id}
                                    className={cn('rounded-md border p-4', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className={cn('text-sm font-light', isDark ? 'text-zinc-100' : 'text-slate-900')}>
                                                {formatDateTime(log.scannedAt)}
                                            </p>
                                            <p className={cn('mt-1 text-xs font-light', isDark ? 'text-dashboard-muted' : 'text-slate-500')}>
                                                {log.scanner?.name || 'Unknown scanner'}
                                            </p>
                                        </div>
                                        <ScanResultChip log={log} isDark={isDark} />
                                    </div>
                                    <div className={cn('mt-4 grid grid-cols-2 gap-3 text-xs font-light', isDark ? 'text-dashboard-muted' : 'text-slate-500')}>
                                        <div>
                                            <span>Type</span>
                                            <p className={isDark ? 'text-sky-300' : 'text-sky-700'}>{log.scanType}</p>
                                        </div>
                                        <div className="min-w-0">
                                            <span>Ticket</span>
                                            <p className={cn('truncate font-mono', isDark ? 'text-zinc-100' : 'text-slate-800')} title={log.ticketId}>
                                                {log.ticketId}
                                            </p>
                                        </div>
                                    </div>
                                    {!log.success && log.metadata?.reason ? (
                                        <p className={cn('mt-3 text-xs font-light', isDark ? 'text-rose-200' : 'text-rose-700')}>
                                            {log.metadata.reason}
                                        </p>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left">
                                <thead className={cn('border-b text-xs uppercase tracking-wider', isDark ? 'border-dashboard-borderStrong bg-dashboard-control text-dashboard-muted' : 'border-slate-200 bg-slate-50 text-slate-500')}>
                                    <tr>
                                        <th className="p-4 font-light tracking-wide">Time</th>
                                        <th className="p-4 font-light tracking-wide">Type</th>
                                        <th className="p-4 font-light tracking-wide">Scanner</th>
                                        <th className="p-4 font-light tracking-wide">Ticket</th>
                                        <th className="p-4 font-light tracking-wide">Result</th>
                                    </tr>
                                </thead>
                                <tbody className={cn('divide-y text-sm font-light tracking-wide', isDark ? 'divide-dashboard-border text-zinc-300' : 'divide-slate-100 text-slate-600')}>
                                    {Array.isArray(logs) && logs.map((log) => (
                                        <tr key={log.id} className={cn('group transition-colors', isDark ? 'hover:bg-dashboard-panelAlt' : 'hover:bg-slate-50')}>
                                            <td className="whitespace-nowrap p-4">{formatDateTime(log.scannedAt)}</td>
                                            <td className="p-4">
                                                <span className={cn('font-medium', log.scanType === 'ENTRY' ? 'text-sky-500' : 'text-orange-500')}>
                                                    {log.scanType}
                                                </span>
                                            </td>
                                            <td className="p-4">{log.scanner?.name || 'Unknown'}</td>
                                            <td className="max-w-[100px] truncate p-4 font-mono text-xs" title={log.ticketId}>
                                                {log.ticketId}
                                            </td>
                                            <td className="p-4">
                                                <ScanResultChip log={log} isDark={isDark} />
                                                {!log.success && log.metadata?.reason && (
                                                    <span className="ml-2 text-xs opacity-60">({log.metadata.reason})</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </DashboardSurface>

            {totalPages > 1 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className={cn('text-sm font-light', isDark ? 'text-dashboard-muted' : 'text-slate-500')}>
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <DashboardButton isDark={isDark} variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                            Previous
                        </DashboardButton>
                        <DashboardButton isDark={isDark} variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                            Next
                        </DashboardButton>
                    </div>
                </div>
            ) : null}
        </DashboardPage>
    );
};

export default ScannersView;
