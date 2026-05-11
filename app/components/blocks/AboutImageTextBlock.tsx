import React from 'react';
import EditableText from '../EditableText';
import EditableImage from '../EditableImage';
import EditableButton, { type ButtonIconData, type ButtonLinkData } from '../EditableButton';
import type { ImageSettings, UnsplashAttribution } from '../ImageEditorModal';
import BlockPretext from '../BlockPretext';
import { useEditorContext } from '@/lib/editor-context';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import { Plus } from 'lucide-react';
import InlineCardControls, { reorderItems } from './InlineCardControls';

type AboutImageTextData = Record<string, unknown>;
type UpdateContent = (key: string, value: unknown) => void;
type UploadImage = (file: File, contentKey: string) => Promise<string>;

interface AboutImageTextBlockProps {
    id: string;
    data: AboutImageTextData;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: UpdateContent;
}

const DEFAULT_ITEMS = [
    "Licensed & Insured Experts",
    "100% Satisfaction Guarantee",
    "Upfront Honest Pricing",
    "Decades of Experience"
];

export default function AboutImageTextBlock({ data, isEditMode, palette, updateContent }: AboutImageTextBlockProps) {
    const context = useEditorContext();
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, palette.accent || '#f3f4f6');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);
    const imagePosition = data.imagePosition === 'right' ? 'right' : 'left';
    const splitRatio = normalizeSplitRatio(data.splitRatio);
    const mobileStackOrder = normalizeMobileStackOrder(data.mobileStackOrder);
    const gridColumnsClass = getGridColumnsClass(splitRatio, imagePosition);
    const imageOrderClass = mobileStackOrder === 'text-first' ? 'order-2 md:order-none' : 'order-1 md:order-none';
    const textOrderClass = mobileStackOrder === 'text-first' ? 'order-1 md:order-none' : 'order-2 md:order-none';

    const items = normalizeItems(data.items);

    const handleAddItem = () => {
        updateContent('items', [...items, `New Benefit ${getNextBenefitNumber(items)}`]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        updateContent('items', items.filter((_: string, i: number) => i !== index));
    };

    const handleUpdateItem = (index: number, value: string) => {
        const newItems = items.map((item: string, i: number) =>
            i === index ? value : item
        );
        updateContent('items', newItems);
    };

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className={`ks-layout-content max-w-7xl mx-auto px-4 grid grid-cols-1 ${gridColumnsClass} gap-16 items-center`}>
                {imagePosition === 'right' ? (
                    <>
                        <TextContent className={textOrderClass} data={data} items={items} isEditMode={isEditMode} palette={palette} updateContent={updateContent} handleAddItem={handleAddItem} handleRemoveItem={handleRemoveItem} handleUpdateItem={handleUpdateItem} pPrimary={pPrimary} pSecondary={pSecondary} fgOverride={fgOverride} />
                        <ImageContent className={imageOrderClass} data={data} isEditMode={isEditMode} updateContent={updateContent} uploadImage={context?.uploadImage} pPrimary={pPrimary} fgOverride={fgOverride} />
                    </>
                ) : (
                    <>
                        <ImageContent className={imageOrderClass} data={data} isEditMode={isEditMode} updateContent={updateContent} uploadImage={context?.uploadImage} pPrimary={pPrimary} fgOverride={fgOverride} />
                        <TextContent className={textOrderClass} data={data} items={items} isEditMode={isEditMode} palette={palette} updateContent={updateContent} handleAddItem={handleAddItem} handleRemoveItem={handleRemoveItem} handleUpdateItem={handleUpdateItem} pPrimary={pPrimary} pSecondary={pSecondary} fgOverride={fgOverride} />
                    </>
                )}
            </div>
        </section>
    );
}

function normalizeSplitRatio(value: unknown): '40-60' | '50-50' | '60-40' {
    return value === '40-60' || value === '60-40' ? value : '50-50';
}

function normalizeMobileStackOrder(value: unknown): 'image-first' | 'text-first' {
    return value === 'text-first' ? 'text-first' : 'image-first';
}

function normalizeItems(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0) return DEFAULT_ITEMS;
    return value.map((item) => String(item)).filter(Boolean);
}

function getGridColumnsClass(splitRatio: '40-60' | '50-50' | '60-40', imagePosition: 'left' | 'right'): string {
    if (splitRatio === '50-50') return 'md:grid-cols-2';

    if (imagePosition === 'left') {
        return splitRatio === '40-60'
            ? 'md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'
            : 'md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]';
    }

    return splitRatio === '40-60'
        ? 'md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
        : 'md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]';
}

function getNextBenefitNumber(items: string[]): number {
    const existingNumbers = items
        .map((item) => item.match(/^New Benefit (\d+)$/)?.[1])
        .filter((value): value is string => Boolean(value))
        .map((value) => Number(value))
        .filter(Number.isFinite);

    return existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : items.length + 1;
}

function ImageContent({
    className,
    data,
    isEditMode,
    updateContent,
    uploadImage,
    pPrimary,
    fgOverride,
}: {
    className: string;
    data: AboutImageTextData;
    isEditMode: boolean;
    updateContent: UpdateContent;
    uploadImage?: UploadImage;
    pPrimary: string;
    fgOverride: string;
}) {
    const variant = readString(data.variant, 'landscape');
    const aspectClass = variant === 'tall' ? 'aspect-[3/4]' : variant === 'square' ? 'aspect-square' : 'aspect-[4/3]';
    const persistedImageSettings = React.useMemo(() => (
        readImageSettings(data.image__settings)
    ), [data.image__settings]);
    const imageFocalPoint = normalizeImageFocalPoint(persistedImageSettings.objectPosition ?? data.imageFocalPoint);
    const imageSettings = React.useMemo(() => ({
        ...persistedImageSettings,
        objectPosition: imageFocalPoint,
    }), [persistedImageSettings, imageFocalPoint]);
    const caption = readString(data.imageCaption, '');

    return (
        <Reveal className={className}>
            <figure>
                <EditableImage
                    contentKey="image"
                    initialSettings={imageSettings}
                    initialAttribution={readUnsplashAttribution(data.image__attribution)}
                    imageUrl={readString(data.image)}
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    onUpload={uploadImage}
                    className={`w-full ${aspectClass} shadow-xl object-cover`}
                    emptyBackgroundClassName="bg-transparent"
                    placeholder="Click to upload about image"
                    enableInlineCropControls
                    editorPreviewFrameClassName={`w-full ${aspectClass}`}
                />
                {(caption || isEditMode) && (
                    <figcaption className="mt-3 text-center text-sm leading-relaxed">
                        <EditableText
                            as="span"
                            contentKey="imageCaption"
                            content={caption}
                            defaultValue="Add an image caption"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            style={{ color: fgOverride || pPrimary, opacity: 0.65 }}
                        />
                    </figcaption>
                )}
            </figure>
        </Reveal>
    );
}

function readImageSettings(value: unknown): ImageSettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as ImageSettings;
}

function readUnsplashAttribution(value: unknown): UnsplashAttribution | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    if (
        typeof record.photographerName === 'string' &&
        typeof record.photographerUrl === 'string' &&
        typeof record.unsplashUrl === 'string'
    ) {
        return {
            photographerName: record.photographerName,
            photographerUrl: record.photographerUrl,
            unsplashUrl: record.unsplashUrl,
        };
    }
    return undefined;
}

function normalizeImageFocalPoint(value: unknown): string {
    if (typeof value !== 'string') return 'center center';

    const normalized = value.trim().toLowerCase();
    if ([
        'center center',
        'top center',
        'bottom center',
        'left center',
        'right center',
        'left top',
        'right top',
        'left bottom',
        'right bottom',
    ].includes(normalized)) {
        return normalized;
    }

    const [x, y, ...extra] = normalized.split(/\s+/);
    if (!extra.length && isImagePositionPercentToken(x) && isImagePositionPercentToken(y)) {
        return `${roundImagePositionPercent(Number(x.slice(0, -1)))}% ${roundImagePositionPercent(Number(y.slice(0, -1)))}%`;
    }

    return 'center center';
}

function isImagePositionPercentToken(value: string | undefined): value is string {
    if (!value?.endsWith('%')) return false;
    return Number.isFinite(Number(value.slice(0, -1)));
}

function roundImagePositionPercent(value: number): number {
    return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function readString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function readButtonLink(value: unknown): Partial<ButtonLinkData> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as Partial<ButtonLinkData>;
}

function readButtonIcon(value: unknown): ButtonIconData | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as ButtonIconData;
}

function TextContent({
    className,
    data,
    items,
    isEditMode,
    palette,
    updateContent,
    handleAddItem,
    handleRemoveItem,
    handleUpdateItem,
    pPrimary,
    pSecondary,
    fgOverride,
}: {
    className: string;
    data: AboutImageTextData;
    items: string[];
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: UpdateContent;
    handleAddItem: () => void;
    handleRemoveItem: (index: number) => void;
    handleUpdateItem: (index: number, value: string) => void;
    pPrimary: string;
    pSecondary: string;
    fgOverride: string;
}) {
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    const handleReorderItem = (fromIndex: number, toIndex: number) => {
        updateContent('items', reorderItems(items, fromIndex, toIndex));
    };

    return (
        <div className={className}>
            <Reveal>
                <BlockPretext
                    data={data}
                    isEditMode={isEditMode}
                    palette={palette}
                    updateContent={updateContent}
                    defaultText="About"
                />
                <EditableText
                    as="h2"
                    contentKey="title"
                    content={readString(data.title)}
                    defaultValue="Why Choose Us?"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold mb-6"
                    style={{ color: fgOverride || pPrimary }}
                />
            </Reveal>
            {(data.description || isEditMode) && (
                <Reveal>
                    <EditableText
                        as="p"
                        contentKey="description"
                        content={readString(data.description)}
                        defaultValue=""
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-lg mb-8 leading-relaxed"
                        style={{ color: fgOverride || pPrimary, opacity: 0.7 }}
                    />
                </Reveal>
            )}
            <ul className="space-y-4 text-lg">
                {items.map((item: string, index: number) => {
                    const isDragging = draggedIndex === index;
                    const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                    return (
                    <Reveal key={index}>
                        <li
                            className={`relative group/card flex items-center gap-3 rounded-lg py-2 pl-2 pr-16 transition-[border-color,box-shadow,opacity,transform] ${
                                isEditMode
                                    ? isDragTarget
                                        ? 'border border-blue-300 ring-2 ring-blue-100'
                                        : 'border border-transparent hover:border-slate-200'
                                    : ''
                            } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}
                            onDragOver={(event) => {
                                if (!isEditMode || draggedIndex === null) return;
                                event.preventDefault();
                                setDragOverIndex(index);
                            }}
                            onDrop={(event) => {
                                if (!isEditMode || draggedIndex === null) return;
                                event.preventDefault();
                                handleReorderItem(draggedIndex, index);
                                setDraggedIndex(null);
                                setDragOverIndex(null);
                            }}
                        >
                            {isEditMode && (
                                <InlineCardControls
                                    canRemove={items.length > 1}
                                    dragData={`about-item-${index}`}
                                    dragTitle="Drag to reorder about item"
                                    removeTitle="Delete about item"
                                    onDragStart={() => {
                                        setDraggedIndex(index);
                                        setDragOverIndex(null);
                                    }}
                                    onDragEnd={() => {
                                        setDraggedIndex(null);
                                        setDragOverIndex(null);
                                    }}
                                    onRemove={() => handleRemoveItem(index)}
                                />
                            )}
                            <span className="font-bold flex-shrink-0" style={{ color: pSecondary }}>✓</span>
                            <div className="flex-1 w-full">
                                <EditableText
                                    as="span"
                                    contentKey={`about_item_${index}`}
                                    content={item}
                                    defaultValue={item}
                                    isEditMode={isEditMode}
                                    onSave={(_key, value) => handleUpdateItem(index, value)}
                                    style={{ color: fgOverride || pPrimary }}
                                />
                            </div>
                        </li>
                    </Reveal>
                    );
                })}
            </ul>
            {isEditMode && (
                <div className="flex justify-start mt-5">
                    <button
                        onClick={handleAddItem}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-300"
                    >
                        <Plus className="w-4 h-4" />
                        Add Item
                    </button>
                </div>
            )}
            {data.showSecondaryButton === true && (
                <Reveal className="mt-8">
                    <EditableButton
                        contentKey="secondaryButtonText"
                        label={readString(data.secondaryButtonText)}
                        linkData={readButtonLink(data.secondaryButtonTextLink)}
                        iconData={readButtonIcon(data.secondaryButtonTextIcon)}
                        defaultLabel="Learn More"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="inline-flex items-center justify-center px-6 py-3 font-bold rounded-full border-2 transition-colors hover:opacity-80"
                        style={{ borderColor: pSecondary, color: pSecondary, backgroundColor: 'transparent' }}
                        defaultFill="outline"
                        palette={palette}
                    />
                </Reveal>
            )}
        </div>
    );
}
