'use client';

import { useMemo, useState } from 'react';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';
import { EditorProvider, type BlockData, type EditorContextType } from '@/lib/editor-context';

const SMOKE_PALETTE = {
  primary: '#0f172a',
  secondary: '#64748b',
  accent: '#e2e8f0',
};

const INITIAL_BLOCKS: BlockData[] = [
  {
    id: 'smoke-services-clipped',
    type: 'servicesGrid',
    data: {
      title: 'Services',
      subtitle: 'Clipped preset edit-mode smoke block.',
      cardStyle: 'clipped',
      surfaceStyle: 'white',
      markerStyle: 'numbered',
      spacingDensity: 'standard',
      items: [
        { title: 'Planning', description: 'A concise service description that wraps naturally.' },
        { title: 'Buildout', description: 'A second service to exercise grid gaps.' },
        { title: 'Support', description: 'A third card checks row spacing.' },
      ],
    },
  },
  {
    id: 'smoke-features-poster',
    type: 'featuresList',
    data: {
      title: 'Why choose us',
      cardStyle: 'poster',
      surfaceStyle: 'white',
      markerStyle: 'badge',
      spacingDensity: 'compact',
      items: ['Clear process', 'Reliable communication', 'Polished finish'],
    },
  },
  {
    id: 'smoke-carousel-poster',
    type: 'carousel',
    data: {
      title: 'Highlights',
      subtitle: 'Poster cards should not clip in edit mode.',
      variant: 'cards',
      cardStyle: 'poster',
      surfaceStyle: 'white',
      mediaAspect: 'landscape',
      mediaTreatment: 'fullBleed',
      spacingDensity: 'standard',
      items: [
        { mediaType: 'icon', icon: 'Sparkles', title: 'Concept', text: 'Clear visual direction.' },
        { mediaType: 'icon', icon: 'Layers', title: 'Execution', text: 'Consistent reusable pieces.' },
        { mediaType: 'icon', icon: 'Check', title: 'Launch', text: 'Ready for the final pass.' },
      ],
    },
  },
  {
    id: 'smoke-testimonials-gradient',
    type: 'testimonials',
    data: {
      title: 'Client notes',
      subtitle: 'Gradient wash cards should keep readable copy.',
      variant: 'cards',
      cardStyle: 'gradient',
      surfaceStyle: 'white',
      spacingDensity: 'standard',
      items: [
        { name: 'Jordan P.', role: 'Client', quote: 'The process stayed clear from start to finish.', rating: 5 },
        { name: 'Mina R.', role: 'Owner', quote: 'The final page felt polished without being busy.', rating: 5 },
      ],
    },
  },
  {
    id: 'smoke-pricing-clipped',
    type: 'pricing',
    data: {
      title: 'Plans',
      subtitle: 'Popular ribbons should remain visible.',
      variant: 'cards',
      cardStyle: 'clipped',
      surfaceStyle: 'white',
      spacingDensity: 'standard',
      tiers: [
        { name: 'Basic', price: '$49', period: '/mo', description: 'Starter plan.', features: ['One page', 'Basic support'], highlighted: false, buttonText: 'Start' },
        { name: 'Pro', price: '$99', period: '/mo', description: 'Most popular.', features: ['Five pages', 'Priority support'], highlighted: true, buttonText: 'Choose Pro' },
        { name: 'Team', price: '$199', period: '/mo', description: 'For growing teams.', features: ['More pages', 'More support'], highlighted: false, buttonText: 'Talk to us' },
      ],
    },
  },
  {
    id: 'smoke-timeline-utility',
    type: 'timeline',
    data: {
      title: 'Milestones',
      subtitle: 'Timeline bar and cards should keep stable spacing.',
      variant: 'cards',
      cardStyle: 'utility',
      surfaceStyle: 'white',
      spacingDensity: 'standard',
      items: [
        { title: 'Discovery', organization: 'Studio', dateRange: '2024', description: 'Aligned on scope and priorities.', tags: ['Plan', 'Scope'] },
        { title: 'Delivery', organization: 'Studio', dateRange: '2025', description: 'Shipped a clean, editable site.', tags: ['Build'] },
        { title: 'Improve', organization: 'Studio', dateRange: '2026', description: 'Refined the preset library.', tags: ['Iterate'] },
      ],
    },
  },
  {
    id: 'smoke-faq-slab',
    type: 'faq',
    data: {
      title: 'Questions',
      subtitle: 'Accordion items should preserve their card shell.',
      cardStyle: 'slab',
      surfaceStyle: 'white',
      spacingDensity: 'standard',
      items: [
        { question: 'Can this be edited later?', answer: 'Yes, every section remains editable.' },
        { question: 'Does the preset affect layout?', answer: 'It should not move the block unexpectedly.' },
      ],
    },
  },
  {
    id: 'smoke-contact-utility',
    type: 'contact',
    data: {
      title: 'Contact',
      subtitle: 'Contact cards should keep consistent spacing.',
      phone: '(555) 123-4567',
      email: 'hello@example.com',
      address: '123 Main Street',
      hours: 'Mon-Fri, 9-5',
      cardStyle: 'utility',
      surfaceStyle: 'white',
      spacingDensity: 'standard',
    },
  },
  {
    id: 'smoke-contact-form-poster',
    type: 'contact_form',
    data: {
      title: 'Send a message',
      description: 'Form shell preset smoke test.',
      submitText: 'Send',
      successMessage: 'Thanks.',
      cardStyle: 'poster',
      surfaceStyle: 'white',
    },
  },
  {
    id: 'smoke-estimate-clipped',
    type: 'estimateForm',
    data: {
      title: 'Request an estimate',
      description: 'Estimate shell preset smoke test.',
      submitText: 'Request quote',
      successMessage: 'Thanks.',
      variant: 'simple',
      showName: true,
      showEmail: true,
      showMessage: true,
      cardStyle: 'clipped',
      surfaceStyle: 'white',
    },
  },
];

export default function CardPresetEditSmokeClient() {
  const [blocks, setBlocks] = useState<BlockData[]>(INITIAL_BLOCKS);

  const context = useMemo<EditorContextType>(() => ({
    content: {},
    siteContent: {},
    updateSiteContent: () => undefined,
    navItems: [],
    updateNavItems: () => undefined,
    pages: [{ id: 'home', slug: 'home', title: 'Home' }],
    currentPageId: 'home',
    blocks,
    isEditMode: true,
    isProUser: true,
    palette: SMOKE_PALETTE,
    updateContent: () => undefined,
    addBlock: () => undefined,
    removeBlock: () => undefined,
    moveBlock: () => undefined,
    updateBlockData: (id, key, value) => {
      setBlocks((current) => current.map((block) => (
        block.id === id
          ? { ...block, data: { ...block.data, [key]: value } }
          : block
      )));
    },
    updateBlockDataBatch: (id, updates) => {
      setBlocks((current) => current.map((block) => (
        block.id === id
          ? { ...block, data: { ...block.data, ...updates } }
          : block
      )));
    },
  }), [blocks]);

  return (
    <EditorProvider value={context}>
      <main className="min-h-screen bg-white" data-card-preset-edit-smoke="ready">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Visual smoke fixture</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Card Presets In Edit Mode</h1>
            <p className="mt-2 text-sm text-slate-600">
              Development-only page used by the Playwright smoke script to catch edit-mode clipping and layout drift.
            </p>
          </div>
          <BlockRenderer palette={SMOKE_PALETTE} />
        </div>
      </main>
    </EditorProvider>
  );
}
