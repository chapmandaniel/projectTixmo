import React, { startTransition, useLayoutEffect, useRef, useState } from 'react';

const badgeClass = 'inline-flex items-center gap-2 rounded-sm bg-[#1b2130] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#d7dbe6]';
const blockClass = 'absolute animate-pulse bg-[#202636]';
const fallbackBlockClass = 'animate-pulse rounded-sm bg-[#202636]';
const MIN_BLOCK_WIDTH = 24;
const MIN_BLOCK_HEIGHT = 18;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const normalize = (value) => Math.round(value);

const blocksAreEqual = (leftBlocks, rightBlocks) => {
    if (leftBlocks.length !== rightBlocks.length) {
        return false;
    }

    return leftBlocks.every((leftBlock, index) => {
        const rightBlock = rightBlocks[index];

        return (
            leftBlock.left === rightBlock.left
            && leftBlock.top === rightBlock.top
            && leftBlock.width === rightBlock.width
            && leftBlock.height === rightBlock.height
            && leftBlock.radius === rightBlock.radius
        );
    });
};

const isVisibleContainer = (element) => {
    const style = window.getComputedStyle(element);

    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || style.position === 'absolute') {
        return false;
    }

    const rect = element.getBoundingClientRect();

    return rect.width >= MIN_BLOCK_WIDTH && rect.height >= MIN_BLOCK_HEIGHT;
};

const measureBlock = (element, parentRect) => {
    const rect = element.getBoundingClientRect();
    const left = clamp(rect.left - parentRect.left, 0, parentRect.width);
    const top = clamp(rect.top - parentRect.top, 0, parentRect.height);
    const width = clamp(rect.width, 0, parentRect.width - left);
    const height = clamp(rect.height, 0, parentRect.height - top);

    if (width < MIN_BLOCK_WIDTH || height < MIN_BLOCK_HEIGHT) {
        return null;
    }

    const style = window.getComputedStyle(element);

    return {
        left: normalize(left),
        top: normalize(top),
        width: normalize(width),
        height: normalize(height),
        radius: normalize(clamp(Number.parseFloat(style.borderRadius) || 6, 0, 18)),
    };
};

const buildBlocksFromParent = (parent, overlay) => {
    const parentRect = parent.getBoundingClientRect();

    if (parentRect.width < MIN_BLOCK_WIDTH || parentRect.height < MIN_BLOCK_HEIGHT) {
        return [];
    }

    return Array.from(parent.children)
        .filter((element) => element !== overlay && isVisibleContainer(element))
        .map((element) => measureBlock(element, parentRect))
        .filter(Boolean);
};

const FallbackLayout = () => (
    <div className="grid h-full gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]" aria-hidden="true">
        <div className="grid gap-3">
            <div className={`${fallbackBlockClass} h-10 w-40`} />
            <div className={`${fallbackBlockClass} h-64 w-full`} />
        </div>
        <div className="grid gap-3">
            <div className={`${fallbackBlockClass} h-32 w-full`} />
            <div className={`${fallbackBlockClass} h-24 w-full`} />
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
            className={`absolute inset-0 z-20 overflow-hidden rounded-[inherit] bg-[#11141b]/86 ${className}`}
            role="status"
            aria-live="polite"
        >
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
                                key={`${block.left}-${block.top}-${index}`}
                                className={blockClass}
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
