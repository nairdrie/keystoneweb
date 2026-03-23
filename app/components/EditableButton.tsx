'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil, Settings } from 'lucide-react';
import * as Icons from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEditorContext, NavItem } from '@/lib/editor-context';
import NavItemEditModal from './NavItemEditModal';
import ButtonSettingsModal from './ButtonSettingsModal';

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
}

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
    onSave: (key: string, value: any) => void;
    /** Button styling className */
    className?: string;
    /** Button inline styles */
    style?: React.CSSProperties;
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
}: EditableButtonProps) {
    const context = useEditorContext();
    const [isEditing, setIsEditing] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [controlsOnLeft, setControlsOnLeft] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pages = context?.pages || [];
    const blocks = context?.blocks || [];

    const currentLabel = label || defaultLabel;
    const currentLinkType = linkData?.linkType || 'custom';
    const currentHref = linkData?.href || '#';
    const currentPageId = linkData?.pageId || '';
    const currentBlockId = linkData?.blockId || '';

    const currentIcon = iconData?.icon;
    const currentIconPosition = iconData?.iconPosition || 'left';

    // Detect if we should show controls on the left based on screen position
    useEffect(() => {
        if (isEditMode && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceOnRight = window.innerWidth - rect.right;
            // If less than 100px on right, flip controls to left
            if (spaceOnRight < 100) {
                setControlsOnLeft(true);
            } else {
                setControlsOnLeft(false);
            }
        }
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
                return `/editor?siteId=${context.siteId}&pageId=${currentPageId}`;
            } else {
                // Public site, navigate using standard slug
                const targetPage = pages.find(p => p.id === currentPageId);
                const slug = targetPage ? targetPage.slug : '';
                return slug === 'home' ? '/' : `/${slug}`;
            }
        }
        if (currentLinkType === 'section' && currentBlockId) {
            // Use the stored href if available (it's already been resolved to /page#section)
            if (currentHref && currentHref !== '#' && !currentHref.startsWith('http')) {
                return currentHref;
            }
            return `#${currentBlockId}`;
        }
        return currentHref;
    };

    const isExternal = currentLinkType === 'custom' && currentHref.startsWith('http');

    // Render Icon if present
    const IconComponent = currentIcon ? (Icons as any)[currentIcon] : null;

    const renderButtonContent = () => (
        <span className="flex items-center gap-2 pointer-events-none">
            {IconComponent && currentIconPosition === 'left' && <IconComponent className="w-[1.2em] h-[1.2em] shrink-0" />}
            <span>{currentLabel}</span>
            {IconComponent && currentIconPosition === 'right' && <IconComponent className="w-[1.2em] h-[1.2em] shrink-0" />}
        </span>
    );

    // Edit mode: click to open modal
    if (isEditMode) {
        return (
            <>
                <div
                    ref={containerRef}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                    className={`${className} cursor-pointer relative group/btn inline-flex items-center justify-center`}
                    style={style}
                >
                    {renderButtonContent()}
                    
                    {/* Floating controls on hover */}
                    <span 
                        className={`absolute top-1/2 -translate-y-1/2 items-center gap-1 z-50 hidden md:flex opacity-0 group-hover/btn:opacity-100 transition-all scale-90 group-hover/btn:scale-100 ${
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
                            title="Button Settings"
                        >
                            <Settings className="w-3.5 h-3.5" />
                        </button>
                    </span>
                    
                    {/* Mobile fallback indicator */}
                    <span className="ml-2 md:hidden opacity-50">
                        <Pencil className="w-3.5 h-3.5" />
                    </span>
                </div>

                {isEditing && (
                    <NavItemEditModal
                        item={asNavItem}
                        pages={pages}
                        blocks={blocks}
                        siteId={context?.siteId}
                        onSave={handleSave}
                        onClose={() => setIsEditing(false)}
                    />
                )}

                <ButtonSettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onSave={handleSaveSettings}
                    initialSettings={iconData}
                />
            </>
        );
    }

    // Published mode: render as a link
    const href = resolveHref();

    return (
        <a
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className={className}
            style={style}
        >
            {renderButtonContent()}
        </a>
    );
}
