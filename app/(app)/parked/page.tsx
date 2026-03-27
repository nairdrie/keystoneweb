import Link from 'next/link';
import KeystoneLogo from '@/app/components/KeystoneLogo';

export default function ParkedDomainPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      {/* Logo */}
      <div className="mb-8">
        <KeystoneLogo href="/" size="lg" showText />
      </div>

      {/* Icon */}
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-3">
        This domain is parked on Keystone.
      </h1>
      <p className="text-slate-500 max-w-sm mb-8 leading-relaxed">
        This domain is registered but not yet connected to an active Keystone site.
        Are you the owner? Log in to activate your site.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/signin"
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-md"
        >
          Log In to Activate
        </Link>
        <Link
          href="/"
          className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors"
        >
          Learn about Keystone
        </Link>
      </div>

      <p className="mt-10 text-xs text-slate-400">
        Powered by{' '}
        <a href="https://keystoneweb.ca" className="underline hover:text-slate-600">Keystone Web Design</a>
        {' '}·{' '}
        <a href="/terms" className="underline hover:text-slate-600">Terms of Service</a>
      </p>
    </main>
  );
}
