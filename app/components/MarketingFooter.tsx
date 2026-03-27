import Link from 'next/link';
import Image from 'next/image';
import mapleLeaf from '../../assets/maple-leaf.png';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          {/* Brand */}
          <div className="flex items-center gap-2 text-slate-700 text-sm font-medium">
            <span>Proudly Canadian</span>
            <Image src={mapleLeaf} alt="Maple Leaf" className="w-4 h-4 object-contain" />
          </div>

          {/* Nav Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            <Link href="/templates" className="hover:text-slate-900 transition-colors">Templates</Link>
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-slate-900 transition-colors">About</Link>
          </div>

          {/* Legal Links */}
          <div className="flex gap-6 text-xs text-slate-400">
            <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100 text-xs text-slate-400 text-center">
          &copy; {new Date().getFullYear()} Keystone Web Design. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
