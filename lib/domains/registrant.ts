/**
 * Registrant (domain owner) contact details for domain registrations.
 *
 * Registries require real owner details, and some TLDs need extra fields
 * (e.g. .ca needs a CIRA legal type and language preference, a Canadian
 * province and a "A1A 1A1" postal code). Vercel publishes those per-TLD
 * requirements at GET /v1/registrar/domains/{domain}/contact-info/schema;
 * the server fetches it (see registrant-server.ts) and both the UI and the API
 * validate against it here, so problems are caught before we try to buy.
 *
 * Pure module: safe to import from client components.
 */

export interface RegistrantContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  companyName?: string;
  /** TLD-specific fields (e.g. legal_type, lang_pref for .ca). */
  additional?: Record<string, string>;
}

export interface RegistrantFieldOption {
  value: string;
  label: string;
}

export interface RegistrantField {
  key: string;
  label: string;
  description?: string;
  required: boolean;
  type: 'string' | 'enum';
  options?: RegistrantFieldOption[];
  /** Vercel validation rule, e.g. "regex:/^...$/" or "required_if:tldRequirements.legal_type,[CCO,...]". */
  validation?: string;
  /** True for standard contact fields; false for TLD-specific `additional` fields. */
  base: boolean;
}

export interface RegistrantSchema {
  tld: string;
  /** Schema overrides keyed by field name (base and TLD-specific). Empty for TLDs with no extra rules. */
  fields: Record<string, RegistrantField>;
  /** Keys of TLD-specific fields, sent under contactInformation.additional. */
  extraKeys: string[];
  /** Registry notes to show the user (e.g. "use a real person's name"). */
  notices: string[];
}

export type RegistrantErrors = Partial<Record<string, string>>;

export const BASE_FIELD_KEYS = [
  'firstName', 'lastName', 'companyName', 'email', 'phone',
  'address1', 'address2', 'city', 'state', 'zip', 'country', 'fax',
] as const;

const REQUIRED_BASE: Array<keyof RegistrantContact> = [
  'firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'state', 'zip', 'country',
];

export const BASE_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  companyName: 'Company / organization',
  email: 'Email',
  phone: 'Phone',
  address1: 'Street address',
  address2: 'Address line 2',
  city: 'City',
  state: 'Province / state',
  zip: 'Postal / ZIP code',
  country: 'Country',
};

export function emptyRegistrant(partial: Partial<RegistrantContact> = {}): RegistrantContact {
  return {
    firstName: '', lastName: '', email: '', phone: '', address1: '', address2: '',
    city: '', state: '', zip: '', country: 'CA', companyName: '', additional: {},
    ...partial,
  };
}

export function tldOf(domain: string): string {
  const d = domain.trim().toLowerCase();
  const i = d.indexOf('.');
  return i === -1 ? d : d.slice(i + 1);
}

/**
 * Normalize a phone number to E.164 (+14165551234).
 * Assumes NANP when given 10 digits without a country code.
 */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

/** Turn Vercel's raw schema response into a RegistrantSchema. */
export function parseVercelSchema(tld: string, raw: unknown): RegistrantSchema {
  const schema: RegistrantSchema = { tld, fields: {}, extraKeys: [], notices: [] };
  if (!raw || typeof raw !== 'object') return schema;

  const baseKeys = new Set<string>(BASE_FIELD_KEYS);
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const f = value as {
      description?: string; label?: string; required?: boolean; type?: string;
      options?: Array<{ value: string; label: string }>; validation?: string;
    };

    if (f.type === 'notice') {
      if (f.description) schema.notices.push(f.description);
      continue;
    }

    const base = baseKeys.has(key);
    schema.fields[key] = {
      key,
      label: f.label || BASE_LABELS[key] || f.description || key,
      description: f.description && f.description !== f.label ? f.description : undefined,
      required: !!f.required,
      type: f.type === 'enum' && Array.isArray(f.options) ? 'enum' : 'string',
      options: Array.isArray(f.options) ? f.options.map(o => ({ value: String(o.value), label: String(o.label) })) : undefined,
      validation: f.validation,
      base,
    };
    if (!base) schema.extraKeys.push(key);
  }
  return schema;
}

function valueOf(contact: RegistrantContact, key: string, schema: RegistrantSchema | null): string {
  const isExtra = schema?.extraKeys.includes(key);
  const v = isExtra ? contact.additional?.[key] : (contact as unknown as Record<string, unknown>)[key];
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Fix values the user typed that are obviously meant to be valid, e.g. "ON" when
 * the registry wants "CA-ON", "m5v3a8" when it wants "M5V 3A8", "ca" → "CA".
 */
export function normalizeRegistrant(contact: RegistrantContact, schema: RegistrantSchema | null): RegistrantContact {
  // Accepts untrusted input (request bodies): keep only known string fields.
  const src = (contact ?? {}) as unknown as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const out: RegistrantContact = emptyRegistrant({ country: '' });
  for (const k of BASE_FIELD_KEYS) {
    if (k === 'fax') continue;
    (out as unknown as Record<string, string>)[k] = str(src[k]);
  }
  const rawAdditional = src.additional && typeof src.additional === 'object' ? (src.additional as Record<string, unknown>) : {};
  out.additional = {};
  for (const [k, v] of Object.entries(rawAdditional)) {
    if (typeof v === 'string' && v.trim()) out.additional[k] = v.trim();
  }
  out.country = out.country.toUpperCase();

  const stateField = schema?.fields.state;
  if (stateField?.type === 'enum' && stateField.options && out.state) {
    const raw = out.state.toUpperCase();
    const match = stateField.options.find(o =>
      o.value.toUpperCase() === raw ||
      o.value.toUpperCase() === `${out.country}-${raw}` ||
      o.label.toUpperCase() === raw,
    );
    if (match) out.state = match.value;
  }

  // Canadian postal code: insert the space the registry requires.
  if (out.country === 'CA') {
    const compact = out.zip.replace(/\s+/g, '').toUpperCase();
    if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) out.zip = `${compact.slice(0, 3)} ${compact.slice(3)}`;
  }

  for (const key of schema?.extraKeys ?? []) {
    const field = schema!.fields[key];
    const v = out.additional![key];
    if (field.type === 'enum' && field.options && v) {
      const m = field.options.find(o => o.value.toUpperCase() === v.toUpperCase());
      if (m) out.additional![key] = m.value;
    }
  }
  return out;
}

function parseRegex(rule: string): RegExp | null {
  const m = rule.match(/^regex:\/(.*)\/([a-z]*)$/);
  if (!m) return null;
  try {
    return new RegExp(m[1], m[2]);
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

/**
 * Validate a registrant contact. Pass the TLD schema when known; with `null`
 * only the standard checks every registration needs are applied.
 * Returns field → message; empty object when valid.
 */
export function validateRegistrant(contact: RegistrantContact, schema: RegistrantSchema | null): RegistrantErrors {
  const errors: RegistrantErrors = {};
  const label = (key: string) => schema?.fields[key]?.label ?? BASE_LABELS[key] ?? key;

  for (const key of REQUIRED_BASE) {
    if (!valueOf(contact, key, schema)) errors[key] = `${label(key)} is required.`;
  }

  const email = valueOf(contact, 'email', schema);
  if (email && !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';

  const phone = valueOf(contact, 'phone', schema);
  if (phone && !E164_RE.test(toE164(phone))) {
    errors.phone = 'Enter a valid phone number, including area code (e.g. 416-555-1234 or +44 20 7946 0958).';
  }

  const country = valueOf(contact, 'country', schema);
  if (country && !/^[A-Za-z]{2}$/.test(country)) errors.country = 'Use a 2-letter country code (e.g. CA, US).';

  if (!schema) return errors;

  for (const field of Object.values(schema.fields)) {
    if (errors[field.key]) continue;
    const v = valueOf(contact, field.key, schema);
    const rule = field.validation ?? '';

    let required = field.required;
    const reqIf = rule.match(/^required_if:(?:\w+\.)*(\w+),\[(.*)\]$/);
    if (reqIf) {
      const other = valueOf(contact, reqIf[1], schema);
      if (reqIf[2].split(',').map(s => s.trim()).includes(other)) required = true;
    }

    if (!v) {
      if (required) {
        errors[field.key] = reqIf
          ? `${field.label} is required for the selected ${label(reqIf[1]).toLowerCase()} (use the exact registered legal name).`
          : `${field.label} is required.`;
      }
      continue;
    }

    if (field.type === 'enum' && field.options && !field.options.some(o => o.value === v)) {
      errors[field.key] = field.key === 'country' && field.options.length === 1
        ? `.${schema.tld} domains must be registered to a ${field.options[0].label} address.`
        : `Choose a valid ${field.label.toLowerCase()}.`;
      continue;
    }

    const re = rule.startsWith('regex:') ? parseRegex(rule) : null;
    if (re && !re.test(v)) {
      errors[field.key] = field.key === 'zip'
        ? 'Enter a valid postal code with a space in the middle (e.g. M5V 3A8).'
        : `${field.label} is not in the expected format.`;
    }
  }

  return errors;
}

/** Build the `contactInformation` object for Vercel's buy/transfer endpoints. */
export function toVercelContactInformation(contact: RegistrantContact, schema: RegistrantSchema | null) {
  const c = normalizeRegistrant(contact, schema);
  const additional: Record<string, string> = {};
  for (const key of schema?.extraKeys ?? []) {
    const v = c.additional?.[key];
    if (v) additional[key] = v;
  }
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: toE164(c.phone),
    address1: c.address1,
    ...(c.address2 ? { address2: c.address2 } : {}),
    city: c.city,
    state: c.state,
    zip: c.zip,
    country: c.country,
    ...(c.companyName ? { companyName: c.companyName } : {}),
    ...(Object.keys(additional).length ? { additional } : {}),
  };
}

/** domain_purchases column values for a registrant contact. */
export function registrantToColumns(contact: RegistrantContact) {
  return {
    contact_first_name: contact.firstName,
    contact_last_name: contact.lastName,
    contact_email: contact.email,
    contact_phone: contact.phone,
    contact_address1: contact.address1,
    contact_address2: contact.address2 || null,
    contact_city: contact.city,
    contact_state: contact.state,
    contact_zip: contact.zip,
    contact_country: contact.country,
    contact_company_name: contact.companyName || null,
    contact_additional: contact.additional && Object.keys(contact.additional).length ? contact.additional : null,
  };
}

export const REGISTRANT_COLUMNS =
  'contact_first_name, contact_last_name, contact_email, contact_phone, contact_address1, contact_address2, contact_city, contact_state, contact_zip, contact_country, contact_company_name, contact_additional';

/** Inverse of registrantToColumns; null when the row has no stored contact. */
export function registrantFromColumns(row: Record<string, unknown> | null | undefined): RegistrantContact | null {
  if (!row || !row.contact_first_name) return null;
  const s = (k: string) => (typeof row[k] === 'string' ? (row[k] as string) : '');
  return {
    firstName: s('contact_first_name'),
    lastName: s('contact_last_name'),
    email: s('contact_email'),
    phone: s('contact_phone'),
    address1: s('contact_address1'),
    address2: s('contact_address2'),
    city: s('contact_city'),
    state: s('contact_state'),
    zip: s('contact_zip'),
    country: s('contact_country') || 'CA',
    companyName: s('contact_company_name'),
    additional: (row.contact_additional as Record<string, string> | null) ?? {},
  };
}
