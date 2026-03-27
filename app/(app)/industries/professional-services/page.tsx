'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Briefcase, CalendarCheck, ShieldCheck, Globe, MessageSquare, Sparkles, BarChart3, Users } from 'lucide-react';
import Header from '../../../components/Header';
import MarketingFooter from '../../../components/MarketingFooter';

const FEATURES = [
  {
    title: 'Appointment Scheduling',
    description: 'Let prospects book consultations directly on your site. Choose your availability, set service types, and send automatic confirmations.',
    icon: <CalendarCheck className="w-6 h-6 text-blue-500" />,
  },
  {
    title: 'Credibility & Trust',
    description: 'Showcase your credentials, certifications, and team with professional layout blocks that signal expertise.',
    icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
  },
  {
    title: 'Services & Process',
    description: 'Walk prospects through your process, service packages, and what to expect — turning interested visitors into warm leads.',
    icon: <Briefcase className="w-6 h-6 text-indigo-500" />,
  },
  {
    title: 'Contact & Lead Forms',
    description: 'Custom inquiry forms with email notifications send new leads straight to your inbox the moment they submit.',
    icon: <MessageSquare className="w-6 h-6 text-amber-500" />,
  },
  {
    title: 'AI-Written Content',
    description: 'Describe your practice area and the AI writes polished, professional copy that sounds exactly like you.',
    icon: <Sparkles className="w-6 h-6 text-violet-500" />,
  },
  {
    title: 'SEO & Analytics',
    description: 'Built-in SEO tools and a real-time analytics dashboard show you where your clients are coming from and what is working.',
    icon: <BarChart3 className="w-6 h-6 text-red-500" />,
  },
];

export default function ProfessionalServicesIndustryPage() {
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 font-bold text-sm mb-6 border border-blue-200 shadow-sm"
          >
            <Briefcase className="w-4 h-4" />
            Consultants, Coaches & Professional Services
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-slate-900"
          >
            Your Expertise
            <br />
            <span className="text-blue-700">Deserves Better.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            For consultants, coaches, accountants, lawyers, and freelancers — your website is your most important
            business card. Build a polished, credible site that converts prospects into clients.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/onboarding"
              className="inline-block px-8 py-4 rounded-full bg-blue-700 hover:bg-blue-800 text-white font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              Build My Professional Site
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-blue-50 border-t border-blue-100">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-black text-slate-900 mb-4">Built for Professionals</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              Everything you need to position your expertise, attract the right clients, and grow a sustainable practice.
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
                className="bg-white rounded-2xl p-8 shadow-sm border border-blue-100 hover:border-blue-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="mb-5 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
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
            <h2 className="text-4xl font-black text-slate-900 mb-4">Designs That Command Respect</h2>
            <p className="text-slate-600 max-w-xl mx-auto text-lg">
              Clean, minimal, and authoritative — the way a professional's website should look.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                name: 'Sleek',
                tagline: 'Minimal. Precise. Powerful.',
                description: 'Oversized typography and a restrained color palette communicate confidence, authority, and clarity of thought.',
                accent: 'from-slate-800 to-slate-700',
                badge: 'bg-slate-100 text-slate-800',
              },
              {
                name: 'Classic',
                tagline: 'Structured. Trusted. Timeless.',
                description: 'The traditional layout that says "I have been doing this for years" — trusted by clients across industries.',
                accent: 'from-blue-900 to-slate-900',
                badge: 'bg-blue-100 text-blue-800',
              },
            ].map((tmpl, i) => (
              <motion.div
                key={tmpl.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-xl transition-all duration-300"
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t-8 border-blue-600 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-black text-white mb-4">Stop losing clients to people with better websites.</h2>
          <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
            Build a site that reflects the quality of your work. Launch in minutes, starting at $15/month.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-10 py-5 rounded-full bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition-all shadow-2xl hover:shadow-blue-500/30"
          >
            Build My Professional Site
          </Link>
        </motion.div>
      </section>

      <MarketingFooter />
    </main>
  );
}
