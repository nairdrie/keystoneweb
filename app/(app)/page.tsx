'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Hammer, Check, ArrowRight, Loader2, Utensils, Paintbrush, Leaf, Fish } from 'lucide-react';
import Header from '../components/Header';
import MarketingFooter from '../components/MarketingFooter';
import mapleLeaf from '../../assets/maple-leaf.png';
import { TEMPLATE_PREVIEW_IMAGES, TEMPLATE_PREVIEW_STYLES } from '@/lib/template-preview-assets';
import { useAuth } from '@/lib/auth/context';

const TEMPLATE_IMAGES = TEMPLATE_PREVIEW_STYLES.map((style) => TEMPLATE_PREVIEW_IMAGES[style]);

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/admin');
    }
  }, [user, loading, router]);

  if (loading || user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <HeroSlab />
      <ProofStrip />
      <ThreeReasons />
      <BeforeAfter />
      <TemplateSection />
      <PriceSlab />
      <ClosingCTA />
      <MarketingFooter />
    </main>
  );
}

// ── HERO ────────────────────────────────────────────────────────────────
const HERO_DEMOS = [
  {
    prompt: 'A site for an arts and crafts studio in Vancouver',
    business: 'Raincity Craft Studio',
    result: 'Chose a handmade look with workshops, gallery sections, and warm colors.',
    ops: ['choose_craft_style', 'add_workshops', 'build_gallery'],
    preview: {
      name: 'Raincity Craft Studio',
      eyebrow: 'WORKSHOPS + HANDMADE GOODS',
      headline: ['Make something', 'beautiful in Vancouver.'],
      body: 'Beginner-friendly classes, local makers, and weekend markets.',
      primaryAction: 'See Workshops',
      secondaryAction: 'Shop Goods',
      headerAction: 'Join a Class',
      items: ['Pottery', 'Fiber Arts', 'Maker Markets'],
      primary: '#7c2d12',
      soft: '#fef3c7',
      gradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 45%, #ffffff 100%)',
      Icon: Paintbrush,
    },
  },
  {
    prompt: 'A site for a calm wellness clinic in Calgary',
    business: 'Prairie Wellness',
    result: 'Created a gentle service page with booking prompts and care pathways.',
    ops: ['set_soft_palette', 'add_booking_cta', 'organize_services'],
    preview: {
      name: 'Prairie Wellness',
      eyebrow: 'MASSAGE + RECOVERY + CARE',
      headline: ['Feel better,', 'book easier.'],
      body: 'Thoughtful treatments, simple booking, and care that fits your week.',
      primaryAction: 'Book Online',
      secondaryAction: 'Our Services',
      headerAction: 'Start Booking',
      items: ['Massage', 'Recovery', 'Wellness Plans'],
      primary: '#047857',
      soft: '#d1fae5',
      gradient: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 55%, #ffffff 100%)',
      Icon: Leaf,
    },
  },
  {
    prompt: 'A site for my plumbing business in Sudbury',
    business: 'Sudbury Plumbing',
    result: 'Picked a trustworthy blue palette and added a 24/7 callout.',
    ops: ['select_template', 'generate_copy', 'set_palette'],
    preview: {
      name: 'Sudbury Plumbing',
      eyebrow: '24/7 EMERGENCY',
      headline: ['Plumbing in Sudbury,', 'fixed today.'],
      body: 'Family-owned. Honest pricing. We answer the phone.',
      primaryAction: 'Book Service',
      secondaryAction: '(705) 555-1212',
      headerAction: 'Call Now',
      items: ['Emergency', 'Drain Care', 'Water Heaters'],
      primary: '#075985',
      soft: '#e0f2fe',
      gradient: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)',
      Icon: Hammer,
    },
  },
  {
    prompt: 'A site for a trendy restaurant in Toronto',
    business: 'King West Table',
    result: 'Built a bold food-first layout with menu highlights and reservations.',
    ops: ['pick_menu_layout', 'write_hero_copy', 'add_reservations'],
    preview: {
      name: 'King West Table',
      eyebrow: 'DINNER + COCKTAILS + LATE NIGHT',
      headline: ['Toronto plates,', 'made for sharing.'],
      body: 'Seasonal small plates, low lights, and a room that hums.',
      primaryAction: 'Reserve',
      secondaryAction: 'View Menu',
      headerAction: 'Book a Table',
      items: ['Small Plates', 'Cocktails', 'Private Dining'],
      primary: '#9a3412',
      soft: '#ffedd5',
      gradient: 'linear-gradient(135deg, #fff7ed 0%, #fff1f2 55%, #ffffff 100%)',
      Icon: Utensils,
    },
  },
  {
    prompt: 'A site for a fishing charter business in Halifax',
    business: 'Harbourline Charters',
    result: 'Designed a coast-ready booking page with trip options and Atlantic blue styling.',
    ops: ['set_coastal_style', 'add_trip_cards', 'enable_booking'],
    preview: {
      name: 'Harbourline Charters',
      eyebrow: 'HALIFAX FISHING CHARTERS',
      headline: ['Atlantic trips,', 'ready at sunrise.'],
      body: 'Guided harbour and offshore charters for families, friends, and serious anglers.',
      primaryAction: 'Book a Charter',
      secondaryAction: 'Trip Options',
      headerAction: 'Check Dates',
      items: ['Harbour Trips', 'Offshore Runs', 'Private Groups'],
      primary: '#0e7490',
      soft: '#cffafe',
      gradient: 'linear-gradient(135deg, #ecfeff 0%, #e0f2fe 48%, #ffffff 100%)',
      Icon: Fish,
    },
  },
];

function HeroSlab() {
  // 0: idle, 1: typing, 2: building, 3: rendered
  const [step, setStep] = useState(0);
  const [demoIndex, setDemoIndex] = useState(0);
  const demo = HERO_DEMOS[demoIndex];

  useEffect(() => {
    setStep(0);
    const seq: Array<[number, number]> = [
      [800, 1],
      [3200, 2],
      [4400, 3],
      [8600, 0],
    ];
    const timers = seq.map(([t, s]) => setTimeout(() => setStep(s), t));
    const nextDemoTimer = setTimeout(() => {
      setDemoIndex((current) => (current + 1) % HERO_DEMOS.length);
    }, 9400);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(nextDemoTimer);
    };
  }, [demoIndex]);

  return (
    <section className="relative overflow-hidden bg-white px-6 pt-20 pb-16">
      {/* subtle grid */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]">
        <defs>
          <pattern id="ksw-hero-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#0f172a" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ksw-hero-grid)" />
      </svg>

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
        {/* LEFT: copy */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-900 shadow-sm"
          >
            <Image src={mapleLeaf} alt="" className="h-3.5 w-3.5 object-contain" />
            Built in Canada · For Canadian Small Business
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mb-7 font-black tracking-[-0.035em] text-black"
            style={{ fontSize: 'clamp(44px, 6vw, 116px)', lineHeight: 0.95 }}
          >
            Tell us<br />
            what you do.<br />
            <span className="text-red-600">We build the site.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mb-9 max-w-[520px] text-lg font-medium leading-relaxed text-slate-700"
          >
            One sentence. Five minutes. A real website that books real customers — from{' '}
            <strong className="text-slate-900">$15 a month</strong>
            <a href="#pricing-note" className="align-super text-[10px] text-slate-500 no-underline hover:text-red-600">*</a>, no surprises.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex flex-wrap items-center gap-3"
          >
            <Link
              href="/onboarding"
              className="group inline-flex items-center gap-2 rounded-full bg-red-600 px-7 py-4 text-sm font-bold text-white shadow-[0_10px_25px_-5px_rgba(254,69,69,.45)] transition hover:-translate-y-0.5 hover:bg-red-700"
            >
              Start Your Site — Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <span className="text-xs font-medium text-slate-500">
              No credit card. Keep it free until you publish.
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-11 flex flex-wrap gap-7"
          >
            {[
              ['5 min', 'to launch'],
              ['from $15', '/mo'],
              ['24/7', 'support'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-2xl font-black tracking-tight text-red-600 leading-none">{n}</div>
                <div className="mt-1 text-xs font-semibold text-slate-600">{l}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT: builder demo */}
        <BuilderDemo step={step} demo={demo} />
      </div>
    </section>
  );
}

function BuilderDemo({ step, demo }: { step: number; demo: typeof HERO_DEMOS[number] }) {
  const [tIdx, setTIdx] = useState(0);

  useEffect(() => {
    if (step !== 1) {
      setTIdx(step >= 2 ? demo.prompt.length : 0);
      return;
    }
    setTIdx(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTIdx(i);
      if (i >= demo.prompt.length) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [demo.prompt, step]);

  const showText = step === 0 ? '' : step === 1 ? demo.prompt.slice(0, tIdx) : demo.prompt;

  return (
    <div
      className="relative"
      style={{
        transform: 'perspective(1400px) rotateY(-3deg) rotateX(2deg)',
        transformOrigin: 'center center',
      }}
    >
      {/* Glow */}
      <div
        className="pointer-events-none absolute -inset-8 rounded-[32px] blur-[40px]"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(254,69,69,.18), transparent 60%)',
        }}
      />

      {/* Browser window */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_50px_100px_-20px_rgba(15,23,42,.25),0_30px_60px_-30px_rgba(254,69,69,.12)]">
        {/* Chrome */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
          <div className="flex gap-1.5">
            {['#fc615c', '#fdbe40', '#34c84a'].map((c) => (
              <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div className="ml-2 flex-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-500">
            kswd.ca/builder
          </div>
        </div>

        {/* Split */}
        <div className="grid h-[380px] grid-cols-[200px_1fr]">
          {/* LEFT: chat */}
          <div className="flex flex-col border-r border-slate-100 bg-slate-50 p-3.5">
            <div className="mb-3 flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/archie.png" alt="Archie" className="h-4 w-4 object-contain" />
              <span className="text-[11px] font-bold text-slate-900">Archie</span>
            </div>

            {/* user bubble */}
            <div className="mb-2.5 ml-auto min-h-[18px] max-w-[92%] self-end rounded-[12px_12px_3px_12px] bg-red-600 px-2.5 py-2 text-[11px] leading-snug text-white">
              {showText}
              {step === 1 && <span className="ksw-blink">▋</span>}
            </div>

            {step >= 2 && (
              <div className="flex items-start gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/archie.png"
                  alt="Archie"
                  className="h-5 w-5 flex-none object-contain"
                />
                <div className="flex-1 rounded-[3px_12px_12px_12px] border border-slate-200 bg-white px-2.5 py-2 text-[11px] leading-snug text-slate-900">
                  {step === 2 ? (
                    <span className="text-slate-400">
                      <span className="ksw-dot" />
                      <span className="ksw-dot" style={{ animationDelay: '.15s' }} />
                      <span className="ksw-dot" style={{ animationDelay: '.3s' }} />
                    </span>
                  ) : (
                    <>
                      Built a starter for <strong>{demo.business}</strong>. {demo.result}
                    </>
                  )}
                </div>
              </div>
            )}

            {step >= 3 && (
              <div className="mt-2 flex flex-col gap-1">
                {demo.ops.map((t, i) => (
                  <div
                    key={t}
                    className="ksw-pop inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] text-slate-600"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <Check className="h-2 w-2 text-emerald-600" /> {t}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: preview */}
          <div className="relative overflow-hidden bg-white">
            {step < 3 ? (
              <div
                className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-semibold text-slate-300"
                style={{
                  background:
                    step === 2
                      ? 'linear-gradient(120deg, #f8fafc 0%, #fff5f5 50%, #f8fafc 100%)'
                      : '#f8fafc',
                  backgroundSize: step === 2 ? '200% 100%' : undefined,
                  animation: step === 2 ? 'ksw-shimmer 1.5s linear infinite' : undefined,
                }}
              >
                {step === 2 ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600" /> Generating…
                  </>
                ) : (
                  'Preview will appear here'
                )}
              </div>
            ) : (
              <div className="ksw-fade">
                <FakeSitePreview demo={demo} />
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(.ksw-blink) { animation: ksw-blink 1s steps(2) infinite; }
        :global(.ksw-pop) { animation: ksw-pop 0.3s both; }
        :global(.ksw-fade) { animation: ksw-fade 0.5s; }
        :global(.ksw-dot) {
          display: inline-block;
          width: 4px;
          height: 4px;
          margin-right: 3px;
          border-radius: 9999px;
          background: #94a3b8;
          animation: ksw-bounce 1s infinite;
        }
        @keyframes ksw-blink { 50% { opacity: 0; } }
        @keyframes ksw-pop { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes ksw-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes ksw-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes ksw-bounce { 0%, 80%, 100% { transform: scale(.6); opacity: .5; } 40% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}

function FakeSitePreview({ demo }: { demo: typeof HERO_DEMOS[number] }) {
  const { preview } = demo;
  const PreviewIcon = preview.Icon;

  return (
    <div className="font-sans text-[11px] leading-snug" style={{ transform: 'scale(.98)' }}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="flex h-4 w-4 items-center justify-center rounded" style={{ backgroundColor: preview.primary }}>
            <PreviewIcon className="h-[9px] w-[9px] text-white" />
          </div>
          <span className="text-[11px] font-extrabold" style={{ color: preview.primary }}>
            {preview.name}
          </span>
        </div>
        <button className="rounded-full px-2 py-1 text-[9px] font-bold text-white" style={{ backgroundColor: preview.primary }}>
          {preview.headerAction}
        </button>
      </div>
      <div className="ksw-preview-hero px-4 pt-4 pb-4.5" style={{ background: preview.gradient }}>
        <div className="mb-1.5 text-[9px] font-bold" style={{ color: preview.primary }}>
          {preview.eyebrow}
        </div>
        <div className="mb-1.5 text-lg font-black leading-tight tracking-tight" style={{ color: preview.primary }}>
          {preview.headline[0]}<br />{preview.headline[1]}
        </div>
        <div className="mb-2 text-[9px] text-slate-600">
          {preview.body}
        </div>
        <div className="flex gap-1.5">
          <span className="rounded-full px-2.5 py-1 text-[9px] font-bold text-white" style={{ backgroundColor: preview.primary }}>
            {preview.primaryAction}
          </span>
          <span className="rounded-full border px-2.5 py-1 text-[9px] font-bold" style={{ borderColor: preview.primary, color: preview.primary }}>
            {preview.secondaryAction}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 px-4 py-3">
        {preview.items.map((s) => (
          <div key={s} className="rounded-md border border-slate-200 bg-white p-2">
            <div className="mb-1 flex h-4 w-4 items-center justify-center rounded" style={{ backgroundColor: preview.soft }}>
              <PreviewIcon className="h-2.5 w-2.5" style={{ color: preview.primary }} />
            </div>
            <div className="text-[9px] font-bold" style={{ color: preview.primary }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PROOF STRIP ─────────────────────────────────────────────────────────
const PROOF_NAMES = [
  'AK Designs · Mississauga',
  'Mike the Mechanic · Bolton',
  'Aqua Mer Spa · Bolton',
  "Clancy's Chippery · Toronto",
  'Canadian Association of Paediatric Nurses · Toronto',
  'North Hill Florist · Calgary',
  'Folk & Tide Cafe · Halifax',
  'Maple & Steel Studio · Toronto',
];

function ProofStrip() {
  // Dot lives BETWEEN labels — rendered after each item so spacing is equidistant
  // and the marquee seam reads "… Nlast · N1 · N2 …" rather than overlapping.
  const Row = (
    <ul className="flex flex-shrink-0 items-center py-6">
      {PROOF_NAMES.map((n, i) => (
        <Fragment key={i}>
          <li className="whitespace-nowrap text-[17px] font-bold tracking-tight text-slate-400">
            {n}
          </li>
          <li aria-hidden="true" className="px-7">
            <span className="block h-1.5 w-1.5 rounded-full bg-red-600" />
          </li>
        </Fragment>
      ))}
    </ul>
  );

  return (
    <section className="overflow-hidden border-y border-slate-800 bg-slate-900 text-slate-300">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-6 pt-5 pb-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
          Powering Canadian small business
        </span>
        <span className="text-[11px] text-slate-600">·</span>
        <span className="text-[11px] text-slate-400">From the trades to the table.</span>
      </div>
      <div
        className="relative w-full overflow-hidden"
        style={{
          maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
        }}
      >
        <div className="ksw-marquee flex">
          {Row}
          {Row}
        </div>
      </div>
      <style jsx>{`
        :global(.ksw-marquee) { animation: ksw-marquee 40s linear infinite; }
        @keyframes ksw-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
    </section>
  );
}

// ── THREE REASONS ───────────────────────────────────────────────────────
const REASONS = [
  {
    n: '01',
    title: 'It actually launches.',
    body:
      "Most builders trap you in a half-finished draft. Tell us what you do and you'll have a real website by lunch — not a Pinterest board of intentions.",
    stat: '5 min',
    statLabel: 'median time to first publish',
  },
  {
    n: '02',
    title: "It doesn't get expensive.",
    body:
      'Fifteen dollars a month covers hosting, the AI edits, and a real human if you get stuck. Add a custom domain for $30/mo on Pro. No tier creep, no per-seat surprises.',
    stat: 'from $15',
    statLabel: 'per month, no upcharges',
  },
  {
    n: '03',
    title: 'It books real customers.',
    body:
      'Every template ships with a working contact form, a Google Maps embed, click-to-call, and reviews — the boring stuff that actually moves the needle.',
    stat: '32%',
    statLabel: 'average lift in inquiries (yr 1)',
  },
];

function ThreeReasons() {
  return (
    <section className="bg-white px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mb-16 max-w-2xl"
        >
          <div className="mb-3.5 text-xs font-extrabold tracking-[0.12em] text-red-600">
            WHY KEYSTONE
          </div>
          <h2
            className="font-black tracking-[-0.025em] text-black"
            style={{ fontSize: 'clamp(36px, 5.5vw, 64px)', lineHeight: 1.02 }}
          >
            Three reasons<br />
            this <em className="text-red-600">actually</em> works.
          </h2>
        </motion.div>

        <div className="flex flex-col border-t border-slate-200">
          {REASONS.map((it, i) => (
            <motion.div
              key={it.n}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="grid items-start gap-8 border-b border-slate-200 py-10 md:grid-cols-[80px_1fr_240px]"
            >
              <div className="pt-1.5 font-mono text-sm font-bold text-slate-400">{it.n}</div>
              <div>
                <h3
                  className="mb-3 font-black tracking-[-0.015em] text-black"
                  style={{ fontSize: 'clamp(22px, 2.6vw, 32px)', lineHeight: 1.1 }}
                >
                  {it.title}
                </h3>
                <p className="max-w-[560px] text-base leading-relaxed text-slate-600">{it.body}</p>
              </div>
              <div className="md:text-right">
                <div
                  className="font-black tracking-[-0.03em] text-red-600 leading-none"
                  style={{ fontSize: 56 }}
                >
                  {it.stat}
                </div>
                <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {it.statLabel}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── BEFORE / AFTER ──────────────────────────────────────────────────────
const UPGRADE_BULLETS = [
  'Real photos and copy, written by AI',
  'Fast on mobile (Lighthouse 95+)',
  'Live phone, map, and reviews block',
  'Ranks for your city + service',
];

function BeforeAfter() {
  const [pos, setPos] = useState(50);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const interactedRef = useRef(false);

  // One-time auto-demo so it's obvious the divider is grabbable.
  // Cancels as soon as the user touches the slider.
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + 700;
    const dur = 2400;
    const tick = (now: number) => {
      if (interactedRef.current) return;
      const t = (now - start) / dur;
      if (t < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (t >= 1) {
        setPos(50);
        return;
      }
      // ease in-out triangle: 50 → 72 → 28 → 50
      const k = t * 4;
      let p: number;
      if (k < 1) p = 50 + 22 * easeInOut(k);
      else if (k < 3) p = 72 - 44 * easeInOut((k - 1) / 2);
      else p = 28 + 22 * easeInOut(k - 3);
      setPos(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    interactedRef.current = true;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const update = (clientX: number) => {
      const x = ((clientX - rect.left) / rect.width) * 100;
      setPos(Math.max(2, Math.min(98, x)));
    };
    update(e.clientX);
    const move = (ev: PointerEvent) => update(ev.clientX);
    const up = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <section className="bg-slate-50 px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div>
            <div className="mb-3.5 text-xs font-extrabold tracking-[0.12em] text-red-600">
              THE UPGRADE
            </div>
            <h2
              className="mb-5 font-black tracking-[-0.025em] text-black"
              style={{ fontSize: 'clamp(32px, 4.4vw, 56px)', lineHeight: 1.02 }}
            >
              From <em className="italic text-slate-400">oof</em><br />
              to <span className="text-red-600">open for business.</span>
            </h2>
            <p className="mb-6 max-w-[460px] text-[17px] leading-relaxed text-slate-700">
              Most small-business sites haven&apos;t been touched since 2014. Drag the slider to see what fifteen minutes of Keystone looks like.
            </p>
            <div className="flex flex-col gap-2.5">
              {UPGRADE_BULLETS.map((b) => (
                <div key={b} className="flex items-center gap-2.5">
                  <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-red-600">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-900">{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Slider */}
          <div
            ref={wrapRef}
            onPointerDown={onPointerDown}
            className="relative select-none overflow-hidden rounded-2xl border border-slate-200 shadow-[0_25px_50px_-12px_rgba(15,23,42,.18)]"
            style={{ aspectRatio: '16 / 11', cursor: 'ew-resize', touchAction: 'none' }}
          >
            <div className="absolute inset-0">
              <KeystoneSiteMock />
            </div>
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
            >
              <OldSiteMock />
            </div>
            <div className="absolute left-4 top-4 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.08em] text-white">
              BEFORE
            </div>
            {/* AFTER badge is the CTA — placed bottom-right so it doesn't overlap the preview's nav */}
            <Link
              href="/onboarding"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-[11px] font-extrabold tracking-[0.08em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-red-700"
            >
              BUILD YOURS — FREE <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <div
              className="ksw-divider absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.1)]"
              style={{ left: `${pos}%`, cursor: 'ew-resize' }}
            >
              <div className="ksw-handle absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-base font-extrabold text-slate-900 shadow-[0_4px_12px_rgba(0,0,0,.22)]">
                <span aria-hidden="true">‹</span>
                <span aria-hidden="true">›</span>
              </div>
            </div>
            <style jsx>{`
              :global(.ksw-handle) { animation: ksw-handle-pulse 2.2s ease-in-out infinite; }
              @keyframes ksw-handle-pulse {
                0%, 100% { box-shadow: 0 4px 12px rgba(0,0,0,.22), 0 0 0 0 rgba(254,69,69,.55); }
                50%      { box-shadow: 0 4px 12px rgba(0,0,0,.22), 0 0 0 10px rgba(254,69,69,0); }
              }
            `}</style>
          </div>
        </div>
      </div>
    </section>
  );
}

function OldSiteMock() {
  return (
    <div
      className="relative h-full w-full p-4"
      style={{ background: '#fefce8', fontFamily: 'Times New Roman, serif', color: '#1e1b4b' }}
    >
      <div
        className="mb-3 text-[22px] font-bold italic"
        style={{
          background: 'linear-gradient(180deg, #1e3a8a, #1e40af)',
          color: '#fde047',
          padding: '8px 12px',
          textShadow: '1px 1px 0 #000',
          border: '3px ridge #fde047',
        }}
      >
        ★ HARGROVE PLUMBING ★
      </div>
      <div className="mb-1.5 text-[11px]">
        <span style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Home</span> |{' '}
        <span style={{ color: '#7c3aed', textDecoration: 'underline' }}>About Us</span> |{' '}
        <span style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Services</span> |{' '}
        <span style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Contact</span>
      </div>
      <div className="mt-2 border-2 border-slate-400 bg-white p-2.5">
        <div className="mb-1.5 text-sm font-bold" style={{ color: '#7f1d1d' }}>
          Welcome to our website!!
        </div>
        <div className="text-[11px] leading-snug" style={{ color: '#1e1b4b' }}>
          We are family owned plumbers serving the area since 1987. Please call us at{' '}
          <span style={{ color: '#1d4ed8', textDecoration: 'underline' }}>(555) 010-2244</span> for all your plumbing needs! We do drains, water heaters, toilets, sinks, and MORE!
        </div>
        <div
          className="mt-2.5 inline-block px-2 py-1 text-[10px] font-bold"
          style={{
            background: 'linear-gradient(180deg, #fef08a, #facc15)',
            border: '2px outset #ca8a04',
          }}
        >
          ► Click Here for Estimate ◄
        </div>
      </div>
      <div className="absolute bottom-2 left-3 right-3 text-center text-[9px] italic text-slate-500">
        ★ Best viewed in Internet Explorer 6 ★ © 2008 ★ Hit Counter: 04127 ★
      </div>
    </div>
  );
}

function KeystoneSiteMock() {
  return (
    <div className="flex h-full w-full flex-col bg-white font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600">
            <Hammer className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-extrabold text-slate-900">Hargrove Plumbing</span>
        </div>
        <div className="flex gap-4 text-xs font-medium text-slate-600">
          <span>Services</span>
          <span>About</span>
          <span>Reviews</span>
          <span>Contact</span>
        </div>
        <span className="text-xs font-bold text-slate-900">(555) 010-2244</span>
      </div>
      <div className="flex flex-1 items-center gap-5 bg-gradient-to-br from-red-50 to-white px-5 py-8">
        <div className="flex-1">
          <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-0.5 text-[9px] font-bold text-red-600">
            <span className="h-1 w-1 rounded-full bg-red-600" /> 24/7 EMERGENCY
          </div>
          <div className="mb-2 text-2xl font-black leading-tight tracking-tight text-slate-900">
            Plumbing fixed right,<br />the first time.
          </div>
          <div className="mb-3 text-[11px] leading-snug text-slate-600">
            Family-owned plumbing in Boise. Same-day service, fair prices, no surprises.
          </div>
          <div className="flex gap-1.5">
            <span className="rounded-full bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white">Book Service</span>
            <span className="rounded-full border border-slate-900 px-3 py-1.5 text-[10px] font-bold text-slate-900">(555) 010-2244</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center rounded-xl border border-red-200 bg-gradient-to-br from-red-100 to-white" style={{ aspectRatio: '4 / 3' }}>
          <Hammer className="h-12 w-12 text-red-600" strokeWidth={1.4} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-5 pb-5">
        {['Emergency', 'Drain Cleaning', 'Water Heaters'].map((s) => (
          <div key={s} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="text-[10px] font-bold text-slate-900">{s}</div>
            <div className="mt-0.5 text-[9px] text-slate-500">From $89</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TEMPLATES ───────────────────────────────────────────────────────────
function TemplateSection() {
  return (
    <section className="overflow-hidden bg-slate-950 py-20">
      <div className="mx-auto mb-12 max-w-6xl px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mb-4 font-black tracking-[-0.015em] text-white"
          style={{ fontSize: 'clamp(32px, 4vw, 48px)', lineHeight: 1.1 }}
        >
          Designed to Sell
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto max-w-[640px] text-lg leading-relaxed text-slate-300"
        >
          Templates crafted for trades, restaurants, retail, and every kind of small business.
        </motion.p>
      </div>

      <div className="space-y-5">
        {[TEMPLATE_IMAGES, [...TEMPLATE_IMAGES].reverse()].map((row, ri) => (
          <div
            key={ri}
            style={{
              maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
              WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
            }}
          >
            <div className={`flex gap-5 ${ri === 0 ? 'animate-scroll-left' : 'animate-scroll-right'}`} style={{ width: 'max-content' }}>
              {[...row, ...row].map((img, i) => (
                <div
                  key={`row${ri}-${i}`}
                  className="relative w-72 flex-none overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition-transform hover:scale-[1.04]"
                  style={{ aspectRatio: '16 / 10' }}
                >
                  <Image src={img} alt="" fill className="object-cover object-top" sizes="288px" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 text-center">
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-bold text-slate-900 transition hover:bg-slate-100"
        >
          Browse All Templates <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// ── PRICE SLAB ──────────────────────────────────────────────────────────
const PRICE_FEATURES: Array<[string, boolean]> = [
  ['Unlimited AI edits', false],
  ['Mobile-first design', false],
  ['Forms + reviews', false],
  ['Lighthouse 95+ speed', false],
  ['Real human support', false],
  ['Daily backups', false],
  ['No ad surprises', false],
  ['Custom domain', true],
];

function PriceSlab() {
  return (
    <section className="relative overflow-hidden bg-red-600 px-6 py-28 text-white">
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-red-400 opacity-50 blur-[80px]" />
      <div className="absolute -bottom-36 -right-36 h-[500px] w-[500px] rounded-full bg-red-800 opacity-50 blur-[100px]" />

      <div className="relative mx-auto max-w-6xl text-center">
        <div className="mb-6 text-xs font-extrabold uppercase tracking-[0.18em] opacity-85">
          STRAIGHTFORWARD PRICING · CANCEL ANYTIME
        </div>
        <div
          className="mb-3 font-black tracking-[-0.05em]"
          style={{
            fontSize: 'clamp(120px, 22vw, 280px)',
            lineHeight: 0.85,
            textShadow: '0 8px 30px rgba(0,0,0,.15)',
          }}
        >
          $15
          <span
            className="font-bold opacity-70"
            style={{ fontSize: '0.35em', letterSpacing: 0, marginLeft: 8, verticalAlign: 'top' }}
          >
            /mo*
          </span>
        </div>
        <div
          className="mx-auto mb-9 max-w-[720px] font-semibold italic opacity-95"
          style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', lineHeight: 1.4 }}
        >
          Hosting, AI edits, fast templates, and an actual person on the other end of an email. Cancel anytime — really.
        </div>

        <div className="mx-auto mb-10 grid max-w-[760px] gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {PRICE_FEATURES.map(([f, isPro]) => (
            <div key={f} className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white">
                <Check className="h-3 w-3 text-red-600" />
              </div>
              <span className="text-left">
                {f}
                {isPro && (
                  <a href="#pricing-note" className="align-super text-[10px] no-underline opacity-80 hover:opacity-100">†</a>
                )}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2.5 rounded-full bg-white px-9 py-4 text-[17px] font-extrabold text-red-600 shadow-[0_20px_40px_-10px_rgba(0,0,0,.3)] transition hover:-translate-y-0.5"
        >
          Start Building — Free <ArrowRight className="h-4.5 w-4.5" />
        </Link>

        <p
          id="pricing-note"
          className="mx-auto mt-10 max-w-[680px] text-[12px] leading-relaxed text-white/80"
        >
          * <strong>$15/mo Basic</strong> publishes your site on a Keystone subdomain
          (<span className="font-mono">yoursite.kswd.ca</span>). <strong>$30/mo Pro</strong>{' '}
          (<span>†</span>) unlocks a custom domain — one free registration included — plus more
          published sites and storage. <Link href="/pricing" className="underline underline-offset-2 hover:text-white">See full pricing →</Link>
        </p>
      </div>
    </section>
  );
}

// ── CLOSING ─────────────────────────────────────────────────────────────
function ClosingCTA() {
  return (
    <section className="relative overflow-hidden bg-slate-900 px-6 py-28 text-white">
      <div
        className="pointer-events-none absolute left-1/2 -top-48 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-red-600 opacity-[0.18] blur-[140px]"
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <h2
          className="mb-7 font-black tracking-[-0.03em]"
          style={{ fontSize: 'clamp(40px, 6.5vw, 88px)', lineHeight: 0.98 }}
        >
          Stop waiting.<br />
          <span className="text-red-600">Get online today.</span>
        </h2>
        <p className="mx-auto mb-9 max-w-[560px] text-lg leading-relaxed text-slate-300">
          The customers looking for you right now are finding someone else. Ten minutes from now, that doesn&apos;t have to be true.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2.5 rounded-full bg-red-600 px-9 py-4 text-base font-extrabold text-white shadow-[0_20px_40px_-10px_rgba(254,69,69,.5)] transition hover:bg-red-700"
        >
          Start Your Free Website <ArrowRight className="h-4.5 w-4.5" />
        </Link>
        <div className="mt-6 text-sm text-slate-500">
          No credit card. Free until you publish.
        </div>
      </div>
    </section>
  );
}
