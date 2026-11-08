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
import { sanitizeArticle } from '../lib/v2/sanitize';
import { validateBundle } from '../lib/v2/validate';

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

test('edit mode marks optional parts and keeps a placeholder in empty lists', () => {
  const b = bundleWithSplitSources();
  b.content['i-hero'] = { badges: { items: [] } };
  const page = findPageByPath(b, '/')!;
  const edit = renderPage(b, page, { mode: 'edit' }).html;
  assert.match(edit, /data-ks-f="cta2"[^>]*data-ks-opt|data-ks-opt[^>]*data-ks-f="cta2"/);
  assert.match(edit, /data-ks-l="badges"/);
  assert.match(edit, /<li data-ks-item="" data-ks-ghost="">/);
  const pub = renderPage(b, page, { mode: 'published' }).html;
  assert.doesNotMatch(pub, /data-ks-ghost|data-ks-opt/);
  assert.doesNotMatch(pub, /Licensed/); // no placeholder item on the live site
});

test('repeated items with numbered fields get a list hint (warning only)', () => {
  const stats = '<section><h2 data-ks="title">Results</h2><div class="stats">'
    + [1, 2, 3].map((n) => `<div class="stat"><strong data-ks="stat${n}Value">${n}0+</strong><span data-ks="stat${n}Label">Label ${n}</span></div>`).join('')
    + '</div></section>';
  const c = compileSection(stats);
  const hint = c.issues.find((i) => i.rule === 'repeated-items');
  assert.ok(hint, 'expected a repeated-items hint');
  assert.equal(hint!.level, 'warning');
  assert.equal(c.issues.filter((i) => i.level === 'error').length, 0);

  // Already a list, or a run of plain paragraphs: no hint.
  const asList = compileSection('<section><div class="stats" data-ks-list="stats">'
    + [1, 2, 3].map((n) => `<div class="stat" data-ks-item><strong data-ks="value">${n}</strong><span data-ks="label">L</span></div>`).join('') + '</div></section>');
  assert.ok(!asList.issues.some((i) => i.rule === 'repeated-items'));
  const copy = compileSection('<section><div><p data-ks="p1">a</p><p data-ks="p2">b</p><p data-ks="p3">c</p></div></section>');
  assert.ok(!copy.issues.some((i) => i.rule === 'repeated-items'));
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
  assert.deepEqual(featuresIn([SHOP]), { ecommerce: true, booking: false, blog: false });
  assert.deepEqual(featuresIn(['<a href="/book">Book</a>']), { ecommerce: false, booking: true, blog: false });
});

const POST_LIST = `<section class="news"><h2 data-ks="heading">News</h2>
<div class="grid" data-ks-collection="posts" data-ks-limit="2" data-ks-offset="1">
  <a class="card" data-ks-item data-ks-bind="url" href="/blog/sample">
    <img data-ks-if="image" data-ks-bind="image" src="https://cdn.example.com/s.jpg" alt="">
    <time data-ks-bind="date">Jan 1</time><h3 data-ks-bind="title">Sample post</h3><p data-ks-bind="excerpt">Sample excerpt</p>
  </a>
  <p data-ks-empty data-ks="empty">No news yet</p>
</div>
<ul data-ks-collection="posts" data-ks-tag="press"><li data-ks-item data-ks-bind="title">Sample</li></ul>
</section>`;
const ARTICLE = `<article class="post" data-ks-collection="post"><div data-ks-item>
  <h1 data-ks-bind="title">Sample title</h1><span data-ks-bind="reading_time">1 min</span>
  <div class="prose" data-ks-bind="content"><p>Sample paragraph</p></div>
</div></article>`;
const POSTS = {
  posts: ['Newest', 'Middle', 'Oldest', 'Fourth'].map((title, i) => ({
    id: `b${i}`, title, slug: `s${i}`, excerpt: `${title} excerpt`, date: `March ${10 - i}, 2026`, date_iso: `2026-03-${String(10 - i).padStart(2, '0')}`,
    image: i === 1 ? 'https://cdn.example.com/m.jpg' : '', author: '', tags: i === 2 ? 'Press, Awards' : '', tag: '', url: `/blog/s${i}`,
    reading_time: '2 min read', featured: '', current: '',
  })),
  post: [{
    id: 'b0', title: 'Newest', slug: 's0', excerpt: '', date: 'March 10, 2026', date_iso: '2026-03-10', image: '', author: '', tags: '', tag: '',
    url: '/blog/s0', reading_time: '3 min read', featured: '', current: 'true',
    content: '<h2>Why it matters</h2><p>Real <strong>article</strong> text.</p>',
  }],
};

function newsBundle() {
  const b = bundleWithSplitSources();
  b.sections.news = { key: 'news', name: 'News', html: POST_LIST, css: '', js: '', schema: compileSection(POST_LIST) };
  b.sections.article = { key: 'article', name: 'Article', html: ARTICLE, css: '', js: '', schema: compileSection(ARTICLE) };
  b.pages[0].instances = [{ id: 'i-news', section: 'news' }];
  return b;
}

test('posts compile: list and article markup pass; content needs a block container', () => {
  assert.deepEqual(featuresIn([POST_LIST]), { ecommerce: false, booking: false, blog: true });
  for (const html of [POST_LIST, ARTICLE]) {
    const c = compileSection(html);
    assert.deepEqual(c.issues.filter((i) => i.level === 'error'), [], JSON.stringify(c.issues));
  }
  const bad = compileSection('<div data-ks-collection="post"><div data-ks-item><p data-ks-bind="content">x</p><b data-ks-bind="price">y</b></div></div>');
  const messages = bad.issues.filter((i) => i.level === 'error').map((i) => i.message).join(' | ');
  assert.match(messages, /Bind "content" on a block element/);
  assert.match(messages, /"price" is not a post field/);
  const listContent = compileSection('<div data-ks-collection="posts"><div data-ks-item><div data-ks-bind="content">x</div></div></div>');
  assert.ok(listContent.issues.some((i) => i.level === 'error' && /"content" is not a posts field/.test(i.message)), 'lists carry no article bodies');
  assert.equal(compileSection(ARTICLE).issues.length, 0, 'sample paragraphs in the content element are fine');
  const nested = compileSection('<div data-ks-collection="post"><div data-ks-item><div data-ks-bind="content"><div class="sidebar">x</div></div></div></div>');
  assert.ok(nested.issues.some((i) => i.level === 'warning' && /replaced by the article/.test(i.message)), 'design inside the content element is flagged');
});

test('post lists: newest first, offset, limit, tag filter, dates and links', () => {
  const b = newsBundle();
  const { html } = renderPage(b, b.pages[0], { mode: 'published', siteUrl: 'https://x.kswd.ca', collections: POSTS });
  const grid = html.slice(html.indexOf('class="grid"'), html.indexOf('</div>', html.indexOf('class="grid"')));
  assert.doesNotMatch(grid, /Newest/, 'offset 1 skips the newest');
  assert.match(grid, /Middle[\s\S]*Oldest/);
  assert.doesNotMatch(grid, /Fourth/, 'limit 2');
  assert.match(grid, /href="\/blog\/s1"/);
  assert.match(grid, /<time datetime="2026-03-09">March 9, 2026<\/time>/);
  assert.match(grid, /src="https:\/\/cdn.example.com\/m.jpg" alt="Middle"/);
  assert.equal((grid.match(/<img/g) || []).length, 1, 'data-ks-if drops the image for posts without one');
  assert.match(html, /<ul[^>]*><li>Oldest<\/li><\/ul>/, 'data-ks-tag matches any tag, case-insensitively');
  assert.doesNotMatch(html, /No news yet/);
});

test('article layout binds the post, including its formatted body', () => {
  const b = newsBundle();
  b.pages[0].instances = [{ id: 'i-article', section: 'article' }];
  const { html } = renderPage(b, b.pages[0], { mode: 'published', collections: POSTS });
  assert.match(html, /<h1>Newest<\/h1>/);
  assert.match(html, /<div class="prose"><h2>Why it matters<\/h2><p>Real <strong>article<\/strong> text.<\/p><\/div>/);
  assert.doesNotMatch(html, /Sample paragraph/);
  assert.match(html, /3 min read/);
});

test('article bodies are sanitized: no script, handlers or javascript: links', () => {
  const dirty = '<h2 style="text-align:center;position:fixed">Hi</h2><p onclick="x()">a <a href="javascript:alert(1)">b</a> <a href="https://ok.example" target="_blank">c</a></p><script>alert(1)</script><img src="javascript:x" onerror="y"><img src="https://cdn.example.com/a.jpg" alt="A"><iframe src="https://evil.example"></iframe><table><tr><td colspan="2">t</td></tr></table>';
  const clean = sanitizeArticle(dirty);
  assert.doesNotMatch(clean, /script|onclick|onerror|javascript:|iframe|position/);
  assert.match(clean, /<h2 style="text-align:center">Hi<\/h2>/);
  assert.match(clean, /rel="noopener noreferrer"/);
  assert.match(clean, /<img src="https:\/\/cdn.example.com\/a.jpg" alt="A" \/>|<img src="https:\/\/cdn.example.com\/a.jpg" alt="A">/);
  assert.match(clean, /<td colspan="2">t<\/td>/);
});

test('empty post lists: published shows the empty message; drafts keep samples', () => {
  const b = newsBundle();
  const pub = renderPage(b, b.pages[0], { mode: 'published', collections: { posts: [] } }).html;
  assert.match(pub, /No news yet/);
  assert.doesNotMatch(pub, /Sample post/);
  const draft = renderPage(b, b.pages[0], { mode: 'edit', collections: { posts: [] } }).html;
  assert.match(draft, /data-ks-c="posts"/);
  assert.match(draft, /data-ks-sample/);
});

// ── "Powered by Keystone" ──
function withFooter(html: string, css = '', js = '') {
  const b = sampleBundle();
  b.sections.footer = { ...b.sections.footer, html, css, js, schema: compileSection(html) };
  return b;
}
const SLOT_FOOTER = '<footer><p data-ks="blurb">Northline Roofing</p><p class="credit" data-ks-attribution>anything</p></footer>';

test('attribution: a footer without a slot gets the fallback line, on pages and hosted flows', () => {
  const b = sampleBundle();
  for (const mode of ['published', 'preview', 'edit'] as const) {
    const html = renderPage(b, b.pages[0], { mode }).html;
    assert.match(html, /data-ks-attribution-fallback[^>]*>Powered by <a href="https:\/\/keystoneweb\.ca"[^>]*>Keystone<\/a><\/div>/, mode);
    assert.ok(html.indexOf('data-ks-attribution-fallback') > html.indexOf('</footer>'), 'after the footer');
  }
  assert.match(renderChrome(b).footer, /data-ks-attribution-fallback/);
  assert.ok(validateBundle(b).warnings.some((w) => w.rule === 'attribution'));
});

test('attribution: the agent slot is filled with fixed text + link, keeps its styling hook, no fallback', () => {
  const b = withFooter(SLOT_FOOTER);
  assert.equal(compileSection(SLOT_FOOTER).issues.filter((i) => i.level === 'error').length, 0);
  const html = renderPage(b, b.pages[0], { mode: 'published' }).html;
  assert.match(html, /<p class="credit" data-ks-attribution(="")? style="visibility:visible!important[^"]*">Powered by <a href="https:\/\/keystoneweb\.ca" target="_blank" rel="noopener"[^>]*>Keystone<\/a><\/p>/);
  assert.doesNotMatch(html, /anything/);
  assert.doesNotMatch(html, /data-ks-attribution-fallback/);
  assert.doesNotMatch(renderChrome(b).footer, /data-ks-attribution-fallback/);
  assert.ok(!validateBundle(b).warnings.some((w) => w.rule === 'attribution'));
  // The link and text are fixed, and hiding attributes are dropped.
  const hidden = withFooter('<footer><a data-ks-attribution hidden aria-hidden="true" href="https://evil.example">x</a></footer>');
  const h = renderPage(hidden, hidden.pages[0], { mode: 'published' }).html;
  assert.match(h, /<a data-ks-attribution[^>]*href="https:\/\/keystoneweb\.ca"[^>]*>Powered by Keystone<\/a>/);
  const footerHtml = h.slice(h.indexOf('<footer>'), h.indexOf('</footer>'));
  assert.doesNotMatch(footerHtml, /evil\.example|aria-hidden|\shidden/);
});

test('attribution: removing the slot brings the fallback back; hiding it in CSS/JS fails validation', () => {
  const removed = withFooter('<footer><p data-ks="blurb">Northline Roofing</p></footer>');
  assert.match(renderPage(removed, removed.pages[0], { mode: 'published' }).html, /data-ks-attribution-fallback/);
  for (const css of [
    '[data-ks-attribution]{display:none}',
    '.x [data-ks-attribution] a { opacity: 0.1 }',
    'p[data-ks-attribution]{font-size:6px}',
    '[data-ks-attribution]{position:absolute;left:-9999px}',
  ]) {
    assert.ok(validateBundle(withFooter(SLOT_FOOTER, css)).errors.some((e) => e.rule === 'attribution'), css);
  }
  const styled = validateBundle(withFooter(SLOT_FOOTER, '[data-ks-attribution]{font-size:12px;opacity:.7;color:var(--muted);text-align:center} [data-ks-attribution] a{color:inherit}'));
  assert.ok(!styled.errors.some((e) => e.rule === 'attribution'), JSON.stringify(styled.errors));
  const js = validateBundle(withFooter(SLOT_FOOTER, '', "export default (root) => { root.querySelector('[data-ks-attribution]').remove(); }"));
  assert.ok(js.errors.some((e) => e.rule === 'attribution'));
  const g = sampleBundle();
  g.theme = { ...g.theme, global_css: 'footer [data-ks-attribution]{visibility:hidden}' };
  assert.ok(validateBundle(g).errors.some((e) => e.rule === 'attribution'));
});

console.log(`\n${passed} passed`);
