/**
 * The authoring contract for agents building Keystone sites, served by the
 * MCP `get_guide` tool. Update this (and the validator) as the platform and
 * agents improve — not the editor.
 */
import { GLOBAL_BINDINGS, SCRIPT_HOST_ALLOWLIST, BUDGETS } from './policy';

export const GUIDE_TOPICS = ['overview', 'sections', 'theme', 'content', 'forms', 'scripts', 'quality', 'workflow', 'example'] as const;
export type GuideTopic = (typeof GUIDE_TOPICS)[number];

const overview = `# Building a Keystone site

You design the site. The business owner edits the words, images and links later in a click-to-edit
editor, and never sees your code. Keystone hosts it, runs forms and analytics, and keeps every change versioned.

A site has three layers:
- **Design** (yours): theme tokens, global CSS/JS, and *sections* — HTML + CSS + JS templates.
- **Content** (shared): the value of every editable field. You seed it; the owner edits it.
  Once the owner edits a field, you cannot overwrite it unless the human explicitly asked (force: true).
- **Structure**: pages, and the ordered section instances on each page. Header and footer are global sections.

There are no fixed blocks and no style limits: write any HTML/CSS/JS you want, as long as everything a
visitor can read or see is editable by the owner (see "sections").

Call get_guide with topic = sections | theme | content | forms | scripts | quality | workflow | example.`;

const sections = `# Sections (annotated HTML)

A section is plain HTML. Mark what the owner can edit with data attributes. The text, images and links you
write become the defaults; the owner's edits are stored separately and survive your redesigns as long as
the field ids stay the same — so keep ids stable when you iterate.

| Attribute | Meaning |
|---|---|
| \`data-ks="id"\` | Editable field. Type is inferred: \`<img>\` → image, \`<a>\` → link (label + URL), anything else → text (inline formatting kept: em, strong, span.class, br). |
| \`data-ks-type="richtext"\` | Multi-paragraph text (p, h2–h4, lists, blockquote). Put it on a wrapper \`<div>\`. |
| \`data-ks-type="bg"\` | Background image on any element (set \`style="background-image:url(...)"\`). Its children can hold other fields. |
| \`data-ks-list="id"\` + \`data-ks-item\` | Repeatable items. Every direct child marked \`data-ks-item\` is one item; they must share the same fields. The owner can add, remove, duplicate and reorder. Field ids inside an item are scoped to the item. |
| \`data-ks-optional\` | On a field: the owner may hide it. As \`data-ks-optional="id"\` on any other element: a show/hide switch. |
| \`data-ks-static\` | Purely decorative subtree (ornamental numbers, marquee words, decorative images). Not editable. Use sparingly. |
| \`data-ks-nav\` | A container whose links are generated from the site's pages (in nav order). Put one example link inside, e.g. \`<ul data-ks-nav><li><a href="/">Home</a></li></ul>\`. The current page gets \`aria-current="page"\`. |
| \`data-ks="@business.phone"\` | Site-wide values the owner sets once: ${GLOBAL_BINDINGS.join(', ')}. On an \`<a>\`, phone/email also set tel:/mailto: hrefs; \`@site.logo\` goes on an \`<img>\`. |

Hints the editor enforces so owners can't break your layout:
\`data-ks-label="Hero headline"\`, \`data-ks-max="60"\` (characters), \`data-ks-aspect="4/5"\` (image crop),
\`data-ks-min="1"\` / \`data-ks-max-items="6"\` (lists).

Rules (the validator rejects violations):
- Every visible text node and every \`<img>\` must be inside a \`data-ks\` field, a list item field, \`data-ks-nav\`, or \`data-ks-static\`.
  Text inside svg, select/option and textarea is exempt.
- Field ids: letters, numbers, - and _, starting with a letter; unique within the section (or within a list item).
- A text field can't contain other fields. A link whose content is complex (icons, nested fields) becomes
  "URL only" and its children are bound separately.
- No inline event handlers (onclick=…), no \`<script>\` tags in the HTML (use the section JS), no javascript: URLs.
- Internal links are plain paths: \`href="/contact"\`. Link only to pages that exist (create them with put_page).

You may include \`<style>\` and \`<script type="module">\` blocks at the end of the section HTML; they are moved
into the section's CSS and JS. Section CSS is automatically scoped to the section: write plain selectors.
\`:root\`, \`html\`, \`body\` and \`:scope\` inside section CSS mean "this section". @keyframes and @font-face stay global.`;

const theme = `# Theme

set_theme takes:
- **tokens**: CSS custom properties, e.g. \`{ name: "color-brand", value: "#0f766e", type: "color", label: "Brand colour", group: "Colours", editable: true }\`.
  They become \`:root { --color-brand: #0f766e }\`. Use them everywhere in your CSS. Mark the 2–5 that an owner
  should reasonably change (brand colours, heading font, body font) as \`editable: true\` — those appear in the
  owner's Brand panel. Font tokens (type "font", value like \`'Fraunces', serif\`) are loaded from Google Fonts automatically.
- **fonts**: extra Google Font families to load: \`[{ family: "Inter", weights: "400;600" }]\`.
- **global_css**: resets, typography, utilities, shared component classes. Not scoped.
- **global_js**: an ES module \`export default (ks) => { ... }\`, run once per page.

Header and footer are sections too: create them with put_section, then set_layout({ header, footer }).`;

const content = `# Content

- put_page creates or replaces a page's section list: \`sections: [{ section: "hero", id?: "home-hero", content?: { title: "…" } }]\`.
  Give instances readable ids you can refer to later; content set here is stored as agent content.
- set_content changes fields on existing instances: \`[{ instance: "home-hero", path: "title", value: "New headline" }]\`.
  Paths reach into lists: \`items.2.name\`. Header/footer instances are \`header\` and \`footer\`.
- Value shapes (shorthand strings are accepted):
  text/richtext → "<em>html</em>" or { html } · image → "https://…" or { src, alt } · bg → "https://…" or { src }
  link → "/contact" or { href, label, newTab } · list → [ { fieldId: value, … }, … ] · toggle → true (shown) / false (hidden)
  Any field value may include hidden: true to hide an optional field.
- Fields the owner already edited are skipped (status "skipped_owner_edit"). Only pass force: true if the human asked for it.
- Write real, specific copy for the business (from research_business / the brief). Never lorem ipsum, never "Service 1".
- Images: use import_media for every image (stock or the business's own photos) — hotlinked images are flagged.
  search_stock_media finds photos.`;

const forms = `# Forms

\`<form data-ks-form="contact">\` posts to the owner's Keystone inbox. Name inputs \`name\`, \`email\`, \`phone\`, \`message\`;
any other named inputs are included in the message. Add \`<p data-ks-form-success hidden data-ks="thanks">Thanks!…</p>\`
and optionally \`<p data-ks-form-error hidden></p>\`. While sending/after, the form has
\`data-ks-form-state="sending|success|error"\` for styling. A honeypot is added automatically. Labels are text:
bind them (data-ks) like any other copy. Forms are inert in previews.`;

const scripts = `# Scripts

Section JS is an ES module: \`export default (root, ks) => { … }\` where \`root\` is the section's wrapper
(use \`root.querySelector\`; the wrapper is display:contents) and \`ks\` is \`{ mode, siteId, pageId, track(event, data) }\`.
Return a cleanup function if you add global listeners.

- Import libraries only by full URL from: ${SCRIPT_HOST_ALLOWLIST.join(', ')} (e.g. \`import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3/+esm"\`).
  The published site's Content-Security-Policy blocks other script hosts.
- Scripts do NOT run in the owner's editor. Never hide content with CSS waiting for JS: put pre-animation
  states under \`.ks-js\` (added to <html> when scripts run), e.g. \`.ks-js .reveal { opacity: 0 }\`.
- Never generate the readable content from JS (bad for SEO and not editable). Enhance existing markup only.
- No eval/new Function, no cookie or storage access to auth data. Respect prefers-reduced-motion.
- Budgets: section JS ${BUDGETS.sectionJsBytes / 1000}KB, global JS ${BUDGETS.globalJsBytes / 1000}KB, page CSS ${BUDGETS.pageCssBytes / 1000}KB.`;

const quality = `# Quality bar

This is a done-for-you product: the site should look like a top agency built it for this exact business.
- Distinct art direction per business — typography pairing, colour, layout rhythm. Avoid generic template looks.
- Real content: the business's services, area, proof (reviews, years, licences), clear calls to action, phone in the header.
- Mobile first: test the preview at 390px. No horizontal scroll. Tap targets ≥ 44px.
- Accessibility: one <h1> per page, logical heading order, alt text, 4.5:1 text contrast, visible focus, labels on inputs.
- Performance: optimized images via import_media, few fonts, modest JS, no layout shift.
- Robust to edits: the owner will change text length and swap images. Use flexible layouts, \`object-fit: cover\`,
  aspect-ratio boxes, and data-ks-max / data-ks-aspect hints. Don't rely on exact word counts.
- SEO: page titles and descriptions via put_page seo, descriptive link text, real headings.
Run validate before finishing; fix every error and as many warnings as you can.`;

const workflow = `# Workflow

1. get_site (or create_site for a new business). For a real business, research_business gives verified details,
   reviews, photos and brand colours.
2. update_business_profile (name, phone, email, address, hours, logo) — these feed @business.* bindings and SEO.
3. set_theme (tokens, fonts, global CSS).
4. put_section for header and footer → set_layout.
5. put_section for each home page section → put_page("home", sections + content).
6. preview → open the link (desktop and 390px mobile) → refine. Repeat per page (about, services, contact…).
7. validate → fix errors.
8. publish (if your token has sites:publish and the owner has a plan) or request_approval to send the owner the preview.
Every write returns issues and a preview link — read them before the next step.`;

const example = `# Example section

\`\`\`html
<section class="hero" data-ks="bg" data-ks-type="bg" style="background-image:url('https://…/roof.jpg')">
  <p class="eyebrow" data-ks="eyebrow">Oakville · Since 1994</p>
  <h1 data-ks="title" data-ks-max="70">Roofs done <em>right</em>, the first time.</h1>
  <div data-ks="intro" data-ks-type="richtext"><p>Family-owned crews and written warranties.</p></div>
  <a class="btn" data-ks="cta" href="/contact">Get a free quote</a>
  <a class="btn ghost" data-ks="cta2" data-ks-optional href="/work">See our work</a>
  <ul class="badges" data-ks-list="badges" data-ks-max-items="4">
    <li data-ks-item><span data-ks="label">Licensed &amp; insured</span></li>
    <li data-ks-item><span data-ks="label">25-year warranty</span></li>
  </ul>
  <p class="call"><span data-ks="callLabel">Call</span> <a data-ks="@business.phone" href="tel:">(905) 555-0100</a></p>
</section>
<style>
  :scope { --pad: clamp(4rem, 10vw, 9rem); }
  .hero { padding: var(--pad) 1.5rem; background-size: cover; color: white; }
  h1 { font: 800 clamp(2.5rem, 7vw, 6rem)/.95 var(--font-display); max-width: 14ch; }
  .ks-js .eyebrow { opacity: 0; transform: translateY(8px); }
</style>
<script type="module">
export default (root) => {
  const el = root.querySelector('.eyebrow');
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) { el && (el.style.opacity = 1); return; }
  el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 600, fill: 'forwards' });
};
</script>
\`\`\``;

const TOPICS: Record<GuideTopic, string> = { overview, sections, theme, content, forms, scripts, quality, workflow, example };

export function getGuide(topic?: string): string {
  if (topic === 'all') return GUIDE_TOPICS.map((t) => TOPICS[t]).join('\n\n---\n\n');
  if (topic && (GUIDE_TOPICS as readonly string[]).includes(topic)) return TOPICS[topic as GuideTopic];
  return `${overview}\n\n---\n\n${workflow}`;
}
