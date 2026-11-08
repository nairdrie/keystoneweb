/**
 * The authoring contract for agents building Keystone sites, served by the
 * MCP `get_guide` tool. Update this (and the validator) as the platform and
 * agents improve — not the editor.
 */
import { GLOBAL_BINDINGS, SCRIPT_HOST_ALLOWLIST, BUDGETS } from './policy';

export const GUIDE_TOPICS = ['overview', 'sections', 'theme', 'content', 'business', 'forms', 'scripts', 'quality', 'workflow', 'example'] as const;
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

**Required on every site: a small "Powered by Keystone" link.** Put an empty \`<p data-ks-attribution></p>\` (or
\`<span>\`) in your footer; Keystone fills in the text and the link to keystoneweb.ca. Style it to fit your design
(\`[data-ks-attribution]\` and \`[data-ks-attribution] a\` in the footer CSS: font, colour, alignment, spacing), but keep
it visible and legible. Never hide, cover, shrink or remove it, from CSS or JS. If the footer has no slot, Keystone
adds a plain line below it; if it is hidden, Keystone puts a plain one back.

Call get_guide with topic = sections | theme | content | business | forms | scripts | quality | workflow | example.`;

const sections = `# Sections (annotated HTML)

A section is plain HTML. Mark what the owner can edit with data attributes. The text, images and links you
write become the defaults; the owner's edits are stored separately and survive your redesigns as long as
the field ids stay the same — so keep ids stable when you iterate.

| Attribute | Meaning |
|---|---|
| \`data-ks="id"\` | Editable field. Type is inferred: \`<img>\` → image, \`<a>\` → link (label + URL), anything else → text (inline formatting kept: em, strong, b, i, u, mark, small and span, each with an optional class, plus br). |
| \`data-ks-type="richtext"\` | Multi-paragraph text (p, h2–h4, lists, blockquote). Put it on a wrapper \`<div>\`. |
| \`data-ks-type="bg"\` | Background image on any element (set \`style="background-image:url(...)"\`). Its children can hold other fields. |
| \`data-ks-list="id"\` + \`data-ks-item\` | Repeatable items. Every direct child marked \`data-ks-item\` is one item; they must share the same fields. The owner can add, remove, duplicate and reorder. Field ids inside an item are scoped to the item. |
| \`data-ks-static\` | Purely decorative subtree (ornamental numbers, marquee words, decorative images). Not editable. Use sparingly. |
| \`data-ks-nav\` | A container whose links are generated from the site's pages (in nav order). Put one example link inside, e.g. \`<ul data-ks-nav><li><a href="/">Home</a></li></ul>\`. The current page gets \`aria-current="page"\`. |
| \`data-ks-attribution\` | Required, once, in the footer: the "Powered by Keystone" link. Leave it empty; Keystone writes the text and link. Style it, don't hide it. |
| \`data-ks="@business.phone"\` | Site-wide values the owner sets once: ${GLOBAL_BINDINGS.join(', ')}. On an \`<a>\`, phone/email also set tel:/mailto: hrefs; \`@site.logo\` goes on an \`<img>\`. |

Owners can remove any editable field, list or section. Removed fields are stored as \`hidden: true\`.

Accents inside text (a highlighted word, a script-font phrase, a gradient keyword): wrap the words in an inline
element with a class and style the class in your CSS, e.g. \`<h1 data-ks="title">Roofs that <em class="accent">last</em></h1>\`.
Owners edit text with a formatting bar, and every class you use inside a field becomes a style they can put on
other words in that field, so your accents survive their edits and they stay on-brand. Inline \`style=""\` inside
text is removed, so don't rely on it. Owners can also colour words with your theme's colour tokens, and add bold,
italic, underline and links; fonts and sizes stay yours.

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

Lists are about labelling, not looks. When you repeat one structure and the owner might want more or fewer of
it (stats, badges, steps, cards, logos, team members), make it a \`data-ks-list\` instead of numbered ids like
\`stat1\`, \`stat2\`. Design it however you like; just mark the container and its items. Skip it when the exact
count is part of the design (cap it with \`data-ks-max-items\` if only a few fit). Owners can reorder, add,
duplicate and hide sections, so each section should look right on its own, whatever is above or below it.

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

Header and footer are sections too: create them with put_section, then set_layout({ header, footer }).

Set \`platform: { primary, secondary, accent }\` to the token names Keystone's own pages (cart, checkout, booking,
product pages) should use for their colours, so they match your design.`;

const content = `# Content

- put_page creates or replaces a page's section list: \`sections: [{ section: "hero", id?: "home-hero", content?: { title: "…" } }]\`.
  Give instances readable ids you can refer to later; content set here is stored as agent content.
- set_content changes fields on existing instances: \`[{ instance: "home-hero", path: "title", value: "New headline" }]\`.
  Paths reach into lists: \`items.2.name\`. Header/footer instances are \`header\` and \`footer\`.
- Value shapes (shorthand strings are accepted):
  text/richtext → "<em>html</em>" or { html } · image → "https://…" or { src, alt } · bg → "https://…" or { src }
  link → "/contact" or { href, label, newTab } · list → [ { fieldId: value, … }, … ]
  Any field value may include hidden: true (removed from the page; on a bg field only the image goes) or hidden: false.
  A field the owner removed counts as an owner edit: don't bring it back unless the human asks (then set hidden: false,
  with force: true). If a removal leaves an empty card or a gap, fix the layout when asked.
- Fields the owner already edited are skipped (status "skipped_owner_edit"). Only pass force: true if the human asked for it.
- Write real, specific copy for the business (from research_business / the brief). Never lorem ipsum, never "Service 1".
- Images: use import_media for every image (stock or the business's own photos) — hotlinked images are flagged.
  search_stock_media finds photos.
- Concurrency: the owner may be editing while you work. get_site returns versions (theme.version, sections[].version,
  pages[].layoutVersion) and get_content returns each field's rev. Pass them back as expected_version / expected_rev
  and the write is rejected (status "conflict" / error reason "stale") if someone changed it since — re-read and retry.
  Without them your write still never clobbers a concurrent one, but it won't tell you the page moved on.`;

const business = `# Business features (store, booking, blog, reviews)

Keystone runs the business logic; you design how it looks. Everything below works inside your own markup.

## Products and services — live data in your design
\`\`\`html
<div class="grid" data-ks-collection="products" data-ks-limit="6" data-ks-filter="featured">
  <article class="card" data-ks-item>
    <img data-ks-bind="image" src="https://…/sample.jpg" alt="">
    <h3 data-ks-bind="name">Sample product</h3>
    <p><s data-ks-if="on_sale" data-ks-bind="compare_price">$60</s> <span data-ks-bind="price">$49</span></p>
    <a data-ks-bind="url" href="/product/x">Details</a>
    <button data-ks-action="add-to-cart">Add to cart</button>
  </article>
  <p data-ks-empty data-ks="emptyText">New products are coming soon.</p>
</div>
\`\`\`
- \`data-ks-collection\`: products | services. The first \`data-ks-item\` child is the template; your sample text in it is
  only shown in drafts until real records exist. Real records are filled in at request time — new products appear
  without republishing.
- Options: \`data-ks-limit="6"\`, \`data-ks-filter="featured"\` (or on_sale, in_stock, "!field" to negate),
  \`data-ks-category="Roofing supplies"\`, \`data-ks-ids="id1,id2"\` (fixed picks, in order).
- Bindings: \`data-ks-bind="field"\` (img → src, a → href for url, else text), \`data-ks-bind-bg="image"\`
  (background image), \`data-ks-if="field"\` / \`data-ks-if="!field"\` (keep only when set / unset).
  get_business_data lists every field. Don't put data-ks inside items.
- \`data-ks-empty\`: shown when there are no records (bind its text with data-ks like any copy).

## Actions
- \`data-ks-action="add-to-cart"\` inside a products item: adds it (products needing a size/option go to their
  product page instead) and shows a small "Added" toast you can restyle via \`.ks-toast\` / \`--ks-toast-bg\`.
- \`data-ks-action="open-cart"\` → the cart & checkout. \`<span data-ks-cart-count>0</span>\` anywhere shows the live
  count; \`<html data-ks-cart="empty|filled">\` lets CSS hide an empty cart badge.
- \`data-ks-action="book"\` → booking; inside a services item it pre-selects that service. Plain links work too:
  \`/book\`, \`/book?service=<id>\`, \`/cart\`, \`/product/<id>\` (the url field).

## Keystone-hosted pages
/cart (cart + checkout with the owner's payment, shipping, tax and coupon settings), /book (booking with the
owner's hours, add-ons and payments), /product/<id> (gallery, variants, options) and /order-confirmation are run by
Keystone, wrapped in YOUR header and footer and coloured with the tokens you set in \`platform\`.
Agent JS can use \`ks.cart.count()\`, \`ks.cart.items()\`, \`ks.cart.add({productId,name,price_cents,currency,image})\`
and listen for \`document.addEventListener('ks:cart', …)\`.

## Blog posts — the owner writes, you design
Posts are the owner's: they write and edit them in Admin → Blog (title, text, cover image, author, tags,
publish/featured). You decide how they look — grids, lists, magazine layouts, a featured hero, anything.
Articles live at \`/blog/<slug>\`; new posts appear everywhere without republishing.

**Lists** — anywhere on any page:
\`\`\`html
<div class="stories" data-ks-collection="posts" data-ks-limit="6">
  <a class="story" data-ks-item data-ks-bind="url" href="/blog/sample">
    <img data-ks-if="image" data-ks-bind="image" src="https://…/sample.jpg" alt="">
    <p class="meta"><time data-ks-bind="date">March 3, 2026</time> · <span data-ks-bind="reading_time">4 min read</span></p>
    <h3 data-ks-bind="title">Sample post title</h3>
    <p data-ks-bind="excerpt">A short summary of the article.</p>
  </a>
  <p data-ks-empty data-ks="emptyText">New articles are on the way.</p>
</div>
\`\`\`
Fields: title, excerpt, date, date_iso, image, author, tags, tag, url, reading_time, featured, current, slug, id.
\`<time data-ks-bind="date">\` also gets a machine-readable datetime. Options: \`data-ks-limit\`, \`data-ks-offset="1"\`
(skip the newest, e.g. after a featured hero), \`data-ks-filter="featured"\`, \`data-ks-tag="Press"\`.
Newest first. Make a page that lists them (e.g. slug "blog" or "news") and link to it from the nav.

**The article page** — design it once; it's used for every post. Make a page with
\`put_page { slug: "article", template: "post", sections: [...] }\` (it stays out of the menu and isn't a URL of its own).
Its sections use \`data-ks-collection="post"\` — the article being read — with the same fields plus \`content\`:
\`\`\`html
<article class="post" data-ks-collection="post">
  <div data-ks-item>
    <p class="meta"><span data-ks-bind="tag">Press</span> · <time data-ks-bind="date">March 3, 2026</time></p>
    <h1 data-ks-bind="title">Sample article title</h1>
    <img class="cover" data-ks-if="image" data-ks-bind="image" src="https://…/sample.jpg" alt="">
    <div class="prose" data-ks-bind="content"><p>Sample paragraph.</p><h2>Sample heading</h2><p>More text.</p></div>
    <p class="byline" data-ks-if="author">By <span data-ks-bind="author">Author</span></p>
  </div>
</article>
\`\`\`
- Bind \`content\` on a div/article/section: it's the owner's formatted article (p, h2–h4, lists, quotes, links,
  images, code, tables) — style those elements inside your container (e.g. \`.prose h2\`, \`.prose img\`).
- Add other sections to the article page as you like ("more stories" with \`data-ks-filter="!current"\`, a CTA,
  a newsletter band). The page title, description, social image and BlogPosting structured data come from the post.
- On any other page, \`data-ks-collection="post"\` shows the newest post (e.g. a "latest news" spotlight).
- No article page yet? /blog/<slug> still works with Keystone's plain article layout in your header and footer.

## Reviews and FAQs → Google rich results
Mark owner-editable lists so search engines understand them:
- \`data-ks-list="reviews" data-ks-schema="reviews"\` with item fields \`author\`, \`quote\`, optional \`rating\` (1–5).
- \`data-ks-list="faq" data-ks-schema="faq"\` with item fields \`question\`, \`answer\`.
Seed reviews from research_business (real Google review snippets, quoted accurately with the reviewer's name)
— never invent reviews. Services in a services collection also become structured data automatically.

## Setting up data for a new business
get_business_data shows what exists. upsert_services / upsert_products / upsert_posts add records (import images
first). Moving a business off an old site? Import its articles with upsert_posts, keeping their original
published_at dates, and link to /blog/<slug> — not to the old site's URLs, which stop working once the domain moves.
The owner manages payments, hours, shipping and taxes in Admin; tell them what's left to configure.`;

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
- The footer carries the "Powered by Keystone" slot (\`<p data-ks-attribution></p>\`), styled to match the footer.
Run validate before finishing; fix every error and as many warnings as you can.`;

const workflow = `# Workflow

1. get_site (or create_site for a new business). For a real business, research_business gives verified details,
   reviews, photos and brand colours.
2. update_business_profile (name, phone, email, address, hours, logo) — these feed @business.* bindings and SEO.
3. set_theme (tokens, fonts, global CSS).
4. put_section for header and footer (with the \`<p data-ks-attribution></p>\` "Powered by Keystone" slot) → set_layout.
5. put_section for each home page section → put_page("home", sections + content).
6. screenshot (desktop + mobile) after each section or page: look at the images and fix every listed problem
   (sideways scrolling, invisible text, broken images, JS errors). Repeat per page (about, services, contact…).
   Products, services or a blog/news section? Use live data (topic "business") so the owner can keep them up to date
   in Admin — never hard-code a list of articles or products as static content.
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
  <a class="btn ghost" data-ks="cta2" href="/work">See our work</a>
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

const TOPICS: Record<GuideTopic, string> = { overview, sections, theme, content, business, forms, scripts, quality, workflow, example };

export function getGuide(topic?: string): string {
  if (topic === 'all') return GUIDE_TOPICS.map((t) => TOPICS[t]).join('\n\n---\n\n');
  if (topic && (GUIDE_TOPICS as readonly string[]).includes(topic)) return TOPICS[topic as GuideTopic];
  return `${overview}\n\n---\n\n${workflow}`;
}
