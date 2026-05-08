import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    AlertTriangle,
    CalendarDays,
    Download,
    FileImage,
    FileText,
    FolderOpen,
    ShieldCheck,
    Video,
} from 'lucide-react';
import { getApiBaseUrl } from '../lib/runtimeConfig';
import { cn } from '../lib/utils';

const formatDate = (value) => {
    if (!value) return 'Unknown date';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatFileSize = (value) => {
    const size = Number(value) || 0;

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;

    return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const getAssetKind = (mimeType = '') => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf') return 'document';
    return 'file';
};

const getAssetIcon = (kind) => {
    if (kind === 'image') return FileImage;
    if (kind === 'video') return Video;
    return FileText;
};

const AssetPreview = ({ asset }) => {
    const kind = getAssetKind(asset.mimeType);
    const Icon = getAssetIcon(kind);

    return (
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-dashboard-border bg-dashboard-panelAlt">
            {kind === 'image' ? (
                <img src={asset.s3Url} alt={asset.originalName} className="h-full w-full object-cover" />
            ) : kind === 'video' ? (
                <video src={asset.s3Url} className="h-full w-full object-cover" muted playsInline controls />
            ) : (
                <div className="flex flex-col items-center gap-3 px-6 text-center text-dashboard-muted">
                    <span className="flex h-14 w-14 items-center justify-center rounded-md bg-dashboard-panel text-zinc-100">
                        <Icon className="h-6 w-6" />
                    </span>
                    <p className="text-sm font-light">Preview unavailable</p>
                </div>
            )}
        </div>
    );
};

const SharedAssetFolderPage = () => {
    const { token } = useParams();
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        const loadSharedFolder = async () => {
            try {
                setLoading(true);
                setError('');

                const response = await fetch(`${getApiBaseUrl()}/assets/shares/${token}`);
                if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({}));
                    throw new Error(errorBody.message || 'This folder link is invalid or expired.');
                }

                const body = await response.json();
                if (!cancelled) {
                    setPayload(body);
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || 'This folder link is invalid or expired.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadSharedFolder();

        return () => {
            cancelled = true;
        };
    }, [token]);

    const folderPath = useMemo(() => {
        if (!payload?.folder || !payload?.folders) return [];

        const foldersById = new Map(payload.folders.map((folder) => [folder.id, folder]));
        const path = [];
        let current = payload.folder;

        while (current) {
            path.unshift(current);
            current = current.parentId ? foldersById.get(current.parentId) : null;
        }

        return path;
    }, [payload]);

    const childFolders = useMemo(() => {
        if (!payload?.folder || !payload?.folders) return [];
        return payload.folders.filter((folder) => folder.parentId === payload.folder.id);
    }, [payload]);

    return (
        <main className="min-h-screen bg-dashboard-shell text-zinc-100">
            <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
                <header className="rounded-md border border-dashboard-border bg-dashboard-panel p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-dashboard-borderStrong bg-dashboard-panelAlt px-3 py-1 text-xs font-light uppercase tracking-[0.16em] text-dashboard-muted">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                                Secure folder share
                            </div>
                            <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
                                {payload?.folder?.name || 'Shared assets'}
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm font-light leading-6 text-dashboard-muted">
                                {loading ? 'Loading shared assets...' : `${payload?.organization?.name || 'Tixmo'} shared this read-only folder.`}
                            </p>
                        </div>
                        {payload?.share?.expiresAt ? (
                            <div className="inline-flex items-center gap-2 rounded-md border border-dashboard-border bg-dashboard-panelAlt px-3 py-2 text-sm font-light text-dashboard-muted">
                                <CalendarDays className="h-4 w-4" />
                                Expires {formatDate(payload.share.expiresAt)}
                            </div>
                        ) : null}
                    </div>
                </header>

                {loading ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[0, 1, 2].map((item) => (
                            <div key={item} className="h-72 animate-pulse rounded-md border border-dashboard-border bg-dashboard-panel" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="mt-5 rounded-md border border-rose-500/30 bg-rose-500/10 p-5 text-rose-100">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                            <div>
                                <h2 className="text-lg font-light">Folder unavailable</h2>
                                <p className="mt-1 text-sm font-light text-rose-100/80">{error}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-light text-dashboard-muted">
                            {folderPath.map((folder, index) => (
                                <React.Fragment key={folder.id}>
                                    {index > 0 ? <span>/</span> : null}
                                    <span className={cn(index === folderPath.length - 1 && 'text-zinc-100')}>{folder.name}</span>
                                </React.Fragment>
                            ))}
                        </div>

                        {childFolders.length > 0 ? (
                            <section className="mt-5">
                                <p className="mb-3 text-xs uppercase tracking-[0.16em] text-dashboard-muted">Included folders</p>
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {childFolders.map((folder) => (
                                        <div key={folder.id} className="rounded-md border border-dashboard-border bg-dashboard-panel p-4">
                                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-dashboard-panelAlt text-fuchsia-200">
                                                <FolderOpen className="h-5 w-5" />
                                            </span>
                                            <p className="mt-4 truncate text-base font-light">{folder.name}</p>
                                            <p className="mt-1 text-sm font-light text-dashboard-muted">
                                                {folder.assetCount || 0} asset{folder.assetCount === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        <section className="mt-5">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-xs uppercase tracking-[0.16em] text-dashboard-muted">Assets</p>
                                <span className="rounded-full border border-dashboard-border bg-dashboard-panelAlt px-3 py-1 text-xs font-light text-dashboard-muted">
                                    {payload.assets.length} file{payload.assets.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            {payload.assets.length === 0 ? (
                                <div className="rounded-md border border-dashboard-border bg-dashboard-panel p-5 text-sm font-light text-dashboard-muted">
                                    This shared folder is empty.
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {payload.assets.map((asset) => {
                                        const kind = getAssetKind(asset.mimeType);
                                        const Icon = getAssetIcon(kind);

                                        return (
                                            <article key={asset.id} className="rounded-md border border-dashboard-border bg-dashboard-panel p-3">
                                                <AssetPreview asset={asset} />
                                                <div className="space-y-3 p-2 pt-4">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-base font-light">{asset.originalName}</p>
                                                        <p className="mt-1 truncate text-sm font-light text-dashboard-muted">
                                                            {asset.folder?.name || payload.folder.name}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 text-xs font-light text-dashboard-muted">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <Icon className="h-3.5 w-3.5" />
                                                            {kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'File'}
                                                        </span>
                                                        <span>{formatFileSize(asset.size)}</span>
                                                    </div>
                                                    <a
                                                        href={asset.s3Url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashboard-accent bg-dashboard-accent px-4 py-2.5 text-sm font-light text-white transition hover:border-rose-500 hover:bg-rose-500"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                        Download
                                                    </a>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </main>
    );
};

export default SharedAssetFolderPage;
