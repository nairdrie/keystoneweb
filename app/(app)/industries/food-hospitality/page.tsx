'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Utensils, CalendarCheck, Image as ImageIcon, Globe, MessageSquare, Sparkles, MapPin, Star } from 'lucide-react';
import Header from '../../../components/Header';
import MarketingFooter from '../../../components/MarketingFooter';

const FEATURES = [
  {
    title: 'Beautiful Food Photography',
    description: 'Gallery blocks and hero images that make your dishes, drinks, and space look incredible on every screen.',
    icon: <ImageIcon className="w-6 h-6 text-amber-500" />,
  },
  {
    title: 'Online Reservations',
    description: 'Accept table bookings and event reservations directly on your site. Fill seats without relying on third-party apps.',
    icon: <CalendarCheck className="w-6 h-6 text-emerald-600" />,
  },
  {
    title: 'Menu Builder',
    description: 'Publish your full menu with sections, descriptions, and pricing — easy to update any time without a developer.',
    icon: <Utensils className="w-6 h-6 text-red-500" />,
  },
  {
    title: 'Local SEO & Maps',
    description: 'Get found when locals search "best restaurant near me." Built-in Google Maps and local SEO tools do the work for you.',
    icon: <MapPin className="w-6 h-6 text-blue-500" />,
  },
  {
    title: 'Reviews & Testimonials',
    description: 'Showcase your best reviews from Google and other platforms to give hungry visitors the confidence to book.',
    icon: <Star className="w-6 h-6 text-yellow-500" />,
  },
  {
    title: 'AI-Generated Copy',
    description: 'Describe your concept and the AI writes your about section, taglines, and menu descriptions in your brand voice.',
    icon: <Sparkles className="w-6 h-6 text-violet-500" />,
  },
];

export default function FoodHospitalityIndustryPage() {
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-800 font-bold text-sm mb-6 border border-amber-200 shadow-sm"
          >
            <Utensils className="w-4 h-4" />
            Restaurants, Cafes & Catering
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-slate-900"
          >
            Make Them Hungry
            <br />
            <span className="text-amber-600">Before They Arrive.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Your food deserves a website that does it justice. Build a stunning online presence that shows off your
            menu, accepts reservations, and keeps your tables full — starting today.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/onboarding"
              className="inline-block px-8 py-4 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              Build My Restaurant Site
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-amber-50 border-t border-amber-100">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-black text-slate-900 mb-4">Built for Hospitality</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              Everything a restaurant, café, or caterer needs to turn their website into their best front-of-house staff member.
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
                className="bg-white rounded-2xl p-8 shadow-sm border border-amber-100 hover:border-amber-300 hover:shadow-lg transition-all duration-300"
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
            <h2 className="text-4xl font-black text-slate-900 mb-4">Templates That Whet the Appetite</h2>
            <p className="text-slate-600 max-w-xl mx-auto text-lg">
              Warm, inviting designs that make visitors feel the ambiance before they walk through the door.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                name: 'Organic',
                tagline: 'Warm. Natural. Human.',
                description: 'Earthy tones and natural textures create an inviting atmosphere that pairs beautifully with food photography.',
                accent: 'from-lime-700 to-emerald-800',
                badge: 'bg-lime-100 text-lime-800',
              },
              {
                name: 'Vivid',
                tagline: 'Bold. Energetic. In your face.',
                description: 'Saturated colors and strong typography that make your brand impossible to forget — perfect for casual dining and fast-casual.',
                accent: 'from-orange-600 to-red-600',
                badge: 'bg-orange-100 text-orange-800',
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
                <div className={`relative aspect-video bg-gradient-to-br ${tmpl.accent} flex items-center justify-center`}>
                  <div className="text-center">
                    <div className="text-white/20 text-6xl font-black">{tmpl.name[0]}</div>
                    <div className="text-white/40 text-xs font-medium uppercase tracking-widest mt-1">Screenshot coming soon</div>
                  </div>
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
          <h2 className="text-4xl font-black text-white mb-4">Your next regular customer is online right now.</h2>
          <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
            Give them a reason to choose you. Launch in minutes, starting at $15/month.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-10 py-5 rounded-full bg-amber-500 text-slate-900 font-bold text-lg hover:bg-amber-400 transition-all shadow-2xl hover:shadow-amber-500/30"
          >
            Get My Site Live
          </Link>
        </motion.div>
      </section>

      <MarketingFooter />
    </main>
  );
}
