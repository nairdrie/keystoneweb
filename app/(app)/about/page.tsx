'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, MapPin, Shield, Users } from 'lucide-react';
import Header from '../../components/Header';
import MarketingFooter from '../../components/MarketingFooter';
import mapleLeaf from '../../../assets/maple-leaf.png';

const VALUES = [
  {
    title: 'Built for Small Business',
    description: 'We built Keystone for the people who keep local economies alive — the tradespeople, restaurateurs, freelancers, and shopkeepers who deserve the same online tools as the big players.',
    icon: <Users className="w-6 h-6 text-red-500" />,
  },
  {
    title: 'Simplicity First',
    description: 'A website should not require a developer. Every feature we build is measured against one question: can the owner of a two-person plumbing company figure it out in under five minutes?',
    icon: <Sparkles className="w-6 h-6 text-violet-500" />,
  },
  {
    title: 'Proudly Canadian',
    description: 'We are a Canadian company serving Canadian businesses. Our servers are in Canada, our pricing is fair, and we genuinely care about the communities our customers are part of.',
    icon: <MapPin className="w-6 h-6 text-emerald-600" />,
  },
  {
    title: 'Transparent & Honest',
    description: 'No bait-and-switch pricing. No dark patterns. No surprise fees. Just clear, fair terms and a product that does what it says on the tin.',
    icon: <Shield className="w-6 h-6 text-blue-500" />,
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-bold text-sm mb-6 border border-slate-200"
          >
            <Image src={mapleLeaf} alt="Maple Leaf" className="w-4 h-4 object-contain" />
            Canadian-Made Website Builder
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight leading-tight"
          >
            We Build Tools for
            <br />
            <span className="text-red-600">Real Businesses.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
          >
            Keystone started with a simple observation: getting a professional website was still way
            too complicated and expensive for most small business owners. We set out to fix that.
          </motion.p>
        </div>
      </section>

      {/* Story */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="space-y-6 text-slate-700 text-lg leading-relaxed"
          >
            <p>
              The typical small business owner does not have hours to fiddle with website builders,
              learn design principles, or argue with developers over scope creep. They have customers to
              serve, jobs to finish, and a business to run.
            </p>
            <p>
              We built Keystone so that anyone — a plumber in Sudbury, a café owner in Halifax, a fitness
              trainer in Vancouver — can launch a professional, beautiful website in the time it takes to
              drink a coffee. No technical knowledge required.
            </p>
            <p>
              Our AI handles the heavy lifting: writing your content, choosing your layout, and generating
              a site that actually represents your business. You review, tweak, and publish. It really is
              that simple.
            </p>
            <p>
              We launched on a <span className="font-semibold text-slate-900">$15/month</span> premise because
              we believe a professional online presence should not be a luxury. It should be as accessible
              as a phone plan. Keystone is our commitment to keeping it that way.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-slate-200">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-black text-slate-900 mb-4">What We Stand For</h2>
            <p className="text-slate-600 max-w-xl mx-auto text-lg">
              The principles we build every feature, pricing decision, and support interaction around.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {VALUES.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white rounded-2xl p-8 border border-slate-200 hover:border-red-200 hover:shadow-lg transition-all duration-300"
              >
                <div className="mb-5 w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                  {value.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{value.title}</h3>
                <p className="text-slate-600 leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { stat: '5 min', label: 'Average time to launch' },
              { stat: '$15', label: 'Starting price per month' },
              { stat: '8', label: 'Premium templates included' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="text-4xl md:text-5xl font-black text-red-600 mb-2">{item.stat}</div>
                <div className="text-sm font-semibold text-slate-600">{item.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-red-600 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-black text-white mb-4">Ready to see it for yourself?</h2>
          <p className="text-red-100 text-lg mb-10 max-w-xl mx-auto">
            Launch your website today. No credit card required to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/onboarding"
              className="inline-block px-10 py-5 rounded-full bg-white text-red-600 font-bold text-lg hover:bg-red-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              Get Started Free
            </Link>
            <Link
              href="/pricing"
              className="inline-block px-10 py-5 rounded-full bg-red-700 hover:bg-red-800 text-white font-bold text-lg transition-all"
            >
              See Pricing
            </Link>
          </div>
        </motion.div>
      </section>

      <MarketingFooter />
    </main>
  );
}
