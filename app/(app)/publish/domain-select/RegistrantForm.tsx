'use client';

import { AlertTriangle, UserRound } from 'lucide-react';
import {
  BASE_LABELS,
  type RegistrantContact,
  type RegistrantErrors,
  type RegistrantField,
  type RegistrantSchema,
} from '@/lib/domains/registrant';

interface RegistrantFormProps {
  domain: string;
  value: RegistrantContact;
  onChange: (next: RegistrantContact) => void;
  schema: RegistrantSchema | null;
  errors: RegistrantErrors;
  loading?: boolean;
}

const PLACEHOLDERS: Record<string, string> = {
  firstName: 'Jane',
  lastName: 'Smith',
  companyName: 'Optional',
  email: 'jane@example.com',
  phone: '416-555-1234',
  address1: '123 Main St',
  address2: 'Suite, unit (optional)',
  city: 'Toronto',
  state: 'ON',
  zip: 'M5V 3A8',
  country: 'CA',
};

const inputClass = (hasError: boolean) =>
  `w-full px-3 py-2 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-transparent bg-white ${
    hasError ? 'border-red-400' : 'border-slate-300'
  }`;

/**
 * Domain owner ("registrant") details. Standard fields for every domain, plus
 * whatever extra fields the TLD's registry requires (from Vercel's schema).
 */
export default function RegistrantForm({ domain, value, onChange, schema, errors, loading }: RegistrantFormProps) {
  const set = (key: string, v: string, extra: boolean) => {
    if (extra) onChange({ ...value, additional: { ...(value.additional ?? {}), [key]: v } });
    else onChange({ ...value, [key]: v });
  };

  const renderField = (key: string, opts: { full?: boolean; optional?: boolean } = {}) => {
    const field: RegistrantField | undefined = schema?.fields[key];
    const extra = !!schema?.extraKeys.includes(key);
    const current = extra ? value.additional?.[key] ?? '' : ((value as unknown as Record<string, string>)[key] ?? '');
    const label = field?.label || BASE_LABELS[key] || key;
    const err = errors[key];
    const id = `registrant-${key}`;

    return (
      <div key={key} className={opts.full ? 'col-span-2' : ''}>
        <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">
          {label}
          {opts.optional && !field?.required && <span className="font-normal text-slate-400"> (optional)</span>}
        </label>
        {field?.type === 'enum' && field.options ? (
          <select
            id={id}
            value={current}
            onChange={(e) => set(key, e.target.value, extra)}
            className={inputClass(!!err)}
          >
            {(field.options.length > 1 || !current) && <option value="">Select…</option>}
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
            autoComplete={AUTOCOMPLETE[key]}
            value={current}
            onChange={(e) => set(key, e.target.value, extra)}
            placeholder={PLACEHOLDERS[key]}
            maxLength={key === 'country' ? 2 : undefined}
            className={inputClass(!!err)}
          />
        )}
        {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      </div>
    );
  };

  const tld = domain.slice(domain.indexOf('.') + 1);
  const extraKeys = schema?.extraKeys ?? [];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <UserRound className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-800">Domain owner details</p>
          <p className="text-xs text-slate-500">
            Domain registries require the real owner&apos;s name and address. We only share these with the registry.
          </p>
        </div>
      </div>

      {schema && schema.notices.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-semibold">.{tld} registry requirements</p>
            {schema.notices
              .flatMap((n) => n.split('\n'))
              .map((line) => line.trim())
              .filter((line) => line && !/^please check the following:?$/i.test(line))
              .map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </div>
      )}

      {loading && !schema ? (
        <p className="text-xs text-slate-500">Checking what the .{tld} registry needs…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {extraKeys.map((k) => renderField(k, { full: true }))}
          {renderField('firstName')}
          {renderField('lastName')}
          {renderField('companyName', { full: true, optional: true })}
          {renderField('email')}
          {renderField('phone')}
          {renderField('address1', { full: true })}
          {renderField('address2', { full: true, optional: true })}
          {renderField('city')}
          {renderField('state')}
          {renderField('zip')}
          {renderField('country')}
        </div>
      )}
    </div>
  );
}

const AUTOCOMPLETE: Record<string, string> = {
  firstName: 'given-name',
  lastName: 'family-name',
  companyName: 'organization',
  email: 'email',
  phone: 'tel',
  address1: 'address-line1',
  address2: 'address-line2',
  city: 'address-level2',
  state: 'address-level1',
  zip: 'postal-code',
  country: 'country',
};

/** One-line summary of saved details, e.g. "Jane Smith · Toronto, CA-ON". */
export function summarizeRegistrant(c: RegistrantContact): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  const place = [c.city, c.state].filter(Boolean).join(', ');
  return [c.companyName || name, place].filter(Boolean).join(' · ');
}
