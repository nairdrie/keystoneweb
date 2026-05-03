'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import Header from '../../components/Header';
import MarketingFooter from '../../components/MarketingFooter';
import { getTemplatePreviewImage } from '@/lib/template-preview-assets';

type TemplateCard = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  bestFor: string[];
  accent: string;
  badge: string;
};

const TEMPLATES: TemplateCard[] = [
  {
    id: 'luxe',
    name: 'Luxe',
    tagline: 'Refined. Elegant. Unforgettable.',
    description: 'Centered logo, serif typography, and warm gold accents. Built for brands that want to make a lasting first impression.',
    bestFor: ['Salons & Spas', 'Photographers', 'Boutiques', 'Fine Dining'],
    accent: '#c9a96e',
    badge: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'vivid',
    name: 'Vivid',
    tagline: 'Bold. Energetic. In your face.',
    description: 'Chunky sans-serif, punchy headlines, and unapologetic color. Perfect when you want your brand to own the room.',
    bestFor: ['Fitness Studios', 'Food & Drink', 'Creative Agencies', 'Retail'],
    accent: '#f97316',
    badge: 'bg-orange-100 text-orange-800',
  },
  {
    id: 'airy',
    name: 'Airy',
    tagline: 'Light. Spacious. Breathable.',
    description: 'Floating navigation, generous whitespace, and rounded soft elements. Ideal for brands that lead with calm confidence.',
    bestFor: ['Wellness Coaches', 'Yoga & Pilates', 'Consultants', 'Portfolios'],
    accent: '#38bdf8',
    badge: 'bg-sky-100 text-sky-800',
  },
  {
    id: 'edge',
    name: 'Edge',
    tagline: 'Dark. Sharp. Relentless.',
    description: 'A dark canvas with neon accents and angular layouts. Commands attention and signals that you mean serious business.',
    bestFor: ['Tech & Software', 'Music & Events', 'Automotive', 'Modern Retail'],
    accent: '#a855f7',
    badge: 'bg-purple-100 text-purple-800',
  },
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'Structured. Trusted. Timeless.',
    description: 'Utility bar, traditional navigation, and a clean grid layout. The template people trust when trust is everything.',
    bestFor: ['Trades & Contractors', 'Law & Finance', 'Healthcare', 'Real Estate'],
    accent: '#1e40af',
    badge: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'organic',
    name: 'Organic',
    tagline: 'Warm. Natural. Human.',
    description: 'Earthy tones, rounded shapes, and a tactile warmth that makes visitors feel at home immediately.',
    bestFor: ['Restaurants & Cafes', 'Home Services', 'Landscaping', 'Health Food'],
    accent: '#65a30d',
    badge: 'bg-lime-100 text-lime-800',
  },
  {
    id: 'sleek',
    name: 'Sleek',
    tagline: 'Minimal. Precise. Powerful.',
    description: 'Ultra-minimal layout, bold oversized typography, and a monochrome palette with a single deliberate accent color.',
    bestFor: ['Consultants', 'Architects', 'Designers', 'Professional Services'],
    accent: '#0f172a',
    badge: 'bg-slate-100 text-slate-800',
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    tagline: 'Playful. Gradient. Dynamic.',
    description: 'Gradient headers, rounded cards, and a high-energy layout that keeps visitors engaged and clicking.',
    bestFor: ['E-Commerce', 'Events & Activities', 'Kids & Family', 'Food Delivery'],
    accent: '#ec4899',
    badge: 'bg-pink-100 text-pink-800',
  },
  {
    id: 'atlas',
    name: 'Atlas',
    tagline: 'Structured. Metric-led. Professional.',
    description: 'A B2B layout built around split hero, metrics, advisory lanes, process, and a strong consultation CTA.',
    bestFor: ['Consultants', 'SaaS', 'Finance', 'Agencies'],
    accent: '#2f6f73',
    badge: 'bg-teal-100 text-teal-800',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    tagline: 'Magazine. Author-led. Content-first.',
    description: 'A publication-style structure with masthead hero, featured resources, pull quote, author area, and newsletter CTA.',
    bestFor: ['Blogs', 'Experts', 'Publications', 'Thought Leadership'],
    accent: '#b91c1c',
    badge: 'bg-red-100 text-red-800',
  },
  {
    id: 'booked',
    name: 'Booked',
    tagline: 'Appointment-first. Calm. Direct.',
    description: 'Designed around scheduling, with booking, services, process, testimonial, and repeated booking CTA.',
    bestFor: ['Clinics', 'Therapists', 'Salons', 'Tutors'],
    accent: '#0f9f8f',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'menu',
    name: 'Menu',
    tagline: 'Food-first. Order-ready. Local.',
    description: 'A restaurant structure centered on menu highlights, category tabs, gallery, delivery links, hours, and location.',
    bestFor: ['Restaurants', 'Cafes', 'Bakeries', 'Food Trucks'],
    accent: '#d97706',
    badge: 'bg-orange-100 text-orange-800',
  },
  {
    id: 'craft',
    name: 'Craft',
    tagline: 'Handmade. Warm. Story-rich.',
    description: 'A maker-focused layout with organic hero treatment, showcase slides, founder story, gallery, and community proof.',
    bestFor: ['Artisans', 'Makers', 'Local Shops', 'Boutique Products'],
    accent: '#c46a3a',
    badge: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'retro',
    name: 'Retro',
    tagline: 'Playful. Chunky. Nostalgic.',
    description: 'A high-personality layout with bold section breaks, tab buttons, sticker-like proof, events, and loud CTAs.',
    bestFor: ['Creators', 'Pop-ups', 'Events', 'Youth Brands'],
    accent: '#ff4fd8',
    badge: 'bg-pink-100 text-pink-800',
  },
  {
    id: 'proof',
    name: 'Proof',
    tagline: 'Credibility. Results. Trust.',
    description: 'A trust-heavy structure with certifications, stats, reviews, guarantees, estimate intake, FAQ, and CTA.',
    bestFor: ['Contractors', 'Clinics', 'Legal', 'Real Estate'],
    accent: '#15803d',
    badge: 'bg-green-100 text-green-800',
  },
  {
    id: 'gallery',
    name: 'Gallery',
    tagline: 'Image-heavy. Minimal. Portfolio-led.',
    description: 'A visual-first portfolio structure with carousel hero, full-width image, dense gallery, project spotlights, and inquiry CTA.',
    bestFor: ['Photographers', 'Designers', 'Artists', 'Studios'],
    accent: '#111111',
    badge: 'bg-zinc-100 text-zinc-800',
  },
];

const SORTED_TEMPLATES = [...TEMPLATES].sort((a, b) => a.name.localeCompare(b.name));

function TemplateVisual({ template }: { template: TemplateCard }) {
  return (
    <Image
      src={getTemplatePreviewImage(template.id) || '/templates/luxe.png'}
      alt={`${template.name} template preview`}
      fill
      className="object-cover object-top"
      sizes="(max-width: 768px) 100vw, 50vw"
      priority={template.id === 'luxe' || template.id === 'vivid'}
    />
  );
}

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
            16 Premium Designs
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
            Sixteen distinct starting points. Each one fully customizable with your colors, content,
            and brand. Pick your starting point - the AI handles the rest.
          </motion.p>
        </div>
      </section>

      {/* Templates Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          {SORTED_TEMPLATES.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.1 }}
              className="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-red-300 hover:shadow-2xl transition-all duration-300"
            >
              {/* Template preview */}
              <div className="relative aspect-video overflow-hidden">
                <TemplateVisual template={template} />
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
