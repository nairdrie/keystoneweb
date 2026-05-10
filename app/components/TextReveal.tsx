'use client';

/**
 * Renders animated text using the configured TextRevealConfig.
 *
 * Supports three effects:
 *   - typewriter: types characters left-to-right at `speed` chars/sec
 *   - word: reveals one word at a time at `speed` words/sec
 *   - letter-fade: cross-fades each letter with overlapping `speed` letters/sec
 *
 * Triggers on viewport entry by default. If `trigger.kind === 'after'`, waits
 * for that token via the animation bus before starting. Emits a "done" event
 * for its own token (text:<contentKey>) so downstream blocks can chain.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { markComplete, useAnimationGate } from '@/lib/animation-bus';
import { sanitizeRichHtml } from '@/lib/html-sanitize';
import {
  textToken,
  type TextRevealConfig,
} from '@/lib/animations';

interface TextRevealProps {
  contentKey: string;
  html: string;
  config: TextRevealConfig;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
}

export default function TextReveal({
  contentKey,
  html,
  config,
  className,
  style,
  as = 'span',
}: TextRevealProps) {
  const Component = as;
  const prefersReducedMotion = useReducedMotion();
  const gateOpen = useAnimationGate(config.trigger?.kind === 'after' ? config.trigger.after : undefined);
  const containerRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      const fallback = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(fallback);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: '-50px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const plainText = useMemo(() => stripTags(html), [html]);
  const safeHtml = useMemo(() => sanitizeRichHtml(html), [html]);
  const reduceMotion = prefersReducedMotion === true;
  const shouldAnimate = inView && gateOpen && !reduceMotion;

  useEffect(() => {
    if (reduceMotion) markComplete(textToken(contentKey));
  }, [reduceMotion, contentKey]);

  if (reduceMotion) {
    return (
      <Component
        ref={containerRef as React.Ref<HTMLElement>}
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  if (config.effect === 'typewriter') {
    return (
      <TypewriterText
        contentKey={contentKey}
        text={plainText}
        speed={config.speed}
        delayMs={config.delayMs}
        active={shouldAnimate}
        className={className}
        style={style}
        as={as}
        innerRef={containerRef}
      />
    );
  }

  if (config.effect === 'word') {
    return (
      <WordReveal
        contentKey={contentKey}
        text={plainText}
        speed={config.speed}
        delayMs={config.delayMs}
        active={shouldAnimate}
        className={className}
        style={style}
        as={as}
        innerRef={containerRef}
      />
    );
  }

  if (config.effect === 'letter-fade') {
    return (
      <LetterFade
        contentKey={contentKey}
        text={plainText}
        speed={config.speed}
        delayMs={config.delayMs}
        active={shouldAnimate}
        className={className}
        style={style}
        as={as}
        innerRef={containerRef}
      />
    );
  }

  return (
    <Component
      ref={containerRef as React.Ref<HTMLElement>}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

interface RevealVariantProps {
  contentKey: string;
  text: string;
  speed: number;
  delayMs?: number;
  active: boolean;
  className?: string;
  style?: React.CSSProperties;
  as: React.ElementType;
  innerRef: React.RefObject<HTMLElement | null>;
}

function TypewriterText({ contentKey, text, speed, delayMs, active, className, style, as, innerRef }: RevealVariantProps) {
  const Component = as;
  const [chars, setChars] = useState(0);
  const sanitizedSpeed = speed > 0 ? speed : 25;
  const stepMs = Math.max(8, 1000 / sanitizedSpeed);

  useEffect(() => {
    if (!active) return;
    if (!text) {
      markComplete(textToken(contentKey));
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const start = () => {
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i += 1;
        setChars(i);
        if (i >= text.length) {
          markComplete(textToken(contentKey));
          return;
        }
        timer = setTimeout(tick, stepMs);
      };
      tick();
    };
    const initialDelay = Math.max(0, delayMs ?? 0);
    timer = setTimeout(start, initialDelay);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, text, stepMs, delayMs, contentKey]);

  const visible = text.slice(0, chars);
  const showCaret = active && chars < text.length;

  return (
    <Component
      ref={innerRef as React.Ref<HTMLElement>}
      className={className}
      style={style}
      aria-label={text}
    >
      <span aria-hidden>{visible}</span>
      {showCaret && (
        <span
          aria-hidden
          className="inline-block w-[0.5ch] -mb-0.5 ml-[1px] animate-pulse"
          style={{ background: 'currentColor', height: '1em', verticalAlign: 'baseline' }}
        />
      )}
    </Component>
  );
}

function WordReveal({ contentKey, text, speed, delayMs, active, className, style, as, innerRef }: RevealVariantProps) {
  const Component = as;
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const [count, setCount] = useState(0);
  const wordIndices = useMemo(() => words.reduce<number[]>((acc, part, idx) => {
    if (!/^\s+$/.test(part) && part.length > 0) acc.push(idx);
    return acc;
  }, []), [words]);
  const sanitizedSpeed = speed > 0 ? speed : 4;
  const stepMs = Math.max(40, 1000 / sanitizedSpeed);

  useEffect(() => {
    if (!active) return;
    if (wordIndices.length === 0) {
      markComplete(textToken(contentKey));
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const start = () => {
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i += 1;
        setCount(i);
        if (i >= wordIndices.length) {
          markComplete(textToken(contentKey));
          return;
        }
        timer = setTimeout(tick, stepMs);
      };
      tick();
    };
    timer = setTimeout(start, Math.max(0, delayMs ?? 0));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, wordIndices, stepMs, delayMs, contentKey]);

  const revealedSet = new Set(wordIndices.slice(0, count));

  return (
    <Component ref={innerRef as React.Ref<HTMLElement>} className={className} style={style} aria-label={text}>
      {words.map((part, idx) => {
        if (/^\s+$/.test(part)) return <span key={idx} aria-hidden>{part}</span>;
        const visible = revealedSet.has(idx);
        return (
          <span
            key={idx}
            aria-hidden
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(0.25em)',
              transition: 'opacity 200ms ease-out, transform 200ms ease-out',
              display: 'inline-block',
            }}
          >
            {part}
          </span>
        );
      })}
    </Component>
  );
}

function LetterFade({ contentKey, text, speed, delayMs, active, className, style, as, innerRef }: RevealVariantProps) {
  const Component = as;
  const [count, setCount] = useState(0);
  const letters = useMemo(() => Array.from(text), [text]);
  const sanitizedSpeed = speed > 0 ? speed : 30;
  const stepMs = Math.max(8, 1000 / sanitizedSpeed);

  useEffect(() => {
    if (!active) return;
    if (letters.length === 0) {
      markComplete(textToken(contentKey));
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const start = () => {
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i += 1;
        setCount(i);
        if (i >= letters.length) {
          markComplete(textToken(contentKey));
          return;
        }
        timer = setTimeout(tick, stepMs);
      };
      tick();
    };
    timer = setTimeout(start, Math.max(0, delayMs ?? 0));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, letters, stepMs, delayMs, contentKey]);

  return (
    <Component ref={innerRef as React.Ref<HTMLElement>} className={className} style={style} aria-label={text}>
      {letters.map((char, idx) => {
        const visible = idx < count;
        return (
          <span
            key={idx}
            aria-hidden
            style={{
              opacity: visible ? 1 : 0,
              transition: 'opacity 250ms ease-out',
              display: 'inline-block',
              whiteSpace: 'pre',
            }}
          >
            {char}
          </span>
        );
      })}
    </Component>
  );
}

function stripTags(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const tmp = document.createElement('div');
  tmp.innerHTML = sanitizeRichHtml(html);
  return tmp.textContent || '';
}
