'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/db/supabase';

export default function CompleteProfileContent() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/signup');
        return;
      }

      // Record consent stored before OAuth redirect
      const tosAccepted = localStorage.getItem('ks_tos_accepted');
      if (tosAccepted === 'true') {
        const marketingOptIn = localStorage.getItem('ks_marketing_opt_in') === 'true';
        localStorage.removeItem('ks_tos_accepted');
        localStorage.removeItem('ks_marketing_opt_in');
        try {
          await fetch('/api/auth/record-consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tosAccepted: true, marketingOptIn }),
          });
        } catch {
          // Non-blocking
        }
      }

      // Check if name was provided by OAuth provider (Google sends full_name or name)
      const existingName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.given_name;

      if (existingName) {
        // Already have a name, skip this step
        router.replace('/editor');
        return;
      }

      setLoading(false);
    };

    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { name: name.trim() },
      });

      if (updateError) {
        setError(updateError.message || 'Failed to save name');
        return;
      }

      router.replace('/editor');
    } catch (err: any) {
      setError(err.message || 'Failed to save name');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-3xl font-black text-white mb-2">One Last Step</h1>
          <p className="text-slate-300 mb-8">What should we call you?</p>

          <form onSubmit={handleSubmit} className="space-y-6">
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

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white font-bold rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
