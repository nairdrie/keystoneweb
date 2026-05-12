'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calculator, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import Reveal from '@/app/components/Reveal';
import {
    calculateQuote,
    formatQuoteMoney,
    getFieldDisplayValue,
    getQuoteDisplayText,
    normalizeEstimateQuoteSettings,
    type EstimateField,
    type EstimateQuoteSettings,
    type QuoteCalculationResult,
} from '@/lib/estimate-quote';

interface EstimateFormBlockProps {
    id: string;
    data: Record<string, unknown>;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: unknown) => void;
}

type ContactInfo = {
    name: string;
    email: string;
    phone: string;
    company: string;
    address: string;
    preferredDate: string;
    message: string;
    _hp: string;
};

const EMPTY_CONTACT: ContactInfo = {
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    preferredDate: '',
    message: '',
    _hp: '',
};

export default function EstimateFormBlock({ id, data, isEditMode, palette }: EstimateFormBlockProps) {
    const context = useEditorContext();
    const siteId = context?.siteId;
    const settings = useMemo(() => normalizeEstimateQuoteSettings(data), [data]);
    const [formValues, setFormValues] = useState<Record<string, unknown>>(() => buildInitialValues(settings));
    const [contactInfo, setContactInfo] = useState<ContactInfo>(EMPTY_CONTACT);
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [touchedSubmit, setTouchedSubmit] = useState(false);

    useEffect(() => {
        rememberTracking(settings);
    }, [settings]);

    const pPrimary = palette.primary || '#0f172a';
    const pSecondary = palette.secondary || '#2563eb';
    const steps = useMemo(
        () => settings.layoutMode === 'multi-step' ? (settings.steps || []).slice().sort((a, b) => a.order - b.order) : [],
        [settings],
    );
    const activeStep = steps[stepIndex];
    const isMultiStep = steps.length > 0;
    const quoteValues = useMemo(() => ({ ...formValues, ...contactValuesByField(settings, contactInfo) }), [formValues, settings, contactInfo]);
    const quoteResult = useMemo(() => calculateQuote(settings, quoteValues), [settings, quoteValues]);
    const showLiveEstimate = settings.quoteMode !== 'request-only' && settings.display.showEstimateBeforeSubmit;
    const currentFields = isMultiStep
        ? settings.fields.filter((field) => (field.stepId || 'details') === activeStep?.id)
        : settings.fields;
    const isReviewStep = activeStep?.id === 'review';
    const isSubmitStep = activeStep?.id === 'submit';
    const visibleFields = isReviewStep || isSubmitStep ? [] : currentFields;
    const stepErrors = touchedSubmit ? validateFields(visibleFields, quoteValues) : [];

    const updateFieldValue = (field: EstimateField, value: unknown) => {
        const role = field.contactRole;
        if (role) {
            const key = contactKeyForRole(role);
            setContactInfo((current) => ({
                ...current,
                [key]: String(value ?? ''),
            }));
        }
        setFormValues((current) => ({ ...current, [field.id]: value }));
    };

    const goNext = () => {
        setTouchedSubmit(true);
        if (validateFields(visibleFields, quoteValues).length > 0) return;
        setTouchedSubmit(false);
        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    };

    const goBack = () => {
        setTouchedSubmit(false);
        setStepIndex((current) => Math.max(current - 1, 0));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setTouchedSubmit(true);

        const allErrors = validateFields(settings.fields, quoteValues);
        if (allErrors.length > 0) {
            setError(allErrors[0]);
            return;
        }

        if (isEditMode) return;
        if (!siteId) {
            setError('This form is not connected to a saved site yet.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const submissionName = contactInfo.name.trim() || 'Estimate request';
            const submissionEmail = contactInfo.email.trim() || 'estimate-request@kswd.ca';
            const tracking = captureTracking(settings);
            const metadata: Record<string, unknown> = {
                blockId: id,
                fields: settings.fields.map((field) => ({
                    id: field.id,
                    label: field.label,
                    value: getFieldDisplayValue(field, quoteValues[field.id]),
                    rawValue: quoteValues[field.id] ?? '',
                    type: field.type,
                    unit: field.unit || undefined,
                })),
                contact: {
                    name: contactInfo.name.trim() || undefined,
                    email: contactInfo.email.trim() || undefined,
                    phone: contactInfo.phone.trim() || undefined,
                    company: contactInfo.company.trim() || undefined,
                    address: contactInfo.address.trim() || undefined,
                    preferredDate: contactInfo.preferredDate || undefined,
                    message: contactInfo.message.trim() || undefined,
                    usedFallbackName: !contactInfo.name.trim(),
                    usedFallbackEmail: !contactInfo.email.trim(),
                },
                estimateQuoteSettings: settings,
                quoteValues,
                quoteResult,
                quoteStatus: 'new',
                quoteMode: settings.quoteMode,
                displayMode: quoteResult.displayMode,
                triggeredRuleIds: quoteResult.triggeredRuleIds,
                inactiveRuleIds: quoteResult.inactiveRuleIds,
                pricingWarnings: quoteResult.warnings,
                notifications: settings.notifications,
                crm: settings.crm,
                deposit: settings.deposit,
                tracking,
            };

            if (showLiveEstimate && quoteResult.displayMode !== 'hidden') {
                metadata.estimate_shown = true;
                metadata.estimate_low_cents = quoteResult.rangeLowCents ?? quoteResult.totalCents;
                metadata.estimate_high_cents = quoteResult.rangeHighCents ?? quoteResult.totalCents;
                metadata.estimate_currency = quoteResult.currency;
                metadata.estimate_disclaimer = settings.display.disclaimer;
            }

            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    name: submissionName,
                    email: submissionEmail,
                    phone: contactInfo.phone || undefined,
                    message: contactInfo.message || buildFallbackMessage(settings, quoteValues),
                    _hp: contactInfo._hp,
                    source_type: 'estimate_form',
                    metadata,
                }),
            });

            if (!res.ok) {
                const responseData = await res.json().catch(() => null);
                throw new Error(responseData?.error || 'Failed to send request');
            }

            if (settings.success.redirectUrl) {
                window.location.href = settings.success.redirectUrl;
                return;
            }

            setSuccess(true);
            setFormValues(buildInitialValues(settings));
            setContactInfo(EMPTY_CONTACT);
            setStepIndex(0);
            setTouchedSubmit(false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <section className="px-4 py-20" style={{ backgroundColor: '#ffffff' }}>
                <div className="mx-auto max-w-3xl">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-7 w-7" />
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-950">Request Submitted</h3>
                        <p className="mt-2 text-sm leading-6 text-emerald-800">{settings.success.message}</p>
                        <button
                            type="button"
                            onClick={() => setSuccess(false)}
                            className="mt-6 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
                        >
                            Submit another request
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="px-4 py-16 md:py-20" style={{ backgroundColor: '#ffffff' }}>
            <div className="mx-auto max-w-6xl">
                <Reveal>
                <div className="mx-auto max-w-3xl text-center">
                    <h2 className="text-3xl font-bold tracking-normal md:text-5xl" style={{ color: pPrimary }}>
                        {settings.title}
                    </h2>
                    {settings.description && (
                        <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">{settings.description}</p>
                    )}
                </div>
                </Reveal>

                <div className={`mt-10 grid gap-6 ${showLiveEstimate ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : 'mx-auto max-w-3xl'}`}>
                    <Reveal>
                    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
                            <label htmlFor={`_hp_${id}`}>Leave this field blank</label>
                            <input
                                id={`_hp_${id}`}
                                type="text"
                                name="_hp"
                                tabIndex={-1}
                                autoComplete="off"
                                value={contactInfo._hp}
                                onChange={(event) => setContactInfo((current) => ({ ...current, _hp: event.target.value }))}
                            />
                        </div>

                        {isMultiStep && (
                            <StepHeader steps={steps} activeIndex={stepIndex} />
                        )}

                        {error && (
                            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {stepErrors.length > 0 && (
                            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                {stepErrors[0]}
                            </div>
                        )}

                        {isReviewStep || isSubmitStep ? (
                            <ReviewPanel settings={settings} values={quoteValues} result={quoteResult} />
                        ) : (
                            <div className="grid gap-4">
                                {visibleFields.map((field) => (
                                    <FieldControl
                                        key={field.id}
                                        field={field}
                                        value={quoteValues[field.id] ?? ''}
                                        onChange={(value) => updateFieldValue(field, value)}
                                    />
                                ))}
                            </div>
                        )}

                        {isMultiStep ? (
                            <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                                <button
                                    type="button"
                                    onClick={goBack}
                                    disabled={stepIndex === 0}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </button>
                                {stepIndex < steps.length - 1 ? (
                                    <button
                                        type="button"
                                        onClick={goNext}
                                        className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                                        style={{ backgroundColor: pSecondary }}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <SubmitButton loading={loading} label={settings.submitButtonLabel} color={pSecondary} />
                                )}
                            </div>
                        ) : (
                            <div className="mt-6">
                                <SubmitButton loading={loading} label={settings.submitButtonLabel} color={pSecondary} />
                            </div>
                        )}

                        {isEditMode && (
                            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                                Use the block settings panel to edit fields, pricing rules, steps, notifications, and the live quote preview.
                            </div>
                        )}
                    </form>
                    </Reveal>

                    {showLiveEstimate && (
                        <Reveal>
                        <aside className="lg:sticky lg:top-8 lg:self-start">
                            <QuotePreview result={quoteResult} settings={settings} />
                        </aside>
                        </Reveal>
                    )}
                </div>
            </div>
        </section>
    );
}

function FieldControl({ field, value, onChange }: { field: EstimateField; value: unknown; onChange: (value: unknown) => void }) {
    const commonClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100';
    const label = (
        <label className="block text-sm font-bold text-slate-800" htmlFor={field.id}>
            {field.label}{field.required ? <span className="text-red-500"> *</span> : null}
            {field.unit ? <span className="font-normal text-slate-400"> ({field.unit})</span> : null}
        </label>
    );

    if (field.type === 'textarea') {
        return (
            <div className="space-y-1.5">
                {label}
                {field.description && <p className="text-xs leading-5 text-slate-500">{field.description}</p>}
                <textarea
                    id={field.id}
                    value={String(value ?? '')}
                    onChange={(event) => onChange(event.target.value)}
                    required={field.required}
                    rows={4}
                    placeholder={field.placeholder}
                    className={`${commonClass} resize-y`}
                />
            </div>
        );
    }

    if (field.type === 'select' || field.type === 'service-option') {
        return (
            <div className="space-y-1.5">
                {label}
                {field.description && <p className="text-xs leading-5 text-slate-500">{field.description}</p>}
                <select
                    id={field.id}
                    value={String(value ?? '')}
                    onChange={(event) => onChange(event.target.value)}
                    required={field.required}
                    className={commonClass}
                >
                    <option value="">Select...</option>
                    {(field.options || []).map((option) => (
                        <option key={option.id} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>
        );
    }

    if (field.type === 'radio') {
        return (
            <fieldset className="space-y-2">
                <legend className="text-sm font-bold text-slate-800">
                    {field.label}{field.required ? <span className="text-red-500"> *</span> : null}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                    {(field.options || []).map((option) => (
                        <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
                            <input
                                type="radio"
                                name={field.id}
                                value={option.value}
                                checked={value === option.value}
                                onChange={() => onChange(option.value)}
                                required={field.required}
                                className="h-4 w-4"
                            />
                            <span>{option.label}</span>
                        </label>
                    ))}
                </div>
            </fieldset>
        );
    }

    if (field.type === 'checkbox' || field.type === 'addon') {
        if (field.options?.length) {
            const values = Array.isArray(value) ? value.map(String) : [];
            return (
                <fieldset className="space-y-2">
                    <legend className="text-sm font-bold text-slate-800">
                        {field.label}{field.required ? <span className="text-red-500"> *</span> : null}
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {field.options.map((option) => (
                            <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    value={option.value}
                                    checked={values.includes(option.value)}
                                    onChange={(event) => {
                                        onChange(event.target.checked
                                            ? [...values, option.value]
                                            : values.filter((item) => item !== option.value));
                                    }}
                                    className="h-4 w-4 rounded"
                                />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
            );
        }

        return (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => onChange(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded"
                />
                <span>
                    {field.label}{field.required ? <span className="text-red-500"> *</span> : null}
                    {field.description && <span className="mt-1 block text-xs font-normal text-slate-500">{field.description}</span>}
                </span>
            </label>
        );
    }

    if (field.type === 'file') {
        return (
            <div className="space-y-1.5">
                {label}
                <input
                    id={field.id}
                    type="file"
                    required={field.required}
                    onChange={(event) => onChange(Array.from(event.target.files || []).map((file) => file.name))}
                    className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                />
            </div>
        );
    }

    const inputType = field.type === 'email' ? 'email'
        : field.type === 'phone' ? 'tel'
            : field.type === 'date' ? 'date'
                : field.type === 'number' || field.type === 'quantity' ? 'number'
                    : 'text';

    return (
        <div className="space-y-1.5">
            {label}
            {field.description && <p className="text-xs leading-5 text-slate-500">{field.description}</p>}
            <input
                id={field.id}
                type={inputType}
                value={String(value ?? '')}
                onChange={(event) => onChange(event.target.value)}
                required={field.required}
                min={field.validation?.min}
                max={field.validation?.max}
                placeholder={field.placeholder}
                className={commonClass}
            />
        </div>
    );
}

function StepHeader({ steps, activeIndex }: { steps: NonNullable<EstimateQuoteSettings['steps']>; activeIndex: number }) {
    const active = steps[activeIndex];
    return (
        <div className="mb-6 border-b border-slate-100 pb-5">
            <div className="mb-3 flex items-center gap-2">
                {steps.map((step, index) => (
                    <div key={step.id} className={`h-2 flex-1 rounded-full ${index <= activeIndex ? 'bg-slate-900' : 'bg-slate-200'}`} />
                ))}
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Step {activeIndex + 1} of {steps.length}</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">{active?.title}</h3>
            {active?.description && <p className="mt-1 text-sm leading-6 text-slate-500">{active.description}</p>}
        </div>
    );
}

function SubmitButton({ loading, label, color }: { loading: boolean; label: string; color: string }) {
    return (
        <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm font-black text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: color }}
        >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {label}
        </button>
    );
}

function QuotePreview({ result, settings }: { result: QuoteCalculationResult; settings: EstimateQuoteSettings }) {
    const hidden = result.displayMode === 'hidden';
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-emerald-300" />
                <h3 className="text-base font-bold">Quote Preview</h3>
            </div>
            <div className="mt-5 rounded-xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-white/60">
                    {hidden ? 'Quote request' : 'Estimated total'}
                </p>
                <p className="mt-1 text-3xl font-black tracking-normal">
                    {getQuoteDisplayText(result)}
                </p>
                {settings.display.showDeposit && result.depositCents > 0 && (
                    <p className="mt-2 text-sm text-emerald-200">
                        Deposit: {formatQuoteMoney(result.depositCents, result.currency)}
                    </p>
                )}
            </div>

            {settings.display.showLineItems && result.lineItems.length > 0 && !hidden && (
                <div className="mt-5 space-y-2">
                    {result.lineItems.filter((item) => item.type !== 'deposit').map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                            <span className="text-white/75">{item.label}</span>
                            <span className={item.amountCents < 0 ? 'font-bold text-emerald-200' : 'font-bold text-white'}>
                                {item.amountCents < 0 ? '-' : '+'}{formatQuoteMoney(Math.abs(item.amountCents), result.currency)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {!hidden && (
                <div className="mt-5 border-t border-white/10 pt-4 text-sm">
                    <div className="flex justify-between font-bold">
                        <span>Subtotal</span>
                        <span>{formatQuoteMoney(result.subtotalCents, result.currency)}</span>
                    </div>
                    {result.depositCents > 0 && (
                        <div className="mt-2 flex justify-between text-emerald-200">
                            <span>Deposit due</span>
                            <span>{formatQuoteMoney(result.depositCents, result.currency)}</span>
                        </div>
                    )}
                </div>
            )}

            {settings.display.disclaimer && (
                <p className="mt-4 text-xs leading-5 text-white/55">{settings.display.disclaimer}</p>
            )}
        </div>
    );
}

function ReviewPanel({ settings, values, result }: { settings: EstimateQuoteSettings; values: Record<string, unknown>; result: QuoteCalculationResult }) {
    return (
        <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quote summary</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{getQuoteDisplayText(result)}</p>
                {settings.display.showDeposit && result.depositCents > 0 && (
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                        Deposit: {formatQuoteMoney(result.depositCents, result.currency)}
                    </p>
                )}
            </div>
            <div className="grid gap-2">
                {settings.fields.map((field) => {
                    const value = getFieldDisplayValue(field, values[field.id]);
                    if (!value) return null;
                    return (
                        <div key={field.id} className="flex flex-col gap-1 rounded-lg border border-slate-100 px-3 py-2 sm:flex-row sm:justify-between">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{field.label}</span>
                            <span className="text-sm font-medium text-slate-800">{value}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function buildInitialValues(settings: EstimateQuoteSettings): Record<string, unknown> {
    return Object.fromEntries(settings.fields.map((field) => [field.id, field.defaultValue ?? (field.type === 'checkbox' && field.options?.length ? [] : '')]));
}

function validateFields(fields: EstimateField[], values: Record<string, unknown>): string[] {
    return fields.flatMap((field) => {
        if (!field.required) return [];
        const value = values[field.id];
        const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || value === false;
        return empty ? [`${field.label} is required.`] : [];
    });
}

function contactValuesByField(settings: EstimateQuoteSettings, contactInfo: ContactInfo): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of settings.fields) {
        if (!field.contactRole) continue;
        values[field.id] = contactInfo[contactKeyForRole(field.contactRole)];
    }
    return values;
}

function contactKeyForRole(role: NonNullable<EstimateField['contactRole']>): keyof ContactInfo {
    if (role === 'email') return 'email';
    if (role === 'phone') return 'phone';
    if (role === 'company') return 'company';
    if (role === 'address') return 'address';
    if (role === 'preferredDate') return 'preferredDate';
    if (role === 'message') return 'message';
    return 'name';
}

function buildFallbackMessage(settings: EstimateQuoteSettings, values: Record<string, unknown>): string {
    return settings.fields
        .map((field) => `${field.label}: ${getFieldDisplayValue(field, values[field.id]) || '-'}`)
        .join('\n');
}

function captureTracking(settings: EstimateQuoteSettings): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    const tracking: Record<string, string> = {};
    if (settings.tracking.captureUtm) {
        for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
            const value = params.get(key);
            if (value) {
                window.sessionStorage.setItem(`ks_${key}`, value);
                tracking[key] = value;
            } else {
                const stored = window.sessionStorage.getItem(`ks_${key}`);
                if (stored) tracking[key] = stored;
            }
        }
    }
    if (settings.tracking.captureLandingPage) {
        const stored = window.sessionStorage.getItem('ks_landing_page');
        const landing = stored || window.location.href;
        if (!stored) window.sessionStorage.setItem('ks_landing_page', landing);
        tracking.landingPageUrl = landing;
    }
    if (settings.tracking.captureReferrer && document.referrer) tracking.referrer = document.referrer;
    tracking.currentPageUrl = window.location.href;
    return tracking;
}

function rememberTracking(settings: EstimateQuoteSettings) {
    if (typeof window === 'undefined') return;
    if (settings.tracking.captureLandingPage && !window.sessionStorage.getItem('ks_landing_page')) {
        window.sessionStorage.setItem('ks_landing_page', window.location.href);
    }
    if (!settings.tracking.captureUtm) return;
    const params = new URLSearchParams(window.location.search);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
        const value = params.get(key);
        if (value) window.sessionStorage.setItem(`ks_${key}`, value);
    }
}
