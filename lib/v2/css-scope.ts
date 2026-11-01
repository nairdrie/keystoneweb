/**
 * Scope a section's CSS to that section, so agents can write plain selectors
 * (`.title`, `h2`) without leaking into the rest of the page.
 *
 * `:root`, `html`, `body` and `:scope` inside section CSS mean "this section".
 * @keyframes, @font-face and @property are left global; @media, @supports,
 * @container and @layer blocks are scoped recursively.
 */
import postcss, { type Root, type Rule } from 'postcss';

const NON_SCOPED_AT_RULES = new Set(['keyframes', '-webkit-keyframes', 'font-face', 'property', 'counter-style', 'page']);

export function sectionScopeSelector(sectionKey: string): string {
  return `[data-ks-section="${sectionKey.replace(/"/g, '')}"]`;
}

export function scopeCss(css: string, scope: string): { css: string; error?: string } {
  if (!css || !css.trim()) return { css: '' };
  let root: Root;
  try {
    root = postcss.parse(css);
  } catch (e) {
    return { css: '', error: (e as Error).message };
  }

  root.walkRules((rule: Rule) => {
    if (isInsideNonScopedAtRule(rule)) return;
    rule.selectors = rule.selectors.map((selector) => scopeSelector(selector, scope));
  });

  return { css: root.toString() };
}

function isInsideNonScopedAtRule(rule: Rule): boolean {
  let parent = rule.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule' && NON_SCOPED_AT_RULES.has((parent as postcss.AtRule).name.toLowerCase())) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function scopeSelector(selector: string, scope: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith(scope)) return trimmed;

  // Runtime state classes live on <html>: keep them as ancestors of the scope.
  const stateMatch = trimmed.match(/^((?:html|:root)?(?:\.ks-(?:js|mode-[a-z]+))+)(?:\s+(.*)|$)/i);
  if (stateMatch) {
    const rest = (stateMatch[2] || '').trim();
    return rest ? `${stateMatch[1]} ${scopeSelector(rest, scope)}` : `${stateMatch[1]} ${scope}`;
  }

  // :root / html / body / :scope at the start mean the section itself.
  const rootMatch = trimmed.match(/^(:root|html|body|:scope)\b(.*)$/i);
  if (rootMatch) {
    let rest = rootMatch[2];
    // "html body .x" → strip the second one too
    rest = rest.replace(/^\s+(body)\b/i, '');
    return `${scope}${rest}`;
  }
  return `${scope} ${trimmed}`;
}

/** Pull top-level <style> and <script type="module"> out of a section's HTML. */
export function splitSectionSource(source: string): { html: string; css: string; js: string } {
  let css = '';
  let js = '';
  const html = String(source || '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, body: string) => {
      css += `${body}\n`;
      return '';
    })
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs: string, body: string) => {
      if (/\bsrc\s*=/.test(attrs)) return match; // left in place; the validator rejects it
      js += `${body}\n`;
      return '';
    });
  return { html: html.trim(), css: css.trim(), js: js.trim() };
}
