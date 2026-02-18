'use client';

import { useState } from 'react';
import Link from 'next/link';
import KeystoneLogoCanadian from './KeystoneLogoCanadian';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 w-full z-50 bg-white border-b border-slate-200">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <KeystoneLogoCanadian />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">
            Features
          </Link>
          <Link href="/onboarding" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">
            Build
          </Link>
          <Link
            href="/onboarding"
            className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors shadow-md hover:shadow-lg"
          >
            Get Started
          </Link>
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
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="px-4 py-4 space-y-3">
            <Link
              href="/#features"
              className="block text-sm text-slate-600 hover:text-slate-900 font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Features
            </Link>
            <Link
              href="/onboarding"
              className="block text-sm text-slate-600 hover:text-slate-900 font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Build
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
