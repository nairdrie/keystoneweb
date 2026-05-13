'use client';

import { useState, useEffect } from 'react';
import { useMember, MemberData } from '../membership/MemberProvider';
import { useEditorContext } from '@/lib/editor-context';
import { Mail, Package, Calendar, LogOut, Pencil, Check, X, KeyRound, ChevronDown, ChevronUp } from 'lucide-react';
import Reveal from '@/app/components/Reveal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfileBlockProps {
  id: string;
  data: any;
  isEditMode: boolean;
  palette: Record<string, string>;
  updateContent: (key: string, value: any) => void;
}

// ─── Fetch form field label map ───────────────────────────────────────────────
// Returns { 'custom_1234': 'City', 'custom_5678': 'Phone', ... }
async function fetchFieldLabels(siteId: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`/api/membership/settings?siteId=${siteId}`);
    if (!res.ok) return {};
    const data = await res.json();
    const raw = data.settings?.signup_form_fields;
    let fields: Array<{ key: string; label: string }> = [];
    if (Array.isArray(raw)) {
      fields = raw;
    } else if (raw?.stages) {
      fields = (raw.stages as any[]).flatMap((s: any) => s.fields || []);
    }
    return Object.fromEntries(fields.map((f: any) => [f.key, f.label]));
  } catch {
    return {};
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function UserProfileBlock({ id, data, isEditMode, palette }: UserProfileBlockProps) {
  const memberCtx = useMember();
  const context = useEditorContext();
  const siteId = context?.siteId;

  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!siteId) return;
    fetchFieldLabels(siteId).then(setFieldLabels);
  }, [siteId]);

  if (isEditMode) {
    return <EditModePreview palette={palette} />;
  }

  if (!memberCtx?.member) {
    // Should not normally render (should be inside a gate), but handle gracefully
    return null;
  }

  return <ProfileView member={memberCtx.member} signOut={memberCtx.signOut} palette={palette} fieldLabels={fieldLabels} />;
}

// ─── Edit Mode Preview ────────────────────────────────────────────────────────

function EditModePreview({ palette }: { palette: Record<string, string> }) {
  const primary = palette.primary || '#374151';
  return (
    <div className="py-8 px-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0"
            style={{ backgroundColor: primary }}
          >
            PM
          </div>
          <div>
            <div className="h-5 w-36 bg-slate-200 rounded mb-2 animate-pulse" />
            <div className="h-3.5 w-48 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-24 bg-violet-100 rounded mt-1 animate-pulse" />
          </div>
        </div>
        <div className="space-y-3 mb-6">
          <div className="h-3 w-full bg-slate-100 rounded" />
          <div className="h-3 w-4/5 bg-slate-100 rounded" />
        </div>
        <p className="text-xs text-slate-400 text-center italic">
          User Profile block — displays the signed-in member's information
        </p>
      </div>
    </div>
  );
}

// ─── Live Profile View ────────────────────────────────────────────────────────

function ProfileView({ member, signOut, palette, fieldLabels }: { member: MemberData; signOut: () => Promise<void>; palette: Record<string, string>; fieldLabels: Record<string, string> }) {
  const primary = palette.primary || '#374151';
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(member.name || '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const [showCustomFields, setShowCustomFields] = useState(false);

  const initials = member.name
    ? member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : member.email[0].toUpperCase();

  const customFieldEntries = Object.entries(member.customFields || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );

  // ── Save name ─────────────────────────────────────────────────────────────
  const saveName = async () => {
    if (!nameValue.trim()) { setNameError('Name cannot be empty.'); return; }
    setNameSaving(true);
    setNameError('');
    try {
      const res = await fetch('/api/membership/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setNameError(d.error || 'Failed to update name.');
      } else {
        setEditingName(false);
      }
    } catch {
      setNameError('Network error. Please try again.');
    } finally {
      setNameSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const changePassword = async () => {
    if (!currentPw || !newPw) { setPwError('Please fill in all fields.'); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwSaving(true);
    setPwError('');
    try {
      const res = await fetch('/api/membership/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (!res.ok) {
        const d = await res.json();
        setPwError(d.error || 'Failed to change password.');
      } else {
        setPwSuccess(true);
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        setTimeout(() => { setPwSuccess(false); setShowPasswordForm(false); }, 2000);
      }
    } catch {
      setPwError('Network error. Please try again.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <Reveal className="py-8 px-4 max-w-2xl mx-auto space-y-4">

      {/* ── Profile card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Avatar + name + email */}
        <div className="flex items-start gap-4 p-6 border-b border-slate-100">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ backgroundColor: primary }}
          >
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt={member.name || ''} className="w-14 h-14 rounded-full object-cover" />
            ) : initials}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  className="text-lg font-semibold border-b-2 border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent"
                  autoFocus
                />
                <button onClick={saveName} disabled={nameSaving} className="text-green-600 hover:text-green-700 shrink-0">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setEditingName(false); setNameValue(member.name || ''); }} className="text-slate-400 hover:text-slate-600 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-slate-900 truncate">{member.name || 'Member'}</p>
                <button onClick={() => { setEditingName(true); setNameValue(member.name || ''); }} className="text-slate-400 hover:text-slate-600 shrink-0" title="Edit name">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {member.email}
            </p>
            {member.package && (
              <p className="text-xs font-medium text-violet-600 mt-1 flex items-center gap-1">
                <Package className="w-3 h-3" />
                {member.package.name}
              </p>
            )}
          </div>
        </div>

        {/* Membership details */}
        <div className="px-6 py-4 space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Member since</span>
            <span className="text-slate-700 font-medium">
              {new Date(member.signedUpAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          {member.subscriptionStatus && member.subscriptionStatus !== 'none' && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subscription</span>
              <span className={`font-medium capitalize ${member.subscriptionStatus === 'active' ? 'text-green-600' : 'text-amber-600'}`}>
                {member.subscriptionStatus}
              </span>
            </div>
          )}
          {member.currentPeriodEnd && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Renews
              </span>
              <span className="text-slate-700 font-medium">
                {new Date(member.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Custom fields ─────────────────────────────────────────────────── */}
      {customFieldEntries.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowCustomFields(s => !s)}
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <span>My Information</span>
            {showCustomFields ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showCustomFields && (
            <div className="px-6 pb-4 space-y-2.5 border-t border-slate-100 pt-4">
              {customFieldEntries.map(([key, val]) => (
                <div key={key} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-slate-500 shrink-0">{fieldLabels[key] || key.replace(/^custom_\d+$/, 'Field').replace(/_/g, ' ')}</span>
                  <span className="text-slate-700 text-right">{String(val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Security ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowPasswordForm(s => !s)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-400" />
            Change Password
          </span>
          {showPasswordForm ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showPasswordForm && (
          <div className="px-6 pb-5 border-t border-slate-100 pt-4 space-y-3">
            {pwSuccess ? (
              <p className="text-sm text-green-600 font-medium flex items-center gap-2">
                <Check className="w-4 h-4" /> Password updated successfully!
              </p>
            ) : (
              <>
                {(['Current password', 'New password', 'Confirm new password'] as const).map((label, i) => {
                  const val = i === 0 ? currentPw : i === 1 ? newPw : confirmPw;
                  const setter = i === 0 ? setCurrentPw : i === 1 ? setNewPw : setConfirmPw;
                  return (
                    <div key={label}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                      <input
                        type="password"
                        value={val}
                        onChange={e => setter(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  );
                })}
                {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                <button
                  onClick={changePassword}
                  disabled={pwSaving}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: primary }}
                >
                  {pwSaving ? 'Saving…' : 'Update Password'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Sign out ──────────────────────────────────────────────────────── */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </Reveal>
  );
}
