'use client';

import React, { useState, useRef } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import EditableText from '../EditableText';
import {
    Plus, FileText, Image as ImageIcon, ExternalLink,
    AlignLeft, Upload, X, Download, ChevronDown, ChevronUp, Link2
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { resolvePaletteColor } from '@/lib/palette-colors';
import { normalizeExternalHref } from '@/lib/url';
import InlineCardControls, { reorderItems } from './InlineCardControls';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceType = 'file' | 'text' | 'link';

interface ResourceItem {
    id: string;
    type: ResourceType;
    title: string;
    description?: string;
    // file
    fileUrl?: string;
    fileName?: string;
    fileType?: 'pdf' | 'image';
    // text
    body?: string;
    // link
    url?: string;
    openInNewTab?: boolean;
}

interface ResourcesBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeIcon(type: ResourceType, fileType?: string) {
    if (type === 'file') return fileType === 'image' ? ImageIcon : FileText;
    if (type === 'text') return AlignLeft;
    return Link2;
}

function typeLabel(type: ResourceType, fileType?: string) {
    if (type === 'file') return fileType === 'image' ? 'Image' : 'PDF';
    if (type === 'text') return 'Article';
    return 'Link';
}

function typeBadgeColors(type: ResourceType, fileType?: string): { bg: string; text: string } {
    if (type === 'file' && fileType === 'image') return { bg: '#ede9fe', text: '#7c3aed' };
    if (type === 'file') return { bg: '#fee2e2', text: '#dc2626' };
    if (type === 'text') return { bg: '#dbeafe', text: '#2563eb' };
    return { bg: '#d1fae5', text: '#059669' };
}

// ─── Expanded text view (used in both variants) ────────────────────────────────

function TextExpander({ item, isEditMode, onUpdate, primaryColor }: {
    item: ResourceItem;
    isEditMode: boolean;
    onUpdate: (field: string, value: any) => void;
    primaryColor: string;
}) {
    const [expanded, setExpanded] = useState(false);

    if (isEditMode) {
        return (
            <textarea
                value={item.body || ''}
                onChange={e => onUpdate('body', e.target.value)}
                placeholder="Write the resource content here…"
                rows={5}
                className="w-full mt-2 text-sm border border-dashed border-slate-300 rounded-lg p-3 resize-y focus:outline-none focus:border-blue-400 bg-slate-50"
            />
        );
    }

    if (!item.body) return null;

    return (
        <div className="mt-2">
            <div
                className={`text-sm leading-relaxed overflow-hidden transition-all duration-300 ${expanded ? 'max-h-[2000px]' : 'max-h-24'}`}
                style={{ color: primaryColor, opacity: 0.75 }}
            >
                {item.body}
            </div>
            <button
                onClick={() => setExpanded(v => !v)}
                className="mt-1 flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: primaryColor }}
            >
                {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Read more</>}
            </button>
        </div>
    );
}

// ─── File uploader (shared logic) ─────────────────────────────────────────────

function FileUploadButton({ item, siteId, onUploadComplete }: {
    item: ResourceItem;
    siteId: string | undefined;
    onUploadComplete: (fields: Pick<ResourceItem, 'fileUrl' | 'fileName' | 'fileType'>) => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ref = useRef<HTMLInputElement>(null);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !siteId) return;
        setUploading(true);
        setError(null);

        const isPdf = file.type === 'application/pdf';
        const isImage = file.type.startsWith('image/');

        if (!isPdf && !isImage) {
            setError('Only PDF or image files are supported.');
            setUploading(false);
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('siteId', siteId);

            const endpoint = isPdf ? '/api/sites/upload-pdf' : '/api/sites/upload-image';
            const res = await fetch(endpoint, { method: 'POST', body: formData, credentials: 'include' });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Upload failed');
            }
            const json = await res.json();
            // Write all three fields in one call to avoid stale-closure overwrites
            onUploadComplete({
                fileUrl: json.pdfUrl || json.imageUrl,
                fileName: file.name,
                fileType: isPdf ? 'pdf' : 'image',
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
            if (ref.current) ref.current.value = '';
        }
    };

    return (
        <>
            <button
                onClick={() => ref.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
                <Upload className="w-3.5 h-3.5" />
                {item.fileUrl ? 'Replace file' : 'Upload PDF or image'}
            </button>
            {uploading && <span className="text-xs text-blue-500 animate-pulse ml-2">Uploading…</span>}
            {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
            <input ref={ref} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />
        </>
    );
}

// ─── Edit panel for a single item ─────────────────────────────────────────────

function ItemEditPanel({ item, siteId, canRemove, isDragging, isDragTarget, onUpdate, onUpdateFields, onRemove, onDragStart, onDragOver, onDrop, onDragEnd }: {
    item: ResourceItem;
    siteId: string | undefined;
    canRemove: boolean;
    isDragging: boolean;
    isDragTarget: boolean;
    onUpdate: (field: string, value: any) => void;
    onUpdateFields: (fields: Partial<ResourceItem>) => void;
    onRemove: () => void;
    onDragStart: () => void;
    onDragOver: React.DragEventHandler<HTMLDivElement>;
    onDrop: React.DragEventHandler<HTMLDivElement>;
    onDragEnd: () => void;
}) {
    const inputCls = 'w-full text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white';
    return (
        <div
            className={`group/card relative flex flex-col gap-2 p-3 border rounded-xl bg-white shadow-sm transition-[border-color,box-shadow,opacity,transform] ${
                isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'
            } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <InlineCardControls
                canRemove={canRemove}
                dragData={item.id}
                dragTitle="Drag to reorder resource"
                removeTitle="Delete resource"
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onRemove={onRemove}
            />
            {/* Type selector + remove */}
            <div className="flex items-center justify-between gap-2 pr-20">
                <div className="flex gap-1">
                    {(['file', 'text', 'link'] as ResourceType[]).map(t => (
                        <button
                            key={t}
                            onClick={() => onUpdate('type', t)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors capitalize ${item.type === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Title */}
            <input
                type="text"
                value={item.title}
                onChange={e => onUpdate('title', e.target.value)}
                placeholder="Resource title"
                className={inputCls}
            />

            {/* Description */}
            <input
                type="text"
                value={item.description || ''}
                onChange={e => onUpdate('description', e.target.value)}
                placeholder="Short description (optional)"
                className={inputCls}
            />

            {/* Type-specific fields */}
            {item.type === 'file' && (
                <div className="flex flex-col gap-2">
                    {/* Image preview */}
                    {item.fileUrl && item.fileType === 'image' && (
                        <img src={item.fileUrl} alt={item.title} className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                    )}
                    {/* Uploaded file link + controls */}
                    {item.fileUrl && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                            {item.fileType === 'pdf'
                                ? <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                                : <ImageIcon className="w-4 h-4 text-violet-500 flex-shrink-0" />
                            }
                            <a
                                href={item.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-800 underline truncate"
                            >
                                {item.fileName || 'View file'}
                            </a>
                            <button
                                onClick={() => { onUpdate('fileUrl', ''); onUpdate('fileName', ''); onUpdate('fileType', ''); }}
                                className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                                title="Remove file"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                    <FileUploadButton item={item} siteId={siteId} onUploadComplete={onUpdateFields} />
                </div>
            )}

            {item.type === 'text' && (
                <textarea
                    value={item.body || ''}
                    onChange={e => onUpdate('body', e.target.value)}
                    placeholder="Resource body text…"
                    rows={4}
                    className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                />
            )}

            {item.type === 'link' && (
                <div className="flex flex-col gap-1.5">
                    <input
                        type="url"
                        value={item.url || ''}
                        onChange={e => onUpdate('url', e.target.value)}
                        placeholder="https://example.com"
                        className={inputCls}
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={item.openInNewTab !== false}
                            onChange={e => onUpdate('openInNewTab', e.target.checked)}
                            className="rounded"
                        />
                        Open in new tab
                    </label>
                </div>
            )}
        </div>
    );
}

// ─── Grid card (view mode) ─────────────────────────────────────────────────────

function GridCard({ item, palette }: { item: ResourceItem; palette: Record<string, string> }) {
    const primary = palette.primary || '#1f2937';
    const accent = palette.secondary || '#3b82f6';
    const Icon = typeIcon(item.type, item.fileType);
    const badge = typeBadgeColors(item.type, item.fileType);
    const [textOpen, setTextOpen] = useState(false);

    const rawActionHref = item.type === 'file' ? item.fileUrl : item.type === 'link' ? item.url : undefined;
    const actionHref = rawActionHref ? normalizeExternalHref(rawActionHref) : undefined;
    const actionLabel = item.type === 'file' ? 'Download' : item.type === 'link' ? 'Visit' : null;

    return (
        <div className="flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Icon header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: badge.bg }}
                >
                    <Icon className="w-5 h-5" style={{ color: badge.text }} />
                </div>
                <span
                    className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                >
                    {typeLabel(item.type, item.fileType)}
                </span>
            </div>

            {/* Body */}
            <div className="px-5 pb-5 flex flex-col flex-1">
                <h3 className="font-semibold text-base mb-1 leading-snug" style={{ color: primary }}>{item.title}</h3>
                {item.description && (
                    <p className="text-sm mb-3 leading-relaxed" style={{ color: primary, opacity: 0.6 }}>{item.description}</p>
                )}

                {/* Text body inline */}
                {item.type === 'text' && item.body && (
                    <div className="mt-auto">
                        <div
                            className={`text-sm leading-relaxed overflow-hidden transition-all duration-300 ${textOpen ? 'max-h-[2000px]' : 'max-h-20'}`}
                            style={{ color: primary, opacity: 0.72 }}
                        >
                            {item.body}
                        </div>
                        <button
                            onClick={() => setTextOpen(v => !v)}
                            className="mt-1.5 flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
                            style={{ color: accent }}
                        >
                            {textOpen ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Read more</>}
                        </button>
                    </div>
                )}

                {/* Image preview */}
                {item.type === 'file' && item.fileType === 'image' && item.fileUrl && (
                    <img
                        src={item.fileUrl}
                        alt={item.title}
                        className="w-full h-36 object-cover rounded-lg mt-1 mb-3"
                    />
                )}

                {/* Action button */}
                {actionHref && actionLabel && (
                    <a
                        href={actionHref}
                        target={item.openInNewTab !== false ? '_blank' : '_self'}
                        rel="noopener noreferrer"
                        download={item.type === 'file' ? true : undefined}
                        className="mt-auto pt-3 inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
                        style={{ color: accent }}
                    >
                        {item.type === 'file' ? <Download className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                        {actionLabel}
                    </a>
                )}
            </div>
        </div>
    );
}

// ─── List row (view mode) ──────────────────────────────────────────────────────

function ListRow({ item, palette, isLast }: { item: ResourceItem; palette: Record<string, string>; isLast: boolean }) {
    const primary = palette.primary || '#1f2937';
    const accent = palette.secondary || '#3b82f6';
    const Icon = typeIcon(item.type, item.fileType);
    const badge = typeBadgeColors(item.type, item.fileType);
    const [textOpen, setTextOpen] = useState(false);

    const rawActionHref = item.type === 'file' ? item.fileUrl : item.type === 'link' ? item.url : undefined;
    const actionHref = rawActionHref ? normalizeExternalHref(rawActionHref) : undefined;

    return (
        <div className={`py-5 flex items-start gap-4 ${!isLast ? 'border-b border-slate-100' : ''}`}>
            {/* Icon */}
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: badge.bg }}
            >
                <Icon className="w-5 h-5" style={{ color: badge.text }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base" style={{ color: primary }}>{item.title}</span>
                    <span
                        className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                    >
                        {typeLabel(item.type, item.fileType)}
                    </span>
                </div>
                {item.description && (
                    <p className="text-sm mt-0.5" style={{ color: primary, opacity: 0.6 }}>{item.description}</p>
                )}

                {/* Text body */}
                {item.type === 'text' && item.body && (
                    <div className="mt-1.5">
                        <div
                            className={`text-sm leading-relaxed overflow-hidden transition-all duration-300 ${textOpen ? 'max-h-[2000px]' : 'max-h-0'}`}
                            style={{ color: primary, opacity: 0.72 }}
                        >
                            {item.body}
                        </div>
                        <button
                            onClick={() => setTextOpen(v => !v)}
                            className="mt-1 flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
                            style={{ color: accent }}
                        >
                            {textOpen ? <><ChevronUp className="w-3 h-3" />Hide</> : <><ChevronDown className="w-3 h-3" />Read</>}
                        </button>
                    </div>
                )}
            </div>

            {/* Action */}
            {actionHref && (
                <a
                    href={actionHref}
                    target={item.openInNewTab !== false ? '_blank' : '_self'}
                    rel="noopener noreferrer"
                    download={item.type === 'file' ? true : undefined}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 border"
                    style={{ color: accent, borderColor: accent }}
                >
                    {item.type === 'file' ? <Download className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                    {item.type === 'file' ? 'Download' : 'Open'}
                </a>
            )}
        </div>
    );
}

// ─── Main block ───────────────────────────────────────────────────────────────

export default function ResourcesBlock({ id, data, isEditMode, palette, updateContent }: ResourcesBlockProps) {
    const context = useEditorContext();
    const siteId = context?.siteId;
    const primary = palette.primary || '#1f2937';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '#f8fafc');
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const items: ResourceItem[] = data.items || [
        { id: uuidv4(), type: 'file', title: 'Getting Started Guide', description: 'Download our comprehensive onboarding PDF.' },
        { id: uuidv4(), type: 'link', title: 'Official Documentation', description: 'Full reference docs on our website.', url: 'https://example.com', openInNewTab: true },
        { id: uuidv4(), type: 'text', title: 'Quick Tips', description: 'A few things to keep in mind.', body: 'Make sure to read through each section carefully before proceeding. Our resources are updated regularly to reflect the latest best practices.' },
    ];

    const variant: 'grid' | 'list' = data.variant || 'grid';

    const updateItem = (index: number, field: string, value: any) => {
        const next = items.map((item, i) => i === index ? { ...item, [field]: value } : item);
        updateContent('items', next);
    };

    // Batch-update multiple fields at once — avoids stale-closure overwrites
    const updateItemFields = (index: number, fields: Partial<ResourceItem>) => {
        const next = items.map((item, i) => i === index ? { ...item, ...fields } : item);
        updateContent('items', next);
    };

    const addItem = () => {
        updateContent('items', [...items, { id: uuidv4(), type: 'link' as ResourceType, title: 'New Resource', description: '' }]);
    };

    const removeItem = (index: number) => {
        updateContent('items', items.filter((_, i) => i !== index));
    };

    const reorderItem = (fromIndex: number, toIndex: number) => {
        updateContent('items', reorderItems(items, fromIndex, toIndex));
    };

    return (
        <section className="py-20" style={{ backgroundColor: bgColor }}>
            <div className="max-w-5xl mx-auto px-4">

                {/* Header */}
                <div className="mb-10 text-center">
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Resources"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold mb-3"
                        style={{ color: primary }}
                    />
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        content={data.subtitle}
                        defaultValue="Everything you need, all in one place."
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-lg max-w-xl mx-auto"
                        style={{ color: primary, opacity: 0.6 }}
                    />
                </div>

                {/* Variant toggle (edit mode only) */}
                {isEditMode && (
                    <div className="flex justify-center gap-2 mb-8">
                        {(['grid', 'list'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => updateContent('variant', v)}
                                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors capitalize ${variant === v ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                {v === 'grid' ? 'Card Grid' : 'Document List'}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── EDIT MODE ── */}
                {isEditMode ? (
                    <div className="flex flex-col gap-3">
                        {items.map((item, index) => (
                            <ItemEditPanel
                                key={item.id}
                                item={item}
                                siteId={siteId}
                                canRemove={items.length > 1}
                                isDragging={draggedIndex === index}
                                isDragTarget={dragOverIndex === index && draggedIndex !== index}
                                onUpdate={(field, value) => updateItem(index, field, value)}
                                onUpdateFields={(fields) => updateItemFields(index, fields)}
                                onRemove={() => removeItem(index)}
                                onDragStart={() => {
                                    setDraggedIndex(index);
                                    setDragOverIndex(null);
                                }}
                                onDragOver={(event) => {
                                    if (draggedIndex === null) return;
                                    event.preventDefault();
                                    setDragOverIndex(index);
                                }}
                                onDrop={(event) => {
                                    if (draggedIndex === null) return;
                                    event.preventDefault();
                                    reorderItem(draggedIndex, index);
                                    setDraggedIndex(null);
                                    setDragOverIndex(null);
                                }}
                                onDragEnd={() => {
                                    setDraggedIndex(null);
                                    setDragOverIndex(null);
                                }}
                            />
                        ))}
                        <button
                            onClick={addItem}
                            className="mt-1 flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 border border-dashed border-slate-300 rounded-xl hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors justify-center"
                        >
                            <Plus className="w-4 h-4" />
                            Add Resource
                        </button>
                    </div>
                ) : variant === 'grid' ? (
                    /* ── GRID VIEW ── */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {items.map(item => (
                            <GridCard key={item.id} item={item} palette={palette} />
                        ))}
                    </div>
                ) : (
                    /* ── LIST VIEW ── */
                    <div className="bg-white border border-slate-200 rounded-2xl px-6 divide-y divide-slate-100 shadow-sm">
                        {items.map((item, i) => (
                            <ListRow key={item.id} item={item} palette={palette} isLast={i === items.length - 1} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
