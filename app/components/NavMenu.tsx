'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useEditorContext, NavItem } from '@/lib/editor-context';
import { useLangPrefix } from '@/lib/hooks/useLangPrefix';
import { getBlockSlug } from '@/lib/block-utils';

interface NavMenuProps {
    className?: string;
    itemClassName?: string;
    submenuClassName?: string;
}

// Editor (sortable, edit modal, drag handles) is loaded only in edit mode so
// @dnd-kit and the edit-only UI don't ship to published-site visitors.
const NavMenuEditor = dynamic(() => import('./NavMenuEditor'), { ssr: false });

export default function NavMenu(props: NavMenuProps) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    if (isEditMode) {
        return <NavMenuEditor {...props} />;
    }

    return <NavMenuView {...props} />;
}

function NavMenuView({ className = '', itemClassName = '', submenuClassName = '' }: NavMenuProps) {
    const context = useEditorContext();
    const navItems = context?.navItems || [];
    const pages = context?.pages || [];
    const blocks = context?.blocks || [];
    const pathname = usePathname();
    const langPrefix = useLangPrefix();
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');
    const [expandedMobile, setExpandedMobile] = useState<Set<string>>(new Set());

    if (navItems.length === 0) return null;

    const isMobileLayout = className.includes('flex-col');
    const resolvedSubmenuClassName = submenuClassName || 'bg-white border border-gray-200 shadow-xl';

    const resolveHref = (item: NavItem): string => {
        if (item.linkType === 'page') {
            if (isEditor) {
                return `/design?siteId=${context?.siteId}&pageId=${item.pageId}`;
            }
            if (context?.previewSiteId) {
                return `/preview?siteId=${context.previewSiteId}&pageId=${item.pageId}`;
            }
            const target = pages.find(p => p.id === item.pageId);
            const slug = target?.slug || '';
            const base = slug === 'home' ? '/' : `/${slug}`;
            return langPrefix ? `${langPrefix}${base === '/' ? '' : base}` : base;
        }
        if (item.linkType === 'section') {
            if (item.pageId) {
                if (isEditor) {
                    const hash = item.href?.includes('#') ? `#${item.href.split('#')[1]}` : '';
                    return `/design?siteId=${context?.siteId}&pageId=${item.pageId}${hash}`;
                }
                return item.href || `#${item.blockId}`;
            }
            if (item.blockId) {
                const idx = blocks.findIndex(b => b.id === item.blockId);
                if (idx !== -1) return `#${getBlockSlug(blocks[idx], idx, blocks)}`;
            }
            return item.href || `#${item.blockId}`;
        }
        return item.href;
    };

    const isActivePage = (item: NavItem): boolean => {
        if (item.linkType !== 'page') return false;
        const target = pages.find(p => p.id === item.pageId);
        const slug = target?.slug || '';
        const base = slug === 'home' ? '/' : `/${slug}`;
        const itemPath = langPrefix ? `${langPrefix}${base === '/' ? '' : base}` : base;
        return ((pathname || '') === '' ? '/' : pathname) === itemPath;
    };

    const toggleMobile = (id: string) => {
        setExpandedMobile(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <nav className={className}>
            {navItems.map(item => {
                const hasChildren = !!(item.children && item.children.length > 0);
                const href = resolveHref(item);
                const external = item.linkType === 'custom' && item.href.startsWith('http');
                const activeClass = isActivePage(item) ? 'underline underline-offset-4 decoration-2' : '';

                if (isMobileLayout) {
                    const expanded = expandedMobile.has(item.id);
                    return (
                        <span key={item.id} className="flex flex-col">
                            <span className="flex items-center">
                                <Link
                                    href={href}
                                    target={external ? '_blank' : undefined}
                                    rel={external ? 'noopener noreferrer' : undefined}
                                    className={`${itemClassName} flex-1 ${activeClass}`}
                                    aria-current={isActivePage(item) ? 'page' : undefined}
                                >
                                    {item.label}
                                </Link>
                                {hasChildren && (
                                    <button
                                        type="button"
                                        onClick={() => toggleMobile(item.id)}
                                        className="p-2 transition-transform"
                                        aria-expanded={expanded}
                                        aria-label={`Expand ${item.label} submenu`}
                                    >
                                        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                    </button>
                                )}
                            </span>
                            {hasChildren && expanded && (
                                <div className="pl-4 flex flex-col gap-0.5 mt-0.5">
                                    {item.children!.map(sub => {
                                        const subExternal = sub.linkType === 'custom' && sub.href.startsWith('http');
                                        return (
                                            <Link
                                                key={sub.id}
                                                href={resolveHref(sub)}
                                                target={subExternal ? '_blank' : undefined}
                                                rel={subExternal ? 'noopener noreferrer' : undefined}
                                                className={`${itemClassName} text-[0.8125rem] opacity-80`}
                                            >
                                                {sub.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </span>
                    );
                }

                // Desktop: CSS-only hover dropdown
                return (
                    <span key={item.id} className="relative group/navitem inline-flex items-center">
                        <Link
                            href={href}
                            target={external ? '_blank' : undefined}
                            rel={external ? 'noopener noreferrer' : undefined}
                            className={`${itemClassName} ${activeClass} ${hasChildren ? 'inline-flex items-center gap-1' : ''}`}
                            aria-current={isActivePage(item) ? 'page' : undefined}
                        >
                            {item.label}
                            {hasChildren && <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover/navitem:rotate-180" />}
                        </Link>
                        {hasChildren && (
                            <div className="absolute top-full left-0 pt-2 z-[60] opacity-0 invisible group-hover/navitem:opacity-100 group-hover/navitem:visible transition-opacity">
                                <div className={`rounded-lg py-1.5 min-w-[180px] ${resolvedSubmenuClassName}`}>
                                    {item.children!.map(sub => {
                                        const subExternal = sub.linkType === 'custom' && sub.href.startsWith('http');
                                        return (
                                            <Link
                                                key={sub.id}
                                                href={resolveHref(sub)}
                                                target={subExternal ? '_blank' : undefined}
                                                rel={subExternal ? 'noopener noreferrer' : undefined}
                                                className="block w-full px-4 py-2 text-sm transition-colors hover:bg-black/5"
                                            >
                                                {sub.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </span>
                );
            })}
        </nav>
    );
}
