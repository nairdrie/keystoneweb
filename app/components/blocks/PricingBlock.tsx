'use client';

import React from 'react';
import EditableText from '../EditableText';
import EditableButton, { type ButtonIconData, type ButtonLinkData } from '../EditableButton';
import BlockPretext from '../BlockPretext';
import { resolvePaletteColor } from '@/lib/palette-colors';
import InlineCardControls, { reorderItems } from './InlineCardControls';
import Reveal, { useStaggerSec } from '@/app/components/Reveal';
import {
    SPACING_DENSITY_OPTIONS,
    getCardInlineStyle,
    getCardPaddingClass,
    getCardPresetShadowPaintBuffer,
    getCardShadowPaintBuffer,
    getCardShadowSafeContainerStyle,
    getCardStyleClass,
    getSurfaceStyle,
    getSurfaceTextColor,
    getTextAlignClass,
    getUniversalCardClassName,
    getUniversalCardInlineStyle,
    getUniversalCardPaddingClass,
    getUniversalCardTextColor,
    getUniversalCardTextPaddingStyle,
    readStyleOption,
    resolveCardPresetId,
    resolveUniversalCardSettings,
    shouldLockCardTextToSurface,
} from '@/lib/block-style-options';

interface PricingBlockProps {
    id: string;
    data: Record<string, unknown>;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: unknown) => void;
}

type PricingTier = {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    highlighted: boolean;
    buttonText?: string;
    buttonTextLink?: Partial<ButtonLinkData>;
    buttonTextIcon?: ButtonIconData;
};

const DEFAULT_PRICING_TIERS: PricingTier[] = [
    {
        name: 'Basic',
        price: '$49',
        period: '/month',
        description: 'Perfect for getting started',
        features: ['Up to 5 projects', 'Basic support', 'Core features'],
        highlighted: false,
    },
    {
        name: 'Professional',
        price: '$99',
        period: '/month',
        description: 'Best for growing businesses',
        features: ['Unlimited projects', 'Priority support', 'Advanced features', 'Analytics dashboard'],
        highlighted: true,
    },
    {
        name: 'Enterprise',
        price: '$199',
        period: '/month',
        description: 'For large-scale operations',
        features: ['Everything in Pro', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee'],
        highlighted: false,
    },
];

export default function PricingBlock({ data, isEditMode, palette, updateContent }: PricingBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
    const staggerSec = useStaggerSec();

    const variant = typeof data.variant === 'string' ? data.variant : 'cards'; // 'cards' | 'comparison' | 'simple'
    const hasCardDesignOverride = hasPricingCardDesignOverride(data);
    const universalCardSettings = hasCardDesignOverride
        ? resolveUniversalCardSettings(data, {
            fallbackPreset: 'soft',
            fallbackTextAlign: 'left',
        })
        : null;
    const cardStyle = resolveCardPresetId(data, 'soft');
    const surfaceStyle = getSurfaceStyle(data.surfaceStyle, cardStyle);
    const spacingDensity = readStyleOption(data.spacingDensity, SPACING_DENSITY_OPTIONS, 'standard');
    const textAlignClass = universalCardSettings ? getTextAlignClass(universalCardSettings.textAlign) : getTextAlignClass(data.textAlign);
    const activeSurfaceStyle = universalCardSettings?.surface || surfaceStyle;
    const surfaceCardTextColor = universalCardSettings ? getUniversalCardTextColor(universalCardSettings, palette) : getSurfaceTextColor(surfaceStyle, palette);
    const lockCardTextToSurface = shouldLockCardTextToSurface(activeSurfaceStyle);
    const tierTitleColor = hasCardDesignOverride
        ? lockCardTextToSurface ? surfaceCardTextColor : fgOverride || surfaceCardTextColor
        : pPrimary;
    const tierBodyColor = hasCardDesignOverride
        ? lockCardTextToSurface ? surfaceCardTextColor : fgOverride || pPrimary
        : pPrimary;
    const tierActionColor = lockCardTextToSurface ? surfaceCardTextColor : pPrimary;
    const cardClassName = hasCardDesignOverride
        ? universalCardSettings
            ? `${getUniversalCardClassName(universalCardSettings)} ${getUniversalCardPaddingClass(universalCardSettings)} ${textAlignClass} relative group/card transition-[border-color,box-shadow,opacity,transform]`
            : `${getCardStyleClass(cardStyle)} ${getCardPaddingClass(cardStyle, spacingDensity)} ${textAlignClass} relative group/card transition-[border-color,box-shadow,opacity,transform]`
        : '';
    const cardInlineStyle = hasCardDesignOverride
        ? universalCardSettings
            ? {
                ...getUniversalCardInlineStyle(universalCardSettings, palette),
                ...(getUniversalCardTextPaddingStyle(universalCardSettings) || {}),
            }
            : getCardInlineStyle(cardStyle, surfaceStyle, palette)
        : undefined;
    const cardShadowBuffer = hasCardDesignOverride
        ? universalCardSettings
            ? getCardShadowPaintBuffer(universalCardSettings)
            : getCardPresetShadowPaintBuffer(cardStyle)
        : 0;
    const cardShadowSafeStyle = hasCardDesignOverride ? getCardShadowSafeContainerStyle(cardShadowBuffer) : undefined;

    const tiers = normalizePricingTiers(data.tiers);

    const handleUpdateTier = (index: number, field: string, value: unknown) => {
        const newTiers = tiers.map((tier, i) =>
            i === index ? { ...tier, [field]: value } : tier
        );
        updateContent('tiers', newTiers);
    };

    const handleUpdateFeature = (tierIndex: number, featureIndex: number, value: string) => {
        const newTiers = tiers.map((tier, i) => {
            if (i !== tierIndex) return tier;
            const newFeatures = [...tier.features];
            newFeatures[featureIndex] = value;
            return { ...tier, features: newFeatures };
        });
        updateContent('tiers', newTiers);
    };

    const handleRemoveTier = (index: number) => {
        if (tiers.length <= 1) return;
        updateContent('tiers', tiers.filter((_, i) => i !== index));
    };

    const handleReorderTier = (fromIndex: number, toIndex: number) => {
        updateContent('tiers', reorderItems(tiers, fromIndex, toIndex));
    };

    const getTierDragHandlers = (index: number) => ({
        onDragOver: (event: React.DragEvent) => {
            if (!isEditMode || draggedIndex === null) return;
            event.preventDefault();
            setDragOverIndex(index);
        },
        onDrop: (event: React.DragEvent) => {
            if (!isEditMode || draggedIndex === null) return;
            event.preventDefault();
            handleReorderTier(draggedIndex, index);
            setDraggedIndex(null);
            setDragOverIndex(null);
        },
    });

    const renderTierControls = (index: number) => isEditMode ? (
        <InlineCardControls
            canRemove={tiers.length > 1}
            dragData={`pricing-tier-${index}`}
            dragTitle="Drag to reorder pricing card"
            removeTitle="Delete pricing card"
            onDragStart={() => {
                setDraggedIndex(index);
                setDragOverIndex(null);
            }}
            onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
            }}
            onRemove={() => handleRemoveTier(index)}
        />
    ) : null;

    const getTierStateClass = (index: number) => {
        const isDragging = draggedIndex === index;
        const isDragTarget = dragOverIndex === index && draggedIndex !== index;
        return `${isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : ''} ${isDragging ? 'scale-[0.99] opacity-60' : ''}`;
    };

    if (variant === 'simple') {
        return (
            <section className="py-24" style={{ backgroundColor: bgColor || '#ffffff' }}>
                <div className="max-w-4xl mx-auto px-4">
                    <BlockPretext
                        data={data}
                        isEditMode={isEditMode}
                        palette={palette}
                        updateContent={updateContent}
                        defaultText="Pricing"
                    />
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={readString(data.title)}
                        defaultValue="Simple, Transparent Pricing"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold text-center mb-4"
                        style={{ color: fgOverride || pPrimary }}
                    />
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        content={readString(data.subtitle)}
                        defaultValue="No hidden fees. Cancel anytime."
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-lg text-center mb-16"
                        style={{ color: fgOverride || pPrimary, opacity: 0.6 }}
                    />
                    <div style={cardShadowSafeStyle}>
                    <div className="space-y-4">
                        {tiers.map((tier, index) => (
                            <Reveal key={index} delay={index * staggerSec}>
                            <div
                                className={`${hasCardDesignOverride ? cardClassName : 'group/card relative rounded-xl border p-6'} flex items-center justify-between transition-[border-color,box-shadow,opacity,transform] ${tier.highlighted && !hasCardDesignOverride ? 'border-2 shadow-md' : 'border-gray-200'} ${getTierStateClass(index)}`}
                                style={{
                                    ...(cardInlineStyle || {}),
                                    ...(tier.highlighted && !hasCardDesignOverride ? { borderColor: pSecondary } : {}),
                                }}
                                {...getTierDragHandlers(index)}
                            >
                                {renderTierControls(index)}
                                <div>
                                    <EditableText
                                        as="h3"
                                        contentKey={`tier_${index}_name`}
                                        content={tier.name}
                                        defaultValue={`Plan ${index + 1}`}
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateTier(index, 'name', value)}
                                        className="text-lg font-bold"
                                        style={{ color: hasCardDesignOverride ? tierTitleColor : fgOverride || pPrimary }}
                                    />
                                    <EditableText
                                        as="p"
                                        contentKey={`tier_${index}_description`}
                                        content={tier.description}
                                        defaultValue="Plan description"
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateTier(index, 'description', value)}
                                        className="text-sm"
                                        style={{ color: hasCardDesignOverride ? tierBodyColor : fgOverride || pPrimary, opacity: 0.6 }}
                                    />
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <EditableText
                                            as="span"
                                            contentKey={`tier_${index}_price`}
                                            content={tier.price}
                                            defaultValue="$99"
                                            isEditMode={isEditMode}
                                            onSave={(_key, value) => handleUpdateTier(index, 'price', value)}
                                            className="text-3xl font-black"
                                            style={{ color: hasCardDesignOverride ? tierTitleColor : fgOverride || pPrimary }}
                                        />
                                        <span className="text-sm" style={{ color: hasCardDesignOverride ? tierBodyColor : fgOverride || pPrimary, opacity: 0.4 }}>{tier.period || '/month'}</span>
                                    </div>
                                    <EditableButton
                                        contentKey={`tier_${index}_buttonText`}
                                        label={tier.buttonText}
                                        linkData={tier.buttonTextLink}
                                        iconData={tier.buttonTextIcon}
                                        defaultLabel="Get Started"
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateTier(index, _key.endsWith('Link') ? 'buttonTextLink' : (_key.endsWith('Icon') ? 'buttonTextIcon' : 'buttonText'), value)}
                                        className="px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90 inline-flex items-center justify-center"
                                        style={{ backgroundColor: tier.highlighted ? pSecondary : tierActionColor }}
                                        palette={palette}
                                    />
                                </div>
                            </div>
                            </Reveal>
                        ))}
                    </div>
                    </div>
                </div>
            </section>
        );
    }

    // Cards variant (default)
    return (
        <section className="py-24" style={{ backgroundColor: bgColor || pAccent }}>
            <div className="max-w-7xl mx-auto px-4">
                <BlockPretext
                    data={data}
                    isEditMode={isEditMode}
                    palette={palette}
                    updateContent={updateContent}
                    defaultText="Pricing"
                />
                <EditableText
                    as="h2"
                    contentKey="title"
                    content={readString(data.title)}
                    defaultValue="Choose Your Plan"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold text-center mb-4"
                    style={{ color: fgOverride || pPrimary }}
                />
                <EditableText
                    as="p"
                    contentKey="subtitle"
                    content={readString(data.subtitle)}
                    defaultValue="Find the perfect plan for your needs."
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-center mb-16 max-w-2xl mx-auto"
                    style={{ color: fgOverride || pPrimary, opacity: 0.6 }}
                />

                <div style={cardShadowSafeStyle}>
                <div className={`grid gap-8 items-stretch ${tiers.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : 'md:grid-cols-3'}`}>
                    {tiers.map((tier, index) => (
                        <Reveal key={index} delay={index * staggerSec} className="relative flex">
                        {tier.highlighted && (
                            <div className="absolute -top-4 left-1/2 z-20 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider text-white" style={{ backgroundColor: pSecondary }}>
                                Most Popular
                            </div>
                        )}
                        <div
                            className={`${hasCardDesignOverride ? cardClassName : 'group/card relative rounded-2xl border-2 bg-white p-8 shadow-sm hover:shadow-lg'} flex w-full flex-col transition-[border-color,box-shadow,opacity,transform] ${tier.highlighted ? 'ring-2 scale-105' : ''} ${getTierStateClass(index)}`}
                            style={{
                                ...(cardInlineStyle || (tier.highlighted ? { borderColor: pSecondary } : { borderColor: '#e5e7eb' })),
                                ...(tier.highlighted ? { '--tw-ring-color': pSecondary } as React.CSSProperties : {}),
                            }}
                            {...getTierDragHandlers(index)}
                        >
                            {renderTierControls(index)}

                            <EditableText
                                as="h3"
                                contentKey={`tier_${index}_name`}
                                content={tier.name}
                                defaultValue={`Plan ${index + 1}`}
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateTier(index, 'name', value)}
                                className="text-xl font-bold mb-2"
                                style={{ color: hasCardDesignOverride ? tierTitleColor : pPrimary }}
                            />
                            <EditableText
                                as="p"
                                contentKey={`tier_${index}_description`}
                                content={tier.description}
                                defaultValue="Plan description"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateTier(index, 'description', value)}
                                className="text-sm mb-6"
                                style={{ color: hasCardDesignOverride ? tierBodyColor : pPrimary, opacity: 0.6 }}
                            />

                            <div className="mb-8">
                                <EditableText
                                    as="span"
                                    contentKey={`tier_${index}_price`}
                                    content={tier.price}
                                    defaultValue="$99"
                                    isEditMode={isEditMode}
                                    onSave={(_key, value) => handleUpdateTier(index, 'price', value)}
                                    className="text-5xl font-black"
                                    style={{ color: hasCardDesignOverride ? tierTitleColor : pPrimary }}
                                />
                                <span className="text-base ml-1" style={{ color: hasCardDesignOverride ? tierBodyColor : pPrimary, opacity: 0.4 }}>{tier.period || '/month'}</span>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {tier.features.map((feature, fi) => (
                                    <li key={fi} className="flex items-center gap-2 text-sm" style={{ color: hasCardDesignOverride ? tierBodyColor : pPrimary, opacity: 0.7 }}>
                                        <span className="flex-shrink-0 font-bold" style={{ color: lockCardTextToSurface ? surfaceCardTextColor : pSecondary }}>&#10003;</span>
                                        <EditableText
                                            as="span"
                                            contentKey={`tier_${index}_feature_${fi}`}
                                            content={feature}
                                            defaultValue={`Feature ${fi + 1}`}
                                            isEditMode={isEditMode}
                                            onSave={(_key, value) => handleUpdateFeature(index, fi, value)}
                                        />
                                    </li>
                                ))}
                            </ul>

                            <EditableButton
                                contentKey={`tier_${index}_buttonText`}
                                label={tier.buttonText}
                                linkData={tier.buttonTextLink}
                                iconData={tier.buttonTextIcon}
                                defaultLabel="Get Started"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateTier(index, _key.endsWith('Link') ? 'buttonTextLink' : (_key.endsWith('Icon') ? 'buttonTextIcon' : 'buttonText'), value)}
                                className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 text-center inline-flex items-center justify-center"
                                style={{
                                    backgroundColor: tier.highlighted ? pSecondary : 'transparent',
                                    color: tier.highlighted ? '#ffffff' : tierActionColor,
                                    border: tier.highlighted ? 'none' : `2px solid ${tierActionColor}`,
                                }}
                                palette={palette}
                            />
                        </div>
                        </Reveal>
                    ))}
                </div>
                </div>
            </div>
        </section>
    );
}

function hasPricingCardDesignOverride(data: Record<string, unknown>): boolean {
    if (data.cardSettings && typeof data.cardSettings === 'object' && !Array.isArray(data.cardSettings)) {
        return Object.keys(data.cardSettings).length > 0;
    }
    return typeof data.cardStyle === 'string' && data.cardStyle.trim() !== '';
}

function normalizePricingTiers(value: unknown): PricingTier[] {
    if (!Array.isArray(value)) return DEFAULT_PRICING_TIERS;

    const tiers = value
        .map((raw): PricingTier | null => {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
            const tier = raw as Record<string, unknown>;
            return {
                name: readString(tier.name, 'Plan'),
                price: readString(tier.price, '$99'),
                period: readString(tier.period, '/month'),
                description: readString(tier.description, 'Plan description'),
                features: Array.isArray(tier.features)
                    ? tier.features.map((feature) => String(feature)).filter((feature) => feature.trim())
                    : [],
                highlighted: tier.highlighted === true,
                buttonText: readOptionalString(tier.buttonText),
                buttonTextLink: readButtonLink(tier.buttonTextLink),
                buttonTextIcon: readButtonIcon(tier.buttonTextIcon),
            };
        })
        .filter((tier): tier is PricingTier => Boolean(tier));

    return tiers.length ? tiers : DEFAULT_PRICING_TIERS;
}

function readString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function readOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function readButtonLink(value: unknown): Partial<ButtonLinkData> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as Partial<ButtonLinkData>;
}

function readButtonIcon(value: unknown): ButtonIconData | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as ButtonIconData;
}
