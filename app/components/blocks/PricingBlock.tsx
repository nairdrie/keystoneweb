'use client';

import React from 'react';
import EditableText from '../EditableText';
import EditableButton from '../EditableButton';

interface PricingBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function PricingBlock({ id, data, isEditMode, palette, updateContent }: PricingBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';

    const variant = data.variant || 'cards'; // 'cards' | 'comparison' | 'simple'

    const tiers = data.tiers || [
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

    const handleUpdateTier = (index: number, field: string, value: any) => {
        const newTiers = tiers.map((tier: any, i: number) =>
            i === index ? { ...tier, [field]: value } : tier
        );
        updateContent('tiers', newTiers);
    };

    const handleUpdateFeature = (tierIndex: number, featureIndex: number, value: string) => {
        const newTiers = tiers.map((tier: any, i: number) => {
            if (i !== tierIndex) return tier;
            const newFeatures = [...(tier.features || [])];
            newFeatures[featureIndex] = value;
            return { ...tier, features: newFeatures };
        });
        updateContent('tiers', newTiers);
    };

    if (variant === 'simple') {
        return (
            <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
                <div className="max-w-4xl mx-auto px-4">
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Simple, Transparent Pricing"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold text-center mb-4"
                        style={{ color: pPrimary }}
                    />
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        content={data.subtitle}
                        defaultValue="No hidden fees. Cancel anytime."
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-lg text-center mb-16"
                        style={{ color: pPrimary, opacity: 0.6 }}
                    />
                    <div className="space-y-4">
                        {tiers.map((tier: any, index: number) => (
                            <div
                                key={index}
                                className={`flex items-center justify-between p-6 rounded-xl border ${tier.highlighted ? 'border-2 shadow-md' : 'border-gray-200'}`}
                                style={tier.highlighted ? { borderColor: pSecondary } : {}}
                            >
                                <div>
                                    <EditableText
                                        as="h3"
                                        contentKey={`tier_${index}_name`}
                                        content={tier.name}
                                        defaultValue={`Plan ${index + 1}`}
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateTier(index, 'name', value)}
                                        className="text-lg font-bold"
                                        style={{ color: pPrimary }}
                                    />
                                    <EditableText
                                        as="p"
                                        contentKey={`tier_${index}_description`}
                                        content={tier.description}
                                        defaultValue="Plan description"
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateTier(index, 'description', value)}
                                        className="text-sm"
                                        style={{ color: pPrimary, opacity: 0.6 }}
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
                                            style={{ color: pPrimary }}
                                        />
                                        <span className="text-sm" style={{ color: pPrimary, opacity: 0.4 }}>{tier.period || '/month'}</span>
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
                                        style={{ backgroundColor: tier.highlighted ? pSecondary : pPrimary }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // Cards variant (default)
    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || pAccent }}>
            <div className="max-w-7xl mx-auto px-4">
                <EditableText
                    as="h2"
                    contentKey="title"
                    content={data.title}
                    defaultValue="Choose Your Plan"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold text-center mb-4"
                    style={{ color: pPrimary }}
                />
                <EditableText
                    as="p"
                    contentKey="subtitle"
                    content={data.subtitle}
                    defaultValue="Find the perfect plan for your needs."
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-center mb-16 max-w-2xl mx-auto"
                    style={{ color: pPrimary, opacity: 0.6 }}
                />

                <div className={`grid gap-8 items-stretch ${tiers.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : 'md:grid-cols-3'}`}>
                    {tiers.map((tier: any, index: number) => (
                        <div
                            key={index}
                            className={`relative flex flex-col bg-white rounded-2xl p-8 shadow-sm border-2 transition-shadow hover:shadow-lg ${tier.highlighted ? 'ring-2 scale-105 shadow-lg' : ''}`}
                            style={tier.highlighted ? { borderColor: pSecondary, '--tw-ring-color': pSecondary } as React.CSSProperties : { borderColor: '#e5e7eb' }}
                        >
                            {tier.highlighted && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: pSecondary }}>
                                    Most Popular
                                </div>
                            )}

                            <EditableText
                                as="h3"
                                contentKey={`tier_${index}_name`}
                                content={tier.name}
                                defaultValue={`Plan ${index + 1}`}
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateTier(index, 'name', value)}
                                className="text-xl font-bold mb-2"
                                style={{ color: pPrimary }}
                            />
                            <EditableText
                                as="p"
                                contentKey={`tier_${index}_description`}
                                content={tier.description}
                                defaultValue="Plan description"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateTier(index, 'description', value)}
                                className="text-sm mb-6"
                                style={{ color: pPrimary, opacity: 0.6 }}
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
                                    style={{ color: pPrimary }}
                                />
                                <span className="text-base ml-1" style={{ color: pPrimary, opacity: 0.4 }}>{tier.period || '/month'}</span>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {(tier.features || []).map((feature: string, fi: number) => (
                                    <li key={fi} className="flex items-center gap-2 text-sm" style={{ color: pPrimary, opacity: 0.7 }}>
                                        <span className="flex-shrink-0 font-bold" style={{ color: pSecondary }}>&#10003;</span>
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
                                    color: tier.highlighted ? '#ffffff' : pPrimary,
                                    border: tier.highlighted ? 'none' : `2px solid ${pPrimary}`,
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
