'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import KeystoneLogoImage from '@/assets/logo/keystone-logo.png';
import { OPS_URL } from '@/lib/env/domain';

type InviteState =
  | { status: 'loading' }
  | { status: 'valid'; personal_email: string; contact_email: string }
  | { status: 'invalid'; error: string }
  | { status: 'done' };

export default function AgentSignupPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<InviteState>({ status: 'loading' });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/auth/agent-invite/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.valid) {
          setInvite({
            status: 'valid',
            personal_email: json.personal_email,
            contact_email: json.contact_email,
          });
        } else {
          setInvite({ status: 'invalid', error: json.error });
        }
      })
      .catch(() => setInvite({ status: 'invalid', error: 'Failed to load invite.' }));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    setError('');

    const res = await fetch('/api/auth/agent-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, name }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || 'Something went wrong.');
      setSubmitting(false);
      return;
    }

    setInvite({ status: 'done' });
    // Redirect to ops after a moment
    setTimeout(() => router.push(OPS_URL), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-20">
            <Image src={KeystoneLogoImage} alt="Keystone" fill className="object-contain" priority />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Your Agent Account</h1>
        </div>

        {invite.status === 'loading' && (
          <p className="text-center text-gray-500 text-sm">Validating invite…</p>
        )}

        {invite.status === 'invalid' && (
          <div className="rounded-xl border border-red-800 bg-red-950/30 p-6 text-center">
            <p className="text-red-400 font-medium">{invite.error}</p>
            <p className="mt-2 text-sm text-gray-500">
              Contact your administrator for a new invite link.
            </p>
          </div>
        )}

        {invite.status === 'done' && (
          <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-6 text-center">
            <p className="text-emerald-400 font-medium text-lg">Account created!</p>
            <p className="mt-2 text-sm text-gray-400">Redirecting to ops dashboard…</p>
          </div>
        )}

        {invite.status === 'valid' && (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4"
          >
            {/* Info panel */}
            <div className="rounded-lg bg-gray-800/50 px-4 py-3 space-y-1 text-sm">
              <p className="text-gray-400">
                Login email:{' '}
                <span className="text-white font-mono">{invite.personal_email}</span>
              </p>
              <p className="text-gray-400">
                Contact email:{' '}
                <span className="text-violet-400 font-mono">{invite.contact_email}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
