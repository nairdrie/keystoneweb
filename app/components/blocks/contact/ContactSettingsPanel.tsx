'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Crown, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from '../BlockSettingsPanel';
import {
    InspectorSection,
    InspectorToggle,
    PaletteTokenButtons,
    getColorInputValue,
    useInspectorSectionState,
} from '../panel-shared';
import { LayoutTab } from '../layout/LayoutTab';
import type { BlockPanelProps } from '../block-panel-registry';
import {
    areSectionSettingsEqual,
    normalizeSectionSettings,
    type SectionSettings,
} from '@/lib/builder/layout-settings';
import {
    CONTACT_ICON_OPTIONS,
    ContactItem,
    SOCIAL_PLATFORM_OPTIONS,
    SocialLinkItem,
    createContactItem,
    createSocialLink,
    getContactIcon,
    getSocialIcon,
    getSocialPlatformLabel,
    normalizeContactItems,
    normalizeSocialLinks,
} from './contact-config';

type ContactDraft = {
    contactItems: ContactItem[];
    socialLinks: SocialLinkItem[];
    cardColumns: number;
    showTitle: boolean;
    title: string;
    showSubtitle: boolean;
    subtitle: string;
    showSocialHeading: boolean;
    socialHeading: string;
    backgroundColor: string;
    contactIconColor: string;
    socialIconColor: string;
    sectionSettings: SectionSettings;
    __customCss: string;
};

const SECTION_IDS = ['cards', 'social', 'universal-layout', 'display', 'style', 'advanced'];
const CONTACT_DRAFT_UPDATE_EVENT = 'ks:contact-draft-update';

export default function ContactSettingsPanel({
    blockId,
    blockType = 'contact',
    blockData,
    palette,
    isProUser,
    customCss,
    onClose,
    onDraftBlockDataChange,
}: BlockPanelProps) {
    const context = useEditorContext();
    const initialDraft = useMemo(
        () => buildInitialDraft(blockData || {}, customCss),
        [blockData, customCss],
    );
    const [draft, setDraft] = useState<ContactDraft>(initialDraft);
    const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
    const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
    const [draggedSocialId, setDraggedSocialId] = useState<string | null>(null);
    const [dragOverSocialId, setDragOverSocialId] = useState<string | null>(null);
    const sectionState = useInspectorSectionState(SECTION_IDS, true);

    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        onDraftBlockDataChange({
            ...(blockData || {}),
            ...draft,
        });
    }, [blockData, draft, onDraftBlockDataChange]);

    useEffect(() => {
        const handleCanvasDraftUpdate = (event: Event) => {
            const detail = (event as CustomEvent<{ blockId?: string; key?: string; value?: unknown }>).detail;
            if (!detail || detail.blockId !== blockId) return;
            if (detail.key === 'contactItems' && Array.isArray(detail.value)) {
                updateDraft({ contactItems: detail.value as ContactItem[] });
            }
            if (detail.key === 'socialLinks' && Array.isArray(detail.value)) {
                updateDraft({ socialLinks: detail.value as SocialLinkItem[] });
            }
        };

        window.addEventListener(CONTACT_DRAFT_UPDATE_EVENT, handleCanvasDraftUpdate);
        return () => window.removeEventListener(CONTACT_DRAFT_UPDATE_EVENT, handleCanvasDraftUpdate);
    }, [blockId]);

    const hasUnsavedChanges = useMemo(
        () => JSON.stringify(draft) !== JSON.stringify(initialDraft),
        [draft, initialDraft],
    );

    const updateDraft = (updates: Partial<ContactDraft>) => {
        setDraft((current) => ({ ...current, ...updates }));
    };

    const updateCard = (id: string, updates: Partial<ContactItem>) => {
        updateDraft({
            contactItems: draft.contactItems.map((item) => item.id === id ? { ...item, ...updates } : item),
        });
    };

    const reorderCard = (sourceId: string, targetId: string) => {
        updateDraft({ contactItems: reorderById(draft.contactItems, sourceId, targetId) });
    };

    const updateSocial = (id: string, updates: Partial<SocialLinkItem>) => {
        updateDraft({
            socialLinks: draft.socialLinks.map((item) => item.id === id ? { ...item, ...updates } : item),
        });
    };

    const reorderSocial = (sourceId: string, targetId: string) => {
        updateDraft({ socialLinks: reorderById(draft.socialLinks, sourceId, targetId) });
    };

    const handleSave = () => {
        const updates: Record<string, unknown> = {
            contactItems: draft.contactItems,
            socialLinks: draft.socialLinks,
            cardColumns: draft.cardColumns,
            showTitle: draft.showTitle,
            title: draft.title,
            showSubtitle: draft.showSubtitle,
            subtitle: draft.subtitle,
            showSocialHeading: draft.showSocialHeading,
            socialHeading: draft.socialHeading,
            backgroundColor: draft.backgroundColor,
            contactIconColor: draft.contactIconColor,
            socialIconColor: draft.socialIconColor,
            __customCss: draft.__customCss,
        };
        if (!areSectionSettingsEqual(draft.sectionSettings, initialDraft.sectionSettings)) {
            updates.sectionSettings = normalizeSectionSettings(draft.sectionSettings);
        }
        context?.updateBlockDataBatch?.(blockId, updates);
        onClose();
    };

    const handleReset = () => {
        setDraft(initialDraft);
        sectionState.reset();
    };

    return (
        <BlockSettingsPanel
            isOpen
            title="Contact Info Settings"
            subtitle="Manage contact cards, icons, social links, and section styling."
            blockId={blockId}
            blockType={blockType}
            hasUnsavedChanges={hasUnsavedChanges}
            onClose={onClose}
            onSave={handleSave}
            onReset={handleReset}
            allCollapsed={sectionState.allCollapsed}
            onToggleAllCollapsed={() => sectionState.setAll(!sectionState.allCollapsed)}
            tourId="contact-settings-panel"
        >
            <InspectorSection
                id="cards"
                title="Contact Cards"
                isCollapsed={sectionState.isCollapsed('cards')}
                onToggle={() => sectionState.toggle('cards')}
            >
                <div className="space-y-3">
                    {draft.contactItems.length === 0 && (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                            No contact cards are shown.
                        </p>
                    )}
                    {draft.contactItems.map((item, index) => (
                        <ContactCardEditor
                            key={item.id}
                            item={item}
                            index={index}
                            isDragging={draggedCardId === item.id}
                            isDragTarget={dragOverCardId === item.id && draggedCardId !== item.id}
                            onDragStart={(itemId) => {
                                setDraggedCardId(itemId);
                                setDragOverCardId(null);
                            }}
                            onDragOver={(itemId) => setDragOverCardId(itemId)}
                            onDrop={(targetId) => {
                                if (draggedCardId) reorderCard(draggedCardId, targetId);
                                setDraggedCardId(null);
                                setDragOverCardId(null);
                            }}
                            onDragEnd={() => {
                                setDraggedCardId(null);
                                setDragOverCardId(null);
                            }}
                            onDelete={() => updateDraft({ contactItems: draft.contactItems.filter((card) => card.id !== item.id) })}
                            onUpdate={(updates) => updateCard(item.id, updates)}
                        />
                    ))}
                    <button
                        type="button"
                        onClick={() => updateDraft({ contactItems: [...draft.contactItems, createContactItem(draft.contactItems.length)] })}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-3 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                    >
                        <Plus className="h-4 w-4" />
                        Add Contact Card
                    </button>
                </div>
            </InspectorSection>

            <InspectorSection
                id="social"
                title="Social Icons"
                isCollapsed={sectionState.isCollapsed('social')}
                onToggle={() => sectionState.toggle('social')}
            >
                <div className="space-y-3">
                    {draft.socialLinks.length === 0 && (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                            No social icons are shown. Add any platform below.
                        </p>
                    )}
                    {draft.socialLinks.map((item, index) => (
                        <SocialLinkEditor
                            key={item.id}
                            item={item}
                            index={index}
                            isDragging={draggedSocialId === item.id}
                            isDragTarget={dragOverSocialId === item.id && draggedSocialId !== item.id}
                            onDragStart={(itemId) => {
                                setDraggedSocialId(itemId);
                                setDragOverSocialId(null);
                            }}
                            onDragOver={(itemId) => setDragOverSocialId(itemId)}
                            onDrop={(targetId) => {
                                if (draggedSocialId) reorderSocial(draggedSocialId, targetId);
                                setDraggedSocialId(null);
                                setDragOverSocialId(null);
                            }}
                            onDragEnd={() => {
                                setDraggedSocialId(null);
                                setDragOverSocialId(null);
                            }}
                            onDelete={() => updateDraft({ socialLinks: draft.socialLinks.filter((link) => link.id !== item.id) })}
                            onUpdate={(updates) => updateSocial(item.id, updates)}
                        />
                    ))}
                    <button
                        type="button"
                        onClick={() => updateDraft({ socialLinks: [...draft.socialLinks, createSocialLink(draft.socialLinks.length)] })}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-3 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                    >
                        <Plus className="h-4 w-4" />
                        Add Social Icon
                    </button>
                </div>
            </InspectorSection>

            <InspectorSection
                id="universal-layout"
                title="Layout"
                isCollapsed={sectionState.isCollapsed('universal-layout')}
                onToggle={() => sectionState.toggle('universal-layout')}
            >
                <LayoutTab
                    blockId={blockId}
                    blockType={blockType}
                    value={draft.sectionSettings}
                    onChange={(sectionSettings) => updateDraft({ sectionSettings })}
                />
            </InspectorSection>

            <InspectorSection
                id="display"
                title="Display"
                isCollapsed={sectionState.isCollapsed('display')}
                onToggle={() => sectionState.toggle('display')}
            >
                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Card columns</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { value: 2, label: 'Two columns' },
                                { value: 1, label: 'One column' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => updateDraft({ cardColumns: option.value })}
                                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${draft.cardColumns === option.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <InspectorToggle
                        label="Show title"
                        checked={draft.showTitle}
                        onChange={() => updateDraft({ showTitle: !draft.showTitle })}
                    />
                    {draft.showTitle && (
                        <TextField
                            label="Title"
                            value={draft.title}
                            onChange={(value) => updateDraft({ title: value })}
                            placeholder="Get In Touch"
                        />
                    )}
                    <InspectorToggle
                        label="Show subtitle"
                        checked={draft.showSubtitle}
                        onChange={() => updateDraft({ showSubtitle: !draft.showSubtitle })}
                    />
                    {draft.showSubtitle && (
                        <TextField
                            label="Subtitle"
                            value={draft.subtitle}
                            onChange={(value) => updateDraft({ subtitle: value })}
                            placeholder="We'd love to hear from you. Reach out anytime."
                        />
                    )}
                    <InspectorToggle
                        label="Show social heading"
                        checked={draft.showSocialHeading}
                        onChange={() => updateDraft({ showSocialHeading: !draft.showSocialHeading })}
                    />
                    {draft.showSocialHeading && (
                        <TextField
                            label="Social heading"
                            value={draft.socialHeading}
                            onChange={(value) => updateDraft({ socialHeading: value })}
                            placeholder="Follow Us"
                        />
                    )}
                </div>
            </InspectorSection>

            <InspectorSection
                id="style"
                title="Style"
                isCollapsed={sectionState.isCollapsed('style')}
                onToggle={() => sectionState.toggle('style')}
            >
                <div className="space-y-5">
                    <ColorSetting
                        id={`${blockId}-contact-bg`}
                        label="Section background color"
                        value={draft.backgroundColor}
                        palette={palette}
                        fallback="#ffffff"
                        onChange={(value) => updateDraft({ backgroundColor: value })}
                    />
                    <ColorSetting
                        id={`${blockId}-contact-card-icon`}
                        label="Contact card icon color"
                        value={draft.contactIconColor}
                        palette={palette}
                        fallback={palette.secondary || '#dc2626'}
                        onChange={(value) => updateDraft({ contactIconColor: value })}
                    />
                    <ColorSetting
                        id={`${blockId}-social-icon`}
                        label="Social icon color"
                        value={draft.socialIconColor}
                        palette={palette}
                        fallback={palette.secondary || '#dc2626'}
                        onChange={(value) => updateDraft({ socialIconColor: value })}
                    />
                </div>
            </InspectorSection>

            <InspectorSection
                id="advanced"
                title="Advanced"
                isCollapsed={sectionState.isCollapsed('advanced')}
                onToggle={() => sectionState.toggle('advanced')}
            >
                {isProUser ? (
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-contact-css`}>
                            Custom CSS
                        </label>
                        <textarea
                            id={`${blockId}-contact-css`}
                            value={draft.__customCss}
                            onChange={(event) => updateDraft({ __customCss: event.target.value })}
                            placeholder={`/* Scoped to this block */\nsection {\n  padding-top: 5rem;\n}`}
                            className="mt-2 min-h-40 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-green-400 outline-none selection:bg-green-900 focus:ring-2 focus:ring-blue-500"
                            spellCheck={false}
                        />
                    </div>
                ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                        <div className="flex items-center gap-2 font-bold">
                            <Crown className="h-4 w-4" />
                            Custom CSS is a Pro feature
                        </div>
                        <p className="mt-1 text-xs text-amber-700">Upgrade to add scoped CSS to this block.</p>
                    </div>
                )}
            </InspectorSection>
        </BlockSettingsPanel>
    );
}

function ContactCardEditor({
    item,
    index,
    isDragging,
    isDragTarget,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onDelete,
    onUpdate,
}: {
    item: ContactItem;
    index: number;
    isDragging: boolean;
    isDragTarget: boolean;
    onDragStart: (id: string) => void;
    onDragOver: (id: string) => void;
    onDrop: (id: string) => void;
    onDragEnd: () => void;
    onDelete: () => void;
    onUpdate: (updates: Partial<ContactItem>) => void;
}) {
    const Icon = getContactIcon(item.icon);
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div
            className={`rounded-xl border bg-white p-3 shadow-sm transition-[border-color,box-shadow,opacity,transform] ${isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'} ${isDragging ? 'opacity-50 scale-[0.99]' : ''}`}
            onDragOver={(event) => {
                event.preventDefault();
                onDragOver(item.id);
            }}
            onDrop={(event) => {
                event.preventDefault();
                onDrop(item.id);
            }}
        >
            <div className={`flex items-center justify-between gap-2 ${isExpanded ? 'mb-3' : ''}`}>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', item.id);
                            onDragStart(item.id);
                        }}
                        onDragEnd={onDragEnd}
                        className="cursor-grab rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
                        title="Drag to reorder contact card"
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Icon className="h-4 w-4" />
                    </span>
                    <div>
                        <p className="text-sm font-bold text-slate-800">{item.label || 'Contact card'}</p>
                        <p className="text-xs text-slate-400">Card {index + 1}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setIsExpanded((current) => !current)}
                        className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        title={isExpanded ? 'Collapse contact card' : 'Expand contact card'}
                        aria-expanded={isExpanded}
                    >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <ItemControls
                        onDelete={onDelete}
                        deleteLabel="Delete contact card"
                    />
                </div>
            </div>

            {isExpanded && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                    <IconSelect
                        label="Icon"
                        value={item.icon}
                        options={CONTACT_ICON_OPTIONS}
                        onChange={(value) => onUpdate({ icon: value })}
                    />
                    <TextField label="Label" value={item.label} onChange={(value) => onUpdate({ label: value })} />
                    <TextareaField label="Value" value={item.value} onChange={(value) => onUpdate({ value })} />
                    <SelectField
                        label="Link behavior"
                        value={item.linkType || 'auto'}
                        onChange={(value) => onUpdate({ linkType: value as ContactItem['linkType'] })}
                        options={[
                            { value: 'auto', label: 'Auto-detect' },
                            { value: 'none', label: 'No link' },
                            { value: 'phone', label: 'Phone link' },
                            { value: 'email', label: 'Email link' },
                            { value: 'address', label: 'Map link' },
                            { value: 'url', label: 'Website URL' },
                        ]}
                    />
                    <TextField
                        label="Custom URL"
                        value={item.href || ''}
                        onChange={(value) => onUpdate({ href: value })}
                        placeholder="Optional override"
                    />
                </div>
            )}
        </div>
    );
}

function SocialLinkEditor({
    item,
    index,
    isDragging,
    isDragTarget,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onDelete,
    onUpdate,
}: {
    item: SocialLinkItem;
    index: number;
    isDragging: boolean;
    isDragTarget: boolean;
    onDragStart: (id: string) => void;
    onDragOver: (id: string) => void;
    onDrop: (id: string) => void;
    onDragEnd: () => void;
    onDelete: () => void;
    onUpdate: (updates: Partial<SocialLinkItem>) => void;
}) {
    const Icon = getSocialIcon(item.platform);
    const platformLabel = getSocialPlatformLabel(item.platform);
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div
            className={`rounded-xl border bg-white p-3 shadow-sm transition-[border-color,box-shadow,opacity,transform] ${isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'} ${isDragging ? 'opacity-50 scale-[0.99]' : ''}`}
            onDragOver={(event) => {
                event.preventDefault();
                onDragOver(item.id);
            }}
            onDrop={(event) => {
                event.preventDefault();
                onDrop(item.id);
            }}
        >
            <div className={`flex items-center justify-between gap-2 ${isExpanded ? 'mb-3' : ''}`}>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', item.id);
                            onDragStart(item.id);
                        }}
                        onDragEnd={onDragEnd}
                        className="cursor-grab rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
                        title="Drag to reorder social icon"
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <Icon className="h-4 w-4" />
                    </span>
                    <div>
                        <p className="text-sm font-bold text-slate-800">{platformLabel}</p>
                        <p className="text-xs text-slate-400">Icon {index + 1}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setIsExpanded((current) => !current)}
                        className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        title={isExpanded ? 'Collapse social icon' : 'Expand social icon'}
                        aria-expanded={isExpanded}
                    >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <ItemControls
                        onDelete={onDelete}
                        deleteLabel="Delete social icon"
                    />
                </div>
            </div>
            {isExpanded && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                    <IconSelect
                        label="Platform"
                        value={item.platform}
                        options={SOCIAL_PLATFORM_OPTIONS}
                        onChange={(value) => {
                            onUpdate({ platform: value, label: getSocialPlatformLabel(value) });
                        }}
                    />
                    <TextField label="URL" value={item.url} onChange={(value) => onUpdate({ url: value })} placeholder="https://..." />
                </div>
            )}
        </div>
    );
}

function ItemControls({
    onDelete,
    deleteLabel,
}: {
    onDelete: () => void;
    deleteLabel: string;
}) {
    return (
        <div className="flex overflow-hidden rounded-md border border-slate-200">
            <button
                type="button"
                onClick={onDelete}
                className="p-1.5 text-red-500 transition-colors hover:bg-red-50"
                title={deleteLabel}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
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

function IconSelect<T extends { key: string; label: string; Icon: React.ComponentType<{ className?: string }> }>({
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
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <div className="grid grid-cols-2 gap-2">
                {options.map((option) => {
                    const Icon = option.Icon;
                    const selected = value === option.key;
                    return (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => onChange(option.key)}
                            className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-semibold transition-colors ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{option.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function TextField({ label, value, onChange, placeholder }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
}

function TextareaField({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={2}
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
}

function SelectField({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </div>
    );
}

function ColorSetting({
    id,
    label,
    value,
    palette,
    fallback,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    palette: Record<string, string>;
    fallback: string;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={id}>
                {label}
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                    id={id}
                    type="color"
                    value={getColorInputValue(value, palette, fallback)}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                />
                <PaletteTokenButtons
                    selected={value}
                    palette={palette}
                    onSelect={onChange}
                />
            </div>
            <div className="mt-3 flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Default"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                    Reset
                </button>
            </div>
        </div>
    );
}

function buildInitialDraft(blockData: Record<string, any>, customCss: string): ContactDraft {
    return {
        contactItems: normalizeContactItems(blockData),
        socialLinks: normalizeSocialLinks(blockData),
        cardColumns: Number(blockData.cardColumns) === 1 ? 1 : 2,
        showTitle: blockData.showTitle !== false,
        title: typeof blockData.title === 'string' ? blockData.title : 'Get In Touch',
        showSubtitle: blockData.showSubtitle !== false,
        subtitle: typeof blockData.subtitle === 'string' ? blockData.subtitle : "We'd love to hear from you. Reach out anytime.",
        showSocialHeading: blockData.showSocialHeading !== false,
        socialHeading: typeof blockData.socialHeading === 'string' ? blockData.socialHeading : 'Follow Us',
        backgroundColor: typeof blockData.backgroundColor === 'string' ? blockData.backgroundColor : '',
        contactIconColor: typeof blockData.contactIconColor === 'string' ? blockData.contactIconColor : '',
        socialIconColor: typeof blockData.socialIconColor === 'string' ? blockData.socialIconColor : '',
        sectionSettings: normalizeSectionSettings(blockData.sectionSettings),
        __customCss: customCss,
    };
}
