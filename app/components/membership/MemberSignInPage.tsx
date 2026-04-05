'use client';

import { useState } from 'react';
import { LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';

interface MemberSignInPageProps {
  siteId: string;
  siteName?: string;
  palette: Record<string, string>;
  branding?: Record<string, any>;
}

export default function MemberSignInPage({ siteId, siteName, palette, branding }: MemberSignInPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check for verification success
  const isVerified = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('verified') === 'true';

  const primary = palette.primary || '#374151';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/membership/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, email, password }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign in failed');
        return;
      }

      // Redirect to member page or returnTo URL
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get('returnTo') || '/member';
      window.location.href = returnTo;
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div
              className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: `${primary}15` }}
            >
              <LogIn className="w-6 h-6" style={{ color: primary }} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sign In</h1>
            {siteName && <p className="text-sm text-slate-500 mt-1">to {siteName}</p>}
          </div>

          {isVerified && (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              Email verified successfully! You can now sign in.
            </div>
          )}

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
                style={{ '--tw-ring-color': primary } as any}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ '--tw-ring-color': primary } as any}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: primary }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <a href="/forgot-password" className="text-sm hover:underline" style={{ color: primary }}>
              Forgot your password?
            </a>
            <p className="text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <a href="/signup" className="font-medium hover:underline" style={{ color: primary }}>
                Sign up
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
