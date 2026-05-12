import Link from 'next/link';
import Header from '@/app/components/Header';
import MarketingFooter from '@/app/components/MarketingFooter';

const EFFECTIVE_DATE = 'March 27, 2026';
const COMPANY = 'Keystone Web Design';
const CONTACT_EMAIL = 'support@keystoneweb.ca';
const APP_URL = 'https://keystoneweb.ca';

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-36 pb-24">
        <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate max-w-none space-y-10 text-slate-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using {COMPANY} (&ldquo;Keystone,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) at{' '}
              <a href={APP_URL} className="text-red-600 hover:underline">{APP_URL}</a>, you agree to be bound by these Terms of Service
              (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the service.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Description of Service</h2>
            <p>
              Keystone provides a website builder platform, including drag-and-drop editing, AI-assisted site generation,
              domain registration and management, site publishing, and related tools (collectively, the &ldquo;Service&rdquo;).
              Features available to you depend on the subscription plan you have purchased.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Subscription Plans</h2>
            <p className="mb-3">
              Keystone offers paid subscription plans (&ldquo;Basic&rdquo; and &ldquo;Pro&rdquo;) billed monthly or annually.
              Prices are displayed on our{' '}
              <Link href="/pricing" className="text-red-600 hover:underline">Pricing page</Link>{' '}
              and may change with 30 days&rsquo; notice.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li><strong>Basic:</strong> Includes site building, publishing on a Keystone subdomain (<code>yoursite.kswd.ca</code>), and standard support. Custom domains are not available on Basic.</li>
              <li><strong>Pro:</strong> Includes everything in Basic, unlimited sites, custom domain support, one free domain registration per active Pro subscription, and priority support.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Domain Registrations &amp; Renewals</h2>
            <p className="mb-3">
              Pro subscribers may register a domain through Keystone or have a domain transferred to their account as part of a site transfer. The following conditions apply to all domains managed through Keystone:
            </p>
            <ul className="list-disc pl-5 space-y-3 text-sm">
              <li>
                <strong>Active Pro required for renewal.</strong> Domains registered or transferred through Keystone are maintained and renewed solely while the account holder holds an active Pro subscription. If your subscription lapses, downgrades to Basic, or is cancelled, we will <em>not</em> renew the domain at the end of its current registration period.
              </li>
              <li>
                <strong>One-year registration.</strong> Domains are registered for an initial period of one year from the date of registration or transfer.
              </li>
              <li>
                <strong>Expiry &amp; drop.</strong> If your Pro subscription is not active at the time your domain is due for renewal, the domain will be allowed to expire at the end of its registration term. An expired domain is removed from your Keystone dashboard and released back to the public registry. Keystone bears no liability for loss of an expired domain.
              </li>
              <li>
                <strong>Expiry dates.</strong> Your domain expiry date is shown on your Account Settings &rarr; Domains page. It is your responsibility to ensure your subscription remains active before that date if you wish to keep the domain.
              </li>
              <li>
                <strong>Parked domains.</strong> If you downgrade from Pro to Basic, or if you receive a domain via a site transfer but are not on Pro, the domain will appear as &ldquo;Parked&rdquo; in your account. A parked domain is registered but not connected to any live site. It will not renew at expiry unless you upgrade to Pro before the renewal date.
              </li>
              <li>
                <strong>No refunds on domain registrations.</strong> Domain registration fees are non-refundable once the domain has been registered with the registry.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Site Transfers</h2>
            <p className="mb-3">
              Site owners may transfer ownership of a site (and optionally its associated domain) to another user via the Site Transfer feature. By initiating or accepting a site transfer, both parties agree to the following:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Transfer links are valid for 7 days from the time of generation.</li>
              <li>Once accepted, the transfer is permanent and cannot be reversed by Keystone.</li>
              <li>If a domain is included in the transfer, ownership of that domain record passes to the recipient&rsquo;s account. The domain renewal terms in Section 4 apply from that point forward to the recipient.</li>
              <li>If the recipient is not on a Pro plan, any transferred domain will be parked and will not be renewed at expiry unless they upgrade.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Payments &amp; Billing</h2>
            <p className="mb-2">
              Subscriptions are billed in advance on a monthly or annual basis via Stripe. By subscribing, you authorise Keystone to charge your payment method on each renewal date. You may cancel at any time through your Account Settings &rarr; Manage Billing portal; cancellation takes effect at the end of the current billing period.
            </p>
            <p className="text-sm">
              Keystone does not store your payment card details. All payments are processed securely by Stripe, Inc.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Acceptable Use</h2>
            <p className="mb-2">You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Upload, create, or publish illegal, abusive, defamatory, or fraudulent content.</li>
              <li>Distribute malware, spam, or unsolicited commercial messages.</li>
              <li>Infringe third-party intellectual property rights.</li>
              <li>Attempt to gain unauthorised access to any Keystone system or another user&rsquo;s account.</li>
              <li>Resell or sublicense the Service without written permission.</li>
            </ul>
            <p className="mt-3 text-sm">
              Keystone reserves the right to suspend or terminate accounts that violate these rules without prior notice.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Intellectual Property</h2>
            <p>
              You retain ownership of all content you create and publish using the Service. By using Keystone, you grant us a limited, non-exclusive licence to host, display, and deliver your content solely for the purpose of providing the Service. Keystone&rsquo;s platform, templates, and branding remain the exclusive property of {COMPANY}.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">9. Disclaimers &amp; Limitation of Liability</h2>
            <p className="mb-2">
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied. Keystone does not guarantee uninterrupted or error-free operation.
            </p>
            <p className="text-sm">
              To the maximum extent permitted by applicable law, Keystone&rsquo;s total liability for any claim arising out of or relating to these Terms or the Service shall not exceed the amount you paid us in the 3 months preceding the claim. We are not liable for any indirect, incidental, special, or consequential damages.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">10. Termination</h2>
            <p>
              Either party may terminate the agreement at any time. Upon termination, your access to the Service will cease. Published sites will be taken offline within 30 days of account termination. Domain registrations will follow the policy in Section 4.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">11. Sunset Clause &amp; Business Continuity</h2>
            <p className="mb-2">
              In the event that Keystone elects to discontinue the platform in whole, we commit to the following business continuity guarantees:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li><strong>Minimum 90 days&rsquo; notice.</strong> We will provide written notice of platform discontinuation to all active account holders at least 90 days before service ends.</li>
              <li><strong>Complete data export.</strong> During the notice period, you will have access to a complete export of your site content and data so that you can move your site to an independent hosting environment.</li>
            </ul>
            <p className="mt-3 text-sm">
              This section does not apply to suspension or termination of an individual account under Section 7 (Acceptable Use) or Section 10 (Termination).
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">12. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated by email or via a notice in the dashboard. Continued use of the Service after the effective date of updated Terms constitutes acceptance.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Province of Ontario, Canada, without regard to conflict-of-law principles. Any disputes shall be resolved in the courts of Ontario.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">14. Contact</h2>
            <p>
              Questions about these Terms? Reach us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-red-600 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-slate-100 text-xs text-slate-400 flex gap-4">
          <Link href="/privacy" className="hover:text-slate-600 underline">Privacy Policy</Link>
          <Link href="/" className="hover:text-slate-600 underline">Home</Link>
        </div>
      </div>

      <MarketingFooter />
    </main>
  );
}
