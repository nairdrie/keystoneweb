'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { User, Settings, LogOut, Paintbrush, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';

interface ProfileDropdownProps {
  onSettingsClick?: (e: React.MouseEvent) => void;
  buttonClassName?: string;
}

export default function ProfileDropdown({ onSettingsClick, buttonClassName }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const handleSettingsClick = (e: React.MouseEvent) => {
    if (onSettingsClick) {
      onSettingsClick(e);
      if (e.defaultPrevented) {
        setIsOpen(false);
        return;
      }
    }
    setIsOpen(false);
    router.push('/settings');
  };

  const handleLogoutClick = async () => {
    setIsOpen(false);
    await signOut();
    router.push('/');
  };

  const userDisplayName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email) as string;
  const userAvatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const [avatarErrored, setAvatarErrored] = useState(false);
  const handleAvatarError = useCallback(() => setAvatarErrored(true), []);

  return (
    <div className="relative z-[9999]" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName ?? "w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-full transition-colors flex-shrink-0 overflow-hidden"}
        title={userDisplayName}
      >
        {userAvatarUrl && !avatarErrored ? (
          <img
            src={userAvatarUrl}
            alt={userDisplayName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={handleAvatarError}
          />
        ) : (
          <User className="w-5 h-5" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl w-64 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-slate-200 flex items-center justify-center">
              {userAvatarUrl && !avatarErrored ? (
                <img
                  src={userAvatarUrl}
                  alt={userDisplayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={handleAvatarError}
                />
              ) : (
                <User className="w-4 h-4 text-slate-500" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-slate-900 font-bold truncate">{userDisplayName}</div>
              {userDisplayName !== user.email && (
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
              )}
            </div>
          </div>
          <div className="p-2 flex gap-2">
            <Link
              href="/design"
              onClick={() => setIsOpen(false)}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-md transition-colors font-medium"
            >
              <Paintbrush className="w-3.5 h-3.5" />
              Design
            </Link>
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-md transition-colors font-medium"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Admin
            </Link>
          </div>
          <div className="p-2 pt-0 space-y-1 border-t border-slate-100">
            <button
              onClick={handleSettingsClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors font-medium text-left mt-1"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={handleLogoutClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors font-medium text-left"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
