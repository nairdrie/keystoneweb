import Link from 'next/link';
import Header from '@/app/components/Header';
import MarketingFooter from '@/app/components/MarketingFooter';

const EFFECTIVE_DATE = 'March 27, 2026';
const COMPANY = 'Keystone Web Design';
const CONTACT_EMAIL = 'support@keystoneweb.ca';
const APP_URL = 'https://keystoneweb.ca';

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-36 pb-24">
        <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate max-w-none space-y-10 text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Who We Are</h2>
            <p>
              {COMPANY} (&ldquo;Keystone,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the website builder
              platform at <a href={APP_URL} className="text-red-600 hover:underline">{APP_URL}</a>. This Privacy Policy explains how we
              collect, use, and protect your personal information when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>
                <strong>Account information:</strong> Your name, email address, and password when you create an account.
              </li>
              <li>
                <strong>Billing information:</strong> Payment is processed by Stripe, Inc. We do not store your credit card details.
                Stripe may retain billing records per their own privacy policy.
              </li>
              <li>
                <strong>Usage data:</strong> Pages visited, features used, and interactions within the platform, collected to improve our service.
              </li>
              <li>
                <strong>Site content:</strong> Text, images, and other content you create and publish using Keystone.
              </li>
              <li>
                <strong>Visitor analytics:</strong> Aggregate traffic data for sites you publish, including page views and visitor counts. We do not track individual visitors across the web.
              </li>
              <li>
                <strong>Domain information:</strong> Domain names registered or transferred through your account.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>To provide and maintain the Keystone platform and your published websites.</li>
              <li>To process payments and manage your subscription via Stripe.</li>
              <li>To communicate with you about your account, billing, and service updates.</li>
              <li>To respond to support requests and inquiries.</li>
              <li>To improve and develop new features of the platform.</li>
              <li>To comply with applicable legal obligations.</li>
            </ul>
            <p className="mt-3 text-sm">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Cookies & Tracking</h2>
            <p className="mb-2">
              Keystone uses cookies and similar technologies to keep you signed in, remember your preferences,
              and understand how the platform is being used. We use session cookies (cleared when you close your browser)
              and persistent cookies (retained between sessions).
            </p>
            <p className="text-sm">
              We do not use third-party advertising cookies or cross-site tracking technologies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Data Sharing</h2>
            <p className="mb-3">We share your information only in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>
                <strong>Stripe:</strong> For payment processing. Stripe&rsquo;s privacy policy governs their handling of your data.
              </li>
              <li>
                <strong>Supabase:</strong> Our database and authentication provider. Data is stored in secure, encrypted infrastructure.
              </li>
              <li>
                <strong>Domain registrars:</strong> When you register a domain, your information may be shared with the relevant registrar as required by ICANN policy.
              </li>
              <li>
                <strong>Legal requirements:</strong> We may disclose your information if required by law, court order, or governmental authority.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you close your account, we will delete
              your personal information within 90 days, except where retention is required by law or for fraud prevention purposes.
              Published site content is taken offline within 30 days of account termination (see our{' '}
              <Link href="/terms" className="text-red-600 hover:underline">Terms of Service</Link>).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Your Rights</h2>
            <p className="mb-3">
              As a resident of Canada (or the EU/EEA), you have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate information.</li>
              <li>Request deletion of your personal information (subject to legal obligations).</li>
              <li>Withdraw consent where processing is based on consent.</li>
              <li>Lodge a complaint with your applicable privacy authority.</li>
            </ul>
            <p className="mt-3 text-sm">
              To exercise any of these rights, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-red-600 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Security</h2>
            <p>
              We implement industry-standard security measures including encrypted connections (HTTPS/TLS), secure
              credential storage, and access controls. No method of transmission over the internet is 100% secure,
              but we take the protection of your data seriously and review our practices regularly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">9. Children&rsquo;s Privacy</h2>
            <p>
              Keystone is not intended for use by individuals under the age of 16. We do not knowingly collect
              personal information from children. If you believe a child has provided us with personal data,
              please contact us and we will promptly delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated via email
              or a notice in your dashboard. The effective date at the top of this page will always reflect the
              most recent revision.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">11. Contact</h2>
            <p>
              Questions or concerns about this Privacy Policy? Reach us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-red-600 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-slate-100 text-xs text-slate-400 flex gap-4">
          <Link href="/terms" className="hover:text-slate-600 underline">Terms of Service</Link>
          <Link href="/" className="hover:text-slate-600 underline">Home</Link>
        </div>
      </div>

      <MarketingFooter />
    </main>
  );
}
