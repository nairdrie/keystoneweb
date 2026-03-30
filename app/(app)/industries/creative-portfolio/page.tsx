'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Palette, Image as ImageIcon, Globe, MessageSquare, Sparkles, BarChart3, Layers, Star } from 'lucide-react';
import t1 from '../../../../assets/templates/1.png';
import t3 from '../../../../assets/templates/3.png';
import Header from '../../../components/Header';
import MarketingFooter from '../../../components/MarketingFooter';

const FEATURES = [
  {
    title: 'Stunning Gallery Layouts',
    description: 'Full-bleed image carousels and masonry grids showcase your photography, art, or design work at its very best.',
    icon: <ImageIcon className="w-6 h-6 text-violet-500" />,
  },
  {
    title: 'Project Case Studies',
    description: 'Tell the story behind your work with rich text, multiple image blocks, and process breakdowns that impress clients.',
    icon: <Layers className="w-6 h-6 text-blue-500" />,
  },
  {
    title: 'Contact & Inquiry Forms',
    description: 'Custom forms for project inquiries land directly in your inbox — include fields for budget, timeline, and project type.',
    icon: <MessageSquare className="w-6 h-6 text-amber-500" />,
  },
  {
    title: 'About & Philosophy',
    description: 'Tell your story, your process, and your creative vision with beautifully styled text and image blocks.',
    icon: <Palette className="w-6 h-6 text-pink-500" />,
  },
  {
    title: 'AI-Written Bio',
    description: 'Describe your work and background — the AI writes a compelling artist statement or creative bio in your voice.',
    icon: <Sparkles className="w-6 h-6 text-emerald-500" />,
  },
  {
    title: 'Custom Domain & SEO',
    description: 'Publish on your own .com or .ca with automatic SSL. Your portfolio ranks on Google and looks professional everywhere.',
    icon: <Globe className="w-6 h-6 text-red-500" />,
  },
];

export default function CreativePortfolioIndustryPage() {
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 text-violet-700 font-bold text-sm mb-6 border border-violet-200 shadow-sm"
          >
            <Palette className="w-4 h-4" />
            Photographers, Designers & Creatives
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-slate-900"
          >
            Your Work Is
            <br />
            <span className="text-violet-600">The Portfolio.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            For photographers, illustrators, designers, musicians, and artists — build a portfolio website
            that gets out of the way and lets your work do the talking. No code. No limits.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/onboarding"
              className="inline-block px-8 py-4 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              Build My Portfolio
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-violet-50 border-t border-violet-100">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-black text-slate-900 mb-4">Built for the Creative Mind</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              A website builder that understands the importance of aesthetics — because your online presence is an extension of your craft.
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
                className="bg-white rounded-2xl p-8 shadow-sm border border-violet-100 hover:border-violet-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="mb-5 w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
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
            <h2 className="text-4xl font-black text-slate-900 mb-4">Templates That Let Your Work Shine</h2>
            <p className="text-slate-600 max-w-xl mx-auto text-lg">
              Sophisticated, image-forward designs built to showcase creative work at its best.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                name: 'Luxe',
                tagline: 'Refined. Elegant. Unforgettable.',
                description: 'Centered layout with generous whitespace gives your imagery room to breathe and your brand a premium, gallery-like feel.',
                badge: 'bg-amber-100 text-amber-800',
                image: t1,
              },
              {
                name: 'Airy',
                tagline: 'Light. Spacious. Breathable.',
                description: 'A light, editorial aesthetic that puts your photography or design work at the forefront without distraction.',
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
                className="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-violet-300 hover:shadow-xl transition-all duration-300"
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t-8 border-violet-600 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-black text-white mb-4">Your work deserves a home it can be proud of.</h2>
          <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
            Build a portfolio that gets you noticed. Launch in minutes, starting at $15/month.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-10 py-5 rounded-full bg-violet-600 text-white font-bold text-lg hover:bg-violet-500 transition-all shadow-2xl hover:shadow-violet-500/30"
          >
            Launch My Portfolio
          </Link>
        </motion.div>
      </section>

      <MarketingFooter />
    </main>
  );
}
