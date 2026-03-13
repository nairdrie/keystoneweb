'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';

interface ProfileDropdownProps {
  onSettingsClick?: (e: React.MouseEvent) => void;
}

export default function ProfileDropdown({ onSettingsClick }: ProfileDropdownProps) {
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

  return (
    <div className="relative z-[9999]" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-full transition-colors flex-shrink-0"
        title="Profile"
      >
        <User className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl w-64 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="text-xs text-slate-500 font-medium mb-0.5">Signed in as</div>
            <div className="text-sm text-slate-900 font-bold truncate">{user.email}</div>
          </div>
          <div className="p-2 space-y-1">
            <button
              onClick={handleSettingsClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors font-medium text-left"
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
