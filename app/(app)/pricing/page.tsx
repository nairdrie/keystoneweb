'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, Loader2, ChevronDown, ArrowRight } from 'lucide-react';
import Header from '../../components/Header';
import MarketingFooter from '@/app/components/MarketingFooter';

const STRIPE_PRICES = {
  basic: {
    monthly: 'price_1TCZSU9e8C5naDN47tc8rB74', // $30/mo
    yearly: 'price_1TCZSm9e8C5naDN4d8Zctb6D',  // $180/yr
  },
  pro: {
    monthly: 'price_1TCZRk9e8C5naDN44O78PCfh', // $60/mo
    yearly: 'price_1TCZRS9e8C5naDN4LtllOW7G',  // $360/yr
  },
};

const MONTHLY_PRICES = { basic: 30, pro: 60 };
const YEARLY_PRICES = { basic: 15, pro: 30 };

interface CheckoutData {
  siteId?: string;
  priceId: string;
  planName: string;
}

// Downgrade warning modal shown to Pro users before downgrading
function DowngradeWarningModal({
  publishedSiteCount,
  hasCustomDomain,
  onConfirm,
  onCancel,
  loading,
}: {
  publishedSiteCount: number;
  hasCustomDomain: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in-95">
        <h2 className="text-xl font-black text-slate-900 mb-2">Before you downgrade</h2>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          Downgrading to Basic will take effect at the end of your current billing period. Here&apos;s what will change:
        </p>
        <ul className="space-y-3 mb-6">
          <li className="flex gap-3 text-sm">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">!</span>
            <span className="text-slate-700">
              <strong>Published site limit drops to 1.</strong>{' '}
              {publishedSiteCount > 1
                ? `You currently have ${publishedSiteCount} published sites. We'll keep your most recently published site live and unpublish the rest.`
                : 'You currently have 1 published site — no change needed.'}
            </span>
          </li>
          {hasCustomDomain && (
            <li className="flex gap-3 text-sm">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">!</span>
              <span className="text-slate-700">
                <strong>Your custom domain will be disconnected.</strong> It remains yours and parked until its renewal date. Custom domains require a Pro plan.
              </span>
            </li>
          )}
          <li className="flex gap-3 text-sm">
            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">i</span>
            <span className="text-slate-500">All your site drafts and content are preserved — nothing is deleted.</span>
          </li>
        </ul>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Keep Pro
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Downgrade to Basic
          </button>
        </div>
      </div>
    </div>
  );
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isPublishFlow = searchParams.get('action') === 'publish';
  const siteId = searchParams.get('siteId');
  const isCanceled = searchParams.get('canceled') === 'true';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(true);
  const [faqOpen, setFaqOpen] = useState<string | null>(null);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [publishedSiteCount, setPublishedSiteCount] = useState(0);
  const [hasCustomDomain, setHasCustomDomain] = useState(false);
  const [pendingDowngradePriceId, setPendingDowngradePriceId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/user/subscription', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.subscription?.subscription_status === 'active') {
          setActivePlan(data.subscription.subscription_plan);
        }
      })
      .catch(console.error);

    // Fetch published site count for downgrade warning
    fetch('/api/user/sites', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        const sites = data.sites || [];
        const published = sites.filter((s: { isPublished?: boolean }) => s.isPublished);
        setPublishedSiteCount(published.length);
        setHasCustomDomain(sites.some((s: { customDomain?: string }) => s.customDomain));
      })
      .catch(console.error);
  }, []);

  const isBasic = activePlan?.toLowerCase().includes('basic');
  const isPro = activePlan?.toLowerCase().includes('pro');

  const handleCheckout = async (planName: 'Basic' | 'Pro', priceId: string) => {
    // If Pro user downgrading to Basic, show warning first
    if (isPro && planName === 'Basic') {
      setPendingDowngradePriceId(priceId);
      setShowDowngradeWarning(true);
      return;
    }
    await executeCheckout(planName, priceId);
  };

  const executeCheckout = async (planName: 'Basic' | 'Pro', priceId: string) => {
    setLoading(true);
    setError(null);

    try {
      if (!priceId || priceId === 'price_') {
        throw new Error('Stripe Price IDs not configured. Ask admin to set STRIPE_PRICES.');
      }

      if (!siteId && isPublishFlow) {
        throw new Error('Site ID is required to publish');
      }

      const checkoutData: CheckoutData = {
        priceId,
        planName,
        ...(isPublishFlow && siteId && { siteId }),
      };

      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(checkoutData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await res.json();

      if (!url) {
        throw new Error('No checkout URL returned from server');
      }

      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redirect to checkout');
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (id: string) => setFaqOpen(faqOpen === id ? null : id);

  return (
    <section className="pt-40 pb-20 px-4 sm:px-6 lg:px-8 relative z-10">
      {showDowngradeWarning && pendingDowngradePriceId && (
        <DowngradeWarningModal
          publishedSiteCount={publishedSiteCount}
          hasCustomDomain={hasCustomDomain}
          loading={loading}
          onCancel={() => { setShowDowngradeWarning(false); setPendingDowngradePriceId(null); }}
          onConfirm={() => {
            setShowDowngradeWarning(false);
            executeCheckout('Basic', pendingDowngradePriceId);
          }}
        />
      )}

      <div className="mx-auto max-w-5xl text-center mb-16">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl md:text-6xl font-black text-black mb-6 tracking-tight"
        >
          Simple, Transparent <span className="text-red-600">Pricing</span>.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-xl text-slate-900 font-medium max-w-2xl mx-auto mb-8"
        >
          {isPublishFlow
            ? 'Choose a plan to publish your site to the web.'
            : 'Simple pricing. No hidden fees. Pick the plan that fits your business.'}
        </motion.p>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-4"
        >
          <span className={`text-sm font-semibold ${!isYearly ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none ${isYearly ? 'bg-red-600' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${isYearly ? 'translate-x-7' : 'translate-x-0'}`}
            />
          </button>
          <span className={`text-sm font-semibold ${isYearly ? 'text-slate-900' : 'text-slate-400'}`}>
            Yearly
          </span>
          {isYearly && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
              Save 50%
            </span>
          )}
        </motion.div>
      </div>

      {error && (
        <div className="mb-8 max-w-5xl mx-auto bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isCanceled && (
        <div className="mb-8 max-w-5xl mx-auto bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">
            Checkout was canceled. Please select a plan below to continue.
          </p>
        </div>
      )}

      {/* Plan Cards — 3-column grid */}
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 items-stretch">
        {/* Basic Plan */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl relative flex flex-col"
        >
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">Basic</h3>
            <p className="text-slate-500 mb-6">Ideal for local shops and new businesses.</p>
            <div className="mb-8">
              <div className="flex items-end gap-2 flex-wrap">
                <span className="text-5xl font-black text-slate-900">
                  ${isYearly ? YEARLY_PRICES.basic : MONTHLY_PRICES.basic}
                </span>
                <span className="text-slate-500 font-medium">/month</span>
              </div>
              {isYearly && (
                <p className="text-sm text-slate-400 mt-1">
                  <span className="line-through">${MONTHLY_PRICES.basic}/mo</span>
                  {' · '}billed ${YEARLY_PRICES.basic * 12}/yr
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              {[
                'Unlimited Site Pages',
                'AI Site Builder (Limited Use)',
                'Drag-and-Drop Visual Editor',
                'Access to all Premium Templates',
                'Up to 10,000 monthly visitors',
                '1 GB media storage',
                'Email Support',
                'Keystone Subdomain (yoursite.kswd.ca)',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-slate-700 text-sm">
                  <Check className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold text-emerald-800 mb-1">Worry-Free Scaling</p>
              <p className="text-xs text-emerald-700">
                If traffic spikes, your site never goes down. Just <strong>$1.00 per 1,000 extra visitors</strong>, billed automatically at month-end.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleCheckout('Basic', isYearly ? STRIPE_PRICES.basic.yearly : STRIPE_PRICES.basic.monthly)}
            disabled={loading || isBasic}
            className="mt-auto block w-full py-4 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-900 font-bold text-center transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isBasic
              ? 'Current Plan'
              : isPro
                ? 'Downgrade to Basic'
                : loading
                  ? 'Redirecting...'
                  : isPublishFlow
                    ? 'Publish with Basic'
                    : 'Choose Basic'}
          </button>
        </motion.div>

        {/* Pro Plan */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-slate-950 rounded-3xl p-8 border border-slate-800 shadow-2xl relative flex flex-col"
        >
          <div className="absolute top-0 right-8 -translate-y-1/2 bg-red-600 outline outline-4 outline-white text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
            Most Popular
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white mb-1">Pro</h3>
            <p className="text-slate-300 mb-6 font-medium">
              {isPublishFlow
                ? 'Everything you need to grow your business online.'
                : 'Built for growing businesses with high traffic.'}
            </p>
            <div className="mb-8">
              <div className="flex items-end gap-2 flex-wrap">
                <span className="text-5xl font-black text-white">
                  ${isYearly ? YEARLY_PRICES.pro : MONTHLY_PRICES.pro}
                </span>
                <span className="text-slate-300 font-medium tracking-wide">/month</span>
              </div>
              {isYearly && (
                <p className="text-sm text-slate-400 mt-1">
                  <span className="line-through">${MONTHLY_PRICES.pro}/mo</span>
                  {' · '}billed ${YEARLY_PRICES.pro * 12}/yr
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              {[
                { text: 'Everything in Basic', bold: true },
                { text: 'Increased AI Builder Limits', bold: true },
                { text: 'Build & Publish up to 5 Sites*', bold: true },
                { text: 'Custom Domain Support + Free Domain Included*', bold: true },
                { text: 'Up to 50,000 monthly visitors', bold: true },
                { text: '5 GB media storage', bold: true },
                { text: '24/7 Priority Email Support', bold: true },
                { text: 'Custom HTML Content & CSS', bold: true },
              ].map(({ text, bold }) => (
                <li key={text} className={`flex items-start gap-3 text-sm ${bold ? 'text-slate-200 font-medium' : 'text-slate-300'}`}>
                  <Check className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="bg-emerald-900/40 border border-emerald-700/50 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold text-emerald-300 mb-1">Worry-Free Scaling</p>
              <p className="text-xs text-emerald-200/80">
                If traffic spikes, your site never goes down. Just <strong>$0.50 per 1,000 extra visitors</strong>, billed automatically at month-end.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleCheckout('Pro', isYearly ? STRIPE_PRICES.pro.yearly : STRIPE_PRICES.pro.monthly)}
            disabled={loading || isPro}
            className="mt-auto block w-full py-4 px-6 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-center transition-colors shadow-lg hover:shadow-red-600/25 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPro
              ? 'Current Plan'
              : isBasic
                ? 'Upgrade to Pro'
                : loading
                  ? 'Redirecting...'
                  : isPublishFlow
                    ? 'Publish with Pro'
                    : 'Choose Pro'}
          </button>
        </motion.div>

        {/* Custom / Enterprise Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-200 relative flex flex-col"
        >
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">Custom</h3>
            <p className="text-slate-500 mb-6">Need more? Let&apos;s build something together.</p>
            <div className="mb-8">
              <span className="text-3xl font-black text-slate-900">Let&apos;s talk</span>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                'More than 5 published sites',
                'Multiple custom domains',
                'Dedicated priority support',
                'Custom integrations',
                'Volume pricing',
                'White-label options',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-slate-700 text-sm">
                  <Check className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <a
            href="/contact"
            className="mt-auto flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-center transition-colors"
          >
            Contact Us
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>

      {/* Fine print */}
      <div className="max-w-5xl mx-auto mt-6 px-2">
        <p className="text-xs text-slate-400 leading-relaxed">
          * Your Pro plan includes up to 5 simultaneously published sites. All sites can be published on a Keystone subdomain (yoursite.kswd.ca). One free custom domain registration is included per account and can be assigned to one of your published sites at a time. Switching to a different custom domain is available once per month for a one-time registration fee.
        </p>
      </div>

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="max-w-3xl mx-auto mt-20"
      >
        <h2 className="text-2xl font-black text-slate-900 text-center mb-8">
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {[
            {
              id: 'fair-use',
              q: 'What happens if I go over my visitor limit?',
              a: 'We don\'t believe in punishing success. If your business goes viral, we keep your site lightning-fast and online. You will only ever be charged a few cents for the extra traffic your site generates, billed automatically at the end of the month. Basic plans pay $1.00 per 1,000 extra visitors, Pro plans pay $0.50 per 1,000.',
            },
            {
              id: 'what-counts',
              q: 'What counts as a "visitor"?',
              a: 'A visitor is a unique person who views your website in a given month. If the same person visits your site 10 times, that still counts as 1 visitor. Page views (how many pages they look at) are tracked separately and do not count toward your limit.',
            },
            {
              id: 'storage',
              q: 'What counts toward media storage?',
              a: 'Media storage includes photos, logos, and any files you upload through the editor. Your site\'s code and text content don\'t count. Basic gets 1 GB (plenty for dozens of high-quality photos), and Pro gets 5 GB.',
            },
            {
              id: 'billing',
              q: 'How does overage billing work?',
              a: 'At the end of each billing cycle, we calculate how many visitors you had above your plan\'s included amount. The overage charge is bundled into your regular invoice alongside your base subscription fee — one clean charge to your card on file. You can track your usage in real-time from your admin dashboard.',
            },
            {
              id: 'no-surprise',
              q: 'Will I get a surprise bill?',
              a: 'No surprises. Your admin dashboard shows real-time visitor counts and projected overage costs so you always know where you stand. For most small businesses, you\'ll never exceed your plan limits. Even if you do, the overage charges are designed to be very small — a few dollars at most.',
            },
            {
              id: 'custom-domain',
              q: 'Can I use my own domain name?',
              a: 'Custom domain support is a Pro feature. On Basic, your site is published on a Keystone subdomain (yoursite.kswd.ca). Upgrading to Pro unlocks full custom domain support and includes one free domain registration. You can switch your custom domain once per month for a one-time registration fee.',
            },
            {
              id: 'site-limit',
              q: 'How many sites can I publish?',
              a: 'Basic plans allow 1 published site at a time. Pro plans allow up to 5 simultaneously published sites. You can create unlimited draft sites on any plan — the limit only applies to sites that are live on the web. You can unpublish a site at any time to free up a slot for another.',
            },
          ].map(({ id, q, a }) => (
            <div key={id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleFaq(id)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="text-sm font-bold text-slate-900">{q}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 ml-4 transition-transform ${faqOpen === id ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen === id && (
                <div className="px-6 pb-5">
                  <p className="text-sm text-slate-600 leading-relaxed">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white relative overflow-hidden">
      <Header />

      <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-200 rounded-full blur-[100px] opacity-50 -z-10" />

      <Suspense fallback={<div className="pt-40 text-center">Loading...</div>}>
        <PricingContent />
      </Suspense>
      <MarketingFooter />
    </main>
  );
}
