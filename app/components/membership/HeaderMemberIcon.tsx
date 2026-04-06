'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, UserCircle } from 'lucide-react';
import { useMember } from './MemberProvider';

/**
 * Member profile icon for the header.
 * Shows when a member is signed in, on any page.
 * Follows the same pattern as HeaderCartIcon.
 */
export default function HeaderMemberIcon({ color = '#475569' }: { color?: string }) {
  const memberCtx = useMember();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
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
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-900 truncate">{member.name || 'Member'}</p>
            <p className="text-xs text-slate-500 truncate">{member.email}</p>
          </div>
          <a
            href="/member"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <UserCircle className="w-4 h-4" />
            My Profile
          </a>
          <button
            onClick={() => memberCtx.signOut()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full text-left"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
