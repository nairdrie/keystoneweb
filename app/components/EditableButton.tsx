'use client';

import { useState, useRef, useEffect, useId, type ComponentType } from 'react';
import { Pencil, Settings } from 'lucide-react';
import * as Icons from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEditorContext, NavItem } from '@/lib/editor-context';
import { useLangPrefix } from '@/lib/hooks/useLangPrefix';
import { getBlockSlug } from '@/lib/block-utils';
import { resolvePaletteColor } from '@/lib/palette-colors';
import { getSamePageHash, smoothScrollToId } from '@/lib/smooth-scroll';
import NavItemEditModal from './NavItemEditModal';
import ButtonSettingsModal, { type ButtonShape, type ButtonFill } from './ButtonSettingsModal';

export interface ButtonLinkData {
    label: string;
    linkType: 'page' | 'section' | 'custom';
    href: string;
    pageId?: string;
    blockId?: string;
}

export interface ButtonIconData {
    icon?: string;
    iconPosition?: 'left' | 'right';
    shape?: ButtonShape;
    fill?: ButtonFill;
    iconOnly?: boolean;
    /** Optional background color override (hex or palette token like "palette:primary") */
    bgColor?: string;
    /** Optional text color override (hex or palette token like "palette:primary") */
    textColor?: string;
}

const RADIUS_CLASS_RE = /\brounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?\b/g;
const SHADOW_CLASS_RE = /\bshadow(?:-(?:none|sm|md|lg|xl|2xl|inner))?\b|\bshadow-\[[^\]]+\]/g;
const PADDING_X_CLASS_RE = /\bpx-\d+(?:\.\d+)?\b/g;
const PADDING_Y_CLASS_RE = /\bpy-\d+(?:\.\d+)?\b/g;

const SHAPE_RADIUS_CLASS: Record<ButtonShape, string> = {
    square: 'rounded-none',
    rounded: 'rounded-lg',
    pill: 'rounded-full',
};

const SHAPE_RADIUS_VALUE: Record<ButtonShape, string> = {
    square: '0px',
    rounded: '0.5rem',
    pill: '9999px',
};

interface EditableButtonProps {
    /** Key prefix for storing button data in block data */
    contentKey: string;
    /** Current button label */
    label?: string;
    /** Current link data (linkType, href, pageId, blockId) */
    linkData?: Partial<ButtonLinkData>;
    /** Current icon data (icon name, position) */
    iconData?: ButtonIconData;
    /** Default label if none provided */
    defaultLabel?: string;
    /** Whether we're in edit mode */
    isEditMode: boolean;
    /** Callback to save updates to block data */
    onSave: (key: string, value: unknown) => void;
    /** Button styling className */
    className?: string;
    /** Button inline styles */
    style?: React.CSSProperties;
    /** Default shape used in modal pre-selection (template-level default) */
    defaultShape?: ButtonShape;
    /** Default fill used in modal pre-selection (template-level default) */
    defaultFill?: ButtonFill;
    /** Active palette for resolving palette-token color overrides */
    palette?: Record<string, string>;
    /** Optional index for indexed fields. Emits data-ks-index for Keyframe selectors. */
    index?: number;
}

/**
 * EditableButton — A button with an editable label and link.
 * 
 * In edit mode: clicking opens a modal to edit the label and link destination.
 * Hovering shows a settings cog to customize the icon.
 */
export default function EditableButton({
    contentKey,
    label,
    linkData,
    iconData,
    defaultLabel = 'Get Started',
    isEditMode,
    onSave,
    className = '',
    style,
    defaultShape,
    defaultFill,
    palette,
    index,
}: EditableButtonProps) {
    const ksFieldClass = `ks-field ks-field--${contentKey.replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const ksMarkerProps: Record<string, string> = { 'data-ks-field': contentKey };
    if (index !== undefined) ksMarkerProps['data-ks-index'] = String(index);
    const context = useEditorContext();
    const effectivePalette = palette || context?.palette || {};
    const [isEditing, setIsEditing] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [controlsOnLeft, setControlsOnLeft] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

    const pages = context?.pages || [];
    const blocks = context?.blocks || [];
    const langPrefix = useLangPrefix();

    const currentLabel = label || defaultLabel;
    const currentLinkType = linkData?.linkType || 'custom';
    const currentHref = linkData?.href || '#';
    const currentPageId = linkData?.pageId || '';
    const currentBlockId = linkData?.blockId || '';

    const currentIcon = iconData?.icon;
    const currentIconPosition = iconData?.iconPosition || 'left';
    const isIconOnly = !!iconData?.iconOnly && !!currentIcon;
    const resolvedButton = resolveButtonPresentation(className, style, iconData, defaultShape, defaultFill, effectivePalette);
    const overrideCss = buildButtonOverrideCss(buttonId, iconData, effectivePalette);

    // Detect if we should show controls on the left based on screen position
    useEffect(() => {
        if (!isEditMode || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const spaceOnRight = window.innerWidth - rect.right;
        const frame = window.requestAnimationFrame(() => {
            setControlsOnLeft(spaceOnRight < 100);
        });
        return () => window.cancelAnimationFrame(frame);
    }, [isEditMode]);

    // Build the NavItem shape that NavItemEditModal expects
    const asNavItem: NavItem = {
        id: contentKey,
        label: currentLabel,
        linkType: currentLinkType,
        href: currentHref,
        pageId: currentPageId,
        blockId: currentBlockId,
    };

    const handleSave = (updated: NavItem) => {
        // Save the label
        onSave(`${contentKey}`, updated.label);
        // Save the link data as a bundle
        onSave(`${contentKey}Link`, {
            linkType: updated.linkType,
            href: updated.href,
            pageId: updated.pageId,
            blockId: updated.blockId,
        });
        setIsEditing(false);
    };

    const handleSaveSettings = (settings: ButtonIconData) => {
        onSave(`${contentKey}Icon`, settings);
        setIsSettingsOpen(false);
    };

    // Resolve the href for rendering
    const resolveHref = (): string => {
        if (context && currentLinkType === 'page' && currentPageId) {
            if (isEditor) {
                // In editor, navigate to the page within the editor
                return `/design?siteId=${context.siteId}&pageId=${currentPageId}`;
            } else {
                // Public site, navigate using standard slug with language prefix
                const targetPage = pages.find(p => p.id === currentPageId);
                const slug = targetPage ? targetPage.slug : '';
                const basePath = slug === 'home' ? '/' : `/${slug}`;
                return langPrefix ? `${langPrefix}${basePath === '/' ? '' : basePath}` : basePath;
            }
        }
        if (currentLinkType === 'section' && currentBlockId) {
            const blockIndex = blocks.findIndex(b => b.id === currentBlockId);
            if (blockIndex !== -1 && (!currentPageId || currentHref.startsWith('#') || !currentHref.includes('#'))) {
                return `#${getBlockSlug(blocks[blockIndex], blockIndex, blocks)}`;
            }
            // Use the stored href if available (it's already been resolved to /page#section)
            if (currentHref && currentHref !== '#' && !currentHref.startsWith('http')) {
                // Add language prefix for cross-page section links (e.g. /about#section)
                if (langPrefix && currentHref.startsWith('/')) {
                    return `${langPrefix}${currentHref}`;
                }
                return currentHref;
            }
            return `#${currentBlockId}`;
        }
        return currentHref;
    };

    const isExternal = currentLinkType === 'custom' && currentHref.startsWith('http');

    // Render Icon if present
    const iconMap = Icons as unknown as Record<string, ComponentType<{ className?: string }> | undefined>;
    const IconComponent = currentIcon ? iconMap[currentIcon] : null;

    const renderButtonContent = () => {
        if (isIconOnly && IconComponent) {
            return (
                <span className="flex items-center justify-center pointer-events-none" aria-label={currentLabel}>
                    <IconComponent className="w-[1.2em] h-[1.2em] shrink-0" />
                </span>
            );
        }
        return (
            <span className="flex items-center justify-center gap-2 pointer-events-none whitespace-nowrap">
                {IconComponent && currentIconPosition === 'left' && <IconComponent className="w-[1.2em] h-[1.2em] shrink-0" />}
                <span>{currentLabel}</span>
                {IconComponent && currentIconPosition === 'right' && <IconComponent className="w-[1.2em] h-[1.2em] shrink-0" />}
            </span>
        );
    };

    // Edit mode: click to open modal
    if (isEditMode) {
        return (
            <>
                {overrideCss && <style dangerouslySetInnerHTML={{ __html: overrideCss }} />}
                <div
                    ref={containerRef}
                    data-ks-editable-button
                    data-ks-editable-button-id={buttonId}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                    className={`${resolvedButton.className} cursor-pointer relative group/btn inline-flex items-center justify-center`}
                    style={resolvedButton.style}
                >
                    {renderButtonContent()}
                    
                    {/* Floating controls — hover on desktop, always visible on mobile (touch) */}
                    <span
                        className={`absolute top-1/2 -translate-y-1/2 items-center gap-1 z-50 flex opacity-0 group-hover/btn:opacity-100 transition-all scale-90 group-hover/btn:scale-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:scale-100 ${
                            controlsOnLeft ? '-left-14' : '-right-16'
                        }`}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="inline-flex items-center justify-center w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md"
                            title="Edit Link & Label"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSettingsOpen(true);
                            }}
                            className="inline-flex items-center justify-center w-7 h-7 bg-slate-800 hover:bg-slate-900 text-white rounded-full shadow-md"
                            title="Settings"
                        >
                            <Settings className="w-3.5 h-3.5" />
                        </button>
                    </span>
                </div>

                {isEditing && (
                    <NavItemEditModal
                        item={asNavItem}
                        pages={pages}
                        blocks={blocks}
                        siteId={context?.siteId}
                        currentPageId={context?.currentPageId}
                        onSave={handleSave}
                        onClose={() => setIsEditing(false)}
                    />
                )}

                <ButtonSettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onSave={handleSaveSettings}
                    initialSettings={iconData}
                    defaultShape={defaultShape}
                    defaultFill={defaultFill}
                    palette={effectivePalette}
                />
            </>
        );
    }

    // Published mode: render as a link
    const href = resolveHref();

    return (
        <>
            {overrideCss && <style dangerouslySetInnerHTML={{ __html: overrideCss }} />}
            <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                data-ks-editable-button
                data-ks-editable-button-id={buttonId}
                {...ksMarkerProps}
                className={`${resolvedButton.className} ${ksFieldClass}`.trim()}
                style={resolvedButton.style}
                onClick={(e) => {
                    const sameHash = getSamePageHash(href, pathname);
                    if (sameHash && smoothScrollToId(sameHash)) {
                        e.preventDefault();
                    }
                }}
            >
                {renderButtonContent()}
            </a>
        </>
    );
}

function buildButtonOverrideCss(
    buttonId: string,
    iconData: ButtonIconData | undefined,
    palette: Record<string, string>,
): string {
    if (!buttonId || (!iconData?.shape && !iconData?.fill && !iconData?.bgColor && !iconData?.textColor)) return '';
    const selector = `[data-ks-editable-button][data-ks-editable-button-id="${buttonId}"]`;
    const declarations: string[] = [];

    if (iconData?.shape) {
        declarations.push(`border-radius: ${SHAPE_RADIUS_VALUE[iconData.shape]} !important`);
    }

    if (iconData?.shape || iconData?.fill) {
        declarations.push('box-shadow: none !important');
    }

    if (iconData?.fill === 'ghost') {
        declarations.push('border: none !important');
    }

    const bgOverride = iconData?.bgColor ? resolvePaletteColor(iconData.bgColor, palette, '') : '';
    if (bgOverride) {
        const fill = iconData?.fill;
        if (fill === 'outline') {
            declarations.push(`border-color: ${bgOverride} !important`);
            declarations.push(`color: ${bgOverride} !important`);
            declarations.push('background-color: transparent !important');
        } else if (fill === 'ghost') {
            declarations.push(`color: ${bgOverride} !important`);
            declarations.push('background-color: transparent !important');
        } else {
            declarations.push(`background-color: ${bgOverride} !important`);
        }
    }

    const textOverride = iconData?.textColor ? resolvePaletteColor(iconData.textColor, palette, '') : '';
    if (textOverride) {
        declarations.push(`color: ${textOverride} !important`);
    }

    return declarations.length ? `${selector} { ${declarations.join('; ')}; }` : '';
}

function resolveButtonPresentation(
    className: string,
    style: React.CSSProperties | undefined,
    iconData: ButtonIconData | undefined,
    defaultShape: ButtonShape | undefined,
    defaultFill: ButtonFill | undefined,
    palette: Record<string, string>,
): { className: string; style: React.CSSProperties | undefined } {
    let nextClassName = className;
    const nextStyle: React.CSSProperties = { ...(style || {}) };
    const shape = iconData?.shape;
    const fill = iconData?.fill;
    const bgOverride = iconData?.bgColor ? resolvePaletteColor(iconData.bgColor, palette, '') : '';
    const textOverride = iconData?.textColor ? resolvePaletteColor(iconData.textColor, palette, '') : '';

    if (shape) {
        nextClassName = stripClasses(nextClassName, RADIUS_CLASS_RE);
        nextClassName = `${nextClassName} ${SHAPE_RADIUS_CLASS[shape]}`.trim();
        nextStyle.borderRadius = SHAPE_RADIUS_VALUE[shape];
    } else if (defaultShape && !hasClass(nextClassName, RADIUS_CLASS_RE)) {
        nextClassName = `${nextClassName} ${SHAPE_RADIUS_CLASS[defaultShape]}`.trim();
    }

    if (fill) {
        const accent = bgOverride || resolveButtonAccent(nextStyle);
        if (fill === 'outline') {
            nextClassName = stripClasses(nextClassName, SHADOW_CLASS_RE);
            nextStyle.background = 'transparent';
            nextStyle.backgroundColor = 'transparent';
            nextStyle.color = accent;
            nextStyle.border = `2px solid ${accent}`;
            nextStyle.boxShadow = 'none';
        } else if (fill === 'ghost') {
            nextClassName = stripClasses(nextClassName, SHADOW_CLASS_RE);
            nextStyle.background = 'transparent';
            nextStyle.backgroundColor = 'transparent';
            nextStyle.color = accent;
            nextStyle.border = 'none';
            nextStyle.boxShadow = 'none';
        } else if (fill === 'filled') {
            nextStyle.backgroundColor = accent;
            nextStyle.color = '#ffffff';
            nextStyle.border = 'none';
        }
    } else if (defaultFill === 'ghost' || defaultFill === 'outline') {
        nextClassName = stripClasses(nextClassName, SHADOW_CLASS_RE);
        if (bgOverride) {
            nextStyle.color = bgOverride;
            if (defaultFill === 'outline') {
                nextStyle.border = `2px solid ${bgOverride}`;
            }
        }
    } else if (bgOverride) {
        nextStyle.background = bgOverride;
        nextStyle.backgroundColor = bgOverride;
    }

    if (textOverride) {
        nextStyle.color = textOverride;
    }

    if (iconData?.iconOnly && iconData.icon) {
        nextClassName = stripClasses(stripClasses(nextClassName, PADDING_X_CLASS_RE), PADDING_Y_CLASS_RE);
        nextClassName = `${nextClassName} p-3`.trim();
    }

    return {
        className: normalizeClasses(nextClassName),
        style: Object.keys(nextStyle).length > 0 ? nextStyle : style,
    };
}

function resolveButtonAccent(style: React.CSSProperties): string {
    for (const value of [style.backgroundColor, style.background, style.borderColor, style.color]) {
        if (typeof value === 'string' && value && value !== 'transparent') {
            return value;
        }
    }
    return '#1f2937';
}

function stripClasses(className: string, pattern: RegExp): string {
    pattern.lastIndex = 0;
    return normalizeClasses(className.replace(pattern, ' '));
}

function hasClass(className: string, pattern: RegExp): boolean {
    pattern.lastIndex = 0;
    return pattern.test(className);
}

function normalizeClasses(className: string): string {
    return className.replace(/\s+/g, ' ').trim();
}
