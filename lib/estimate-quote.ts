export type QuoteMode = 'instant' | 'request-only' | 'hybrid';
export type LayoutMode = 'single-page' | 'multi-step';
export type PresentationMode = 'standard' | 'hero';
export type HeroFormSide = 'left' | 'right';
export type HeroBackgroundType = 'color' | 'image';
export type PriceDisplayMode = 'exact' | 'range' | 'starting-at' | 'hidden';

export interface HeroPresentationConfig {
  formSide: HeroFormSide;
  background: {
    type: HeroBackgroundType;
    color: string;
    imageUrl?: string;
    imageSettings?: unknown;
    imageAttribution?: unknown;
    overlayColor: string;
    overlayOpacity: number;
  };
  textColor?: string;
  eyebrow?: string;
}
export type EstimateFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'file'
  | 'quantity'
  | 'service-option'
  | 'addon';

export type PricingConditionOperator =
  | 'equals'
  | 'not-equals'
  | 'contains'
  | 'not-contains'
  | 'checked'
  | 'not-checked'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'empty'
  | 'not-empty';

export type PricingActionType =
  | 'add-fixed'
  | 'subtract-fixed'
  | 'multiply'
  | 'add-percentage'
  | 'subtract-percentage'
  | 'set-base-price'
  | 'set-line-item'
  | 'add-per-unit'
  | 'add-option-price'
  | 'set-deposit'
  | 'apply-discount'
  | 'apply-fee';

export interface EstimateFieldOption {
  id: string;
  label: string;
  value: string;
  priceCents?: number;
  priceType?: 'fixed' | 'per-unit' | 'percentage';
}

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface FieldPricingConfig {
  enabled: boolean;
  priceCents?: number;
  priceType?: 'fixed' | 'per-unit' | 'percentage';
  label?: string;
}

export interface EstimateField {
  id: string;
  type: EstimateFieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  options?: EstimateFieldOption[];
  defaultValue?: unknown;
  validation?: FieldValidation;
  pricing?: FieldPricingConfig;
  stepId?: string;
  unit?: string;
  contactRole?: 'name' | 'email' | 'phone' | 'company' | 'address' | 'preferredDate' | 'message';
}

export interface EstimateStep {
  id: string;
  title: string;
  description?: string;
  order: number;
}

export interface PricingCondition {
  fieldId: string;
  operator: PricingConditionOperator;
  value?: unknown;
  valueTo?: unknown;
}

export interface PricingAction {
  type: PricingActionType;
  amountCents?: number;
  percentage?: number;
  multiplier?: number;
  fieldId?: string;
  label?: string;
}

export interface PricingRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: PricingCondition[];
  conditionMode: 'all' | 'any';
  actions: PricingAction[];
}

export interface ConditionalTagRule {
  id: string;
  tag: string;
  conditions: PricingCondition[];
  conditionMode: 'all' | 'any';
}

export interface EstimateQuoteSettings {
  title: string;
  description?: string;
  currency: string;
  quoteMode: QuoteMode;
  layoutMode: LayoutMode;
  presentation: PresentationMode;
  hero?: HeroPresentationConfig;
  display: {
    showEstimateBeforeSubmit: boolean;
    showEstimateAfterSubmit: boolean;
    priceDisplayMode: PriceDisplayMode;
    showLineItems: boolean;
    showDeposit: boolean;
    disclaimer?: string;
    quoteExpirationText?: string;
    rangeSpread?: number;
  };
  basePricing: {
    enabled: boolean;
    basePriceCents: number;
    minimumPriceCents?: number;
    maximumPriceCents?: number;
  };
  fields: EstimateField[];
  steps?: EstimateStep[];
  pricingRules: PricingRule[];
  deposit?: {
    enabled: boolean;
    type: 'fixed' | 'percentage';
    amountCents?: number;
    percentage?: number;
    minimumAmountCents?: number;
    paymentTiming: 'on-submit' | 'after-approval';
  };
  notifications: {
    businessRecipients: string[];
    sendCustomerEmail: boolean;
    customerEmailSubject?: string;
    businessEmailSubject?: string;
  };
  crm?: {
    enabled: boolean;
    defaultTags: string[];
    conditionalTags: ConditionalTagRule[];
  };
  tracking: {
    captureUtm: boolean;
    captureReferrer: boolean;
    captureLandingPage: boolean;
  };
  success: {
    message: string;
    redirectUrl?: string;
  };
  submitButtonLabel: string;
}

export interface QuoteLineItem {
  id: string;
  label: string;
  amountCents: number;
  type: 'base' | 'field' | 'rule' | 'discount' | 'fee' | 'tax' | 'deposit';
  sourceId?: string;
}

export interface QuoteCalculationResult {
  currency: string;
  subtotalCents: number;
  discountCents: number;
  feeCents: number;
  taxCents: number;
  depositCents: number;
  totalCents: number;
  displayMode: PriceDisplayMode;
  lineItems: QuoteLineItem[];
  triggeredRuleIds: string[];
  inactiveRuleIds: string[];
  warnings: string[];
  formulaLines: string[];
  rangeLowCents?: number;
  rangeHighCents?: number;
}

export const ESTIMATE_QUOTE_TEMPLATES = [
  {
    id: 'general-service',
    label: 'General service quote',
    description: 'Contact info, project details, service type, and add-ons.',
  },
  {
    id: 'home-service',
    label: 'Home service estimate',
    description: 'Address, project size, rush work, and optional deposit.',
  },
  {
    id: 'event',
    label: 'Event quote',
    description: 'Event date, guest count, service level, and add-ons.',
  },
  {
    id: 'appointment',
    label: 'Appointment/service estimate',
    description: 'Preferred date, service option, quantity, and notes.',
  },
  {
    id: 'addons',
    label: 'Product/service add-ons',
    description: 'Base price with selectable upgrades and add-ons.',
  },
] as const;

export const DEFAULT_ESTIMATE_STEPS: EstimateStep[] = [
  { id: 'contact', title: 'Contact Info', description: 'How should the business reach you?', order: 1 },
  { id: 'details', title: 'Project Details', description: 'Tell us what you need.', order: 2 },
  { id: 'options', title: 'Options & Add-ons', description: 'Choose service options.', order: 3 },
  { id: 'review', title: 'Review Estimate', description: 'Review the estimate before submitting.', order: 4 },
  { id: 'submit', title: 'Submit Request', description: 'Send the quote request.', order: 5 },
];

export const DEFAULT_ESTIMATE_FIELDS: EstimateField[] = [
  {
    id: 'contact-name',
    type: 'text',
    label: 'Name',
    required: true,
    placeholder: 'Jane Smith',
    stepId: 'contact',
    contactRole: 'name',
  },
  {
    id: 'contact-email',
    type: 'email',
    label: 'Email',
    required: true,
    placeholder: 'jane@example.com',
    stepId: 'contact',
    contactRole: 'email',
  },
  {
    id: 'contact-phone',
    type: 'phone',
    label: 'Phone',
    required: false,
    placeholder: '(555) 123-4567',
    stepId: 'contact',
    contactRole: 'phone',
  },
  {
    id: 'project-details',
    type: 'textarea',
    label: 'Project details',
    required: true,
    placeholder: 'Tell us what you need help with.',
    stepId: 'details',
    contactRole: 'message',
  },
  {
    id: 'service-type',
    type: 'service-option',
    label: 'Service type',
    required: true,
    stepId: 'options',
    options: [
      { id: 'service-standard', label: 'Standard', value: 'standard', priceCents: 0, priceType: 'fixed' },
      { id: 'service-premium', label: 'Premium', value: 'premium', priceCents: 25000, priceType: 'fixed' },
    ],
  },
  {
    id: 'quantity',
    type: 'quantity',
    label: 'Quantity',
    required: false,
    stepId: 'options',
    validation: { min: 1 },
    pricing: { enabled: false, priceType: 'per-unit', priceCents: 0 },
  },
];

export const DEFAULT_ESTIMATE_QUOTE_SETTINGS: EstimateQuoteSettings = {
  title: 'Request a Quote',
  description: 'Tell us a little about your project and we will follow up with next steps.',
  currency: 'CAD',
  quoteMode: 'hybrid',
  layoutMode: 'single-page',
  presentation: 'standard',
  hero: {
    formSide: 'right',
    background: {
      type: 'color',
      color: '#0f172a',
      overlayColor: '#000000',
      overlayOpacity: 0.4,
    },
    textColor: '#ffffff',
    eyebrow: '',
  },
  display: {
    showEstimateBeforeSubmit: true,
    showEstimateAfterSubmit: true,
    priceDisplayMode: 'range',
    showLineItems: true,
    showDeposit: false,
    disclaimer: 'This is an estimate only. Final pricing may vary.',
    quoteExpirationText: '',
    rangeSpread: 0.15,
  },
  basePricing: {
    enabled: true,
    basePriceCents: 0,
  },
  fields: DEFAULT_ESTIMATE_FIELDS,
  steps: DEFAULT_ESTIMATE_STEPS,
  pricingRules: [],
  deposit: {
    enabled: false,
    type: 'percentage',
    percentage: 25,
    paymentTiming: 'after-approval',
  },
  notifications: {
    businessRecipients: [],
    sendCustomerEmail: false,
    customerEmailSubject: 'We received your quote request',
    businessEmailSubject: 'New quote request',
  },
  crm: {
    enabled: false,
    defaultTags: ['Quote submitted'],
    conditionalTags: [],
  },
  tracking: {
    captureUtm: true,
    captureReferrer: true,
    captureLandingPage: true,
  },
  success: {
    message: "Thank you! We will review your request and get back to you shortly.",
  },
  submitButtonLabel: 'Request quote',
};

export function dollarsToCents(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric * 100));
}

export function normalizeEstimateQuoteSettings(blockData: Record<string, unknown> | null | undefined): EstimateQuoteSettings {
  const data = blockData || {};
  const raw = isRecord(data.estimateQuoteSettings) ? data.estimateQuoteSettings : null;
  if (!raw) return migrateLegacyEstimateSettings(data);

  const fallback = migrateLegacyEstimateSettings(data);
  const merged = deepMerge<EstimateQuoteSettings>(
    DEFAULT_ESTIMATE_QUOTE_SETTINGS,
    fallback,
    raw as Partial<EstimateQuoteSettings> as EstimateQuoteSettings,
  );
  const fields = normalizeFields(merged.fields);
  const steps = normalizeSteps(merged.steps, merged.layoutMode === 'multi-step');
  const rules = normalizePricingRules(merged.pricingRules, fields);

  return {
    ...merged,
    title: readString(merged.title, DEFAULT_ESTIMATE_QUOTE_SETTINGS.title),
    description: readString(merged.description, ''),
    currency: readString(merged.currency, fallback.currency || 'CAD').toUpperCase(),
    quoteMode: readChoice<QuoteMode>(merged.quoteMode, ['instant', 'request-only', 'hybrid'], fallback.quoteMode),
    layoutMode: readChoice<LayoutMode>(merged.layoutMode, ['single-page', 'multi-step'], 'single-page'),
    presentation: readChoice<PresentationMode>(merged.presentation, ['standard', 'hero'], 'standard'),
    hero: normalizeHero(merged.hero),
    display: {
      ...DEFAULT_ESTIMATE_QUOTE_SETTINGS.display,
      ...(isRecord(merged.display) ? merged.display : {}),
      priceDisplayMode: readChoice<PriceDisplayMode>(
        isRecord(merged.display) ? merged.display.priceDisplayMode : undefined,
        ['exact', 'range', 'starting-at', 'hidden'],
        fallback.display.priceDisplayMode,
      ),
      rangeSpread: readOptionalNumber(isRecord(merged.display) ? merged.display.rangeSpread : fallback.display.rangeSpread),
    },
    basePricing: {
      enabled: Boolean(isRecord(merged.basePricing) ? merged.basePricing.enabled : fallback.basePricing.enabled),
      basePriceCents: readCents(isRecord(merged.basePricing) ? merged.basePricing.basePriceCents : 0),
      minimumPriceCents: readOptionalCents(isRecord(merged.basePricing) ? merged.basePricing.minimumPriceCents : undefined),
      maximumPriceCents: readOptionalCents(isRecord(merged.basePricing) ? merged.basePricing.maximumPriceCents : undefined),
    },
    fields,
    steps,
    pricingRules: rules,
    deposit: normalizeDeposit(merged.deposit),
    notifications: {
      businessRecipients: normalizeEmailList(isRecord(merged.notifications) ? merged.notifications.businessRecipients : []),
      sendCustomerEmail: Boolean(isRecord(merged.notifications) ? merged.notifications.sendCustomerEmail : false),
      customerEmailSubject: readString(isRecord(merged.notifications) ? merged.notifications.customerEmailSubject : '', 'We received your quote request'),
      businessEmailSubject: readString(isRecord(merged.notifications) ? merged.notifications.businessEmailSubject : '', 'New quote request'),
    },
    crm: normalizeCrm(merged.crm),
    tracking: {
      captureUtm: isRecord(merged.tracking) ? merged.tracking.captureUtm !== false : true,
      captureReferrer: isRecord(merged.tracking) ? merged.tracking.captureReferrer !== false : true,
      captureLandingPage: isRecord(merged.tracking) ? merged.tracking.captureLandingPage !== false : true,
    },
    success: {
      message: readString(isRecord(merged.success) ? merged.success.message : '', fallback.success.message),
      redirectUrl: readString(isRecord(merged.success) ? merged.success.redirectUrl : '', ''),
    },
    submitButtonLabel: readString(merged.submitButtonLabel, fallback.submitButtonLabel || 'Request quote'),
  };
}

export function migrateLegacyEstimateSettings(data: Record<string, unknown>): EstimateQuoteSettings {
  const pricingEnabled = data.pricingEnabled === true;
  const variant = readString(data.variant, pricingEnabled ? 'calculator' : 'simple');
  const currency = readString(data.pricingCurrency, 'CAD').toUpperCase();
  const legacyFields = Array.isArray(data.fields) ? data.fields : [];
  const projectFieldPairs = legacyFields
    .map((rawField, index) => ({ rawField, field: normalizeLegacyField(rawField, index) }))
    .filter((pair): pair is { rawField: unknown; field: EstimateField } => Boolean(pair.field));
  const projectFields = projectFieldPairs.map((pair) => pair.field);
  const contactFields: EstimateField[] = [];

  if (data.showName !== false) contactFields.push({ ...DEFAULT_ESTIMATE_FIELDS[0] });
  if (data.showEmail !== false) contactFields.push({ ...DEFAULT_ESTIMATE_FIELDS[1] });
  if (data.showPhone !== false) contactFields.push({ ...DEFAULT_ESTIMATE_FIELDS[2] });
  if (data.showAddress === true) {
    contactFields.push({
      id: 'contact-address',
      type: 'text',
      label: 'Address',
      required: false,
      stepId: 'contact',
      contactRole: 'address',
      placeholder: 'Street address',
    });
  }
  if (data.showPreferredDate === true) {
    contactFields.push({
      id: 'preferred-date',
      type: 'date',
      label: 'Preferred date',
      required: false,
      stepId: 'details',
      contactRole: 'preferredDate',
    });
  }
  if (data.showMessage === true) {
    contactFields.push({
      id: 'contact-message',
      type: 'textarea',
      label: 'Additional notes',
      required: false,
      stepId: 'details',
      contactRole: 'message',
    });
  }

  const fields = [...projectFields, ...contactFields];
  const rules = buildLegacyPricingRules(projectFieldPairs);
  const spread = readNumber(data.pricingRangeSpread, 0.15);

  return {
    ...DEFAULT_ESTIMATE_QUOTE_SETTINGS,
    title: readString(data.title, 'Request a Quote'),
    description: readString(data.description, DEFAULT_ESTIMATE_QUOTE_SETTINGS.description || ''),
    currency,
    quoteMode: variant === 'calculator' && pricingEnabled ? 'instant' : 'request-only',
    layoutMode: 'single-page',
    display: {
      ...DEFAULT_ESTIMATE_QUOTE_SETTINGS.display,
      showEstimateBeforeSubmit: variant === 'calculator' && pricingEnabled,
      showEstimateAfterSubmit: variant === 'calculator' && pricingEnabled,
      priceDisplayMode: variant === 'calculator' && pricingEnabled ? 'range' : 'hidden',
      disclaimer: readString(data.pricingDisclaimer, DEFAULT_ESTIMATE_QUOTE_SETTINGS.display.disclaimer || ''),
      rangeSpread: Number.isFinite(spread) ? spread : 0.15,
    },
    basePricing: {
      enabled: pricingEnabled,
      basePriceCents: readCents(data.pricingBasePrice),
    },
    fields: fields.length > 0 ? fields : DEFAULT_ESTIMATE_FIELDS,
    pricingRules: rules,
    notifications: {
      ...DEFAULT_ESTIMATE_QUOTE_SETTINGS.notifications,
      businessRecipients: normalizeEmailList(data.notificationRecipients),
    },
    success: {
      message: readString(data.successMessage, DEFAULT_ESTIMATE_QUOTE_SETTINGS.success.message),
    },
    submitButtonLabel: readString(data.submitText, 'Request quote'),
  } as EstimateQuoteSettings;
}

export function calculateQuote(settingsInput: EstimateQuoteSettings, rawValues: Record<string, unknown>): QuoteCalculationResult {
  const settings = normalizeEstimateQuoteSettings({ estimateQuoteSettings: settingsInput });
  const warnings = validateEstimateQuoteSettings(settings);
  const lineItems: QuoteLineItem[] = [];
  const triggeredRuleIds: string[] = [];
  const inactiveRuleIds: string[] = [];
  let baseCents = settings.basePricing.enabled ? settings.basePricing.basePriceCents : 0;
  let subtotalCents = baseCents;
  let discountCents = 0;
  let feeCents = 0;
  const taxCents = 0;
  let depositCents = 0;

  if (baseCents > 0) {
    lineItems.push({
      id: 'base',
      label: 'Base price',
      amountCents: baseCents,
      type: 'base',
      sourceId: 'basePricing',
    });
  }

  for (const field of settings.fields) {
    const value = rawValues[field.id] ?? field.defaultValue;
    if (isEmptyValue(value)) continue;

    for (const option of getSelectedOptions(field, value)) {
      if (!option.priceCents || option.priceCents === 0) continue;
      const amount = option.priceType === 'percentage'
        ? Math.round(subtotalCents * (option.priceCents / 10000))
        : option.priceCents;
      subtotalCents += amount;
      lineItems.push({
        id: `field-${field.id}-${option.id}`,
        label: `${field.label}: ${option.label}`,
        amountCents: amount,
        type: 'field',
        sourceId: field.id,
      });
    }

    if (field.pricing?.enabled && field.pricing.priceCents) {
      const amount = field.pricing.priceType === 'per-unit'
        ? Math.round(readNumber(value, 0) * field.pricing.priceCents)
        : field.pricing.priceType === 'percentage'
          ? Math.round(subtotalCents * (field.pricing.priceCents / 10000))
          : field.pricing.priceCents;
      if (amount !== 0) {
        subtotalCents += amount;
        lineItems.push({
          id: `field-pricing-${field.id}`,
          label: field.pricing.label || field.label,
          amountCents: amount,
          type: 'field',
          sourceId: field.id,
        });
      }
    }
  }

  for (const rule of settings.pricingRules) {
    if (!rule.enabled) {
      inactiveRuleIds.push(rule.id);
      continue;
    }
    const triggered = evaluatePricingRule(rule, rawValues);
    if (!triggered) {
      inactiveRuleIds.push(rule.id);
      continue;
    }
    triggeredRuleIds.push(rule.id);

    for (const action of rule.actions) {
      const label = action.label || rule.name || 'Pricing rule';
      const beforeSubtotal = subtotalCents;

      switch (action.type) {
        case 'add-fixed': {
          const amount = readCents(action.amountCents);
          subtotalCents += amount;
          addLine(lineItems, rule.id, label, amount, 'rule');
          break;
        }
        case 'subtract-fixed': {
          const amount = readCents(action.amountCents);
          subtotalCents -= amount;
          discountCents += amount;
          addLine(lineItems, rule.id, label, -amount, 'discount');
          break;
        }
        case 'multiply': {
          const multiplier = Math.max(0, readNumber(action.multiplier, 1));
          subtotalCents = Math.round(subtotalCents * multiplier);
          addLine(lineItems, rule.id, label, subtotalCents - beforeSubtotal, 'rule');
          break;
        }
        case 'add-percentage': {
          const amount = Math.round(subtotalCents * (readNumber(action.percentage, 0) / 100));
          subtotalCents += amount;
          addLine(lineItems, rule.id, label, amount, 'fee');
          break;
        }
        case 'subtract-percentage': {
          const amount = Math.round(subtotalCents * (readNumber(action.percentage, 0) / 100));
          subtotalCents -= amount;
          discountCents += amount;
          addLine(lineItems, rule.id, label, -amount, 'discount');
          break;
        }
        case 'set-base-price': {
          const amount = readCents(action.amountCents);
          const delta = amount - baseCents;
          baseCents = amount;
          subtotalCents += delta;
          addLine(lineItems, rule.id, label, delta, 'rule');
          break;
        }
        case 'set-line-item': {
          const amount = readCents(action.amountCents);
          subtotalCents += amount;
          addLine(lineItems, rule.id, label, amount, 'rule');
          break;
        }
        case 'add-per-unit': {
          const value = readNumber(rawValues[action.fieldId || rule.conditions[0]?.fieldId || ''], 0);
          const amount = Math.round(value * readCents(action.amountCents));
          subtotalCents += amount;
          addLine(lineItems, rule.id, label, amount, 'rule');
          break;
        }
        case 'add-option-price': {
          const field = settings.fields.find((candidate) => candidate.id === action.fieldId);
          if (!field) {
            warnings.push(`Rule "${rule.name}" references a missing field.`);
            break;
          }
          const amount = getSelectedOptions(field, rawValues[field.id]).reduce((sum, option) => sum + readCents(option.priceCents), 0);
          subtotalCents += amount;
          addLine(lineItems, rule.id, label, amount, 'rule');
          break;
        }
        case 'set-deposit': {
          depositCents = action.amountCents !== undefined
            ? readCents(action.amountCents)
            : Math.round(subtotalCents * (readNumber(action.percentage, 0) / 100));
          break;
        }
        case 'apply-discount': {
          const amount = action.amountCents !== undefined
            ? readCents(action.amountCents)
            : Math.round(subtotalCents * (readNumber(action.percentage, 0) / 100));
          subtotalCents -= amount;
          discountCents += amount;
          addLine(lineItems, rule.id, label, -amount, 'discount');
          break;
        }
        case 'apply-fee': {
          const amount = action.amountCents !== undefined
            ? readCents(action.amountCents)
            : Math.round(subtotalCents * (readNumber(action.percentage, 0) / 100));
          subtotalCents += amount;
          feeCents += amount;
          addLine(lineItems, rule.id, label, amount, 'fee');
          break;
        }
      }

      subtotalCents = Math.max(0, subtotalCents);
    }
  }

  if (settings.basePricing.minimumPriceCents !== undefined && subtotalCents < settings.basePricing.minimumPriceCents) {
    const delta = settings.basePricing.minimumPriceCents - subtotalCents;
    subtotalCents = settings.basePricing.minimumPriceCents;
    addLine(lineItems, 'minimum-price', 'Minimum price', delta, 'rule');
  }
  if (settings.basePricing.maximumPriceCents !== undefined && subtotalCents > settings.basePricing.maximumPriceCents) {
    const delta = settings.basePricing.maximumPriceCents - subtotalCents;
    subtotalCents = settings.basePricing.maximumPriceCents;
    addLine(lineItems, 'maximum-price', 'Maximum price cap', delta, 'discount');
  }

  const totalCents = Math.max(0, subtotalCents + taxCents);

  if (settings.deposit?.enabled) {
    const calculated = settings.deposit.type === 'fixed'
      ? readCents(settings.deposit.amountCents)
      : Math.round(totalCents * (readNumber(settings.deposit.percentage, 0) / 100));
    depositCents = Math.max(calculated, readCents(settings.deposit.minimumAmountCents));
    depositCents = Math.min(depositCents, totalCents);
  }

  if (depositCents > 0 && !lineItems.some((item) => item.type === 'deposit')) {
    lineItems.push({
      id: 'deposit',
      label: 'Deposit due',
      amountCents: depositCents,
      type: 'deposit',
      sourceId: 'deposit',
    });
  }

  const spread = Math.max(0, Math.min(1, readNumber(settings.display.rangeSpread, 0.15)));
  const result: QuoteCalculationResult = {
    currency: settings.currency,
    subtotalCents,
    discountCents,
    feeCents,
    taxCents,
    depositCents,
    totalCents,
    displayMode: settings.display.priceDisplayMode,
    lineItems,
    triggeredRuleIds,
    inactiveRuleIds,
    warnings,
    formulaLines: buildFormulaLines(settings.currency, lineItems, subtotalCents, depositCents, totalCents),
  };

  if (settings.display.priceDisplayMode === 'range') {
    result.rangeLowCents = Math.max(0, Math.round(totalCents * (1 - spread)));
    result.rangeHighCents = Math.max(result.rangeLowCents, Math.round(totalCents * (1 + spread)));
  }

  return result;
}

export function validateEstimateQuoteSettings(settings: EstimateQuoteSettings): string[] {
  const warnings: string[] = [];
  const fieldIds = new Set(settings.fields.map((field) => field.id));
  const hasRequiredContact = settings.fields.some((field) =>
    field.required && (field.contactRole === 'email' || field.type === 'email' || field.contactRole === 'phone' || field.contactRole === 'name')
  );
  const hasPricingField = settings.fields.some((field) =>
    field.pricing?.enabled || field.options?.some((option) => option.priceCents && option.priceCents > 0)
  );

  if (!hasRequiredContact) warnings.push('Customers can submit without required contact info.');
  if (settings.quoteMode !== 'request-only' && settings.basePricing.enabled && !hasPricingField && settings.pricingRules.length === 0) {
    warnings.push('Pricing is enabled but there are no pricing fields or pricing rules.');
  }
  if (settings.deposit?.enabled) {
    warnings.push('Deposit payment settings are saved, but quote checkout is not connected yet.');
  }
  if (settings.crm?.enabled) {
    warnings.push('CRM tags are saved, but no CRM tagging integration is connected yet.');
  }

  for (const rule of settings.pricingRules) {
    if (!rule.enabled) continue;
    if (!rule.name.trim()) warnings.push('A pricing rule is missing a name.');
    if (rule.conditions.length === 0) warnings.push(`Rule "${rule.name || rule.id}" has no condition.`);
    if (rule.actions.length === 0) warnings.push(`Rule "${rule.name || rule.id}" has no action.`);
    for (const condition of rule.conditions) {
      if (!fieldIds.has(condition.fieldId)) warnings.push(`Rule "${rule.name}" references a missing field.`);
      if (condition.operator === 'between' && condition.valueTo === undefined) warnings.push(`Rule "${rule.name}" needs an upper value for "between".`);
    }
    for (const action of rule.actions) {
      if ((action.type === 'add-per-unit' || action.type === 'add-option-price') && action.fieldId && !fieldIds.has(action.fieldId)) {
        warnings.push(`Rule "${rule.name}" action references a missing field.`);
      }
      if (action.type === 'multiply' && readNumber(action.multiplier, 1) < 0) {
        warnings.push(`Rule "${rule.name}" has an impossible negative multiplier.`);
      }
    }
  }

  return Array.from(new Set(warnings));
}

export function evaluatePricingRule(rule: PricingRule, values: Record<string, unknown>): boolean {
  if (rule.conditions.length === 0) return false;
  const results = rule.conditions.map((condition) => evaluateCondition(condition, values[condition.fieldId]));
  return rule.conditionMode === 'any' ? results.some(Boolean) : results.every(Boolean);
}

export function formatQuoteMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'CAD',
    minimumFractionDigits: Math.abs(cents) % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function getQuoteDisplayText(result: QuoteCalculationResult): string {
  if (result.displayMode === 'hidden') return 'Request quote';
  if (result.displayMode === 'starting-at') return `Starting at ${formatQuoteMoney(result.totalCents, result.currency)}`;
  if (result.displayMode === 'range') {
    return `${formatQuoteMoney(result.rangeLowCents ?? result.totalCents, result.currency)} - ${formatQuoteMoney(result.rangeHighCents ?? result.totalCents, result.currency)}`;
  }
  return formatQuoteMoney(result.totalCents, result.currency);
}

export function getFieldDisplayValue(field: EstimateField, value: unknown): string {
  if (isEmptyValue(value)) return '';
  if (Array.isArray(value)) return value.map((item) => optionLabel(field, item)).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return optionLabel(field, value);
}

function normalizeLegacyField(field: unknown, index: number): EstimateField | null {
  if (!isRecord(field)) return null;
  const id = readString(field.id, `legacy-field-${index + 1}`);
  const legacyType = readString(field.type, 'text');
  const type: EstimateFieldType =
    legacyType === 'textarea' ? 'textarea'
      : legacyType === 'number' ? 'number'
        : legacyType === 'select' ? 'select'
          : legacyType === 'checkbox' ? 'checkbox'
            : 'text';
  const rawOptions = Array.isArray(field.options) ? field.options : [];
  return {
    id,
    type,
    label: readString(field.label, `Field ${index + 1}`),
    required: Boolean(field.required),
    options: rawOptions.map((option, optionIndex) => ({
      id: `${id}-option-${optionIndex + 1}`,
      label: String(option),
      value: String(option),
    })),
    validation: {
      min: readOptionalNumber(field.min),
      max: readOptionalNumber(field.max),
    },
    unit: readString(field.unit, ''),
    stepId: index < 2 ? 'details' : 'options',
  };
}

function buildLegacyPricingRules(pairs: Array<{ rawField: unknown; field: EstimateField }>): PricingRule[] {
  return pairs.flatMap(({ rawField, field }) => {
    const legacyRule = isRecord(rawField) && isRecord(rawField.pricingRule)
      ? rawField.pricingRule as { type?: string; amount?: number }
      : undefined;
    if (!legacyRule?.type || !legacyRule.amount) return [];
    const id = `legacy-rule-${field.id}`;
    const baseCondition: PricingCondition = field.type === 'checkbox'
      ? { fieldId: field.id, operator: 'checked' }
      : { fieldId: field.id, operator: 'not-empty' };
    const action: PricingAction =
      legacyRule.type === 'per_unit'
        ? { type: 'add-per-unit', fieldId: field.id, amountCents: legacyRule.amount, label: field.label }
        : legacyRule.type === 'multiply'
          ? { type: 'multiply', multiplier: legacyRule.amount / 100, label: field.label }
          : { type: 'add-fixed', amountCents: legacyRule.amount, label: field.label };
    return [{
      id,
      name: field.label,
      enabled: true,
      conditions: [baseCondition],
      conditionMode: 'all' as const,
      actions: [action],
    }];
  });
}

function normalizeFields(value: unknown): EstimateField[] {
  const rawFields = Array.isArray(value) ? value : DEFAULT_ESTIMATE_FIELDS;
  const fields = rawFields
    .map((field, index) => normalizeField(field, index))
    .filter(Boolean) as EstimateField[];
  return fields.length > 0 ? fields : DEFAULT_ESTIMATE_FIELDS;
}

function normalizeField(field: unknown, index: number): EstimateField | null {
  if (!isRecord(field)) return null;
  const id = readString(field.id, `field-${index + 1}`);
  const type = readChoice<EstimateFieldType>(
    field.type,
    ['text', 'textarea', 'email', 'phone', 'number', 'select', 'radio', 'checkbox', 'date', 'file', 'quantity', 'service-option', 'addon'],
    'text',
  );
  const options = Array.isArray(field.options)
    ? field.options.map((option, optionIndex) => normalizeOption(option, `${id}-option-${optionIndex + 1}`)).filter(Boolean) as EstimateFieldOption[]
    : undefined;
  const validation = isRecord(field.validation) ? {
    min: readOptionalNumber(field.validation.min),
    max: readOptionalNumber(field.validation.max),
    minLength: readOptionalNumber(field.validation.minLength),
    maxLength: readOptionalNumber(field.validation.maxLength),
    pattern: readString(field.validation.pattern, ''),
  } : undefined;
  const pricing = isRecord(field.pricing) ? {
    enabled: Boolean(field.pricing.enabled),
    priceCents: readOptionalCents(field.pricing.priceCents),
    priceType: readChoice(field.pricing.priceType, ['fixed', 'per-unit', 'percentage'], 'fixed'),
    label: readString(field.pricing.label, ''),
  } : undefined;

  return {
    id,
    type,
    label: readString(field.label, `Field ${index + 1}`),
    description: readString(field.description, ''),
    placeholder: readString(field.placeholder, ''),
    required: Boolean(field.required),
    options,
    defaultValue: field.defaultValue,
    validation,
    pricing,
    stepId: readString(field.stepId, ''),
    unit: readString(field.unit, ''),
    contactRole: readChoice(field.contactRole, ['name', 'email', 'phone', 'company', 'address', 'preferredDate', 'message'], undefined),
  };
}

function normalizeOption(option: unknown, fallbackId: string): EstimateFieldOption | null {
  if (!isRecord(option)) {
    const label = String(option ?? '').trim();
    return label ? { id: fallbackId, label, value: label } : null;
  }
  const label = readString(option.label, readString(option.value, 'Option'));
  return {
    id: readString(option.id, fallbackId),
    label,
    value: readString(option.value, label),
    priceCents: readOptionalCents(option.priceCents),
    priceType: readChoice<'fixed' | 'per-unit' | 'percentage'>(option.priceType, ['fixed', 'per-unit', 'percentage'], 'fixed'),
  };
}

function normalizeSteps(value: unknown, requireSteps: boolean): EstimateStep[] | undefined {
  const rawSteps = Array.isArray(value) ? value : DEFAULT_ESTIMATE_STEPS;
  const steps = rawSteps
    .map((step, index) => {
      if (!isRecord(step)) return null;
      return {
        id: readString(step.id, `step-${index + 1}`),
        title: readString(step.title, `Step ${index + 1}`),
        description: readString(step.description, ''),
        order: readNumber(step.order, index + 1),
      };
    })
    .filter(Boolean) as EstimateStep[];
  if (steps.length === 0 && requireSteps) return DEFAULT_ESTIMATE_STEPS;
  return steps.length > 0 ? steps.sort((a, b) => a.order - b.order) : undefined;
}

function normalizePricingRules(value: unknown, fields: EstimateField[]): PricingRule[] {
  const fieldIds = new Set(fields.map((field) => field.id));
  if (!Array.isArray(value)) return [];
  return value.map((rule, index) => {
    if (!isRecord(rule)) return null;
    const id = readString(rule.id, `rule-${index + 1}`);
    return {
      id,
      name: readString(rule.name, `Rule ${index + 1}`),
      enabled: rule.enabled !== false,
      conditionMode: readChoice(rule.conditionMode, ['all', 'any'], 'all'),
      conditions: Array.isArray(rule.conditions)
        ? rule.conditions.map((condition) => normalizeCondition(condition, fieldIds)).filter(Boolean) as PricingCondition[]
        : [],
      actions: Array.isArray(rule.actions)
        ? rule.actions.map(normalizeAction).filter(Boolean) as PricingAction[]
        : [],
    };
  }).filter(Boolean) as PricingRule[];
}

function normalizeCondition(condition: unknown, fieldIds: Set<string>): PricingCondition | null {
  if (!isRecord(condition)) return null;
  const fieldId = readString(condition.fieldId, '');
  return {
    fieldId: fieldIds.has(fieldId) ? fieldId : fieldId,
    operator: readChoice<PricingConditionOperator>(
      condition.operator,
      ['equals', 'not-equals', 'contains', 'not-contains', 'checked', 'not-checked', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'not-empty'],
      'equals',
    ),
    value: condition.value,
    valueTo: condition.valueTo,
  };
}

function normalizeAction(action: unknown): PricingAction | null {
  if (!isRecord(action)) return null;
  return {
    type: readChoice<PricingActionType>(
      action.type,
      ['add-fixed', 'subtract-fixed', 'multiply', 'add-percentage', 'subtract-percentage', 'set-base-price', 'set-line-item', 'add-per-unit', 'add-option-price', 'set-deposit', 'apply-discount', 'apply-fee'],
      'add-fixed',
    ),
    amountCents: readOptionalCents(action.amountCents),
    percentage: readOptionalNumber(action.percentage),
    multiplier: readOptionalNumber(action.multiplier),
    fieldId: readString(action.fieldId, ''),
    label: readString(action.label, ''),
  };
}

function normalizeHero(value: unknown): HeroPresentationConfig {
  const defaults = DEFAULT_ESTIMATE_QUOTE_SETTINGS.hero as HeroPresentationConfig;
  if (!isRecord(value)) return { ...defaults, background: { ...defaults.background } };
  const rawBg = isRecord(value.background) ? value.background : {};
  const opacity = readNumber(rawBg.overlayOpacity, defaults.background.overlayOpacity);
  return {
    formSide: readChoice<HeroFormSide>(value.formSide, ['left', 'right'], defaults.formSide),
    background: {
      type: readChoice<HeroBackgroundType>(rawBg.type, ['color', 'image'], defaults.background.type),
      color: readString(rawBg.color, defaults.background.color),
      imageUrl: readString(rawBg.imageUrl, '') || undefined,
      imageSettings: rawBg.imageSettings,
      imageAttribution: rawBg.imageAttribution,
      overlayColor: readString(rawBg.overlayColor, defaults.background.overlayColor),
      overlayOpacity: Math.max(0, Math.min(1, opacity)),
    },
    textColor: readString(value.textColor, defaults.textColor || '#ffffff'),
    eyebrow: readString(value.eyebrow, ''),
  };
}

function normalizeDeposit(value: unknown): EstimateQuoteSettings['deposit'] {
  if (!isRecord(value)) return DEFAULT_ESTIMATE_QUOTE_SETTINGS.deposit;
  return {
    enabled: Boolean(value.enabled),
    type: readChoice(value.type, ['fixed', 'percentage'], 'percentage'),
    amountCents: readOptionalCents(value.amountCents),
    percentage: readOptionalNumber(value.percentage),
    minimumAmountCents: readOptionalCents(value.minimumAmountCents),
    paymentTiming: readChoice(value.paymentTiming, ['on-submit', 'after-approval'], 'after-approval'),
  };
}

function normalizeCrm(value: unknown): EstimateQuoteSettings['crm'] {
  if (!isRecord(value)) return DEFAULT_ESTIMATE_QUOTE_SETTINGS.crm;
  return {
    enabled: Boolean(value.enabled),
    defaultTags: Array.isArray(value.defaultTags) ? value.defaultTags.map(String).filter(Boolean) : [],
    conditionalTags: Array.isArray(value.conditionalTags)
      ? value.conditionalTags.map((rule, index) => {
        if (!isRecord(rule)) return null;
        return {
          id: readString(rule.id, `tag-rule-${index + 1}`),
          tag: readString(rule.tag, ''),
          conditions: Array.isArray(rule.conditions) ? rule.conditions.map((condition) => normalizeCondition(condition, new Set())).filter(Boolean) as PricingCondition[] : [],
          conditionMode: readChoice(rule.conditionMode, ['all', 'any'], 'all'),
        };
      }).filter(Boolean) as ConditionalTagRule[]
      : [],
  };
}

function evaluateCondition(condition: PricingCondition, rawValue: unknown): boolean {
  const value = normalizeComparable(rawValue);
  const expected = normalizeComparable(condition.value);

  switch (condition.operator) {
    case 'equals':
      return compareValue(value, expected);
    case 'not-equals':
      return !compareValue(value, expected);
    case 'contains':
      return containsValue(value, expected);
    case 'not-contains':
      return !containsValue(value, expected);
    case 'checked':
      return rawValue === true || (Array.isArray(rawValue) && rawValue.length > 0);
    case 'not-checked':
      return rawValue !== true && (!Array.isArray(rawValue) || rawValue.length === 0);
    case 'gt':
      return readNumber(rawValue, 0) > readNumber(condition.value, 0);
    case 'gte':
      return readNumber(rawValue, 0) >= readNumber(condition.value, 0);
    case 'lt':
      return readNumber(rawValue, 0) < readNumber(condition.value, 0);
    case 'lte':
      return readNumber(rawValue, 0) <= readNumber(condition.value, 0);
    case 'between': {
      const numeric = readNumber(rawValue, Number.NaN);
      return Number.isFinite(numeric) && numeric >= readNumber(condition.value, 0) && numeric <= readNumber(condition.valueTo, 0);
    }
    case 'empty':
      return isEmptyValue(rawValue);
    case 'not-empty':
      return !isEmptyValue(rawValue);
    default:
      return false;
  }
}

function getSelectedOptions(field: EstimateField, value: unknown): EstimateFieldOption[] {
  if (!field.options?.length || isEmptyValue(value)) return [];
  const selectedValues = Array.isArray(value) ? value.map(String) : [String(value)];
  return field.options.filter((option) => selectedValues.includes(option.value) || selectedValues.includes(option.label));
}

function optionLabel(field: EstimateField, value: unknown): string {
  const text = String(value ?? '');
  return field.options?.find((option) => option.value === text || option.label === text)?.label || text;
}

function addLine(lineItems: QuoteLineItem[], sourceId: string, label: string, amountCents: number, type: QuoteLineItem['type']) {
  if (amountCents === 0) return;
  lineItems.push({
    id: `${sourceId}-${lineItems.length + 1}`,
    label,
    amountCents,
    type,
    sourceId,
  });
}

function buildFormulaLines(currency: string, lineItems: QuoteLineItem[], subtotalCents: number, depositCents: number, totalCents: number): string[] {
  const lines = lineItems
    .filter((item) => item.type !== 'deposit')
    .map((item) => `${item.amountCents < 0 ? '-' : '+'} ${item.label}: ${formatQuoteMoney(Math.abs(item.amountCents), currency)}`);
  if (lineItems.some((item) => item.type === 'base')) {
    const base = lineItems.find((item) => item.type === 'base');
    if (base) lines[lines.indexOf(`+ ${base.label}: ${formatQuoteMoney(base.amountCents, currency)}`)] = `${base.label}: ${formatQuoteMoney(base.amountCents, currency)}`;
  }
  lines.push(`Subtotal: ${formatQuoteMoney(subtotalCents, currency)}`);
  if (depositCents > 0) lines.push(`Deposit due today: ${formatQuoteMoney(depositCents, currency)}`);
  lines.push(`Estimated total: ${formatQuoteMoney(totalCents, currency)}`);
  return lines;
}

function normalizeEmailList(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(/[,;\n]/).map((item) => item.trim()).filter(isLikelyEmail);
  }
  if (!Array.isArray(value)) return [];
  return value.map(String).map((item) => item.trim()).filter(isLikelyEmail);
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readOptionalNumber(value: unknown): number | undefined {
  const numeric = readNumber(value, Number.NaN);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function readCents(value: unknown): number {
  const numeric = readNumber(value, 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function readOptionalCents(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return readCents(value);
}

function readChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T;
function readChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T | undefined): T | undefined;
function readChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T | undefined): T | undefined {
  return typeof value === 'string' && choices.includes(value as T) ? value as T : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge<T>(...objects: T[]): T {
  const result: Record<string, unknown> = {};
  for (const object of objects) {
    if (!isRecord(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (isRecord(value) && isRecord(result[key])) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function normalizeComparable(value: unknown): string | string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).toLowerCase());
  return String(value ?? '').toLowerCase();
}

function compareValue(value: string | string[], expected: string | string[]): boolean {
  if (Array.isArray(value)) return value.includes(Array.isArray(expected) ? expected[0] : expected);
  if (Array.isArray(expected)) return expected.includes(value);
  return value === expected;
}

function containsValue(value: string | string[], expected: string | string[]): boolean {
  const needle = Array.isArray(expected) ? expected[0] : expected;
  if (Array.isArray(value)) return value.some((item) => item.includes(needle));
  return value.includes(needle);
}
