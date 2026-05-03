'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, X, Zap, Check } from 'lucide-react';

interface AIOnboardingWizardProps {
  /** Pre-fill the first stage's description (e.g. from the entry textarea) */
  initialDescription?: string;
  /** Called when the user is ready to build. Receives the composed prompt. */
  onSubmit: (composedPrompt: string) => void;
  /** Close the wizard without submitting (X button in the top-right). */
  onClose: () => void;
  /** Whether the parent is currently building (disables submit, shows spinner). */
  submitting?: boolean;
  /** Optional error from the parent's submit attempt. */
  error?: string | null;
}

type Stage = 0 | 1 | 2 | 3;

// Rotated through the placeholder of the first stage to suggest concrete prompts.
const PROMPT_EXAMPLES = [
  'A small ceramics studio in Brooklyn that sells hand-thrown tableware...',
  'A neighborhood pizza place with takeout, a seasonal menu, and a small dining room...',
  'A two-person law firm focused on small-business contracts and incorporation...',
  'A modern fitness studio that runs HIIT classes and personal training...',
  'A photographer specializing in moody outdoor portrait sessions...',
  'A non-profit that organizes community cleanups and tree planting events...',
];

// Style chips — informs template selection + tone for the AI.
const STYLE_OPTIONS = [
  { id: 'bold', label: 'Bold & loud', hint: 'Big type, saturated colors' },
  { id: 'minimal', label: 'Clean & minimal', hint: 'White space, restrained' },
  { id: 'warm', label: 'Warm & friendly', hint: 'Earth tones, approachable' },
  { id: 'luxury', label: 'Luxury & elegant', hint: 'Serifs, refined details' },
  { id: 'playful', label: 'Playful & quirky', hint: 'Rounded, fun, expressive' },
  { id: 'dark', label: 'Dark & techy', hint: 'Dark mode, neon accents' },
  { id: 'editorial', label: 'Editorial & serious', hint: 'Magazine-like, authored' },
  { id: 'earthy', label: 'Earthy & natural', hint: 'Organic shapes, muted' },
];

// Page chips — drives multi-page generation by the AI.
const PAGE_OPTIONS = [
  { id: 'home', label: 'Home', required: true },
  { id: 'shop', label: 'Shop / Products' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
  { id: 'booking', label: 'Booking' },
  { id: 'menu', label: 'Menu' },
  { id: 'gallery', label: 'Gallery / Portfolio' },
  { id: 'blog', label: 'Blog / Articles' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
  { id: 'team', label: 'Team' },
];

// Extras chips — quick presets the user can tap to fill the freeform "anything else" field.
const EXTRA_PRESETS = [
  'Looking for a name suggestion',
  'Audience: small businesses',
  'Audience: families with kids',
  'Audience: young creatives',
  'Needs an estimate / quote form',
  'Needs an online booking flow',
  'Should highlight reviews & testimonials',
  'Should feel local / community-focused',
];

export default function AIOnboardingWizard({
  initialDescription = '',
  onSubmit,
  onClose,
  submitting = false,
  error = null,
}: AIOnboardingWizardProps) {
  const [stage, setStage] = useState<Stage>(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const [description, setDescription] = useState(initialDescription);
  const [styleIds, setStyleIds] = useState<string[]>([]);
  const [pageIds, setPageIds] = useState<string[]>(['home']);
  const [extras, setExtras] = useState('');

  const [examplePlaceholder, setExamplePlaceholder] = useState(PROMPT_EXAMPLES[0]);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const extrasRef = useRef<HTMLTextAreaElement>(null);

  // Cycle the description placeholder so the input feels alive.
  useEffect(() => {
    if (stage !== 0) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % PROMPT_EXAMPLES.length;
      setExamplePlaceholder(PROMPT_EXAMPLES[i]);
    }, 4500);
    return () => clearInterval(interval);
  }, [stage]);

  // Autofocus the active stage's primary input.
  useEffect(() => {
    if (stage === 0) descriptionRef.current?.focus();
    if (stage === 3) extrasRef.current?.focus();
  }, [stage]);

  // Block body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Submit-anytime composer. Stages omitted by skipping are simply left out.
  const composedPrompt = useMemo(() => buildComposedPrompt({ description, styleIds, pageIds, extras }), [description, styleIds, pageIds, extras]);

  const canAdvance = stage === 0 ? description.trim().length >= 5 : true;
  const canSubmit = description.trim().length >= 5 && !submitting;

  const goNext = () => {
    if (stage < 3 && canAdvance) {
      setDirection('forward');
      setStage((s) => (s + 1) as Stage);
    }
  };
  const goBack = () => {
    if (stage > 0) {
      setDirection('backward');
      setStage((s) => (s - 1) as Stage);
    }
  };
  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(composedPrompt);
  };

  const togglePill = (list: string[], setList: (v: string[]) => void, id: string, opts?: { max?: number; required?: boolean }) => {
    if (opts?.required) return; // home is locked on
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
    } else {
      const max = opts?.max;
      if (max && list.length >= max) {
        // Replace the oldest non-required selection.
        setList([...list.slice(1), id]);
      } else {
        setList([...list, id]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white">
      {/* Animated background: subtle moving gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-violet-600/30 blur-3xl ai-onboarding-blob ai-onboarding-blob-a" />
        <div className="absolute -bottom-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-blue-600/30 blur-3xl ai-onboarding-blob ai-onboarding-blob-b" />
        <div className="absolute top-1/2 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/20 blur-3xl ai-onboarding-blob ai-onboarding-blob-c" />
      </div>

      {/* Top bar: progress + close */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-10">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/70">
          <Sparkles className="h-4 w-4 text-violet-300" />
          Archie · Step {stage + 1} of 4
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Progress bar */}
      <div className="relative z-10 mx-6 mt-4 sm:mx-10">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-violet-400 via-pink-400 to-blue-400 transition-all duration-500"
            style={{ width: `${((stage + 1) / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Stage content — keyed by stage so React fully remounts and triggers the animation */}
      <main className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto px-6 py-10 sm:px-10">
        <div
          key={stage}
          className={direction === 'forward' ? 'ai-onboarding-stage-in-forward w-full max-w-3xl' : 'ai-onboarding-stage-in-backward w-full max-w-3xl'}
        >
          {stage === 0 && (
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-violet-300">First, the basics</p>
              <h1 className="mb-6 text-4xl font-black leading-tight sm:text-5xl">
                What are you <span className="bg-gradient-to-r from-violet-300 to-pink-300 bg-clip-text text-transparent">building</span>?
              </h1>
              <p className="mb-8 max-w-xl text-lg text-white/70">
                Describe your business in a sentence or two. The more specific you are, the better Archie can tailor the site.
              </p>
              <div className="rounded-2xl border-2 border-white/15 bg-white/5 p-2 backdrop-blur-sm transition focus-within:border-violet-400/60 focus-within:bg-white/10">
                <textarea
                  ref={descriptionRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 600))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (canAdvance) goNext();
                    }
                  }}
                  rows={4}
                  placeholder={examplePlaceholder}
                  className="w-full resize-none bg-transparent px-4 py-3 text-lg text-white placeholder:text-white/40 focus:outline-none"
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <span className={`text-xs ${description.length >= 600 ? 'text-pink-300' : 'text-white/50'}`}>
                    {description.length}/600
                  </span>
                  <span className="text-xs text-white/50">Press ⌘/Ctrl + Enter to continue</span>
                </div>
              </div>
            </div>
          )}

          {stage === 1 && (
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-violet-300">Optional · Visual style</p>
              <h1 className="mb-6 text-4xl font-black leading-tight sm:text-5xl">
                What should it <span className="bg-gradient-to-r from-violet-300 to-pink-300 bg-clip-text text-transparent">feel</span> like?
              </h1>
              <p className="mb-8 max-w-xl text-lg text-white/70">
                Pick up to two — Archie picks a matching template and palette.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {STYLE_OPTIONS.map((opt) => {
                  const selected = styleIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => togglePill(styleIds, setStyleIds, opt.id, { max: 2 })}
                      className={`group flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
                        selected
                          ? 'border-violet-400 bg-violet-500/20'
                          : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10'
                      }`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${selected ? 'border-violet-300 bg-violet-300' : 'border-white/40 bg-transparent'}`}>
                        {selected && <Check className="h-3 w-3 text-violet-900" />}
                      </span>
                      <span>
                        <span className="block font-bold">{opt.label}</span>
                        <span className="block text-sm text-white/60">{opt.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {stage === 2 && (
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-violet-300">Optional · Pages</p>
              <h1 className="mb-6 text-4xl font-black leading-tight sm:text-5xl">
                Which <span className="bg-gradient-to-r from-violet-300 to-pink-300 bg-clip-text text-transparent">pages</span> do you need?
              </h1>
              <p className="mb-8 max-w-xl text-lg text-white/70">
                Pick everything that applies. Archie will design and link each page.
              </p>
              <div className="flex flex-wrap gap-2">
                {PAGE_OPTIONS.map((opt) => {
                  const selected = pageIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => togglePill(pageIds, setPageIds, opt.id, { required: opt.required })}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${
                        selected
                          ? 'border-violet-400 bg-violet-500/30 text-white'
                          : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white'
                      } ${opt.required ? 'cursor-default opacity-90' : 'cursor-pointer'}`}
                      disabled={opt.required}
                    >
                      {selected && <Check className="-ml-1 mr-1 inline h-4 w-4" />}
                      {opt.label}
                      {opt.required && <span className="ml-1 text-xs text-white/50">(always)</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {stage === 3 && (
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-violet-300">Optional · Anything else</p>
              <h1 className="mb-6 text-4xl font-black leading-tight sm:text-5xl">
                Any <span className="bg-gradient-to-r from-violet-300 to-pink-300 bg-clip-text text-transparent">extra context</span>?
              </h1>
              <p className="mb-6 max-w-xl text-lg text-white/70">
                Brand name ideas, target audience, special features — anything that would help.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {EXTRA_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const next = extras.trim() ? `${extras.trim()}\n• ${preset}` : `• ${preset}`;
                      setExtras(next.slice(0, 600));
                    }}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border-2 border-white/15 bg-white/5 p-2 backdrop-blur-sm transition focus-within:border-violet-400/60 focus-within:bg-white/10">
                <textarea
                  ref={extrasRef}
                  value={extras}
                  onChange={(e) => setExtras(e.target.value.slice(0, 600))}
                  rows={4}
                  placeholder="e.g. Audience is busy parents. Brand name ideas welcome. Should feel trustworthy but warm."
                  className="w-full resize-none bg-transparent px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none"
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <span className={`text-xs ${extras.length >= 600 ? 'text-pink-300' : 'text-white/50'}`}>
                    {extras.length}/600
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer: nav controls + skip-to-build */}
      <footer className="relative z-10 border-t border-white/10 bg-black/30 px-6 py-5 backdrop-blur-md sm:px-10">
        {error && (
          <p className="mb-3 text-center text-sm text-pink-300">{error}</p>
        )}
        <div className="mx-auto flex max-w-3xl flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={stage === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              title="Skip the rest and build with what we have so far"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Building…
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Build now
                </>
              )}
            </button>

            {stage < 3 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Building…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Build my site
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Component-scoped animation styles */}
      <style jsx>{`
        @keyframes ai-onboarding-blob-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(60px, 40px) scale(1.1); }
        }
        @keyframes ai-onboarding-blob-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, -30px) scale(1.08); }
        }
        @keyframes ai-onboarding-blob-c {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.15); }
        }
        :global(.ai-onboarding-blob-a) { animation: ai-onboarding-blob-a 18s ease-in-out infinite; }
        :global(.ai-onboarding-blob-b) { animation: ai-onboarding-blob-b 22s ease-in-out infinite; }
        :global(.ai-onboarding-blob-c) { animation: ai-onboarding-blob-c 14s ease-in-out infinite; }

        @keyframes ai-onboarding-stage-in-forward {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes ai-onboarding-stage-in-backward {
          from { opacity: 0; transform: translateX(-24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        :global(.ai-onboarding-stage-in-forward) { animation: ai-onboarding-stage-in-forward 380ms cubic-bezier(0.22, 1, 0.36, 1); }
        :global(.ai-onboarding-stage-in-backward) { animation: ai-onboarding-stage-in-backward 380ms cubic-bezier(0.22, 1, 0.36, 1); }
      `}</style>
    </div>
  );
}

interface ComposeArgs {
  description: string;
  styleIds: string[];
  pageIds: string[];
  extras: string;
}

/**
 * Compose the user's wizard answers into a single structured prompt for the AI.
 * Stages with no useful input are simply omitted so a "Build now" after stage 1
 * still produces a clean prompt.
 */
function buildComposedPrompt({ description, styleIds, pageIds, extras }: ComposeArgs): string {
  const parts: string[] = [];

  parts.push('Build me a complete website. Use setTemplate, replaceBlocks (for the home page), createPages (for the supporting pages), and setHeaderConfig as appropriate.');
  parts.push('');
  parts.push(`About the business: ${description.trim()}`);

  const styleLabels = styleIds.map((id) => STYLE_OPTIONS.find((o) => o.id === id)?.label).filter(Boolean) as string[];
  if (styleLabels.length > 0) {
    parts.push('');
    parts.push(`Style preferences: ${styleLabels.join(' + ')}. Pick a template, palette, fonts, and __customCss treatments that match this feel.`);
  }

  // Always tell the AI which pages — even default ['home'] — so it doesn't
  // invent extras the user didn't ask for.
  const pageLabels = pageIds.filter((id) => id !== 'home').map((id) => PAGE_OPTIONS.find((p) => p.id === id)?.label).filter(Boolean) as string[];
  if (pageLabels.length > 0) {
    parts.push('');
    parts.push(`Pages I want (besides Home): ${pageLabels.join(', ')}. Use createPages for each. Link buttons (hero, CTA) to the right pages with buttonTextLink:{linkType:"page",pageSlug:"<slug>"}.`);
  } else {
    parts.push('');
    parts.push('Pages: Home only. Build a single rich Home page.');
  }

  if (extras.trim()) {
    parts.push('');
    parts.push(`Other notes: ${extras.trim()}`);
  }

  return parts.join('\n');
}
