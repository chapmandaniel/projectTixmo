import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    CalendarDays,
    ChevronDown,
    ChevronRight,
    Copy,
    Download,
    ExternalLink,
    FileImage,
    FileText,
    FolderPlus,
    FolderOpen,
    LayoutGrid,
    Link2,
    List,
    Plus,
    RefreshCcw,
    Search,
    ShieldCheck,
    Sparkles,
    Trash2,
    Upload,
    Video,
    X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardIconButton,
    DashboardPage,
    DashboardPageHeader,
    DashboardSelect,
    DashboardSurface,
    DashboardTextInput,
} from '../components/dashboard/DashboardPrimitives';
import { api } from '../lib/api';
import { getDashboardTheme } from '../lib/dashboardTheme';
import { cn } from '../lib/utils';

const ROOT_FOLDER_ID = 'root';
const BRAND_COLLECTION_KEY = 'brand';
const UNASSIGNED_COLLECTION_KEY = 'unassigned';
const KEYWORD_CATEGORY_RULES = [
    { id: 'posters', patterns: ['poster', 'flyer', 'banner'] },
    { id: 'logos', patterns: ['logo', 'wordmark', 'lockup'] },
    { id: 'social', patterns: ['social', 'story', 'carousel', 'tile', 'post'] },
];

const TYPE_OPTIONS = [
    { value: '', label: 'Type' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Video' },
    { value: 'document', label: 'Documents' },
    { value: 'file', label: 'Other files' },
];

const SORT_OPTIONS = [
    { value: 'likely', label: 'Likely used' },
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'largest', label: 'Largest' },
    { value: 'smallest', label: 'Smallest' },
    { value: 'name', label: 'Name A-Z' },
];

const extractApprovals = (response) => response?.approvals || response?.data?.approvals || [];
const extractDirectAssets = (response) => response?.assets || response?.data?.assets || [];
const extractFolders = (response) => response?.folders || response?.data?.folders || [];
const extractShares = (response) => response?.shares || response?.data?.shares || [];

const SHARE_EXPIRY_OPTIONS = [
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
    { value: 60, label: '60 days' },
    { value: 90, label: '90 days' },
];

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

const formatUserName = (user) => {
    const first = user?.firstName?.trim() || '';
    const last = user?.lastName?.trim() || '';
    const joined = `${first} ${last}`.trim();
    return joined || user?.email || 'Unknown uploader';
};

const getEventCollectionKey = (eventId) => `event:${eventId}`;
const getCollectionFolderId = (collectionKey) => `collection:${collectionKey}`;
const getCategoryFolderId = (collectionKey, category) => `collection:${collectionKey}:category:${category}`;

const normalizeUsageType = (value, eventId = '') => {
    const usageType = String(value || '').trim().toUpperCase();

    if (usageType === 'EVENT' || eventId) {
        return 'EVENT';
    }

    return 'BRAND';
};

const getCollectionMeta = ({ usageType, eventId, eventName }) => {
    if (usageType === 'EVENT') {
        if (eventId) {
            return {
                collectionKey: getEventCollectionKey(eventId),
                collectionLabel: eventName || 'Untitled event',
                collectionType: 'EVENT',
            };
        }

        return {
            collectionKey: UNASSIGNED_COLLECTION_KEY,
            collectionLabel: 'Unassigned event',
            collectionType: 'EVENT',
        };
    }

    return {
        collectionKey: BRAND_COLLECTION_KEY,
        collectionLabel: 'Brand library',
        collectionType: 'BRAND',
    };
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
        asset.collectionLabel,
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
                const eventId = approval.event?.id || '';
                const eventName = approval.event?.name || 'Unassigned event';
                const collectionMeta = getCollectionMeta({
                    usageType: 'EVENT',
                    eventId,
                    eventName,
                });
                const item = {
                    id: asset.id,
                    approvalId: approval.id,
                    approvalTitle: approval.title || 'Untitled approval',
                    approvalStatus: approval.status || 'PENDING_REVIEW',
                    approvalDescription: approval.description || '',
                    eventId,
                    eventName,
                    ...collectionMeta,
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
    const eventId = asset.event?.id || asset.eventId || '';
    const eventName = asset.event?.name || '';
    const usageType = normalizeUsageType(asset.usageType, eventId);
    const collectionMeta = getCollectionMeta({
        usageType,
        eventId,
        eventName,
    });
    const item = {
        id: `direct-${asset.id}`,
        directAssetId: asset.id,
        folderId: asset.folderId || asset.folder?.id || '',
        folder: asset.folder || null,
        approvalId: '',
        approvalTitle: 'Direct library upload',
        approvalStatus: 'APPROVED',
        approvalDescription: 'Creative asset uploaded directly to the asset library.',
        eventId,
        eventName: collectionMeta.collectionType === 'BRAND' ? 'Brand library' : collectionMeta.collectionLabel,
        ...collectionMeta,
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

const buildCollectionFilters = (assets, persistedFolders = []) => {
    const folderMap = new Map();

    const ensureFolder = (folder) => {
        if (folderMap.has(folder.id)) {
            const existingFolder = folderMap.get(folder.id);
            Object.assign(existingFolder, {
                ...folder,
                count: existingFolder.count,
                directCount: existingFolder.directCount,
                childIds: existingFolder.childIds,
                lastUsedAt: Math.max(existingFolder.lastUsedAt || 0, folder.lastUsedAt || 0),
            });
            return existingFolder;
        }

        const nextFolder = {
            count: 0,
            directCount: 0,
            childIds: [],
            ...folder,
        };

        folderMap.set(folder.id, nextFolder);

        return nextFolder;
    };

    const ensureCollectionFolder = ({ collectionKey, collectionLabel, collectionType, lastUsedAt = 0 }) => ensureFolder({
        id: getCollectionFolderId(collectionKey),
        label: collectionLabel || 'Unassigned event',
        type: collectionType || 'EVENT',
        icon: collectionKey === BRAND_COLLECTION_KEY ? Sparkles : collectionKey === UNASSIGNED_COLLECTION_KEY ? FolderOpen : CalendarDays,
        parentId: ROOT_FOLDER_ID,
        depth: 1,
        collectionKey,
        source: 'virtual',
        lastUsedAt,
    });

    ensureFolder({
        id: ROOT_FOLDER_ID,
        label: 'All assets',
        type: 'ROOT',
        icon: FolderOpen,
        parentId: null,
        depth: 0,
        source: 'virtual',
        lastUsedAt: 0,
    });

    persistedFolders.forEach((folder) => {
        const usageType = normalizeUsageType(folder.usageType, folder.eventId);
        const eventName = folder.event?.name || '';
        const collectionMeta = getCollectionMeta({
            usageType,
            eventId: folder.eventId || '',
            eventName,
        });
        const collectionFolder = ensureCollectionFolder(collectionMeta);

        ensureFolder({
            id: folder.id,
            label: folder.name || 'Untitled folder',
            type: 'FOLDER',
            icon: FolderOpen,
            parentId: folder.parentId || ROOT_FOLDER_ID,
            persistedParentId: folder.parentId || '',
            depth: folder.parentId ? 3 : 2,
            collectionKey: collectionMeta.collectionKey,
            collectionLabel: collectionMeta.collectionLabel,
            collectionType: collectionMeta.collectionType,
            category: normalizeToken(folder.category || folder.name || 'folder'),
            source: 'persisted',
            eventId: folder.eventId || '',
            eventName: eventName || collectionMeta.collectionLabel,
            lastUsedAt: new Date(folder.createdAt).getTime() || 0,
        });
    });

    assets.forEach((asset) => {
        const collectionKey = asset.collectionKey || UNASSIGNED_COLLECTION_KEY;
        const collectionId = getCollectionFolderId(collectionKey);
        const category = normalizeToken(asset.category || 'uncategorized');
        const fallbackFolderId = getCategoryFolderId(collectionKey, category);
        const directFolderId = asset.folderId || fallbackFolderId;
        const createdAt = new Date(asset.createdAt).getTime();
        const lastUsedAt = Number.isNaN(createdAt) ? 0 : createdAt;

        const root = ensureFolder({
            id: ROOT_FOLDER_ID,
            label: 'All assets',
            type: 'ROOT',
            icon: FolderOpen,
            parentId: null,
            depth: 0,
            lastUsedAt: 0,
        });
        const collection = ensureCollectionFolder({
            collectionKey,
            collectionLabel: asset.collectionLabel || 'Unassigned event',
            collectionType: asset.collectionType || 'EVENT',
            lastUsedAt,
        });
        const directFolder = folderMap.has(directFolderId)
            ? folderMap.get(directFolderId)
            : ensureFolder({
            id: directFolderId,
            label: titleCase(category),
            type: 'CATEGORY',
            icon: FolderOpen,
            parentId: collectionId,
            depth: 2,
            collectionKey,
            category,
            source: 'virtual',
            lastUsedAt,
        });

        let currentFolder = directFolder;
        while (currentFolder) {
            currentFolder.count += 1;
            currentFolder.lastUsedAt = Math.max(currentFolder.lastUsedAt, lastUsedAt);
            currentFolder = currentFolder.parentId ? folderMap.get(currentFolder.parentId) : null;
        }
        directFolder.directCount += 1;
    });

    folderMap.forEach((folder) => {
        folder.childIds = [];
    });

    folderMap.forEach((folder) => {
        if (!folder.parentId || !folderMap.has(folder.parentId)) return;
        const parent = folderMap.get(folder.parentId);
        if (!parent.childIds.includes(folder.id)) {
            parent.childIds.push(folder.id);
        }
    });

    const updateDepth = (folderId, depth = 0) => {
        const folder = folderMap.get(folderId);
        if (!folder) return;
        folder.depth = depth;
        folder.childIds.forEach((childId) => updateDepth(childId, depth + 1));
    };

    updateDepth(ROOT_FOLDER_ID, 0);

    folderMap.forEach((folder) => {
        folder.childIds.sort((leftId, rightId) => {
            const left = folderMap.get(leftId);
            const right = folderMap.get(rightId);
            if (left?.type === 'BRAND' && right?.type !== 'BRAND') return -1;
            if (right?.type === 'BRAND' && left?.type !== 'BRAND') return 1;
            return (right?.count || 0) - (left?.count || 0) || (right?.lastUsedAt || 0) - (left?.lastUsedAt || 0) || (left?.label || '').localeCompare(right?.label || '');
        });
    });

    return folderMap;
};

const getAssetFolderIds = (asset, folderMap = null) => {
    const collectionKey = asset.collectionKey || UNASSIGNED_COLLECTION_KEY;
    const category = normalizeToken(asset.category || 'uncategorized');
    const collectionFolderId = getCollectionFolderId(collectionKey);
    const categoryFolderId = getCategoryFolderId(collectionKey, category);
    const directFolderId = asset.folderId && folderMap?.has(asset.folderId) ? asset.folderId : categoryFolderId;

    return {
        collectionFolderId,
        categoryFolderId,
        directFolderId,
        ancestorFolderIds: [ROOT_FOLDER_ID, collectionFolderId, categoryFolderId],
    };
};

const getFolderPathIds = (folderMap, folderId) => {
    const path = [];
    let current = folderMap.get(folderId);

    while (current) {
        path.unshift(current.id);
        current = current.parentId ? folderMap.get(current.parentId) : null;
    }

    return path.length > 0 ? path : [ROOT_FOLDER_ID];
};

const getFolderPath = (folderMap, folderId) => getFolderPathIds(folderMap, folderId)
    .map((pathId) => folderMap.get(pathId))
    .filter(Boolean);

const buildPersistedFolderOptions = (folderMap) => {
    const options = [];

    const visit = (folderId) => {
        const folder = folderMap.get(folderId);
        if (!folder) return;

        if (folder.source === 'persisted') {
            options.push(folder);
        }

        folder.childIds.forEach(visit);
    };

    visit(ROOT_FOLDER_ID);
    return options;
};

const assetBelongsToFolder = (asset, folderId, folderMap) => {
    if (folderId === ROOT_FOLDER_ID) return true;
    return getFolderPathIds(folderMap, getAssetFolderIds(asset, folderMap).directFolderId).includes(folderId);
};

const assetIsDirectlyInFolder = (asset, folderId, folderMap) => {
    if (folderId === ROOT_FOLDER_ID) return getFolderPathIds(folderMap, getAssetFolderIds(asset, folderMap).directFolderId).length <= 3;
    return getAssetFolderIds(asset, folderMap).directFolderId === folderId;
};

const buildRecentCategoryOptions = (assets) => {
    const categories = new Map();

    assets.forEach((asset) => {
        const category = normalizeToken(asset.category || '');
        if (!category) return;

        const createdAt = new Date(asset.createdAt).getTime();
        const current = categories.get(category) || {
            value: category,
            label: titleCase(category),
            count: 0,
            lastUsedAt: 0,
        };

        current.count += 1;
        current.lastUsedAt = Math.max(current.lastUsedAt, Number.isNaN(createdAt) ? 0 : createdAt);
        categories.set(category, current);
    });

    return [...categories.values()]
        .sort((left, right) => right.lastUsedAt - left.lastUsedAt || right.count - left.count || left.label.localeCompare(right.label))
        .slice(0, 8);
};

const getAssetLocationLabel = (asset) => asset.folder?.name || asset.collectionLabel || 'Asset library';

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

const AssetPreview = ({ asset, isDark, compact = false, fullscreen = false }) => {
    const kind = asset?.kind;
    const Icon = getAssetIcon(kind);

    return (
        <div
            className={cn(
                fullscreen
                    ? 'flex h-full w-full items-center justify-center overflow-hidden rounded-md'
                    : 'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border',
                fullscreen
                    ? 'bg-transparent'
                    : isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-100'
            )}
        >
            {!asset ? null : kind === 'image' ? (
                <img
                    src={asset.s3Url}
                    alt={asset.originalName}
                    className={cn('h-full w-full', fullscreen ? 'object-contain' : 'object-cover')}
                />
            ) : kind === 'video' ? (
                <video
                    src={asset.s3Url}
                    className={cn('h-full w-full', fullscreen ? 'object-contain' : 'object-cover')}
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

const FolderRail = ({
    activeFolderId,
    expandedFolderIds,
    folderMap,
    isDark,
    movingAssetId,
    onDropAsset,
    onSelect,
    onToggleFolder,
}) => {
    const uiTheme = getDashboardTheme(isDark);
    const visibleFolders = [];
    const expandedSet = new Set(expandedFolderIds);

    const pushFolder = (folderId) => {
        const folder = folderMap.get(folderId);
        if (!folder) return;

        visibleFolders.push(folder);
        if (folder.id === ROOT_FOLDER_ID || expandedSet.has(folder.id)) {
            folder.childIds.forEach(pushFolder);
        }
    };

    pushFolder(ROOT_FOLDER_ID);

    return (
        <DashboardSurface isDark={isDark} accent="slate" className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>Folders</p>
            </div>
            <div className="space-y-2">
                {visibleFolders.map((folder) => {
                    const active = folder.id === activeFolderId;
                    const Icon = active ? FolderOpen : folder.icon;
                    const hasChildren = folder.childIds.length > 0;
                    const expanded = folder.id === ROOT_FOLDER_ID || expandedSet.has(folder.id);
                    const canDrop = movingAssetId && folder.source === 'persisted';

                    return (
                        <div
                            key={folder.id}
                            onDragOver={(event) => {
                                if (!canDrop) return;
                                event.preventDefault();
                            }}
                            onDrop={(event) => {
                                if (!canDrop) return;
                                event.preventDefault();
                                onDropAsset(folder.id);
                            }}
                            className={cn(
                                'flex w-full items-center justify-between rounded-md border px-2 py-2 text-left transition',
                                active
                                    ? 'border-pink-400/40 bg-gradient-to-r from-fuchsia-500/20 to-violet-500/15 text-white'
                                    : isDark
                                        ? cn('border-transparent bg-transparent hover:border-white/10 hover:bg-white/5 hover:text-white', uiTheme.textSecondary)
                                        : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900',
                                canDrop && 'border-cyan-300/40 bg-cyan-400/10'
                            )}
                        >
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                                <button
                                    type="button"
                                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${folder.label}`}
                                    disabled={!hasChildren}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (hasChildren) {
                                            onToggleFolder(folder.id);
                                        }
                                    }}
                                    className={cn(
                                        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition',
                                        hasChildren
                                            ? isDark ? 'text-zinc-300 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                            : 'text-transparent'
                                    )}
                                >
                                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>
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
                                <button
                                    type="button"
                                    onClick={() => onSelect(folder.id)}
                                    className="min-w-0 flex-1 truncate text-left text-sm font-light"
                                    style={{ paddingLeft: `${Math.max(folder.depth - 1, 0) * 8}px` }}
                                >
                                    {folder.label}
                                </button>
                            </span>
                        </div>
                    );
                })}
            </div>
        </DashboardSurface>
    );
};

const FolderTile = ({ folder, isDark, movingAssetId, onDropAsset, onOpen }) => {
    const uiTheme = getDashboardTheme(isDark);
    const Icon = folder.type === 'BRAND' ? Sparkles : folder.type === 'EVENT' ? CalendarDays : FolderOpen;
    const canDrop = movingAssetId && folder.source === 'persisted';

    return (
        <DashboardSurface
            role="button"
            tabIndex={0}
            isDark={isDark}
            accent={folder.type === 'BRAND' ? 'brand' : folder.type === 'EVENT' ? 'violet' : 'slate'}
            interactive
            aria-label={`Open folder ${folder.label}`}
            onClick={() => onOpen(folder.id)}
            onDragOver={(event) => {
                if (!canDrop) return;
                event.preventDefault();
            }}
            onDrop={(event) => {
                if (!canDrop) return;
                event.preventDefault();
                onDropAsset(folder.id);
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen(folder.id);
                }
            }}
            className={cn('group overflow-hidden p-4 text-left', canDrop && 'ring-2 ring-cyan-400/40')}
        >
            <div className="flex items-start justify-between gap-3">
                <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-md', isDark ? 'bg-white/10 text-fuchsia-200' : 'bg-slate-100 text-slate-700')}>
                    <Icon className="h-5 w-5" />
                </span>
            </div>
            <div className="mt-4 min-w-0">
                <p className={cn('truncate text-base font-light', uiTheme.textPrimary)}>{folder.label}</p>
                <p className={cn('mt-1 text-sm font-light', uiTheme.textSecondary)}>
                    {folder.count} asset{folder.count === 1 ? '' : 's'}
                </p>
            </div>
        </DashboardSurface>
    );
};

const FolderWorkspaceHeader = ({
    activeFolder,
    creatingFolder,
    deletingFolder,
    folderMap,
    isDark,
    onCreate,
    onDeleteFolder,
    onShareFolder,
    onSelectFolder,
    onUpload,
    uploading,
}) => {
    const uiTheme = getDashboardTheme(isDark);
    const folderPath = getFolderPath(folderMap, activeFolder?.id || ROOT_FOLDER_ID);
    const isSavedFolder = activeFolder?.source === 'persisted';

    return (
        <DashboardSurface isDark={isDark} accent="violet" className="p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-light">
                        {folderPath.map((folder, index) => (
                            <React.Fragment key={folder.id}>
                                {index > 0 ? <span className={uiTheme.textMuted}>/</span> : null}
                                <button
                                    type="button"
                                    onClick={() => onSelectFolder(folder.id)}
                                    className={cn(
                                        'max-w-[180px] truncate transition',
                                        index === folderPath.length - 1
                                            ? uiTheme.textPrimary
                                            : cn(uiTheme.textSecondary, isDark ? 'hover:text-white' : 'hover:text-slate-900')
                                    )}
                                >
                                    {folder.label}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                        <h2 className={cn('truncate text-2xl font-light tracking-tight', uiTheme.textPrimary)}>
                            {activeFolder?.label || 'All assets'}
                        </h2>
                        <DashboardChip isDark={isDark}>
                            {activeFolder?.count || 0} asset{activeFolder?.count === 1 ? '' : 's'}
                        </DashboardChip>
                        {isSavedFolder ? (
                            <DashboardChip isDark={isDark}>Saved folder</DashboardChip>
                        ) : null}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {isSavedFolder ? (
                        <>
                            <DashboardButton isDark={isDark} variant="secondary" onClick={onShareFolder}>
                                <ShieldCheck className="h-4 w-4" />
                                Share Folder
                            </DashboardButton>
                            <DashboardButton isDark={isDark} variant="danger" onClick={onDeleteFolder} disabled={deletingFolder}>
                                <Trash2 className="h-4 w-4" />
                                {deletingFolder ? 'Deleting' : 'Delete Folder'}
                            </DashboardButton>
                        </>
                    ) : null}
                    <DashboardButton isDark={isDark} variant="secondary" onClick={onCreate} disabled={creatingFolder}>
                        <FolderPlus className="h-4 w-4" />
                        New Folder
                    </DashboardButton>
                    <DashboardButton isDark={isDark} onClick={onUpload} disabled={uploading}>
                        <Upload className="h-4 w-4" />
                        {uploading ? 'Uploading' : 'Upload Assets'}
                    </DashboardButton>
                </div>
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
    onDragEnd,
    onDragStart,
    onToggleSelection,
}) => (
    <DashboardSurface
        role="button"
        tabIndex={0}
        draggable={Boolean(asset.directAssetId)}
        isDark={isDark}
        accent={asset.kind === 'image' ? 'brand' : asset.kind === 'video' ? 'violet' : 'blue'}
        interactive
        aria-label={`Open asset ${asset.originalName}`}
        onClick={() => onActivate(asset.id)}
        onDragStart={(event) => {
            if (!asset.directAssetId) {
                event.preventDefault();
                return;
            }
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', asset.id);
            onDragStart(asset.id);
        }}
        onDragEnd={onDragEnd}
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
        </div>
        <div className="space-y-3 p-4">
            <div className="min-w-0">
                <p className={cn('truncate text-base font-light', isDark ? 'text-zinc-100' : 'text-slate-900')}>
                    {asset.originalName}
                </p>
                <p className={cn('mt-1 truncate text-sm font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
                    {getAssetLocationLabel(asset)}
                </p>
            </div>
            <div className={cn('space-y-1 text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
                <div className="flex items-center justify-between gap-3">
                    <span>{getAssetKindLabel(asset.kind)}</span>
                    <span>{formatFileSize(asset.size)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span>{asset.directAssetId ? 'Uploaded asset' : 'Library asset'}</span>
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
    onDragEnd,
    onDragStart,
    onToggleSelection,
}) => (
    <div
        role="button"
        tabIndex={0}
        draggable={Boolean(asset.directAssetId)}
        aria-label={`Open asset ${asset.originalName}`}
        onClick={() => onActivate(asset.id)}
        onDragStart={(event) => {
            if (!asset.directAssetId) {
                event.preventDefault();
                return;
            }
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', asset.id);
            onDragStart(asset.id);
        }}
        onDragEnd={onDragEnd}
        onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate(asset.id);
            }
        }}
        className={cn(
            'grid w-full grid-cols-[44px_72px_minmax(0,1.5fr)_0.7fr_0.7fr_0.8fr] items-center gap-3 border-b px-4 py-3 text-left transition last:border-b-0',
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
                {getAssetLocationLabel(asset)}
            </p>
        </div>
        <p className={cn('truncate text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
            {getAssetKindLabel(asset.kind)}
        </p>
        <p className={cn('truncate text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
            {formatFileSize(asset.size)}
        </p>
        <p className={cn('truncate text-xs font-light', isDark ? 'text-zinc-400' : 'text-slate-500')}>
            {formatDate(asset.createdAt)}
        </p>
    </div>
);

const AssetPreviewModal = ({
    asset,
    deletingAsset,
    isDark,
    metrics,
    onClose,
    onDeleteAsset,
    onOpen,
    onCopyAssetLink,
}) => {
    const uiTheme = getDashboardTheme(isDark);

    if (!asset) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-preview-title"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="flex h-full flex-col">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-6">
                    <DashboardSurface
                        isDark={isDark}
                        accent={null}
                        className="pointer-events-auto max-w-[min(720px,calc(100vw-7rem))] bg-black/45 px-4 py-3 backdrop-blur-md"
                    >
                        <h2 id="asset-preview-title" className={cn('truncate text-lg font-light tracking-tight sm:text-xl', uiTheme.textPrimary)}>
                            {asset.originalName}
                        </h2>
                        <p className={cn('mt-1 text-sm font-light', uiTheme.textSecondary)}>
                            {getAssetKindLabel(asset.kind)} • {formatFileSize(asset.size)}
                            {metrics?.dimensions ? ` • ${metrics.dimensions}` : ''}
                        </p>
                    </DashboardSurface>
                    <DashboardIconButton
                        isDark={isDark}
                        aria-label="Close asset preview"
                        onClick={onClose}
                        className="pointer-events-auto bg-black/45 backdrop-blur-md"
                    >
                        <X className="h-4 w-4" />
                    </DashboardIconButton>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-36 pt-24 sm:px-6 sm:pb-40 sm:pt-28">
                    <div className="h-full w-full">
                        <AssetPreview asset={asset} isDark={isDark} fullscreen />
                    </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6">
                    <DashboardSurface
                        isDark={isDark}
                        accent={null}
                        className="pointer-events-auto mx-auto w-full max-w-6xl bg-black/45 p-4 backdrop-blur-md sm:p-5"
                    >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <div className="grid gap-2 text-sm font-light sm:grid-cols-2 xl:grid-cols-4">
                                <div>
                                    <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textMuted)}>Uploaded</p>
                                    <p className={cn('mt-1', uiTheme.textPrimary)}>
                                        {formatDate(asset.createdAt, { hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div>
                                    <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textMuted)}>By</p>
                                    <p className={cn('mt-1 truncate', uiTheme.textPrimary)}>{asset.uploaderName}</p>
                                </div>
                                <div>
                                    <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textMuted)}>Folder</p>
                                    <p className={cn('mt-1 truncate', uiTheme.textPrimary)}>{getAssetLocationLabel(asset)}</p>
                                </div>
                                {metrics?.dimensions ? (
                                    <div>
                                        <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textMuted)}>Dimensions</p>
                                        <p className={cn('mt-1', uiTheme.textPrimary)}>{metrics.dimensions}</p>
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {asset.directAssetId ? (
                                    <DashboardButton isDark={isDark} variant="danger" onClick={onDeleteAsset} disabled={deletingAsset}>
                                        <Trash2 className="h-4 w-4" />
                                        {deletingAsset ? 'Deleting' : 'Delete Asset'}
                                    </DashboardButton>
                                ) : null}
                                <DashboardButton isDark={isDark} variant="secondary" onClick={onCopyAssetLink}>
                                    <Link2 className="h-4 w-4" />
                                    Copy asset link
                                </DashboardButton>
                                <DashboardButton isDark={isDark} onClick={onOpen}>
                                    <Download className="h-4 w-4" />
                                    Download
                                </DashboardButton>
                            </div>
                        </div>
                    </DashboardSurface>
                </div>
            </div>
        </div>
    );
};

const AssetUploadModal = ({
    files,
    folderOptions,
    isDark,
    isDragging,
    onAddFiles,
    onClose,
    onCreateFolder,
    onDropFiles,
    onRemoveFile,
    onSubmit,
    onToggleDragging,
    uploadFolderId,
    uploadInputRef,
    uploading,
    onFolderChange,
}) => {
    const uiTheme = getDashboardTheme(isDark);
    const selectedFolder = folderOptions.find((folder) => folder.id === uploadFolderId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="asset-upload-title">
            <DashboardSurface isDark={isDark} accent="violet" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 id="asset-upload-title" className={cn('text-2xl font-light tracking-tight', uiTheme.textPrimary)}>
                            Upload assets
                        </h2>
                        <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                            Choose the folder these files belong to. Create a folder first when the right destination does not exist yet.
                        </p>
                    </div>
                    <DashboardIconButton isDark={isDark} aria-label="Close upload modal" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </DashboardIconButton>
                </div>

                <div
                    className={cn(
                        'mt-5 rounded-md border border-dashed p-6 text-center transition',
                        isDragging
                            ? 'border-fuchsia-400/60 bg-fuchsia-500/10'
                            : isDark
                                ? 'border-white/15 bg-white/5'
                                : 'border-slate-200 bg-slate-50'
                    )}
                    onDragOver={(event) => {
                        event.preventDefault();
                        onToggleDragging(true);
                    }}
                    onDragLeave={(event) => {
                        event.preventDefault();
                        onToggleDragging(false);
                    }}
                    onDrop={(event) => {
                        event.preventDefault();
                        onToggleDragging(false);
                        onDropFiles(Array.from(event.dataTransfer.files || []));
                    }}
                >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-fuchsia-300">
                        <Upload className="h-6 w-6" />
                    </div>
                    <p className={cn('mt-3 text-lg font-light', uiTheme.textPrimary)}>Drop files here</p>
                    <p className={cn('mt-1 text-sm font-light', uiTheme.textSecondary)}>PNG, JPG, GIF, MP4, MOV, WEBP, or PDF.</p>
                    <DashboardButton isDark={isDark} className="mt-4" onClick={() => uploadInputRef.current?.click()} disabled={uploading}>
                        <Plus className="h-4 w-4" />
                        Add Files
                    </DashboardButton>
                    <input
                        ref={uploadInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                            onAddFiles(Array.from(event.target.files || []));
                            event.target.value = '';
                        }}
                    />
                </div>

                {files.length > 0 ? (
                    <div className="mt-4 space-y-2">
                        {files.map((file, index) => (
                            <div
                                key={`${file.name}-${file.size}-${index}`}
                                className={cn('flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white')}
                            >
                                <div className="min-w-0">
                                    <p className={cn('truncate font-light', uiTheme.textPrimary)}>{file.name}</p>
                                    <p className={cn('text-xs font-light', uiTheme.textSecondary)}>{formatFileSize(file.size)}</p>
                                </div>
                                <DashboardIconButton isDark={isDark} aria-label={`Remove ${file.name}`} className="h-8 w-8" onClick={() => onRemoveFile(index)}>
                                    <X className="h-3.5 w-3.5" />
                                </DashboardIconButton>
                            </div>
                        ))}
                    </div>
                ) : null}

                <div className="mt-5">
                        <div className="flex items-center justify-between gap-3">
                            <label className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)} htmlFor="asset-upload-folder">
                                Destination folder
                            </label>
                            <button
                                type="button"
                                onClick={onCreateFolder}
                                className={cn('inline-flex items-center gap-1.5 text-xs font-light transition', isDark ? 'text-fuchsia-200 hover:text-white' : 'text-slate-600 hover:text-slate-900')}
                            >
                                <FolderPlus className="h-3.5 w-3.5" />
                                Create folder
                            </button>
                        </div>
                        <DashboardSelect
                            id="asset-upload-folder"
                            isDark={isDark}
                            aria-label="Upload folder"
                            value={uploadFolderId}
                            onChange={(event) => onFolderChange(event.target.value)}
                            className="mt-2"
                        >
                            <option value="">Choose a folder...</option>
                            {folderOptions.map((folder) => (
                                <option key={folder.id} value={folder.id}>
                                    {'  '.repeat(Math.max(folder.depth - 2, 0) * 2)}{folder.label}
                                </option>
                            ))}
                        </DashboardSelect>
                    {selectedFolder ? (
                        <p className={cn('mt-2 text-xs font-light', uiTheme.textSecondary)}>
                            Files will be added to {selectedFolder.label}.
                        </p>
                    ) : (
                        <p className={cn('mt-2 text-xs font-light', uiTheme.textSecondary)}>
                            Uploads require a saved folder so assets remain browsable later.
                        </p>
                    )}
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <DashboardButton isDark={isDark} variant="secondary" onClick={onClose}>
                        Cancel
                    </DashboardButton>
                    <DashboardButton isDark={isDark} onClick={onSubmit} disabled={uploading || files.length === 0 || !uploadFolderId}>
                        <Upload className="h-4 w-4" />
                        {uploading ? 'Uploading' : `Upload ${files.length || ''} Asset${files.length === 1 ? '' : 's'}`}
                    </DashboardButton>
                </div>
            </DashboardSurface>
        </div>
    );
};

const CreateFolderModal = ({
    activeFolder,
    folderOptions,
    folderName,
    folderParentId,
    isDark,
    onClose,
    onNameChange,
    onParentChange,
    onSubmit,
    saving,
}) => {
    const uiTheme = getDashboardTheme(isDark);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="asset-create-folder-title">
            <DashboardSurface isDark={isDark} accent="brand" className="w-full max-w-xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 id="asset-create-folder-title" className={cn('text-2xl font-light tracking-tight', uiTheme.textPrimary)}>
                            Create folder
                        </h2>
                        <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                            Choose the location first, then name the folder so it appears in the right part of the library.
                        </p>
                    </div>
                    <DashboardIconButton isDark={isDark} aria-label="Close create folder modal" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </DashboardIconButton>
                </div>

                <div className="mt-5 space-y-4">
                    <div>
                        <label className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)} htmlFor="asset-folder-parent">
                            Location
                        </label>
                        <DashboardSelect
                            id="asset-folder-parent"
                            isDark={isDark}
                            aria-label="Folder location"
                            value={folderParentId}
                            onChange={(event) => onParentChange(event.target.value)}
                            className="mt-2"
                        >
                            <option value="">All assets</option>
                            {folderOptions.map((folder) => (
                                <option key={folder.id} value={folder.id}>
                                    {'  '.repeat(Math.max(folder.depth - 2, 0) * 2)}{folder.label}
                                </option>
                            ))}
                        </DashboardSelect>
                    </div>

                    <div>
                        <label className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)} htmlFor="asset-folder-name">
                            Folder name
                        </label>
                        <DashboardTextInput
                            id="asset-folder-name"
                            isDark={isDark}
                            aria-label="Folder name"
                            value={folderName}
                            onChange={(event) => onNameChange(event.target.value)}
                            placeholder="Example: Artist press photos"
                            className="mt-2"
                            autoFocus
                        />
                    </div>

                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <DashboardButton isDark={isDark} variant="secondary" onClick={onClose} disabled={saving}>
                        Cancel
                    </DashboardButton>
                    <DashboardButton isDark={isDark} onClick={onSubmit} disabled={saving || !folderName.trim()}>
                        <FolderPlus className="h-4 w-4" />
                        {saving ? 'Creating' : 'Create Folder'}
                    </DashboardButton>
                </div>
            </DashboardSurface>
        </div>
    );
};

const ShareFolderModal = ({
    activeFolder,
    creatingShare,
    expiresInDays,
    folderOptions,
    folderShares,
    isDark,
    loadingShares,
    onClose,
    onCopyShare,
    onCreateShare,
    onExpiresChange,
    onRecipientChange,
    onRevokeShare,
    onToggleFolderSelection,
    recipientLabel,
    revokingShareId,
    selectedFolderIds,
}) => {
    const uiTheme = getDashboardTheme(isDark);
    const activeShares = folderShares.filter((share) => share.active);
    const inactiveShares = folderShares.filter((share) => !share.active);
    const selectedFolderSet = new Set(selectedFolderIds);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="asset-share-folder-title">
            <DashboardSurface isDark={isDark} accent="violet" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 id="asset-share-folder-title" className={cn('text-2xl font-light tracking-tight', uiTheme.textPrimary)}>
                            Share {activeFolder?.label || 'folder'}
                        </h2>
                        <p className={cn('mt-2 text-sm font-light leading-6', uiTheme.textSecondary)}>
                            Create a private read-only link for people outside Tixmo Dash. Links expire automatically and can be revoked anytime.
                        </p>
                    </div>
                    <DashboardIconButton isDark={isDark} aria-label="Close share folder modal" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </DashboardIconButton>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                    <div>
                        <label className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)} htmlFor="asset-share-recipient">
                            Recipient label
                        </label>
                        <DashboardTextInput
                            id="asset-share-recipient"
                            isDark={isDark}
                            value={recipientLabel}
                            onChange={(event) => onRecipientChange(event.target.value)}
                            placeholder="Example: Venue partner"
                            className="mt-2"
                        />
                    </div>
                    <div>
                        <label className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)} htmlFor="asset-share-expiry">
                            Expires
                        </label>
                        <DashboardSelect
                            id="asset-share-expiry"
                            isDark={isDark}
                            value={expiresInDays}
                            onChange={(event) => onExpiresChange(Number(event.target.value))}
                            className="mt-2"
                        >
                            {SHARE_EXPIRY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </DashboardSelect>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <DashboardButton isDark={isDark} onClick={onCreateShare} disabled={creatingShare || selectedFolderIds.length === 0}>
                        <ShieldCheck className="h-4 w-4" />
                        {creatingShare ? 'Creating' : `Create secure link (${selectedFolderIds.length})`}
                    </DashboardButton>
                </div>

                <div className={cn('mt-6 border-t pt-5', uiTheme.divider)}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>
                            Folders in this link
                        </p>
                        <DashboardChip isDark={isDark}>
                            {selectedFolderIds.length} selected
                        </DashboardChip>
                    </div>
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {folderOptions.map((folder) => {
                            const checked = selectedFolderSet.has(folder.id);
                            return (
                                <label
                                    key={folder.id}
                                    className={cn(
                                        'flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 transition',
                                        checked
                                            ? isDark ? 'border-fuchsia-400/40 bg-fuchsia-500/10' : 'border-slate-300 bg-slate-100'
                                            : isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-slate-200 bg-white hover:bg-slate-50'
                                    )}
                                >
                                    <span className="flex min-w-0 items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => onToggleFolderSelection(folder.id)}
                                            className="h-4 w-4 rounded border-dashboard-border bg-dashboard-panel text-dashboard-accent focus:ring-dashboard-accent/40"
                                        />
                                        <span className="min-w-0">
                                            <span className={cn('block truncate text-sm font-light', uiTheme.textPrimary)}>
                                                {'  '.repeat(Math.max(folder.depth - 2, 0))}{folder.label}
                                            </span>
                                            <span className={cn('block text-xs font-light', uiTheme.textSecondary)}>
                                                {folder.count || 0} asset{folder.count === 1 ? '' : 's'}
                                            </span>
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <div className={cn('mt-6 border-t pt-5', uiTheme.divider)}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>
                            Active links
                        </p>
                        {loadingShares ? <DashboardChip isDark={isDark}>Loading</DashboardChip> : <DashboardChip isDark={isDark}>{activeShares.length} active</DashboardChip>}
                    </div>

                    {loadingShares ? (
                        <div className={cn('rounded-md border p-4 text-sm font-light', isDark ? 'border-white/10 bg-white/5 text-zinc-300' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                            Loading folder links...
                        </div>
                    ) : activeShares.length === 0 ? (
                        <div className={cn('rounded-md border p-4 text-sm font-light', isDark ? 'border-white/10 bg-white/5 text-zinc-300' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                            No active links for this folder.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeShares.map((share) => (
                                <div key={share.id} className={cn('rounded-md border p-4', isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white')}>
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0">
                                            <p className={cn('truncate text-sm font-light', uiTheme.textPrimary)}>
                                                {share.recipientLabel || 'Shared folder link'}
                                            </p>
                                            <p className={cn('mt-1 text-xs font-light', uiTheme.textSecondary)}>
                                                {share.folderCount || 1} folder{share.folderCount === 1 ? '' : 's'} • Expires {formatDate(share.expiresAt)} • {share.viewCount || 0} view{share.viewCount === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {share.shareUrl ? (
                                                <>
                                                    <DashboardIconButton isDark={isDark} aria-label="Copy folder share link" onClick={() => onCopyShare(share.shareUrl)}>
                                                        <Copy className="h-4 w-4" />
                                                    </DashboardIconButton>
                                                    <DashboardIconButton isDark={isDark} aria-label="Open folder share link" onClick={() => window.open(share.shareUrl, '_blank', 'noopener,noreferrer')}>
                                                        <ExternalLink className="h-4 w-4" />
                                                    </DashboardIconButton>
                                                </>
                                            ) : null}
                                            <DashboardButton isDark={isDark} variant="danger" onClick={() => onRevokeShare(share.id)} disabled={revokingShareId === share.id}>
                                                <Trash2 className="h-4 w-4" />
                                                {revokingShareId === share.id ? 'Revoking' : 'Revoke'}
                                            </DashboardButton>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {inactiveShares.length > 0 ? (
                        <p className={cn('mt-4 text-xs font-light', uiTheme.textSecondary)}>
                            {inactiveShares.length} expired or revoked link{inactiveShares.length === 1 ? '' : 's'} hidden from active sharing.
                        </p>
                    ) : null}
                </div>
            </DashboardSurface>
        </div>
    );
};

const AssetLibraryView = ({ isDark }) => {
    const uiTheme = getDashboardTheme(isDark);
    const uploadInputRef = useRef(null);
    const [approvals, setApprovals] = useState([]);
    const [directAssets, setDirectAssets] = useState([]);
    const [libraryFolders, setLibraryFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [searchValue, setSearchValue] = useState('');
    const [activeFolderId, setActiveFolderId] = useState(ROOT_FOLDER_ID);
    const [kindFilter, setKindFilter] = useState('');
    const [sortBy, setSortBy] = useState('likely');
    const [viewMode, setViewMode] = useState('grid');
    const [selectedAssetId, setSelectedAssetId] = useState(null);
    const [previewAssetId, setPreviewAssetId] = useState(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState([]);
    const [assetMetrics, setAssetMetrics] = useState({});
    const [expandedFolderIds, setExpandedFolderIds] = useState([ROOT_FOLDER_ID]);
    const [draggingAssetId, setDraggingAssetId] = useState('');
    const [movingAssetId, setMovingAssetId] = useState('');
    const [deletingAssetId, setDeletingAssetId] = useState('');
    const [deletingFolderId, setDeletingFolderId] = useState('');
    const [uploadEventId, setUploadEventId] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadCategory, setUploadCategory] = useState('');
    const [uploadFolderId, setUploadFolderId] = useState('');
    const [isDraggingUploadModal, setIsDraggingUploadModal] = useState(false);
    const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [folderParentId, setFolderParentId] = useState('');
    const [showShareModal, setShowShareModal] = useState(false);
    const [folderShares, setFolderShares] = useState([]);
    const [loadingShares, setLoadingShares] = useState(false);
    const [creatingShare, setCreatingShare] = useState(false);
    const [revokingShareId, setRevokingShareId] = useState('');
    const [shareRecipientLabel, setShareRecipientLabel] = useState('');
    const [shareExpiresInDays, setShareExpiresInDays] = useState(14);
    const [shareFolderIds, setShareFolderIds] = useState([]);

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
            setLibraryFolders(extractFolders(directAssetsResponse.value));
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
    const folderMap = useMemo(() => buildCollectionFilters(assets, libraryFolders), [assets, libraryFolders]);
    const recentCategories = useMemo(() => buildRecentCategoryOptions(assets), [assets]);
    const collectionStats = useMemo(() => (
        [...folderMap.values()].reduce((stats, folder) => ({
            ...stats,
            [folder.id]: folder,
        }), {})
    ), [folderMap]);
    const activeFolder = folderMap.get(activeFolderId) || folderMap.get(ROOT_FOLDER_ID);
    const childFolders = useMemo(() => (
        (activeFolder?.childIds || []).map((folderId) => folderMap.get(folderId)).filter(Boolean)
    ), [activeFolder, folderMap]);
    const persistedFolderOptions = useMemo(() => (
        buildPersistedFolderOptions(folderMap)
    ), [folderMap]);

    useEffect(() => {
        if (!folderMap.has(activeFolderId)) {
            setActiveFolderId(ROOT_FOLDER_ID);
        }
    }, [activeFolderId, folderMap]);

    const loadFolderShares = async (folderId) => {
        if (!folderId) {
            setFolderShares([]);
            return;
        }

        try {
            setLoadingShares(true);
            const response = await api.get(`/assets/folders/${folderId}/shares`);
            setFolderShares(extractShares(response));
        } catch (requestError) {
            setFolderShares([]);
            setError(requestError?.response?.data?.message || requestError.message || 'Failed to load folder sharing links.');
        } finally {
            setLoadingShares(false);
        }
    };

    useEffect(() => {
        if (activeFolder?.source !== 'persisted') {
            setFolderShares([]);
            return;
        }

        loadFolderShares(activeFolder.id);
    }, [activeFolder?.id, activeFolder?.source]);

    const filteredAssets = useMemo(() => {
        const query = searchValue.trim().toLowerCase();

        const folderFiltered = assets.filter((asset) => (
            query ? assetBelongsToFolder(asset, activeFolderId, folderMap) : assetIsDirectlyInFolder(asset, activeFolderId, folderMap)
        ));

        const valueFiltered = folderFiltered.filter((asset) => {
            if (kindFilter && asset.kind !== kindFilter) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                asset.originalName,
                asset.eventName,
                asset.collectionLabel,
                asset.folder?.name,
                getAssetKindLabel(asset.kind),
            ].some((value) => value?.toLowerCase().includes(query));
        });

        return [...valueFiltered].sort((left, right) => {
            if (sortBy === 'likely') {
                const leftStats = collectionStats[getAssetFolderIds(left, folderMap).collectionFolderId] || {};
                const rightStats = collectionStats[getAssetFolderIds(right, folderMap).collectionFolderId] || {};
                return (
                    (rightStats.count || 0) - (leftStats.count || 0) ||
                    (rightStats.lastUsedAt || 0) - (leftStats.lastUsedAt || 0) ||
                    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
                );
            }

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
    }, [activeFolderId, assets, collectionStats, folderMap, kindFilter, searchValue, sortBy]);

    useEffect(() => {
        if (filteredAssets.length === 0) {
            setSelectedAssetId(null);
            setPreviewAssetId(null);
            setSelectedAssetIds([]);
            return;
        }

        setSelectedAssetId((current) => (
            filteredAssets.some((asset) => asset.id === current) ? current : null
        ));

        setPreviewAssetId((current) => (
            filteredAssets.some((asset) => asset.id === current) ? current : null
        ));

        setSelectedAssetIds((current) => {
            const validIds = current.filter((id) => filteredAssets.some((asset) => asset.id === id));
            return validIds.length > 0 ? validIds : [filteredAssets[0].id];
        });
    }, [filteredAssets]);

    const previewAsset = filteredAssets.find((asset) => asset.id === previewAssetId) || null;

    useEffect(() => {
        if (!previewAsset || assetMetrics[previewAsset.id]) {
            return;
        }

        if (previewAsset.kind === 'image') {
            const image = new window.Image();
            image.onload = () => {
                setAssetMetrics((current) => ({
                    ...current,
                    [previewAsset.id]: {
                        dimensions: `${image.naturalWidth} × ${image.naturalHeight}`,
                    },
                }));
            };
            image.src = previewAsset.s3Url;
        } else if (previewAsset.kind === 'video') {
            const video = document.createElement('video');
            video.onloadedmetadata = () => {
                setAssetMetrics((current) => ({
                    ...current,
                    [previewAsset.id]: {
                        dimensions: `${video.videoWidth} × ${video.videoHeight}`,
                    },
                }));
            };
            video.src = previewAsset.s3Url;
        }
    }, [assetMetrics, previewAsset]);

    const selectedAssets = useMemo(
        () => filteredAssets.filter((asset) => selectedAssetIds.includes(asset.id)),
        [filteredAssets, selectedAssetIds]
    );

    const openAssetPreview = (assetId) => {
        setSelectedAssetId(assetId);
        setPreviewAssetId(assetId);
    };

    const handleSelectFolder = (folderId) => {
        setActiveFolderId(folderId);
        setExpandedFolderIds((current) => [...new Set([...current, ...getFolderPathIds(folderMap, folderId)])]);
    };

    const toggleFolderExpanded = (folderId) => {
        if (folderId === ROOT_FOLDER_ID) return;
        setExpandedFolderIds((current) => (
            current.includes(folderId)
                ? current.filter((id) => id !== folderId)
                : [...current, folderId]
        ));
    };

    const startAssetDrag = (assetId) => {
        setDraggingAssetId(assetId);
    };

    const endAssetDrag = () => {
        setDraggingAssetId('');
    };

    const moveAssetToFolder = async (folderId) => {
        const asset = assets.find((item) => item.id === draggingAssetId);
        const folder = folderMap.get(folderId);

        if (!asset || !asset.directAssetId || !folder || folder.source !== 'persisted') {
            toast.error('Only uploaded library assets can be moved into saved folders.');
            setDraggingAssetId('');
            return;
        }

        if (asset.folderId === folderId) {
            setDraggingAssetId('');
            return;
        }

        try {
            setMovingAssetId(asset.id);
            const response = await api.patch(`/assets/${asset.directAssetId}/folder`, { folderId });
            const movedAsset = response?.asset || response?.data?.asset;

            setDirectAssets((current) => current.map((item) => (
                item.id === asset.directAssetId
                    ? {
                        ...item,
                        ...(movedAsset || {}),
                        folderId,
                        folder: movedAsset?.folder || {
                            id: folder.id,
                            name: folder.label,
                            parentId: folder.persistedParentId || null,
                            category: folder.category || null,
                        },
                    }
                    : item
            )));
            setExpandedFolderIds((current) => [...new Set([...current, ...getFolderPathIds(folderMap, folderId)])]);
            toast.success(`Moved ${asset.originalName} to ${folder.label}.`);
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError.message || 'Failed to move asset.');
            toast.error('Failed to move asset.');
        } finally {
            setDraggingAssetId('');
            setMovingAssetId('');
        }
    };

    const getFolderEventId = (folder) => {
        if (!folder) return '';
        if (folder.eventId) return folder.eventId;
        if (String(folder.collectionKey || '').startsWith('event:')) {
            return String(folder.collectionKey).replace('event:', '');
        }
        return '';
    };

    const openUploadModal = () => {
        const collectionFolder = activeFolder?.type === 'EVENT'
            ? activeFolder
            : folderMap.get(activeFolder?.parentId);
        const inheritedEventId = getFolderEventId(activeFolder) || (collectionFolder?.type === 'EVENT'
            ? String(collectionFolder.collectionKey || '').replace('event:', '')
            : '');

        setUploadFolderId(activeFolder?.source === 'persisted' ? activeFolder.id : '');
        setUploadEventId(inheritedEventId);
        setUploadCategory((current) => activeFolder?.category || current || recentCategories[0]?.value || '');
        setShowUploadModal(true);
    };

    const closeUploadModal = () => {
        if (uploading) return;

        setShowUploadModal(false);
        setUploadFiles([]);
        setIsDraggingUploadModal(false);
    };

    const openCreateFolderModal = () => {
        setFolderName('');
        setFolderParentId(activeFolder?.source === 'persisted' ? activeFolder.id : '');
        setShowCreateFolderModal(true);
    };

    const closeCreateFolderModal = () => {
        if (creatingFolder) return;
        setShowCreateFolderModal(false);
    };

    const handleUploadFolderChange = (folderId) => {
        setUploadFolderId(folderId);
        const folder = folderMap.get(folderId);
        if (!folder) return;

        setUploadCategory(folder.category || '');
        setUploadEventId(getFolderEventId(folder));
    };

    const handleFolderParentChange = (folderId) => {
        setFolderParentId(folderId);
    };

    const addUploadFiles = (files = []) => {
        if (files.length === 0) return;

        setUploadFiles((current) => [...current, ...files]);
    };

    const removeUploadFile = (indexToRemove) => {
        setUploadFiles((current) => current.filter((_file, index) => index !== indexToRemove));
    };

    const handleCreateFolder = async () => {
        const name = folderName.trim();
        if (!name) {
            toast.error('Add a folder name first.');
            return;
        }

        const parentId = folderParentId || undefined;
        const parentFolder = folderMap.get(folderParentId);
        const payload = {
            name,
            category: normalizeToken(parentFolder?.category || name),
            eventId: getFolderEventId(parentFolder) || undefined,
            parentId,
        };

        try {
            setCreatingFolder(true);
            const response = await api.post('/assets/folders', payload);
            const createdFolder = response?.folder || response?.data?.folder;

            if (createdFolder) {
                setLibraryFolders((current) => [...current, createdFolder]);
                setActiveFolderId(createdFolder.id);
                setUploadFolderId(createdFolder.id);
                setUploadCategory(createdFolder.category || payload.category);
                setUploadEventId(createdFolder.eventId || '');
            }

            setShowCreateFolderModal(false);
            toast.success('Folder created.');
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError.message || 'Failed to create folder.');
            toast.error('Failed to create folder.');
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleDeleteFolder = async () => {
        if (!activeFolder || activeFolder.source !== 'persisted') {
            return;
        }

        if ((activeFolder.count || 0) > 0 || (activeFolder.childIds || []).length > 0) {
            toast.error('Delete assets and subfolders before deleting this folder.');
            return;
        }

        if (!window.confirm(`Delete folder "${activeFolder.label}"? This cannot be undone.`)) {
            return;
        }

        try {
            setDeletingFolderId(activeFolder.id);
            await api.delete(`/assets/folders/${activeFolder.id}`);
            setLibraryFolders((current) => current.filter((folder) => folder.id !== activeFolder.id));
            setExpandedFolderIds((current) => current.filter((id) => id !== activeFolder.id));
            setActiveFolderId(activeFolder.parentId || ROOT_FOLDER_ID);
            setUploadFolderId((current) => (current === activeFolder.id ? '' : current));
            setFolderParentId((current) => (current === activeFolder.id ? '' : current));
            setError('');
            toast.success('Folder deleted.');
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError.message || 'Failed to delete folder.');
            toast.error('Failed to delete folder.');
        } finally {
            setDeletingFolderId('');
        }
    };

    const openShareFolderModal = () => {
        if (!activeFolder || activeFolder.source !== 'persisted') {
            toast.error('Only saved folders can be shared.');
            return;
        }

        setShareRecipientLabel('');
        setShareExpiresInDays(14);
        setShareFolderIds([activeFolder.id]);
        setShowShareModal(true);
        loadFolderShares(activeFolder.id);
    };

    const toggleShareFolderSelection = (folderId) => {
        setShareFolderIds((current) => {
            if (current.includes(folderId)) {
                return current.filter((id) => id !== folderId);
            }

            return [...current, folderId];
        });
    };

    const handleCreateShare = async () => {
        if (!activeFolder || activeFolder.source !== 'persisted') {
            toast.error('Choose a saved folder first.');
            return;
        }

        if (shareFolderIds.length === 0) {
            toast.error('Choose at least one folder for this link.');
            return;
        }

        try {
            setCreatingShare(true);
            const response = await api.post(`/assets/folders/${activeFolder.id}/shares`, {
                recipientLabel: shareRecipientLabel.trim() || undefined,
                expiresInDays: shareExpiresInDays,
                folderIds: shareFolderIds,
            });
            const createdShare = response?.share || response?.data?.share;

            if (createdShare) {
                setFolderShares((current) => [createdShare, ...current]);
                if (createdShare.shareUrl) {
                    await copyText(createdShare.shareUrl, 'Secure folder link copied');
                } else {
                    toast.success('Secure folder link created.');
                }
            }

            setShareRecipientLabel('');
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError.message || 'Failed to create folder share link.');
            toast.error('Failed to create folder share link.');
        } finally {
            setCreatingShare(false);
        }
    };

    const handleRevokeShare = async (shareId) => {
        if (!activeFolder || activeFolder.source !== 'persisted') {
            return;
        }

        try {
            setRevokingShareId(shareId);
            const response = await api.delete(`/assets/folders/${activeFolder.id}/shares/${shareId}`);
            const revokedShare = response?.share || response?.data?.share;

            setFolderShares((current) => current.map((share) => (
                share.id === shareId
                    ? { ...share, ...(revokedShare || {}), active: false, revokedAt: revokedShare?.revokedAt || new Date().toISOString() }
                    : share
            )));
            toast.success('Folder link revoked.');
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError.message || 'Failed to revoke folder share link.');
            toast.error('Failed to revoke folder share link.');
        } finally {
            setRevokingShareId('');
        }
    };

    const handleDeleteAsset = async () => {
        if (!previewAsset?.directAssetId) {
            return;
        }

        if (!window.confirm(`Delete asset "${previewAsset.originalName}"? This cannot be undone.`)) {
            return;
        }

        try {
            setDeletingAssetId(previewAsset.id);
            await api.delete(`/assets/${previewAsset.directAssetId}`);
            setDirectAssets((current) => current.filter((asset) => asset.id !== previewAsset.directAssetId));
            setSelectedAssetIds((current) => current.filter((assetId) => assetId !== previewAsset.id));
            setSelectedAssetId((current) => (current === previewAsset.id ? null : current));
            setPreviewAssetId((current) => (current === previewAsset.id ? null : current));
            setAssetMetrics((current) => {
                const next = { ...current };
                delete next[previewAsset.id];
                return next;
            });
            setError('');
            toast.success('Asset deleted.');
        } catch (requestError) {
            setError(requestError?.response?.data?.message || requestError.message || 'Failed to delete asset.');
            toast.error('Failed to delete asset.');
        } finally {
            setDeletingAssetId('');
        }
    };

    const handleUploadIntent = async () => {
        if (uploadFiles.length === 0) {
            return;
        }

        if (!uploadFolderId) {
            toast.error('Choose a folder before uploading.');
            return;
        }

        const payload = new FormData();
        uploadFiles.forEach((file) => payload.append('files', file));
        payload.append('folderId', uploadFolderId);

        try {
            setUploading(true);
            const response = await api.upload('/assets', payload);
            const uploadedAssets = extractDirectAssets(response);
            setDirectAssets((current) => [...uploadedAssets, ...current]);
            setError('');
            setShowUploadModal(false);
            setUploadFiles([]);
            toast.success(`${uploadFiles.length} file${uploadFiles.length === 1 ? '' : 's'} uploaded to the asset library.`);
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
            title={searchValue || kindFilter ? 'No assets match these filters' : 'This folder is empty'}
            description={searchValue || kindFilter
                ? 'Widen the filters or switch folders.'
                : 'Create a subfolder or upload files into a saved folder to keep the library navigable.'}
            action={(
                <div className="flex flex-wrap justify-center gap-3">
                    <DashboardButton isDark={isDark} variant="secondary" onClick={openCreateFolderModal} disabled={creatingFolder}>
                        <FolderPlus className="h-4 w-4" />
                        New Folder
                    </DashboardButton>
                    <DashboardButton isDark={isDark} onClick={openUploadModal} disabled={uploading}>
                        <Upload className="h-4 w-4" />
                        Upload Assets
                    </DashboardButton>
                </div>
            )}
        />
    );

    return (
        <DashboardPage className="mx-auto max-w-[1720px] space-y-6">
            <DashboardPageHeader
                isDark={isDark}
                title="Asset Library"
                description="Browse, organize, and download assets by the event or brand library they belong to."
                className="min-h-[132px]"
                descriptionClassName="text-base"
                badges={(
                    <>
                        <DashboardChip isDark={isDark}>{assets.length} assets</DashboardChip>
                        <DashboardChip isDark={isDark}>{persistedFolderOptions.length} folders</DashboardChip>
                        {selectedAssetIds.length > 0 ? <DashboardChip isDark={isDark}>{selectedAssetIds.length} selected</DashboardChip> : null}
                        {refreshing ? <DashboardChip isDark={isDark}>Refreshing</DashboardChip> : null}
                        {uploading ? <DashboardChip isDark={isDark}>Uploading</DashboardChip> : null}
                    </>
                )}
            />

            {error ? (
                <div className={cn('rounded-md border px-4 py-3 text-sm', isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700')}>
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
                    <DashboardSurface isDark={isDark} accent="slate" className="h-[680px] animate-pulse" />
                    <DashboardSurface isDark={isDark} accent="violet" className="h-[680px] animate-pulse" />
                </div>
            ) : (
                <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
                        <FolderRail
                            activeFolderId={activeFolder?.id || ROOT_FOLDER_ID}
                            expandedFolderIds={expandedFolderIds}
                            folderMap={folderMap}
                            movingAssetId={draggingAssetId}
                            onDropAsset={moveAssetToFolder}
                            onSelect={handleSelectFolder}
                            onToggleFolder={toggleFolderExpanded}
                            isDark={isDark}
                        />

                        <div className="space-y-5">
                            <FolderWorkspaceHeader
                                activeFolder={activeFolder}
                                creatingFolder={creatingFolder}
                                deletingFolder={deletingFolderId === activeFolder?.id}
                                folderMap={folderMap}
                                isDark={isDark}
                                onCreate={openCreateFolderModal}
                                onDeleteFolder={handleDeleteFolder}
                                onShareFolder={openShareFolderModal}
                                onSelectFolder={handleSelectFolder}
                                onUpload={openUploadModal}
                                uploading={uploading}
                            />

                            <DashboardSurface isDark={isDark} accent={null} className="p-3">
                                <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
                                    <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                                        <div className="relative min-w-[240px] flex-1">
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
                                            aria-label="Asset type filter"
                                            value={kindFilter}
                                            onChange={(event) => setKindFilter(event.target.value)}
                                            className="min-w-[132px] lg:w-auto"
                                        >
                                            {TYPE_OPTIONS.map((option) => (
                                                <option key={option.label} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </DashboardSelect>
                                        <DashboardSelect
                                            isDark={isDark}
                                            aria-label="Sort assets"
                                            value={sortBy}
                                            onChange={(event) => setSortBy(event.target.value)}
                                            className="min-w-[160px] lg:w-auto"
                                        >
                                            {SORT_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    Sort by: {option.label}
                                                </option>
                                            ))}
                                        </DashboardSelect>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
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
                                        <DashboardButton isDark={isDark} variant="primary" onClick={downloadSelected} disabled={selectedAssetIds.length === 0}>
                                            <Download className="h-4 w-4" />
                                            Download Selected ({selectedAssetIds.length})
                                        </DashboardButton>
                                        <DashboardIconButton isDark={isDark} aria-label="Refresh assets" onClick={() => loadAssets({ background: true })}>
                                            <RefreshCcw className="h-4 w-4" />
                                        </DashboardIconButton>
                                    </div>
                                </div>
                            </DashboardSurface>

                            {childFolders.length > 0 ? (
                                <div>
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <p className={cn('text-xs uppercase tracking-[0.16em]', uiTheme.textTertiary)}>
                                            Folders in {activeFolder?.label || 'All assets'}
                                        </p>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                        {childFolders.map((folder) => (
                                            <FolderTile
                                                key={folder.id}
                                                folder={folder}
                                                isDark={isDark}
                                                movingAssetId={draggingAssetId}
                                                onDropAsset={moveAssetToFolder}
                                                onOpen={handleSelectFolder}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {filteredAssets.length === 0 && childFolders.length === 0 ? (
                                <div>{emptyState}</div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                                    {filteredAssets.map((asset) => (
                                        <AssetCard
                                            key={asset.id}
                                            asset={asset}
                                            isDark={isDark}
                                            isActive={asset.id === selectedAssetId}
                                            isSelected={selectedAssetIds.includes(asset.id)}
                                            onActivate={openAssetPreview}
                                            onDragEnd={endAssetDrag}
                                            onDragStart={startAssetDrag}
                                            onToggleSelection={toggleSelection}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <DashboardSurface isDark={isDark} accent={null} className="overflow-hidden">
                                    <div className={cn('grid grid-cols-[44px_72px_minmax(0,1.5fr)_0.7fr_0.7fr_0.8fr] gap-3 border-b px-4 py-3 text-[11px] uppercase tracking-[0.16em]', isDark ? cn('border-white/10', uiTheme.textMuted) : 'border-slate-200 text-slate-400')}>
                                        <span>Select</span>
                                        <span>Preview</span>
                                        <span>Name</span>
                                        <span>Type</span>
                                        <span>Size</span>
                                        <span>Date</span>
                                    </div>
                                    {filteredAssets.map((asset) => (
                                        <AssetRow
                                            key={asset.id}
                                            asset={asset}
                                            isDark={isDark}
                                            isActive={asset.id === selectedAssetId}
                                            isSelected={selectedAssetIds.includes(asset.id)}
                                            onActivate={openAssetPreview}
                                            onDragEnd={endAssetDrag}
                                            onDragStart={startAssetDrag}
                                            onToggleSelection={toggleSelection}
                                        />
                                    ))}
                                </DashboardSurface>
                            )}
                        </div>
                </div>
            )}

            <AssetPreviewModal
                asset={previewAsset}
                deletingAsset={deletingAssetId === previewAsset?.id}
                isDark={isDark}
                metrics={previewAsset ? assetMetrics[previewAsset.id] : null}
                onClose={() => setPreviewAssetId(null)}
                onDeleteAsset={handleDeleteAsset}
                onOpen={() => window.open(previewAsset?.s3Url, '_blank', 'noopener,noreferrer')}
                onCopyAssetLink={() => copyText(previewAsset?.s3Url || '', 'Signed asset URL copied')}
            />

            {showUploadModal ? (
                <AssetUploadModal
                    files={uploadFiles}
                    folderOptions={persistedFolderOptions}
                    isDark={isDark}
                    isDragging={isDraggingUploadModal}
                    onAddFiles={addUploadFiles}
                    onClose={closeUploadModal}
                    onCreateFolder={openCreateFolderModal}
                    onDropFiles={addUploadFiles}
                    onFolderChange={handleUploadFolderChange}
                    onRemoveFile={removeUploadFile}
                    onSubmit={handleUploadIntent}
                    onToggleDragging={setIsDraggingUploadModal}
                    uploadFolderId={uploadFolderId}
                    uploadInputRef={uploadInputRef}
                    uploading={uploading}
                />
            ) : null}

            {showCreateFolderModal ? (
                <CreateFolderModal
                    activeFolder={activeFolder}
                    folderOptions={persistedFolderOptions}
                    folderName={folderName}
                    folderParentId={folderParentId}
                    isDark={isDark}
                    onClose={closeCreateFolderModal}
                    onNameChange={setFolderName}
                    onParentChange={handleFolderParentChange}
                    onSubmit={handleCreateFolder}
                    saving={creatingFolder}
                />
            ) : null}

            {showShareModal ? (
                <ShareFolderModal
                    activeFolder={activeFolder}
                    creatingShare={creatingShare}
                    expiresInDays={shareExpiresInDays}
                    folderOptions={persistedFolderOptions}
                    folderShares={folderShares}
                    isDark={isDark}
                    loadingShares={loadingShares}
                    onClose={() => setShowShareModal(false)}
                    onCopyShare={(value) => copyText(value, 'Secure folder link copied')}
                    onCreateShare={handleCreateShare}
                    onExpiresChange={setShareExpiresInDays}
                    onRecipientChange={setShareRecipientLabel}
                    onRevokeShare={handleRevokeShare}
                    onToggleFolderSelection={toggleShareFolderSelection}
                    recipientLabel={shareRecipientLabel}
                    revokingShareId={revokingShareId}
                    selectedFolderIds={shareFolderIds}
                />
            ) : null}
        </DashboardPage>
    );
};

export default AssetLibraryView;
