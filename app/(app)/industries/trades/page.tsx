'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Hammer, CalendarCheck, ShieldCheck, MapPin, Image as ImageIcon, ListChecks, PhoneCall, Star } from 'lucide-react';
import t5 from '../../../../assets/templates/5.png';
import t6 from '../../../../assets/templates/6.png';
import Header from '../../../components/Header';
import MarketingFooter from '../../../components/MarketingFooter';

const FEATURES = [
  {
    title: 'Online Booking',
    description: 'Let customers schedule jobs, request estimates, and pick time slots — 24/7, without a phone call.',
    icon: <CalendarCheck className="w-6 h-6 text-amber-600" />,
  },
  {
    title: 'One-Tap Calling',
    description: 'Mobile-first design puts your phone number front and centre. Emergency calls happen in a single tap.',
    icon: <PhoneCall className="w-6 h-6 text-red-500" />,
  },
  {
    title: 'Local SEO Built-In',
    description: 'Structured data, Google Maps integration, and local keyword tools help you rank in your service area.',
    icon: <MapPin className="w-6 h-6 text-emerald-600" />,
  },
  {
    title: 'Reviews & Trust Signals',
    description: 'Showcase your 5-star Google reviews directly on your site. Win jobs before you even pick up the phone.',
    icon: <Star className="w-6 h-6 text-yellow-500" />,
  },
  {
    title: 'Project Galleries',
    description: 'Before-and-after photo carousels show the quality of your work. Let the results speak for themselves.',
    icon: <ImageIcon className="w-6 h-6 text-blue-500" />,
  },
  {
    title: 'Services & Pricing Menus',
    description: 'Clearly list your specializations, service areas, and pricing tiers so the right customers find you.',
    icon: <ListChecks className="w-6 h-6 text-indigo-500" />,
  },
];

export default function TradesIndustryPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-white">
        <div className="mx-auto max-w-4xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-700 font-bold text-sm mb-6 border border-amber-200 shadow-sm"
          >
            <Hammer className="w-4 h-4" />
            Built for Plumbers, Electricians & Contractors
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-slate-900"
          >
            More Jobs,
            <br />
            <span className="text-amber-600">Less Chasing.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Your trade business needs a website that works as hard as you do. Look professional online,
            rank higher locally, and fill your calendar — all without touching a line of code.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
          >
            <Link
              href="/onboarding"
              className="inline-block px-8 py-4 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              Get Your Site Live Today
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
            <h2 className="text-4xl font-black text-slate-900 mb-4">Tools of the Trade</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              Everything the modern contractor needs to win work online.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 hover:border-amber-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="mb-5 w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
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
            <h2 className="text-4xl font-black text-slate-900 mb-4">Templates Built for Your Trade</h2>
            <p className="text-slate-600 max-w-xl mx-auto text-lg">
              Two distinct looks, both designed to convert homeowners into booked customers.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                name: 'Classic',
                tagline: 'Structured. Trusted. Timeless.',
                description: 'The utility-bar layout and traditional nav signal reliability — exactly what a homeowner wants before handing you their keys.',
                badge: 'bg-blue-100 text-blue-800',
                image: t5,
              },
              {
                name: 'Organic',
                tagline: 'Warm. Natural. Human.',
                description: 'Earthy tones and rounded shapes give your business a personal, approachable feel that stands out from the competition.',
                badge: 'bg-lime-100 text-lime-800',
                image: t6,
              },
            ].map((tmpl, i) => (
              <motion.div
                key={tmpl.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-amber-300 hover:shadow-xl transition-all duration-300"
              >
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={tmpl.image}
                    alt={`${tmpl.name} template preview`}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 50vw"
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t-8 border-amber-500 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-black text-white mb-4">Stop losing jobs to competitors with better websites.</h2>
          <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
            Launch in minutes. Look like the best in your area from day one.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-10 py-5 rounded-full bg-amber-500 text-slate-900 font-bold text-lg hover:bg-amber-400 transition-all shadow-2xl hover:shadow-amber-500/30"
          >
            Build My Trade Website
          </Link>
        </motion.div>
      </section>

      <MarketingFooter />
    </main>
  );
}
