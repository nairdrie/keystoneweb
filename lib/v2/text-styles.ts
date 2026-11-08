/**
 * Text styles the owner can apply inside an editable text field.
 *
 * Agents design accents in plain HTML/CSS: `Roofs that <em class="accent">last</em>`.
 * Every inline element with a class that the agent used inside a field becomes a
 * style the owner can put on other words in that field, so the owner works in the
 * agent's own design vocabulary instead of picking free fonts and colours.
 * Nothing extra to mark up: the styles are read from the field's default text.
 */

/** One style: inline tag + class attribute ("" = the bare tag, e.g. <mark>). */
export interface TextStyle {
  t: string;
  c: string;
  l: string;
}

const MAX_STYLES = 8;

/** Classed inline elements (and bare <mark>) used in stored/default values. */
export function collectInlineStyles(values: unknown[]): TextStyle[] {
  const out: TextStyle[] = [];
  const visit = (v: unknown, depth: number) => {
    if (depth > 6 || v === null || v === undefined) return;
    if (typeof v === 'string') {
      const re = /<(span|mark|em|strong|b|i|u|s|small)\b([^>]*)>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(v))) {
        const tag = m[1].toLowerCase();
        const cls = (/\bclass\s*=\s*"([^"]*)"/i.exec(m[2])?.[1] || /\bclass\s*=\s*'([^']*)'/i.exec(m[2])?.[1] || '').trim().replace(/\s+/g, ' ');
        if (cls) out.push({ t: tag, c: cls, l: '' });
        else if (tag === 'mark') out.push({ t: 'mark', c: '', l: '' });
      }
      return;
    }
    if (Array.isArray(v)) { v.forEach((x) => visit(x, depth + 1)); return; }
    if (typeof v === 'object') for (const x of Object.values(v as Record<string, unknown>)) visit(x, depth + 1);
  };
  values.forEach((v) => visit(v, 0));
  return out;
}

/** The styles for a field, from its default (designer) and current (owner) values. */
export function textStylesFor(values: unknown[]): TextStyle[] {
  const seen = new Map<string, TextStyle>();
  for (const s of collectInlineStyles(values)) {
    const key = `${s.t}|${s.c}`;
    if (!seen.has(key) && seen.size < MAX_STYLES) seen.set(key, s);
  }
  const named = [...seen.values()].map((s) => ({ ...s, l: humanizeStyle(s) }));
  // Classes with no readable name ("hl") become Accent, Accent 2… without repeating a real name.
  const used = new Set(named.map((s) => s.l).filter(Boolean));
  let n = 0;
  return named.map((s) => {
    if (s.l) return s;
    let l = '';
    do { n++; l = n === 1 ? 'Accent' : `Accent ${n}`; } while (used.has(l));
    used.add(l);
    return { ...s, l };
  });
}

/** A readable name from the class ("text-gradient" → "Gradient"); "" when there's nothing to go on. */
function humanizeStyle(s: TextStyle): string {
  if (!s.c) return s.t === 'mark' ? 'Highlight' : '';
  const words = s.c.split(' ')[0]
    .replace(/^(ks|is|has|u|c|t|txt|text|type|font)[-_]/i, '')
    .split(/[-_]+|(?=[A-Z])/)
    .filter(Boolean);
  const label = words.join(' ').toLowerCase();
  if (label.length < 3) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}
