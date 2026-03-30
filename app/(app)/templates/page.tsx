'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import Header from '../../components/Header';
import MarketingFooter from '../../components/MarketingFooter';
import t1 from '../../../assets/templates/1.png';
import t2 from '../../../assets/templates/2.png';
import t3 from '../../../assets/templates/3.png';
import t4 from '../../../assets/templates/4.png';
import t5 from '../../../assets/templates/5.png';
import t6 from '../../../assets/templates/6.png';
import t7 from '../../../assets/templates/7.png';
import t8 from '../../../assets/templates/8.png';

const TEMPLATES = [
  {
    id: 'luxe',
    name: 'Luxe',
    tagline: 'Refined. Elegant. Unforgettable.',
    description: 'Centered logo, serif typography, and warm gold accents. Built for brands that want to make a lasting first impression.',
    bestFor: ['Salons & Spas', 'Photographers', 'Boutiques', 'Fine Dining'],
    accent: '#c9a96e',
    badge: 'bg-amber-100 text-amber-800',
    image: t1,
  },
  {
    id: 'vivid',
    name: 'Vivid',
    tagline: 'Bold. Energetic. In your face.',
    description: 'Chunky sans-serif, punchy headlines, and unapologetic color. Perfect when you want your brand to own the room.',
    bestFor: ['Fitness Studios', 'Food & Drink', 'Creative Agencies', 'Retail'],
    accent: '#f97316',
    badge: 'bg-orange-100 text-orange-800',
    image: t2,
  },
  {
    id: 'airy',
    name: 'Airy',
    tagline: 'Light. Spacious. Breathable.',
    description: 'Floating navigation, generous whitespace, and rounded soft elements. Ideal for brands that lead with calm confidence.',
    bestFor: ['Wellness Coaches', 'Yoga & Pilates', 'Consultants', 'Portfolios'],
    accent: '#38bdf8',
    badge: 'bg-sky-100 text-sky-800',
    image: t3,
  },
  {
    id: 'edge',
    name: 'Edge',
    tagline: 'Dark. Sharp. Relentless.',
    description: 'A dark canvas with neon accents and angular layouts. Commands attention and signals that you mean serious business.',
    bestFor: ['Tech & Software', 'Music & Events', 'Automotive', 'Modern Retail'],
    accent: '#a855f7',
    badge: 'bg-purple-100 text-purple-800',
    image: t4,
  },
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'Structured. Trusted. Timeless.',
    description: 'Utility bar, traditional navigation, and a clean grid layout. The template people trust when trust is everything.',
    bestFor: ['Trades & Contractors', 'Law & Finance', 'Healthcare', 'Real Estate'],
    accent: '#1e40af',
    badge: 'bg-blue-100 text-blue-800',
    image: t5,
  },
  {
    id: 'organic',
    name: 'Organic',
    tagline: 'Warm. Natural. Human.',
    description: 'Earthy tones, rounded shapes, and a tactile warmth that makes visitors feel at home immediately.',
    bestFor: ['Restaurants & Cafes', 'Home Services', 'Landscaping', 'Health Food'],
    accent: '#65a30d',
    badge: 'bg-lime-100 text-lime-800',
    image: t6,
  },
  {
    id: 'sleek',
    name: 'Sleek',
    tagline: 'Minimal. Precise. Powerful.',
    description: 'Ultra-minimal layout, bold oversized typography, and a monochrome palette with a single deliberate accent color.',
    bestFor: ['Consultants', 'Architects', 'Designers', 'Professional Services'],
    accent: '#0f172a',
    badge: 'bg-slate-100 text-slate-800',
    image: t7,
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    tagline: 'Playful. Gradient. Dynamic.',
    description: 'Gradient headers, rounded cards, and a high-energy layout that keeps visitors engaged and clicking.',
    bestFor: ['E-Commerce', 'Events & Activities', 'Kids & Family', 'Food Delivery'],
    accent: '#ec4899',
    badge: 'bg-pink-100 text-pink-800',
    image: t8,
  },
];

export default function TemplatesPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-bold text-sm mb-6 border border-slate-200"
          >
            8 Premium Designs
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight"
          >
            A Template for Every<br />
            <span className="text-red-600">Kind of Business</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-slate-600 max-w-2xl mx-auto"
          >
            Eight distinct design personalities. Each one fully customizable with your colors, content,
            and brand. Pick your starting point — the AI handles the rest.
          </motion.p>
        </div>
      </section>

      {/* Templates Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          {TEMPLATES.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.1 }}
              className="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-red-300 hover:shadow-2xl transition-all duration-300"
            >
              {/* Screenshot */}
              <div className="relative aspect-video overflow-hidden">
                <Image
                  src={template.image}
                  alt={`${template.name} template preview`}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Link
                    href="/onboarding"
                    className="px-6 py-3 bg-white text-slate-900 font-bold rounded-full hover:scale-105 transition-transform shadow-xl"
                  >
                    Use {template.name}
                  </Link>
                </div>
              </div>

              {/* Info */}
              <div className="p-8">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{template.name}</h2>
                    <p className="text-sm font-semibold text-slate-400 mt-0.5">{template.tagline}</p>
                  </div>
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white shadow-md flex-shrink-0 mt-1"
                    style={{ backgroundColor: template.accent }}
                  />
                </div>

                <p className="text-slate-600 text-sm leading-relaxed mb-5">{template.description}</p>

                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Best for</div>
                  <div className="flex flex-wrap gap-2">
                    {template.bestFor.map((tag) => (
                      <span key={tag} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${template.badge}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 bg-red-600 text-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-black text-white mb-4">Found your style?</h2>
          <p className="text-red-100 text-lg mb-10 max-w-xl mx-auto">
            Every template is a starting point. The AI customizes it to your brand in seconds.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-10 py-5 rounded-full bg-white text-red-600 font-bold text-lg hover:bg-red-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
          >
            Start Building Free
          </Link>
        </motion.div>
      </section>

      <MarketingFooter />
    </main>
  );
}
