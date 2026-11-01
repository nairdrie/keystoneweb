/**
 * End-to-end flow for engine v2 against an in-memory database:
 * an agent builds a site over MCP, the owner edits it, the agent iterates,
 * publish, restore, duplicate — checking the ownership and safety rules.
 * Run: npm run test:v2
 */
import assert from 'node:assert/strict';

process.env.RESEND_API_KEY ||= 're_test_dummy';
process.env.KS_V2_PREVIEW_SECRET ||= 'test-secret';
process.env.NEXT_PUBLIC_APP_URL ||= 'https://keystoneweb.ca';

async function main() {
  const { FakeSupabase } = await import('./fixtures/fake-supabase');
  const { SAMPLE_SECTIONS } = await import('./fixtures/v2-sample-site');
  const { handleMcpHttp } = await import('../lib/v2/mcp-server');
  const { hashToken } = await import('../lib/v2/api-tokens');
  const ops = await import('../lib/v2/ops');
  const { loadDraftBundle, loadRelease, loadSiteRow } = await import('../lib/v2/store');
  const { renderPage, findPageByPath } = await import('../lib/v2/render');
  const { verifyDraftToken } = await import('../lib/v2/preview-token');
  const { duplicateSite } = await import('../lib/sites/duplicate');
  const { fetchCollections, collectionsIn, pageSectionHtmls } = await import('../lib/v2/collections');

  const db = new FakeSupabase();
  const OWNER = '11111111-1111-1111-1111-111111111111';
  const OTHER = '22222222-2222-2222-2222-222222222222';
  const STAFF = '33333333-3333-3333-3333-333333333333';
  db.table('users').push(
    { id: OWNER, email: 'owner@example.com', is_admin: false, is_banned: false },
    { id: OTHER, email: 'other@example.com', is_admin: false, is_banned: false },
    { id: STAFF, email: 'staff@keystoneweb.ca', is_admin: true, is_banned: false },
  );
  db.table('user_subscriptions').push({ user_id: OWNER, subscription_status: 'active', subscription_plan: 'pro' });

  const tokens: Record<string, string> = {};
  for (const [name, user, scopes] of [
    ['owner-agent', OWNER, ['sites:read', 'sites:write', 'sites:publish']],
    ['owner-drafts', OWNER, ['sites:read', 'sites:write']],
    ['other', OTHER, ['sites:read', 'sites:write']],
    ['staff', STAFF, ['sites:read', 'sites:write']],
  ] as const) {
    const token = `ks_pat_${name.replace(/[^a-z]/g, '')}${'x'.repeat(30)}`;
    tokens[name] = token;
    db.table('api_tokens').push({ id: `tok-${name}`, name, user_id: user, token_hash: hashToken(token), scopes: [...scopes], revoked_at: null, expires_at: null, last_used_at: null });
  }

  let rpcId = 0;
  async function rpc(token: string, method: string, params?: Record<string, unknown>) {
    const res = await handleMcpHttp(db as never, `Bearer ${token}`, { jsonrpc: '2.0', id: ++rpcId, method, params });
    return res;
  }
  async function tool(token: string, name: string, args: Record<string, unknown>) {
    const res = await rpc(token, 'tools/call', { name, arguments: args });
    const body = res.body as { result: { isError?: boolean; content: Array<{ text: string }>; structuredContent?: Record<string, unknown> } };
    const parsed = JSON.parse(body.result.content[0].text);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool results are free-form JSON
    return { isError: !!body.result.isError, data: parsed as Record<string, any> };
  }
  async function ok(token: string, name: string, args: Record<string, unknown>) {
    const r = await tool(token, name, args);
    assert.equal(r.isError, false, `${name} failed: ${JSON.stringify(r.data)}`);
    return r.data;
  }

  let passed = 0;
  const step = async (label: string, fn: () => Promise<void>) => {
    await fn();
    passed++;
    console.log(`  ✓ ${label}`);
  };

  console.log('v2 flow');

  await step('MCP protocol: auth, initialize, tools/list, notifications', async () => {
    const unauth = await handleMcpHttp(db as never, null, { jsonrpc: '2.0', id: 1, method: 'initialize' });
    assert.equal(unauth.status, 401);
    assert.match(unauth.headers['WWW-Authenticate'], /Bearer/);
    const init = await rpc(tokens['owner-agent'], 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    const initBody = init.body as { result: { protocolVersion: string; capabilities: { tools: unknown }; instructions: string } };
    assert.equal(initBody.result.protocolVersion, '2025-06-18');
    assert.ok(initBody.result.capabilities.tools);
    const note = await handleMcpHttp(db as never, `Bearer ${tokens['owner-agent']}`, { jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(note.status, 202);
    const list = await rpc(tokens['owner-agent'], 'tools/list');
    const names = (list.body as { result: { tools: Array<{ name: string }> } }).result.tools.map((t) => t.name);
    for (const n of ['get_guide', 'create_site', 'put_section', 'put_page', 'set_content', 'validate', 'publish', 'export_legacy_site']) assert.ok(names.includes(n), n);
    assert.ok(!names.includes('research_business'), 'staff-only tool hidden from customers');
    const staffList = await rpc(tokens.staff, 'tools/list');
    assert.ok((staffList.body as { result: { tools: Array<{ name: string }> } }).result.tools.some((t) => t.name === 'research_business'));
    const unknown = await rpc(tokens['owner-agent'], 'resources/templates/list');
    assert.equal((unknown.body as { error: { code: number } }).error.code, -32601);
    const guide = await ok(tokens['owner-agent'], 'get_guide', { topic: 'sections' });
    assert.match(guide.guide, /data-ks-list/);
  });

  let siteId = '';
  await step('agent creates a site and builds theme, layout and home page', async () => {
    const created = await ok(tokens['owner-agent'], 'create_site', {
      name: 'Northline Roofing',
      category: 'roofing',
      business: { phone: '+1 905-555-0199', email: 'hello@northline.ca', city: 'Oakville', region: 'ON', hours: ['Mo-Fr 08:00-17:00'] },
    });
    siteId = created.site_id;
    assert.match(created.preview_url, /\/v2r\/draft\//);
    const site = await loadSiteRow(db as never, siteId);
    assert.equal(site?.engine, 'sections_v2');
    assert.equal(site?.user_id, OWNER);

    await ok(tokens['owner-agent'], 'set_theme', {
      site_id: siteId,
      tokens: [
        { name: 'color-brand', value: '#c2410c', type: 'color', label: 'Brand', editable: true },
        { name: 'font-display', value: "'Fraunces', serif", type: 'font', label: 'Headings', editable: true },
        { name: 'space', value: '1.5rem', type: 'length' },
      ],
      global_css: 'body{margin:0;font-family:system-ui;color:#111}',
    });
    for (const [key, html] of Object.entries(SAMPLE_SECTIONS)) {
      const r = await ok(tokens['owner-agent'], 'put_section', { site_id: siteId, key, name: key[0].toUpperCase() + key.slice(1), html });
      assert.deepEqual(r.issues.filter((i: { level: string }) => i.level === 'error'), [], key);
    }
    await ok(tokens['owner-agent'], 'set_layout', { site_id: siteId, header: 'header', footer: 'footer', footer_content: { blurb: 'Northline Roofing — Oakville' } });
    const page = await ok(tokens['owner-agent'], 'put_page', {
      site_id: siteId,
      slug: 'home',
      title: 'Home',
      seo: { title: 'Northline Roofing | Oakville roofers', description: 'Roof replacement and repair in Oakville.' },
      sections: [
        { section: 'hero', id: 'home-hero', content: { title: 'Oakville roofs, <em>done right</em>', badges: [{ label: 'Licensed' }, { label: 'Insured' }, { label: '25-yr warranty' }] } },
        { section: 'services', id: 'home-services' },
        { section: 'contact', id: 'home-contact' },
      ],
    });
    assert.equal(page.content.every((c: { status: string }) => c.status === 'saved'), true);
    await ok(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'contact', title: 'Contact', seo: { description: 'Contact Northline' }, sections: [{ section: 'contact', id: 'contact-form' }] });
    await ok(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'work', title: 'Our work', seo: { description: 'Projects' }, sections: [{ section: 'services', id: 'work-grid' }] });
  });

  await step('instance ids are unique across pages', async () => {
    const dup = await tool(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'about', sections: [{ section: 'hero', id: 'home-hero' }] });
    assert.equal(dup.isError, true);
    assert.match(dup.data.error, /already used/);
  });

  await step('validate passes and get_site describes editable fields', async () => {
    const report = await ok(tokens['owner-agent'], 'validate', { site_id: siteId });
    assert.equal(report.ok, true, JSON.stringify(report.errors));
    assert.ok(report.summary.editableFields > 15);
    const site = await ok(tokens['owner-agent'], 'get_site', { site_id: siteId });
    const hero = site.sections.find((s: { key: string }) => s.key === 'hero');
    assert.ok(hero.fields.some((f: { id: string; type: string }) => f.id === 'badges' && f.type === 'list'));
    assert.equal(hero.html, undefined, 'code only with include_code');
  });

  await step('access control: other users are refused, staff allowed, scopes enforced', async () => {
    const other = await tool(tokens.other, 'get_site', { site_id: siteId });
    assert.equal(other.isError, true);
    assert.match(other.data.error, /access/);
    await ok(tokens.staff, 'get_site', { site_id: siteId });
    const noScope = await tool(tokens['owner-drafts'], 'publish', { site_id: siteId });
    assert.match(noScope.data.error, /sites:publish/);
  });

  await step('owner edits are protected from agents unless forced', async () => {
    const owner = { db: db as never, siteId, actor: { type: 'owner' as const, label: 'owner@example.com' } };
    await ops.opSetContent(owner, [{ instance: 'home-hero', path: 'title', value: 'Owner wrote <strong>this</strong>' }]);
    await ops.opSetContent(owner, [{ instance: 'home-hero', path: 'badges.1.label', value: 'Fully insured' }]);
    const attempt = await ok(tokens['owner-agent'], 'set_content', { site_id: siteId, changes: [{ instance: 'home-hero', path: 'title', value: 'Agent overwrite' }, { instance: 'home-hero', path: 'eyebrow', value: 'Since 1994' }] });
    assert.equal(attempt.results[0].status, 'skipped_owner_edit');
    assert.equal(attempt.results[1].status, 'saved');
    const listEdit = await tool(tokens['owner-agent'], 'edit_list', { site_id: siteId, instance: 'home-hero', path: 'badges', op: 'remove', index: 0 });
    assert.equal(listEdit.isError, true, 'agents cannot restructure a list the owner edited');
    let bundle = await loadDraftBundle(db as never, siteId);
    assert.equal((bundle!.content['home-hero'].title as { html: string }).html, 'Owner wrote <strong>this</strong>');
    const forced = await ok(tokens['owner-agent'], 'set_content', { site_id: siteId, force: true, changes: [{ instance: 'home-hero', path: 'title', value: 'Agent, as asked' }] });
    assert.equal(forced.results[0].status, 'saved');
    bundle = await loadDraftBundle(db as never, siteId);
    assert.equal((bundle!.content['home-hero'].title as { html: string }).html, 'Agent, as asked');
    await ops.opSetContent(owner, [{ instance: 'home-hero', path: 'title', value: 'Owner wrote <strong>this</strong>' }]);
  });

  await step('agent redesign keeps owner content for fields whose ids survive', async () => {
    const redesigned = SAMPLE_SECTIONS.hero.replace('class="hero"', 'class="hero hero--v2"').replace('Oakville · Since 1994', 'New default eyebrow').replace('<h1 data-ks="title"', '<h1 class="big" data-ks="title"');
    const r = await ok(tokens['owner-agent'], 'put_section', { site_id: siteId, key: 'hero', html: redesigned.replace(/<a class="btn ghost"[^>]*>See our work<\/a>/, '') });
    assert.deepEqual(r.removedFields, ['cta2']);
    const bundle = await loadDraftBundle(db as never, siteId);
    const html = renderPage(bundle!, findPageByPath(bundle!, '/')!, { mode: 'published' }).html;
    assert.match(html, /hero hero--v2/);
    assert.match(html, /<h1 class="big">Owner wrote <strong>this<\/strong><\/h1>/);
    assert.match(html, /Fully insured/);
    assert.match(html, /Since 1994/, 'agent-set eyebrow content still wins over the new default');
  });

  await step('section ops: add, duplicate (with content), hide, move, remove', async () => {
    const owner = { db: db as never, siteId, actor: { type: 'owner' as const, label: 'owner@example.com' } };
    const home = (await loadDraftBundle(db as never, siteId))!.pages.find((p) => p.slug === 'home')!;
    const dup = await ops.opPageSections(owner, { page: home.id, action: 'duplicate', instance: 'home-hero' });
    const copyId = dup.created!;
    let bundle = await loadDraftBundle(db as never, siteId);
    assert.equal((bundle!.content[copyId].title as { html: string }).html, 'Owner wrote <strong>this</strong>');
    await ops.opPageSections(owner, { page: home.id, action: 'hide', instance: copyId });
    await ops.opPageSections(owner, { page: home.id, action: 'move', instance: copyId, to: 3 });
    bundle = await loadDraftBundle(db as never, siteId);
    const page = bundle!.pages.find((p) => p.slug === 'home')!;
    assert.equal(page.instances[3].id, copyId);
    assert.equal(page.instances[3].hidden, true);
    const published = renderPage(bundle!, page, { mode: 'published' }).html;
    assert.equal((published.match(/<div data-ks-section="hero"/g) || []).length, 1, "hidden instance not rendered");
    await ops.opPageSections(owner, { page: home.id, action: 'remove', instance: copyId });
    await assert.rejects(ops.opDeleteSection({ ...owner, actor: { type: 'agent', label: 'x' } }, 'hero'), /in use/);
  });

  await step('owner brand + business changes flow into the render', async () => {
    const owner = { db: db as never, siteId, actor: { type: 'owner' as const, label: 'owner@example.com' } };
    await ops.opSetOwnerTokens(owner, { 'color-brand': '#0f766e' });
    await assert.rejects(ops.opSetOwnerTokens(owner, { space: '2rem' }), /not an editable/);
    await assert.rejects(ops.opSetOwnerTokens(owner, { 'color-brand': 'url(x)' }), /not a colour/);
    await ops.opUpdateBusiness(owner, { phone: '(905) 555-0123' });
    const bundle = await loadDraftBundle(db as never, siteId);
    const html = renderPage(bundle!, findPageByPath(bundle!, '/')!, { mode: 'published' }).html;
    assert.match(html, /--color-brand:#0f766e/);
    assert.match(html, /href="tel:9055550123"[^>]*>\(905\) 555-0123/);
  });

  await step('stale writes are rejected; parallel writes never lose each other', async () => {
    const owner = { db: db as never, siteId, actor: { type: 'owner' as const, label: 'owner@example.com' } };
    const agent = { db: db as never, siteId, actor: { type: 'agent' as const, label: 'agent' } };

    // Content: a client that read an old revision is rejected; the current one is accepted.
    const content = await ops.opGetContent(owner, { instance: 'home-services' });
    const heading = (content.content[0] as { values: Record<string, { rev: number }> }).values.heading;
    const first = await ops.opSetContent(owner, [{ instance: 'home-services', path: 'heading', value: 'Our services', expected_rev: heading.rev }]);
    assert.equal(first.results[0].status, 'saved');
    const stale = await ops.opSetContent(owner, [{ instance: 'home-services', path: 'heading', value: 'Stale copy', expected_rev: heading.rev }]);
    assert.equal(stale.results[0].status, 'conflict');
    const fresh = await ops.opSetContent(owner, [{ instance: 'home-services', path: 'heading', value: 'What we do best', expected_rev: first.results[0].rev }]);
    assert.equal(fresh.results[0].status, 'saved');

    // Parallel edits to different items of the same list both survive.
    await Promise.all([
      ops.opSetContent(agent, [{ instance: 'work-grid', path: 'items.0.name', value: 'Parallel A' }]),
      ops.opSetContent(agent, [{ instance: 'work-grid', path: 'items.1.name', value: 'Parallel B' }]),
      ops.opListOp(agent, { instance: 'work-grid', path: 'items', op: 'add' }),
    ]);
    let bundle = await loadDraftBundle(db as never, siteId);
    const items = (bundle!.content['work-grid'].items as { items: Array<{ name?: { html: string } }> }).items;
    assert.equal(items[0].name?.html, 'Parallel A');
    assert.equal(items[1].name?.html, 'Parallel B');
    assert.equal(items.length, 3);

    // Parallel section actions on one page both land (the earlier lost-update bug).
    const home = bundle!.pages.find((p) => p.slug === 'home')!;
    await Promise.all([
      ops.opPageSections(owner, { page: home.id, action: 'hide', instance: 'home-contact' }),
      ops.opPageSections(owner, { page: home.id, action: 'move', instance: 'home-services', to: 0 }),
    ]);
    bundle = await loadDraftBundle(db as never, siteId);
    const after = bundle!.pages.find((p) => p.slug === 'home')!;
    assert.equal(after.instances[0].id, 'home-services');
    assert.equal(after.instances.find((i) => i.id === 'home-contact')?.hidden, true);
    // …and a client acting on an outdated page version is told to reload.
    await assert.rejects(ops.opPageSections(owner, { page: home.id, action: 'show', instance: 'home-contact', expected_version: home.layoutVersion }), /changed by someone else/);
    await ops.opPageSections(owner, { page: home.id, action: 'show', instance: 'home-contact', expected_version: after.layoutVersion });
    await ops.opPageSections(owner, { page: home.id, action: 'move', instance: 'home-services', to: 1 });

    // Sections and theme: expected_version over MCP.
    const site = await ok(tokens['owner-agent'], 'get_site', { site_id: siteId });
    const footerVersion = site.sections.find((x: { key: string }) => x.key === 'footer').version;
    const staleSection = await tool(tokens['owner-agent'], 'put_section', { site_id: siteId, key: 'footer', html: SAMPLE_SECTIONS.footer, expected_version: footerVersion - 1 });
    assert.equal(staleSection.isError, true);
    assert.equal(staleSection.data.details.reason, 'stale');
    await ok(tokens['owner-agent'], 'put_section', { site_id: siteId, key: 'footer', html: SAMPLE_SECTIONS.footer, expected_version: footerVersion });
    const staleTheme = await tool(tokens['owner-agent'], 'set_theme', { site_id: siteId, global_css: 'body{margin:0}', expected_version: site.theme.version - 1 });
    assert.equal(staleTheme.isError, true);
  });

  await step('agents add services/products and design how they look; live data renders in their markup', async () => {
    const services = await ok(tokens['owner-agent'], 'upsert_services', { site_id: siteId, services: [
      { name: 'Roof inspection', description: 'Full inspection with photos.', duration_minutes: 60, price_cents: 0, featured: true },
      { name: 'Leak repair', duration_minutes: 120, price_cents: 25000 },
    ] });
    assert.equal(services.services.length, 2);
    assert.ok(db.table('booking_settings').some((r) => r.site_id === siteId), 'booking made bookable');
    const products = await ok(tokens['owner-agent'], 'upsert_products', { site_id: siteId, products: [
      { name: 'Ridge vent', price_cents: 4900, compare_at_cents: 6000, images: ['https://cdn.example.com/vent.jpg', 'javascript:alert(1)'], featured: true },
    ] });
    const productId = products.products[0].id;
    assert.deepEqual(db.table('products').find((p) => p.id === productId)?.images, ['https://cdn.example.com/vent.jpg']);
    const data = await ok(tokens['owner-agent'], 'get_business_data', { site_id: siteId });
    assert.equal(data.services.length, 2);
    assert.ok(data.bindableFields.products.price);

    await ok(tokens['owner-agent'], 'put_section', { site_id: siteId, key: 'service-list', name: 'Services', html: `<section><h2 data-ks="heading">Book a visit</h2>
      <ul data-ks-collection="services"><li data-ks-item><b data-ks-bind="name">Service</b> <i data-ks-bind="duration">1 hr</i> <span data-ks-if="price" data-ks-bind="price">$1</span>
      <a data-ks-action="book" href="/book">Book</a></li></ul></section>` });
    await ok(tokens['owner-agent'], 'put_section', { site_id: siteId, key: 'shop', name: 'Shop', html: `<section><h2 data-ks="heading">Shop</h2>
      <div data-ks-collection="products"><article data-ks-item><h3 data-ks-bind="name">P</h3><s data-ks-if="on_sale" data-ks-bind="compare_price">x</s>
      <b data-ks-bind="price">$1</b><button data-ks-action="add-to-cart">Add to cart</button></article></div></section>` });
    await ok(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'services', title: 'Services', seo: { description: 'Book us' }, sections: [{ section: 'service-list', id: 'svc' }, { section: 'shop', id: 'shop' }] });

    const bundle = await loadDraftBundle(db as never, siteId);
    const page = bundle!.pages.find((p) => p.slug === 'services')!;
    const kinds = collectionsIn(pageSectionHtmls(bundle!, page));
    assert.deepEqual([...kinds].sort(), ['products', 'services']);
    const collections = await fetchCollections(db as never, siteId, kinds);
    const html = renderPage(bundle!, page, { mode: 'published', siteUrl: 'https://northline.kswd.ca', collections }).html;
    assert.match(html, /<b>Roof inspection<\/b> <i>1 hr<\/i>\s*<a data-ks-action="book" href="\/book\?service=/);
    assert.match(html, /<b>Leak repair<\/b> <i>2 hr<\/i> <span>\$250.00<\/span>/);
    assert.match(html, /<s>\$60.00<\/s>\s*<b>\$49.00<\/b>/);
    assert.match(html, new RegExp(`data-ks-product="[^"]*${productId}`));
    assert.match(html, /"@type":"Service"/, 'services become structured data');
    const report = await ok(tokens['owner-agent'], 'validate', { site_id: siteId });
    assert.equal(report.ok, true, JSON.stringify(report.errors));
  });

  let releaseId = '';
  await step('publish freezes a release; later draft edits do not leak to the live site', async () => {
    const pub = await ok(tokens['owner-agent'], 'publish', { site_id: siteId, subdomain: 'northline' });
    assert.equal(pub.publicUrl, 'https://northline.kswd.ca');
    releaseId = pub.releaseId;
    const site = await loadSiteRow(db as never, siteId);
    assert.equal(site?.is_published, true);
    assert.equal(site?.v2_release_id, releaseId);
    await ok(tokens['owner-agent'], 'set_content', { site_id: siteId, changes: [{ instance: 'home-services', path: 'heading', value: 'Draft-only heading' }] });
    const live = await loadRelease(db as never, releaseId);
    const liveHtml = renderPage(live!, findPageByPath(live!, '/')!, { mode: 'published', siteUrl: 'https://northline.kswd.ca' }).html;
    assert.doesNotMatch(liveHtml, /Draft-only heading/);
    assert.match(liveHtml, /<link rel="canonical" href="https:\/\/northline.kswd.ca\/">/);
  });

  await step('publish is blocked by validation errors', async () => {
    await ok(tokens['owner-agent'], 'put_section', { site_id: siteId, key: 'broken', html: '<section><h2>Not editable</h2></section>' });
    await ok(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'broken', sections: [{ section: 'broken' }], seo: { description: 'x' } });
    const blocked = await tool(tokens['owner-agent'], 'publish', { site_id: siteId });
    assert.equal(blocked.isError, true);
    assert.match(blocked.data.error, /Fix \d+ error/);
    await ok(tokens['owner-agent'], 'delete_page', { site_id: siteId, slug: 'broken' });
    await ok(tokens['owner-agent'], 'delete_section', { site_id: siteId, key: 'broken' });
  });

  await step('versions: restore brings back an earlier draft', async () => {
    const versions = await ok(tokens['owner-agent'], 'list_versions', { site_id: siteId });
    assert.ok(versions.versions.length >= 3);
    const live = versions.versions.find((v: { isLive: boolean }) => v.isLive);
    assert.equal(live.id, releaseId);
    await ok(tokens['owner-agent'], 'restore_version', { site_id: siteId, version_id: releaseId });
    const bundle = await loadDraftBundle(db as never, siteId);
    assert.notEqual((bundle!.content['home-services']?.heading as { html: string } | undefined)?.html, 'Draft-only heading');
    assert.ok(bundle!.ownerEdited.includes('home-hero/title'), 'owner locks survive restore');
  });

  await step('preview links are signed and scoped to the site', async () => {
    const p = await ok(tokens['owner-agent'], 'preview', { site_id: siteId, path: '/contact' });
    const token = p.preview_url.match(/\/v2r\/draft\/([^/]+)\/contact$/)[1];
    const claims = await verifyDraftToken(token);
    assert.deepEqual(claims, { siteId, mode: 'preview' });
    assert.equal(await verifyDraftToken(token.slice(0, -2) + 'xx'), null);
  });

  await step('duplicate copies an agent-built site with its design and content', async () => {
    const copy = await duplicateSite(db as never, siteId, OWNER);
    assert.equal(copy.ok, true);
    const newId = (copy as { siteId: string }).siteId;
    const row = await loadSiteRow(db as never, newId);
    assert.equal(row?.engine, 'sections_v2');
    const bundle = await loadDraftBundle(db as never, newId);
    assert.equal(Object.keys(bundle!.sections).length, 7);
    const home = bundle!.pages.find((p) => p.slug === 'home')!;
    assert.equal(home.instances.length, 3);
    const html = renderPage(bundle!, home, { mode: 'published' }).html;
    assert.match(html, /Owner wrote <strong>this<\/strong>/);
  });

  await step('classic sites are exported read-only for redesigns', async () => {
    db.table('sites').push({ id: '44444444-4444-4444-4444-444444444444', user_id: OWNER, site_slug: 'Old Site', engine: 'blocks_v1', is_published: false, design_data: { siteTitle: 'Old Site' } });
    db.table('pages').push({ id: 'old-home', site_id: '44444444-4444-4444-4444-444444444444', slug: 'home', title: 'Home', display_name: 'Home', nav_order: 0, design_data: { blocks: [{ id: 'b1', type: 'hero', data: { title: 'Welcome to Old Site', subtitle: '<p>We fix things.</p>', bgImage: 'https://img.example.com/a.jpg', backgroundColor: '#fff' } }] } });
    const refused = await tool(tokens['owner-agent'], 'put_page', { site_id: '44444444-4444-4444-4444-444444444444', slug: 'home' });
    assert.match(refused.data.error, /classic/);
    const exported = await ok(tokens['owner-agent'], 'export_legacy_site', { site_id: '44444444-4444-4444-4444-444444444444' });
    const block = exported.pages[0].blocks[0];
    assert.ok(block.text.includes('Welcome to Old Site'));
    assert.ok(block.text.includes('We fix things.'));
    assert.deepEqual(block.images, [{ src: 'https://img.example.com/a.jpg' }]);
  });

  console.log(`\n${passed} passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
