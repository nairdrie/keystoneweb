'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, CalendarCheck, Star, Image as ImageIcon, MessageSquare, Sparkles, Globe, ShieldCheck } from 'lucide-react';
import t1 from '../../../../assets/templates/1.png';
import t3 from '../../../../assets/templates/3.png';
import Header from '../../../components/Header';
import MarketingFooter from '../../../components/MarketingFooter';

const FEATURES = [
  {
    title: 'Online Booking',
    description: 'Clients book appointments directly on your site — choose your services, pick a time, done. No phone tag.',
    icon: <CalendarCheck className="w-6 h-6 text-teal-500" />,
  },
  {
    title: 'AI-Written Content',
    description: 'Describe your practice and the AI generates compelling copy about your services, philosophy, and specializations.',
    icon: <Sparkles className="w-6 h-6 text-violet-500" />,
  },
  {
    title: 'Testimonials Section',
    description: 'Showcase glowing client reviews to build social proof and convert visitors who are still on the fence.',
    icon: <Star className="w-6 h-6 text-yellow-500" />,
  },
  {
    title: 'Services & Pricing',
    description: 'List your treatments, packages, and pricing in a clean, easy-to-scan layout that answers questions before they are asked.',
    icon: <Heart className="w-6 h-6 text-red-500" />,
  },
  {
    title: 'Contact & Intake Forms',
    description: 'Custom contact forms let new clients share their goals and health history before their first appointment.',
    icon: <MessageSquare className="w-6 h-6 text-blue-500" />,
  },
  {
    title: 'Gallery & Portfolio',
    description: 'Show your space, your work, or transformation results with beautiful photo galleries that tell your story.',
    icon: <ImageIcon className="w-6 h-6 text-emerald-500" />,
  },
];

export default function HealthWellnessIndustryPage() {
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 text-teal-700 font-bold text-sm mb-6 border border-teal-200 shadow-sm"
          >
            <Heart className="w-4 h-4" />
            Salons, Spas, Fitness & Wellness
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-slate-900"
          >
            A Website as
            <br />
            <span className="text-teal-600">Beautiful as Your Work.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Whether you run a salon, yoga studio, personal training practice, or wellness clinic —
            your website should feel as good as your services. Build one in minutes, no tech skills needed.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/onboarding"
              className="inline-block px-8 py-4 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              Build My Wellness Site
            </Link>
            <Link
              href="/templates"
              className="inline-block px-8 py-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-lg transition-all"
            >
              Browse Templates
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-teal-50 border-t border-teal-100">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-black text-slate-900 mb-4">Everything You Need to Grow</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              Tools designed for wellness professionals who want to spend less time on admin and more time with clients.
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
                className="bg-white rounded-2xl p-8 shadow-sm border border-teal-100 hover:border-teal-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="mb-5 w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
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
            <h2 className="text-4xl font-black text-slate-900 mb-4">Templates That Reflect Your Brand</h2>
            <p className="text-slate-600 max-w-xl mx-auto text-lg">
              Premium and calming designs for professionals who care about the experience they create.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                name: 'Luxe',
                tagline: 'Refined. Elegant. Unforgettable.',
                description: 'Serif typography, warm gold tones, and a centered layout that signals premium quality to every visitor.',
                badge: 'bg-amber-100 text-amber-800',
                image: t1,
              },
              {
                name: 'Airy',
                tagline: 'Light. Spacious. Breathable.',
                description: 'Soft whites, open layouts, and calming proportions that put your services and imagery front and centre.',
                badge: 'bg-sky-100 text-sky-800',
                image: t3,
              },
            ].map((tmpl, i) => (
              <motion.div
                key={tmpl.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-teal-300 hover:shadow-xl transition-all duration-300"
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
              See all 16 templates →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t-8 border-teal-500 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-black text-white mb-4">Your clients are searching for you right now.</h2>
          <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
            Be the first result they find. Launch your wellness website today.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-10 py-5 rounded-full bg-teal-500 text-white font-bold text-lg hover:bg-teal-400 transition-all shadow-2xl hover:shadow-teal-500/30"
          >
            Get Started Free
          </Link>
        </motion.div>
      </section>

      <MarketingFooter />
    </main>
  );
}
