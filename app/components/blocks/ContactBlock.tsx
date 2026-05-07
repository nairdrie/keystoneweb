'use client';

import React, { useEffect, useState } from 'react';
import EditableText from '../EditableText';
import { AlertTriangle, GripVertical, Plus, Settings, Trash2, X } from 'lucide-react';
import { resolvePaletteColor } from '@/lib/palette-colors';
import {
    CONTACT_ICON_OPTIONS,
    ContactItem,
    SOCIAL_PLATFORM_OPTIONS,
    SocialLinkItem,
    createContactItem,
    createSocialLink,
    getContactHref,
    getContactIcon,
    getSocialIcon,
    getSocialPlatformLabel,
    normalizeContactItems,
    normalizeHref,
    normalizeSocialLinks,
} from './contact/contact-config';

interface ContactBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function ContactBlock({ data, isEditMode, palette, updateContent }: ContactBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, pAccent);
    const contactIconColor = resolvePaletteColor(data.contactIconColor, palette, pSecondary);
    const socialIconColor = resolvePaletteColor(data.socialIconColor, palette, pSecondary);

    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
    const [draggedContactId, setDraggedContactId] = useState<string | null>(null);
    const [dragOverContactId, setDragOverContactId] = useState<string | null>(null);
    const [draggedSocialId, setDraggedSocialId] = useState<string | null>(null);
    const [dragOverSocialId, setDragOverSocialId] = useState<string | null>(null);

    const contactItems = normalizeContactItems(data);
    const socialLinks = normalizeSocialLinks(data);
    const cardColumns = Number(data.cardColumns) === 1 ? 1 : 2;
    const showTitle = data.showTitle !== false;
    const showSubtitle = data.showSubtitle !== false;
    const showSocialHeading = data.showSocialHeading !== false;
    const socialHeading = typeof data.socialHeading === 'string' && data.socialHeading.trim() ? data.socialHeading : 'Follow Us';
    const visibleSocialLinks = socialLinks.filter((link) => isEditMode || link.url.trim());

    const updateContactItems = (items: ContactItem[]) => updateContent('contactItems', items);
    const updateSocialLinks = (links: SocialLinkItem[]) => updateContent('socialLinks', links);

    const updateContactItem = (id: string, updates: Partial<ContactItem>) => {
        updateContactItems(contactItems.map((item) => item.id === id ? { ...item, ...updates } : item));
    };

    const reorderContactItem = (sourceId: string, targetId: string) => {
        updateContactItems(reorderById(contactItems, sourceId, targetId));
    };

    const removeContactItem = (id: string) => {
        updateContactItems(contactItems.filter((item) => item.id !== id));
        if (editingContactId === id) setEditingContactId(null);
    };

    const addContactItem = () => {
        const nextItem = createContactItem(contactItems.length);
        updateContactItems([...contactItems, nextItem]);
        setEditingContactId(nextItem.id);
    };

    const updateSocialLink = (id: string, updates: Partial<SocialLinkItem>) => {
        updateSocialLinks(socialLinks.map((link) => link.id === id ? { ...link, ...updates } : link));
    };

    const removeSocialLink = (id: string) => {
        updateSocialLinks(socialLinks.filter((link) => link.id !== id));
        if (editingSocialId === id) setEditingSocialId(null);
    };

    const addSocialLink = () => {
        const nextLink = createSocialLink(socialLinks.length);
        updateSocialLinks([...socialLinks, nextLink]);
        setEditingSocialId(nextLink.id);
    };

    const reorderSocialLink = (sourceId: string, targetId: string) => {
        updateSocialLinks(reorderById(socialLinks, sourceId, targetId));
    };

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-5xl mx-auto px-4">
                {(showTitle || showSubtitle) && (
                    <div className="mb-16 text-center">
                        {showTitle && (
                            <EditableText
                                as="h2"
                                contentKey="title"
                                content={data.title}
                                defaultValue="Get In Touch"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className={`text-4xl font-bold ${showSubtitle ? 'mb-4' : ''}`}
                                style={{ color: pPrimary }}
                            />
                        )}
                        {showSubtitle && (
                            <EditableText
                                as="p"
                                contentKey="subtitle"
                                content={data.subtitle}
                                defaultValue="We'd love to hear from you. Reach out anytime."
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="mx-auto max-w-2xl text-lg"
                                style={{ color: pPrimary, opacity: 0.7 }}
                            />
                        )}
                    </div>
                )}

                {contactItems.length > 0 ? (
                    <div className={`grid gap-6 ${cardColumns === 1 ? 'max-w-2xl mx-auto' : 'md:grid-cols-2'}`}>
                        {contactItems.map((item, index) => (
                            <ContactInfoCard
                                key={item.id}
                                item={item}
                                index={index}
                                isEditMode={isEditMode}
                                primaryColor={pPrimary}
                                secondaryColor={contactIconColor}
                                isPanelOpen={editingContactId === item.id}
                                isDragging={draggedContactId === item.id}
                                isDragTarget={dragOverContactId === item.id && draggedContactId !== item.id}
                                onDragStart={(itemId) => {
                                    setDraggedContactId(itemId);
                                    setDragOverContactId(null);
                                }}
                                onDragOver={(itemId) => setDragOverContactId(itemId)}
                                onDrop={(targetId) => {
                                    if (draggedContactId) reorderContactItem(draggedContactId, targetId);
                                    setDraggedContactId(null);
                                    setDragOverContactId(null);
                                }}
                                onDragEnd={() => {
                                    setDraggedContactId(null);
                                    setDragOverContactId(null);
                                }}
                                onRemove={removeContactItem}
                                onUpdate={updateContactItem}
                                onTogglePanel={() => setEditingContactId(editingContactId === item.id ? null : item.id)}
                            />
                        ))}
                    </div>
                ) : isEditMode ? (
                    <div className="rounded-xl border border-dashed border-blue-300 bg-white/70 p-8 text-center shadow-sm">
                        <p className="text-sm font-semibold text-slate-600">No contact cards yet.</p>
                        <button
                            type="button"
                            onClick={addContactItem}
                            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                        >
                            <Plus className="h-4 w-4" />
                            Add Contact Card
                        </button>
                    </div>
                ) : null}

                {isEditMode && contactItems.length > 0 && (
                    <div className="mt-6 flex justify-center">
                        <button
                            type="button"
                            onClick={addContactItem}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                        >
                            <Plus className="h-4 w-4" />
                            Add Contact Card
                        </button>
                    </div>
                )}

                {(isEditMode || visibleSocialLinks.length > 0) && (
                    <div className="mt-10 flex flex-col items-center gap-4">
                        {showSocialHeading && (
                            <EditableText
                                as="p"
                                contentKey="socialHeading"
                                content={data.socialHeading}
                                defaultValue={socialHeading}
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-sm font-semibold uppercase tracking-wider"
                                style={{ color: pPrimary, opacity: 0.55 }}
                            />
                        )}

                        {visibleSocialLinks.length > 0 ? (
                            <div className="flex items-center gap-3 flex-wrap justify-center">
                                {visibleSocialLinks.map((link) => (
                                    <SocialIconControl
                                        key={link.id}
                                        link={link}
                                        isEditMode={isEditMode}
                                        isPanelOpen={editingSocialId === link.id}
                                        secondaryColor={socialIconColor}
                                        onTogglePanel={() => setEditingSocialId(editingSocialId === link.id ? null : link.id)}
                                        onUpdate={updateSocialLink}
                                        onRemove={removeSocialLink}
                                        isDragging={draggedSocialId === link.id}
                                        isDragTarget={dragOverSocialId === link.id && draggedSocialId !== link.id}
                                        onDragStart={(itemId) => {
                                            setDraggedSocialId(itemId);
                                            setDragOverSocialId(null);
                                        }}
                                        onDragOver={(itemId) => setDragOverSocialId(itemId)}
                                        onDrop={(targetId) => {
                                            if (draggedSocialId) reorderSocialLink(draggedSocialId, targetId);
                                            setDraggedSocialId(null);
                                            setDragOverSocialId(null);
                                        }}
                                        onDragEnd={() => {
                                            setDraggedSocialId(null);
                                            setDragOverSocialId(null);
                                        }}
                                    />
                                ))}
                            </div>
                        ) : isEditMode ? (
                            <p className="text-xs text-slate-500">Use Add Social Icon below to choose a platform and URL.</p>
                        ) : null}

                        {isEditMode && (
                            <button
                                type="button"
                                onClick={addSocialLink}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Social Icon
                            </button>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

function ContactInfoCard({
    item,
    index,
    isEditMode,
    primaryColor,
    secondaryColor,
    isPanelOpen,
    isDragging,
    isDragTarget,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onRemove,
    onUpdate,
    onTogglePanel,
}: {
    item: ContactItem;
    index: number;
    isEditMode: boolean;
    primaryColor: string;
    secondaryColor: string;
    isPanelOpen: boolean;
    isDragging: boolean;
    isDragTarget: boolean;
    onDragStart: (id: string) => void;
    onDragOver: (id: string) => void;
    onDrop: (id: string) => void;
    onDragEnd: () => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, updates: Partial<ContactItem>) => void;
    onTogglePanel: () => void;
}) {
    const Icon = getContactIcon(item.icon);
    const href = getContactHref(item);
    const content = (
        <div className="flex items-start gap-4">
            <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${secondaryColor}15`, color: secondaryColor }}
            >
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <EditableText
                    as="p"
                    contentKey={`contact_${item.id}_label`}
                    content={item.label}
                    defaultValue="Contact"
                    isEditMode={isEditMode}
                    onSave={(_key, value) => onUpdate(item.id, { label: value })}
                    className="mb-1 text-sm font-semibold uppercase tracking-wider text-gray-400"
                />
                <EditableText
                    as="p"
                    contentKey={`contact_${item.id}_value`}
                    content={item.value}
                    defaultValue="Add contact details"
                    isEditMode={isEditMode}
                    onSave={(_key, value) => onUpdate(item.id, { value })}
                    className="font-medium text-gray-800"
                />
            </div>
        </div>
    );
    const className = `group/card relative rounded-xl border bg-white p-6 shadow-sm transition-[border-color,box-shadow,opacity,transform] hover:shadow-md ${isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'} ${isDragging ? 'opacity-50 scale-[0.99]' : ''}`;

    return (
        <div
            className={className}
            onDragOver={(event) => {
                if (!isEditMode) return;
                event.preventDefault();
                onDragOver(item.id);
            }}
            onDrop={(event) => {
                if (!isEditMode) return;
                event.preventDefault();
                onDrop(item.id);
            }}
        >
            {isEditMode && (
                <div className={`absolute right-2 top-2 z-10 flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition-opacity ${isPanelOpen ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}>
                    <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', item.id);
                            onDragStart(item.id);
                        }}
                        onDragEnd={onDragEnd}
                        className="cursor-grab p-1.5 text-slate-500 transition-colors hover:bg-slate-50 active:cursor-grabbing"
                        title="Drag to reorder contact card"
                    >
                        <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={onTogglePanel}
                        className={`border-l border-slate-100 p-1.5 transition-colors hover:bg-slate-50 ${isPanelOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-500'}`}
                        title="Edit contact card settings"
                    >
                        <Settings className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="border-l border-slate-100 p-1.5 text-red-500 transition-colors hover:bg-red-50"
                        title="Delete contact card"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
            {!isEditMode && href ? (
                <a
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-4"
                    style={{ color: primaryColor }}
                >
                    {content}
                </a>
            ) : (
                content
            )}
            {isEditMode && isPanelOpen && (
                <ContactInlinePanel
                    item={item}
                    onUpdate={(updates) => onUpdate(item.id, updates)}
                    onClose={onTogglePanel}
                />
            )}
        </div>
    );
}

function ContactInlinePanel({
    item,
    onUpdate,
    onClose,
}: {
    item: ContactItem;
    onUpdate: (updates: Partial<ContactItem>) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState<ContactItem>(item);

    useEffect(() => {
        setDraft(item);
    }, [item]);

    const updateDraft = (updates: Partial<ContactItem>) => {
        setDraft((current) => ({ ...current, ...updates }));
    };

    const discardDraft = () => {
        setDraft(item);
        onClose();
    };

    const applyDraft = () => {
        onUpdate({
            icon: draft.icon,
            label: draft.label,
            value: draft.value,
            linkType: draft.linkType,
            href: draft.href,
        });
        onClose();
    };

    return (
        <div className="absolute right-2 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Contact Card</p>
                <button
                    type="button"
                    onClick={discardDraft}
                    className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Close contact card settings"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            <div className="space-y-3">
                <InlineTextField label="Label" value={draft.label} onChange={(value) => updateDraft({ label: value })} />
                <InlineTextareaField label="Value" value={draft.value} onChange={(value) => updateDraft({ value })} />
                <InlineIconGrid
                    label="Icon"
                    value={draft.icon}
                    options={CONTACT_ICON_OPTIONS}
                    onChange={(value) => updateDraft({ icon: value })}
                />
                <InlineSelect
                    label="Link behavior"
                    value={draft.linkType || 'auto'}
                    onChange={(value) => updateDraft({ linkType: value as ContactItem['linkType'] })}
                    options={[
                        { value: 'auto', label: 'Auto-detect' },
                        { value: 'none', label: 'No link' },
                        { value: 'phone', label: 'Phone link' },
                        { value: 'email', label: 'Email link' },
                        { value: 'address', label: 'Map link' },
                        { value: 'url', label: 'Website URL' },
                    ]}
                />
                <InlineTextField label="Custom URL" value={draft.href || ''} onChange={(value) => updateDraft({ href: value })} placeholder="Optional override" />
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                        type="button"
                        onClick={discardDraft}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100"
                    >
                        Discard
                    </button>
                    <button
                        type="button"
                        onClick={applyDraft}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}

function SocialIconControl({
    link,
    isEditMode,
    isPanelOpen,
    isDragging,
    isDragTarget,
    secondaryColor,
    onTogglePanel,
    onUpdate,
    onRemove,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
}: {
    link: SocialLinkItem;
    isEditMode: boolean;
    isPanelOpen: boolean;
    isDragging: boolean;
    isDragTarget: boolean;
    secondaryColor: string;
    onTogglePanel: () => void;
    onUpdate: (id: string, updates: Partial<SocialLinkItem>) => void;
    onRemove: (id: string) => void;
    onDragStart: (id: string) => void;
    onDragOver: (id: string) => void;
    onDrop: (id: string) => void;
    onDragEnd: () => void;
}) {
    const Icon = getSocialIcon(link.platform);
    const label = getSocialPlatformLabel(link.platform);
    const url = link.url.trim();
    const shouldWarn = !url;
    const [draft, setDraft] = useState<SocialLinkItem>({
        ...link,
        label,
    });

    useEffect(() => {
        setDraft({
            ...link,
            label: getSocialPlatformLabel(link.platform),
        });
    }, [link]);

    const updateDraft = (updates: Partial<SocialLinkItem>) => {
        setDraft((current) => {
            const next = { ...current, ...updates };
            if (updates.platform) {
                next.label = getSocialPlatformLabel(updates.platform);
            }
            return next;
        });
    };

    const discardDraft = () => {
        setDraft({
            ...link,
            label: getSocialPlatformLabel(link.platform),
        });
        onTogglePanel();
    };

    const applyDraft = () => {
        onUpdate(link.id, {
            platform: draft.platform,
            label: getSocialPlatformLabel(draft.platform),
            url: draft.url,
        });
        onTogglePanel();
    };

    if (!isEditMode && url) {
        return (
            <a
                href={normalizeHref(url)}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:scale-110 hover:opacity-80"
                style={{ backgroundColor: `${secondaryColor}15`, color: secondaryColor }}
            >
                <Icon className="h-4 w-4" />
            </a>
        );
    }

    if (!isEditMode) return null;

    return (
        <span
            className={`relative group/social rounded-full transition-[box-shadow,opacity,transform] ${isDragTarget ? 'ring-2 ring-blue-300 ring-offset-4' : ''} ${isDragging ? 'opacity-50 scale-95' : ''}`}
            onDragOver={(event) => {
                event.preventDefault();
                onDragOver(link.id);
            }}
            onDrop={(event) => {
                event.preventDefault();
                onDrop(link.id);
            }}
        >
            <button
                type="button"
                title={url ? `Edit ${label}` : `${label} has no URL yet`}
                onClick={isPanelOpen ? discardDraft : onTogglePanel}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all hover:scale-110 ${isPanelOpen ? 'ring-2 ring-blue-500 ring-offset-2' : url ? 'ring-2 ring-offset-1' : 'opacity-40 hover:opacity-75'}`}
                style={{ backgroundColor: `${secondaryColor}15`, color: secondaryColor }}
            >
                <Icon className="h-4 w-4" />
            </button>
            {shouldWarn && (
                <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
                    <AlertTriangle className="h-2.5 w-2.5" />
                </span>
            )}
            <div className={`absolute left-1/2 top-[-2.15rem] z-20 flex -translate-x-1/2 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition-opacity ${isPanelOpen ? 'opacity-100' : 'opacity-0 group-hover/social:opacity-100'}`}>
                <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', link.id);
                        onDragStart(link.id);
                    }}
                    onDragEnd={onDragEnd}
                    className="cursor-grab p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 active:cursor-grabbing"
                    title="Drag to reorder social icon"
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={isPanelOpen ? discardDraft : onTogglePanel}
                    className={`border-l border-slate-100 p-1.5 transition-colors hover:bg-slate-50 ${isPanelOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                    title={`Edit ${label}`}
                >
                    <Settings className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => onRemove(link.id)}
                    className="border-l border-slate-100 p-1.5 text-red-500 transition-colors hover:bg-red-50"
                    title={`Remove ${label}`}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
            {shouldWarn && !isPanelOpen && (
                <div className="pointer-events-none absolute left-1/2 top-12 z-20 w-56 -translate-x-1/2 translate-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800 opacity-0 shadow-lg transition-all group-hover/social:translate-y-0 group-hover/social:opacity-100">
                    No link set up yet. Add a URL before publishing this icon.
                </div>
            )}
            {isPanelOpen && (
                <div className="absolute left-1/2 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Social Icon</p>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={discardDraft}
                                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                title="Close social icon settings"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <InlineIconGrid
                            label="Platform"
                            value={draft.platform}
                            options={SOCIAL_PLATFORM_OPTIONS}
                            onChange={(value) => updateDraft({ platform: value })}
                        />
                        <InlineTextField label="URL" value={draft.url} onChange={(value) => updateDraft({ url: value })} placeholder="https://..." />
                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                            <button
                                type="button"
                                onClick={discardDraft}
                                className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100"
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={applyDraft}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </span>
    );
}

function reorderById<T extends { id: string }>(items: T[], sourceId: string, targetId: string): T[] {
    if (sourceId === targetId) return items;
    const sourceIndex = items.findIndex((item) => item.id === sourceId);
    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return items;

    const next = [...items];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
}

function InlineIconGrid<T extends { key: string; label: string; Icon: React.ComponentType<{ className?: string }> }>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: readonly T[];
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto pr-1">
                {options.map((option) => {
                    const Icon = option.Icon;
                    const selected = value === option.key;
                    return (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => onChange(option.key)}
                            className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs font-semibold transition-colors ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{option.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function InlineTextField({ label, value, onChange, placeholder }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
        </label>
    );
}

function InlineTextareaField({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={2}
                className="w-full resize-y rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
        </label>
    );
}

function InlineSelect({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </label>
    );
}
