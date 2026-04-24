import React from 'react';
import { Heart, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { dashboardAccentGradients, getDashboardTheme } from '../../lib/dashboardTheme';

const surfaceAccentMap = {
    brand: dashboardAccentGradients.brand,
    violet: dashboardAccentGradients.violet,
    blue: dashboardAccentGradients.blue,
    green: dashboardAccentGradients.green,
    amber: dashboardAccentGradients.amber,
    slate: dashboardAccentGradients.slate,
};

export const DashboardSurface = ({
    as: Component = 'div',
    isDark,
    accent = 'brand',
    interactive = false,
    className,
    children,
    ...props
}) => {
    const theme = getDashboardTheme(isDark);

    return (
        <Component
            className={cn(
                'relative overflow-hidden rounded-md border transition-all duration-300',
                theme.panel,
                interactive && theme.panelInteractive,
                className
            )}
            {...props}
        >
            {accent ? (
                <div
                    aria-hidden="true"
                    className={cn('pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r', surfaceAccentMap[accent] || accent)}
                />
            ) : null}
            {children}
        </Component>
    );
};

export const DashboardChip = ({ isDark, children, className }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-[11px] font-light', theme.chip, className)}>
            {children}
        </span>
    );
};

export const DashboardIconButton = ({ isDark, className, children, ...props }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <button
            type="button"
            className={cn('inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors', theme.iconButton, className)}
            {...props}
        >
            {children}
        </button>
    );
};

export const DashboardButton = ({ isDark, variant = 'primary', className, children, ...props }) => {
    const theme = getDashboardTheme(isDark);

    const variants = {
        primary: isDark
            ? 'border-dashboard-accent bg-dashboard-accent text-white hover:border-rose-500 hover:bg-rose-500'
            : 'border-slate-900 bg-slate-900 text-white hover:border-slate-800 hover:bg-slate-800',
        secondary: isDark
            ? 'border-dashboard-border bg-dashboard-panel text-zinc-100 hover:bg-dashboard-panelAlt'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        subtle: isDark
            ? cn(theme.textSecondary, 'border-transparent hover:bg-white/5 hover:text-zinc-100')
            : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900',
    };

    return (
        <button
            type="button"
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-light transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
};

export const DashboardTextInput = ({ isDark, className, ...props }) => (
    <input
        className={cn(
            'h-11 w-full rounded-md border px-3 text-sm font-light outline-none transition focus:ring-2 focus:ring-pink-500/20',
            isDark
                ? 'border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-pink-400'
                : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-400',
            className
        )}
        {...props}
    />
);

export const DashboardSelect = ({ isDark, className, children, ...props }) => (
    <select
        className={cn(
            'h-11 w-full rounded-md border px-3 text-sm font-light outline-none transition focus:ring-2 focus:ring-pink-500/20',
            isDark
                ? 'border-white/10 bg-white/5 text-zinc-100 focus:border-pink-400'
                : 'border-slate-200 bg-white text-slate-900 focus:border-slate-400',
            className
        )}
        {...props}
    >
        {children}
    </select>
);

export const DashboardTitleBar = ({
    isDark,
    title,
    description,
    icon: Icon,
    iconClassName,
    titleSuffix,
    badges,
    actions,
    className,
    bodyClassName,
    titleClassName,
    descriptionClassName,
    glowTopClassName = 'bg-fuchsia-500/10',
    glowBottomClassName = 'bg-cyan-400/10',
}) => {
    const TitleTag = titleSuffix ? 'div' : 'h1';

    return (
        <section className={cn('page-section-enter relative overflow-hidden rounded-md border p-6 sm:p-8', isDark ? 'border-[#2b2b40] bg-[#1e1e2d] shadow-2xl shadow-black/20' : 'border-gray-200 bg-white shadow-sm', className)}>
            <div className="absolute inset-0 pointer-events-none">
                <div className={cn('absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl', glowTopClassName)} />
                <div className={cn('absolute left-10 bottom-0 h-40 w-40 rounded-full blur-3xl', glowBottomClassName)} />
            </div>
            <div className={cn('relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between', bodyClassName)}>
                <div>
                    <TitleTag className={cn('flex flex-wrap items-baseline gap-3 text-3xl font-light tracking-tight sm:text-4xl', isDark ? 'text-gray-100' : 'text-gray-900', titleClassName)}>
                        <span className="inline-flex items-center gap-2">
                            <span>{title}</span>
                            {Icon ? <Icon className={cn('h-6 w-6 sm:h-7 sm:w-7', iconClassName)} /> : null}
                        </span>
                        {titleSuffix ? titleSuffix : null}
                    </TitleTag>
                    {description ? (
                        <p className={cn('mt-3 max-w-3xl text-sm leading-7', isDark ? 'text-[#a1a5b7]' : 'text-gray-500', descriptionClassName)}>
                            {description}
                        </p>
                    ) : null}
                    {badges ? <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div> : null}
                </div>
                {actions ? <div className="relative flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">{actions}</div> : null}
            </div>
        </section>
    );
};

export const DashboardPageHeader = ({
    isDark,
    eyebrow,
    title,
    description,
    meta,
    icon,
    iconClassName,
    actions,
    badges,
    ...props
}) => (
    <DashboardTitleBar
        isDark={isDark}
        title={title}
        description={description}
        icon={icon}
        iconClassName={iconClassName}
        actions={actions || meta}
        badges={badges || (eyebrow ? (
            <DashboardChip isDark={isDark} className="uppercase tracking-[0.18em]">
                {eyebrow}
            </DashboardChip>
        ) : null)}
        {...props}
    />
);

export const DashboardHeroHeader = ({ isDark, title, description, meta, className, titleClassName, descriptionClassName }) => (
    <section className={cn('page-section-enter', className)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
                <h1 className={cn(
                    'text-[3.3rem] font-light leading-none tracking-tight',
                    isDark ? 'text-[#f2f2f7]' : 'text-gray-900',
                    titleClassName
                )}>
                    {title}
                </h1>
                {description ? (
                    <p className={cn(
                        'mt-3 text-[1.02rem] font-light',
                        isDark ? 'text-[#9ea2b6]' : 'text-gray-500',
                        descriptionClassName
                    )}>
                        {description}
                    </p>
                ) : null}
            </div>
            {meta ? <div className="flex shrink-0 items-center">{meta}</div> : null}
        </div>
    </section>
);

export const DashboardPage = ({ className, children }) => (
    <div className={cn('animate-fade-in space-y-6 pb-12', className)}>
        {children}
    </div>
);

export const DashboardSection = ({ isDark, accent = 'slate', title, description, actions, className, children }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <DashboardSurface isDark={isDark} accent={accent} className={cn('p-5 sm:p-6', className)}>
            {(title || description || actions) ? (
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        {title ? (
                            <h2 className={cn('text-[1.35rem] font-light tracking-tight', theme.textPrimary)}>
                                {title}
                            </h2>
                        ) : null}
                        {description ? (
                            <p className={cn('mt-2 max-w-2xl text-sm font-light leading-6', theme.textSecondary)}>
                                {description}
                            </p>
                        ) : null}
                    </div>
                    {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
                </div>
            ) : null}
            {children}
        </DashboardSurface>
    );
};

export const DashboardStat = ({ isDark, label, value, detail }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <div className={cn(
            'rounded-md border p-4',
            isDark ? 'border-[#2b2b40] bg-[#171723]' : 'border-slate-200 bg-slate-50/90'
        )}>
            <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>{label}</p>
            <p className={cn('mt-2 text-2xl font-light tracking-tight', theme.textPrimary)}>{value}</p>
            {detail ? (
                <p className={cn('mt-1 text-xs font-light leading-5', theme.textSecondary)}>{detail}</p>
            ) : null}
        </div>
    );
};

export const DashboardEmptyState = ({ isDark, title, description, action, className, compact = false }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <div className={cn(
            'rounded-md border border-dashed text-center',
            compact ? 'px-4 py-6' : 'px-5 py-10',
            isDark ? 'border-[#2b2b40] bg-[#171723]' : 'border-slate-200 bg-slate-50',
            className
        )}>
            <h3 className={cn('text-base font-light tracking-tight', theme.textPrimary)}>{title}</h3>
            <p className={cn('mx-auto mt-2 max-w-md text-sm font-light leading-6', theme.textSecondary)}>{description}</p>
            {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
        </div>
    );
};

export const DashboardStripedList = ({ isDark, className, children }) => (
    <div
        className={cn(
            'overflow-hidden rounded-md',
            isDark ? 'bg-[#171723]' : 'bg-slate-50/80',
            className
        )}
    >
        {children}
    </div>
);

export const DashboardStripedRow = ({
    as: Component = 'div',
    isDark,
    index = 0,
    className,
    children,
    ...props
}) => (
    <Component
        className={cn(
            'transition-colors',
            index % 2 === 0
                ? (isDark ? 'bg-[#171723]' : 'bg-slate-50/70')
                : (isDark ? 'bg-[#1c1c2b]' : 'bg-white/85'),
            className
        )}
        {...props}
    >
        {children}
    </Component>
);

export const DashboardWorkspaceTile = ({
    as: Component = 'button',
    isDark,
    accent = 'brand',
    icon: Icon,
    iconClassName,
    title,
    description,
    badge,
    footer,
    isHidden = false,
    className,
    titleClassName,
    descriptionClassName,
    children,
    ...props
}) => (
    <Component
        className={cn(
            'group relative flex min-h-[196px] flex-col overflow-hidden rounded-md border px-7 pb-7 pt-7 text-left outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-fuchsia-500',
            isHidden
                ? (isDark
                    ? 'border-[#242438] bg-[#171723] text-[#616579] opacity-55'
                    : 'border-gray-200/60 bg-gray-50 text-gray-500 opacity-60')
                : isDark
                    ? 'border-[#31324a] bg-[#1f1f31] text-[#f2f2f7] hover:bg-[#232336]'
                    : 'border-gray-200 bg-white text-slate-900 shadow-sm hover:bg-gray-50 hover:shadow-xl',
            className
        )}
        {...props}
    >
        {accent ? (
            <div
                aria-hidden="true"
                className={cn('absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r transition-opacity duration-300', surfaceAccentMap[accent] || accent, isHidden ? 'opacity-15' : 'opacity-90')}
            />
        ) : null}

        <div className="z-10 mb-9 flex w-full items-center justify-between">
            {Icon ? <Icon size={27} className={iconClassName} /> : children}
            {badge ? (
                <span className="flex h-6 items-center justify-center rounded-full bg-[#ff3366] px-3 text-[11px] font-medium text-white shadow-md">
                    {badge}
                </span>
            ) : null}
        </div>

        <div className="z-10">
            <h3 className={cn(
                'mb-1.5 text-[1rem] font-light tracking-tight',
                isHidden
                    ? (isDark ? 'text-[#616579]' : 'text-gray-500')
                    : (isDark ? 'text-[#f2f2f7]' : 'text-slate-900'),
                titleClassName
            )}>
                {title}
            </h3>
            <p className={cn(
                'max-w-[34ch] text-[0.96rem] font-light leading-[1.45]',
                isHidden
                    ? (isDark ? 'text-[#70738a]' : 'text-gray-400')
                    : (isDark ? 'text-[#a1a5b7]' : 'text-slate-600'),
                descriptionClassName
            )}>
                {description}
            </p>
        </div>

        {footer ? (
            <div className="absolute bottom-4 right-5 z-20 flex items-center gap-2">
                {footer}
            </div>
        ) : null}
    </Component>
);

export const DashboardModuleTile = ({
    to,
    item,
    badge,
    isDark,
    isFavorite,
    isHidden,
    onToggleFavorite,
    onToggleHidden,
    className,
    ...props
}) => {
    return (
        <DashboardWorkspaceTile
            as={Link}
            to={to}
            isDark={isDark}
            accent={item.accent}
            icon={item.icon}
            iconClassName={item.iconClassName}
            title={item.label}
            description={item.description}
            badge={badge ? (badge > 9 ? '9+' : badge) : null}
            isHidden={isHidden}
            className={className}
            footer={(
                <>
                    <button
                        type="button"
                        onClick={onToggleHidden}
                        data-testid={item.id ? `dashboard-visibility-${item.id}` : undefined}
                        className={cn(
                            'rounded-full p-1.5 outline-none transition-opacity duration-300',
                            isHidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                            isDark ? 'hover:bg-[#2b2b40]' : 'hover:bg-slate-100'
                        )}
                        title={isHidden ? 'Show Card' : 'Hide Card'}
                    >
                        {isHidden ? (
                            <EyeOff size={16} className={isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} />
                        ) : (
                            <Eye size={16} className={cn(isDark ? 'text-[#4a4d64] hover:text-gray-300' : 'text-slate-300 hover:text-slate-500')} />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onToggleFavorite}
                        data-testid={item.id ? `dashboard-favorite-${item.id}` : undefined}
                        className={cn(
                            'rounded-full p-1.5 outline-none transition-colors duration-300',
                            isDark ? 'hover:bg-[#2b2b40]' : 'hover:bg-slate-100'
                        )}
                        title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                    >
                        <Heart
                            size={18}
                            className={cn(
                                'transition-colors duration-300',
                                isFavorite
                                    ? 'fill-[#ff3366] text-[#ff3366]'
                                    : cn(isDark ? 'text-[#4a4d64]' : 'text-slate-300', 'hover:text-[#ff3366]')
                            )}
                        />
                    </button>
                </>
            )}
            {...props}
        />
    );
};
