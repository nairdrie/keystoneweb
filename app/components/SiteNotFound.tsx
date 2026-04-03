import Link from 'next/link';
import KeystoneLogo from './KeystoneLogo';

interface SiteNotFoundProps {
  message: string;
  ctaText: string;
  domain?: string;
}

export default function SiteNotFound({ message, ctaText, domain }: SiteNotFoundProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
      <div className="mb-12">
        <KeystoneLogo size="lg" showText={false} />
      </div>
      
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Site Not Found</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          {message} {domain && (
            <code className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-mono text-sm inline-block mt-2 sm:mt-0">
              {domain}
            </code>
          )}
        </p>
        
        <Link 
          href="https://keystoneweb.ca/signin" 
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          {ctaText}
        </Link>
      </div>
      
      <div className="mt-16 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Keystone Web Design
      </div>
    </div>
  );
}
