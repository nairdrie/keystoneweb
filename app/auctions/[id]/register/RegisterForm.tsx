'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CreditCard } from 'lucide-react';

export default function RegisterForm({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auctions/${auctionId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Registration failed');
      if (j.alreadyRegistered) {
        router.push(j.redirectTo);
        return;
      }
      if (j.checkoutUrl) {
        window.location.assign(j.checkoutUrl);
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="Jane Smith"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="At least 8 characters"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none"
        />
        <p className="text-[11px] text-slate-500 mt-1">If you&apos;ve registered before, enter your existing password.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-700 disabled:text-amber-200 text-slate-950 font-bold px-4 py-3 rounded-lg transition shadow-lg shadow-amber-500/20"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
        {loading ? 'Connecting to Stripe…' : 'Continue to card capture'}
      </button>

      <p className="text-[11px] text-center text-slate-500">
        Secured by Stripe · we never see your card details
      </p>
    </form>
  );
}
