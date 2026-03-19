'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import KeystoneLogoImage from '@/assets/logo/keystone-logo.png';

export default function OpsHeader({ userEmail }: { userEmail?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/users', label: 'Users' },
    { href: '/support', label: 'Support' },
  ];

  return (
    <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-4 group">
              <div className="relative w-28 h-16">
                <Image
                  src={KeystoneLogoImage}
                  alt="Keystone"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-sm font-bold tracking-widest text-white uppercase group-hover:text-emerald-400 transition-colors">
                Operations
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`hover:text-white transition-colors ${pathname === link.href ? 'text-white font-medium' : ''
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {userEmail && (
              <span className="hidden sm:inline text-xs text-gray-500 font-mono">{userEmail}</span>
            )}

            {/* Hamburger Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-900 px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${pathname === link.href
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
            >
              {link.label}
            </Link>
          ))}
          {userEmail && (
            <div className="pt-4 pb-2 border-t border-gray-800">
              <div className="px-3 text-xs text-gray-500 font-mono truncate">{userEmail}</div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
