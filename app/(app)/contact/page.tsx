'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Check, ArrowRight } from 'lucide-react';
import Header from '../../components/Header';
import MarketingFooter from '@/app/components/MarketingFooter';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/contact/enterprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, message }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send message.');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white relative overflow-hidden">
      <Header />

      <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-200 rounded-full blur-[100px] opacity-40 -z-10" />

      <section className="pt-40 pb-20 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h1 className="text-5xl md:text-6xl font-black text-black mb-5 tracking-tight">
              Let&apos;s <span className="text-red-600">Talk</span>.
            </h1>
            <p className="text-xl text-slate-600 font-medium max-w-2xl mx-auto">
              Need more than 5 sites, multiple custom domains, or a custom integration?
              Tell us what you&apos;re building and we&apos;ll put together a plan that fits.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Left: Why contact us */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-6">Custom plans for growing teams</h2>
                <ul className="space-y-4">
                  {[
                    { title: 'More than 5 sites', desc: 'Manage a large portfolio, a multi-location business, or build for clients.' },
                    { title: 'Multiple custom domains', desc: 'Each of your sites with its own branded domain — no limits.' },
                    { title: 'White-label & reseller options', desc: 'Build on Keystone under your own brand for your clients.' },
                    { title: 'Dedicated support', desc: 'A direct line to our team for fast, hands-on help.' },
                    { title: 'Custom integrations', desc: 'Connect your CRM, POS, booking system, or anything else.' },
                  ].map(({ title, desc }) => (
                    <li key={title} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{title}</p>
                        <p className="text-sm text-slate-500">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <p className="text-sm font-semibold text-slate-900 mb-1">Response time</p>
                <p className="text-sm text-slate-600">We typically respond within 1 business day.</p>
              </div>
            </motion.div>

            {/* Right: Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {success ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Message Sent!</h3>
                  <p className="text-slate-600 text-sm mb-6">
                    Thanks for reaching out. We&apos;ll get back to you within 1 business day.
                  </p>
                  <a
                    href="/pricing"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
                  >
                    View our plans <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-5"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="jane@company.com"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Company / Organization <span className="text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="company"
                      type="text"
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      placeholder="Acme Corp"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      What are you looking for? <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="message"
                      required
                      rows={5}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Tell us about your use case, how many sites you need, what integrations you're looking for..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors resize-none"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                  >
                    {loading ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
