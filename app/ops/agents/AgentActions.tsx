'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// When agentId is provided, renders edit/deactivate controls.
// Without agentId, renders the invite form.
export default function AgentActions({
  agentId,
  agentEmail,
  contactEmail,
}: {
  agentId?: string;
  agentEmail?: string;
  contactEmail?: string;
}) {
  const router = useRouter();

  // ── Invite form ──────────────────────────────────────────────────────────
  const [personalEmail, setPersonalEmail] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url?: string; error?: string } | null>(null);

  // ── Edit contact email ───────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editContact, setEditContact] = useState(contactEmail ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Deactivate ───────────────────────────────────────────────────────────
  const [deactivating, setDeactivating] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch('/api/ops/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personal_email: personalEmail, contact_email: newContactEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteResult({ error: json.error });
      } else {
        setInviteResult({ url: json.invite_url });
        setPersonalEmail('');
        setNewContactEmail('');
        router.refresh();
      }
    } catch {
      setInviteResult({ error: 'Network error' });
    } finally {
      setInviting(false);
    }
  }

  async function handleSaveContact() {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/ops/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_contact_email: editContact }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!confirm(`Remove agent role from ${agentEmail}? They will lose ops access.`)) return;
    setDeactivating(true);
    try {
      await fetch(`/api/ops/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_agent: false }),
      });
      router.refresh();
    } finally {
      setDeactivating(false);
    }
  }

  // ── Invite form (no agentId) ─────────────────────────────────────────────
  if (!agentId) {
    return (
      <form onSubmit={handleInvite} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Personal email (login)</label>
            <input
              type="email"
              required
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="agent@gmail.com"
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Contact email (@keystoneweb.ca)</label>
            <input
              type="email"
              required
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              placeholder="sales@keystoneweb.ca"
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={inviting}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
          {inviteResult?.error && (
            <span className="text-sm text-red-400">{inviteResult.error}</span>
          )}
          {inviteResult?.url && (
            <span className="text-sm text-emerald-400">
              Invite sent! Link: <span className="font-mono text-xs break-all">{inviteResult.url}</span>
            </span>
          )}
        </div>
      </form>
    );
  }

  // ── Agent row controls (has agentId) ─────────────────────────────────────
  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <>
          <input
            type="email"
            value={editContact}
            onChange={(e) => setEditContact(e.target.value)}
            className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white font-mono w-52 focus:outline-none"
          />
          <button
            onClick={handleSaveContact}
            disabled={saving}
            className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setEditContact(contactEmail ?? ''); }}
            className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          {saveError && <span className="text-xs text-red-400">{saveError}</span>}
        </>
      ) : (
        <>
          <button
            onClick={() => setEditing(true)}
            className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:text-white transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleDeactivate}
            disabled={deactivating}
            className="rounded bg-red-900/40 px-2 py-1 text-xs text-red-400 hover:bg-red-900/60 disabled:opacity-50 transition-colors"
          >
            {deactivating ? '…' : 'Deactivate'}
          </button>
        </>
      )}
    </div>
  );
}
