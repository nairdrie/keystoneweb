/**
 * In-canvas text editor for engine v2 (bundled to public/ks/text-editor.js by
 * scripts/build-ks-text-editor.mjs; loaded by public/ks/editor.js in edit mode).
 *
 * ProseMirror runs directly on the agent's element (the <h1>, <p>, <div> they
 * marked data-ks), so the text keeps its real styling while it's edited. The
 * schema only knows the formatting Keystone stores, so the output is always
 * clean: marks are merged, never stacked, and empty spans can't build up.
 *
 * Owners format text with the designer's own vocabulary:
 *  - bold / italic / underline (shown in the design's own em/strong look),
 *  - the agent's accent classes found in the field (data-ks-st, see lib/v2/text-styles.ts),
 *  - the site's theme colours (span style="color:var(--token)"),
 *  - links, and for richtext fields paragraphs, H2/H3, lists and quotes.
 * No free fonts, sizes or colours: those belong to the design (Archie changes them).
 * The bar also has Remove, which takes the whole field off the page (undo in the editor).
 */
import { DOMParser as PMDOMParser, DOMSerializer, Fragment, Schema, type MarkSpec, type MarkType, type Node as PMNode, type NodeSpec, type NodeType } from '@tiptap/pm/model';
import { EditorState, Plugin, TextSelection, type Command, type Transaction } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { keymap } from '@tiptap/pm/keymap';
import { history, redo, undo } from '@tiptap/pm/history';
import { baseKeymap, chainCommands, splitBlock } from '@tiptap/pm/commands';

export interface TextStyle { t: string; c: string; l: string }
export interface ThemeColor { name: string; label: string }
export interface EditOptions {
  rich: boolean;
  styles: TextStyle[];
  colors: ThemeColor[];
  allowLinks: boolean;
  /** Where the owner clicked, to put the caret there. */
  point?: { x: number; y: number } | null;
  /** Remove the whole field (a richtext field goes as one block); the caller ends editing. */
  onRemove?: () => void;
}
export interface TextEditHandle {
  html(): string;
  changed(): boolean;
  destroy(): void;
  toolbar: HTMLElement;
}

const STYLE_TAGS = ['span', 'mark', 'em', 'strong', 'b', 'i', 'u', 's', 'small'];
const PLAIN_MARKS = ['strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sup', 'sub'];

// ── Schema ──────────────────────────────────────────────────────────────────

function buildSchema(opts: EditOptions): Schema {
  const allowed = new Set(opts.styles.map((s) => `${s.t}|${s.c}`));
  const marks: Record<string, MarkSpec> = {
    link: {
      attrs: { href: { default: '' }, target: { default: null } },
      inclusive: false,
      parseDOM: [{ tag: 'a[href]', getAttrs: (dom) => ({ href: (dom as HTMLElement).getAttribute('href'), target: (dom as HTMLElement).getAttribute('target') }) }],
      toDOM: (m) => ['a', m.attrs.target === '_blank' ? { href: m.attrs.href, target: '_blank', rel: 'noopener noreferrer' } : { href: m.attrs.href }, 0],
    },
    // The designer's accent styles. One at a time on a piece of text (applying another replaces it).
    style: {
      attrs: { t: { default: 'span' }, c: { default: '' } },
      parseDOM: STYLE_TAGS.map((t) => ({
        tag: t,
        priority: 60,
        getAttrs: (dom: HTMLElement | string) => {
          const c = ((dom as HTMLElement).getAttribute('class') || '').trim().replace(/\s+/g, ' ');
          return allowed.has(`${t}|${c}`) ? { t, c } : false;
        },
      })),
      toDOM: (m) => [m.attrs.t, m.attrs.c ? { class: m.attrs.c } : {}, 0],
    },
    color: {
      attrs: { name: { default: '' } },
      parseDOM: [{
        style: 'color',
        getAttrs: (value: HTMLElement | string) => {
          const m = /^var\(--([a-z0-9-]+)\)$/i.exec(String(value).trim());
          return m ? { name: m[1] } : false;
        },
      }],
      toDOM: (m) => ['span', { style: `color:var(--${m.attrs.name})` }, 0],
    },
  };
  // Plain formatting keeps the exact tag the designer used (<b> stays <b>).
  for (const t of PLAIN_MARKS) marks[t] = { parseDOM: [{ tag: t }], toDOM: () => [t, 0] };

  const nodes: Record<string, NodeSpec> = opts.rich
    ? {
      doc: { content: 'block+' },
      paragraph: { content: 'inline*', group: 'block', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
      heading: {
        attrs: { level: { default: 2 } },
        content: 'inline*',
        group: 'block',
        defining: true,
        parseDOM: [
          { tag: 'h1', attrs: { level: 2 } }, { tag: 'h2', attrs: { level: 2 } }, { tag: 'h3', attrs: { level: 3 } },
          { tag: 'h4', attrs: { level: 4 } }, { tag: 'h5', attrs: { level: 4 } }, { tag: 'h6', attrs: { level: 4 } },
        ],
        toDOM: (n) => [`h${n.attrs.level}`, 0],
      },
      blockquote: { content: 'paragraph+', group: 'block', defining: true, parseDOM: [{ tag: 'blockquote' }], toDOM: () => ['blockquote', 0] },
      bullet_list: { content: 'list_item+', group: 'block', parseDOM: [{ tag: 'ul' }], toDOM: () => ['ul', 0] },
      ordered_list: { content: 'list_item+', group: 'block', parseDOM: [{ tag: 'ol' }], toDOM: () => ['ol', 0] },
      // List items hold text directly (<li>text</li>), like the sanitizer stores them.
      list_item: { content: 'inline*', defining: true, parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
      text: { group: 'inline' },
      hard_break: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
    }
    : {
      // A headline, label or button: the element itself is the one line of text.
      doc: { content: 'inline*' },
      text: { group: 'inline' },
      hard_break: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
    };
  return new Schema({ nodes, marks });
}

// ── Commands ────────────────────────────────────────────────────────────────

function rangeHas(state: EditorState, type: MarkType, attrs?: Record<string, unknown>): boolean {
  const { from, to, empty, $from } = state.selection;
  const matches = (marks: readonly { type: MarkType; attrs: Record<string, unknown> }[]) => marks.some((m) => m.type === type && (!attrs || Object.keys(attrs).every((k) => m.attrs[k] === attrs[k])));
  if (empty) return matches(state.storedMarks || $from.marks());
  let all = true;
  let any = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return;
    any = true;
    if (!matches(node.marks)) all = false;
  });
  return any && all;
}

/** Toggle formatting that can be spelled several ways (bold = <strong> or <b>). */
function toggleFormat(types: MarkType[], add: MarkType, attrs?: Record<string, unknown>): Command {
  return (state, dispatch) => {
    const active = types.some((t) => rangeHas(state, t, t === add ? attrs : undefined));
    if (!dispatch) return true;
    const { from, to, empty } = state.selection;
    const tr = state.tr;
    if (empty) {
      let marks = state.storedMarks || state.selection.$from.marks();
      for (const t of types) marks = t.removeFromSet(marks);
      if (!active) marks = add.create(attrs).addToSet(marks);
      dispatch(tr.setStoredMarks(marks));
      return true;
    }
    for (const t of types) tr.removeMark(from, to, t);
    if (!active) tr.addMark(from, to, add.create(attrs));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

function setMark(type: MarkType, attrs: Record<string, unknown> | null): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const { from, to, empty } = state.selection;
    if (empty) {
      let marks = type.removeFromSet(state.storedMarks || state.selection.$from.marks());
      if (attrs) marks = type.create(attrs).addToSet(marks);
      dispatch(state.tr.setStoredMarks(marks));
      return true;
    }
    const tr = state.tr.removeMark(from, to, type);
    if (attrs) tr.addMark(from, to, type.create(attrs));
    dispatch(tr);
    return true;
  };
}

const clearFormatting: Command = (state, dispatch) => {
  if (dispatch) {
    const { from, to, empty } = state.selection;
    dispatch(empty ? state.tr.setStoredMarks([]) : state.tr.removeMark(from, to));
  }
  return true;
};

const hardBreak: Command = (state, dispatch) => {
  const br = state.schema.nodes.hard_break;
  if (dispatch) dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
  return true;
};

/** Top-level blocks the selection touches (rich fields). */
function topBlocks(state: EditorState) {
  const { $from, $to, empty } = state.selection;
  const last = state.doc.childCount - 1;
  const start = Math.min(last, $from.index(0));
  let end = Math.min(last, $to.index(0));
  // A drag that ends right at the start of the next block doesn't include it.
  if (!empty && end > start && $to.depth >= 1 && $to.pos === $to.start($to.depth)) end--;
  let fromPos = 0;
  let toPos = 0;
  const blocks: PMNode[] = [];
  state.doc.forEach((node, offset, index) => {
    if (index === start) fromPos = offset;
    if (index >= start && index <= end) { blocks.push(node); toPos = offset + node.nodeSize; }
  });
  return { blocks, fromPos, toPos };
}

const inlineOf = (blocks: PMNode[]): Fragment[] => blocks.flatMap((b) => {
  if (b.isTextblock) return [b.content];
  const out: Fragment[] = [];
  b.forEach((child) => { out.push(child.content); });
  return out;
});

/** Replace the selected blocks; keep the caret near where it was. */
function replaceBlocks(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, nodes: PMNode[]): boolean {
  const { fromPos, toPos } = topBlocks(state);
  if (!dispatch) return true;
  const tr = state.tr.replaceWith(fromPos, toPos, nodes);
  const end = fromPos + nodes.reduce((n, node) => n + node.nodeSize, 0);
  tr.setSelection(TextSelection.between(tr.doc.resolve(Math.min(fromPos + 1, tr.doc.content.size)), tr.doc.resolve(Math.max(fromPos + 1, end - 1))));
  dispatch(tr.scrollIntoView());
  return true;
}

function setTextBlock(type: NodeType, attrs?: Record<string, unknown>): Command {
  return (state, dispatch) => replaceBlocks(state, dispatch, inlineOf(topBlocks(state).blocks).map((c) => type.create(attrs, c)));
}

function toggleWrap(type: NodeType): Command {
  return (state, dispatch) => {
    const { blocks } = topBlocks(state);
    const s = state.schema;
    const inline = inlineOf(blocks);
    if (blocks.every((b) => b.type === type)) return replaceBlocks(state, dispatch, inline.map((c) => s.nodes.paragraph.create(null, c)));
    const child = type === s.nodes.blockquote ? s.nodes.paragraph : s.nodes.list_item;
    return replaceBlocks(state, dispatch, [type.create(null, inline.map((c) => child.create(null, c)))]);
  };
}

/** Enter on an empty list item / quote line leaves the list or quote. */
const exitEmptyContainer: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.depth < 2 || $from.parent.content.size) return false;
  const depth = $from.depth - 1;
  const container = $from.node(depth);
  const index = $from.index(depth);
  const before: PMNode[] = [];
  const after: PMNode[] = [];
  container.forEach((child, _offset, i) => { if (i < index) before.push(child); else if (i > index) after.push(child); });
  const s = state.schema;
  const nodes = [
    ...(before.length ? [container.type.create(container.attrs, before)] : []),
    s.nodes.paragraph.create(),
    ...(after.length ? [container.type.create(container.attrs, after)] : []),
  ];
  if (dispatch) {
    const start = $from.before(depth);
    const tr = state.tr.replaceWith(start, $from.after(depth), nodes);
    const caret = start + (before.length ? nodes[0].nodeSize : 0) + 1;
    tr.setSelection(TextSelection.create(tr.doc, caret));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

// ── Toolbar ─────────────────────────────────────────────────────────────────

const ICONS: Record<string, string> = {
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  clear: '<path d="M4 7V4h16v3"/><path d="M5 20h6"/><path d="M13 4 8 20"/><path d="m15 15 5 5"/><path d="m20 15-5 5"/>',
  ul: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  ol: '<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
};
const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const CSS = `
.ProseMirror{outline:none;word-wrap:break-word;font-variant-ligatures:none}
.ProseMirror-hideselection *::selection{background:transparent}
.ProseMirror-hideselection{caret-color:transparent}
img.ProseMirror-separator{display:inline!important;border:none!important;margin:0!important}
#ks-text-bar{position:fixed;z-index:2147483647;display:flex;flex-wrap:wrap;align-items:center;gap:2px;max-width:min(640px,calc(100vw - 16px));padding:4px;background:#fff;color:#0f172a;border-radius:10px;box-shadow:0 8px 28px rgba(15,23,42,.22),0 0 0 1px rgba(15,23,42,.08);font:600 12px/1 system-ui,-apple-system,sans-serif}
#ks-text-bar button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:28px;height:28px;padding:0 7px;border-radius:6px;cursor:pointer;color:#334155;white-space:nowrap}
#ks-text-bar button:hover{background:#f1f5f9;color:#0f172a}
#ks-text-bar button[aria-pressed="true"]{background:#dbeafe;color:#1d4ed8;box-shadow:inset 0 0 0 1px #93c5fd}
#ks-text-bar svg{width:15px;height:15px;flex:none}
#ks-text-bar .ks-sep{width:1px;align-self:stretch;margin:4px 3px;background:#e2e8f0}
#ks-text-bar .ks-chip{max-width:110px;overflow:hidden;text-overflow:ellipsis;padding:3px 6px;border-radius:4px;font-size:13px;line-height:1.15}
#ks-text-bar .ks-fmt{font:inherit;font-size:14px;line-height:1}
#ks-text-bar .ks-row{display:none;width:100%;align-items:center;gap:4px;padding:4px 2px 2px}
#ks-text-bar .ks-row.ks-open{display:flex}
#ks-text-bar .ks-row input{all:unset;box-sizing:border-box;flex:1;min-width:160px;height:28px;padding:0 8px;border:1px solid #cbd5e1;border-radius:6px;font:500 13px system-ui,sans-serif;color:#0f172a;background:#fff}
#ks-text-bar .ks-row input:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.2)}
#ks-text-bar .ks-row .ks-primary{background:#2563eb;color:#fff}
#ks-text-bar .ks-row .ks-primary:hover{background:#1d4ed8;color:#fff}
#ks-text-bar .ks-swatch{width:22px;height:22px;min-width:22px;padding:0;border-radius:999px;box-shadow:inset 0 0 0 1px rgba(15,23,42,.15)}
#ks-text-bar .ks-swatch[aria-pressed="true"]{box-shadow:0 0 0 2px #fff,0 0 0 4px #2563eb}
#ks-text-bar .ks-danger{color:#b91c1c}
#ks-text-bar .ks-danger:hover{background:#fef2f2;color:#991b1b}
#ks-text-bar .ks-hint{color:#64748b;font-weight:500;padding:0 4px}
`;

/** How a style looks inside this field: probe it before ProseMirror takes over. */
function probe(el: HTMLElement, tag: string, cls: string): Partial<CSSStyleDeclaration> {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  node.textContent = 'Aa';
  el.appendChild(node);
  const cs = getComputedStyle(node);
  const out = {
    color: cs.color, fontFamily: cs.fontFamily, fontStyle: cs.fontStyle, fontWeight: cs.fontWeight,
    textDecorationLine: cs.textDecorationLine, textTransform: cs.textTransform, letterSpacing: cs.letterSpacing,
    backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage,
    // Gradient text needs these to show at all.
    webkitBackgroundClip: (cs as unknown as Record<string, string>).webkitBackgroundClip,
    webkitTextFillColor: (cs as unknown as Record<string, string>).webkitTextFillColor,
  } as Partial<CSSStyleDeclaration>;
  node.remove();
  return out;
}

function luminance(color: string): number {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(color);
  if (!m) return 0;
  return (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255;
}

/** The colour the field's text sits on, so style previews look like they will on the page. */
function backdropOf(el: HTMLElement, textColor: string): string {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') break; // text over a photo/gradient
    const bg = cs.backgroundColor;
    if (bg && !/rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(bg)) return bg;
  }
  return luminance(textColor) > 0.6 ? '#1e293b' : '#ffffff';
}

function applyLook(node: HTMLElement, look: Partial<CSSStyleDeclaration>, backdrop: string) {
  Object.assign(node.style, look);
  if (!look.backgroundColor || /rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(look.backgroundColor)) node.style.backgroundColor = backdrop;
  if (look.backgroundImage && look.backgroundImage !== 'none' && look.webkitBackgroundClip !== 'text') node.style.backgroundImage = look.backgroundImage;
}

// ── Edit ────────────────────────────────────────────────────────────────────

let cssAdded = false;

export function edit(el: HTMLElement, opts: EditOptions): TextEditHandle {
  if (!cssAdded) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    cssAdded = true;
  }
  const schema = buildSchema(opts);
  const m = schema.marks;
  const n = schema.nodes;

  // Previews, measured in the field before ProseMirror re-renders it.
  const base = getComputedStyle(el);
  const backdrop = backdropOf(el, base.color);
  const looks = opts.styles.map((s) => probe(el, s.t, s.c));
  const emLook = probe(el, 'em', '');
  const strongLook = probe(el, 'strong', '');

  const savedAttrs = Array.from(el.attributes).map((a) => [a.name, a.value] as const);
  const serializer = DOMSerializer.fromSchema(schema);
  const toHtml = (doc: PMNode) => {
    const box = document.createElement('div');
    box.appendChild(serializer.serializeFragment(doc.content));
    return box.innerHTML;
  };

  const doc = PMDOMParser.fromSchema(schema).parse(el);
  const baseline = toHtml(doc);

  // ── Toolbar markup ──
  const bar = document.createElement('div');
  bar.id = 'ks-text-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Text formatting');
  const parts: string[] = [];
  const b = (cmd: string, title: string, inner: string, extra = '') => `<button type="button" data-cmd="${cmd}" title="${esc(title)}" aria-label="${esc(title)}" ${extra}>${inner}</button>`;
  parts.push(b('bold', 'Bold (Ctrl+B)', '<span class="ks-fmt" data-look="strong">B</span>'));
  parts.push(b('italic', 'Italic (Ctrl+I)', '<span class="ks-fmt" data-look="em">I</span>'));
  parts.push(b('underline', 'Underline (Ctrl+U)', '<span class="ks-fmt" style="text-decoration:underline">U</span>'));
  if (opts.styles.length) {
    parts.push('<span class="ks-sep"></span>');
    opts.styles.forEach((s, i) => parts.push(b(`style:${i}`, `${s.l} — a style from your site's design`, `<span class="ks-chip" data-look="s${i}">${esc(s.l)}</span>`)));
  }
  const colors = opts.colors.filter((c) => !/(^|-)(bg|background|surface|border|line|shadow|overlay|backdrop)(-|$)/i.test(c.name)).slice(0, 10);
  if (colors.length) parts.push('<span class="ks-sep"></span>' + b('colors', 'Text colour', icon('palette')));
  if (opts.allowLinks) parts.push(b('link', 'Link', icon('link')));
  parts.push(b('clear', 'Clear formatting', icon('clear')));
  if (opts.rich) {
    parts.push('<span class="ks-sep"></span>');
    parts.push(b('p', 'Paragraph', '<span class="ks-fmt">¶</span>'));
    parts.push(b('h2', 'Heading', '<span class="ks-fmt">H2</span>'));
    parts.push(b('h3', 'Small heading', '<span class="ks-fmt">H3</span>'));
    parts.push(b('ul', 'Bulleted list', icon('ul')));
    parts.push(b('ol', 'Numbered list', icon('ol')));
    parts.push(b('quote', 'Quote', icon('quote')));
  }
  if (opts.onRemove) parts.push('<span class="ks-sep"></span>' + b('remove', opts.rich ? 'Remove this text block from your site' : 'Remove this text from your site', `${icon('trash')}<span>Remove</span>`, 'class="ks-danger"'));
  bar.innerHTML = parts.join('')
    + (colors.length ? `<div class="ks-row" data-row="colors"><span class="ks-hint">Colour</span>${colors.map((c, i) => `<button type="button" class="ks-swatch" data-cmd="color:${i}" title="${esc(c.label)}" aria-label="${esc(c.label)}" style="background:var(--${esc(c.name)})"></button>`).join('')}<button type="button" data-cmd="color:none">Default</button></div>` : '')
    + (opts.allowLinks ? '<div class="ks-row" data-row="link"><input type="text" inputmode="url" placeholder="Paste a link, or /page" aria-label="Link address"><button type="button" class="ks-primary" data-cmd="link:apply">Apply</button><button type="button" data-cmd="link:remove">Remove</button></div>' : '');
  bar.querySelectorAll<HTMLElement>('[data-look]').forEach((node) => {
    const key = node.getAttribute('data-look')!;
    const look = key === 'em' ? emLook : key === 'strong' ? strongLook : looks[Number(key.slice(1))];
    if (!look) return;
    if (key === 'em' || key === 'strong') {
      // Only the parts of the designer's look that read at button size.
      node.style.fontStyle = look.fontStyle || '';
      node.style.fontWeight = look.fontWeight || '';
      if (look.color && look.color !== base.color) { node.style.color = look.color; node.style.backgroundColor = backdrop; node.style.padding = '2px 4px'; node.style.borderRadius = '3px'; }
      return;
    }
    applyLook(node, look, backdrop);
  });
  document.body.appendChild(bar);
  const linkInput = bar.querySelector<HTMLInputElement>('[data-row="link"] input');

  // ── View ──
  const enterKeys: Record<string, Command> = opts.rich
    ? { Enter: chainCommands(exitEmptyContainer, splitBlock), 'Shift-Enter': hardBreak }
    : { Enter: () => true, 'Shift-Enter': hardBreak };
  const state = EditorState.create({
    doc,
    plugins: [
      history(),
      keymap({
        'Mod-z': undo, 'Shift-Mod-z': redo, 'Mod-y': redo,
        'Mod-b': toggleFormat([m.strong, m.b], m.strong),
        'Mod-i': toggleFormat([m.em, m.i], m.em),
        'Mod-u': toggleFormat([m.u], m.u),
        ...enterKeys,
      }),
      keymap(baseKeymap),
      new Plugin({ view: () => ({ update: (v) => sync(v.state) }) }),
    ],
  });
  const ws = base.whiteSpace === 'normal' ? 'white-space:pre-wrap' : '';
  const view = new EditorView({ mount: el }, {
    state,
    attributes: { spellcheck: 'true', ...(ws ? { style: ws } : {}) },
    // Pasted text keeps only formatting this field supports (the schema drops the rest).
    transformPastedHTML: (html) => html.replace(/<(meta|style|script)[^>]*>[\s\S]*?<\/\1>/gi, ''),
  });

  // Caret where the owner clicked, else at the end.
  let sel = TextSelection.atEnd(view.state.doc);
  if (opts.point) {
    const at = view.posAtCoords({ left: opts.point.x, top: opts.point.y });
    if (at) sel = TextSelection.near(view.state.doc.resolve(at.pos));
  }
  view.dispatch(view.state.tr.setSelection(sel));
  view.focus();

  // ── Toolbar behaviour ──
  const run = (cmd: Command) => { cmd(view.state, view.dispatch); view.focus(); };
  const openRow = (name: string | null) => {
    bar.querySelectorAll('.ks-row').forEach((r) => r.classList.toggle('ks-open', r.getAttribute('data-row') === name));
    place();
  };
  const currentLink = () => {
    const { $from, from, to, empty } = view.state.selection;
    const marks = empty ? $from.marks() : (() => { let found: readonly { type: MarkType; attrs: Record<string, unknown> }[] = []; view.state.doc.nodesBetween(from, to, (node) => { if (node.isText && !found.length) found = node.marks; }); return found; })();
    return marks.find((mk) => mk.type === m.link)?.attrs.href as string | undefined;
  };
  const applyLink = () => {
    const href = (linkInput?.value || '').trim();
    if (!href) { run(setMark(m.link, null)); openRow(null); return; }
    const safe = /^(https?:|mailto:|tel:|\/|#)/i.test(href) ? href : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(href) ? `https://${href}` : /^[a-z][a-z0-9+.-]*:/i.test(href) ? '' : `/${href.replace(/^\.?\/*/, '')}`;
    if (!safe) { linkInput?.focus(); return; }
    const external = /^https?:/i.test(safe);
    if (view.state.selection.empty) {
      // No words picked: insert the address itself as the link text.
      view.dispatch(view.state.tr.replaceSelectionWith(schema.text(href, [m.link.create({ href: safe, target: external ? '_blank' : null })]), false));
      view.focus();
    } else run(setMark(m.link, { href: safe, target: external ? '_blank' : null }));
    openRow(null);
  };

  // Keep focus in the text while clicking buttons (the link box takes focus on purpose).
  bar.addEventListener('mousedown', (e) => { if (!(e.target as HTMLElement).closest('input')) e.preventDefault(); });
  bar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('button[data-cmd]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const cmd = btn.getAttribute('data-cmd')!;
    if (cmd === 'remove') { opts.onRemove?.(); return; }
    if (cmd === 'bold') run(toggleFormat([m.strong, m.b], m.strong));
    else if (cmd === 'italic') run(toggleFormat([m.em, m.i], m.em));
    else if (cmd === 'underline') run(toggleFormat([m.u], m.u));
    else if (cmd.startsWith('style:')) {
      const s = opts.styles[Number(cmd.slice(6))];
      if (s) run(toggleFormat([m.style], m.style, { t: s.t, c: s.c }));
    } else if (cmd === 'colors') openRow(bar.querySelector('[data-row="colors"].ks-open') ? null : 'colors');
    else if (cmd.startsWith('color:')) {
      const c = cmd === 'color:none' ? null : colors[Number(cmd.slice(6))];
      run(setMark(m.color, c ? { name: c.name } : null));
      openRow(null);
    } else if (cmd === 'link') {
      if (bar.querySelector('[data-row="link"].ks-open')) { openRow(null); view.focus(); return; }
      if (linkInput) linkInput.value = currentLink() || '';
      openRow('link');
      linkInput?.focus();
      linkInput?.select();
    } else if (cmd === 'link:apply') applyLink();
    else if (cmd === 'link:remove') { run(setMark(m.link, null)); openRow(null); }
    else if (cmd === 'clear') run(clearFormatting);
    else if (cmd === 'p') run(setTextBlock(n.paragraph));
    else if (cmd === 'h2') run(setTextBlock(n.heading, { level: 2 }));
    else if (cmd === 'h3') run(setTextBlock(n.heading, { level: 3 }));
    else if (cmd === 'ul') run(toggleWrap(n.bullet_list));
    else if (cmd === 'ol') run(toggleWrap(n.ordered_list));
    else if (cmd === 'quote') run(toggleWrap(n.blockquote));
  });
  linkInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); applyLink(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); openRow(null); view.focus(); }
  });

  function pressed(cmd: string, on: boolean) {
    bar.querySelectorAll(`[data-cmd="${cmd}"]`).forEach((x) => x.setAttribute('aria-pressed', on ? 'true' : 'false'));
  }
  function sync(st: EditorState) {
    pressed('bold', rangeHas(st, m.strong) || rangeHas(st, m.b));
    pressed('italic', rangeHas(st, m.em) || rangeHas(st, m.i));
    pressed('underline', rangeHas(st, m.u));
    opts.styles.forEach((s, i) => pressed(`style:${i}`, rangeHas(st, m.style, { t: s.t, c: s.c })));
    colors.forEach((c, i) => pressed(`color:${i}`, rangeHas(st, m.color, { name: c.name })));
    pressed('link', rangeHas(st, m.link));
    if (opts.rich) {
      const { $from } = st.selection;
      const block = $from.depth >= 1 ? $from.node(1) : null;
      pressed('p', block?.type === n.paragraph);
      pressed('h2', block?.type === n.heading && block.attrs.level === 2);
      pressed('h3', block?.type === n.heading && block.attrs.level === 3);
      pressed('ul', block?.type === n.bullet_list);
      pressed('ol', block?.type === n.ordered_list);
      pressed('quote', block?.type === n.blockquote);
    }
    place();
  }

  function place() {
    const r = el.getBoundingClientRect();
    const h = bar.offsetHeight;
    const w = bar.offsetWidth;
    let top = r.top - h - 10;
    if (top < 6) top = Math.min(window.innerHeight - h - 6, r.bottom + 10);
    bar.style.top = `${Math.max(6, top)}px`;
    bar.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, r.left))}px`;
  }
  const onMove = () => place();
  window.addEventListener('scroll', onMove, { passive: true });
  window.addEventListener('resize', onMove, { passive: true });
  sync(view.state);

  return {
    toolbar: bar,
    html: () => toHtml(view.state.doc),
    changed: () => toHtml(view.state.doc) !== baseline,
    destroy: () => {
      window.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
      view.destroy();
      bar.remove();
      // Put the element's own attributes back exactly (ProseMirror adds class/contenteditable/translate).
      Array.from(el.attributes).forEach((a) => el.removeAttribute(a.name));
      savedAttrs.forEach(([k, v]) => el.setAttribute(k, v));
    },
  };
}

declare global {
  interface Window { KsText?: { edit: typeof edit } }
}
window.KsText = { edit };
