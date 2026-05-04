'use client';

import { X, UserCircle } from 'lucide-react';
import { useState } from 'react';
import { OPS_URL } from '@/lib/env/domain';

export default function ImpersonationBanner({ userEmail }: { userEmail: string }) {
  const [loading, setLoading] = useState(false);

  async function stopImpersonating() {
    setLoading(true);
    try {
      const res = await fetch('/api/ops/impersonate', {
        method: 'DELETE',
      });
      if (res.ok) {
        // Redirect back to ops dashboard
        window.location.href = `${OPS_URL}/users`;
      }
    } catch (err) {
      console.error(err);
      alert('Failed to stop impersonation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 bg-amber-600 text-white px-4 py-2 rounded-b-xl shadow-lg">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <UserCircle className="w-4 h-4" />
        <span>You are currently impersonating <span className="underline">{userEmail}</span></span>
      </div>
      <button
        onClick={stopImpersonating}
        disabled={loading}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-bold transition-colors"
      >
        {loading ? 'Stopping...' : 'Stop Impersonating'}
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
