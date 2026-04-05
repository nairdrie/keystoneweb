'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Eye, EyeOff, Loader2, Check } from 'lucide-react';

interface FormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface Package {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: string;
  features: string[];
}

interface MemberSignUpPageProps {
  siteId: string;
  siteName?: string;
  palette: Record<string, string>;
  branding?: Record<string, any>;
}

export default function MemberSignUpPage({ siteId, siteName, palette, branding }: MemberSignUpPageProps) {
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
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
        setFormFields(settingsData.settings?.signup_form_fields || [
          { key: 'name', label: 'Full Name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'password', label: 'Password', type: 'password', required: true },
        ]);
        setPackages(packagesData.packages || []);

        // Auto-select first package if only one
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Separate core fields from custom fields
      const { name, email, password, ...customFields } = formData;

      const res = await fetch('/api/membership/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          email,
          password,
          name,
          packageId: selectedPackage || null,
          customFields,
          marketingOptIn,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign up failed');
        return;
      }

      setSuccess(true);

      // If paid package selected, redirect to checkout
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-8">
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

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Package selection */}
          {packages.length > 1 && (
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {formFields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {field.type === 'password' ? (
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={field.required}
                      minLength={8}
                      value={formData[field.key] || ''}
                      onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
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
                ) : field.type === 'select' && field.options ? (
                  <select
                    required={field.required}
                    value={formData[field.key] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  >
                    <option value="">Select...</option>
                    {field.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    required={field.required}
                    value={formData[field.key] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  />
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData[field.key] === 'true'}
                      onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.checked ? 'true' : 'false' }))}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-600">{field.label}</span>
                  </label>
                ) : (
                  <input
                    type={field.type || 'text'}
                    required={field.required}
                    value={formData[field.key] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  />
                )}
              </div>
            ))}

            {/* Marketing opt-in */}
            {settings?.marketing_opt_in_label && (
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

            {/* Privacy policy */}
            {settings?.privacy_policy_url && (
              <p className="text-xs text-slate-400">
                By signing up, you agree to our{' '}
                <a href={settings.privacy_policy_url} target="_blank" rel="noopener noreferrer" className="underline">
                  Privacy Policy
                </a>
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: primary }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
            </button>
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
