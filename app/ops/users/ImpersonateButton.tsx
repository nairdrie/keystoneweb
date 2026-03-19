'use client';

import { useState } from 'react';
import { UserCircle } from 'lucide-react';

interface ImpersonateButtonProps {
  userId: string;
  userEmail: string;
}

export default function ImpersonateButton({ userId, userEmail }: ImpersonateButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleImpersonate() {
    if (!confirm(`Are you sure you want to login as ${userEmail}?`)) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/ops/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        // Redirect to the main app dashboard (or onboarding)
        window.location.href = '/dashboard';
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleImpersonate}
      disabled={loading}
      title={`Login as ${userEmail}`}
      className="inline-flex items-center gap-1.5 rounded bg-gray-800 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
    >
      <UserCircle className="w-3.5 h-3.5" />
      {loading ? 'Logging in...' : 'Login As'}
    </button>
  );
}
