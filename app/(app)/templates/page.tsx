'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import Header from '../../components/Header';
import MarketingFooter from '../../components/MarketingFooter';
import { getTemplatePreviewImage } from '@/lib/template-preview-assets';
import { PRESET_TEMPLATE_DISPLAYS, type PresetTemplateStyle } from '@/lib/templates/preset-template-display';

type TemplateCard = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  bestFor: readonly string[];
  accent: string;
  badge: string;
};

const TEMPLATE_IDS: readonly PresetTemplateStyle[] = [
  'atlas',
  'editorial',
  'booked',
  'menu',
  'craft',
  'retro',
  'proof',
  'gallery',
  'builder',
  'commerce',
  'foundation',
  'wellness',
  'estate',
  'studio',
  'learn',
  'occasion',
];

const TEMPLATES: TemplateCard[] = TEMPLATE_IDS.map((id) => ({
  id,
  name: PRESET_TEMPLATE_DISPLAYS[id].name,
  tagline: PRESET_TEMPLATE_DISPLAYS[id].tagline,
  description: PRESET_TEMPLATE_DISPLAYS[id].description,
  bestFor: PRESET_TEMPLATE_DISPLAYS[id].bestFor,
  accent: PRESET_TEMPLATE_DISPLAYS[id].accent,
  badge: PRESET_TEMPLATE_DISPLAYS[id].badge,
}));

const SORTED_TEMPLATES = [...TEMPLATES].sort((a, b) => a.name.localeCompare(b.name));

function TemplateVisual({ template }: { template: TemplateCard }) {
  const previewImage = getTemplatePreviewImage(template.id) || '/templates/luxe.png';

  return (
    <Image
      src={previewImage}
      alt={`${template.name} template preview`}
      fill
      className="object-cover object-top"
      sizes="(max-width: 768px) 100vw, 50vw"
      priority={template.id === 'atlas' || template.id === 'builder'}
      unoptimized={previewImage.endsWith('.svg')}
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
            16 Card Preset Templates
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight"
          >
            A Preset for Every<br />
            <span className="text-red-600">Site Style</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-slate-600 max-w-2xl mx-auto"
          >
            Sixteen card-preset-led starting points. Each one is fully customizable with your colors,
            content, and brand. Pick your starting point - the AI handles the rest.
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
