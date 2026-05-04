import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    BadgeCheck,
    Copy,
    Download,
    FileImage,
    FileText,
    FolderOpen,
    LayoutGrid,
    Link2,
    List,
    MoreHorizontal,
    Plus,
    RefreshCcw,
    Search,
    Share2,
    Sparkles,
    Upload,
    Video,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardIconButton,
    DashboardPage,
    DashboardPageHeader,
    DashboardSection,
    DashboardSelect,
    DashboardSurface,
    DashboardTextInput,
} from '../components/dashboard/DashboardPrimitives';
import { api } from '../lib/api';
import { getDashboardTheme } from '../lib/dashboardTheme';
import { cn } from '../lib/utils';

const LIBRARY_CAPACITY_BYTES = 500 * 1024 * 1024 * 1024;
const KEYWORD_CATEGORY_RULES = [
    { id: 'posters', patterns: ['poster', 'flyer', 'banner'] },
    { id: 'logos', patterns: ['logo', 'wordmark', 'lockup'] },
    { id: 'social', patterns: ['social', 'story', 'carousel', 'tile', 'post'] },
];

const CATEGORY_DEFINITIONS = [
    { id: 'all', label: 'All Assets', icon: FolderOpen },
    { id: 'posters', label: 'Posters', icon: Sparkles },
    { id: 'photography', label: 'Photography', icon: FileImage },
    { id: 'logos', label: 'Logos', icon: BadgeCheck },
    { id: 'social', label: 'Social', icon: Share2 },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'approved', label: 'Approved', icon: BadgeCheck },
    { id: 'share-ready', label: 'Share Ready', icon: Link2 },
];

const TYPE_OPTIONS = [
    { value: '', label: 'Type' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Video' },
    { value: 'document', label: 'Documents' },
    { value: 'file', label: 'Other files' },
];

const DATE_OPTIONS = [
    { value: '', label: 'Date' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
];

const MORE_FILTER_OPTIONS = [
    { value: '', label: 'More Filters' },
    { value: 'share-ready', label: 'Share ready' },
    { value: 'latest', label: 'Latest revision' },
    { value: 'approved', label: 'Approved only' },
];

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'largest', label: 'Largest' },
    { value: 'smallest', label: 'Smallest' },
    { value: 'name', label: 'Name A-Z' },
];

const extractApprovals = (response) => response?.approvals || response?.data?.approvals || [];
const extractDirectAssets = (response) => response?.assets || response?.data?.assets || [];

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

const normalizeToken = (value) => (
    value
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
);

const titleCase = (value) => value.replace(/\b\w/g, (match) => match.toUpperCase());

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

const getShareReadyReviewers = (reviewers = []) => reviewers.filter((reviewer) => reviewer?.reviewUrl);

const formatUserName = (user) => {
    const first = user?.firstName?.trim() || '';
    const last = user?.lastName?.trim() || '';
    const joined = `${first} ${last}`.trim();
    return joined || user?.email || 'Unknown uploader';
};

const deriveCategory = (asset) => {
    const haystack = normalizeToken(`${asset.originalName} ${asset.approvalTitle}`);
    const keywordMatch = KEYWORD_CATEGORY_RULES.find((rule) => rule.patterns.some((pattern) => haystack.includes(pattern)));

    if (keywordMatch) {
        return keywordMatch.id;
    }

    if (asset.kind === 'video') {
        return 'videos';
    }

    if (asset.kind === 'document' || asset.kind === 'file') {
        return 'documents';
    }

    return 'photography';
};

const buildAssetTags = (asset) => {
    const candidateText = [
        asset.eventName,
        asset.approvalTitle,
        asset.originalName.replace(/\.[^.]+$/, ''),
        deriveCategory(asset),
        asset.kind,
    ].join(' ');

    const tokens = candidateText
        .split(/[^a-zA-Z0-9]+/)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length >= 3)
        .filter((token) => !['with', 'from', 'this', 'that', 'version', 'file', 'assets'].includes(token));

    return [...new Set(tokens)].slice(0, 5);
};

const flattenAssets = (approvals) => approvals
    .flatMap((approval) => {
        const latestRevisionId = approval?.latestRevision?.id;

        return (approval?.revisions || []).flatMap((revision) =>
            (revision?.assets || []).filter((asset) => asset?.approvedForLibraryAt).map((asset) => {
                const uploader = revision?.uploadedBy || approval?.createdBy || null;
                const item = {
                    id: asset.id,
                    approvalId: approval.id,
                    approvalTitle: approval.title || 'Untitled approval',
                    approvalStatus: approval.status || 'PENDING_REVIEW',
                    approvalDescription: approval.description || '',
                    eventId: approval.event?.id || '',
                    eventName: approval.event?.name || 'Unassigned event',
                    revisionId: revision.id,
                    revisionNumber: revision.revisionNumber,
                    isLatestRevision: revision.id === latestRevisionId,
                    createdAt: asset.createdAt || revision.createdAt || approval.submittedAt,
                    filename: asset.filename,
                    originalName: asset.originalName || asset.filename || 'Untitled asset',
                    mimeType: asset.mimeType || '',
                    kind: getAssetKind(asset.mimeType),
                    size: asset.size || 0,
                    s3Url: asset.s3Url,
                    approvedForLibraryAt: asset.approvedForLibraryAt,
                    approvedForLibraryById: asset.approvedForLibraryById,
                    reviewers: approval.reviewers || [],
                    uploaderName: formatUserName(uploader),
                    uploaderEmail: uploader?.email || '',
                };

                return {
                    ...item,
                    category: deriveCategory(item),
                    tags: buildAssetTags(item),
                };
            })
        );
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

const flattenDirectAssets = (assets) => assets.map((asset) => {
    const uploader = asset?.uploadedBy || null;
    const item = {
        id: `direct-${asset.id}`,
        directAssetId: asset.id,
        approvalId: '',
        approvalTitle: 'Direct library upload',
        approvalStatus: 'APPROVED',
        approvalDescription: 'Creative asset uploaded directly to the asset library.',
        eventId: asset.event?.id || asset.eventId || '',
        eventName: asset.event?.name || 'Unassigned event',
        revisionId: '',
        revisionNumber: 'Library',
        isLatestRevision: true,
        createdAt: asset.createdAt,
        filename: asset.filename,
        originalName: asset.originalName || asset.filename || 'Untitled asset',
        mimeType: asset.mimeType || '',
        kind: getAssetKind(asset.mimeType),
        size: asset.size || 0,
        s3Url: asset.s3Url,
        approvedForLibraryAt: asset.createdAt,
        approvedForLibraryById: uploader?.id || '',
        reviewers: [],
        uploaderName: formatUserName(uploader),
        uploaderEmail: uploader?.email || '',
    };

    return {
        ...item,
        category: asset.category || deriveCategory(item),
        tags: buildAssetTags(item),
    };
});

const withinDateFilter = (value, range) => {
    if (!range) {
        return true;
    }

    const createdAt = new Date(value);
    if (Number.isNaN(createdAt.getTime())) {
        return false;
    }

    const now = Date.now();
    const limits = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
    };

    return now - createdAt.getTime() <= limits[range] * 24 * 60 * 60 * 1000;
};

const AssetSelectionToggle = ({ checked, isDark, onToggle }) => (
    <button
        type="button"
        aria-pressed={checked}
        onClick={onToggle}
        className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-md border transition',
            checked
                ? 'border-pink-400 bg-pink-500 text-white shadow-[0_0_0_1px_rgba(236,72,153,0.18)]'
                : isDark
                    ? 'border-white/15 bg-black/20 text-transparent hover:border-white/30'
                    : 'border-slate-200 bg-white text-transparent hover:border-slate-300'
        )}
    >
        <span className={cn('text-sm', checked ? 'opacity-100' : 'opacity-0')}>✓</span>
    </button>
);

const AssetPreview = ({ asset, isDark, compact = false }) => {
    const kind = asset?.kind;
    const Icon = getAssetIcon(kind);

    return (
        <div
            className={cn(
                'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border',
                isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-100'
            )}
        >
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
                    <div
                        className={cn(
                            'flex h-16 w-16 items-center justify-center rounded-full',
                            isDark ? 'bg-white/10 text-zinc-100' : 'bg-white text-slate-700'
                        )}
                    >
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

const CategoryRail = ({ categories, activeCategory, onSelect, isDark, totalSize }) => {
    const uiTheme = getDashboardTheme(isDark);
    const usageRatio = Math.min(totalSize / LIBRARY_CAPACITY_BYTES, 1);

    return (
        <DashboardSurface isDark={isDark} accent="slate" className="p-4">
            <div className="space-y-2">
                {categories.map((category) => {
                    const active = category.id === activeCategory;
                    const Icon = category.icon;

                    return (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => onSelect(category.id)}
                            className={cn(
                                'flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition',
                                active
                                    ? 'border-pink-400/40 bg-gradient-to-r from-fuchsia-500/20 to-violet-500/15 text-white'
                                    : isDark
                                        ? cn('border-transparent bg-transparent hover:border-white/10 hover:bg-white/5 hover:text-white', uiTheme.textSecondary)
                                        : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                            )}
                        >
                            <span className="flex min-w-0 items-center gap-3">
                                <span
                                    className={cn(
                                        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                                        active
                                            ? 'bg-white/10 text-pink-200'
                                            : isDark
                                                ? cn('bg-white/5', uiTheme.textTertiary)
                                                : 'bg-slate-100 text-slate-500'
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="truncate text-sm font-light">{category.label}</span>
                            </span>
                            <span className={cn('text-xs font-light', active ? 'text-white' : uiTheme.textSecondary)}>
                                {category.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className={cn('mt-6 rounded-md border p-4', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Storage</p>
                        <p className={cn('mt-1 text-sm font-light', uiTheme.textPrimary)}>
                            {formatFileSize(totalSize)} of {formatFileSize(LIBRARY_CAPACITY_BYTES)}
                        </p>
                    </div>
                    <DashboardChip isDark={isDark}>{Math.round(usageRatio * 100)}%</DashboardChip>
                </div>
                <div className={cn('mt-4 h-2 overflow-hidden rounded-full', isDark ? 'bg-white/10' : 'bg-slate-200')}>
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400"
                        style={{ width: `${Math.max(6, usageRatio * 100)}%` }}
                    />
                </div>
                <DashboardButton isDark={isDark} variant="secondary" className="mt-4 w-full justify-center">
                    Upgrade Storage
                </DashboardButton>
            </div>
        </DashboardSurface>
    );
};

const AssetCard = ({
    asset,
    isDark,
    isActive,
    isSelected,
    onActivate,
    onToggleSelection,
}) => (
    <DashboardSurface
        role="button"
        tabIndex={0}
        isDark={isDark}
        accent={asset.kind === 'image' ? 'brand' : asset.kind === 'video' ? 'violet' : 'blue'}
        interactive
        aria-label={`Open asset ${asset.originalName}`}
        onClick={() => onActivate(asset.id)}
        onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate(asset.id);
            }
        }}
        className={cn(
            'group overflow-hidden text-left',
            isActive && 'ring-2 ring-pink-500/40'
        )}
    >
        <div className="relative">
            <AssetPreview asset={asset} isDark={isDark} compact />
            <div className="absolute left-3 top-3">
                <AssetSelectionToggle
                    checked={isSelected}
                    isDark={isDark}
                    onToggle={(event) => {
                        event.stopPropagation();
                        onToggleSelection(asset.id);
                    }}
                />
            </div>
            <div className="absolute right-3 top-3">
                <DashboardIconButton isDark={isDark} className="h-8 w-8 bg-black/25 text-white/80 hover:bg-black/45 hover:text-white">
                    <MoreHorizontal className="h-4 w-4" />
                </DashboardIconButton>
            </div>
        </div>
        <div className="space-y-3 p-4">
            <div className="min-w-0">
                <p className={cn('truncate text-base font-light', isDark ? 'text-zinc-100' : 'text-slate-900')}>
                    {asset.originalName}
                </p>
                <p className={cn('mt-1 truncate text-sm font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
                    {asset.approvalTitle}
                </p>
            </div>
            <div className={cn('space-y-1 text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
                <div className="flex items-center justify-between gap-3">
                    <span>{asset.eventName}</span>
                    <span>{formatFileSize(asset.size)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span>{asset.category === 'posters' ? 'Poster' : titleCase(asset.category)}</span>
                    <span>{formatDate(asset.createdAt)}</span>
                </div>
            </div>
        </div>
    </DashboardSurface>
);

const AssetRow = ({
    asset,
    isDark,
    isActive,
    isSelected,
    onActivate,
    onToggleSelection,
}) => (
    <div
        role="button"
        tabIndex={0}
        aria-label={`Open asset ${asset.originalName}`}
        onClick={() => onActivate(asset.id)}
        onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate(asset.id);
            }
        }}
        className={cn(
            'grid w-full grid-cols-[44px_72px_minmax(0,1.5fr)_0.8fr_0.8fr_0.9fr_40px] items-center gap-3 border-b px-4 py-3 text-left transition last:border-b-0',
            isDark
                ? 'border-white/10 hover:bg-white/5'
                : 'border-slate-200 hover:bg-slate-50',
            isActive && (isDark ? 'bg-white/5' : 'bg-slate-50')
        )}
    >
        <AssetSelectionToggle
            checked={isSelected}
            isDark={isDark}
            onToggle={(event) => {
                event.stopPropagation();
                onToggleSelection(asset.id);
            }}
        />
        <div className={cn('overflow-hidden rounded-md border', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-100')}>
            <AssetPreview asset={asset} isDark={isDark} compact />
        </div>
        <div className="min-w-0">
            <p className={cn('truncate text-sm font-light', isDark ? 'text-zinc-100' : 'text-slate-900')}>
                {asset.originalName}
            </p>
            <p className={cn('mt-1 truncate text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
                {asset.approvalTitle}
            </p>
        </div>
        <p className={cn('truncate text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
            {titleCase(asset.category)}
        </p>
        <p className={cn('truncate text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
            {formatFileSize(asset.size)}
        </p>
        <div>
            <span className={cn('rounded-full px-2 py-1 text-[11px]', getApprovalStatusTone(asset.approvalStatus))}>
                {asset.approvalStatus.replace(/_/g, ' ')}
            </span>
        </div>
        <DashboardIconButton isDark={isDark} className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
        </DashboardIconButton>
    </div>
);

const AssetInspector = ({
    asset,
    isDark,
    metrics,
    onOpen,
    onCopyAssetLink,
    onCopyShareLinks,
    onShare,
    onMove,
    onDelete,
}) => {
    const uiTheme = getDashboardTheme(isDark);
    const shareReadyReviewers = getShareReadyReviewers(asset?.reviewers);

    if (!asset) {
        return (
            <DashboardSurface isDark={isDark} accent="violet" className="p-5 xl:sticky xl:top-24">
                <DashboardEmptyState
                    isDark={isDark}
                    compact
                    title="Select an asset"
                    description="Use the grid or list to inspect metadata, links, and handoff actions."
                />
            </DashboardSurface>
        );
    }

    return (
        <DashboardSurface isDark={isDark} accent="violet" className="space-y-5 p-5 xl:sticky xl:top-24">
            <AssetPreview asset={asset} isDark={isDark} />

            <div className="space-y-3">
                <div>
                    <h3 className={cn('text-[1.3rem] font-light tracking-tight', uiTheme.textPrimary)}>{asset.originalName}</h3>
                    <p className={cn('mt-1 text-sm font-light', uiTheme.textSecondary)}>
                        {getAssetKindLabel(asset.kind)} • {formatFileSize(asset.size)}
                    </p>
                </div>

                <div className={cn('grid gap-2 text-sm font-light', uiTheme.textSecondary)}>
                    <div className="flex items-center justify-between gap-4">
                        <span>Uploaded</span>
                        <span className={uiTheme.textPrimary}>{formatDate(asset.createdAt, { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span>By</span>
                        <span className={cn('truncate text-right', uiTheme.textPrimary)}>{asset.uploaderName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span>Revision</span>
                        <span className={uiTheme.textPrimary}>v{asset.revisionNumber}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span>Status</span>
                        <span className={cn('rounded-full px-2 py-1 text-[11px]', getApprovalStatusTone(asset.approvalStatus))}>
                            {asset.approvalStatus.replace(/_/g, ' ')}
                        </span>
                    </div>
                    {metrics?.dimensions ? (
                        <div className="flex items-center justify-between gap-4">
                            <span>Dimensions</span>
                            <span className={uiTheme.textPrimary}>{metrics.dimensions}</span>
                        </div>
                    ) : null}
                </div>
            </div>

            <div>
                <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Tags</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {asset.tags.map((tag) => (
                        <DashboardChip key={tag} isDark={isDark}>
                            {tag}
                        </DashboardChip>
                    ))}
                </div>
            </div>

            <div>
                <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Description</p>
                <p className={cn('mt-3 text-sm font-light leading-6', uiTheme.textSecondary)}>
                    {asset.approvalDescription || 'Creative asset routed through the approval workflow.'}
                </p>
            </div>

            <div className="space-y-2">
                <DashboardButton isDark={isDark} className="w-full justify-center" onClick={onOpen}>
                    <Download className="h-4 w-4" />
                    Download
                </DashboardButton>
                <DashboardButton isDark={isDark} variant="secondary" className="w-full justify-center" onClick={onShare}>
                    <Share2 className="h-4 w-4" />
                    Share
                </DashboardButton>
                <DashboardButton isDark={isDark} variant="secondary" className="w-full justify-center" onClick={onMove}>
                    <FolderOpen className="h-4 w-4" />
                    Move
                </DashboardButton>
                <DashboardButton isDark={isDark} variant="danger" className="w-full justify-center" onClick={onDelete}>
                    Delete
                </DashboardButton>
            </div>

            <div className={cn('rounded-md border p-4', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className={cn('text-sm font-light', uiTheme.textPrimary)}>External review links</p>
                        <p className={cn('mt-1 text-xs font-light leading-5', uiTheme.textSecondary)}>
                            {shareReadyReviewers.length > 0
                                ? `${shareReadyReviewers.length} stable review link${shareReadyReviewers.length === 1 ? '' : 's'} ready for external handoff.`
                                : 'No stable review links available for this asset yet.'}
                        </p>
                    </div>
                    {shareReadyReviewers.length > 1 ? (
                        <DashboardButton isDark={isDark} variant="secondary" className="px-3 py-2 text-xs" onClick={onCopyShareLinks}>
                            <Copy className="h-3.5 w-3.5" />
                            Copy all
                        </DashboardButton>
                    ) : null}
                </div>

                <div className="mt-3 space-y-2">
                    {shareReadyReviewers.length === 0 ? (
                        <DashboardButton isDark={isDark} variant="secondary" className="w-full justify-center" onClick={onCopyAssetLink}>
                            <Link2 className="h-4 w-4" />
                            Copy signed asset URL
                        </DashboardButton>
                    ) : (
                        shareReadyReviewers.map((reviewer) => (
                            <div
                                key={reviewer.id}
                                className={cn('rounded-md border p-3', isDark ? 'border-white/10 bg-black/10' : 'border-slate-200 bg-white')}
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
                                        onClick={() => onCopyShareLinks(reviewer.reviewUrl)}
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
                        ))
                    )}
                </div>
            </div>
        </DashboardSurface>
    );
};

const AssetLibraryView = ({ isDark }) => {
    const uiTheme = getDashboardTheme(isDark);
    const uploadInputRef = useRef(null);
    const [approvals, setApprovals] = useState([]);
    const [directAssets, setDirectAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [searchValue, setSearchValue] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [kindFilter, setKindFilter] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [moreFilter, setMoreFilter] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [viewMode, setViewMode] = useState('grid');
    const [selectedAssetId, setSelectedAssetId] = useState(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState([]);
    const [isDraggingUpload, setIsDraggingUpload] = useState(false);
    const [assetMetrics, setAssetMetrics] = useState({});

    const loadAssets = async ({ background = false } = {}) => {
        try {
            setError('');
            if (background) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const [directAssetsResponse, approvalsResponse] = await Promise.allSettled([
                api.get('/assets'),
                api.get('/approvals?limit=100&includeArchived=true'),
            ]);

            if (directAssetsResponse.status === 'rejected') {
                throw directAssetsResponse.reason;
            }

            if (approvalsResponse.status === 'rejected') {
                throw approvalsResponse.reason;
            }

            setDirectAssets(extractDirectAssets(directAssetsResponse.value));
            setApprovals(extractApprovals(approvalsResponse.value));
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

    const assets = useMemo(() => [
        ...flattenDirectAssets(directAssets),
        ...flattenAssets(approvals),
    ], [approvals, directAssets]);
    const totalLibrarySize = useMemo(() => assets.reduce((sum, asset) => sum + asset.size, 0), [assets]);

    const tagOptions = useMemo(() => {
        const allTags = assets.flatMap((asset) => asset.tags);
        return [...new Set(allTags)].sort();
    }, [assets]);

    const categories = useMemo(() => CATEGORY_DEFINITIONS.map((definition) => ({
        ...definition,
        count: assets.filter((asset) => {
            if (definition.id === 'all') return true;
            if (definition.id === 'approved') return asset.approvalStatus === 'APPROVED';
            if (definition.id === 'share-ready') return getShareReadyReviewers(asset.reviewers).length > 0;
            return asset.category === definition.id;
        }).length,
    })), [assets]);

    const filteredAssets = useMemo(() => {
        const query = searchValue.trim().toLowerCase();

        const categoryFiltered = assets.filter((asset) => {
            if (activeCategory === 'all') {
                return true;
            }

            if (activeCategory === 'approved') {
                return asset.approvalStatus === 'APPROVED';
            }

            if (activeCategory === 'share-ready') {
                return getShareReadyReviewers(asset.reviewers).length > 0;
            }

            return asset.category === activeCategory;
        });

        const valueFiltered = categoryFiltered.filter((asset) => {
            if (kindFilter && asset.kind !== kindFilter) {
                return false;
            }

            if (tagFilter && !asset.tags.includes(tagFilter)) {
                return false;
            }

            if (!withinDateFilter(asset.createdAt, dateFilter)) {
                return false;
            }

            if (moreFilter === 'share-ready' && getShareReadyReviewers(asset.reviewers).length === 0) {
                return false;
            }

            if (moreFilter === 'latest' && !asset.isLatestRevision) {
                return false;
            }

            if (moreFilter === 'approved' && asset.approvalStatus !== 'APPROVED') {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                asset.originalName,
                asset.approvalTitle,
                asset.eventName,
                asset.category,
                ...asset.tags,
            ].some((value) => value?.toLowerCase().includes(query));
        });

        return [...valueFiltered].sort((left, right) => {
            if (sortBy === 'oldest') {
                return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
            }

            if (sortBy === 'largest') {
                return right.size - left.size;
            }

            if (sortBy === 'smallest') {
                return left.size - right.size;
            }

            if (sortBy === 'name') {
                return left.originalName.localeCompare(right.originalName);
            }

            return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        });
    }, [activeCategory, assets, dateFilter, kindFilter, moreFilter, searchValue, sortBy, tagFilter]);

    useEffect(() => {
        if (filteredAssets.length === 0) {
            setSelectedAssetId(null);
            setSelectedAssetIds([]);
            return;
        }

        setSelectedAssetId((current) => (
            filteredAssets.some((asset) => asset.id === current) ? current : filteredAssets[0].id
        ));

        setSelectedAssetIds((current) => {
            const validIds = current.filter((id) => filteredAssets.some((asset) => asset.id === id));
            return validIds.length > 0 ? validIds : [filteredAssets[0].id];
        });
    }, [filteredAssets]);

    const selectedAsset = filteredAssets.find((asset) => asset.id === selectedAssetId) || null;

    useEffect(() => {
        if (!selectedAsset || assetMetrics[selectedAsset.id]) {
            return;
        }

        if (selectedAsset.kind === 'image') {
            const image = new window.Image();
            image.onload = () => {
                setAssetMetrics((current) => ({
                    ...current,
                    [selectedAsset.id]: {
                        dimensions: `${image.naturalWidth} × ${image.naturalHeight}`,
                    },
                }));
            };
            image.src = selectedAsset.s3Url;
        } else if (selectedAsset.kind === 'video') {
            const video = document.createElement('video');
            video.onloadedmetadata = () => {
                setAssetMetrics((current) => ({
                    ...current,
                    [selectedAsset.id]: {
                        dimensions: `${video.videoWidth} × ${video.videoHeight}`,
                    },
                }));
            };
            video.src = selectedAsset.s3Url;
        }
    }, [assetMetrics, selectedAsset]);

    const selectedAssets = useMemo(
        () => filteredAssets.filter((asset) => selectedAssetIds.includes(asset.id)),
        [filteredAssets, selectedAssetIds]
    );

    const handleUploadIntent = async (files = []) => {
        if (files.length === 0) {
            return;
        }

        const payload = new FormData();
        files.forEach((file) => payload.append('files', file));

        try {
            setUploading(true);
            const response = await api.upload('/assets', payload);
            const uploadedAssets = extractDirectAssets(response);
            setDirectAssets((current) => [...uploadedAssets, ...current]);
            setError('');
            toast.success(`${files.length} file${files.length === 1 ? '' : 's'} uploaded to the asset library.`);
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError.message || 'Failed to upload asset.');
            toast.error('Failed to upload asset.');
        } finally {
            setUploading(false);
        }
    };

    const toggleSelection = (assetId) => {
        setSelectedAssetIds((current) => (
            current.includes(assetId)
                ? current.filter((id) => id !== assetId)
                : [...current, assetId]
        ));
    };

    const copyText = async (value, label) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(label);
        } catch {
            toast.error('Clipboard unavailable');
        }
    };

    const copyShareLinks = (singleValue = null) => {
        if (singleValue) {
            copyText(singleValue, 'Review link copied');
            return;
        }

        const links = getShareReadyReviewers(selectedAsset?.reviewers)
            .map((reviewer) => `${reviewer.name || reviewer.email}: ${reviewer.reviewUrl}`)
            .join('\n');

        if (!links) {
            toast.error('No external review links available for this asset.');
            return;
        }

        copyText(links, 'Review links copied');
    };

    const shareSelectedAsset = () => {
        const shareReady = getShareReadyReviewers(selectedAsset?.reviewers);
        if (shareReady.length > 0) {
            copyShareLinks();
            return;
        }

        copyText(selectedAsset?.s3Url || '', 'Signed asset URL copied');
    };

    const downloadSelected = () => {
        if (selectedAssets.length === 0) {
            toast.error('Select at least one asset to download.');
            return;
        }

        selectedAssets.forEach((asset) => {
            window.open(asset.s3Url, '_blank', 'noopener,noreferrer');
        });
        toast.success(`Opening ${selectedAssets.length} asset${selectedAssets.length === 1 ? '' : 's'}.`);
    };

    const emptyState = (
        <DashboardEmptyState
            isDark={isDark}
            title="No assets match these filters"
            description="Widen the filter set, switch categories, or upload files directly to this library."
            action={(
                <DashboardButton isDark={isDark} onClick={() => uploadInputRef.current?.click()} disabled={uploading}>
                    <Upload className="h-4 w-4" />
                    Upload Files
                </DashboardButton>
            )}
        />
    );

    return (
        <DashboardPage className="mx-auto max-w-[1720px] space-y-6">
            <DashboardPageHeader
                isDark={isDark}
                title="Asset Library"
                description="Browse, organize, and download assets promoted from fully approved creative reviews."
                className="min-h-[132px]"
                descriptionClassName="text-base"
                badges={(
                    <>
                        <DashboardChip isDark={isDark}>{assets.length} approved assets</DashboardChip>
                        <DashboardChip isDark={isDark}>{selectedAssetIds.length} selected</DashboardChip>
                        {refreshing ? <DashboardChip isDark={isDark}>Refreshing</DashboardChip> : null}
                        {uploading ? <DashboardChip isDark={isDark}>Uploading</DashboardChip> : null}
                    </>
                )}
            />

            <DashboardSection
                isDark={isDark}
                accent="violet"
                title={null}
                description={null}
                className="overflow-visible"
            >
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                    <div className="flex flex-1 flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
                        <div className="relative min-w-[280px] flex-1">
                            <Search className={cn('pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2', uiTheme.textMuted)} />
                            <DashboardTextInput
                                isDark={isDark}
                                aria-label="Search assets"
                                value={searchValue}
                                onChange={(event) => setSearchValue(event.target.value)}
                                placeholder="Search assets..."
                                className="pl-11"
                            />
                        </div>
                        <DashboardSelect
                            isDark={isDark}
                            aria-label="Asset collection filter"
                            value={activeCategory}
                            onChange={(event) => setActiveCategory(event.target.value)}
                            className="min-w-[160px]"
                        >
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.label}
                                </option>
                            ))}
                        </DashboardSelect>
                        <DashboardSelect
                            isDark={isDark}
                            aria-label="Asset type filter"
                            value={kindFilter}
                            onChange={(event) => setKindFilter(event.target.value)}
                            className="min-w-[132px]"
                        >
                            {TYPE_OPTIONS.map((option) => (
                                <option key={option.label} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </DashboardSelect>
                        <DashboardSelect
                            isDark={isDark}
                            aria-label="Asset tag filter"
                            value={tagFilter}
                            onChange={(event) => setTagFilter(event.target.value)}
                            className="min-w-[132px]"
                        >
                            <option value="">Tags</option>
                            {tagOptions.map((tag) => (
                                <option key={tag} value={tag}>
                                    {tag}
                                </option>
                            ))}
                        </DashboardSelect>
                        <DashboardSelect
                            isDark={isDark}
                            aria-label="Asset date filter"
                            value={dateFilter}
                            onChange={(event) => setDateFilter(event.target.value)}
                            className="min-w-[132px]"
                        >
                            {DATE_OPTIONS.map((option) => (
                                <option key={option.label} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </DashboardSelect>
                        <DashboardSelect
                            isDark={isDark}
                            aria-label="More asset filters"
                            value={moreFilter}
                            onChange={(event) => setMoreFilter(event.target.value)}
                            className="min-w-[148px]"
                        >
                            {MORE_FILTER_OPTIONS.map((option) => (
                                <option key={option.label} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </DashboardSelect>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <DashboardSelect
                            isDark={isDark}
                            aria-label="Sort assets"
                            value={sortBy}
                            onChange={(event) => setSortBy(event.target.value)}
                            className="min-w-[160px]"
                        >
                            {SORT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    Sort by: {option.label}
                                </option>
                            ))}
                        </DashboardSelect>
                        <div className={cn('flex items-center gap-2 rounded-md border p-1', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
                            <DashboardIconButton
                                isDark={isDark}
                                aria-label="Grid view"
                                className={cn('h-9 w-9', viewMode === 'grid' && 'bg-white/10 text-white')}
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </DashboardIconButton>
                            <DashboardIconButton
                                isDark={isDark}
                                aria-label="List view"
                                className={cn('h-9 w-9', viewMode === 'list' && 'bg-white/10 text-white')}
                                onClick={() => setViewMode('list')}
                            >
                                <List className="h-4 w-4" />
                            </DashboardIconButton>
                        </div>
                        <DashboardButton isDark={isDark} onClick={() => uploadInputRef.current?.click()} disabled={uploading}>
                            <Upload className="h-4 w-4" />
                            {uploading ? 'Uploading' : 'Upload Files'}
                        </DashboardButton>
                        <DashboardButton isDark={isDark} variant="secondary" onClick={() => toast.success('Folder organization is not wired yet. This stays in the flat library for now.')}>
                            <Plus className="h-4 w-4" />
                            New Folder
                        </DashboardButton>
                        <DashboardButton isDark={isDark} variant="primary" onClick={downloadSelected} disabled={selectedAssetIds.length === 0}>
                            <Download className="h-4 w-4" />
                            Download Selected ({selectedAssetIds.length})
                        </DashboardButton>
                        <DashboardIconButton isDark={isDark} aria-label="Refresh assets" onClick={() => loadAssets({ background: true })}>
                            <RefreshCcw className="h-4 w-4" />
                        </DashboardIconButton>
                    </div>
                </div>

                <input
                    ref={uploadInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                        const files = Array.from(event.target.files || []);
                        handleUploadIntent(files);
                        event.target.value = '';
                    }}
                />

                {error ? (
                    <div className={cn('mt-4 rounded-md border px-4 py-3 text-sm', isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700')}>
                        {error}
                    </div>
                ) : null}

                {loading ? (
                    <div className="mt-6 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
                        <DashboardSurface isDark={isDark} accent="slate" className="h-[680px] animate-pulse" />
                        <DashboardSurface isDark={isDark} accent="violet" className="h-[680px] animate-pulse" />
                        <DashboardSurface isDark={isDark} accent="brand" className="h-[680px] animate-pulse" />
                    </div>
                ) : filteredAssets.length === 0 ? (
                    <div className="mt-6">{emptyState}</div>
                ) : (
                    <div className="mt-6 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
                        <CategoryRail
                            categories={categories}
                            activeCategory={activeCategory}
                            onSelect={setActiveCategory}
                            isDark={isDark}
                            totalSize={totalLibrarySize}
                        />

                        <div className="space-y-5">
                            <DashboardSurface
                                isDark={isDark}
                                accent="violet"
                                className={cn(
                                    'border-dashed p-8 text-center transition',
                                    isDraggingUpload && 'border-fuchsia-400/60 bg-fuchsia-500/10'
                                )}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setIsDraggingUpload(true);
                                }}
                                onDragLeave={(event) => {
                                    event.preventDefault();
                                    setIsDraggingUpload(false);
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setIsDraggingUpload(false);
                                    handleUploadIntent(Array.from(event.dataTransfer.files || []));
                                }}
                            >
                                <div className="mx-auto max-w-xl">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-fuchsia-300">
                                        <Upload className="h-7 w-7" />
                                    </div>
                                    <h3 className={cn('mt-4 text-2xl font-light tracking-tight', uiTheme.textPrimary)}>
                                        Drag and drop files here
                                    </h3>
                                    <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                                        PNG, JPG, GIF, MP4, MOV, PDF. Files upload directly to this library.
                                    </p>
                                    <DashboardButton isDark={isDark} className="mt-5" onClick={() => uploadInputRef.current?.click()} disabled={uploading}>
                                        {uploading ? 'Uploading' : 'Browse Files'}
                                    </DashboardButton>
                                </div>
                            </DashboardSurface>

                            {viewMode === 'grid' ? (
                                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                    {filteredAssets.map((asset) => (
                                        <AssetCard
                                            key={asset.id}
                                            asset={asset}
                                            isDark={isDark}
                                            isActive={asset.id === selectedAssetId}
                                            isSelected={selectedAssetIds.includes(asset.id)}
                                            onActivate={setSelectedAssetId}
                                            onToggleSelection={toggleSelection}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <DashboardSurface isDark={isDark} accent={null} className="overflow-hidden">
                                    <div className={cn('grid grid-cols-[44px_72px_minmax(0,1.5fr)_0.8fr_0.8fr_0.9fr_40px] gap-3 border-b px-4 py-3 text-[11px] uppercase tracking-[0.16em]', isDark ? cn('border-white/10', uiTheme.textMuted) : 'border-slate-200 text-slate-400')}>
                                        <span>Select</span>
                                        <span>Preview</span>
                                        <span>Name</span>
                                        <span>Type</span>
                                        <span>Size</span>
                                        <span>Status</span>
                                        <span />
                                    </div>
                                    {filteredAssets.map((asset) => (
                                        <AssetRow
                                            key={asset.id}
                                            asset={asset}
                                            isDark={isDark}
                                            isActive={asset.id === selectedAssetId}
                                            isSelected={selectedAssetIds.includes(asset.id)}
                                            onActivate={setSelectedAssetId}
                                            onToggleSelection={toggleSelection}
                                        />
                                    ))}
                                </DashboardSurface>
                            )}
                        </div>

                        <AssetInspector
                            asset={selectedAsset}
                            isDark={isDark}
                            metrics={selectedAsset ? assetMetrics[selectedAsset.id] : null}
                            onOpen={() => window.open(selectedAsset?.s3Url, '_blank', 'noopener,noreferrer')}
                            onCopyAssetLink={() => copyText(selectedAsset?.s3Url || '', 'Signed asset URL copied')}
                            onCopyShareLinks={copyShareLinks}
                            onShare={shareSelectedAsset}
                            onMove={() => toast.success('Move is not connected yet. Use categories and approvals to keep assets organized.')}
                            onDelete={() => toast.error('Delete is not available from the library yet.')}
                        />
                    </div>
                )}
            </DashboardSection>
        </DashboardPage>
    );
};

export default AssetLibraryView;
