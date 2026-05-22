'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Eye, EyeOff, Loader2, Check, ChevronLeft } from 'lucide-react';
import { getMarketingTracking } from '@/lib/marketing/utm-capture';

interface FormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface FormStage {
  id: string;
  title: string;
  fields: FormField[];
}

interface Package {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: string;
  features: string[];
  geo_restriction?: { allowed_countries?: string[]; error_message?: string } | null;
}

const COUNTRY_OPTIONS = [
  { code: 'CA', label: 'Canada' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'IE', label: 'Ireland' },
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Germany' },
  { code: 'IN', label: 'India' },
  { code: 'PH', label: 'Philippines' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'JM', label: 'Jamaica' },
  { code: 'TT', label: 'Trinidad and Tobago' },
  { code: 'OTHER', label: 'Other' },
];

interface MemberSignUpPageProps {
  siteId: string;
  siteName?: string;
  palette: Record<string, string>;
  branding?: Record<string, any>;
}

function rawToStages(raw: any): FormStage[] {
  const defaultStage: FormStage = {
    id: 'stage_1',
    title: 'Account Details',
    fields: [
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  };
  if (!raw) return [defaultStage];
  if (raw.stages && Array.isArray(raw.stages)) return raw.stages;
  if (Array.isArray(raw)) {
    // Backwards compat: old flat array → single stage
    return [{ id: 'stage_1', title: 'Account Details', fields: raw }];
  }
  return [defaultStage];
}

export default function MemberSignUpPage({ siteId, siteName, palette, branding }: MemberSignUpPageProps) {
  const [stages, setStages] = useState<FormStage[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [multiData, setMultiData] = useState<Record<string, string[]>>({});
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const primary = palette.primary || '#374151';

  useEffect(() => {
    async function loadConfig() {
      try {
        const [settingsRes, packagesRes] = await Promise.all([
          fetch(`/api/membership/settings?siteId=${siteId}`),
          fetch(`/api/membership/packages?siteId=${siteId}`),
        ]);
        const settingsData = await settingsRes.json();
        const packagesData = await packagesRes.json();

        setSettings(settingsData.settings);
        setStages(rawToStages(settingsData.settings?.signup_form_fields));
        setPackages(packagesData.packages || []);

        if (packagesData.packages?.length === 1) {
          setSelectedPackage(packagesData.packages[0].id);
        }
      } catch (err) {
        console.error('Failed to load signup config:', err);
      } finally {
        setPageLoading(false);
      }
    }
    loadConfig();
  }, [siteId]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  function validateCurrentStage(): string | null {
    const stage = stages[currentStage];
    if (!stage) return null;
    for (const field of stage.fields) {
      if (!field.required) continue;
      if (field.type === 'multiselect') {
        if (!multiData[field.key] || multiData[field.key].length === 0) {
          return `${field.label} is required`;
        }
      } else {
        const val = formData[field.key] || '';
        if (!val.trim()) return `${field.label} is required`;
        if (field.key === 'password' && val.length < 8) return 'Password must be at least 8 characters';
      }
    }
    return null;
  }

  function handleNext() {
    setError('');
    const validationError = validateCurrentStage();
    if (validationError) {
      setError(validationError);
      return;
    }
    setCurrentStage(prev => prev + 1);
  }

  function handleBack() {
    setError('');
    setCurrentStage(prev => prev - 1);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validateCurrentStage();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { name, email, password, ...otherFields } = formData;

      // Merge multiselect values (comma-separated) into custom fields
      const customFields: Record<string, any> = { ...otherFields };
      for (const [key, vals] of Object.entries(multiData)) {
        customFields[key] = vals.join(', ');
      }

      const res = await fetch('/api/membership/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          email,
          password,
          name: name || null,
          packageId: selectedPackage || null,
          customFields,
          country: formData.country || null,
          province: formData.province || null,
          marketingOptIn,
          tracking: getMarketingTracking(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign up failed');
        return;
      }

      setSuccess(true);

      const pkg = packages.find(p => p.id === selectedPackage);
      if (pkg && pkg.price_cents > 0 && data.memberId) {
        const checkoutRes = await fetch('/api/membership/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteId,
            memberId: data.memberId,
            packageId: selectedPackage,
            successUrl: `${window.location.origin}/signin?verified=true`,
            cancelUrl: `${window.location.origin}/signup`,
          }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutData.url) {
          window.location.href = checkoutData.url;
          return;
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Field renderer ──────────────────────────────────────────────────────────

  function renderField(field: FormField) {
    const { key, label, type, required, options } = field;

    if (type === 'password') {
      return (
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required={required}
            minLength={8}
            value={formData[key] || ''}
            onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-offset-1"
            placeholder="Minimum 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      );
    }

    if (type === 'select' && options && options.length > 0) {
      return (
        <select
          required={required}
          value={formData[key] || ''}
          onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
        >
          <option value="">Select…</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (type === 'multiselect' && options && options.length > 0) {
      const selected = multiData[key] || [];
      return (
        <div className="space-y-2">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={e => {
                  const next = e.target.checked
                    ? [...selected, opt]
                    : selected.filter(v => v !== opt);
                  setMultiData(prev => ({ ...prev, [key]: next }));
                }}
                className="rounded"
              />
              <span className="text-sm text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    if (type === 'textarea') {
      return (
        <textarea
          required={required}
          value={formData[key] || ''}
          onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
          rows={3}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
        />
      );
    }

    if (type === 'checkbox') {
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData[key] === 'true'}
            onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.checked ? 'true' : 'false' }))}
            className="rounded"
          />
          <span className="text-sm text-slate-600">{label}</span>
        </label>
      );
    }

    return (
      <input
        type={type || 'text'}
        required={required}
        value={formData[key] || ''}
        onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
      />
    );
  }

  // ── Loading / success screens ───────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-50">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h1>
            <p className="text-slate-600 mb-6">
              We&apos;ve sent a verification link to your email. Please click the link to activate your account.
            </p>
            <a
              href="/signin"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              Go to Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isLastStage = currentStage === stages.length - 1;
  const isMultiStage = stages.length > 1;
  const activeStage = stages[currentStage];

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">

          {/* Branding / header */}
          <div className="text-center mb-6">
            {branding?.siteLogo ? (
              <div className="flex justify-center mb-4">
                <img
                  src={branding.siteLogo}
                  alt={siteName || 'Logo'}
                  className="max-h-16 w-auto object-contain"
                />
              </div>
            ) : (
              <div
                className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${primary}15` }}
              >
                <UserPlus className="w-6 h-6" style={{ color: primary }} />
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
            {siteName && <p className="text-sm text-slate-500 mt-1">Join {siteName}</p>}
          </div>

          {/* Multi-stage progress bar */}
          {isMultiStage && (
            <div className="mb-6">
              <div className="flex items-center gap-1 mb-2">
                {stages.map((stage, i) => (
                  <div key={stage.id} className="flex items-center flex-1 last:flex-none">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        i < currentStage
                          ? 'bg-green-500 text-white'
                          : i === currentStage
                          ? 'text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                      style={i === currentStage ? { backgroundColor: primary } : {}}
                    >
                      {i < currentStage ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    {i < stages.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${i < currentStage ? 'bg-green-500' : 'bg-slate-200'}`} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Step {currentStage + 1} of {stages.length}: <span className="font-medium">{activeStage?.title}</span>
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Package selection — shown only on first stage */}
          {currentStage === 0 && packages.length > 1 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Choose a Plan</label>
              <div className="grid gap-3">
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPackage(pkg.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedPackage === pkg.id
                        ? 'border-current bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    style={selectedPackage === pkg.id ? { borderColor: primary } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{pkg.name}</p>
                        {pkg.description && <p className="text-xs text-slate-500 mt-0.5">{pkg.description}</p>}
                      </div>
                      <div className="text-right">
                        {pkg.price_cents > 0 ? (
                          <span className="font-bold text-slate-900">
                            ${(pkg.price_cents / 100).toFixed(2)}
                            {pkg.billing_interval !== 'one_time' && (
                              <span className="text-xs font-normal text-slate-500">/{pkg.billing_interval}</span>
                            )}
                          </span>
                        ) : (
                          <span className="font-medium text-green-600">Free</span>
                        )}
                      </div>
                    </div>
                    {pkg.features && pkg.features.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {pkg.features.map((f, i) => (
                          <li key={i} className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-green-500 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Country dropdown — shown when selected package has geo restriction */}
          {currentStage === 0 && (() => {
            const pkg = packages.find(p => p.id === selectedPackage);
            if (!pkg?.geo_restriction?.allowed_countries?.length) return null;
            return (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Country <span className="text-red-400 ml-0.5">*</span>
                </label>
                <select
                  required
                  value={formData.country || ''}
                  onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                >
                  <option value="">Select your country…</option>
                  {COUNTRY_OPTIONS.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                {formData.country && !pkg.geo_restriction.allowed_countries.includes(formData.country) && (
                  <p className="text-xs text-red-500 mt-1">
                    {pkg.geo_restriction.error_message || 'This membership is not available in your country'}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {(activeStage?.fields || []).map(field => (
              <div key={field.key}>
                {field.type !== 'checkbox' && (
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                )}
                {renderField(field)}
              </div>
            ))}

            {/* Marketing opt-in and privacy policy on the last stage */}
            {isLastStage && settings?.marketing_opt_in_label && (
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={e => setMarketingOptIn(e.target.checked)}
                  className="rounded mt-0.5"
                />
                <span className="text-sm text-slate-600">{settings.marketing_opt_in_label}</span>
              </label>
            )}

            {isLastStage && settings?.privacy_policy_url && (
              <p className="text-xs text-slate-400">
                By signing up, you agree to our{' '}
                <a href={settings.privacy_policy_url} target="_blank" rel="noopener noreferrer" className="underline">
                  Privacy Policy
                </a>
              </p>
            )}

            {/* Navigation buttons */}
            <div className={`flex gap-3 pt-1 ${currentStage > 0 ? 'flex-row' : ''}`}>
              {currentStage > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              {isLastStage ? (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: primary }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: primary }}
                >
                  Next
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <a href="/signin" className="font-medium hover:underline" style={{ color: primary }}>
                Sign in
              </a>
            </p>
          </div>
        </div>

        <div className="text-center mt-4">
          <a href="/" className="text-sm text-slate-400 hover:text-slate-600">
            &larr; Back to site
          </a>
        </div>
      </div>
    </div>
  );
}
