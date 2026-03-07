'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useEditorContext, NavItem } from '@/lib/editor-context';
import NavItemEditModal from './NavItemEditModal';

export interface ButtonLinkData {
    label: string;
    linkType: 'page' | 'section' | 'custom';
    href: string;
    pageId?: string;
    blockId?: string;
}

interface EditableButtonProps {
    /** Key prefix for storing button data in block data */
    contentKey: string;
    /** Current button label */
    label?: string;
    /** Current link data (linkType, href, pageId, blockId) */
    linkData?: Partial<ButtonLinkData>;
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
 * In edit mode: clicking opens a modal to edit the label and link destination
 * (same modal as NavMenu items — page, section, or custom URL).
 * 
 * In preview/published mode: renders as an <a> tag that navigates to the configured link.
 */
export default function EditableButton({
    contentKey,
    label,
    linkData,
    defaultLabel = 'Get Started',
    isEditMode,
    onSave,
    className = '',
    style,
}: EditableButtonProps) {
    const context = useEditorContext();
    const [isEditing, setIsEditing] = useState(false);

    const pages = context?.pages || [];
    const blocks = context?.blocks || [];

    const currentLabel = label || defaultLabel;
    const currentLinkType = linkData?.linkType || 'custom';
    const currentHref = linkData?.href || '#';
    const currentPageId = linkData?.pageId || '';
    const currentBlockId = linkData?.blockId || '';

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

    // Resolve the href for rendering
    const resolveHref = (): string => {
        if (context && currentLinkType === 'page' && currentPageId) {
            // In editor, navigate to the page within the editor
            return `?siteId=${context.siteId}&pageId=${currentPageId}`;
        }
        if (currentLinkType === 'section' && currentBlockId) {
            return `#${currentBlockId}`;
        }
        return currentHref;
    };

    const isExternal = currentLinkType === 'custom' && currentHref.startsWith('http');

    // Edit mode: click to open modal
    if (isEditMode) {
        return (
            <>
                <div
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                    className={`${className} cursor-pointer relative group/btn inline-flex items-center justify-center`}
                    style={style}
                >
                    {currentLabel}
                    <span className="ml-2 opacity-0 group-hover/btn:opacity-100 transition-opacity">
                        <Pencil className="w-3.5 h-3.5" />
                    </span>
                </div>

                {isEditing && (
                    <NavItemEditModal
                        item={asNavItem}
                        pages={pages}
                        blocks={blocks.map(b => ({ id: b.id, type: b.type }))}
                        onSave={handleSave}
                        onClose={() => setIsEditing(false)}
                    />
                )}
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
            {currentLabel}
        </a>
    );
}
