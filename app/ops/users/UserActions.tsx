'use client';

import { useState } from 'react';
import { UserCircle, Ban, Unlock, CreditCard, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserActionsProps {
  userId: string;
  userEmail: string;
  isBanned: boolean;
  currentPlan: string;
}

export default function UserActions({ userId, userEmail, isBanned, currentPlan }: UserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPlanMenu, setShowShowPlanMenu] = useState(false);

  async function handleImpersonate() {
    if (!confirm(`Are you sure you want to login as ${userEmail}?`)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ops/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) window.location.href = 'https://keystoneweb.ca';
      else alert('Failed to impersonate');
    } finally {
      setLoading(false);
    }
  }

  async function toggleBan() {
    const action = isBanned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} ${userEmail}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_banned: !isBanned }),
      });
      if (res.ok) router.refresh();
      else alert(`Failed to ${action}`);
    } finally {
      setLoading(false);
    }
  }

  async function changePlan(newPlan: string) {
    if (!confirm(`Change ${userEmail} to ${newPlan} plan?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });
      if (res.ok) {
        setShowShowPlanMenu(false);
        router.refresh();
      } else alert('Failed to update plan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Impersonate */}
      <button
        onClick={handleImpersonate}
        disabled={loading}
        className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        title="Login As"
      >
        <UserCircle className="w-4 h-4" />
      </button>

      {/* Ban/Unban */}
      <button
        onClick={toggleBan}
        disabled={loading}
        className={`p-1.5 rounded-md transition-colors ${
          isBanned 
            ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50' 
            : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
        }`}
        title={isBanned ? 'Unban User' : 'Ban User'}
      >
        {isBanned ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
      </button>

      {/* Plan Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowShowPlanMenu(!showPlanMenu)}
          disabled={loading}
          className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center gap-1"
          title="Change Plan"
        >
          <CreditCard className="w-4 h-4" />
          <ChevronDown className="w-3 h-3" />
        </button>

        {showPlanMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowShowPlanMenu(false)} />
            <div className="absolute right-0 mt-2 w-32 rounded-md bg-gray-800 border border-gray-700 shadow-xl z-20 overflow-hidden">
              {['Free', 'Basic', 'Pro'].map((p) => (
                <button
                  key={p}
                  onClick={() => changePlan(p)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors ${
                    currentPlan.toLowerCase() === p.toLowerCase() ? 'text-emerald-400 font-bold' : 'text-gray-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
