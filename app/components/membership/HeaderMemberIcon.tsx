'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, Plus, X, Pencil, ExternalLink } from 'lucide-react';
import { useMember } from './MemberProvider';
import { useEditorContext, NavItem } from '@/lib/editor-context';
import { usePathname } from 'next/navigation';
import { useLangPrefix } from '@/lib/hooks/useLangPrefix';
import NavItemEditModal from '../NavItemEditModal';

// ─── Default dropdown items ────────────────────────────────────────────────
const DEFAULT_MEMBER_LINKS: NavItem[] = [
  {
    id: 'default-profile',
    label: 'My Profile',
    linkType: 'custom',
    href: '/member',
  },
];

/**
 * Member profile icon for the header.
 * Shows when a member is signed in, on any page.
 * Dropdown links (except Sign Out) are configurable by the site owner.
 */
export default function HeaderMemberIcon({ color = '#475569' }: { color?: string }) {
  const memberCtx = useMember();
  const context = useEditorContext();
  const pathname = usePathname();
  const langPrefix = useLangPrefix();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NavItem | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const isEditMode = context?.isEditMode ?? false;
  const pages = context?.pages || [];
  const blocks = context?.blocks || [];
  const siteId = context?.siteId;
  const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

  // Configurable links stored in siteContent — fall back to defaults
  const rawLinks = context?.siteContent?.memberDropdownItems;
  const dropdownLinks: NavItem[] = Array.isArray(rawLinks) ? rawLinks : DEFAULT_MEMBER_LINKS;

  const updateLinks = (items: NavItem[]) => {
    context?.updateSiteContent?.('memberDropdownItems', items);
  };

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setEditingItem(null);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  if (!memberCtx || !memberCtx.member) return null;

  const member = memberCtx.member;
  const initials = member.name
    ? member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : member.email[0].toUpperCase();

  // ── Resolve href for a dropdown link ──────────────────────────────────────
  const resolveHref = (item: NavItem): string => {
    if (item.linkType === 'page') {
      if (isEditor) return `/design?siteId=${siteId}&pageId=${item.pageId}`;
      if (context?.previewSiteId) return `/preview?siteId=${context.previewSiteId}&pageId=${item.pageId}`;
      const target = pages.find(p => p.id === item.pageId);
      const slug = target?.slug || '';
      const base = slug === 'home' ? '/' : `/${slug}`;
      return langPrefix ? `${langPrefix}${base === '/' ? '' : base}` : base;
    }
    return item.href || '#';
  };

  const isExternal = (item: NavItem) =>
    item.linkType === 'custom' && (item.href?.startsWith('http') || item.href?.startsWith('//'));

  // ── Link CRUD (edit mode) ──────────────────────────────────────────────────
  const addLink = () => {
    const newItem: NavItem = {
      id: `ml-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: 'New Link',
      linkType: 'custom',
      href: '#',
    };
    updateLinks([...dropdownLinks, newItem]);
    setEditingItem(newItem);
  };

  const saveLink = (updated: NavItem) => {
    updateLinks(dropdownLinks.map(l => l.id === updated.id ? updated : l));
    setEditingItem(null);
  };

  const removeLink = (id: string) => {
    updateLinks(dropdownLinks.filter(l => l.id !== id));
  };

  return (
    <div className="relative" ref={ref}>
      {/* Avatar button */}
      <button
        onClick={() => setDropdownOpen(o => !o)}
        className="relative flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:ring-2 hover:ring-offset-1"
        style={{
          backgroundColor: color === '#ffffff' || color === '#fff' ? 'rgba(255,255,255,0.2)' : `${color}15`,
          color,
        }}
        aria-label="Member menu"
      >
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={member.name || 'Profile'}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <span className="text-xs font-semibold">{initials}</span>
        )}
        {/* Edit indicator in edit mode */}
        {isEditMode && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-violet-500 rounded-full border border-white flex items-center justify-center">
            <Pencil style={{ width: 7, height: 7, color: 'white' }} />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
          {/* Member info header */}
          <div className="px-3 py-2 border-b border-slate-100 mb-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{member.name || 'Member'}</p>
            <p className="text-xs text-slate-500 truncate">{member.email}</p>
            {member.package && (
              <p className="text-[11px] text-violet-600 font-medium mt-0.5 truncate">{member.package.name}</p>
            )}
          </div>

          {/* Configurable links */}
          {dropdownLinks.map(item => (
            <div key={item.id} className="relative group/link">
              <a
                href={isEditMode ? undefined : resolveHref(item)}
                onClick={isEditMode ? (e) => e.preventDefault() : undefined}
                target={isExternal(item) ? '_blank' : undefined}
                rel={isExternal(item) ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="flex-1 truncate">{item.label}</span>
                {isExternal(item) && <ExternalLink style={{ width: 12, height: 12 }} className="text-slate-400 shrink-0" />}
              </a>

              {/* Edit controls (visible in edit mode on hover) */}
              {isEditMode && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover/link:flex items-center gap-0.5 bg-white border border-slate-200 rounded shadow-sm">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors rounded-l"
                    title="Edit link"
                  >
                    <Pencil style={{ width: 11, height: 11 }} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeLink(item.id); }}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded-r"
                    title="Remove link"
                  >
                    <X style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add link button (edit mode only) */}
          {isEditMode && (
            <button
              onClick={addLink}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-violet-600 hover:bg-violet-50 transition-colors w-full text-left border-t border-slate-100 mt-1"
            >
              <Plus style={{ width: 12, height: 12 }} />
              Add link
            </button>
          )}

          {/* Sign Out — always static */}
          <div className="border-t border-slate-100 mt-1 pt-1">
            <button
              onClick={() => memberCtx.signOut()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Link edit modal */}
      {editingItem && (
        <NavItemEditModal
          item={editingItem}
          pages={pages}
          blocks={blocks}
          siteId={siteId}
          onSave={saveLink}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
