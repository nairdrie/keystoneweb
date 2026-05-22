'use client';

import dynamic from 'next/dynamic';
import { useEditorContext, NavItem } from '@/lib/editor-context';
import { usePathname } from 'next/navigation';
import { useLangPrefix } from '@/lib/hooks/useLangPrefix';
import { getBlockSlug } from '@/lib/block-utils';
import { getTabClass, getTabStyle, TabStyle, TabAlign } from './tab-bar-styles';
import { resolvePaletteColor } from '@/lib/palette-colors';
import Reveal, { useStaggerSec } from '@/app/components/Reveal';

interface TabBarBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

// Editor (with @dnd-kit + edit modal) is lazy-loaded so the published bundle
// stays clean.
const TabBarEditor = dynamic(() => import('./TabBarBlockEditor'), { ssr: false });

export default function TabBarBlock({ id, data, isEditMode, palette, updateContent }: TabBarBlockProps) {
    const context = useEditorContext();
    const pathname = usePathname();
    const langPrefix = useLangPrefix();

    const items: NavItem[] = Array.isArray(data?.items) ? data.items : [];
    const tabStyle: TabStyle = data?.tabStyle || 'underline';
    const tabAlign: TabAlign = data?.tabAlign || 'left';
    const activeColorSource: string = data?.activeColor || 'palette:primary';
    const bgColorSource: string = data?.bgColor || '';
    const activeColor: string = resolvePaletteColor(activeColorSource, palette, palette.primary || '#374151');
    const bgColor: string = resolvePaletteColor(bgColorSource, palette, '');

    const pages = context?.pages || [];
    const blocks = context?.blocks || [];
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

    const resolveHref = (item: NavItem): string => {
        if (item.linkType === 'page') {
            if (isEditor) return `/design?siteId=${context?.siteId}&pageId=${item.pageId}`;
            if (context?.previewSiteId) return `/preview?siteId=${context.previewSiteId}&pageId=${item.pageId}`;
            const target = pages.find(p => p.id === item.pageId);
            const slug = target?.slug || '';
            const base = slug === 'home' ? '/' : `/${slug}`;
            return langPrefix ? `${langPrefix}${base === '/' ? '' : base}` : base;
        }
        if (item.linkType === 'section') {
            if (item.pageId && isEditor) {
                const hash = item.href?.includes('#') ? `#${item.href.split('#')[1]}` : '';
                return `/design?siteId=${context?.siteId}&pageId=${item.pageId}${hash}`;
            }
            if (item.blockId) {
                const idx = blocks.findIndex(b => b.id === item.blockId);
                if (idx !== -1) return `#${getBlockSlug(blocks[idx], idx, blocks)}`;
            }
            return item.href || `#${item.blockId}`;
        }
        return item.href || '#';
    };

    const isActive = (item: NavItem): boolean => {
        if (isEditMode || item.linkType !== 'page') return false;
        const target = pages.find(p => p.id === item.pageId);
        const slug = target?.slug || '';
        const base = slug === 'home' ? '/' : `/${slug}`;
        const itemPath = langPrefix ? `${langPrefix}${base === '/' ? '' : base}` : base;
        return (pathname || '/') === itemPath;
    };

    if (isEditMode) {
        return (
            <TabBarEditor
                items={items}
                tabStyle={tabStyle}
                tabAlign={tabAlign}
                activeColor={activeColor}
                bgColor={bgColor}
                activeColorSource={activeColorSource}
                bgColorSource={bgColorSource}
                palette={palette}
                updateContent={updateContent}
                resolveHref={resolveHref}
                pages={pages}
                blocks={blocks}
                siteId={context?.siteId}
                currentPageId={context?.currentPageId}
            />
        );
    }

    return (
        <TabBarView
            items={items}
            tabStyle={tabStyle}
            tabAlign={tabAlign}
            activeColor={activeColor}
            bgColor={bgColor}
            resolveHref={resolveHref}
            isActive={isActive}
        />
    );
}

function TabBarView({ items, tabStyle, tabAlign, activeColor, bgColor, resolveHref, isActive }: {
    items: NavItem[];
    tabStyle: TabStyle;
    tabAlign: TabAlign;
    activeColor: string;
    bgColor: string;
    resolveHref: (item: NavItem) => string;
    isActive: (item: NavItem) => boolean;
}) {
    const staggerSec = useStaggerSec();
    if (items.length === 0) return null;

    const containerAlign =
        tabAlign === 'center' ? 'justify-center' :
        tabAlign === 'right' ? 'justify-end' :
        tabAlign === 'stretch' ? '' : 'justify-start';

    const outerStyle = bgColor ? { backgroundColor: bgColor } : {};

    return (
        <div className={`w-full ${bgColor ? 'px-4 py-2' : ''}`} style={outerStyle}>
            <nav className={`flex flex-wrap gap-1 ${tabAlign !== 'stretch' ? containerAlign : ''}`}>
                {items.map((item, index) => {
                    const active = isActive(item);
                    const href = resolveHref(item);
                    const external = item.linkType === 'custom' && (item.href?.startsWith('http') || item.href?.startsWith('//'));

                    return (
                        <Reveal key={item.id} delay={index * staggerSec}>
                            <a
                                href={href}
                                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                className={getTabClass(tabStyle, active, tabAlign)}
                                style={getTabStyle(tabStyle, active, activeColor)}
                            >
                                {item.label}
                            </a>
                        </Reveal>
                    );
                })}
            </nav>
        </div>
    );
}
