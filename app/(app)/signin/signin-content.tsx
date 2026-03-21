'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';

export default function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Prefill email from query param
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, [searchParams]);

  const siteId = searchParams.get('siteId');
  const aiOnboarding = searchParams.get('aiOnboarding');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError('Incorrect email or password');
      setLoading(false);
      return;
    }

    // Success - redirect appropriately
    if (aiOnboarding) {
      router.push('/onboarding?resumeAi=true');
    } else if (siteId) {
      router.push(`/editor?siteId=${siteId}`);
    } else {
      router.push('/editor');
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message || 'Failed to sign in with Google');
      setLoading(false);
    }
    // On success, Supabase will handle the OAuth redirect
  };

  const handleAppleSignIn = async () => {
    setError('');
    setLoading(true);
    const { error } = await signInWithApple();
    if (error) {
      setError(error.message || 'Failed to sign in with Apple');
      setLoading(false);
    }
    // On success, Supabase will handle the OAuth redirect
  };


  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-3xl font-black text-white mb-2">Sign In</h1>
          <p className="text-slate-300 mb-8">Access your existing account</p>

          <form onSubmit={handleSignIn} className="space-y-6">
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
                autoFocus={!email}
                disabled={!!searchParams.get('email')}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:border-white/50 disabled:opacity-60 transition-colors"
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
                autoFocus={!!email}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:border-white/50 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold rounded-lg transition-colors"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/20"></div>
              <span className="flex-shrink-0 mx-4 text-slate-300 text-sm">Or</span>
              <div className="flex-grow border-t border-white/20"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full px-4 py-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-bold rounded-lg transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                <path d="M1 1h22v22H1z" fill="none"/>
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={handleAppleSignIn}
              disabled={loading}
              className="w-full px-4 py-3 bg-black hover:bg-black/80 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.641-.026 2.669-1.48 3.633-2.925 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.484-4.628 2.597-4.697-2.002-3.09-5.143-3.167-6.155-3.167l-.001.002zM15.82 4.14C16.891 2.871 17.587 1.054 17.387-.1c-1.04.05-2.954.7-4.067 1.956-1.01 1.121-1.84 3.033-1.583 4.811 1.205.091 2.96-.64 4.084-2.527z" />
              </svg>
              Continue with Apple
            </button>
          </form>

          <p className="text-center mt-4">
            <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-sm text-slate-400 hover:text-slate-300">
              Forgot your password?
            </Link>
          </p>

          <p className="text-center text-slate-400 text-sm mt-4">
            Don't have an account?{' '}
            <Link href={`/signup${email ? `?email=${encodeURIComponent(email)}` : ''}${aiOnboarding ? `${email ? '&' : '?'}aiOnboarding=true` : ''}`} className="text-red-400 hover:text-red-300">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
