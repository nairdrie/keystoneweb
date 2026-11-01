/**
 * Behavioural tests for the v2 engine (compiler, renderer, CSS scoping, content ops).
 * Run: npm run test:v2
 */
import assert from 'node:assert/strict';
import { compileSection } from '../lib/v2/compile';
import { renderPage, renderInstance, findPageByPath } from '../lib/v2/render';
import { scopeCss, splitSectionSource } from '../lib/v2/css-scope';
import { applyFieldChange, normalizeFieldValue } from '../lib/v2/content';
import { sampleBundle, SAMPLE_SECTIONS } from './fixtures/v2-sample-site';
import { renderChrome, platformPalette } from '../lib/v2/render';
import { featuresIn } from '../lib/v2/collections';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log('v2 engine');

test('compiles the sample sections without errors', () => {
  for (const [key, html] of Object.entries(SAMPLE_SECTIONS)) {
    const { html: markup } = splitSectionSource(html);
    const compiled = compileSection(markup);
    const errors = compiled.issues.filter((i) => i.level === 'error');
    assert.equal(errors.length, 0, `${key}: ${JSON.stringify(errors, null, 2)}`);
  }
});

test('extracts fields, types, hints and defaults', () => {
  const { html } = splitSectionSource(SAMPLE_SECTIONS.hero);
  const c = compileSection(html);
  const byId = Object.fromEntries(c.fields.map((f) => [f.id, f]));
  assert.equal(byId.bg.type, 'bg');
  assert.equal(byId.title.type, 'text');
  assert.equal(byId.title.max, 70);
  assert.equal(byId.intro.type, 'richtext');
  assert.equal(byId.cta.type, 'link');
  assert.equal(byId.cta2.optional, true);
  assert.equal(byId.badges.type, 'list');
  assert.equal(byId.badges.maxItems, 4);
  assert.deepEqual(byId.badges.item?.map((f) => f.id), ['label']);
  assert.equal((c.defaults.title as { html: string }).html, 'Roofs done <em>right</em>, the first time.'.replace('<em>', '<em>'));
  assert.equal((c.defaults.badges as { items: unknown[] }).items.length, 2);
  assert.deepEqual(c.defaults.bg, { src: 'https://example.com/roof.jpg' });
});

test('flags unbound text, unbound images, handlers and scripts', () => {
  const c = compileSection('<section><h2>Hello</h2><img src="x.jpg"><button onclick="x()" data-ks="b">Go</button><script src="https://evil.example/x.js"></script></section>');
  const rules = c.issues.map((i) => i.rule);
  assert.ok(rules.includes('unbound-text'));
  assert.ok(rules.includes('unbound-image'));
  assert.ok(rules.includes('inline-handler'));
  assert.ok(rules.includes('script-host'));
});

test('flags duplicate ids and inconsistent list items', () => {
  const c = compileSection('<div><p data-ks="a">x</p><p data-ks="a">y</p><ul data-ks-list="l"><li data-ks-item><span data-ks="t">1</span></li><li data-ks-item><b data-ks="u">2</b></li></ul></div>');
  const rules = c.issues.map((i) => i.rule);
  assert.ok(rules.includes('duplicate-field'));
  assert.ok(rules.includes('list-shape'));
});

test('scopes section CSS but leaves keyframes global', () => {
  const { css } = splitSectionSource(SAMPLE_SECTIONS.hero);
  const scoped = scopeCss(css, '[data-ks-section="hero"]').css;
  assert.match(scoped, /\[data-ks-section="hero"\] \.hero h1/);
  assert.match(scoped, /\[data-ks-section="hero"\] \{ min-height/);
  assert.match(scoped, /@media \(max-width: 600px\) \{ \[data-ks-section="hero"\] \.ctas/);
  assert.match(scoped, /from \{ opacity: 0 \}/);
  assert.doesNotMatch(scoped, /\[data-ks-section="hero"\] from/);
});

test('keeps runtime state classes (.ks-js) as ancestors of the scope', () => {
  const scoped = scopeCss('.ks-js .reveal{opacity:0} html.ks-mode-edit h1{color:red} :scope{--x:1}', '[data-ks-section="s"]').css;
  assert.match(scoped, /\.ks-js \[data-ks-section="s"\] \.reveal/);
  assert.match(scoped, /html\.ks-mode-edit \[data-ks-section="s"\] h1/);
  assert.match(scoped, /\[data-ks-section="s"\]\{--x:1\}|\[data-ks-section="s"\] ?\{--x:1\}/);
});

function bundleWithSplitSources() {
  const b = sampleBundle();
  for (const s of Object.values(b.sections)) {
    const split = splitSectionSource(s.html);
    s.html = split.html;
    s.css = split.css;
    s.js = split.js;
    s.schema = compileSection(split.html);
  }
  return b;
}

test('renders a published page with defaults, nav, globals and no editor attributes', () => {
  const b = bundleWithSplitSources();
  const page = findPageByPath(b, '/')!;
  const { html, status } = renderPage(b, page, { mode: 'published', siteUrl: 'https://northline.kswd.ca' });
  assert.equal(status, 200);
  assert.match(html, /Roofs done <em class="accent">right<\/em>|Roofs done <em>right<\/em>/);
  // nav from pages, ordered by nav_order, current page marked
  const nav = html.slice(html.indexOf('<ul>'), html.indexOf('</ul>'));
  assert.ok(nav.indexOf('Home') < nav.indexOf('Our work') && nav.indexOf('Our work') < nav.indexOf('Contact us'), nav);
  assert.match(html, /aria-current="page"/);
  // business phone binding + tel href
  assert.match(html, /href="tel:\+19055550199"[^>]*>\+1 905-555-0199</);
  assert.match(html, /src="https:\/\/cdn.example.com\/northline-logo.png"/);
  assert.doesNotMatch(html, /data-ks="/);
  assert.doesNotMatch(html, /data-ks-f=/);
  assert.match(html, /data-ks-form="contact"/); // runtime hooks survive
  assert.match(html, /type="text\/ks-module" data-ks-js="hero"/);
  assert.match(html, /--color-brand:#c2410c/);
  assert.match(html, /fonts.googleapis.com\/css2\?family=Fraunces/);
  assert.match(html, /application\/ld\+json/);
});

test('applies stored content, list values, hidden optionals and owner token overrides', () => {
  const b = bundleWithSplitSources();
  b.content['i-hero'] = {
    title: { html: 'New <strong>headline</strong><script>alert(1)</script>' },
    cta: { href: 'javascript:alert(1)', label: 'Call now' },
    cta2: { href: '/work', label: 'x', hidden: true },
    badges: { items: [{ label: { html: 'One' } }, { label: { html: 'Two' } }, { label: { html: 'Three' } }] },
    bg: { src: 'https://cdn.example.com/new.jpg' },
  };
  b.theme.owner_overrides = { 'color-brand': '#111111' };
  const page = findPageByPath(b, '/')!;
  const { html } = renderPage(b, page, { mode: 'published' });
  assert.match(html, /New <strong>headline<\/strong>/);
  assert.doesNotMatch(html, /alert\(1\)/);
  assert.match(html, /<a class="btn" href="#">Call now<\/a>/);
  assert.doesNotMatch(html, /See our work/);
  assert.equal((html.match(/<li>/g) || []).length >= 3, true);
  assert.match(html, /One<\/span><\/li><li><span>Two<\/span><\/li><li><span>Three/);
  assert.match(html, /background-image:url\('https:\/\/cdn.example.com\/new.jpg'\)/);
  assert.match(html, /--color-brand:#111111/);
});

test('edit mode marks fields, lists, items and keeps hidden elements visible-but-dimmed', () => {
  const b = bundleWithSplitSources();
  b.content['i-hero'] = { cta2: { href: '/work', label: 'See our work', hidden: true } };
  const page = findPageByPath(b, '/')!;
  const { html } = renderPage(b, page, { mode: 'edit', linkBase: '/v2r/draft/TOKEN' });
  assert.match(html, /data-ks-f="title" data-ks-t="text"/);
  assert.match(html, /data-ks-l="badges"/);
  assert.match(html, /data-ks-f="badges.1.label"/);
  assert.match(html, /data-ks-f="items.0.photo" data-ks-t="image"/);
  assert.match(html, /data-ks-hidden=""[^>]*>See our work|data-ks-f="cta2"[^>]*data-ks-hidden/);
  assert.match(html, /href="\/v2r\/draft\/TOKEN\/contact"/);
  assert.match(html, /\/ks\/editor\.js/);
  assert.doesNotMatch(html, /text\/ks-module/); // agent JS is not run while editing
});

test('unknown paths render a 404 inside the site chrome', () => {
  const b = bundleWithSplitSources();
  const { status, html } = renderPage(b, findPageByPath(b, '/nope') || null, { mode: 'published' });
  assert.equal(status, 404);
  assert.match(html, /Page not found/);
  assert.match(html, /<header/);
});

test('instance render escapes </script> in agent JS', () => {
  const b = bundleWithSplitSources();
  b.sections.hero.js = 'console.log("</script><img src=x onerror=alert(1)>")';
  const { html } = renderPage(b, findPageByPath(b, '/')!, { mode: 'published' });
  assert.doesNotMatch(html, /console.log\("<\/script>/);
  void renderInstance;
});

test('content changes: normalize values and edit nested list paths', () => {
  const b = bundleWithSplitSources();
  const schema = b.sections.hero.schema as ReturnType<typeof compileSection>;
  assert.deepEqual(normalizeFieldValue(schema.fields.find((f) => f.id === 'title')!, 'Plain <b>text</b>'), { html: 'Plain <b>text</b>' });
  const current = { items: [{ label: { html: 'A' } }, { label: { html: 'B' } }] };
  const next = applyFieldChange(schema.fields, current, 'badges', ['1', 'label'], 'Changed');
  assert.deepEqual(next, { items: [{ label: { html: 'A' } }, { label: { html: 'Changed' } }] });
  assert.throws(() => applyFieldChange(schema.fields, current, 'badges', ['9', 'label'], 'x'));
});

test('background URLs cannot break out of the style attribute', () => {
  const b = bundleWithSplitSources();
  b.content['i-hero'] = { bg: { src: "https://x.example/a.jpg');color:red;background:url('x" } };
  const { html } = renderPage(b, findPageByPath(b, '/')!, { mode: 'published' });
  assert.match(html, /url\('https:\/\/x.example\/a.jpg%27%29;color:red;background:url%28%27x'\)/);
});

const SHOP = `<section class="shop"><h2 data-ks="heading">Shop</h2>
<a href="/cart" data-ks-action="open-cart"><span data-ks="cartLabel">Cart</span> <span data-ks-cart-count>0</span></a>
<div class="grid" data-ks-collection="products" data-ks-limit="2" data-ks-filter="featured">
  <article data-ks-item><img data-ks-bind="image" src="https://x.example/s.jpg" alt=""><h3 data-ks-bind="name">Sample</h3>
  <s data-ks-if="on_sale" data-ks-bind="compare_price">$9</s><b data-ks-bind="price">$5</b><a data-ks-bind="url" href="#">More</a>
  <button data-ks-action="add-to-cart">Add</button></article>
  <p data-ks-empty data-ks="empty">Coming soon</p>
</div>
<ul data-ks-list="reviews" data-ks-schema="reviews"><li data-ks-item><q data-ks="quote">Great work</q><cite data-ks="author">Sam</cite><span data-ks="rating">5</span></li></ul>
<dl data-ks-list="faq" data-ks-schema="faq"><div data-ks-item><dt data-ks="question">Do you do repairs?</dt><dd data-ks="answer">Yes, all year.</dd></div></dl>
</section>`;

function shopBundle() {
  const b = bundleWithSplitSources();
  b.sections.shop = { key: 'shop', name: 'Shop', html: SHOP, css: '', js: '', schema: compileSection(SHOP) };
  b.pages[0].instances = [{ id: 'i-shop', section: 'shop' }];
  return b;
}
const PRODUCTS = {
  products: [
    { id: 'p1', name: 'Ridge vent', description: '', price: '$49.00', compare_price: '$60.00', on_sale: 'true', image: 'https://cdn.example.com/p1.jpg', url: '/product/p1', category: 'Vents', brand: '', featured: 'true', in_stock: 'true', needs_options: '' },
    { id: 'p2', name: 'Shingle pack', description: '', price: '$89.00', compare_price: '', on_sale: '', image: '', url: '/product/p2', category: '', brand: '', featured: 'true', in_stock: 'true', needs_options: 'true' },
    { id: 'p3', name: 'Not featured', description: '', price: '$1.00', compare_price: '', on_sale: '', image: '', url: '/product/p3', category: '', brand: '', featured: '', in_stock: 'true', needs_options: '' },
  ],
  productPayload: { p1: { productId: 'p1', name: 'Ridge vent', price_cents: 4900, currency: 'CAD', image: 'https://cdn.example.com/p1.jpg', needsOptions: false, url: '/product/p1' } },
};

test('collections compile: valid markup passes, bad fields and data-ks in items are errors', () => {
  const ok = compileSection(SHOP);
  assert.deepEqual(ok.issues.filter((i) => i.level === 'error'), [], JSON.stringify(ok.issues));
  const reviews = ok.fields.find((f) => f.id === 'reviews');
  assert.equal(reviews?.schema, 'reviews');
  const bad = compileSection('<div data-ks-collection="products"><div data-ks-item><b data-ks-bind="nope">x</b><i data-ks="t">y</i></div></div><div data-ks-collection="widgets"><p data-ks-item>z</p></div>');
  const rules = bad.issues.map((i) => i.rule);
  assert.equal(rules.filter((r) => r === 'collection-field').length, 2);
  assert.ok(rules.includes('collection'));
  const badSchema = compileSection('<ul data-ks-list="r" data-ks-schema="reviews"><li data-ks-item><span data-ks="text">x</span></li></ul>');
  assert.ok(badSchema.issues.some((i) => i.rule === 'schema-hint'));
});

test('collections render live data with filters, bindings and cart payloads', () => {
  const b = shopBundle();
  const { html } = renderPage(b, b.pages[0], { mode: 'published', siteUrl: 'https://x.kswd.ca', collections: PRODUCTS });
  assert.match(html, /<h3>Ridge vent<\/h3>/);
  assert.match(html, /<h3>Shingle pack<\/h3>/);
  assert.doesNotMatch(html, /Not featured/, 'filter=featured');
  assert.doesNotMatch(html, /Sample/, 'template sample replaced');
  assert.match(html, /<s>\$60.00<\/s>/);
  assert.equal((html.match(/<s>/g) || []).length, 1, 'data-ks-if removed compare price for non-sale item');
  assert.match(html, /src="https:\/\/cdn.example.com\/p1.jpg" alt="Ridge vent"/);
  assert.match(html, /href="\/product\/p2"/);
  assert.match(html, /data-ks-product="\{&quot;productId&quot;:&quot;p1&quot;/);
  assert.doesNotMatch(html, /Coming soon/, 'empty message removed when items exist');
  assert.match(html, /data-ks-cart-count/, 'cart count hook kept for the runtime');
  assert.doesNotMatch(html, /data-ks-bind/);
});

test('empty collections: published shows the empty message, drafts keep marked samples', () => {
  const b = shopBundle();
  const pub = renderPage(b, b.pages[0], { mode: 'published', collections: { products: [] } }).html;
  assert.match(pub, /Coming soon/);
  assert.doesNotMatch(pub, /Sample/);
  const draft = renderPage(b, b.pages[0], { mode: 'edit', collections: { products: [] } }).html;
  assert.match(draft, /data-ks-sample/);
  assert.match(draft, /data-ks-c="products"/);
});

test('review and FAQ lists become structured data', () => {
  const b = shopBundle();
  const { html } = renderPage(b, b.pages[0], { mode: 'published', siteUrl: 'https://x.kswd.ca', collections: PRODUCTS });
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /Do you do repairs\?/);
  assert.match(html, /"reviewBody":"Great work"|"Review"/);
});

test('hosted-page chrome carries the header, footer, tokens and platform colours', () => {
  const b = shopBundle();
  b.theme.platform = { primary: 'color-brand' };
  b.theme.owner_overrides = { 'color-brand': '#222222' };
  const chrome = renderChrome(b);
  assert.match(chrome.header, /<header class="bar">/);
  assert.match(chrome.footer, /<footer>/);
  assert.match(chrome.head, /--color-brand:#222222/);
  assert.equal(chrome.palette.primary, '#222222');
  assert.equal(platformPalette({ ...b.theme, platform: {} }).primary, '#222222', 'falls back to the first colour token');
  assert.deepEqual(featuresIn([SHOP]), { ecommerce: true, booking: false });
  assert.deepEqual(featuresIn(['<a href="/book">Book</a>']), { ecommerce: false, booking: true });
});

console.log(`\n${passed} passed`);
