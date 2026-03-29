'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, CreditCard, BarChart3, Globe, Truck, Layers, Tag, RefreshCw } from 'lucide-react';
import Header from '../../../components/Header';
import MarketingFooter from '../../../components/MarketingFooter';

const FEATURES = [
  {
    title: 'Stripe-Powered Checkouts',
    description: 'Every transaction secured by Stripe. Accept credit cards, Apple Pay, and Google Pay right out of the box.',
    icon: <CreditCard className="w-6 h-6 text-blue-500" />,
  },
  {
    title: 'Product Catalogue Builder',
    description: 'Add unlimited products with photos, variants, and pricing. Organize them into collections with a drag-and-drop editor.',
    icon: <Layers className="w-6 h-6 text-purple-500" />,
  },
  {
    title: 'Order Management',
    description: 'Track every order from placement to delivery in your built-in dashboard. Export orders and manage fulfilment with ease.',
    icon: <Truck className="w-6 h-6 text-amber-500" />,
  },
  {
    title: 'Discounts & Promo Codes',
    description: 'Run sales, create promo codes, and apply percentage or flat discounts to drive conversions.',
    icon: <Tag className="w-6 h-6 text-red-500" />,
  },
  {
    title: 'Sales Analytics',
    description: 'Monitor revenue, top products, and conversion rates in real time. Understand what is driving your growth.',
    icon: <BarChart3 className="w-6 h-6 text-indigo-500" />,
  },
  {
    title: 'Custom Domain & SEO',
    description: 'Publish on your own domain with automatic SSL. Built-in SEO tools help your products rank on Google.',
    icon: <Globe className="w-6 h-6 text-emerald-500" />,
  },
];

export default function EcommerceIndustryPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-white">
        <div className="mx-auto max-w-4xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 text-red-600 font-bold text-sm mb-6 border border-red-100 shadow-sm"
          >
            <ShoppingBag className="w-4 h-4" />
            E-Commerce & Online Retail
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-slate-900"
          >
            Sell More.
            <br />
            <span className="text-red-600">Start Today.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Launch a beautiful online store in minutes. Built-in payments, product management, and
            order tracking — everything you need to turn your passion into profit, no tech skills required.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/onboarding"
              className="inline-block px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              Open Your Store
            </Link>
            <Link
              href="/pricing"
              className="inline-block px-8 py-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-lg transition-all"
            >
              See Pricing
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-black text-slate-900 mb-4">Everything You Need to Scale</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              A complete commerce platform built for Canadian small businesses. No plugins, no bolt-ons.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white rounded-2xl p-8 border border-slate-200 hover:border-red-200 hover:shadow-lg transition-all duration-300"
              >
                <div className="mb-5 w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Template Showcase */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="text-4xl font-black text-slate-900 mb-4">Storefronts That Sell</h2>
            <p className="text-slate-600 max-w-xl mx-auto text-lg">
              High-energy templates built to convert browsers into buyers.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                name: 'Vivid',
                tagline: 'Bold. Energetic. In your face.',
                description: 'Punchy headlines and saturated color stop the scroll and make your products impossible to ignore.',
                badge: 'bg-orange-100 text-orange-800',
                image: '/templates/2.png',
              },
              {
                name: 'Vibrant',
                tagline: 'Playful. Gradient. Dynamic.',
                description: 'Gradient headers and rounded product cards create a shopping experience that feels fresh and trustworthy.',
                badge: 'bg-pink-100 text-pink-800',
                image: '/templates/8.png',
              },
            ].map((tmpl, i) => (
              <motion.div
                key={tmpl.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-red-300 hover:shadow-xl transition-all duration-300"
              >
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={tmpl.image}
                    alt={`${tmpl.name} template preview`}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Link href="/onboarding" className="px-5 py-2.5 bg-white text-slate-900 font-bold rounded-full shadow-lg hover:scale-105 transition-transform">
                      Use {tmpl.name}
                    </Link>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-black text-slate-900">{tmpl.name}</h3>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${tmpl.badge}`}>{tmpl.tagline}</span>
                  </div>
                  <p className="text-slate-600 text-sm">{tmpl.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/templates" className="text-sm font-semibold text-red-600 hover:text-red-700 transition-colors">
              See all 8 templates →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t-8 border-red-600 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-black text-white mb-4">Your store deserves better than a marketplace listing.</h2>
          <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
            Own your brand, own your customers, own your storefront. Launch today for $15/month.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-10 py-5 rounded-full bg-red-600 text-white font-bold text-lg hover:bg-red-500 transition-all shadow-2xl hover:shadow-red-500/30"
          >
            Launch My Store
          </Link>
        </motion.div>
      </section>

      <MarketingFooter />
    </main>
  );
}
