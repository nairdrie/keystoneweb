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
  const { PUBLISHED_ROOT } = await import('../lib/env/domain');
  const { getV2PublishStatus } = await import('../lib/v2/publish');

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
    const viaHeader = await handleMcpHttp(db as never, null, { jsonrpc: '2.0', id: 9, method: 'ping' }, tokens['owner-agent']);
    assert.equal(viaHeader.status, 200, 'X-Keystone-Token works as an alternative to Authorization');
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
  await step('sign in with OAuth: register, consent, PKCE code exchange, refresh rotation, disconnect', async () => {
    const oauth = await import('../lib/v2/oauth');
    const { createHash, randomBytes } = await import('node:crypto');
    const origin = 'https://keystoneweb.ca';

    // 401 points the AI app at the sign-in metadata.
    const unauth = await handleMcpHttp(db as never, null, { jsonrpc: '2.0', id: 1, method: 'ping' }, null, origin);
    assert.match(unauth.headers['WWW-Authenticate'], /resource_metadata="https:\/\/keystoneweb\.ca\/\.well-known\/oauth-protected-resource\/api\/mcp"/);
    assert.equal(oauth.protectedResourceMetadata(origin).resource, `${origin}/api/mcp`);
    const asMeta = oauth.authorizationServerMetadata(origin);
    assert.deepEqual(asMeta.code_challenge_methods_supported, ['S256']);
    assert.equal(asMeta.client_id_metadata_document_supported, true);

    // Automatic registration: https or loopback redirect URIs only.
    await assert.rejects(oauth.registerClient(db as never, { redirect_uris: ['http://evil.example/cb'] }), /https or loopback/);
    await assert.rejects(oauth.registerClient(db as never, { redirect_uris: ['javascript:alert(1)'] }));
    const reg = await oauth.registerClient(db as never, { client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] });
    assert.match(reg.client_id, /^ksc_/);
    // Client ID metadata documents must be public https URLs (no SSRF to internal hosts).
    await assert.rejects(oauth.getClient(db as never, 'https://127.0.0.1/client.json'), /public https/);
    await assert.rejects(oauth.getClient(db as never, 'https://localhost/client.json'), /public https/);

    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const params = (extra: Record<string, string> = {}) => new URLSearchParams({
      client_id: reg.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', response_type: 'code',
      code_challenge: challenge, code_challenge_method: 'S256', state: 'st8', resource: `${origin}/api/mcp`, ...extra,
    });
    await assert.rejects(oauth.validateAuthorizeRequest(db as never, params({ redirect_uri: 'https://attacker.example/cb' })), /not registered/);
    await assert.rejects(oauth.validateAuthorizeRequest(db as never, params({ code_challenge_method: 'plain' })), /S256/);
    await assert.rejects(oauth.validateAuthorizeRequest(db as never, params({ resource: `${origin}/api/other` })), /only issues tokens/);
    const req = await oauth.validateAuthorizeRequest(db as never, params());
    assert.deepEqual(req.scopes, ['sites:read', 'sites:write'], 'publishing is not granted unless the owner allows it');

    // Consent tickets bind the approval to the signed-in user and request.
    const ticket = await oauth.signConsentTicket(OWNER, params().toString());
    assert.deepEqual(await oauth.verifyConsentTicket(ticket), { userId: OWNER, query: params().toString() });
    assert.equal(await oauth.verifyConsentTicket(ticket.slice(0, -2) + 'xx'), null);

    // Code exchange: PKCE required, single use.
    const code = await oauth.createAuthorizationCode(db as never, req, OWNER, ['sites:read', 'sites:write']);
    const exchange = (extra: Record<string, string>) => oauth.exchangeToken(db as never, new URLSearchParams({ grant_type: 'authorization_code', code, client_id: reg.client_id, redirect_uri: req.redirectUri, ...extra }));
    await assert.rejects(exchange({ code_verifier: randomBytes(32).toString('base64url') }), /PKCE/);
    const issued = await exchange({ code_verifier: verifier });
    assert.match(issued.access_token, /^ks_oat_/);
    assert.match(issued.refresh_token, /^ks_ort_/);
    await assert.rejects(exchange({ code_verifier: verifier }), /invalid or expired|already used/);

    // The signed-in app can use the MCP server as the owner, without publish rights.
    const listed = await rpc(issued.access_token, 'tools/call', { name: 'list_sites', arguments: {} });
    assert.equal(listed.status, 200);
    assert.equal((listed.body as { result: { isError?: boolean } }).result.isError, undefined);
    const pub = await tool(issued.access_token, 'publish', { site_id: '00000000-0000-0000-0000-000000000000' });
    assert.equal(pub.isError, true);

    // Refresh tokens rotate; the old one stops working.
    const refreshed = await oauth.exchangeToken(db as never, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: issued.refresh_token, client_id: reg.client_id }));
    assert.notEqual(refreshed.refresh_token, issued.refresh_token);
    await assert.rejects(oauth.exchangeToken(db as never, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: issued.refresh_token })), /invalid or expired|already used/);

    // Expired access tokens are refused.
    const row = db.table('api_tokens').find((r) => r.token_hash === hashToken(issued.access_token))!;
    const keep = row.expires_at;
    row.expires_at = new Date(Date.now() - 1000).toISOString();
    assert.equal((await rpc(issued.access_token, 'ping')).status, 401);
    row.expires_at = keep;

    // Settings → Connected apps, then Disconnect revokes everything for that app.
    const apps = await oauth.listConnectedApps(db as never, OWNER);
    assert.equal(apps.length, 1);
    assert.equal(apps[0].name, 'Claude');
    assert.equal((await oauth.listConnectedApps(db as never, OTHER)).length, 0);
    await oauth.disconnectClient(db as never, OWNER, reg.client_id);
    assert.equal((await rpc(refreshed.access_token, 'ping')).status, 401);
    await assert.rejects(oauth.exchangeToken(db as never, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshed.refresh_token })), /invalid or expired/);
    assert.equal((await oauth.listConnectedApps(db as never, OWNER)).length, 0);
  });

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
    assert.equal(pub.publicUrl, `https://northline.${PUBLISHED_ROOT}`); // staging.kswd.ca on staging builds
    releaseId = pub.releaseId;
    const site = await loadSiteRow(db as never, siteId);
    assert.equal(site?.is_published, true);
    assert.equal(site?.v2_release_id, releaseId);
    // The editor's Publish button: nothing to publish right after publishing
    // (the release was frozen before the domain was set; that mustn't count)…
    assert.equal((await getV2PublishStatus(db as never, siteId)).hasUnpublishedChanges, false);
    await ok(tokens['owner-agent'], 'set_content', { site_id: siteId, changes: [{ instance: 'home-services', path: 'heading', value: 'Draft-only heading' }], force: true });
    // …and an agent edit over MCP makes it publishable again.
    assert.equal((await getV2PublishStatus(db as never, siteId)).hasUnpublishedChanges, true);
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
    // Back to exactly what's live (new revision numbers don't count as changes).
    assert.equal((await getV2PublishStatus(db as never, siteId)).hasUnpublishedChanges, false);
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

  await step('blog: owner and agent posts flow into the agent\'s own list and article designs', async () => {
    const { renderSitePath } = await import('../lib/v2/articles');
    const { featuresIn } = await import('../lib/v2/collections');
    // A post the owner wrote in Admin → Blog (same table and columns the admin API writes).
    db.table('blog_posts').push({
      id: 'owner-post', site_id: siteId, title: 'Spring roof checklist', slug: 'spring-roof-checklist', excerpt: 'Five things to check after winter.',
      content: '<h2>Gutters first</h2><p>Clear them <strong>early</strong>.</p><script>alert(1)</script><p onclick="x()">Then shingles.</p>',
      cover_image: 'https://cdn.example.com/spring.jpg', author: 'Dana', tags: ['Tips'], is_published: true, is_featured: false, is_archived: false,
      published_at: '2026-04-02T15:00:00Z', created_at: '2026-04-02T15:00:00Z', sort_order: 0,
    });

    // The agent imports two articles from the old site (one kept as a draft) and a duplicate title.
    const imported = await ok(tokens['owner-agent'], 'upsert_posts', { site_id: siteId, posts: [
      { title: 'We joined the Better Business Bureau', content: '<p>Proud members since 2024.</p><iframe src="https://evil.example"></iframe>', published_at: '2024-01-15', tags: ['Press', 'News'], author: 'Northline' },
      { title: 'Draft: winter prep', content: '<p>Not ready.</p>', publish: false },
      { title: 'We joined the Better Business Bureau', content: '<p>Copy.</p>', published_at: '2023-06-01' },
    ] });
    assert.deepEqual(imported.posts.map((p: { slug: string }) => p.slug), ['we-joined-the-better-business-bureau', 'draft-winter-prep', 'we-joined-the-better-business-bureau-2']);
    const stored = db.table('blog_posts').find((r) => r.slug === 'we-joined-the-better-business-bureau')!;
    assert.equal(stored.published_at, '2024-01-15T12:00:00.000Z', 'imported date kept');
    assert.doesNotMatch(String(stored.content), /iframe/, 'agent HTML is sanitized on the way in');
    assert.equal(stored.is_published, true);
    assert.equal(db.table('blog_posts').find((r) => r.slug === 'draft-winter-prep')!.is_published, false);
    const other = await tool(tokens.other, 'upsert_posts', { site_id: siteId, posts: [{ title: 'Spam' }] });
    assert.equal(other.isError, true, 'other users cannot post to this site');

    let data = await ok(tokens['owner-agent'], 'get_business_data', { site_id: siteId });
    assert.equal(data.posts.length, 4);
    assert.equal(data.blog.articleLayoutPage, null);
    assert.match(data.blog.note, /plain article page/);
    assert.ok('content' in data.bindableFields.post);

    // The agent designs a news page and an article layout — its own markup and styling.
    await ok(tokens['owner-agent'], 'put_section', { site_id: siteId, key: 'news-grid', name: 'News grid', html: `<section class="news"><h2 data-ks="heading">From the blog</h2>
      <div class="cards" data-ks-collection="posts"><a class="card" data-ks-item data-ks-bind="url" href="/blog/x"><time data-ks-bind="date">Jan 1</time><h3 data-ks-bind="title">Sample</h3><p data-ks-bind="excerpt">Sample</p></a>
      <p data-ks-empty data-ks="empty">Articles coming soon.</p></div></section>` });
    await ok(tokens['owner-agent'], 'put_section', { site_id: siteId, key: 'article', name: 'Article', html: `<article class="post" data-ks-collection="post"><div data-ks-item>
      <p class="kicker"><span data-ks-bind="tag">Tips</span> · <time data-ks-bind="date">Jan 1</time></p><h1 data-ks-bind="title">Sample title</h1>
      <div class="prose" data-ks-bind="content"><p>Sample paragraph.</p></div></div></article>
      <aside class="more"><h2 data-ks="moreHeading">More stories</h2><ul data-ks-collection="posts" data-ks-filter="!current" data-ks-limit="3"><li data-ks-item><a data-ks-bind="url" href="/blog/x"><span data-ks-bind="title">Sample</span></a></li></ul></aside>` });
    await ok(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'news', title: 'News', seo: { description: 'News from Northline' }, sections: [{ section: 'news-grid', id: 'news-grid' }] });
    const before = await ok(tokens['owner-agent'], 'validate', { site_id: siteId });
    assert.ok(before.warnings.some((w: { rule: string }) => w.rule === 'article-layout'), 'nudged to design an article layout');
    const layout = await ok(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'article', title: 'Article', template: 'post', sections: [{ section: 'article', id: 'article-main' }] });
    assert.equal(layout.page.template, 'post');
    assert.equal((await tool(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'story', template: 'post' })).isError, true, 'one article layout per site');
    assert.equal((await tool(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'home', template: 'post' })).isError, true);
    const after = await ok(tokens['owner-agent'], 'validate', { site_id: siteId });
    assert.deepEqual(after.errors, []);
    assert.ok(!after.warnings.some((w: { rule: string; page?: string }) => w.rule === 'article-layout' || (w.page === 'article' && ['seo-description', 'h1'].includes(w.rule))), JSON.stringify(after.warnings));
    data = await ok(tokens['owner-agent'], 'get_business_data', { site_id: siteId });
    assert.equal(data.blog.articleLayoutPage, 'article');
    assert.equal(data.blog.postsListPage, 'news');

    // Admin shows the Blog tab for this site.
    const { data: sections } = await db.from('v2_sections').select('html').eq('site_id', siteId);
    assert.equal(featuresIn(((sections || []) as Array<{ html: string }>).map((x) => x.html)).blog, true);

    const pub = await ok(tokens['owner-agent'], 'publish', { site_id: siteId, subdomain: 'northline' });
    const live = (await loadRelease(db as never, pub.releaseId))!;
    const siteUrl = 'https://northline.kswd.ca';
    const render = (path: string, b = live, mode: 'published' | 'preview' = 'published') => renderSitePath(db as never, b, siteId, path, { mode, siteUrl: mode === 'published' ? siteUrl : undefined });

    const news = await render('/news');
    assert.equal(news.status, 200);
    const order = ['Spring roof checklist', 'We joined the Better Business Bureau', 'We joined'].map((t) => news.html.indexOf(t));
    assert.ok(order[0] > 0 && order[0] < order[1], 'newest first');
    assert.doesNotMatch(news.html, /Not ready|Draft: winter prep/, 'drafts are not listed');
    assert.match(news.html, /href="\/blog\/spring-roof-checklist"/);
    assert.match(news.html, /<time datetime="2026-04-02">April 2, 2026<\/time>/);
    assert.doesNotMatch(news.html, /href="\/article"/, 'the article layout is not in the menu');

    const article = await render('/blog/spring-roof-checklist');
    assert.equal(article.status, 200);
    assert.match(article.html, /<title>Spring roof checklist \| [^<]+<\/title>/);
    assert.match(article.html, /<meta name="description" content="Five things to check after winter.">/);
    assert.match(article.html, /<link rel="canonical" href="https:\/\/northline.kswd.ca\/blog\/spring-roof-checklist">/);
    assert.match(article.html, /<meta property="og:type" content="article">/);
    assert.match(article.html, /<meta property="og:image" content="https:\/\/cdn.example.com\/spring.jpg">/);
    assert.match(article.html, /"@type":"BlogPosting"/);
    assert.match(article.html, /<h1>Spring roof checklist<\/h1>/);
    assert.match(article.html, /<div class="prose"><h2>Gutters first<\/h2><p>Clear them <strong>early<\/strong>.<\/p><p>Then shingles.<\/p><\/div>/, 'owner HTML is sanitized on the way out');
    assert.match(article.html, /<span>Tips<\/span>/);
    const more = article.html.slice(article.html.indexOf('class="more"'));
    assert.doesNotMatch(more, /Spring roof checklist/, '!current leaves out the article being read');
    assert.match(more, /We joined the Better Business Bureau/);

    assert.equal((await render('/blog/draft-winter-prep')).status, 404, 'drafts are not public');
    assert.equal((await render('/blog/no-such-post')).status, 404);
    assert.equal((await render('/article')).status, 404, 'the layout is not a page of its own on the live site');
    const draftBundle = (await loadDraftBundle(db as never, siteId))!;
    const layoutPreview = await render('/article', draftBundle, 'preview');
    assert.equal(layoutPreview.status, 200, 'but the editor can open it');
    assert.match(layoutPreview.html, /<h1>Spring roof checklist<\/h1>/, 'showing the newest post');

    // New posts show up on the live site without republishing; updates keep the URL.
    await ok(tokens['owner-agent'], 'upsert_posts', { site_id: siteId, posts: [{ id: 'owner-post', featured: true }, { id: imported.posts[0].id, title: 'Renamed title', featured: true }] });
    assert.equal(db.table('blog_posts').filter((r) => r.site_id === siteId && r.is_featured).length, 1, 'one featured post');
    assert.equal(db.table('blog_posts').find((r) => r.id === imported.posts[0].id)!.slug, 'we-joined-the-better-business-bureau', 'URL unchanged');
    assert.match((await render('/news')).html, /Renamed title/);

    // Without an article layout, posts still open in Keystone's plain article page inside the site's header/footer.
    await ok(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'article', template: 'none' });
    const plain = await render('/blog/spring-roof-checklist', (await loadDraftBundle(db as never, siteId))!, 'preview');
    assert.equal(plain.status, 200);
    assert.match(plain.html, /class="ks-article"/);
    assert.match(plain.html, /<h1>Spring roof checklist<\/h1>/);
    assert.match(plain.html, /href="\/news">← News</);
    assert.match(plain.html, /<header/);
    await ok(tokens['owner-agent'], 'put_page', { site_id: siteId, slug: 'article', template: 'post' });
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
