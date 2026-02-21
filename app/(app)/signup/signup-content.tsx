'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';

export default function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect to editor after signup
  const siteId = searchParams.get('siteId');

  // Prefill email from query param
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, [searchParams]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if email exists
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const { exists } = await res.json();

      if (exists) {
        // Redirect to signin with email prefilled
        router.push(`/signin?email=${encodeURIComponent(email)}${siteId ? `&siteId=${siteId}` : ''}`);
      } else {
        // Move to password step for new account
        setStep('password');
      }
    } catch (err) {
      setError('Failed to check email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signUp(email, password, { name });

      // Success - redirect to editor
      if (siteId) {
        router.push(`/editor?siteId=${siteId}`);
      } else {
        router.push('/editor');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {step === 'email' ? (
            <>
              <h1 className="text-3xl font-black text-white mb-2">Create Account</h1>
              <p className="text-slate-300 mb-8">Enter your email to get started</p>

              <form onSubmit={handleEmailSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:border-white/50 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                >
                  {loading ? 'Checking...' : 'Continue'}
                </button>
              </form>

              <p className="text-center text-slate-400 text-sm mt-6">
                Already have an account?{' '}
                <Link href={`/signin${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-blue-400 hover:text-blue-300">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black text-white mb-2">Create Your Password</h1>
              <p className="text-slate-300 mb-8 text-sm">{email}</p>

              <form onSubmit={handleSignUp} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    autoFocus
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:border-white/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:border-white/50 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>

              <button
                onClick={() => {
                  setStep('email');
                  setError('');
                }}
                className="w-full mt-4 text-slate-400 hover:text-slate-300 text-sm"
              >
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
