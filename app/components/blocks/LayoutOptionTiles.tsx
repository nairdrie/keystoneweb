'use client';

import React from 'react';

export type LayoutOption = {
    id: string;
    label: string;
    description?: string;
};

type LayoutOptionTilesProps<T extends string> = {
    blockType: string;
    value: T;
    options: ReadonlyArray<LayoutOption & { id: T }>;
    onChange: (value: T) => void;
    label?: string;
    description?: string;
};

export default function LayoutOptionTiles<T extends string>({
    blockType,
    value,
    options,
    onChange,
    label,
    description,
}: LayoutOptionTilesProps<T>) {
    return (
        <div>
            {label && (
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {label}
                </p>
            )}
            {description && <p className="mb-3 text-xs text-slate-500">{description}</p>}
            <div className="grid grid-cols-2 gap-3">
                {options.map((option) => {
                    const active = value === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onChange(option.id)}
                            aria-pressed={active}
                            title={option.description}
                            className={`rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                active
                                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <LayoutOptionThumbnail blockType={blockType} optionId={option.id} active={active} />
                            <span className="mt-3 block text-sm font-bold text-slate-900">{option.label}</span>
                            {option.description && (
                                <span className="mt-1 block text-[11px] leading-snug text-slate-500">
                                    {option.description}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function hasLayoutOptionThumbnail(blockType: string, optionId: string): boolean {
    return Boolean(getLayoutPreviewKind(blockType, optionId));
}

function LayoutOptionThumbnail({ blockType, optionId, active }: { blockType: string; optionId: string; active: boolean }) {
    const color = active ? 'bg-blue-600' : 'bg-slate-400';
    const pale = active ? 'bg-blue-200' : 'bg-slate-200';
    const mid = active ? 'bg-blue-300' : 'bg-slate-300';
    const line = active ? 'bg-blue-400' : 'bg-slate-300';

    switch (getLayoutPreviewKind(blockType, optionId)) {
        case 'carousel-slides':
            return (
                <PreviewShell className="grid grid-cols-[1fr_1.15fr] gap-1">
                    <span className={`rounded-md ${pale}`} />
                    <span className="flex flex-col justify-center gap-1">
                        <span className={`h-1.5 w-3/4 rounded ${color}`} />
                        <span className={`h-1.5 rounded ${pale}`} />
                        <span className={`h-1.5 w-5/6 rounded ${pale}`} />
                        <span className="mt-1 flex gap-1">
                            <span className={`h-1.5 w-4 rounded ${color}`} />
                            {[0, 1, 2].map((index) => <span key={index} className={`h-1.5 w-1.5 rounded-full ${mid}`} />)}
                        </span>
                    </span>
                </PreviewShell>
            );
        case 'carousel-minimal':
            return (
                <PreviewShell className="flex flex-col items-center justify-center gap-1">
                    <span className={`h-4 w-4 rounded-md ${pale}`} />
                    <span className={`h-1.5 w-16 rounded ${color}`} />
                    <span className={`h-1.5 w-20 rounded ${pale}`} />
                    <span className="mt-1 flex gap-1">
                        {[0, 1, 2].map((index) => <span key={index} className={`h-1.5 w-1.5 rounded-full ${index === 0 ? color : mid}`} />)}
                    </span>
                </PreviewShell>
            );
        case 'cards-grid':
            return (
                <PreviewShell className="grid grid-cols-3 gap-1">
                    {[0, 1, 2].map((index) => (
                        <span key={index} className="flex flex-col gap-1 rounded-md border border-slate-100 p-1">
                            <span className={`h-3 rounded ${index === 0 ? color : pale}`} />
                            <span className={`h-1.5 rounded ${pale}`} />
                            <span className={`h-1.5 w-4/5 rounded ${mid}`} />
                        </span>
                    ))}
                </PreviewShell>
            );
        case 'simple-list':
            return (
                <PreviewShell className="flex flex-col justify-center gap-1.5">
                    {[0, 1, 2].map((index) => (
                        <span key={index} className="flex items-center gap-2">
                            <span className={`h-2 w-8 rounded ${index === 0 ? color : pale}`} />
                            <span className={`h-2 flex-1 rounded ${pale}`} />
                        </span>
                    ))}
                </PreviewShell>
            );
        case 'comparison':
            return (
                <PreviewShell className="grid grid-cols-3 gap-1.5">
                    {[0, 1, 2].map((index) => (
                        <span key={index} className="flex flex-col gap-1">
                            <span className={`h-2 rounded ${index === 1 ? color : pale}`} />
                            {[0, 1, 2].map((row) => <span key={row} className={`h-1.5 rounded ${pale}`} />)}
                        </span>
                    ))}
                </PreviewShell>
            );
        case 'banner':
            return (
                <PreviewShell className="flex items-center gap-1.5">
                    {[0, 1, 2, 3].map((index) => (
                        <span key={index} className={`flex-1 rounded-md p-1.5 ${index === 0 ? color : pale}`}>
                            <span className="block h-1.5 rounded bg-white/70" />
                            <span className="mt-1 block h-1 rounded bg-white/50" />
                        </span>
                    ))}
                </PreviewShell>
            );
        case 'progress':
            return (
                <PreviewShell className="flex flex-col justify-center gap-1.5">
                    {[0, 1, 2].map((index) => (
                        <span key={index} className="flex items-center gap-2">
                            <span className={`h-1.5 w-8 rounded ${pale}`} />
                            <span className="h-1.5 flex-1 rounded bg-slate-100">
                                <span className={`block h-full rounded ${index === 0 ? color : mid}`} style={{ width: `${82 - index * 16}%` }} />
                            </span>
                        </span>
                    ))}
                </PreviewShell>
            );
        case 'scroll-row':
            return (
                <PreviewShell className="flex items-center gap-1 overflow-hidden">
                    {[0, 1, 2].map((index) => (
                        <span key={index} className={`h-9 min-w-12 rounded-md ${index === 0 ? color : pale}`} />
                    ))}
                    <span className={`h-9 min-w-5 rounded-l-md ${mid}`} />
                </PreviewShell>
            );
        case 'single-focus':
            return (
                <PreviewShell className="flex items-center justify-center">
                    <span className="flex h-10 w-24 flex-col justify-center gap-1 rounded-md border border-slate-100 p-2">
                        <span className={`h-2 w-10 rounded ${color}`} />
                        <span className={`h-1.5 rounded ${pale}`} />
                        <span className={`h-1.5 w-4/5 rounded ${mid}`} />
                    </span>
                </PreviewShell>
            );
        case 'timeline-side':
            return (
                <PreviewShell className="grid grid-cols-[12px_1fr] gap-2">
                    <span className="relative flex justify-center">
                        <span className={`h-full w-0.5 rounded ${line}`} />
                        {[0, 1, 2].map((index) => <span key={index} className={`absolute h-2 w-2 rounded-full ${color}`} style={{ top: `${index * 42 + 2}%` }} />)}
                    </span>
                    <span className="flex flex-col gap-1.5">
                        {[0, 1, 2].map((index) => <span key={index} className={`h-3.5 rounded ${index === 0 ? color : pale}`} />)}
                    </span>
                </PreviewShell>
            );
        case 'timeline-centered':
            return (
                <PreviewShell className="grid grid-cols-[1fr_8px_1fr] gap-1.5">
                    <span className="flex flex-col gap-3 pt-1">
                        <span className={`h-3.5 rounded ${color}`} />
                        <span />
                        <span className={`h-3.5 rounded ${pale}`} />
                    </span>
                    <span className={`h-full w-0.5 justify-self-center rounded ${line}`} />
                    <span className="flex flex-col gap-3 pt-5">
                        <span className={`h-3.5 rounded ${pale}`} />
                    </span>
                </PreviewShell>
            );
        case 'date-list':
            return (
                <PreviewShell className="grid grid-cols-[34px_1fr] gap-2">
                    <span className="flex flex-col justify-center gap-2">
                        {[0, 1, 2].map((index) => <span key={index} className={`h-1.5 rounded ${index === 0 ? color : mid}`} />)}
                    </span>
                    <span className="flex flex-col justify-center gap-2">
                        {[0, 1, 2].map((index) => <span key={index} className={`h-2 rounded ${pale}`} />)}
                    </span>
                </PreviewShell>
            );
        case 'split':
            return (
                <PreviewShell className="grid grid-cols-2 gap-1.5">
                    <span className={`rounded-md ${pale}`} />
                    <span className="flex flex-col justify-center gap-1">
                        <span className={`h-2 w-4/5 rounded ${color}`} />
                        <span className={`h-1.5 rounded ${pale}`} />
                        <span className={`h-1.5 w-3/4 rounded ${mid}`} />
                    </span>
                </PreviewShell>
            );
        case 'essay':
            return (
                <PreviewShell className="flex flex-col justify-center gap-1">
                    <span className={`h-2 w-1/2 rounded ${color}`} />
                    {[0, 1, 2, 3].map((index) => <span key={index} className={`h-1.5 rounded ${index === 3 ? mid : pale}`} />)}
                </PreviewShell>
            );
        case 'multi-grid':
            return (
                <PreviewShell className="grid grid-cols-2 gap-1.5">
                    {[0, 1, 2, 3].map((index) => (
                        <span key={index} className="flex flex-col justify-center gap-1 rounded-md border border-slate-100 p-1">
                            <span className={`h-1.5 rounded ${index === 0 ? color : pale}`} />
                            <span className={`h-1 rounded ${mid}`} />
                        </span>
                    ))}
                </PreviewShell>
            );
        case 'logo-inline':
            return (
                <PreviewShell className="flex items-center justify-center gap-2">
                    {[0, 1, 2, 3].map((index) => <span key={index} className={`h-5 w-8 rounded ${index === 0 ? color : pale}`} />)}
                </PreviewShell>
            );
        case 'marquee':
            return (
                <PreviewShell className="flex items-center gap-1 overflow-hidden">
                    {[0, 1, 2, 3, 4].map((index) => <span key={index} className={`h-5 min-w-8 rounded ${index === 0 ? color : pale}`} />)}
                </PreviewShell>
            );
        case 'sidebar-grid':
            return (
                <PreviewShell className="grid grid-cols-[22px_1fr] gap-2">
                    <span className="flex flex-col gap-1">
                        {[0, 1, 2].map((index) => <span key={index} className={`h-2 rounded ${index === 0 ? color : pale}`} />)}
                    </span>
                    <span className="grid grid-cols-2 gap-1">
                        {[0, 1, 2, 3].map((index) => <span key={index} className={`rounded ${index === 0 ? color : pale}`} />)}
                    </span>
                </PreviewShell>
            );
        case 'alignment':
            return (
                <PreviewShell className={`flex flex-col justify-center gap-1.5 ${optionId === 'center' ? 'items-center' : optionId === 'right' ? 'items-end' : ''}`}>
                    {[0, 1, 2].map((index) => (
                        <span
                            key={index}
                            className={`h-1.5 rounded ${index === 0 ? color : pale}`}
                            style={{ width: optionId === 'stretch' ? '100%' : `${70 - index * 12}%` }}
                        />
                    ))}
                </PreviewShell>
            );
        case 'full-width':
            return (
                <PreviewShell className="flex flex-col justify-center gap-1">
                    <span className={`h-8 rounded-md ${color}`} />
                    <span className={`mx-auto h-1.5 w-16 rounded ${pale}`} />
                </PreviewShell>
            );
        default:
            return (
                <PreviewShell className="grid grid-cols-2 gap-1.5">
                    {[0, 1, 2, 3].map((index) => <span key={index} className={`rounded ${index === 0 ? color : pale}`} />)}
                </PreviewShell>
            );
    }
}

function PreviewShell({ children, className }: { children: React.ReactNode; className: string }) {
    return (
        <span className={`h-12 rounded-lg bg-white p-1.5 ${className}`}>
            {children}
        </span>
    );
}

function getLayoutPreviewKind(blockType: string, optionId: string): string {
    if (blockType === 'carousel') {
        if (optionId === 'slides') return 'carousel-slides';
        if (optionId === 'minimal') return 'carousel-minimal';
        return 'cards-grid';
    }

    if (blockType === 'pricing') {
        if (optionId === 'comparison') return 'comparison';
        if (optionId === 'simple') return 'simple-list';
        return 'cards-grid';
    }

    if (blockType === 'stats') {
        if (optionId === 'banner') return 'banner';
        if (optionId === 'progress') return 'progress';
        return 'cards-grid';
    }

    if (blockType === 'testimonials') {
        if (optionId === 'scroll') return 'scroll-row';
        if (optionId === 'single') return 'single-focus';
        return 'cards-grid';
    }

    if (blockType === 'timeline') {
        if (optionId === 'centered') return 'timeline-centered';
        if (optionId === 'compact') return 'date-list';
        return 'timeline-side';
    }

    if (blockType === 'featuredQuote') {
        if (optionId === 'split') return 'split';
        if (optionId === 'minimal') return 'single-focus';
        if (optionId === 'essay') return 'essay';
        if (optionId === 'multiGrid') return 'multi-grid';
        if (optionId === 'left' || optionId === 'right') return 'split';
        return 'single-focus';
    }

    if (blockType === 'logoCloud') {
        if (optionId === 'grid') return 'cards-grid';
        if (optionId === 'marquee') return 'marquee';
        return 'logo-inline';
    }

    if (blockType === 'blog') {
        if (optionId === 'list') return 'simple-list';
        if (optionId === 'magazine') return 'split';
        return 'cards-grid';
    }

    if (blockType === 'resources' || blockType === 'socialFeed') {
        if (optionId === 'list' || optionId === 'single') return 'simple-list';
        return 'cards-grid';
    }

    if (blockType === 'video') {
        if (optionId === 'fullWidth') return 'full-width';
        return 'single-focus';
    }

    if (blockType === 'tabBar') {
        if (['left', 'center', 'right', 'stretch'].includes(optionId)) return 'alignment';
    }

    if (blockType === 'productGrid') {
        if (optionId === 'row') return 'scroll-row';
        if (optionId === 'gridWithSidebar') return 'sidebar-grid';
        if (optionId === 'list') return 'simple-list';
        return 'cards-grid';
    }

    return '';
}
