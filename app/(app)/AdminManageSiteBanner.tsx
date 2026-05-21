'use client';

import { X, Wrench } from 'lucide-react';
import { useState } from 'react';
import { OPS_URL } from '@/lib/env/domain';

interface AdminManageSiteBannerProps {
  siteSlug: string | null;
  siteId: string;
  ownerEmail: string | null;
}

export default function AdminManageSiteBanner({ siteSlug, siteId, ownerEmail }: AdminManageSiteBannerProps) {
  const [loading, setLoading] = useState(false);

  async function stopManaging() {
    setLoading(true);
    try {
      const res = await fetch('/api/ops/manage-site', {
        method: 'DELETE',
      });
      if (res.ok) {
        window.location.href = `${OPS_URL}/users`;
      }
    } catch (err) {
      console.error(err);
      alert('Failed to stop managing');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 bg-indigo-600 text-white px-4 py-2 rounded-b-xl shadow-lg">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Wrench className="w-4 h-4" />
        <span>
          Admin Mode — managing{' '}
          <span className="underline">{siteSlug || siteId.slice(0, 8)}</span>
          {ownerEmail && (
            <>
              {' '}owned by <span className="underline">{ownerEmail}</span>
            </>
          )}
        </span>
      </div>
      <button
        onClick={stopManaging}
        disabled={loading}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-bold transition-colors"
      >
        {loading ? 'Stopping…' : 'Stop Managing'}
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
