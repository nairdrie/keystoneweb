'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Send, ArrowRight } from 'lucide-react';

const BUSINESS_TYPES = [
  { value: 'services', label: 'Services (I sell my time/expertise)' },
  { value: 'products', label: 'Products (physical or digital)' },
  { value: 'portfolio', label: 'Portfolio / personal brand' },
  { value: 'nonprofit', label: 'Association / non-profit' },
  { value: 'other', label: 'Something else' },
];

const PAGE_OPTIONS = [
  'Home',
  'About',
  'Services',
  'Contact',
  'Menu',
  'Gallery',
  'Booking',
  'FAQ',
  'Other',
];

const LOGO_OPTIONS = [
  { value: 'have_it', label: 'I have one' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'need_help', label: 'Need help' },
];

const DOMAIN_OPTIONS = [
  { value: 'have_one', label: 'I have a domain' },
  { value: 'need_one', label: 'I need one' },
  { value: 'not_sure', label: 'Not sure yet' },
];

const TIMING_OPTIONS = [
  { value: 'asap', label: 'ASAP' },
  { value: 'two_weeks', label: 'Within 2 weeks' },
  { value: 'one_month', label: 'Within a month' },
  { value: 'flexible', label: 'Flexible' },
];

const BUDGET_OPTIONS = [
  { value: 'under_500', label: 'Under $500' },
  { value: '500_to_1000', label: '$500 – $1,000' },
  { value: 'over_1000', label: '$1,000+' },
  { value: 'not_sure', label: 'Not sure' },
];

const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TIME_OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

type FormState = {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: string;
  subCategory: string;
  pages: string[];
  logoStatus: string;
  domainStatus: string;
  launchTiming: string;
  budgetBand: string;
  preferredDays: string[];
  preferredTimes: string[];
  schedulingNotes: string;
  description: string;
  referralSource: string;
};

const INITIAL: FormState = {
  name: '',
  email: '',
  phone: '',
  businessName: '',
  businessType: '',
  subCategory: '',
  pages: [],
  logoStatus: '',
  domainStatus: '',
  launchTiming: '',
  budgetBand: '',
  preferredDays: [],
  preferredTimes: [],
  schedulingNotes: '',
  description: '',
  referralSource: '',
};

export default function SetupIntakeForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleInArray = (key: 'pages' | 'preferredDays' | 'preferredTimes', value: string) => {
    setForm((prev) => {
      const exists = prev[key].includes(value);
      return { ...prev, [key]: exists ? prev[key].filter((v) => v !== value) : [...prev[key], value] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/contact/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send your request.');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-2xl font-black text-slate-900 mb-2">Request received</h3>
        <p className="text-slate-600 text-sm mb-6 max-w-md mx-auto">
          Thanks — we&apos;ll email you within 1 business day to confirm a call
          time that works for you. Keep an eye on your inbox (and spam folder just
          in case).
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
        >
          View subscription plans <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-8"
    >
      <Fieldset title="Contact">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField id="name" label="Full name" required value={form.name} onChange={(v) => update('name', v)} placeholder="Jane Smith" />
          <TextField id="email" type="email" label="Email" required value={form.email} onChange={(v) => update('email', v)} placeholder="jane@company.com" />
          <TextField id="phone" type="tel" label="Phone" required value={form.phone} onChange={(v) => update('phone', v)} placeholder="(555) 555-5555" />
          <TextField id="businessName" label="Business name" required value={form.businessName} onChange={(v) => update('businessName', v)} placeholder="Acme Landscaping" />
        </div>
      </Fieldset>

      <Fieldset title="Your business">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="businessType" required>What kind of business?</Label>
            <select
              id="businessType"
              required
              value={form.businessType}
              onChange={(e) => update('businessType', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors bg-white"
            >
              <option value="">Select one…</option>
              {BUSINESS_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <TextField
            id="subCategory"
            label="Specifically (optional)"
            value={form.subCategory}
            onChange={(v) => update('subCategory', v)}
            placeholder="e.g. Plumber, yoga studio"
          />
        </div>

        <div className="mt-5">
          <Label>Which pages do you think you&apos;ll need?</Label>
          <div className="flex flex-wrap gap-2">
            {PAGE_OPTIONS.map((p) => (
              <Chip
                key={p}
                active={form.pages.includes(p)}
                onClick={() => toggleInArray('pages', p)}
              >
                {p}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Don&apos;t worry if you&apos;re not sure — we&apos;ll nail this down on the call.
          </p>
        </div>
      </Fieldset>

      <Fieldset title="Logo & domain">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RadioGroup
            label="Do you have a logo?"
            name="logoStatus"
            value={form.logoStatus}
            onChange={(v) => update('logoStatus', v)}
            options={LOGO_OPTIONS}
          />
          <RadioGroup
            label="Do you have a domain name?"
            name="domainStatus"
            value={form.domainStatus}
            onChange={(v) => update('domainStatus', v)}
            options={DOMAIN_OPTIONS}
          />
        </div>
      </Fieldset>

      <Fieldset title="Timing & budget">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RadioGroup
            label="When do you want to launch?"
            name="launchTiming"
            value={form.launchTiming}
            onChange={(v) => update('launchTiming', v)}
            options={TIMING_OPTIONS}
          />
          <RadioGroup
            label="Budget comfort for setup"
            name="budgetBand"
            value={form.budgetBand}
            onChange={(v) => update('budgetBand', v)}
            options={BUDGET_OPTIONS}
            hint="Helps us scope — not a final quote."
          />
        </div>
      </Fieldset>

      <Fieldset title="When can we call?">
        <div>
          <Label>Best days of the week</Label>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => (
              <Chip
                key={d}
                active={form.preferredDays.includes(d)}
                onClick={() => toggleInArray('preferredDays', d)}
              >
                {d}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <Label>Best time of day</Label>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((t) => (
              <Chip
                key={t.value}
                active={form.preferredTimes.includes(t.value)}
                onClick={() => toggleInArray('preferredTimes', t.value)}
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <Label htmlFor="schedulingNotes">Any specific times or notes?</Label>
          <input
            id="schedulingNotes"
            type="text"
            maxLength={500}
            value={form.schedulingNotes}
            onChange={(e) => update('schedulingNotes', e.target.value)}
            placeholder="e.g. Weekdays after 4pm, or Saturday morning works"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors"
          />
          <p className="mt-2 text-xs text-slate-500">
            We&apos;ll email you to confirm an exact time.
          </p>
        </div>
      </Fieldset>

      <Fieldset title="Tell us more">
        <div>
          <Label htmlFor="description">Anything we should know about your business?</Label>
          <textarea
            id="description"
            rows={4}
            maxLength={2000}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What you do, who your customers are, what the site needs to help them do (call, book, find you)…"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors resize-none"
          />
        </div>
        <div className="mt-5">
          <Label htmlFor="referralSource">How did you hear about us? (optional)</Label>
          <input
            id="referralSource"
            type="text"
            maxLength={200}
            value={form.referralSource}
            onChange={(e) => update('referralSource', e.target.value)}
            placeholder="Workshop, referral, search, etc."
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors"
          />
        </div>
      </Fieldset>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
      >
        {loading ? (
          <>Sending…</>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send my info
          </>
        )}
      </button>

      <p className="text-xs text-slate-500 text-center">
        We&apos;ll reply within 1 business day. No payment required to start.
      </p>
    </form>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Label({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700 mb-1.5">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} required={required}>{label}</Label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors"
      />
    </div>
  );
}

function RadioGroup({
  label,
  name,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-2">
        {options.map((opt) => {
          const checked = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                checked
                  ? 'border-red-400 bg-red-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="accent-red-600"
              />
              <span className="text-sm text-slate-700">{opt.label}</span>
            </label>
          );
        })}
      </div>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
        active
          ? 'bg-red-600 text-white border-red-600'
          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  );
}
