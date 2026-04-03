import React, { startTransition, useLayoutEffect, useRef, useState } from 'react';

const badgeClass = 'inline-flex items-center gap-2 rounded-sm border border-[#434b5f] bg-[#181c25] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#d7dbe6]';
const blockClass = 'absolute border border-[#394255] bg-[#1a1f29]';
const fallbackBlockClass = 'rounded-sm border border-[#394255] bg-[#1a1f29]';

const ROOT_SELECTOR = [
    '[data-pending-block-root]',
    '[data-testid="approval-comment-card"]',
    '[data-testid="external-discussion-item"]',
    'button',
    'a[href]',
    'input',
    'textarea',
    'select',
    'img',
    'video',
    'canvas',
    'svg[role="img"]',
    '[role="button"]',
].join(', ');

const TEXT_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, span, small, strong, label, li, dt, dd, time';
const MAX_BLOCKS = 48;
const MIN_BLOCK_WIDTH = 18;
const MIN_BLOCK_HEIGHT = 10;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const normalize = (value) => Math.round(value);

const blocksAreEqual = (leftBlocks, rightBlocks) => {
    if (leftBlocks.length !== rightBlocks.length) {
        return false;
    }

    return leftBlocks.every((leftBlock, index) => {
        const rightBlock = rightBlocks[index];

        return (
            leftBlock.kind === rightBlock.kind
            && leftBlock.left === rightBlock.left
            && leftBlock.top === rightBlock.top
            && leftBlock.width === rightBlock.width
            && leftBlock.height === rightBlock.height
            && leftBlock.radius === rightBlock.radius
        );
    });
};

const isVisibleElement = (element) => {
    const style = window.getComputedStyle(element);

    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return false;
    }

    const rect = element.getBoundingClientRect();

    return rect.width >= MIN_BLOCK_WIDTH && rect.height >= MIN_BLOCK_HEIGHT;
};

const getBlockKind = (element) => {
    if (element.matches('img, video, canvas, [data-pending-block-root="media"]')) {
        return 'media';
    }

    if (element.matches('textarea, [data-pending-block-root="textarea"]')) {
        return 'textarea';
    }

    if (element.matches('input, select, [data-pending-block-root="field"]')) {
        return 'field';
    }

    if (element.matches('[data-pending-block-root="panel"]')) {
        return 'panel';
    }

    if (element.matches('button, a[href], [role="button"]')) {
        return 'button';
    }

    return 'panel';
};

const measureBlock = (element, parentRect, kind) => {
    const rect = element.getBoundingClientRect();
    const left = clamp(rect.left - parentRect.left, 0, parentRect.width);
    const top = clamp(rect.top - parentRect.top, 0, parentRect.height);
    const width = clamp(rect.width, 0, parentRect.width - left);
    const height = clamp(rect.height, 0, parentRect.height - top);

    if (width < MIN_BLOCK_WIDTH || height < MIN_BLOCK_HEIGHT) {
        return null;
    }

    const style = window.getComputedStyle(element);
    const radius = clamp(Number.parseFloat(style.borderRadius) || 6, 2, 18);

    return {
        left: normalize(left),
        top: normalize(top),
        width: normalize(width),
        height: normalize(height),
        radius: normalize(radius),
        kind,
        area: width * height,
    };
};

const hasSelectedAncestor = (element, roots) => roots.some((root) => root !== element && root.contains(element));

const hasRenderableText = (element) => {
    const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';

    return text.length > 0;
};

const isLeafTextElement = (element) => {
    if (!hasRenderableText(element)) {
        return false;
    }

    return !Array.from(element.children).some((child) => child.matches(TEXT_SELECTOR) && hasRenderableText(child));
};

const buildBlocksFromParent = (parent, overlay) => {
    const parentRect = parent.getBoundingClientRect();

    if (parentRect.width < MIN_BLOCK_WIDTH || parentRect.height < MIN_BLOCK_HEIGHT) {
        return [];
    }

    const rootElements = Array.from(parent.querySelectorAll(ROOT_SELECTOR)).filter((element) => (
        element !== overlay
        && !overlay.contains(element)
        && isVisibleElement(element)
    ));

    const uniqueRoots = rootElements.filter((element) => !hasSelectedAncestor(element, rootElements));
    const rootBlocks = uniqueRoots
        .map((element) => measureBlock(element, parentRect, getBlockKind(element)))
        .filter(Boolean);

    const textBlocks = Array.from(parent.querySelectorAll(TEXT_SELECTOR))
        .filter((element) => (
            element !== overlay
            && !overlay.contains(element)
            && !hasSelectedAncestor(element, uniqueRoots)
            && isVisibleElement(element)
            && isLeafTextElement(element)
        ))
        .map((element) => measureBlock(element, parentRect, 'text'))
        .filter(Boolean);

    return [...rootBlocks, ...textBlocks]
        .sort((leftBlock, rightBlock) => {
            if (rightBlock.area !== leftBlock.area) {
                return rightBlock.area - leftBlock.area;
            }

            if (leftBlock.top !== rightBlock.top) {
                return leftBlock.top - rightBlock.top;
            }

            return leftBlock.left - rightBlock.left;
        })
        .slice(0, MAX_BLOCKS);
};

const getBlockTone = (kind) => {
    switch (kind) {
        case 'media':
            return 'bg-[#212837]';
        case 'button':
            return 'bg-[#1d2330]';
        case 'field':
        case 'textarea':
            return 'bg-[#171d28]';
        case 'text':
            return 'bg-[#242b39]';
        default:
            return 'bg-[#1a1f29]';
    }
};

const FallbackLayout = () => (
    <div className="grid h-full gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]" aria-hidden="true">
        <div className="grid gap-3">
            <div className={`${fallbackBlockClass} h-10 w-40`} />
            <div className={`${fallbackBlockClass} h-56 w-full`} />
            <div className="grid gap-3 sm:grid-cols-2">
                <div className={`${fallbackBlockClass} h-16 w-full`} />
                <div className={`${fallbackBlockClass} h-16 w-full`} />
            </div>
        </div>
        <div className="grid gap-3">
            <div className={`${fallbackBlockClass} h-28 w-full`} />
            <div className={`${fallbackBlockClass} h-24 w-full`} />
            <div className={`${fallbackBlockClass} h-10 w-2/3`} />
        </div>
    </div>
);

const PendingSectionBlocker = ({ label = 'Refreshing', className = '' }) => {
    const overlayRef = useRef(null);
    const [blocks, setBlocks] = useState([]);
    const blockCacheRef = useRef([]);

    useLayoutEffect(() => {
        const overlay = overlayRef.current;
        const parent = overlay?.parentElement;

        if (!overlay || !parent) {
            return undefined;
        }

        let frameId = 0;

        const measure = () => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => {
                const nextBlocks = buildBlocksFromParent(parent, overlay);

                if (blocksAreEqual(blockCacheRef.current, nextBlocks)) {
                    return;
                }

                blockCacheRef.current = nextBlocks;
                startTransition(() => {
                    setBlocks(nextBlocks);
                });
            });
        };

        measure();

        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(parent);

        const mutationObserver = new MutationObserver((mutations) => {
            const shouldMeasure = mutations.some((mutation) => !overlay.contains(mutation.target));

            if (shouldMeasure) {
                measure();
            }
        });
        mutationObserver.observe(parent, {
            attributes: true,
            characterData: true,
            childList: true,
            subtree: true,
        });

        window.addEventListener('resize', measure);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', measure);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, []);

    return (
        <div
            ref={overlayRef}
            className={`absolute inset-0 z-20 overflow-hidden rounded-[inherit] border border-[#262d3b] bg-[#11141b] ${className}`}
            role="status"
            aria-live="polite"
            data-pending-block-ignore="true"
        >
            <div className="absolute inset-0 bg-[#11141b]" aria-hidden="true" />
            <div className="absolute left-4 top-4 z-10">
                <span className={badgeClass}>
                    <span className="h-2 w-2 rounded-[2px] bg-[#8d96ab] animate-pulse" />
                    {label}
                </span>
            </div>
            <div className="absolute inset-0 p-4 pt-16">
                {blocks.length > 0 ? (
                    <div className="relative h-full w-full" aria-hidden="true">
                        {blocks.map((block, index) => (
                            <div
                                key={`${Math.round(block.left)}-${Math.round(block.top)}-${index}`}
                                className={`${blockClass} ${getBlockTone(block.kind)}`}
                                style={{
                                    borderRadius: `${block.radius}px`,
                                    height: `${block.height}px`,
                                    left: `${block.left}px`,
                                    top: `${block.top}px`,
                                    width: `${block.width}px`,
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <FallbackLayout />
                )}
            </div>
        </div>
    );
};

export default PendingSectionBlocker;
