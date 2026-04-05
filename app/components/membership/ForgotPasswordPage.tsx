'use client';

import { useState } from 'react';
import { KeyRound, Loader2, Check, ArrowLeft } from 'lucide-react';

interface ForgotPasswordPageProps {
  siteId: string;
  siteName?: string;
  palette: Record<string, string>;
  branding?: Record<string, any>;
}

export default function ForgotPasswordPage({ siteId, siteName, palette, branding }: ForgotPasswordPageProps) {
  const primary = palette.primary || '#374151';

  // Check if this is a reset action (has token in URL)
  const isResetMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('action') === 'reset';
  const resetToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null;

  if (isResetMode && resetToken) {
    return <ResetPasswordForm siteId={siteId} token={resetToken} palette={palette} primary={primary} branding={branding} />;
  }

  return <ForgotPasswordForm siteId={siteId} siteName={siteName} palette={palette} primary={primary} branding={branding} />;
}

function ForgotPasswordForm({
  siteId, siteName, palette, primary, branding,
}: {
  siteId: string; siteName?: string; palette: Record<string, string>; primary: string; branding?: Record<string, any>;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/membership/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong');
        return;
      }

      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-50">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h1>
            <p className="text-slate-600 mb-6">
              If an account exists with that email, we&apos;ve sent a password reset link.
            </p>
            <a href="/signin" className="text-sm font-medium hover:underline" style={{ color: primary }}>
              Back to Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
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
                <KeyRound className="w-6 h-6" style={{ color: primary }} />
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your email to receive a reset link</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: primary }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/signin" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordForm({
  siteId, token, palette, primary,
}: {
  siteId: string; token: string; palette: Record<string, string>; primary: string;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/membership/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, token, newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-50">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Password Reset</h1>
            <p className="text-slate-600 mb-6">Your password has been updated. You can now sign in.</p>
            <a
              href="/signin"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your new password</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm"
                placeholder="Minimum 8 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm"
                placeholder="Re-enter password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: primary }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
