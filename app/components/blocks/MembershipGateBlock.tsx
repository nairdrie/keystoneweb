'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useEditorContext, BlockData, BlockDataProvider } from '@/lib/editor-context';
import { useMember } from '../membership/MemberProvider';
import {
  Lock, Settings, Users, Plus, ArrowUp, ArrowDown, Trash2, Crown,
  Package, LogIn, ExternalLink, ChevronDown, ChevronUp, ShieldCheck,
} from 'lucide-react';
import { BLOCK_COMPONENTS, AVAILABLE_BLOCKS } from './block-registry';
import { getBlockDisplayLabel, getBlockIcon } from './block-icons';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MembershipGateBlockProps {
  id: string;
  data: any;
  isEditMode: boolean;
  palette: Record<string, string>;
  updateContent: (key: string, value: any) => void;
}

interface MemberPackage {
  id: string;
  name: string;
  price_cents: number;
  billing_interval: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MembershipGateBlock({ id, data, isEditMode, palette, updateContent }: MembershipGateBlockProps) {
  const context = useEditorContext();
  const memberCtx = useMember();

  const childBlocks: BlockData[] = Array.isArray(data?.blocks) ? data.blocks : [];
  const gateTitle: string = data?.gateTitle || 'Members Only';
  const gateMessage: string = data?.gateMessage || 'This content is available to members only. Sign in or create an account to access it.';
  const ctaLabel: string = data?.ctaLabel || 'Sign In / Sign Up';
  const allowedPackageIds: string[] = Array.isArray(data?.allowedPackageIds) ? data.allowedPackageIds : [];

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (isEditMode) {
    return (
      <GateEditView
        childBlocks={childBlocks}
        gateTitle={gateTitle}
        gateMessage={gateMessage}
        ctaLabel={ctaLabel}
        allowedPackageIds={allowedPackageIds}
        siteId={context?.siteId || ''}
        palette={palette}
        updateContent={updateContent}
        isEditMode={isEditMode}
        isProUser={context?.isProUser ?? false}
      />
    );
  }

  // ── Published: not authenticated ───────────────────────────────────────────
  if (!memberCtx?.member) {
    return (
      <GateView
        title={gateTitle}
        message={gateMessage}
        ctaLabel={ctaLabel}
        palette={palette}
      />
    );
  }

  const member = memberCtx.member;

  // ── Published: authenticated — check package access ────────────────────────
  if (allowedPackageIds.length > 0) {
    if (!member.packageId || !allowedPackageIds.includes(member.packageId)) {
      return (
        <GateView
          title="Upgrade Required"
          message="Your current membership plan does not include access to this content. Please upgrade your membership to view it."
          ctaLabel="View Membership Plans"
          ctaHref="/member"
          palette={palette}
        />
      );
    }
  }

  // ── Published: authenticated and authorized — render child blocks ──────────
  if (childBlocks.length === 0) return null;

  return (
    <div className="w-full">
      {childBlocks.map((block) => {
        const Component = BLOCK_COMPONENTS[block.type];
        if (!Component) return null;
        return (
          <div key={block.id} className="w-full">
            <BlockDataProvider value={block.data || {}}>
              <Component
                id={block.id}
                data={block.data || {}}
                isEditMode={false}
                palette={palette}
                updateContent={() => {}}
                block={block}
              />
            </BlockDataProvider>
          </div>
        );
      })}
    </div>
  );
}

// ─── Gate View (unauthenticated / wrong package) ─────────────────────────────

function GateView({
  title, message, ctaLabel, ctaHref, palette,
}: {
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref?: string;
  palette: Record<string, string>;
}) {
  const primary = palette.primary || '#374151';
  return (
    <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: `${primary}15` }}
      >
        <Lock className="w-8 h-8" style={{ color: primary }} />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-3">{title}</h2>
      <p className="text-slate-600 mb-6 max-w-md">{message}</p>
      <a
        href={ctaHref || '/signin'}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90"
        style={{ backgroundColor: primary }}
      >
        <LogIn className="w-4 h-4" />
        {ctaLabel}
      </a>
    </div>
  );
}

// ─── Edit Mode View ───────────────────────────────────────────────────────────

function GateEditView({
  childBlocks, gateTitle, gateMessage, ctaLabel, allowedPackageIds, siteId,
  palette, updateContent, isEditMode, isProUser,
}: {
  childBlocks: BlockData[];
  gateTitle: string;
  gateMessage: string;
  ctaLabel: string;
  allowedPackageIds: string[];
  siteId: string;
  palette: Record<string, string>;
  updateContent: (key: string, value: any) => void;
  isEditMode: boolean;
  isProUser: boolean;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [packages, setPackages] = useState<MemberPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Fetch packages when settings opens
  useEffect(() => {
    if (!showSettings || !siteId) return;
    setLoadingPackages(true);
    fetch(`/api/membership/packages?siteId=${siteId}`)
      .then(r => r.json())
      .then(d => setPackages(Array.isArray(d.packages) ? d.packages : []))
      .catch(() => setPackages([]))
      .finally(() => setLoadingPackages(false));
  }, [showSettings, siteId]);

  // ── Child block CRUD ────────────────────────────────────────────────────────

  const addChildBlock = (type: string, afterIndex?: number) => {
    const newBlock: BlockData = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      data: {},
    };
    const updated = [...childBlocks];
    if (afterIndex !== undefined) {
      updated.splice(afterIndex + 1, 0, newBlock);
    } else {
      updated.push(newBlock);
    }
    updateContent('blocks', updated);
  };

  const updateChildBlock = (blockId: string, key: string, value: any) => {
    updateContent('blocks', childBlocks.map(b =>
      b.id === blockId ? { ...b, data: { ...b.data, [key]: value } } : b
    ));
  };

  const moveChildBlock = (blockId: string, dir: 'up' | 'down') => {
    const idx = childBlocks.findIndex(b => b.id === blockId);
    if (idx === -1) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= childBlocks.length) return;
    const updated = [...childBlocks];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updateContent('blocks', updated);
  };

  const removeChildBlock = (blockId: string) => {
    updateContent('blocks', childBlocks.filter(b => b.id !== blockId));
  };

  // ── Access summary ──────────────────────────────────────────────────────────
  let accessSummary = 'All signed-in members';
  if (allowedPackageIds.length > 0 && packages.length > 0) {
    const names = packages
      .filter(p => allowedPackageIds.includes(p.id))
      .map(p => p.name);
    if (names.length > 0) accessSummary = names.join(', ');
  }

  return (
    <div className="relative border-2 border-dashed border-violet-300 rounded-xl bg-violet-50/30">

      {/* ── Gate header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-violet-200/70">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
            <Lock className="w-4.5 h-4.5 text-violet-600" style={{ width: 18, height: 18 }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-violet-900">Membership Gate</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                <ShieldCheck style={{ width: 10, height: 10 }} />
                {allowedPackageIds.length === 0 ? 'All members' : `${allowedPackageIds.length} package${allowedPackageIds.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            <p className="text-xs text-violet-600/80 mt-0.5 truncate">
              Content inside is hidden from non-members
              {allowedPackageIds.length > 0 && packages.length > 0 && ` · Access: ${accessSummary}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              showSettings
                ? 'bg-violet-200 text-violet-900'
                : 'bg-white border border-violet-200 text-violet-700 hover:bg-violet-50'
            }`}
            title="Gate settings"
          >
            <Settings style={{ width: 13, height: 13 }} />
            Settings
          </button>
          {siteId && (
            <a
              href={`/admin/membership?siteId=${siteId}#packages`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors"
            >
              <Users style={{ width: 13, height: 13 }} />
              Members
              <ExternalLink style={{ width: 11, height: 11 }} />
            </a>
          )}
        </div>
      </div>

      {/* ── Settings panel ──────────────────────────────────────────────────── */}
      {showSettings && (
        <div className="mx-4 my-3 p-4 bg-white rounded-lg border border-violet-200 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Gate Title</label>
              <input
                type="text"
                value={gateTitle}
                onChange={e => updateContent('gateTitle', e.target.value)}
                placeholder="Members Only"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CTA Button Label</label>
              <input
                type="text"
                value={ctaLabel}
                onChange={e => updateContent('ctaLabel', e.target.value)}
                placeholder="Sign In / Sign Up"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gate Message</label>
            <textarea
              value={gateMessage}
              onChange={e => updateContent('gateMessage', e.target.value)}
              rows={2}
              placeholder="Sign in or create an account to access this content."
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
            />
          </div>

          {/* Package restriction */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Restrict to specific packages</label>
            {loadingPackages ? (
              <p className="text-xs text-slate-400">Loading packages…</p>
            ) : packages.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="font-medium text-slate-700 mb-1">No packages configured yet</p>
                <p>
                  Currently restricted to{' '}
                  <strong>all signed-in members</strong>. To restrict access to specific paid
                  tiers,{' '}
                  <a
                    href={siteId ? `/admin/membership?siteId=${siteId}#packages` : '/admin/membership'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-600 underline hover:text-violet-800"
                  >
                    add packages in Membership settings
                  </a>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowedPackageIds.length === 0}
                    onChange={() => updateContent('allowedPackageIds', [])}
                    className="rounded border-slate-300 text-violet-600"
                  />
                  <span className="font-medium">All signed-in members</span>
                </label>
                {packages.map(pkg => (
                  <label key={pkg.id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowedPackageIds.includes(pkg.id)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...allowedPackageIds, pkg.id]
                          : allowedPackageIds.filter(pid => pid !== pkg.id);
                        updateContent('allowedPackageIds', next);
                      }}
                      className="rounded border-slate-300 text-violet-600"
                    />
                    <span className="font-medium">{pkg.name}</span>
                    <span className="text-slate-400">
                      {pkg.price_cents === 0 ? 'Free' : `$${(pkg.price_cents / 100).toFixed(2)}/${pkg.billing_interval}`}
                    </span>
                  </label>
                ))}
                {allowedPackageIds.length > 0 && (
                  <p className="text-[10px] text-slate-400 pt-1">
                    Members without a selected package will see the upgrade prompt.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Child blocks ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-4 space-y-0">
        {childBlocks.length === 0 && (
          <div className="py-8 text-center text-sm text-violet-400 border border-dashed border-violet-200 rounded-lg">
            Add blocks below — they'll only be visible to authorized members.
          </div>
        )}

        {childBlocks.map((block, i) => {
          const Component = BLOCK_COMPONENTS[block.type];
          if (!Component) return null;

          return (
            <div key={block.id} className="relative group/child">
              {/* Inner add-between button */}
              <InlineAddButton
                onAdd={(type) => addChildBlock(type, i - 1)}
                isProUser={isProUser}
                position="top"
              />

              {/* Child block controls */}
              <div className="absolute top-3 right-3 opacity-0 group-hover/child:opacity-100 transition-opacity bg-white shadow border border-slate-200 rounded-md flex overflow-hidden z-[110]">
                <button
                  onClick={() => moveChildBlock(block.id, 'up')}
                  disabled={i === 0}
                  className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 border-r border-slate-100 transition-colors"
                  title="Move up"
                >
                  <ArrowUp style={{ width: 14, height: 14 }} />
                </button>
                <button
                  onClick={() => moveChildBlock(block.id, 'down')}
                  disabled={i === childBlocks.length - 1}
                  className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 border-r border-slate-100 transition-colors"
                  title="Move down"
                >
                  <ArrowDown style={{ width: 14, height: 14 }} />
                </button>
                <button
                  onClick={() => removeChildBlock(block.id)}
                  className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Remove block"
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {/* Render the actual block */}
              <div className="relative border-2 border-transparent hover:border-slate-200 transition-colors rounded">
                <BlockDataProvider value={block.data || {}}>
                  <Component
                    id={block.id}
                    data={block.data || {}}
                    isEditMode={true}
                    palette={palette}
                    updateContent={(key: string, value: any) => updateChildBlock(block.id, key, value)}
                    block={block}
                  />
                </BlockDataProvider>
              </div>
            </div>
          );
        })}

        {/* Bottom add button */}
        <InlineAddButton
          onAdd={(type) => addChildBlock(type)}
          isProUser={isProUser}
          label="Add block inside gate"
          alwaysVisible
        />
      </div>
    </div>
  );
}

// ─── Inline Add Block Button ─────────────────────────────────────────────────

function InlineAddButton({
  onAdd, isProUser, label, position, alwaysVisible,
}: {
  onAdd: (type: string) => void;
  isProUser: boolean;
  label?: string;
  position?: 'top';
  alwaysVisible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = AVAILABLE_BLOCKS.filter(b =>
    getBlockDisplayLabel(b.label).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      ref={ref}
      className={`relative flex justify-center ${alwaysVisible ? 'my-3' : 'my-1 group/add'}`}
    >
      {!alwaysVisible && (
        <div className="absolute inset-0 flex items-center px-2">
          <div className="w-full border-t border-transparent group-hover/add:border-violet-200 transition-colors" />
        </div>
      )}
      <button
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className={`relative flex items-center gap-1.5 text-xs font-medium rounded-full transition-all z-10 ${
          alwaysVisible
            ? 'px-3 py-1.5 bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-200'
            : 'p-1.5 bg-white border border-transparent text-slate-300 group-hover/add:border-violet-200 group-hover/add:text-violet-500 hover:bg-violet-50 shadow-sm'
        }`}
      >
        <Plus style={{ width: 13, height: 13 }} />
        {label && <span>{label}</span>}
      </button>

      {open && (
        <div className={`absolute ${position === 'top' ? 'bottom-7' : 'top-8'} z-[200] bg-white shadow-xl border border-slate-200 rounded-lg p-2 w-56 max-h-72 flex flex-col`}>
          <p className="flex-shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">Add block</p>
          <div className="flex-shrink-0 px-2 mb-2">
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search blocks…"
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>
          <div className="overflow-y-auto flex-1 space-y-0.5 px-0.5">
            {filtered.length > 0 ? filtered.map(b => (
              <button
                key={b.type}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors flex items-center justify-between gap-3"
                onClick={() => {
                  if (b.proOnly && !isProUser) { window.location.href = '/pricing'; return; }
                  onAdd(b.type);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {React.createElement(getBlockIcon(b.type), { className: 'h-4 w-4 shrink-0 text-slate-500' })}
                  <span className="min-w-0">{getBlockDisplayLabel(b.label)}</span>
                </span>
                {b.proOnly && !isProUser && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full">
                    <Crown style={{ width: 10, height: 10 }} />
                    PRO
                  </span>
                )}
              </button>
            )) : (
              <p className="text-xs text-slate-400 text-center py-4">No blocks found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
