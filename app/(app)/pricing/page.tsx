'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import Header from '../../components/Header';


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

  useEffect(() => {
    fetch('/api/user/subscription', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.subscription?.subscription_status === 'active') {
          setActivePlan(data.subscription.subscription_plan);
        }
      })
      .catch(console.error);
  }, []);

  const isBasic = activePlan?.toLowerCase().includes('basic');
  const isPro = activePlan?.toLowerCase().includes('pro');

  const handleCheckout = async (planName: 'Basic' | 'Pro', priceId: string) => {
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

      // Redirect to specific Stripe Checkout URL provided by API
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redirect to checkout');
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="pt-40 pb-20 px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="mx-auto max-w-4xl text-center mb-16">
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

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
        {/* Basic Plan */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl relative"
        >
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Basic</h3>
          <p className="text-slate-500 mb-6">Perfect for small businesses getting started.</p>
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

          <ul className="space-y-4 mb-8">
            {[
              'Unlimited Site Pages',
              'Access to all Premium Templates',
              'Drag-and-Drop Visual Editor',
              'AI Builder (3 prompts/day)',
              'Email Support',
              'Basic SEO Tools',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-slate-700">
                <Check className="w-5 h-5 text-red-500 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleCheckout('Basic', isYearly ? STRIPE_PRICES.basic.yearly : STRIPE_PRICES.basic.monthly)}
            disabled={loading || isBasic}
            className="block w-full py-4 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-900 font-bold text-center transition-colors flex items-center justify-center gap-2"
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
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-slate-950 rounded-3xl p-8 border border-slate-800 shadow-2xl relative"
        >
          <div className="absolute top-0 right-8 -translate-y-1/2 bg-red-600 outline outline-4 outline-white text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
            Most Popular
          </div>

          <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
          <p className="text-slate-300 mb-6 font-medium">
            {isPublishFlow
              ? 'Everything you need to grow your business online.'
              : 'For serious business owners who want to scale.'}
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

          <ul className="space-y-4 mb-8">
            {[
              'Everything in Basic',
              'Increased AI Builder Limits',
              'Free Custom Domain Included',
              '24/7 Priority Email Support',
              'Advanced Analytics',
              'Custom CSS Injection',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-slate-200 font-medium">
                <Check className="w-5 h-5 text-red-500 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleCheckout('Pro', isYearly ? STRIPE_PRICES.pro.yearly : STRIPE_PRICES.pro.monthly)}
            disabled={loading || isPro}
            className="block w-full py-4 px-6 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-center transition-colors shadow-lg hover:shadow-red-600/25 flex items-center justify-center gap-2"
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
      </div>
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
    </main>
  );
}
