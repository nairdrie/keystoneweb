'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Calculator,
    Check,
    ChevronDown,
    GripVertical,
    Plus,
    Trash2,
} from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from '../BlockSettingsPanel';
import { CardSettingsControls } from '../CardSettingsControls';
import KeyframeEditor, { inferFieldNames } from '../KeyframeEditor';
import { InspectorSection, InspectorToggle, useInspectorSectionState } from '../panel-shared';
import { LayoutTab } from '../layout/LayoutTab';
import type { BlockPanelProps } from '../block-panel-registry';
import {
    areSectionSettingsEqual,
    normalizeSectionSettings,
    type SectionSettings,
} from '@/lib/builder/layout-settings';
import {
    calculateQuote,
    dollarsToCents,
    ESTIMATE_QUOTE_TEMPLATES,
    formatQuoteMoney,
    getQuoteDisplayText,
    normalizeEstimateQuoteSettings,
    type EstimateField,
    type EstimateFieldType,
    type EstimateQuoteSettings,
    type PricingAction,
    type PricingActionType,
    type PricingCondition,
    type PricingConditionOperator,
    type PricingRule,
} from '@/lib/estimate-quote';
import {
    buildCardSettingsForPreset,
    readCardSettings,
    type CardSettings,
} from '@/lib/block-style-options';

type EditorMode = 'simple' | 'advanced';

type EstimateQuoteDraft = {
    settings: EstimateQuoteSettings;
    sectionSettings: SectionSettings;
    cardStyle: string;
    cardSettings?: CardSettings;
    __customCss: string;
    __customScript: string;
};

const SECTION_IDS = ['mode', 'guided', 'fields', 'steps', 'display', 'advanced-pricing', 'integrations', 'preview', 'universal-layout', 'style', 'advanced'];

const FIELD_TYPE_OPTIONS: Array<{ value: EstimateFieldType; label: string }> = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Long text' },
    { value: 'select', label: 'Dropdown' },
    { value: 'radio', label: 'Radio buttons' },
    { value: 'checkbox', label: 'Checkboxes' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'quantity', label: 'Quantity' },
    { value: 'service-option', label: 'Service option' },
    { value: 'addon', label: 'Add-ons' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
];

const CONDITION_OPTIONS: Array<{ value: PricingConditionOperator; label: string }> = [
    { value: 'equals', label: 'equals' },
    { value: 'not-equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not-contains', label: 'does not contain' },
    { value: 'checked', label: 'is checked' },
    { value: 'not-checked', label: 'is not checked' },
    { value: 'gt', label: 'greater than' },
    { value: 'gte', label: 'greater than or equal to' },
    { value: 'lt', label: 'less than' },
    { value: 'lte', label: 'less than or equal to' },
    { value: 'between', label: 'between' },
    { value: 'empty', label: 'is empty' },
    { value: 'not-empty', label: 'is not empty' },
];

const ACTION_OPTIONS: Array<{ value: PricingActionType; label: string }> = [
    { value: 'add-fixed', label: 'Add fixed amount' },
    { value: 'subtract-fixed', label: 'Subtract fixed amount' },
    { value: 'multiply', label: 'Multiply by number' },
    { value: 'add-percentage', label: 'Add percentage' },
    { value: 'subtract-percentage', label: 'Subtract percentage' },
    { value: 'set-base-price', label: 'Set base price' },
    { value: 'set-line-item', label: 'Set line item price' },
    { value: 'add-per-unit', label: 'Add price per unit' },
    { value: 'add-option-price', label: 'Add selected option prices' },
    { value: 'set-deposit', label: 'Add deposit amount' },
    { value: 'apply-discount', label: 'Apply discount' },
    { value: 'apply-fee', label: 'Apply fee' },
];

export default function EstimateQuoteSettingsPanel({
    blockId,
    blockType = 'estimateForm',
    blockData,
    isProUser,
    palette,
    customCss,
    onClose,
    onDraftBlockDataChange,
}: BlockPanelProps) {
    const context = useEditorContext();
    const initialDraft = useMemo(() => buildInitialDraft(blockData || {}, customCss), [blockData, customCss]);
    const [draft, setDraft] = useState<EstimateQuoteDraft>(initialDraft);
    const [mode, setMode] = useState<EditorMode>('simple');
    const [testValues, setTestValues] = useState<Record<string, unknown>>({});
    const sectionState = useInspectorSectionState(SECTION_IDS, true);
    const warnings = useMemo(() => calculateQuote(draft.settings, testValues).warnings, [draft.settings, testValues]);
    const previewResult = useMemo(() => calculateQuote(draft.settings, testValues), [draft.settings, testValues]);

    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        onDraftBlockDataChange(buildPreviewBlockData(blockData || {}, draft));
    }, [blockData, draft, onDraftBlockDataChange]);

    const updateSettings = (updates: Partial<EstimateQuoteSettings>) => {
        setDraft((current) => ({ ...current, settings: { ...current.settings, ...updates } }));
    };

    const updateNestedSettings = <K extends keyof EstimateQuoteSettings>(key: K, value: EstimateQuoteSettings[K]) => {
        setDraft((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
    };

    const updateCardSettings = (value: CardSettings) => {
        setDraft((current) => ({
            ...current,
            cardSettings: value,
            cardStyle: value.presetId && value.presetId !== 'custom' ? value.presetId : current.cardStyle,
        }));
    };

    const updateField = (fieldId: string, updates: Partial<EstimateField>) => {
        updateSettings({
            fields: draft.settings.fields.map((field) => field.id === fieldId ? { ...field, ...updates } : field),
        });
    };

    const addField = (kind: EstimateFieldType) => {
        const field = createField(kind, draft.settings.fields.length);
        updateSettings({ fields: [...draft.settings.fields, field] });
    };

    const deleteField = (fieldId: string) => {
        updateSettings({
            fields: draft.settings.fields.filter((field) => field.id !== fieldId),
            pricingRules: draft.settings.pricingRules.map((rule) => ({
                ...rule,
                conditions: rule.conditions.filter((condition) => condition.fieldId !== fieldId),
                actions: rule.actions.filter((action) => action.fieldId !== fieldId),
            })),
        });
    };

    const moveField = (fieldId: string, direction: -1 | 1) => {
        updateSettings({ fields: moveById(draft.settings.fields, fieldId, direction) });
    };

    const addRule = () => {
        const firstField = draft.settings.fields[0]?.id || '';
        const rule: PricingRule = {
            id: createId('rule'),
            name: 'New pricing rule',
            enabled: true,
            conditionMode: 'all',
            conditions: [{ fieldId: firstField, operator: 'equals', value: '' }],
            actions: [{ type: 'add-fixed', amountCents: 0, label: 'Adjustment' }],
        };
        updateSettings({ pricingRules: [...draft.settings.pricingRules, rule] });
        setMode('advanced');
    };

    const updateRule = (ruleId: string, updates: Partial<PricingRule>) => {
        updateSettings({
            pricingRules: draft.settings.pricingRules.map((rule) => rule.id === ruleId ? { ...rule, ...updates } : rule),
        });
    };

    const moveRule = (ruleId: string, direction: -1 | 1) => {
        updateSettings({ pricingRules: moveById(draft.settings.pricingRules, ruleId, direction) });
    };

    const applyTemplate = (templateId: string) => {
        updateSettings(applyStarterTemplate(draft.settings, templateId));
        setTestValues({});
    };

    useEffect(() => {
        if (!context?.updateBlockDataBatch) return;
        if (JSON.stringify(draft) === JSON.stringify(initialDraft)) return;
        const updates = buildSaveUpdates(blockData || {}, draft);
        context.updateBlockDataBatch(blockId, updates);
    }, [draft, initialDraft, blockData, blockId, context]);

    return (
        <BlockSettingsPanel
            isOpen
            title="Estimate / Quote Form Settings"
            subtitle="Build a guided quote form with optional pricing rules and a live preview."
            blockId={blockId}
            blockType={blockType}
            onClose={onClose}
            allCollapsed={sectionState.allCollapsed}
            onToggleAllCollapsed={() => sectionState.setAll(!sectionState.allCollapsed)}
            tourId="estimate-quote-settings-panel"
        >
            <InspectorSection
                id="mode"
                title="Display: Editing Mode"
                isCollapsed={sectionState.isCollapsed('mode')}
                onToggle={() => sectionState.toggle('mode')}
            >
                <div className="grid grid-cols-2 gap-2">
                    <ModeButton active={mode === 'simple'} label="Simple Mode" onClick={() => setMode('simple')} />
                    <ModeButton active={mode === 'advanced'} label="Advanced Pricing" onClick={() => setMode('advanced')} />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                    Simple Mode is for everyday setup. Advanced Pricing adds conditional rules without formula code.
                </p>
            </InspectorSection>

            <InspectorSection
                id="guided"
                title="Content: Guided Setup"
                isCollapsed={sectionState.isCollapsed('guided')}
                onToggle={() => sectionState.toggle('guided')}
            >
                <div className="space-y-4">
                    <TextField label="Form title" value={draft.settings.title} onChange={(title) => updateSettings({ title })} />
                    <TextareaField label="Form description" value={draft.settings.description || ''} onChange={(description) => updateSettings({ description })} />
                    <div className="grid grid-cols-2 gap-2">
                        <SelectField
                            label="Currency"
                            value={draft.settings.currency}
                            onChange={(currency) => updateSettings({ currency })}
                            options={['CAD', 'USD', 'EUR', 'GBP', 'AUD'].map((value) => ({ value, label: value }))}
                        />
                        <MoneyField
                            label="Base price"
                            valueCents={draft.settings.basePricing.basePriceCents}
                            onChange={(basePriceCents) => updateNestedSettings('basePricing', { ...draft.settings.basePricing, enabled: true, basePriceCents: basePriceCents ?? 0 })}
                        />
                    </div>
                    <SelectField
                        label="Quote type"
                        value={draft.settings.quoteMode}
                        onChange={(quoteMode) => updateSettings({ quoteMode: quoteMode as EstimateQuoteSettings['quoteMode'] })}
                        options={[
                            { value: 'instant', label: 'Instant estimate' },
                            { value: 'request-only', label: 'Request quote only' },
                            { value: 'hybrid', label: 'Instant estimate + follow-up' },
                        ]}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <TextField label="Submit button" value={draft.settings.submitButtonLabel} onChange={(submitButtonLabel) => updateSettings({ submitButtonLabel })} />
                        <TextField
                            label="Success message"
                            value={draft.settings.success.message}
                            onChange={(message) => updateNestedSettings('success', { ...draft.settings.success, message })}
                        />
                    </div>
                    <TextareaField
                        label="Notification recipients"
                        value={draft.settings.notifications.businessRecipients.join(', ')}
                        placeholder="owner@example.com, office@example.com"
                        onChange={(value) => updateNestedSettings('notifications', {
                            ...draft.settings.notifications,
                            businessRecipients: splitList(value),
                        })}
                    />
                    <InspectorToggle
                        label="Send customer confirmation email"
                        description="Sends a quote summary to the customer when an email address is provided."
                        checked={draft.settings.notifications.sendCustomerEmail}
                        onChange={() => updateNestedSettings('notifications', {
                            ...draft.settings.notifications,
                            sendCustomerEmail: !draft.settings.notifications.sendCustomerEmail,
                        })}
                    />
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Starter templates</p>
                        <div className="space-y-2">
                            {ESTIMATE_QUOTE_TEMPLATES.map((template) => (
                                <button
                                    key={template.id}
                                    type="button"
                                    onClick={() => applyTemplate(template.id)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
                                >
                                    <span className="block text-sm font-bold text-slate-800">{template.label}</span>
                                    <span className="block text-xs leading-5 text-slate-500">{template.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </InspectorSection>

            <InspectorSection
                id="fields"
                title="Content: Fields"
                isCollapsed={sectionState.isCollapsed('fields')}
                onToggle={() => sectionState.toggle('fields')}
            >
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        {FIELD_TYPE_OPTIONS.slice(0, mode === 'simple' ? 10 : FIELD_TYPE_OPTIONS.length).map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => addField(option.value)}
                                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-2 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                {option.label}
                            </button>
                        ))}
                    </div>
                    {draft.settings.fields.map((field, index) => (
                        <FieldEditor
                            key={field.id}
                            field={field}
                            index={index}
                            steps={draft.settings.steps || []}
                            onUpdate={(updates) => updateField(field.id, updates)}
                            onDelete={() => deleteField(field.id)}
                            onMove={(direction) => moveField(field.id, direction)}
                        />
                    ))}
                </div>
            </InspectorSection>

            <InspectorSection
                id="steps"
                title="Content: Pages / Steps"
                isCollapsed={sectionState.isCollapsed('steps')}
                onToggle={() => sectionState.toggle('steps')}
            >
                <div className="space-y-4">
                    <SelectField
                        label="Layout"
                        value={draft.settings.layoutMode}
                        onChange={(layoutMode) => updateSettings({ layoutMode: layoutMode as EstimateQuoteSettings['layoutMode'] })}
                        options={[
                            { value: 'single-page', label: 'Single page' },
                            { value: 'multi-step', label: 'Multi-step wizard' },
                        ]}
                    />
                    {draft.settings.layoutMode === 'multi-step' && (
                        <div className="space-y-2">
                            {(draft.settings.steps || []).map((step, index) => (
                                <div key={step.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="h-4 w-4 text-slate-300" />
                                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-500">{index + 1}</span>
                                        <input
                                            value={step.title}
                                            onChange={(event) => updateNestedSettings('steps', (draft.settings.steps || []).map((candidate) => candidate.id === step.id ? { ...candidate, title: event.target.value } : candidate))}
                                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </InspectorSection>

            <InspectorSection
                id="display"
                title="Display: Quote"
                isCollapsed={sectionState.isCollapsed('display')}
                onToggle={() => sectionState.toggle('display')}
            >
                <div className="space-y-4">
                    <SelectField
                        label="Price display"
                        value={draft.settings.display.priceDisplayMode}
                        onChange={(priceDisplayMode) => updateNestedSettings('display', { ...draft.settings.display, priceDisplayMode: priceDisplayMode as EstimateQuoteSettings['display']['priceDisplayMode'] })}
                        options={[
                            { value: 'exact', label: 'Exact price' },
                            { value: 'range', label: 'Price range' },
                            { value: 'starting-at', label: 'Starting at' },
                            { value: 'hidden', label: 'Request quote only' },
                        ]}
                    />
                    <InspectorToggle
                        label="Show estimate before submit"
                        checked={draft.settings.display.showEstimateBeforeSubmit}
                        onChange={() => updateNestedSettings('display', { ...draft.settings.display, showEstimateBeforeSubmit: !draft.settings.display.showEstimateBeforeSubmit })}
                    />
                    <InspectorToggle
                        label="Show estimate after submit"
                        checked={draft.settings.display.showEstimateAfterSubmit}
                        onChange={() => updateNestedSettings('display', { ...draft.settings.display, showEstimateAfterSubmit: !draft.settings.display.showEstimateAfterSubmit })}
                    />
                    <InspectorToggle
                        label="Show line items"
                        checked={draft.settings.display.showLineItems}
                        onChange={() => updateNestedSettings('display', { ...draft.settings.display, showLineItems: !draft.settings.display.showLineItems })}
                    />
                    <TextareaField
                        label="Disclaimer"
                        value={draft.settings.display.disclaimer || ''}
                        onChange={(disclaimer) => updateNestedSettings('display', { ...draft.settings.display, disclaimer })}
                    />
                    <TextField
                        label="Quote expiration text"
                        value={draft.settings.display.quoteExpirationText || ''}
                        placeholder="Valid for 30 days"
                        onChange={(quoteExpirationText) => updateNestedSettings('display', { ...draft.settings.display, quoteExpirationText })}
                    />
                </div>
            </InspectorSection>

            {mode === 'advanced' && (
                <InspectorSection
                    id="advanced-pricing"
                    title="Content: Advanced Pricing"
                    isCollapsed={sectionState.isCollapsed('advanced-pricing')}
                    onToggle={() => sectionState.toggle('advanced-pricing')}
                >
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <MoneyField
                                label="Minimum price"
                                valueCents={draft.settings.basePricing.minimumPriceCents}
                                onChange={(minimumPriceCents) => updateNestedSettings('basePricing', { ...draft.settings.basePricing, minimumPriceCents })}
                            />
                            <MoneyField
                                label="Maximum price"
                                valueCents={draft.settings.basePricing.maximumPriceCents}
                                onChange={(maximumPriceCents) => updateNestedSettings('basePricing', { ...draft.settings.basePricing, maximumPriceCents })}
                            />
                        </div>
                        {draft.settings.pricingRules.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                                <Calculator className="mx-auto h-6 w-6 text-slate-300" />
                                <p className="mt-2 text-sm font-bold text-slate-700">No advanced rules yet</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{'Add a plain-language rule such as "When Service Type is Premium, add $250."'}</p>
                            </div>
                        ) : (
                            draft.settings.pricingRules.map((rule, index) => (
                                <RuleEditor
                                    key={rule.id}
                                    rule={rule}
                                    index={index}
                                    fields={draft.settings.fields}
                                    onUpdate={(updates) => updateRule(rule.id, updates)}
                                    onDelete={() => updateSettings({ pricingRules: draft.settings.pricingRules.filter((candidate) => candidate.id !== rule.id) })}
                                    onMove={(direction) => moveRule(rule.id, direction)}
                                />
                            ))
                        )}
                        <button
                            type="button"
                            onClick={addRule}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 px-3 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50"
                        >
                            <Plus className="h-4 w-4" />
                            Add Pricing Rule
                        </button>
                    </div>
                </InspectorSection>
            )}

            <InspectorSection
                id="integrations"
                title="Integrations: Deposits, CRM, Tracking"
                isCollapsed={sectionState.isCollapsed('integrations')}
                onToggle={() => sectionState.toggle('integrations')}
            >
                <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                                <p className="font-bold">Quote checkout is not connected yet</p>
                                <p className="mt-1 text-xs leading-5">Deposit settings can be saved for quote math, but payment collection stays disabled until a quote checkout route exists.</p>
                            </div>
                        </div>
                    </div>
                    <InspectorToggle
                        label="Enable deposit calculation"
                        checked={draft.settings.deposit?.enabled === true}
                        onChange={() => updateNestedSettings('deposit', { ...(draft.settings.deposit || { type: 'percentage', paymentTiming: 'after-approval' }), enabled: !(draft.settings.deposit?.enabled === true) })}
                    />
                    {draft.settings.deposit?.enabled && (
                        <div className="grid grid-cols-2 gap-2">
                            <SelectField
                                label="Deposit type"
                                value={draft.settings.deposit.type}
                                onChange={(type) => updateNestedSettings('deposit', { ...draft.settings.deposit!, type: type as 'fixed' | 'percentage' })}
                                options={[
                                    { value: 'fixed', label: 'Fixed amount' },
                                    { value: 'percentage', label: 'Percentage' },
                                ]}
                            />
                            {draft.settings.deposit.type === 'fixed' ? (
                                <MoneyField
                                    label="Deposit"
                                    valueCents={draft.settings.deposit.amountCents}
                                    onChange={(amountCents) => updateNestedSettings('deposit', { ...draft.settings.deposit!, amountCents })}
                                />
                            ) : (
                                <NumberField
                                    label="Deposit %"
                                    value={draft.settings.deposit.percentage || 0}
                                    onChange={(percentage) => updateNestedSettings('deposit', { ...draft.settings.deposit!, percentage })}
                                />
                            )}
                        </div>
                    )}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        CRM tag controls are disabled because this codebase does not currently include a reusable CRM tagging system.
                    </div>
                    <InspectorToggle
                        label="Capture UTM data"
                        checked={draft.settings.tracking.captureUtm}
                        onChange={() => updateNestedSettings('tracking', { ...draft.settings.tracking, captureUtm: !draft.settings.tracking.captureUtm })}
                    />
                    <InspectorToggle
                        label="Capture referrer"
                        checked={draft.settings.tracking.captureReferrer}
                        onChange={() => updateNestedSettings('tracking', { ...draft.settings.tracking, captureReferrer: !draft.settings.tracking.captureReferrer })}
                    />
                </div>
            </InspectorSection>

            <InspectorSection
                id="preview"
                title="Display: Live Quote Preview"
                isCollapsed={sectionState.isCollapsed('preview')}
                onToggle={() => sectionState.toggle('preview')}
            >
                <div className="space-y-4">
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {draft.settings.fields.slice(0, 8).map((field) => (
                            <PreviewInput
                                key={field.id}
                                field={field}
                                value={testValues[field.id] ?? ''}
                                onChange={(value) => setTestValues((current) => ({ ...current, [field.id]: value }))}
                            />
                        ))}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estimated total</p>
                        <p className="mt-1 text-2xl font-black text-slate-950">{getQuoteDisplayText(previewResult)}</p>
                        <div className="mt-4 space-y-1 text-xs text-slate-600">
                            {previewResult.formulaLines.map((line) => <p key={line}>{line}</p>)}
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Rule status</p>
                        <div className="mt-2 space-y-1 text-xs">
                            {draft.settings.pricingRules.length === 0 && <p className="text-slate-500">No rules yet.</p>}
                            {draft.settings.pricingRules.map((rule) => {
                                const triggered = previewResult.triggeredRuleIds.includes(rule.id);
                                return (
                                    <p key={rule.id} className={triggered ? 'font-bold text-emerald-700' : 'text-slate-500'}>
                                        {triggered ? 'Triggered' : 'Not triggered'}: {rule.name}
                                    </p>
                                );
                            })}
                        </div>
                    </div>
                    {warnings.length > 0 && (
                        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                            {warnings.map((warning) => <p key={warning}>{warning}</p>)}
                        </div>
                    )}
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
                    onChange={(sectionSettings) => setDraft((current) => ({ ...current, sectionSettings }))}
                />
            </InspectorSection>

            <InspectorSection
                id="style"
                title="Style: Form"
                isCollapsed={sectionState.isCollapsed('style')}
                onToggle={() => sectionState.toggle('style')}
            >
                <CardSettingsControls
                    value={draft.cardSettings || buildCardSettingsForPreset(draft.cardStyle)}
                    currentPresetId={draft.cardStyle}
                    palette={palette}
                    supportsTextAlign={false}
                    onChange={updateCardSettings}
                />
            </InspectorSection>

            <InspectorSection
                id="advanced"
                title="Advanced"
                isCollapsed={sectionState.isCollapsed('advanced')}
                onToggle={() => sectionState.toggle('advanced')}
            >
                {isProUser ? (
                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-estimate-css`}>
                                Custom CSS
                            </label>
                            <textarea
                                id={`${blockId}-estimate-css`}
                                value={draft.__customCss}
                                onChange={(event) => setDraft((current) => ({ ...current, __customCss: event.target.value }))}
                                className="mt-2 min-h-40 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-green-400 outline-none selection:bg-green-900 focus:ring-2 focus:ring-blue-500"
                                spellCheck={false}
                            />
                        </div>
                        <div className="border-t border-slate-200 pt-4">
                            <KeyframeEditor
                                blockId={blockId}
                                blockType="estimateForm"
                                value={draft.__customScript}
                                onChange={(value) => setDraft((current) => ({ ...current, __customScript: value }))}
                                isProUser={isProUser}
                                fieldNames={inferFieldNames(blockData)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                        Custom CSS &amp; Keyframe scripting are Pro features.
                    </div>
                )}
            </InspectorSection>
        </BlockSettingsPanel>
    );
}

function FieldEditor({
    field,
    index,
    steps,
    onUpdate,
    onDelete,
    onMove,
}: {
    field: EstimateField;
    index: number;
    steps: NonNullable<EstimateQuoteSettings['steps']>;
    onUpdate: (updates: Partial<EstimateField>) => void;
    onDelete: () => void;
    onMove: (direction: -1 | 1) => void;
}) {
    const [expanded, setExpanded] = useState(index < 2);
    const hasOptions = ['select', 'radio', 'checkbox', 'service-option', 'addon'].includes(field.type);
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-slate-300" />
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-500">{index + 1}</span>
                <input
                    value={field.label}
                    onChange={(event) => onUpdate({ label: event.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-sm font-bold outline-none hover:border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <button type="button" onClick={() => setExpanded((value) => !value)} className="rounded-md border border-slate-200 p-1.5 text-slate-500">
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                <button type="button" onClick={onDelete} className="rounded-md border border-slate-200 p-1.5 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
            {expanded && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <div className="grid grid-cols-2 gap-2">
                        <SelectField
                            label="Field type"
                            value={field.type}
                            onChange={(type) => onUpdate({ type: type as EstimateFieldType })}
                            options={FIELD_TYPE_OPTIONS}
                        />
                        <SelectField
                            label="Step"
                            value={field.stepId || ''}
                            onChange={(stepId) => onUpdate({ stepId })}
                            options={[{ value: '', label: 'Default' }, ...steps.map((step) => ({ value: step.id, label: step.title }))]}
                        />
                    </div>
                    <InspectorToggle label="Required" checked={field.required} onChange={() => onUpdate({ required: !field.required })} />
                    <TextField label="Placeholder" value={field.placeholder || ''} onChange={(placeholder) => onUpdate({ placeholder })} />
                    {hasOptions && (
                        <TextareaField
                            label="Options"
                            value={(field.options || []).map((option) => option.priceCents ? `${option.label} | ${formatQuoteMoney(option.priceCents, 'USD')}` : option.label).join('\n')}
                            placeholder={'Standard\nPremium | 250\nInstallation | 150'}
                            onChange={(value) => onUpdate({ options: parseOptions(value, field.id) })}
                        />
                    )}
                    {(field.type === 'number' || field.type === 'quantity') && (
                        <div className="grid grid-cols-3 gap-2">
                            <NumberField label="Min" value={field.validation?.min || 0} onChange={(min) => onUpdate({ validation: { ...field.validation, min } })} />
                            <NumberField label="Max" value={field.validation?.max || 0} onChange={(max) => onUpdate({ validation: { ...field.validation, max } })} />
                            <TextField label="Unit" value={field.unit || ''} onChange={(unit) => onUpdate({ unit })} />
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button type="button" onClick={() => onMove(-1)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Move up</button>
                        <button type="button" onClick={() => onMove(1)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Move down</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function RuleEditor({
    rule,
    index,
    fields,
    onUpdate,
    onDelete,
    onMove,
}: {
    rule: PricingRule;
    index: number;
    fields: EstimateField[];
    onUpdate: (updates: Partial<PricingRule>) => void;
    onDelete: () => void;
    onMove: (direction: -1 | 1) => void;
}) {
    const condition = rule.conditions[0] || { fieldId: fields[0]?.id || '', operator: 'equals' as const, value: '' };
    const action = rule.actions[0] || { type: 'add-fixed' as const, amountCents: 0, label: '' };
    const updateCondition = (updates: Partial<PricingCondition>) => {
        onUpdate({ conditions: [{ ...condition, ...updates }] });
    };
    const updateAction = (updates: Partial<PricingAction>) => {
        onUpdate({ actions: [{ ...action, ...updates }] });
    };
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-slate-300" />
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-500">{index + 1}</span>
                <input value={rule.name} onChange={(event) => onUpdate({ name: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => onUpdate({ enabled: !rule.enabled })} className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${rule.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {rule.enabled ? 'On' : 'Off'}
                </button>
                <button type="button" onClick={onDelete} className="rounded-md border border-slate-200 p-1.5 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                When <strong>{fields.find((field) => field.id === condition.fieldId)?.label || 'field'}</strong> {CONDITION_OPTIONS.find((option) => option.value === condition.operator)?.label || condition.operator}
                {condition.operator !== 'checked' && condition.operator !== 'not-checked' && condition.operator !== 'empty' && condition.operator !== 'not-empty' ? <> <strong>{String(condition.value || 'value')}</strong></> : null},
                then <strong>{ACTION_OPTIONS.find((option) => option.value === action.type)?.label || action.type}</strong>.
            </div>
            <div className="mt-3 grid gap-2">
                <SelectField label="Field" value={condition.fieldId} onChange={(fieldId) => updateCondition({ fieldId })} options={fields.map((field) => ({ value: field.id, label: field.label }))} />
                <SelectField label="Condition" value={condition.operator} onChange={(operator) => updateCondition({ operator: operator as PricingConditionOperator })} options={CONDITION_OPTIONS} />
                {!['checked', 'not-checked', 'empty', 'not-empty'].includes(condition.operator) && (
                    <TextField label="Value" value={String(condition.value ?? '')} onChange={(value) => updateCondition({ value })} />
                )}
                {condition.operator === 'between' && (
                    <TextField label="To" value={String(condition.valueTo ?? '')} onChange={(valueTo) => updateCondition({ valueTo })} />
                )}
                <SelectField label="Action" value={action.type} onChange={(type) => updateAction({ type: type as PricingActionType })} options={ACTION_OPTIONS} />
                {['add-fixed', 'subtract-fixed', 'set-base-price', 'set-line-item', 'add-per-unit', 'set-deposit', 'apply-discount', 'apply-fee'].includes(action.type) && (
                    <MoneyField label="Amount" valueCents={action.amountCents} onChange={(amountCents) => updateAction({ amountCents })} />
                )}
                {['add-percentage', 'subtract-percentage'].includes(action.type) && (
                    <NumberField label="Percent" value={action.percentage || 0} onChange={(percentage) => updateAction({ percentage })} />
                )}
                {action.type === 'multiply' && (
                    <NumberField label="Multiplier" value={action.multiplier || 1} onChange={(multiplier) => updateAction({ multiplier })} />
                )}
                {['add-per-unit', 'add-option-price'].includes(action.type) && (
                    <SelectField label="Action field" value={action.fieldId || condition.fieldId} onChange={(fieldId) => updateAction({ fieldId })} options={fields.map((field) => ({ value: field.id, label: field.label }))} />
                )}
                <TextField label="Line item label" value={action.label || ''} onChange={(label) => updateAction({ label })} />
                <div className="flex gap-2">
                    <button type="button" onClick={() => onMove(-1)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Move up</button>
                    <button type="button" onClick={() => onMove(1)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Move down</button>
                </div>
            </div>
        </div>
    );
}

function PreviewInput({ field, value, onChange }: { field: EstimateField; value: unknown; onChange: (value: unknown) => void }) {
    if (field.options?.length && (field.type === 'select' || field.type === 'service-option' || field.type === 'radio')) {
        return (
            <SelectField
                label={field.label}
                value={String(value ?? '')}
                onChange={onChange}
                options={[{ value: '', label: 'Select...' }, ...field.options.map((option) => ({ value: option.value, label: option.label }))]}
            />
        );
    }
    if (field.options?.length && (field.type === 'checkbox' || field.type === 'addon')) {
        return (
            <SelectField
                label={field.label}
                value={Array.isArray(value) ? String(value[0] || '') : String(value || '')}
                onChange={(next) => onChange(next ? [next] : [])}
                options={[{ value: '', label: 'None' }, ...field.options.map((option) => ({ value: option.value, label: option.label }))]}
            />
        );
    }
    if (field.type === 'number' || field.type === 'quantity') {
        return <NumberField label={field.label} value={Number(value || 0)} onChange={onChange} />;
    }
    if (field.type === 'checkbox') {
        return <InspectorToggle label={field.label} checked={Boolean(value)} onChange={() => onChange(!value)} />;
    }
    return <TextField label={field.label} value={String(value ?? '')} onChange={onChange} />;
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
            {active && <Check className="mr-1 inline h-3.5 w-3.5" />}
            {label}
        </button>
    );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
    );
}

function TextareaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
    );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <input type="number" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value) || 0)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
    );
}

function MoneyField({ label, valueCents, onChange }: { label: string; valueCents?: number; onChange: (value: number | undefined) => void }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <input
                type="number"
                step="0.01"
                value={valueCents === undefined ? '' : valueCents / 100}
                onChange={(event) => onChange(event.target.value === '' ? undefined : dollarsToCents(event.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
            <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </div>
    );
}

function buildInitialDraft(blockData: Record<string, unknown>, customCss: string): EstimateQuoteDraft {
    const cardSettings = readCardSettings(blockData.cardSettings);
    const cardStyle = typeof blockData.cardStyle === 'string' && blockData.cardStyle.trim()
        ? blockData.cardStyle
        : cardSettings?.presetId && cardSettings.presetId !== 'custom'
            ? cardSettings.presetId
            : 'soft';

    return {
        settings: normalizeEstimateQuoteSettings(blockData),
        sectionSettings: normalizeSectionSettings(blockData.sectionSettings),
        cardStyle,
        cardSettings,
        __customCss: customCss,
        __customScript: typeof blockData.__customScript === 'string' ? blockData.__customScript : '',
    };
}

function buildPreviewBlockData(blockData: Record<string, unknown>, draft: EstimateQuoteDraft): Record<string, unknown> {
    return {
        ...blockData,
        ...legacyMirror(draft.settings),
        estimateQuoteSettings: draft.settings,
        sectionSettings: draft.sectionSettings,
        cardStyle: draft.cardStyle,
        cardSettings: draft.cardSettings || buildCardSettingsForPreset(draft.cardStyle),
        __customCss: draft.__customCss,
        __customScript: draft.__customScript,
    };
}

function buildSaveUpdates(blockData: Record<string, unknown>, draft: EstimateQuoteDraft): Record<string, unknown> {
    const updates: Record<string, unknown> = {
        ...legacyMirror(draft.settings),
        estimateQuoteSettings: draft.settings,
        __customCss: draft.__customCss,
        __customScript: draft.__customScript,
    };
    const hasExistingCardSettings = Boolean(blockData.cardSettings && typeof blockData.cardSettings === 'object' && !Array.isArray(blockData.cardSettings));
    const persistedCardStyle = typeof blockData.cardStyle === 'string' && blockData.cardStyle.trim() ? blockData.cardStyle : 'soft';
    if (draft.cardSettings || hasExistingCardSettings || draft.cardStyle !== persistedCardStyle) {
        updates.cardStyle = draft.cardStyle;
        updates.cardSettings = draft.cardSettings || buildCardSettingsForPreset(draft.cardStyle);
    }
    const initialSectionSettings = normalizeSectionSettings(blockData.sectionSettings);
    if (!areSectionSettingsEqual(draft.sectionSettings, initialSectionSettings)) {
        updates.sectionSettings = normalizeSectionSettings(draft.sectionSettings);
    }
    return updates;
}

function legacyMirror(settings: EstimateQuoteSettings): Record<string, unknown> {
    return {
        title: settings.title,
        description: settings.description,
        submitText: settings.submitButtonLabel,
        successMessage: settings.success.message,
        variant: settings.quoteMode === 'request-only' ? 'simple' : 'calculator',
        pricingEnabled: settings.quoteMode !== 'request-only',
        pricingBasePrice: settings.basePricing.basePriceCents,
        pricingCurrency: settings.currency,
        pricingDisclaimer: settings.display.disclaimer,
        fields: settings.fields,
        showName: settings.fields.some((field) => field.contactRole === 'name'),
        showEmail: settings.fields.some((field) => field.contactRole === 'email'),
        showPhone: settings.fields.some((field) => field.contactRole === 'phone'),
        showAddress: settings.fields.some((field) => field.contactRole === 'address'),
        showPreferredDate: settings.fields.some((field) => field.contactRole === 'preferredDate'),
        showMessage: settings.fields.some((field) => field.contactRole === 'message'),
    };
}

function createField(type: EstimateFieldType, index: number): EstimateField {
    const id = createId('field');
    const labelByType: Record<string, string> = {
        text: 'Short answer',
        textarea: 'Project details',
        email: 'Email',
        phone: 'Phone',
        number: 'Number',
        select: 'Dropdown',
        radio: 'Choice',
        checkbox: 'Checkbox',
        date: 'Date',
        file: 'File upload',
        quantity: 'Quantity',
        'service-option': 'Service option',
        addon: 'Add-ons',
    };
    const optionTypes = new Set(['select', 'radio', 'checkbox', 'service-option', 'addon']);
    return {
        id,
        type,
        label: labelByType[type] || `Field ${index + 1}`,
        required: false,
        stepId: index < 3 ? 'details' : 'options',
        options: optionTypes.has(type)
            ? [
                { id: `${id}-option-1`, label: 'Option 1', value: 'option-1' },
                { id: `${id}-option-2`, label: 'Option 2', value: 'option-2' },
            ]
            : undefined,
        contactRole: type === 'email' ? 'email' : type === 'phone' ? 'phone' : undefined,
    };
}

function parseOptions(value: string, fieldId: string) {
    return value.split('\n').map((line, index) => {
        const [labelPart, pricePart] = line.split('|').map((part) => part.trim());
        const label = labelPart || `Option ${index + 1}`;
        return {
            id: `${fieldId}-option-${index + 1}`,
            label,
            value: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `option-${index + 1}`,
            priceCents: pricePart ? dollarsToCents(pricePart) : undefined,
            priceType: 'fixed' as const,
        };
    }).filter((option) => option.label);
}

function applyStarterTemplate(settings: EstimateQuoteSettings, templateId: string): Partial<EstimateQuoteSettings> {
    const base = { ...settings, quoteMode: settings.quoteMode === 'request-only' ? 'hybrid' as const : settings.quoteMode };
    if (templateId === 'home-service') {
        return {
            ...base,
            title: 'Request a Home Service Estimate',
            fields: [
                ...settings.fields.filter((field) => field.contactRole),
                { id: createId('field'), type: 'text', label: 'Project address', required: true, stepId: 'details', contactRole: 'address' },
                { id: createId('field'), type: 'number', label: 'Approximate area', required: false, unit: 'sq ft', stepId: 'details' },
                { id: createId('field'), type: 'checkbox', label: 'Rush job', required: false, stepId: 'options' },
            ],
        };
    }
    if (templateId === 'event') {
        return {
            ...base,
            title: 'Request an Event Quote',
            fields: [
                ...settings.fields.filter((field) => field.contactRole),
                { id: createId('field'), type: 'date', label: 'Event date', required: true, stepId: 'details' },
                { id: createId('field'), type: 'number', label: 'Guest count', required: true, stepId: 'details' },
                { id: createId('field'), type: 'service-option', label: 'Service level', required: true, stepId: 'options', options: parseOptions('Standard\nPremium | 500', createId('event-service')) },
            ],
        };
    }
    if (templateId === 'addons') {
        return {
            ...base,
            title: 'Build Your Estimate',
            fields: [
                ...settings.fields.filter((field) => field.contactRole),
                { id: createId('field'), type: 'service-option', label: 'Package', required: true, stepId: 'options', options: parseOptions('Starter\nProfessional | 250\nPremium | 500', createId('package')) },
                { id: createId('field'), type: 'addon', label: 'Add-ons', required: false, stepId: 'options', options: parseOptions('Installation | 150\nRush turnaround | 200\nOngoing support | 100', createId('addons')) },
            ],
        };
    }
    return {
        ...base,
        title: templateId === 'appointment' ? 'Request a Service Estimate' : 'Request a Quote',
    };
}

function splitList(value: string): string[] {
    return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

function moveById<T extends { id: string }>(items: T[], id: string, direction: -1 | 1): T[] {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return items;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return items;
    const next = [...items];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    return next;
}

function createId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
