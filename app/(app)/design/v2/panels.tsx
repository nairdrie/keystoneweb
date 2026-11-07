'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Eye, EyeOff, ImageIcon, Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  FONT_CHOICES,
  htmlToText,
  textToHtml,
  type EditorState,
  type FieldInfo,
  type InstanceContent,
  type PageInfo,
} from './api';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

export interface PanelActions {
  setField: (instance: string, path: string, value: unknown) => Promise<void>;
  listOp: (instance: string, path: string, op: 'add' | 'duplicate' | 'remove' | 'move', index?: number, to?: number) => Promise<void>;
  pickImage: (instance: string, path: string, field: FieldInfo, current: Obj) => void;
  pickLink: (instance: string, path: string, field: FieldInfo, current: Obj) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

export function SectionsPanel({
  state,
  page,
  selected,
  onSelect,
  onSectionAction,
  actions,
}: {
  state: EditorState;
  page: PageInfo;
  selected: string | null;
  onSelect: (instance: string) => void;
  onSectionAction: (action: 'add' | 'move' | 'duplicate' | 'remove' | 'hide' | 'show', instance?: string, extra?: Obj) => Promise<void>;
  actions: PanelActions;
}) {
  const [adding, setAdding] = useState(false);
  const nameOf = (key: string) => state.sections.find((s) => s.key === key)?.name || key;
  const contentFor = (instance: string) => state.content.find((c) => c.instance === instance);
  const usable = state.sections.filter((s) => s.key !== state.theme.header && s.key !== state.theme.footer);

  const row = (instance: string, label: string, opts: { index?: number; hidden?: boolean; global?: boolean }) => {
    const open = selected === instance;
    const content = contentFor(instance);
    return (
      <li key={instance} className={`rounded-xl border ${open ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-1 px-2 py-1.5">
          <button onClick={() => onSelect(instance)} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left text-sm font-medium text-slate-800">
            {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
            <span className={`truncate ${opts.hidden ? 'text-slate-400 line-through' : ''}`}>{label}</span>
            {opts.global && <span className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase text-slate-500">All pages</span>}
          </button>
          {!opts.global && opts.index !== undefined && (
            <>
              <IconBtn title="Move up" disabled={opts.index === 0} onClick={() => onSectionAction('move', instance, { to: opts.index! - 1 })}><ArrowUp /></IconBtn>
              <IconBtn title="Move down" disabled={opts.index === page.sections.length - 1} onClick={() => onSectionAction('move', instance, { to: opts.index! + 1 })}><ArrowDown /></IconBtn>
              <IconBtn title={opts.hidden ? 'Show' : 'Hide'} onClick={() => onSectionAction(opts.hidden ? 'show' : 'hide', instance)}>{opts.hidden ? <EyeOff /> : <Eye />}</IconBtn>
              <IconBtn title="Duplicate" onClick={() => onSectionAction('duplicate', instance)}><Copy /></IconBtn>
              <IconBtn title="Remove" onClick={() => { if (confirm('Remove this section from the page? You can restore it from History.')) void onSectionAction('remove', instance); }}><Trash2 /></IconBtn>
            </>
          )}
        </div>
        {open && content && (
          <div className="border-t border-slate-200 px-3 py-3">
            <ContentForm content={content} actions={actions} />
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-slate-500">Click anything on the page to edit it, or open a section here.</p>
      <ul className="space-y-2">
        {state.theme.header && row('header', nameOf(state.theme.header), { global: true })}
        {page.sections.map((s, i) => row(s.id, nameOf(s.section), { index: i, hidden: s.hidden }))}
        {state.theme.footer && row('footer', nameOf(state.theme.footer), { global: true })}
      </ul>
      {page.sections.length === 0 && <p className="px-1 py-4 text-center text-sm text-slate-400">This page has no sections yet.</p>}

      <div className="relative pt-1">
        <button onClick={() => setAdding((v) => !v)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600">
          <Plus className="h-4 w-4" /> Add a section
        </button>
        {adding && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            <p className="px-3 py-2 text-xs text-slate-500">Sections designed for your site:</p>
            {usable.map((s) => (
              <button
                key={s.key}
                onClick={async () => {
                  setAdding(false);
                  await onSectionAction('add', undefined, { section: s.key, index: page.sections.length });
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                {s.name}
              </button>
            ))}
            {usable.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No section designs yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactElement<{ className?: string }> }) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 [&>svg]:h-3.5 [&>svg]:w-3.5"
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Content form (the "form view" of a section)
// ─────────────────────────────────────────────────────────────────────────────

function ContentForm({ content, actions }: { content: InstanceContent; actions: PanelActions }) {
  return (
    <div className="space-y-3">
      {content.fields.map((f) => (
        <FieldEditor key={f.id} field={f} value={content.values[f.id]?.value} instance={content.instance} path={f.id} actions={actions} />
      ))}
      {content.fields.length === 0 && <p className="text-xs text-slate-400">Nothing to edit in this section.</p>}
    </div>
  );
}

function FieldEditor({ field, value, instance, path, actions }: { field: FieldInfo; value: unknown; instance: string; path: string; actions: PanelActions }) {
  const v = isObj(value) ? value : {};
  const label = field.label || field.id;
  const hidden = !!v.hidden;

  const hideToggle = field.optional && field.type !== 'toggle' ? (
    <button
      onClick={() => actions.setField(instance, path, { ...v, hidden: !hidden })}
      className="text-[11px] font-medium text-slate-400 hover:text-slate-700"
    >
      {hidden ? 'Show' : 'Hide'}
    </button>
  ) : null;

  switch (field.type) {
    case 'text':
    case 'richtext':
      return (
        <TextField
          key={String(v.html ?? value ?? '')}
          label={label}
          extra={hideToggle}
          html={String(v.html ?? (typeof value === 'string' ? value : ''))}
          rich={field.type === 'richtext'}
          max={field.max}
          dim={hidden}
          onSave={(html) => actions.setField(instance, path, { ...v, html })}
        />
      );
    case 'image':
    case 'bg':
      return (
        <div className={hidden ? 'opacity-50' : ''}>
          <FieldLabel label={label} extra={hideToggle} />
          <button onClick={() => actions.pickImage(instance, path, field, v)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 text-left hover:border-blue-300">
            <span className="h-12 w-16 shrink-0 overflow-hidden rounded bg-slate-100">
              {typeof v.src === 'string' && v.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.src} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-slate-600"><ImageIcon className="h-3.5 w-3.5" /> Replace image</span>
          </button>
        </div>
      );
    case 'link':
      return (
        <div className={hidden ? 'opacity-50' : ''}>
          <FieldLabel label={label} extra={hideToggle} />
          <button onClick={() => actions.pickLink(instance, path, field, v)} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-blue-300">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate text-slate-700">{field.hrefOnly ? '' : `${htmlToText(String(v.label || ''))} → `}<span className="text-slate-400">{String(v.href || '')}</span></span>
          </button>
        </div>
      );
    case 'toggle':
      return (
        <label className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
          {label}
          <input type="checkbox" checked={!hidden} onChange={(e) => actions.setField(instance, path, e.target.checked)} />
        </label>
      );
    case 'list':
      return <ListEditor field={field} value={v} instance={instance} path={path} actions={actions} label={label} hidden={hidden} hideToggle={hideToggle} />;
    default:
      return null;
  }
}

function ListEditor({ field, value, instance, path, actions, label, hidden, hideToggle }: { field: FieldInfo; value: Obj; instance: string; path: string; actions: PanelActions; label: string; hidden: boolean; hideToggle: React.ReactNode }) {
  const items = Array.isArray(value.items) ? (value.items as Obj[]) : [];
  // Controlled so an expanded item stays open while saves refresh the editor.
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={hidden ? 'opacity-50' : ''}>
      <FieldLabel label={`${label} (${items.length})`} extra={hideToggle} />
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-700">
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                {open === i ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                <span className="truncate">{itemTitle(field, item) || `Item ${i + 1}`}</span>
              </button>
              <IconBtn title="Move up" disabled={i === 0} onClick={() => { setOpen(open === i ? i - 1 : open); void actions.listOp(instance, path, 'move', i, i - 1); }}><ArrowUp /></IconBtn>
              <IconBtn title="Move down" disabled={i === items.length - 1} onClick={() => { setOpen(open === i ? i + 1 : open); void actions.listOp(instance, path, 'move', i, i + 1); }}><ArrowDown /></IconBtn>
              <IconBtn title="Duplicate" onClick={() => actions.listOp(instance, path, 'duplicate', i)}><Copy /></IconBtn>
              <IconBtn title="Remove" onClick={() => { setOpen(null); void actions.listOp(instance, path, 'remove', i); }}><Trash2 /></IconBtn>
            </div>
            {open === i && (
              <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                {(field.item || []).map((sub) => (
                  <FieldEditor key={sub.id} field={sub} value={item[sub.id]} instance={instance} path={`${path}.${i}.${sub.id}`} actions={actions} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => { setOpen(items.length); void actions.listOp(instance, path, 'add', items.length); }} className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
        <Plus className="h-3.5 w-3.5" /> Add item
      </button>
    </div>
  );
}

function itemTitle(field: FieldInfo, item: Obj): string {
  for (const sub of field.item || []) {
    const v = item[sub.id];
    if ((sub.type === 'text' || sub.type === 'richtext') && isObj(v) && v.html) return htmlToText(String(v.html)).slice(0, 60);
  }
  return '';
}

function FieldLabel({ label, extra }: { label: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {extra}
    </div>
  );
}

function TextField({ label, html, rich, max, dim, extra, onSave }: { label: string; html: string; rich: boolean; max?: number; dim?: boolean; extra?: React.ReactNode; onSave: (html: string) => Promise<void> }) {
  const formatted = /<(em|strong|b|i|u|span|mark|a|sup|sub|small)\b/i.test(html);
  const [text, setText] = useState(() => htmlToText(html));
  const [saving, setSaving] = useState(false);
  const dirty = text !== htmlToText(html);
  return (
    <div className={dim ? 'opacity-50' : ''}>
      <FieldLabel label={label} extra={extra} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={rich ? 4 : Math.min(3, Math.max(1, Math.ceil(text.length / 38)))}
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
        <span>{max ? `${text.length}/${max}` : ''}{formatted && dirty ? ' · Styling is kept when you edit on the page itself' : ''}</span>
        {dirty && (
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(textToHtml(text, rich));
              setSaving(false);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 font-semibold text-white"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pages
// ─────────────────────────────────────────────────────────────────────────────

export function PagesPanel({
  state,
  currentId,
  onOpen,
  onUpdate,
  onAdd,
  onDelete,
}: {
  state: EditorState;
  currentId: string;
  onOpen: (pageId: string) => void;
  onUpdate: (pageId: string, patch: Obj) => Promise<void>;
  onAdd: (input: { title: string; copyFrom?: string }) => Promise<void>;
  onDelete: (pageId: string) => Promise<void>;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const current = state.pages.find((p) => p.id === currentId);

  return (
    <div className="space-y-5">
      <ul className="space-y-1">
        {state.pages.map((p) => (
          <li key={p.id}>
            <button onClick={() => onOpen(p.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${p.id === currentId ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
              <span className="truncate">{p.navLabel || p.title}</span>
              <span className={`text-xs ${p.id === currentId ? 'text-slate-300' : 'text-slate-400'}`}>{p.template === 'post' ? 'every blog post' : `/${p.slug === 'home' ? '' : p.slug}`}</span>
            </button>
          </li>
        ))}
      </ul>

      {current && <PageSettings key={current.id} page={current} onUpdate={onUpdate} onDelete={onDelete} />}

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-semibold text-slate-800">Add a page</p>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Page name, e.g. Kitchen Renovations" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Start empty</option>
          {state.pages.map((p) => <option key={p.id} value={p.id}>Copy the layout of “{p.navLabel || p.title}”</option>)}
        </select>
        <button
          disabled={busy || !newTitle.trim()}
          onClick={async () => {
            setBusy(true);
            await onAdd({ title: newTitle.trim(), copyFrom: copyFrom || undefined });
            setNewTitle('');
            setBusy(false);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add page
        </button>
      </div>
    </div>
  );
}

function PageSettings({ page, onUpdate, onDelete }: { page: PageInfo; onUpdate: (pageId: string, patch: Obj) => Promise<void>; onDelete: (pageId: string) => Promise<void> }) {
  const [navLabel, setNavLabel] = useState(page.navLabel);
  const [seoTitle, setSeoTitle] = useState(page.seo.title || '');
  const [seoDescription, setSeoDescription] = useState(page.seo.description || '');
  const [showInNav, setShowInNav] = useState(page.showInNav);
  const [busy, setBusy] = useState(false);
  const dirty = navLabel !== page.navLabel || seoTitle !== (page.seo.title || '') || seoDescription !== (page.seo.description || '') || showInNav !== page.showInNav;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-800">Page settings</p>
      <label className="block text-xs font-medium text-slate-600">Name in the menu
        <input value={navLabel} onChange={(e) => setNavLabel(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={showInNav} onChange={(e) => setShowInNav(e.target.checked)} /> Show in the menu
      </label>
      <label className="block text-xs font-medium text-slate-600">Title in Google
        <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
      </label>
      <label className="block text-xs font-medium text-slate-600">Description in Google
        <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={300} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
      </label>
      <div className="flex items-center justify-between">
        {page.slug !== 'home' ? (
          <button onClick={() => { if (confirm(`Delete the page “${page.navLabel}”?`)) void onDelete(page.id); }} className="text-xs font-medium text-red-600 hover:text-red-700">Delete page</button>
        ) : <span />}
        <button
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            await onUpdate(page.id, { nav_label: navLabel, show_in_nav: showInNav, seo: { title: seoTitle, description: seoDescription } });
            setBusy(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand
// ─────────────────────────────────────────────────────────────────────────────

export function BrandPanel({ state, onSave, onLogo }: { state: EditorState; onSave: (overrides: Record<string, string | null>) => Promise<void>; onLogo: () => void }) {
  const editable = state.theme.tokens.filter((t) => t.editable);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const valueOf = (name: string) => draft[name] ?? state.theme.ownerOverrides[name] ?? state.theme.tokens.find((t) => t.name === name)?.value ?? '';

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Logo</p>
        <button onClick={onLogo} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-2 text-left text-sm text-slate-600 hover:border-blue-300">
          <span className="flex h-12 w-16 items-center justify-center overflow-hidden rounded bg-slate-100">
            {state.site.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={state.site.logo} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </span>
          Replace logo
        </button>
      </div>

      {editable.length === 0 && <p className="text-sm text-slate-500">Your designer hasn&apos;t made any colours or fonts adjustable for this site. Ask the Keystone team if you&apos;d like a change.</p>}

      {editable.map((t) => {
        const overridden = state.theme.ownerOverrides[t.name] !== undefined || draft[t.name] !== undefined;
        return (
          <div key={t.name}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">{t.label || t.name}</span>
              {overridden && (
                <button onClick={() => setDraft((d) => ({ ...d, [t.name]: '' }))} className="text-[11px] text-slate-400 hover:text-slate-700">Reset to design</button>
              )}
            </div>
            {t.type === 'color' ? (
              <div className="flex items-center gap-2">
                <input type="color" aria-label={`${t.label || t.name} picker`} value={/^#[0-9a-f]{6}$/i.test(valueOf(t.name)) ? valueOf(t.name) : '#000000'} onChange={(e) => setDraft((d) => ({ ...d, [t.name]: e.target.value }))} className="h-9 w-12 cursor-pointer rounded border border-slate-200" />
                <input aria-label={t.label || t.name} value={valueOf(t.name)} onChange={(e) => setDraft((d) => ({ ...d, [t.name]: e.target.value }))} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs" />
              </div>
            ) : t.type === 'font' ? (
              <select aria-label={t.label || t.name} value={valueOf(t.name).split(',')[0].replace(/['"]/g, '').trim()} onChange={(e) => setDraft((d) => ({ ...d, [t.name]: `'${e.target.value}', ${/serif/i.test(e.target.value) && !/sans/i.test(e.target.value) ? 'serif' : 'sans-serif'}` }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {[valueOf(t.name).split(',')[0].replace(/['"]/g, '').trim(), ...FONT_CHOICES].filter((f, i, a) => f && a.indexOf(f) === i).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            ) : (
              <input value={valueOf(t.name)} onChange={(e) => setDraft((d) => ({ ...d, [t.name]: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            )}
          </div>
        );
      })}

      {Object.keys(draft).length > 0 && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const overrides: Record<string, string | null> = {};
            for (const [k, v] of Object.entries(draft)) overrides[k] = v ? v : null;
            await onSave(overrides);
            setDraft({});
            setBusy(false);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Apply brand changes
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Business info
// ─────────────────────────────────────────────────────────────────────────────

export function BusinessPanel({ state, onSave }: { state: EditorState; onSave: (input: Obj) => Promise<void> }) {
  const bp = (state.site.businessProfile || {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const [form, setForm] = useState({
    name: state.site.title,
    phone: s(bp.telephone),
    email: s(state.site.contactEmail),
    streetAddress: s(bp.streetAddress),
    city: s(bp.addressLocality),
    region: s(bp.addressRegion),
    postalCode: s(bp.postalCode),
    hours: Array.isArray(bp.openingHours) ? (bp.openingHours as string[]).join('\n') : '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const input = (k: keyof typeof form, label: string) => (
    <label className="block text-xs font-medium text-slate-600">{label}
      <input value={form[k]} onChange={set(k)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
    </label>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">These details appear wherever your site shows them (header, footer, contact sections) and help Google show your business correctly.</p>
      {input('name', 'Business name')}
      {input('phone', 'Phone')}
      {input('email', 'Email')}
      {input('streetAddress', 'Street address')}
      <div className="grid grid-cols-2 gap-2">
        {input('city', 'City')}
        {input('region', 'Province / state')}
      </div>
      {input('postalCode', 'Postal code')}
      <label className="block text-xs font-medium text-slate-600">Opening hours (one per line)
        <textarea value={form.hours} onChange={set('hours')} rows={4} placeholder={'Mo-Fr 08:00-17:00\nSa 09:00-13:00'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
      </label>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onSave({ ...form, hours: form.hours.split('\n').map((h) => h.trim()).filter(Boolean) });
          setBusy(false);
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save business info
      </button>
    </div>
  );
}
