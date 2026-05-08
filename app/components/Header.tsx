'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ChevronDown, Settings, LogOut, Paintbrush, LayoutDashboard, User, Menu, X } from 'lucide-react';
import KeystoneLogo from './KeystoneLogo';
import { useAuth } from '@/lib/auth/context';
import ProfileDropdown from './ProfileDropdown';
import { useRouter } from 'next/navigation';

const ANIM_MS = 220;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);   // animation state
  const [menuMounted, setMenuMounted] = useState(false); // DOM presence
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [avatarErrored, setAvatarErrored] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAvatarError = useCallback(() => setAvatarErrored(true), []);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const userDisplayName = user ? ((user.user_metadata?.full_name || user.user_metadata?.name || user.email) as string) : '';
  const userAvatarUrl = user ? (user.user_metadata?.avatar_url as string | undefined) : undefined;

  const openMenu = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuMounted(true);
    // Two rAFs: first mounts element, second starts the transition
    requestAnimationFrame(() => requestAnimationFrame(() => setMenuOpen(true)));
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    closeTimer.current = setTimeout(() => setMenuMounted(false), ANIM_MS);
  }, []);

  const toggleMenu = useCallback(() => {
    if (menuOpen) closeMenu(); else openMenu();
  }, [menuOpen, openMenu, closeMenu]);

  return (
    <header className="sticky top-[var(--impersonation-height,0px)] w-full z-50 bg-white border-b border-slate-200">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <KeystoneLogo href="/" size="lg" showText={false} />

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/templates" className="text-sm text-slate-700 hover:text-slate-900 transition-colors font-medium">
            Templates
          </Link>

          {/* Industries Dropdown */}
          <div
            className="relative group"
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            <button className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 transition-colors font-medium py-2">
              Industries <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-200 ${isDropdownOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-2 invisible'}`}>
              <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-56 overflow-hidden">
                <Link href="/industries/trades" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors border-b border-slate-100">
                  Trades & Home Services
                </Link>
                <Link href="/industries/ecommerce" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors border-b border-slate-100">
                  E-Commerce & Retail
                </Link>
                <Link href="/industries/health-wellness" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors border-b border-slate-100">
                  Health & Wellness
                </Link>
                <Link href="/industries/food-hospitality" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors border-b border-slate-100">
                  Food & Hospitality
                </Link>
                <Link href="/industries/professional-services" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors border-b border-slate-100">
                  Professional Services
                </Link>
                <Link href="/industries/creative-portfolio" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors">
                  Creative & Portfolio
                </Link>
              </div>
            </div>
          </div>

          <Link href="/pricing" className="text-sm text-slate-700 hover:text-slate-900 transition-colors font-medium">
            Pricing
          </Link>

          <Link href="/contact" className="text-sm text-slate-700 hover:text-slate-900 transition-colors font-medium">
            Contact
          </Link>

          {user ? (
            <div className="flex items-center gap-4">
              <Link
                href="/onboarding"
                className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors shadow-md hover:shadow-lg"
              >
                Get Started
              </Link>
              <ProfileDropdown />
            </div>
          ) : (
            <Link
              href="/onboarding"
              className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors shadow-md hover:shadow-lg"
            >
              Get Started
            </Link>
          )}
        </div>

        {/* Mobile: Get Started + Hamburger */}
        <div className="md:hidden flex items-center gap-3">
          <Link
            href="/onboarding"
            className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-md"
          >
            Get Started
          </Link>
          <button
            onClick={toggleMenu}
            className="p-2 text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <span className="relative w-6 h-6 flex items-center justify-center">
              <Menu className={`absolute w-6 h-6 transition-all duration-[220ms] ${menuOpen ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} />
              <X className={`absolute w-6 h-6 transition-all duration-[220ms] ${menuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`} />
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu — always mounted during open+close so close anim can play */}
      {menuMounted && (
        <div
          className={`md:hidden border-t border-slate-200 bg-white shadow-xl absolute w-full left-0 transition-[opacity,transform] duration-[220ms] ease-out ${menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
        >
          <div className="px-4 py-4 space-y-3">
            {user && (
              <>
                {/* Profile */}
                <div className="flex items-center gap-3 px-1 py-1">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-slate-200 flex items-center justify-center">
                    {userAvatarUrl && !avatarErrored ? (
                      <img
                        src={userAvatarUrl}
                        alt={userDisplayName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={handleAvatarError}
                      />
                    ) : (
                      <User className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{userDisplayName}</div>
                    {userDisplayName !== user.email && (
                      <div className="text-xs text-slate-500 truncate">{user.email}</div>
                    )}
                  </div>
                </div>
                {/* Design / Admin side by side */}
                <div className="flex gap-2">
                  <Link
                    href="/design"
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-lg transition-colors font-medium"
                    onClick={closeMenu}
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    Design
                  </Link>
                  <Link
                    href="/admin"
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-lg transition-colors font-medium"
                    onClick={closeMenu}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Admin
                  </Link>
                </div>
                <Link
                  href="/settings"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors font-medium"
                  onClick={closeMenu}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  onClick={async () => { closeMenu(); await signOut(); router.push('/'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors font-medium text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
                <div className="border-t border-slate-100" />
              </>
            )}

            <Link href="/templates" className="block text-sm text-slate-700 hover:text-slate-900 font-medium py-2" onClick={closeMenu}>
              Templates
            </Link>

            <div className="py-2">
              <div className="text-sm text-slate-900 font-bold mb-2">Industries</div>
              <div className="pl-4 space-y-2 border-l-2 border-slate-100">
                <Link href="/industries/trades" className="block text-sm text-slate-600 hover:text-slate-900 py-1" onClick={closeMenu}>Trades & Home Services</Link>
                <Link href="/industries/ecommerce" className="block text-sm text-slate-600 hover:text-slate-900 py-1" onClick={closeMenu}>E-Commerce & Retail</Link>
                <Link href="/industries/health-wellness" className="block text-sm text-slate-600 hover:text-slate-900 py-1" onClick={closeMenu}>Health & Wellness</Link>
                <Link href="/industries/food-hospitality" className="block text-sm text-slate-600 hover:text-slate-900 py-1" onClick={closeMenu}>Food & Hospitality</Link>
                <Link href="/industries/professional-services" className="block text-sm text-slate-600 hover:text-slate-900 py-1" onClick={closeMenu}>Professional Services</Link>
                <Link href="/industries/creative-portfolio" className="block text-sm text-slate-600 hover:text-slate-900 py-1" onClick={closeMenu}>Creative & Portfolio</Link>
              </div>
            </div>

            <Link href="/pricing" className="block text-sm text-slate-700 hover:text-slate-900 font-medium py-2" onClick={closeMenu}>
              Pricing
            </Link>

            <Link href="/contact" className="block text-sm text-slate-700 hover:text-slate-900 font-medium py-2" onClick={closeMenu}>
              Contact
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
