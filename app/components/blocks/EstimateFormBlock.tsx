'use client';

import { useState, useMemo, useCallback } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import {
    Send, Loader2, Settings, Mail, User, Phone, MessageSquare,
    Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Calculator,
    DollarSign, ClipboardList, ToggleLeft, ToggleRight, Calendar
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FieldPricingRule {
    type: 'per_unit' | 'flat' | 'multiply';
    amount: number; // cents for per_unit/flat, percentage for multiply
}

interface EstimateField {
    id: string;
    label: string;
    type: 'select' | 'number' | 'text' | 'textarea' | 'checkbox';
    required: boolean;
    options?: string[];
    min?: number;
    max?: number;
    unit?: string;
    pricingRule?: FieldPricingRule;
}

interface EstimateFormBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_FIELDS: EstimateField[] = [
    { id: uuidv4(), label: 'Service Type', type: 'select', required: true, options: ['Consultation', 'Installation', 'Repair', 'Other'] },
    { id: uuidv4(), label: 'Project Details', type: 'textarea', required: true },
];

const MAX_FIELDS = 20;

/* ------------------------------------------------------------------ */
/*  Pricing calculator (client-side only)                              */
/* ------------------------------------------------------------------ */

function calculateEstimate(
    fields: EstimateField[],
    formValues: Record<string, any>,
    basePrice: number,
    spread: number,
): { low: number; high: number } {
    let total = basePrice;

    for (const field of fields) {
        if (!field.pricingRule) continue;
        const value = formValues[field.id];
        if (value == null || value === '') continue;

        const { type, amount } = field.pricingRule;
        switch (type) {
            case 'per_unit':
                total += (Number(value) || 0) * amount;
                break;
            case 'flat':
                if (field.type === 'select' && value) total += amount;
                else if (field.type === 'checkbox' && value) total += amount;
                else if (field.type === 'number' && Number(value) > 0) total += amount;
                break;
            case 'multiply':
                total *= (amount / 100);
                break;
        }
    }

    // Ensure non-negative
    total = Math.max(0, total);

    const low = Math.round(total * (1 - spread));
    const high = Math.round(total * (1 + spread));
    return { low: Math.max(0, low), high };
}

function formatCents(cents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'CAD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(cents / 100);
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function EstimateFormBlock({ id, data, isEditMode, palette, updateContent }: EstimateFormBlockProps) {
    const context = useEditorContext();
    const siteId = context?.siteId;

    // Block data with defaults
    const title = data.title || 'Request an Estimate';
    const description = data.description || 'Tell us about your project and we\'ll provide a custom quote.';
    const submitText = data.submitText || 'Get My Estimate';
    const successMessage = data.successMessage || 'Thank you! We\'ll review your request and get back to you shortly.';
    const variant = data.variant || 'simple';
    const fields: EstimateField[] = data.fields || DEFAULT_FIELDS;
    const pricingEnabled = data.pricingEnabled ?? false;
    const pricingBasePrice = data.pricingBasePrice ?? 0;
    const pricingCurrency = data.pricingCurrency || 'CAD';
    const pricingRangeSpread = data.pricingRangeSpread ?? 0.15;
    const pricingDisclaimer = data.pricingDisclaimer || 'This is an estimate only. Final pricing may vary based on actual project requirements.';
    const showName = data.showName ?? true;
    const showEmail = data.showEmail ?? true;
    const showPhone = data.showPhone ?? true;
    const showMessage = data.showMessage ?? false;
    const showAddress = data.showAddress ?? false;
    const showPreferredDate = data.showPreferredDate ?? false;

    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#3b82f6';

    // Visitor form state
    const [formValues, setFormValues] = useState<Record<string, any>>({});
    const [contactInfo, setContactInfo] = useState({ name: '', email: '', phone: '', message: '', address: '', preferredDate: '', _hp: '' });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit mode state
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
    const [showPricingConfig, setShowPricingConfig] = useState(false);

    // Estimate calculation
    const estimate = useMemo(() => {
        if (variant !== 'calculator' || !pricingEnabled) return null;
        return calculateEstimate(fields, formValues, pricingBasePrice, pricingRangeSpread);
    }, [variant, pricingEnabled, fields, formValues, pricingBasePrice, pricingRangeSpread]);

    /* ---------- Field management (edit mode) ---------- */

    const addField = useCallback(() => {
        if (fields.length >= MAX_FIELDS) return;
        const newField: EstimateField = {
            id: uuidv4(),
            label: 'New Field',
            type: 'text',
            required: false,
        };
        updateContent('fields', [...fields, newField]);
    }, [fields, updateContent]);

    const removeField = useCallback((fieldId: string) => {
        updateContent('fields', fields.filter(f => f.id !== fieldId));
        if (editingFieldId === fieldId) setEditingFieldId(null);
    }, [fields, updateContent, editingFieldId]);

    const updateField = useCallback((fieldId: string, updates: Partial<EstimateField>) => {
        updateContent('fields', fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
    }, [fields, updateContent]);

    const moveField = useCallback((fieldId: string, direction: 'up' | 'down') => {
        const idx = fields.findIndex(f => f.id === fieldId);
        if (idx < 0) return;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= fields.length) return;
        const newFields = [...fields];
        [newFields[idx], newFields[newIdx]] = [newFields[newIdx], newFields[idx]];
        updateContent('fields', newFields);
    }, [fields, updateContent]);

    /* ---------- Visitor form submission ---------- */

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditMode || !siteId) return;
        setLoading(true);
        setError(null);

        try {
            const metadata: any = {
                fields: fields.map(f => ({
                    label: f.label,
                    value: formValues[f.id] ?? '',
                    type: f.type,
                    unit: f.unit || undefined,
                })),
            };

            if (estimate) {
                metadata.estimate_shown = true;
                metadata.estimate_low_cents = estimate.low;
                metadata.estimate_high_cents = estimate.high;
                metadata.estimate_currency = pricingCurrency;
                metadata.estimate_disclaimer = pricingDisclaimer;
            }

            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    name: contactInfo.name,
                    email: contactInfo.email,
                    phone: contactInfo.phone || undefined,
                    message: contactInfo.message || '',
                    _hp: contactInfo._hp,
                    source_type: 'estimate_form',
                    metadata,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Failed to send request');
            }

            setSuccess(true);
            setFormValues({});
            setContactInfo({ name: '', email: '', phone: '', message: '', address: '', preferredDate: '', _hp: '' });
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    /* ================================================================ */
    /*  EDIT MODE                                                        */
    /* ================================================================ */

    if (isEditMode) {
        return (
            <section className="relative group py-16 px-4 text-slate-900" style={{ backgroundColor: '#ffffff' }}>
                <div className="max-w-3xl mx-auto space-y-8">
                    {/* Badge */}
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded-lg shadow border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-2">
                        <Calculator className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-500">
                            {variant === 'calculator' ? 'Estimate Calculator' : 'Inquiry Form'}
                        </span>
                    </div>

                    {/* Title / Description */}
                    <div className="text-center space-y-4">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => updateContent('title', e.target.value)}
                            className="w-full text-center text-3xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors"
                            style={{ color: pPrimary }}
                            placeholder="Form Title"
                        />
                        <textarea
                            value={description}
                            onChange={(e) => updateContent('description', e.target.value)}
                            className="w-full text-center text-lg bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors resize-none text-slate-600"
                            placeholder="Description text"
                            rows={2}
                        />
                    </div>

                    {/* Disabled form preview */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 space-y-4 pointer-events-none opacity-60">
                        {fields.map(field => (
                            <div key={field.id} className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">
                                    {field.label}{field.required ? ' *' : ''}{field.unit ? ` (${field.unit})` : ''}
                                </label>
                                {field.type === 'select' ? (
                                    <select disabled className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-400">
                                        <option>Select {field.label}...</option>
                                        {(field.options || []).map(opt => <option key={opt}>{opt}</option>)}
                                    </select>
                                ) : field.type === 'textarea' ? (
                                    <textarea disabled className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl resize-none" rows={3} placeholder={`Enter ${field.label.toLowerCase()}...`} />
                                ) : field.type === 'checkbox' ? (
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" disabled className="w-4 h-4 rounded" />
                                        <span className="text-sm text-slate-600">{field.label}</span>
                                    </div>
                                ) : (
                                    <input type={field.type === 'number' ? 'number' : 'text'} disabled className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl" placeholder={`Enter ${field.label.toLowerCase()}...`} />
                                )}
                            </div>
                        ))}

                        {/* Contact fields preview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                            {showName && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Full Name *</label>
                                    <input disabled className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl" placeholder="John Doe" />
                                </div>
                            )}
                            {showEmail && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Email *</label>
                                    <input disabled className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl" placeholder="john@example.com" />
                                </div>
                            )}
                        </div>

                        <button disabled className="w-full py-4 text-white font-semibold rounded-xl" style={{ backgroundColor: pSecondary }}>
                            <div className="flex items-center justify-center gap-2">
                                <Send className="w-5 h-5" />
                                {submitText}
                            </div>
                        </button>
                    </div>

                    {/* Config Panel */}
                    <div className="border border-blue-100 bg-blue-50 p-4 rounded-xl space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                            <Settings className="w-4 h-4" /> Form Configuration
                        </div>

                        {/* Submit / Success text */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1">Submit Button Text</label>
                                <input
                                    type="text"
                                    value={submitText}
                                    onChange={(e) => updateContent('submitText', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 bg-white"
                                    placeholder="Get My Estimate"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1">Success Message</label>
                                <input
                                    type="text"
                                    value={successMessage}
                                    onChange={(e) => updateContent('successMessage', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 bg-white"
                                    placeholder="Thank you!"
                                />
                            </div>
                        </div>

                        {/* Custom Fields */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Custom Fields ({fields.length}/{MAX_FIELDS})</label>
                                <button
                                    onClick={addField}
                                    disabled={fields.length >= MAX_FIELDS}
                                    className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Field
                                </button>
                            </div>

                            <div className="space-y-2">
                                {fields.map((field, idx) => (
                                    <div key={field.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                                        {/* Field header */}
                                        <div className="flex items-center gap-2">
                                            <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                            <input
                                                type="text"
                                                value={field.label}
                                                onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                className="flex-1 text-sm font-medium px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white focus:outline-none"
                                                placeholder="Field label"
                                            />
                                            <select
                                                value={field.type}
                                                onChange={(e) => {
                                                    const newType = e.target.value as EstimateField['type'];
                                                    const updates: Partial<EstimateField> = { type: newType };
                                                    if (newType === 'select' && !field.options?.length) {
                                                        updates.options = ['Option 1', 'Option 2', 'Option 3'];
                                                    }
                                                    updateField(field.id, updates);
                                                }}
                                                className="text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-700"
                                            >
                                                <option value="text">Text</option>
                                                <option value="textarea">Long Text</option>
                                                <option value="number">Number</option>
                                                <option value="select">Dropdown</option>
                                                <option value="checkbox">Checkbox</option>
                                            </select>
                                            <button
                                                onClick={() => updateField(field.id, { required: !field.required })}
                                                className={`text-xs px-2 py-1 rounded font-medium ${field.required ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}
                                                title="Toggle required"
                                            >
                                                Req
                                            </button>
                                            <div className="flex gap-0.5">
                                                <button onClick={() => moveField(field.id, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => moveField(field.id, 'down')} disabled={idx === fields.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)}
                                                className="p-1 text-slate-400 hover:text-blue-600"
                                                title="Configure field"
                                            >
                                                <Settings className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => removeField(field.id)} className="p-1 text-slate-400 hover:text-red-600">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {/* Expanded field config */}
                                        {editingFieldId === field.id && (
                                            <div className="pl-6 pt-2 border-t border-slate-100 space-y-2">
                                                {field.type === 'select' && (
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Options (one per line)</label>
                                                        <textarea
                                                            value={(field.options || []).join('\n')}
                                                            onChange={(e) => updateField(field.id, { options: e.target.value.split('\n').filter(Boolean) })}
                                                            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white font-mono"
                                                            rows={3}
                                                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                                                        />
                                                    </div>
                                                )}
                                                {field.type === 'number' && (
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div>
                                                            <label className="text-xs font-semibold text-slate-600 block mb-1">Min</label>
                                                            <input
                                                                type="number"
                                                                value={field.min ?? ''}
                                                                onChange={(e) => updateField(field.id, { min: e.target.value ? Number(e.target.value) : undefined })}
                                                                className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-semibold text-slate-600 block mb-1">Max</label>
                                                            <input
                                                                type="number"
                                                                value={field.max ?? ''}
                                                                onChange={(e) => updateField(field.id, { max: e.target.value ? Number(e.target.value) : undefined })}
                                                                className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                                                                placeholder="100"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-semibold text-slate-600 block mb-1">Unit</label>
                                                            <input
                                                                type="text"
                                                                value={field.unit || ''}
                                                                onChange={(e) => updateField(field.id, { unit: e.target.value })}
                                                                className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                                                                placeholder="sq ft"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                {(field.type === 'text' || field.type === 'textarea') && (
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Unit Label (optional)</label>
                                                        <input
                                                            type="text"
                                                            value={field.unit || ''}
                                                            onChange={(e) => updateField(field.id, { unit: e.target.value })}
                                                            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                                                            placeholder="e.g. hours, rooms"
                                                        />
                                                    </div>
                                                )}

                                                {/* Pricing rule (only in calculator variant) */}
                                                {variant === 'calculator' && pricingEnabled && (
                                                    <div className="pt-2 border-t border-slate-100">
                                                        <label className="text-xs font-bold text-emerald-700 block mb-1">
                                                            <DollarSign className="w-3 h-3 inline" /> Pricing Rule
                                                        </label>
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={field.pricingRule?.type || ''}
                                                                onChange={(e) => {
                                                                    if (!e.target.value) {
                                                                        updateField(field.id, { pricingRule: undefined });
                                                                    } else {
                                                                        updateField(field.id, {
                                                                            pricingRule: {
                                                                                type: e.target.value as FieldPricingRule['type'],
                                                                                amount: field.pricingRule?.amount || 0,
                                                                            }
                                                                        });
                                                                    }
                                                                }}
                                                                className="text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                                                            >
                                                                <option value="">No pricing rule</option>
                                                                <option value="per_unit">Per unit ($)</option>
                                                                <option value="flat">Flat add-on ($)</option>
                                                                <option value="multiply">Multiplier (%)</option>
                                                            </select>
                                                            {field.pricingRule && (
                                                                <input
                                                                    type="number"
                                                                    value={(field.pricingRule.amount || 0) / (field.pricingRule.type === 'multiply' ? 1 : 100)}
                                                                    onChange={(e) => {
                                                                        const val = Number(e.target.value) || 0;
                                                                        updateField(field.id, {
                                                                            pricingRule: {
                                                                                ...field.pricingRule!,
                                                                                amount: field.pricingRule!.type === 'multiply' ? val : Math.round(val * 100),
                                                                            }
                                                                        });
                                                                    }}
                                                                    className="w-24 text-xs px-2 py-1.5 border border-slate-200 rounded bg-white"
                                                                    placeholder={field.pricingRule.type === 'multiply' ? '150' : '25.00'}
                                                                    step={field.pricingRule.type === 'multiply' ? '1' : '0.01'}
                                                                />
                                                            )}
                                                            {field.pricingRule && (
                                                                <span className="text-xs text-slate-500">
                                                                    {field.pricingRule.type === 'per_unit' ? '$ per unit' : field.pricingRule.type === 'flat' ? '$ flat' : '% multiplier'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Contact field toggles */}
                        <div className="pt-3 border-t border-blue-100 space-y-2">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Contact Fields</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {([
                                    ['showName', 'Full Name', showName],
                                    ['showEmail', 'Email', showEmail],
                                    ['showPhone', 'Phone', showPhone],
                                    ['showAddress', 'Address', showAddress],
                                    ['showPreferredDate', 'Preferred Date', showPreferredDate],
                                    ['showMessage', 'Additional Notes', showMessage],
                                ] as const).map(([key, label, value]) => (
                                    <button
                                        key={key}
                                        onClick={() => updateContent(key, !value)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${value ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-slate-200 text-slate-500'}`}
                                    >
                                        {value ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Pricing section (calculator variant only) */}
                        {variant === 'calculator' && (
                            <div className="pt-3 border-t border-blue-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                                        <DollarSign className="w-3.5 h-3.5" /> Live Pricing
                                    </label>
                                    <button
                                        onClick={() => updateContent('pricingEnabled', !pricingEnabled)}
                                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${pricingEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                                    >
                                        {pricingEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                        {pricingEnabled ? 'Enabled' : 'Disabled'}
                                    </button>
                                </div>

                                {pricingEnabled && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600 block mb-1">Base Price ($)</label>
                                                <input
                                                    type="number"
                                                    value={pricingBasePrice / 100}
                                                    onChange={(e) => updateContent('pricingBasePrice', Math.round((Number(e.target.value) || 0) * 100))}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600 block mb-1">Currency</label>
                                                <select
                                                    value={pricingCurrency}
                                                    onChange={(e) => updateContent('pricingCurrency', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                                                >
                                                    <option value="CAD">CAD</option>
                                                    <option value="USD">USD</option>
                                                    <option value="EUR">EUR</option>
                                                    <option value="GBP">GBP</option>
                                                    <option value="AUD">AUD</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600 block mb-1">Range Spread</label>
                                                <select
                                                    value={pricingRangeSpread}
                                                    onChange={(e) => updateContent('pricingRangeSpread', Number(e.target.value))}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                                                >
                                                    <option value={0.05}>5%</option>
                                                    <option value={0.10}>10%</option>
                                                    <option value={0.15}>15%</option>
                                                    <option value={0.20}>20%</option>
                                                    <option value={0.25}>25%</option>
                                                    <option value={0.30}>30%</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600 block mb-1">Disclaimer Text</label>
                                            <textarea
                                                value={pricingDisclaimer}
                                                onChange={(e) => updateContent('pricingDisclaimer', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white resize-none"
                                                rows={2}
                                                placeholder="This is an estimate only..."
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            Configure per-field pricing rules by clicking the settings icon on each field above.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Link to inbox */}
                        <div className="pt-3 border-t border-blue-100">
                            <p className="text-xs text-slate-600 mb-2">Submissions will appear in your Inbox alongside contact form messages.</p>
                            <a
                                href={siteId ? `/admin/inbox?siteId=${siteId}` : '/admin/inbox'}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
                            >
                                <Mail className="w-3.5 h-3.5" />
                                Manage Inbox
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    /* ================================================================ */
    /*  VISITOR MODE                                                     */
    /* ================================================================ */

    if (success) {
        return (
            <section className="py-20 px-4" style={{ backgroundColor: '#ffffff' }}>
                <div className="max-w-3xl mx-auto">
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Send className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-green-800">Request Submitted!</h3>
                        <p className="text-green-700">{successMessage}</p>
                        <button
                            onClick={() => setSuccess(false)}
                            className="mt-6 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Submit Another Request
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    const isCalculator = variant === 'calculator' && pricingEnabled;

    /* ---------- Render a single dynamic field ---------- */
    const renderField = (field: EstimateField) => {
        const val = formValues[field.id] ?? '';
        const onChange = (v: any) => setFormValues(prev => ({ ...prev, [field.id]: v }));

        return (
            <div key={field.id} className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 block">
                    {field.label}{field.required ? ' *' : ''}{field.unit ? <span className="text-slate-400 font-normal"> ({field.unit})</span> : ''}
                </label>
                {field.type === 'select' ? (
                    <select
                        value={val}
                        onChange={(e) => onChange(e.target.value)}
                        required={field.required}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                    >
                        <option value="">Select...</option>
                        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                ) : field.type === 'textarea' ? (
                    <textarea
                        value={val}
                        onChange={(e) => onChange(e.target.value)}
                        required={field.required}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all resize-none"
                        rows={3}
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                    />
                ) : field.type === 'checkbox' ? (
                    <label className="flex items-center gap-3 cursor-pointer py-1">
                        <input
                            type="checkbox"
                            checked={!!val}
                            onChange={(e) => onChange(e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">{field.label}</span>
                    </label>
                ) : field.type === 'number' ? (
                    <input
                        type="number"
                        value={val}
                        onChange={(e) => onChange(e.target.value)}
                        required={field.required}
                        min={field.min}
                        max={field.max}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                        placeholder={field.min != null && field.max != null ? `${field.min} - ${field.max}` : `Enter ${field.label.toLowerCase()}...`}
                    />
                ) : (
                    <input
                        type="text"
                        value={val}
                        onChange={(e) => onChange(e.target.value)}
                        required={field.required}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                    />
                )}
            </div>
        );
    };

    /* ---------- Contact fields ---------- */
    const renderContactFields = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {showName && (
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 block">Full Name *</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><User className="h-5 w-5" /></div>
                            <input
                                type="text"
                                required
                                value={contactInfo.name}
                                onChange={(e) => setContactInfo(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                                placeholder="John Doe"
                            />
                        </div>
                    </div>
                )}
                {showEmail && (
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 block">Email Address *</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Mail className="h-5 w-5" /></div>
                            <input
                                type="email"
                                required
                                value={contactInfo.email}
                                onChange={(e) => setContactInfo(prev => ({ ...prev, email: e.target.value }))}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                                placeholder="john@example.com"
                            />
                        </div>
                    </div>
                )}
            </div>
            {showPhone && (
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 block">Phone Number (Optional)</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Phone className="h-5 w-5" /></div>
                        <input
                            type="tel"
                            value={contactInfo.phone}
                            onChange={(e) => setContactInfo(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                            placeholder="(555) 123-4567"
                        />
                    </div>
                </div>
            )}
            {showAddress && (
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 block">Address (Optional)</label>
                    <input
                        type="text"
                        value={contactInfo.address}
                        onChange={(e) => setContactInfo(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                        placeholder="123 Main St, City, Province"
                    />
                </div>
            )}
            {showPreferredDate && (
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 block">Preferred Date (Optional)</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Calendar className="h-5 w-5" /></div>
                        <input
                            type="date"
                            value={contactInfo.preferredDate}
                            onChange={(e) => setContactInfo(prev => ({ ...prev, preferredDate: e.target.value }))}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                        />
                    </div>
                </div>
            )}
            {showMessage && (
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 block">Additional Notes (Optional)</label>
                    <div className="relative">
                        <div className="absolute top-3 left-3 pointer-events-none text-slate-400"><MessageSquare className="h-5 w-5" /></div>
                        <textarea
                            value={contactInfo.message}
                            onChange={(e) => setContactInfo(prev => ({ ...prev, message: e.target.value }))}
                            maxLength={2000}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all resize-none"
                            rows={3}
                            placeholder="Anything else we should know?"
                        />
                    </div>
                </div>
            )}
        </>
    );

    /* ---------- Estimate panel ---------- */
    const renderEstimatePanel = () => {
        if (!estimate) return null;
        const hasValues = Object.values(formValues).some(v => v != null && v !== '' && v !== false);
        return (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-emerald-700" />
                    <h3 className="text-lg font-bold text-emerald-900">Estimated Range</h3>
                </div>
                <div className="text-center py-4">
                    {hasValues ? (
                        <p className="text-3xl md:text-4xl font-bold text-emerald-800">
                            {formatCents(estimate.low, pricingCurrency)} &ndash; {formatCents(estimate.high, pricingCurrency)}
                        </p>
                    ) : (
                        <p className="text-lg text-emerald-600/70 italic">Fill in the fields to see your estimate</p>
                    )}
                </div>
                <p className="text-xs text-emerald-700/80 leading-relaxed">{pricingDisclaimer}</p>
            </div>
        );
    };

    /* ---------- Main form ---------- */
    const formContent = (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
                <label htmlFor={`_hp_${id}`}>Leave this field blank</label>
                <input
                    id={`_hp_${id}`}
                    type="text"
                    name="_hp"
                    tabIndex={-1}
                    autoComplete="off"
                    value={contactInfo._hp}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, _hp: e.target.value }))}
                />
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Custom fields */}
            <div className="space-y-4">
                {fields.map(renderField)}
            </div>

            {/* Contact fields */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
                {renderContactFields()}
            </div>

            {/* Submit */}
            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
                style={{ backgroundColor: pSecondary }}
            >
                {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                    <div className="flex items-center gap-2">
                        <Send className="w-5 h-5" />
                        {submitText}
                    </div>
                )}
            </button>
        </form>
    );

    /* ---------- Calculator layout ---------- */
    if (isCalculator) {
        return (
            <section className="py-20 px-4" style={{ backgroundColor: '#ffffff' }}>
                <div className="max-w-6xl mx-auto space-y-12">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl md:text-5xl font-bold" style={{ color: pPrimary }}>{title}</h2>
                        <p className="text-lg md:text-xl max-w-2xl mx-auto text-slate-600">{description}</p>
                    </div>

                    {/* Desktop: two columns */}
                    <div className="hidden md:grid md:grid-cols-5 gap-8 items-start">
                        <div className="col-span-3 bg-white shadow-xl shadow-slate-200/50 border border-slate-100 rounded-2xl p-6 md:p-10">
                            {formContent}
                        </div>
                        <div className="col-span-2 sticky top-8">
                            {renderEstimatePanel()}
                        </div>
                    </div>

                    {/* Mobile: form + sticky bottom bar */}
                    <div className="md:hidden">
                        <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-100 rounded-2xl p-6 pb-32">
                            {formContent}
                        </div>
                        {/* Sticky bottom estimate bar */}
                        {estimate && (
                            <div className="fixed bottom-0 left-0 right-0 bg-emerald-50 border-t border-emerald-200 px-4 py-3 z-50 shadow-lg">
                                <div className="flex items-center justify-between max-w-lg mx-auto">
                                    <div>
                                        <p className="text-xs text-emerald-700 font-medium">Estimated Range</p>
                                        <p className="text-lg font-bold text-emerald-800">
                                            {Object.values(formValues).some(v => v != null && v !== '' && v !== false)
                                                ? `${formatCents(estimate.low, pricingCurrency)} \u2013 ${formatCents(estimate.high, pricingCurrency)}`
                                                : '\u2014'
                                            }
                                        </p>
                                    </div>
                                    <Calculator className="w-5 h-5 text-emerald-600" />
                                </div>
                                <p className="text-[10px] text-emerald-600/70 text-center mt-1">{pricingDisclaimer}</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    /* ---------- Simple layout ---------- */
    return (
        <section className="py-20 px-4" style={{ backgroundColor: '#ffffff' }}>
            <div className="max-w-3xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h2 className="text-4xl md:text-5xl font-bold" style={{ color: pPrimary }}>{title}</h2>
                    <p className="text-lg md:text-xl max-w-2xl mx-auto text-slate-600">{description}</p>
                </div>
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-100 rounded-2xl p-6 md:p-10">
                    {formContent}
                </div>
            </div>
        </section>
    );
}
