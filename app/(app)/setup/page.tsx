import { Metadata } from 'next';
import Header from '../../components/Header';
import MarketingFooter from '@/app/components/MarketingFooter';
import SetupIntakeForm from './SetupIntakeForm';
import { Check, Eye, Handshake, Rocket } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Launch Service — We build your site for you | Keystone',
  description:
    'Done-for-you Keystone website setup. Tell us about your business, we build it, you preview, then pay. Starting at $399.',
};

const INCLUDED = [
  '45-min discovery call to understand your business',
  'Up to 5 pages, themed to your brand',
  'Logo placement (or a clean wordmark if you don’t have one)',
  'Up to 10 stock photos sourced for you',
  'Contact form wired to your email, Google Maps, hours, socials',
  'Domain help — use your existing one or the free subdomain',
  'Basic on-page SEO (titles, descriptions, alt text)',
  '1 revision round after you preview',
  '14 days of small tweaks after launch',
];

const CUSTOM_SCOPE = [
  'More than 5 pages or multi-location',
  'Online store with a real catalog',
  'Custom integrations (CRMs, booking systems, POS)',
  'Ground-up copywriting or brand identity',
  'Migrating an existing live site',
];

export default function LaunchServicePage() {
  return (
    <main className="min-h-screen bg-white relative overflow-hidden">
      <Header />

      <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-red-200 rounded-full blur-[100px] opacity-40 -z-10" />

      <section className="pt-40 pb-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-3 py-1 rounded-full mb-5">
            Launch Service · For non-technical owners
          </span>
          <h1 className="text-5xl md:text-6xl font-black text-black mb-5 tracking-tight">
            We build your site. <br className="hidden md:block" />
            <span className="text-red-600">You approve. Then you pay.</span>
          </h1>
          <p className="text-xl text-slate-600 font-medium max-w-2xl mx-auto">
            Skip the setup. Tell us about your business on a 45-minute call, we&apos;ll
            build your site, and you&apos;ll see it before any money changes hands.
          </p>
          <p className="mt-6 text-sm text-slate-500">
            Starting at <span className="font-bold text-slate-900">$399 one-time</span>{' '}
            + your Basic or Pro subscription. Final price depends on scope —
            quoted on the intake call.
          </p>
        </div>
      </section>

      <section className="pb-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
          {[
            { icon: Handshake, title: '1. Intake call', desc: 'A short, focused call to capture your business and what you need.' },
            { icon: Rocket, title: '2. We build', desc: 'Usually about a week. Your draft lives on a private preview link.' },
            { icon: Eye, title: '3. Preview & pay', desc: 'Click through every page. Approve, then pay setup + subscription.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-16 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 mb-5">What&apos;s included</h2>
            <ul className="space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-700">
                  <Check className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8">
            <h2 className="text-xl font-black text-slate-900 mb-5">Needs a custom quote</h2>
            <p className="text-sm text-slate-600 mb-4">
              Some projects go beyond the standard Launch scope. That&apos;s fine — we&apos;ll
              talk it through on the intake call and tailor a quote. Your subscription
              price doesn&apos;t change, only the one-time build fee.
            </p>
            <ul className="space-y-3">
              {CUSTOM_SCOPE.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-600">
                  <span className="w-4 text-slate-400 shrink-0 mt-0.5 text-center">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="pb-24 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">
              Tell us about your business
            </h2>
            <p className="text-slate-600">
              This takes about 3 minutes. We&apos;ll email you within 1 business day to
              confirm a call time.
            </p>
          </div>
          <SetupIntakeForm />
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
