'use client';

import Link from 'next/link';
import Image from 'next/image';

interface KeystoneLogoProps {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

/**
 * Keystone Logo Component
 * 
 * Reusable logo component used across landing pages and editor.
 * Can be used as a link back to home or standalone.
 * 
 * Props:
 * - href: URL to link to (defaults to '/', omit for no link)
 * - size: Logo size - 'sm' (40px), 'md' (60px), 'lg' (80px)
 * - showText: Show "KEYSTONE WEB DESIGN" text alongside logo
 */
export default function KeystoneLogo({
  href = '/',
  size = 'md',
  showText = true,
}: KeystoneLogoProps) {
  const sizeMap = {
    sm: { width: 40, height: 40 },
    md: { width: 60, height: 60 },
    lg: { width: 80, height: 80 },
  };

  const logoSize = sizeMap[size];

  const logo = (
    <div className="flex items-center gap-2">
      <Image
        src="/logos/keystone-logo.png"
        alt="Keystone"
        width={logoSize.width}
        height={logoSize.height}
        className="object-contain"
        priority
      />
      {showText && size !== 'sm' && (
        <div className="flex flex-col">
          <span className="text-lg font-bold text-red-600 leading-tight">KEYSTONE</span>
          <span className="text-xs text-gray-500 tracking-wider">WEB DESIGN</span>
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{logo}</Link>;
  }

  return logo;
}
