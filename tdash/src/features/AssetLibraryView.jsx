import React, { useEffect, useMemo, useState } from 'react';
import {
    Copy,
    ExternalLink,
    FileImage,
    FileText,
    Filter,
    FolderOpen,
    Image,
    Link2,
    RefreshCcw,
    Video,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardPage,
    DashboardPageHeader,
    DashboardSection,
    DashboardSelect,
    DashboardStat,
    DashboardSurface,
    DashboardTextInput,
} from '../components/dashboard/DashboardPrimitives';
import { api } from '../lib/api';
import { getDashboardTheme } from '../lib/dashboardTheme';
import { cn } from '../lib/utils';

const APPROVAL_STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'PENDING_REVIEW', label: 'Pending review' },
    { value: 'UPDATED', label: 'Updated' },
    { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'DECLINED', label: 'Declined' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

const ASSET_KIND_OPTIONS = [
    { value: '', label: 'All file types' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Video' },
    { value: 'document', label: 'Documents' },
    { value: 'file', label: 'Other files' },
];

const extractApprovals = (response) => response?.approvals || response?.data?.approvals || [];

const formatDate = (value, options = {}) => {
    if (!value) {
        return 'Unknown date';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown date';
    }

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...options,
    });
};

const formatFileSize = (value) => {
    const size = Number(value) || 0;

    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    if (size < 1024 * 1024 * 1024) {
        return `${(size / 1024 / 1024).toFixed(1)} MB`;
    }

    return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const getAssetKind = (mimeType = '') => {
    if (mimeType.startsWith('image/')) {
        return 'image';
    }

    if (mimeType.startsWith('video/')) {
        return 'video';
    }

    if (mimeType === 'application/pdf' || mimeType.includes('illustrator') || mimeType.includes('photoshop')) {
        return 'document';
    }

    return 'file';
};

const getAssetKindLabel = (kind) => {
    if (kind === 'image') return 'Image';
    if (kind === 'video') return 'Video';
    if (kind === 'document') return 'Document';
    return 'File';
};

const getAssetIcon = (kind) => {
    if (kind === 'image') return FileImage;
    if (kind === 'video') return Video;
    return FileText;
};

const getShareReadyReviewers = (reviewers = []) => reviewers.filter((reviewer) => reviewer?.reviewUrl);

const getApprovalStatusTone = (status) => {
    if (status === 'APPROVED') {
        return 'bg-emerald-500/15 text-emerald-300';
    }

    if (status === 'CHANGES_REQUESTED' || status === 'UPDATED') {
        return 'bg-amber-500/15 text-amber-300';
    }

    if (status === 'DECLINED' || status === 'CANCELLED') {
        return 'bg-rose-500/15 text-rose-300';
    }

    return 'bg-sky-500/15 text-sky-300';
};

const flattenAssets = (approvals) => approvals
    .flatMap((approval) => {
        const latestRevisionId = approval?.latestRevision?.id;

        return (approval?.revisions || []).flatMap((revision) =>
            (revision?.assets || []).map((asset) => ({
                id: asset.id,
                approvalId: approval.id,
                approvalTitle: approval.title || 'Untitled approval',
                approvalStatus: approval.status || 'PENDING_REVIEW',
                approvalDescription: approval.description || '',
                eventId: approval.event?.id || '',
                eventName: approval.event?.name || 'Unassigned event',
                revisionId: revision.id,
                revisionNumber: revision.revisionNumber,
                revisionCreatedAt: revision.createdAt,
                isLatestRevision: revision.id === latestRevisionId,
                createdAt: asset.createdAt || revision.createdAt || approval.submittedAt,
                filename: asset.filename,
                originalName: asset.originalName || asset.filename || 'Untitled asset',
                mimeType: asset.mimeType || '',
                kind: getAssetKind(asset.mimeType),
                size: asset.size || 0,
                s3Url: asset.s3Url,
                reviewers: approval.reviewers || [],
            }))
        );
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

const AssetPreview = ({ asset, isDark, compact = false }) => {
    const kind = asset?.kind;
    const Icon = getAssetIcon(kind);

    return (
        <div className={cn(
            'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border',
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-100'
        )}>
            {!asset ? null : kind === 'image' ? (
                <img src={asset.s3Url} alt={asset.originalName} className="h-full w-full object-cover" />
            ) : kind === 'video' ? (
                <video
                    src={asset.s3Url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    controls={!compact}
                    autoPlay={!compact}
                    loop={!compact}
                />
            ) : (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <div className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-full',
                        isDark ? 'bg-white/10 text-zinc-100' : 'bg-white text-slate-700'
                    )}>
                        <Icon className="h-7 w-7" />
                    </div>
                    <div>
                        <p className={cn('text-sm font-light', isDark ? 'text-zinc-100' : 'text-slate-900')}>
                            {asset.originalName}
                        </p>
                        <p className={cn('mt-1 text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
                            Preview unavailable for this file type.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

const AssetCard = ({ asset, isDark, isSelected, onSelect }) => {
    const Icon = getAssetIcon(asset.kind);

    return (
        <DashboardSurface
            as="button"
            type="button"
            isDark={isDark}
            accent={asset.kind === 'image' ? 'brand' : asset.kind === 'video' ? 'violet' : 'blue'}
            interactive
            onClick={() => onSelect(asset.id)}
            className={cn(
                'group overflow-hidden text-left',
                isSelected && 'ring-2 ring-pink-500/40'
            )}
        >
            <AssetPreview asset={asset} isDark={isDark} compact />
            <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className={cn('truncate text-sm font-light', isDark ? 'text-zinc-100' : 'text-slate-900')}>
                            {asset.originalName}
                        </p>
                        <p className={cn('mt-1 truncate text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
                            {asset.approvalTitle}
                        </p>
                    </div>
                    <DashboardChip isDark={isDark} className="shrink-0">
                        <span className="inline-flex items-center gap-1">
                            <Icon className="h-3.5 w-3.5" />
                            {getAssetKindLabel(asset.kind)}
                        </span>
                    </DashboardChip>
                </div>

                <div className={cn('grid gap-1 text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
                    <p className="truncate">{asset.eventName}</p>
                    <div className="flex items-center justify-between gap-3">
                        <span>v{asset.revisionNumber}</span>
                        <span>{formatFileSize(asset.size)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span>{formatDate(asset.createdAt)}</span>
                        <span className={cn('rounded-full px-2 py-1 text-[11px]', getApprovalStatusTone(asset.approvalStatus))}>
                            {asset.approvalStatus.replace(/_/g, ' ')}
                        </span>
                    </div>
                </div>
            </div>
        </DashboardSurface>
    );
};

const AssetLibraryView = ({ isDark }) => {
    const navigate = useNavigate();
    const uiTheme = getDashboardTheme(isDark);
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [searchValue, setSearchValue] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [kindFilter, setKindFilter] = useState('');
    const [latestOnly, setLatestOnly] = useState(false);
    const [selectedAssetId, setSelectedAssetId] = useState(null);

    const loadAssets = async ({ background = false } = {}) => {
        try {
            setError('');
            if (background) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await api.get('/approvals?limit=100');
            setApprovals(extractApprovals(response));
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError.message || 'Failed to load uploaded assets.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadAssets();
    }, []);

    const assets = useMemo(() => flattenAssets(approvals), [approvals]);

    const eventOptions = useMemo(() => {
        const items = new Map();

        assets.forEach((asset) => {
            if (asset.eventId && !items.has(asset.eventId)) {
                items.set(asset.eventId, { value: asset.eventId, label: asset.eventName });
            }
        });

        return [...items.values()].sort((left, right) => left.label.localeCompare(right.label));
    }, [assets]);

    const filteredAssets = useMemo(() => {
        const query = searchValue.trim().toLowerCase();

        return assets.filter((asset) => {
            if (eventFilter && asset.eventId !== eventFilter) {
                return false;
            }

            if (statusFilter && asset.approvalStatus !== statusFilter) {
                return false;
            }

            if (kindFilter && asset.kind !== kindFilter) {
                return false;
            }

            if (latestOnly && !asset.isLatestRevision) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                asset.originalName,
                asset.approvalTitle,
                asset.eventName,
                asset.mimeType,
            ].some((value) => value?.toLowerCase().includes(query));
        });
    }, [assets, eventFilter, kindFilter, latestOnly, searchValue, statusFilter]);

    useEffect(() => {
        if (filteredAssets.length === 0) {
            setSelectedAssetId(null);
            return;
        }

        if (!filteredAssets.some((asset) => asset.id === selectedAssetId)) {
            setSelectedAssetId(filteredAssets[0].id);
        }
    }, [filteredAssets, selectedAssetId]);

    const selectedAsset = filteredAssets.find((asset) => asset.id === selectedAssetId) || null;
    const selectedShareReviewers = getShareReadyReviewers(selectedAsset?.reviewers);
    const latestAssetCount = assets.filter((asset) => asset.isLatestRevision).length;
    const shareReadyCount = assets.filter((asset) => getShareReadyReviewers(asset.reviewers).length > 0).length;
    const approvalCoverageCount = new Set(assets.map((asset) => asset.approvalId)).size;

    const copyText = async (value, label) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(label);
        } catch (copyError) {
            toast.error('Clipboard unavailable');
        }
    };

    const copyReviewLinks = () => {
        const reviewLinks = selectedShareReviewers
            .map((reviewer) => `${reviewer.name || reviewer.email}: ${reviewer.reviewUrl}`)
            .join('\n');

        if (!reviewLinks) {
            toast.error('No external review links available for this asset.');
            return;
        }

        copyText(reviewLinks, 'Review links copied');
    };

    return (
        <DashboardPage className="mx-auto max-w-[1680px] space-y-6">
            <DashboardPageHeader
                isDark={isDark}
                eyebrow="Creative Ops"
                title="Asset Library"
                description="Browse uploaded creative like a shared drive, then hand off either a signed asset URL for internal use or a secure review link for external collaborators."
                icon={Image}
                iconClassName="text-pink-400"
                badges={(
                    <>
                        <DashboardChip isDark={isDark}>{assets.length} uploaded files</DashboardChip>
                        <DashboardChip isDark={isDark}>{shareReadyCount} externally shareable</DashboardChip>
                        {refreshing ? <DashboardChip isDark={isDark}>Refreshing</DashboardChip> : null}
                    </>
                )}
                actions={(
                    <>
                        <DashboardButton isDark={isDark} variant="secondary" onClick={() => loadAssets({ background: true })}>
                            <RefreshCcw className="h-4 w-4" />
                            Refresh
                        </DashboardButton>
                        <DashboardButton isDark={isDark} variant="primary" onClick={() => navigate('/approvals')}>
                            <FolderOpen className="h-4 w-4" />
                            Open approvals
                        </DashboardButton>
                    </>
                )}
            />

            <DashboardSection
                isDark={isDark}
                accent="amber"
                title="Library snapshot"
                description="Track how much creative is in circulation, what is current, and what is already wired for external handoff."
            >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <DashboardStat isDark={isDark} label="Uploaded files" value={assets.length} detail="Every asset across approval revisions." />
                    <DashboardStat isDark={isDark} label="Latest versions" value={latestAssetCount} detail="Assets on the newest revision only." />
                    <DashboardStat isDark={isDark} label="Approval coverage" value={approvalCoverageCount} detail="Approvals represented in the library." />
                    <DashboardStat isDark={isDark} label="Share ready" value={shareReadyCount} detail="Assets with at least one secure review link." />
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                accent="blue"
                title="Browse assets"
                description="Search by filename, approval, or event, then filter down to the exact creative version you need."
                actions={(
                    <DashboardButton
                        isDark={isDark}
                        variant={latestOnly ? 'primary' : 'secondary'}
                        onClick={() => setLatestOnly((current) => !current)}
                    >
                        <Filter className="h-4 w-4" />
                        {latestOnly ? 'Showing latest only' : 'Show latest only'}
                    </DashboardButton>
                )}
            >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.7fr))]">
                    <DashboardTextInput
                        isDark={isDark}
                        aria-label="Search assets"
                        placeholder="Search file, event, or approval"
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                    />
                    <DashboardSelect
                        isDark={isDark}
                        aria-label="Event filter"
                        value={eventFilter}
                        onChange={(event) => setEventFilter(event.target.value)}
                    >
                        <option value="">All events</option>
                        {eventOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </DashboardSelect>
                    <DashboardSelect
                        isDark={isDark}
                        aria-label="Approval status filter"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        {APPROVAL_STATUS_OPTIONS.map((option) => (
                            <option key={option.value || 'all'} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </DashboardSelect>
                    <DashboardSelect
                        isDark={isDark}
                        aria-label="Asset type filter"
                        value={kindFilter}
                        onChange={(event) => setKindFilter(event.target.value)}
                    >
                        {ASSET_KIND_OPTIONS.map((option) => (
                            <option key={option.value || 'all'} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </DashboardSelect>
                </div>

                {error ? (
                    <div className={cn(
                        'mt-4 rounded-md border px-4 py-3 text-sm',
                        isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'
                    )}>
                        {error}
                    </div>
                ) : null}

                {loading ? (
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <DashboardSurface key={index} isDark={isDark} accent="slate" className="h-[320px] animate-pulse" />
                        ))}
                    </div>
                ) : filteredAssets.length === 0 ? (
                    <DashboardEmptyState
                        isDark={isDark}
                        className="mt-6"
                        title="No assets match these filters"
                        description="Try widening the search, turning off the latest-only toggle, or creating a new approval submission."
                        action={(
                            <DashboardButton isDark={isDark} variant="primary" onClick={() => navigate('/approvals')}>
                                Open approvals
                            </DashboardButton>
                        )}
                    />
                ) : (
                    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
                        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                            {filteredAssets.map((asset) => (
                                <AssetCard
                                    key={asset.id}
                                    asset={asset}
                                    isDark={isDark}
                                    isSelected={asset.id === selectedAssetId}
                                    onSelect={setSelectedAssetId}
                                />
                            ))}
                        </div>

                        <div className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
                            {selectedAsset ? (
                                <>
                                    <DashboardSurface isDark={isDark} accent="violet" className="space-y-4 p-4">
                                        <AssetPreview asset={selectedAsset} isDark={isDark} />

                                        <div>
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className={cn('text-lg font-light tracking-tight', uiTheme.textPrimary)}>
                                                        {selectedAsset.originalName}
                                                    </h3>
                                                    <p className={cn('mt-1 text-sm font-light leading-6', uiTheme.textSecondary)}>
                                                        {selectedAsset.approvalTitle}
                                                    </p>
                                                </div>
                                                <DashboardChip isDark={isDark}>{selectedAsset.eventName}</DashboardChip>
                                            </div>

                                            <div className={cn('mt-4 grid gap-2 text-sm font-light', uiTheme.textSecondary)}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span>Type</span>
                                                    <span className={uiTheme.textPrimary}>{getAssetKindLabel(selectedAsset.kind)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span>Size</span>
                                                    <span className={uiTheme.textPrimary}>{formatFileSize(selectedAsset.size)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span>Revision</span>
                                                    <span className={uiTheme.textPrimary}>v{selectedAsset.revisionNumber}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span>Uploaded</span>
                                                    <span className={uiTheme.textPrimary}>{formatDate(selectedAsset.createdAt, { hour: 'numeric', minute: '2-digit' })}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span>Status</span>
                                                    <span className={cn('rounded-full px-2 py-1 text-[11px]', getApprovalStatusTone(selectedAsset.approvalStatus))}>
                                                        {selectedAsset.approvalStatus.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <DashboardButton isDark={isDark} onClick={() => window.open(selectedAsset.s3Url, '_blank', 'noopener,noreferrer')}>
                                                <ExternalLink className="h-4 w-4" />
                                                Open asset
                                            </DashboardButton>
                                            <DashboardButton
                                                isDark={isDark}
                                                variant="secondary"
                                                aria-label="Copy asset URL"
                                                onClick={() => copyText(selectedAsset.s3Url, 'Asset link copied')}
                                            >
                                                <Copy className="h-4 w-4" />
                                                Copy asset URL
                                            </DashboardButton>
                                            <DashboardButton isDark={isDark} variant="secondary" onClick={() => navigate(`/approvals?approvalId=${selectedAsset.approvalId}`)}>
                                                <FolderOpen className="h-4 w-4" />
                                                Open approval
                                            </DashboardButton>
                                        </div>
                                    </DashboardSurface>

                                    <DashboardSurface isDark={isDark} accent="brand" className="space-y-4 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className={cn('text-lg font-light tracking-tight', uiTheme.textPrimary)}>Share links</h3>
                                                <p className={cn('mt-1 text-sm font-light leading-6', uiTheme.textSecondary)}>
                                                    Asset URLs are signed for short-lived internal access. Use reviewer links for stable external sharing.
                                                </p>
                                            </div>
                                            {selectedShareReviewers.length > 1 ? (
                                                <DashboardButton isDark={isDark} variant="secondary" onClick={copyReviewLinks}>
                                                    <Link2 className="h-4 w-4" />
                                                    Copy all
                                                </DashboardButton>
                                            ) : null}
                                        </div>

                                        {selectedShareReviewers.length === 0 ? (
                                            <DashboardEmptyState
                                                isDark={isDark}
                                                compact
                                                title="No external review links yet"
                                                description="Add or resend reviewers from the approval detail to generate secure links for artists, agents, or management."
                                            />
                                        ) : (
                                            <div className="space-y-3">
                                                {selectedShareReviewers.map((reviewer) => (
                                                    <div
                                                        key={reviewer.id}
                                                        className={cn(
                                                            'rounded-md border p-3',
                                                            isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className={cn('truncate text-sm font-light', uiTheme.textPrimary)}>
                                                                    {reviewer.name || reviewer.email}
                                                                </p>
                                                                <p className={cn('truncate text-xs font-light', uiTheme.textSecondary)}>
                                                                    {reviewer.email}
                                                                </p>
                                                            </div>
                                                            <DashboardButton
                                                                isDark={isDark}
                                                                variant="secondary"
                                                                className="px-3 py-2 text-xs"
                                                                aria-label={`Copy review link for ${reviewer.email}`}
                                                                onClick={() => copyText(reviewer.reviewUrl, 'Review link copied')}
                                                            >
                                                                <Copy className="h-3.5 w-3.5" />
                                                                Copy
                                                            </DashboardButton>
                                                        </div>
                                                        <div className={cn('mt-3 flex items-center justify-between gap-3 text-xs font-light', uiTheme.textSecondary)}>
                                                            <span>{reviewer.association || reviewer.reviewerType}</span>
                                                            <span>Expires {formatDate(reviewer.tokenExpiresAt)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </DashboardSurface>
                                </>
                            ) : (
                                <DashboardEmptyState
                                    isDark={isDark}
                                    title="Select an asset"
                                    description="Choose an asset from the library to preview it, inspect metadata, and copy share links."
                                />
                            )}
                        </div>
                    </div>
                )}
            </DashboardSection>
        </DashboardPage>
    );
};

export default AssetLibraryView;
