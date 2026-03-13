'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import KeystoneLogo from './KeystoneLogo';
import { useAuth } from '@/lib/auth/context';
import ProfileDropdown from './ProfileDropdown';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <header className="fixed top-0 w-full z-50 bg-white border-b border-slate-200">
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
              <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-48 overflow-hidden">
                <Link href="/industries/ecommerce" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors border-b border-slate-100">
                  E-Commerce
                </Link>
                <Link href="/industries/trades" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors">
                  Trades & Home Services
                </Link>
              </div>
            </div>
          </div>

          <Link href="/pricing" className="text-sm text-slate-700 hover:text-slate-900 transition-colors font-medium">
            Pricing
          </Link>

          {user ? (
            <div className="flex items-center gap-4">
              <Link
                href="/editor"
                className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors shadow-md hover:shadow-lg"
              >
                Continue Building
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

        {/* Mobile: Get Started/Continue Building + Hamburger */}
        <div className="md:hidden flex items-center gap-3">
          {user ? (
            <Link
              href="/editor"
              className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-md"
            >
              Continue Building
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-md"
            >
              Get Started
            </Link>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white shadow-xl absolute w-full left-0">
          <div className="px-4 py-4 space-y-3">
            <Link
              href="/templates"
              className="block text-sm text-slate-700 hover:text-slate-900 font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Templates
            </Link>

            <div className="py-2">
              <div className="text-sm text-slate-900 font-bold mb-2">Industries</div>
              <div className="pl-4 space-y-2 border-l-2 border-slate-100">
                <Link
                  href="/industries/ecommerce"
                  className="block text-sm text-slate-600 hover:text-slate-900 py-1"
                  onClick={() => setIsOpen(false)}
                >
                  E-Commerce
                </Link>
                <Link
                  href="/industries/trades"
                  className="block text-sm text-slate-600 hover:text-slate-900 py-1"
                  onClick={() => setIsOpen(false)}
                >
                  Trades & Services
                </Link>
              </div>
            </div>

            <Link
              href="/pricing"
              className="block text-sm text-slate-700 hover:text-slate-900 font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Pricing
            </Link>


            {user && (
              <div className="border-t border-slate-100 pt-3 mt-1">
                <div className="text-sm text-slate-900 font-bold mb-3">{user.email}</div>
                <button
                  onClick={() => {
                    signOut();
                    setIsOpen(false);
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-semibold transition-colors"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
