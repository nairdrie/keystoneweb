'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/context';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  onSuccess?: () => void;
}

type Step = 'email' | 'password' | 'profile' | 'signin';

function getPasswordStrength(password: string): { level: number; text: string; color: string } {
  if (password.length === 0) return { level: 0, text: '', color: '' };
  if (password.length < 6) return { level: 1, text: 'Weak', color: 'text-red-600' };
  if (password.length < 10) return { level: 2, text: 'Fair', color: 'text-yellow-600' };
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) {
    return { level: 3, text: 'Strong', color: 'text-green-600' };
  }
  return { level: 2, text: 'Fair', color: 'text-yellow-600' };
}

export default function SignUpModal({ isOpen, onClose, siteId, onSuccess }: SignUpModalProps) {
  const { signUp, signIn } = useAuth();
  
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accountExists, setAccountExists] = useState(false);

  if (!isOpen) return null;

  const passwordStrength = getPasswordStrength(password);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email) {
      setError('Email is required');
      setLoading(false);
      return;
    }

    try {
      // Check if account exists in database
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setError('Failed to check email');
        setLoading(false);
        return;
      }

      const { exists } = await res.json();
      setAccountExists(exists);
      setStep(exists ? 'signin' : 'password');
    } catch (err) {
      console.error('Email check error:', err);
      setError('Failed to check email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!password) {
      setError('Password is required');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { error: signUpError } = await signUp(email, password);
      if (signUpError) {
        // User-friendly error for signup failures
        const message = signUpError.message?.toLowerCase().includes('already') 
          ? 'Incorrect email or password' 
          : signUpError.message;
        setError(message);
        setLoading(false);
        return;
      }
      setStep('profile');
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Profile information is optional, just proceed to editor
      // Don't call onClose() here - let handleSignUpSuccess manage modal closure
      // to avoid redirect to onboarding
      onSuccess?.();
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!password) {
      setError('Password is required');
      setLoading(false);
      return;
    }

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        // User-friendly error message for incorrect credentials
        setError('Incorrect email or password');
        setLoading(false);
        return;
      }
      // Don't call onClose() - let handleSignUpSuccess manage modal closure
      // to avoid redirect to onboarding
      onSuccess?.();
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle between signup and signin (when on password screen)
  const handleToggleMode = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    // Flip the accountExists flag to show the other password form
    setAccountExists(!accountExists);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-xl">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <svg
            viewBox="0 0 64 64"
            className="w-16 h-16"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="keystoneRed" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#dc2626', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#b91c1c', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            
            {/* Keystone Shape */}
            <path
              d="M 32 6 L 50 18 L 46 48 L 18 48 L 14 18 Z"
              fill="url(#keystoneRed)"
              stroke="#991b1b"
              strokeWidth="0.5"
            />
            
            {/* Maple Leaf */}
            <image href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 2 L20 12 L30 12 L23 18 L26 28 L16 22 L6 28 L9 18 L2 12 L12 12 Z' fill='white'/%3E%3C/svg%3E" x="20" y="16" width="24" height="24" />
          </svg>
        </div>

        {/* CTA Heading */}
        <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
          Customize Your Website
        </h2>
        <p className="text-slate-600 text-center mb-6">
          {step === 'signin' ? (
            'Log in to your account to unlock full customization and publish your site'
          ) : (
            'Create an account to unlock full customization and publish your site'
          )}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent focus:bg-white disabled:opacity-50 text-slate-900 placeholder-slate-600"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 2: Password (New Account) */}
        {step === 'password' && !accountExists && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Email (pre-filled, read-only) */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-600 opacity-60"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent focus:bg-white disabled:opacity-50 text-slate-900 placeholder-slate-600"
                placeholder="••••••••"
              />
              {password && (
                <p className={`text-xs mt-1 ${passwordStrength.color}`}>
                  Strength: {passwordStrength.text}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent focus:bg-white disabled:opacity-50 text-slate-900 placeholder-slate-600"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            {/* Already have account? */}
            <button
              type="button"
              onClick={handleToggleMode}
              className="w-full text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Already have an account? Log in
            </button>
          </form>
        )}

        {/* Step 2b: Sign In (Existing Account) */}
        {step === 'signin' && (
          <form onSubmit={handleSignInSubmit} className="space-y-4">
            {/* Email (pre-filled, read-only) */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-600 opacity-60"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoFocus
                className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent focus:bg-white disabled:opacity-50 text-slate-900 placeholder-slate-600"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={() => setError('Password reset not yet implemented')}
              className="w-full text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Forgot Password?
            </button>

            {/* Don't have account? Create one */}
            <button
              type="button"
              onClick={handleToggleMode}
              className="w-full text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Don't have an account? Create one
            </button>
          </form>
        )}

        {/* Step 3: Profile */}
        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              Complete your profile (all fields are optional)
            </p>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent focus:bg-white disabled:opacity-50 text-slate-900 placeholder-slate-600"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent focus:bg-white disabled:opacity-50 text-slate-900 placeholder-slate-600"
                placeholder="Acme Corporation"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent focus:bg-white disabled:opacity-50 text-slate-900 placeholder-slate-600"
                placeholder="(555) 123-4567"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Setting Up...' : 'Start Editing'}
            </button>
          </form>
        )}

        {/* Back Button */}
        {(step === 'password' || step === 'signin') && (
          <button
            onClick={() => {
              setStep('email');
              setPassword('');
              setConfirmPassword('');
              setError(null);
            }}
            className="w-full mt-4 text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            ← Back to Email
          </button>
        )}
      </div>
    </div>
  );
}
