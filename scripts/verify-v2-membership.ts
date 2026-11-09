/**
 * Keystone membership on agent-built (v2) sites, against an in-memory database:
 * agents set up packages and the sign-up form over MCP, mark pages/sections
 * members-only, and the renderer serves members' content only to members.
 * Run: npm run test:v2
 */
import assert from 'node:assert/strict';

process.env.RESEND_API_KEY ||= 're_test_dummy';
process.env.KS_V2_PREVIEW_SECRET ||= 'test-secret';
process.env.MEMBER_JWT_SECRET ||= 'member-test-secret';
process.env.NEXT_PUBLIC_APP_URL ||= 'https://keystoneweb.ca';
delete process.env.STRIPE_SECRET_KEY;

async function main() {
  const { FakeSupabase } = await import('./fixtures/fake-supabase');
  const { SAMPLE_SECTIONS } = await import('./fixtures/v2-sample-site');
  const { handleMcpHttp } = await import('../lib/v2/mcp-server');
  const { hashToken } = await import('../lib/v2/api-tokens');
  const { loadDraftBundle } = await import('../lib/v2/store');
  const { renderPage, findPageByPath, pageIsPersonalized } = await import('../lib/v2/render');
  const { renderSitePath } = await import('../lib/v2/articles');
  const { featuresIn } = await import('../lib/v2/collections');
  const { evaluateAccess, resolveMemberVisitor, SIGNED_OUT } = await import('../lib/membership/access');
  const { signMemberToken, hashToken: hashMemberToken } = await import('../lib/membership/auth');

  const db = new FakeSupabase();
  const OWNER = '11111111-1111-1111-1111-111111111111';
  db.table('users').push({ id: OWNER, email: 'owner@example.com', is_admin: false, is_banned: false });
  db.table('user_subscriptions').push({ user_id: OWNER, subscription_status: 'active', subscription_plan: 'pro' });
  const token = `ks_pat_owner${'x'.repeat(30)}`;
  db.table('api_tokens').push({ id: 'tok-owner', name: 'owner', user_id: OWNER, token_hash: hashToken(token), scopes: ['sites:read', 'sites:write', 'sites:publish'], revoked_at: null, expires_at: null, last_used_at: null });

  let rpcId = 0;
  async function tool(name: string, args: Record<string, unknown>) {
    const res = await handleMcpHttp(db as never, `Bearer ${token}`, { jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } });
    const body = res.body as { result: { isError?: boolean; content: Array<{ text: string }> } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form tool JSON
    return { isError: !!body.result.isError, data: JSON.parse(body.result.content[0].text) as Record<string, any> };
  }
  async function ok(name: string, args: Record<string, unknown>) {
    const r = await tool(name, args);
    assert.equal(r.isError, false, `${name} failed: ${JSON.stringify(r.data)}`);
    return r.data;
  }

  let passed = 0;
  const step = async (label: string, fn: () => Promise<void>) => {
    await fn();
    passed++;
    console.log(`  ✓ ${label}`);
  };
  console.log('v2 membership');

  await step('access rule: active members only; packages and paid subscriptions respected', async () => {
    const m = { id: 'm1', site_id: 's', status: 'active', package_id: 'p-year', subscription_status: 'active' };
    const paid = { id: 'p-year', price_cents: 5000, billing_interval: 'year' };
    assert.equal(evaluateAccess(null, null).hasAccess, false);
    assert.equal(evaluateAccess(m, paid).hasAccess, true);
    assert.equal(evaluateAccess({ ...m, subscription_status: 'past_due' }, paid).hasAccess, true, 'past due keeps access while Stripe retries');
    assert.equal(evaluateAccess({ ...m, subscription_status: 'cancelled' }, paid).reason, 'unpaid', 'an ended subscription loses access');
    assert.equal(evaluateAccess({ ...m, subscription_status: 'none' }, paid).hasAccess, true, 'owner-assigned / imported memberships have no Stripe subscription');
    assert.equal(evaluateAccess({ ...m, status: 'pending' }, paid).reason, 'inactive');
    assert.equal(evaluateAccess({ ...m, status: 'guest' }, paid).reason, 'inactive');
    assert.equal(evaluateAccess({ ...m, status: 'cancelled' }, paid).signedIn, false);
    assert.equal(evaluateAccess({ ...m, is_archived: true }, paid).signedIn, false);
    assert.equal(evaluateAccess(m, paid, ['p-other']).reason, 'wrong-package');
    assert.equal(evaluateAccess(m, paid, ['p-other', 'p-year']).hasAccess, true);
    assert.equal(evaluateAccess({ ...m, package_id: null }, null).hasAccess, true, 'sites without packages: any active account is a member');
    assert.equal(evaluateAccess({ ...m, package_id: null }, null, null, { siteHasPackages: true }).reason, 'no-package', 'an account alone is not a membership');
    assert.equal(evaluateAccess({ ...m, package_id: null }, null, ['p-year']).reason, 'no-package');
  });

  await step('checkout: only the member being charged, only back to the same site', async () => {
    const { signCheckoutToken, verifyMemberToken, signMemberToken } = await import('../lib/membership/auth');
    const { isCheckoutAuthorized, sameHostUrl } = await import('../lib/membership/checkout-auth');
    const site = '55555555-5555-5555-5555-555555555555';
    const tok = await signCheckoutToken({ memberId: 'm1', siteId: site, packageId: 'p1' });
    assert.equal(await isCheckoutAuthorized({ siteId: site, memberId: 'm1', packageId: 'p1', checkoutToken: tok }), true);
    assert.equal(await isCheckoutAuthorized({ siteId: site, memberId: 'm2', packageId: 'p1', checkoutToken: tok }), false, 'another member');
    assert.equal(await isCheckoutAuthorized({ siteId: site, memberId: 'm1', packageId: 'p2', checkoutToken: tok }), false, 'another package');
    assert.equal(await isCheckoutAuthorized({ siteId: '66666666-6666-6666-6666-666666666666', memberId: 'm1', packageId: 'p1', checkoutToken: tok }), false, 'another site');
    assert.equal(await isCheckoutAuthorized({ siteId: site, memberId: 'm1', packageId: 'p1' }), false, 'no token, not signed in');
    assert.equal(await isCheckoutAuthorized({ siteId: site, memberId: 'm1', packageId: 'p9', sessionMemberId: 'm1' }), true, 'signed-in member pays for themself');
    assert.equal(await isCheckoutAuthorized({ siteId: site, memberId: 'm1', packageId: 'p1', sessionMemberId: 'm2' }), false);
    const session = await signMemberToken({ memberId: 'm1', siteId: site, email: 'a@b.c' });
    assert.equal(await isCheckoutAuthorized({ siteId: site, memberId: 'm1', packageId: 'p1', checkoutToken: session }), false, 'a session token is not a checkout token');
    assert.equal(await verifyMemberToken(tok, site), null, 'a checkout token is never a session');
    assert.equal(sameHostUrl('https://acme.kswd.ca/signin?verified=true', 'acme.kswd.ca'), 'https://acme.kswd.ca/signin?verified=true');
    assert.equal(sameHostUrl('https://evil.example/phish', 'acme.kswd.ca'), null);
    assert.equal(sameHostUrl('javascript:alert(1)', 'acme.kswd.ca'), null);
    assert.equal(sameHostUrl('/signin', 'acme.kswd.ca'), null);
  });

  let siteId = '';
  let freeId = '';
  await step('agent sets up membership: sign-up form and free packages; paid needs Stripe', async () => {
    siteId = (await ok('create_site', { name: 'Paediatric Nurses' })).site_id;
    const before = await ok('get_membership', { site_id: siteId });
    assert.equal(before.configured, false);
    assert.equal(before.stripeConnected, false);

    const cfg = await ok('configure_membership', {
      site_id: siteId,
      require_email_verification: true,
      notification_email: 'board@example.org',
      signup_form: [
        { title: 'About you', fields: [{ key: 'name', label: 'Full name', required: true }, { label: 'Province', type: 'select', options: ['ON', 'BC'] }] },
        { title: 'Your practice', fields: [{ label: 'Employer' }, { label: 'Nursing category', type: 'multiselect', options: ['RN', 'RPN', 'NP'] }] },
      ],
    });
    const stages = cfg.signup_form.stages;
    assert.deepEqual(stages[0].fields.map((f: { key: string }) => f.key), ['email', 'password', 'name', 'province'], 'email + password always first');
    assert.equal(stages[1].fields[1].key, 'nursing_category');
    const badForm = await tool('configure_membership', { site_id: siteId, signup_form: [{ fields: [{ label: 'Pick', type: 'select' }] }] });
    assert.equal(badForm.isError, true);
    assert.match(badForm.data.error, /needs options/);

    const created = await ok('upsert_membership_packages', {
      site_id: siteId,
      packages: [
        { name: 'Student', description: 'Full-time nursing students', features: ['Newsletter', 'Resource library'] },
        { name: 'Associate', billing_interval: 'free' },
      ],
    });
    assert.equal(created.packages.length, 2);
    freeId = created.packages[0].id;
    assert.equal(created.packages[0].signup_url, `/signup?package=${freeId}`);

    const paid = await tool('upsert_membership_packages', { site_id: siteId, packages: [{ name: 'Regular', price_cents: 9500, billing_interval: 'year' }] });
    assert.equal(paid.isError, true);
    assert.match(paid.data.error, /connect your Stripe/);

    const reprice = await tool('upsert_membership_packages', { site_id: siteId, packages: [{ id: freeId, price_cents: 2500 }] });
    assert.equal(reprice.isError, true);
    assert.match(reprice.data.error, /can't change/);
    await ok('upsert_membership_packages', { site_id: siteId, packages: [{ id: freeId, description: 'Students enrolled full-time' }] });

    const after = await ok('get_membership', { site_id: siteId });
    assert.equal(after.configured, true);
    assert.equal(after.settings.notification_email, 'board@example.org');
    assert.deepEqual(after.packages.map((p: { name: string; price: string }) => [p.name, p.price]), [['Student', 'Free'], ['Associate', 'Free']]);
    assert.ok(after.hostedPages['/signin'] && after.hostedPages['/member']);
  });

  const header = `<header class="bar">
  <a href="/" class="brand"><span data-ks="@site.name">Site</span></a>
  <nav><ul data-ks-nav><li><a href="/">Home</a></li></ul></nav>
  <div class="member">
    <a data-ks-show="guests" data-ks="join" href="/signup">Join</a>
    <a data-ks-show="guests" data-ks-action="signin" data-ks="signin" href="/signin">Sign in</a>
    <a data-ks-show="members" data-ks-action="account" href="/member"><span data-ks="hi">Hi</span> <span data-ks-member-field="first_name">member</span></a>
  </div>
</header>`;
  const panel = `<section class="gate"><h2 data-ks="title">Sign in to continue</h2><a data-ks="cta" data-ks-action="signin" href="/signin">Sign in</a></section>`;
  const library = `<section class="lib"><h2 data-ks="title">Members' resource library</h2><p data-ks="secret">The 2026 standards toolkit download.</p></section>`;

  await step('members-only page: put_page access + section audiences; guards on ids and the home page', async () => {
    for (const [key, html] of Object.entries({ ...SAMPLE_SECTIONS, header, panel, library })) {
      await ok('put_section', { site_id: siteId, key, name: key, html });
    }
    await ok('set_layout', { site_id: siteId, header: 'header', footer: 'footer' });
    await ok('put_page', { site_id: siteId, slug: 'home', title: 'Home', seo: { description: 'Home' }, sections: [{ section: 'hero', id: 'home-hero' }] });
    await ok('put_page', { site_id: siteId, slug: 'contact', title: 'Contact', seo: { description: 'Contact' }, sections: [{ section: 'contact', id: 'contact-form' }] });
    await ok('put_page', { site_id: siteId, slug: 'work', title: 'Work', seo: { description: 'Work' }, sections: [{ section: 'services', id: 'work-grid' }] });

    const home = await tool('put_page', { site_id: siteId, slug: 'home', access: { members: true } });
    assert.equal(home.isError, true);
    assert.match(home.data.error, /home page/);
    const unknown = await tool('put_page', { site_id: siteId, slug: 'members', access: { members: true, packages: ['00000000-0000-0000-0000-000000000000'] } });
    assert.equal(unknown.isError, true);
    assert.match(unknown.data.error, /Unknown membership package/);

    const page = await ok('put_page', {
      site_id: siteId,
      slug: 'members',
      title: 'Members',
      seo: { description: 'Member resources' },
      access: { members: true },
      sections: [
        { section: 'hero', id: 'members-hero', audience: 'everyone' },
        { section: 'library', id: 'members-library' },
        { section: 'panel', id: 'members-panel', audience: 'guests' },
      ],
    });
    assert.deepEqual(page.page.access, { members: true });
    const site = await ok('get_site', { site_id: siteId });
    const members = site.pages.find((p: { slug: string }) => p.slug === 'members');
    assert.deepEqual(members.access, { members: true });
    assert.deepEqual(members.sections.map((s: { audience?: string }) => s.audience ?? null), ['everyone', null, 'guests']);
    const bad = await tool('put_page', { site_id: siteId, slug: 'members', sections: [{ section: 'hero', audience: 'vips' }] });
    assert.equal(bad.isError, true);

    const report = await ok('validate', { site_id: siteId });
    assert.equal(report.ok, true, JSON.stringify(report.errors));
    const gm = await ok('get_membership', { site_id: siteId });
    assert.equal(gm.gatedPages[0].slug, 'members');
    assert.deepEqual(gm.gatedPages[0].sections.map((s: { audience: string }) => s.audience), ['everyone', 'members', 'guests']);
  });

  await step('the server sends members content only to members; guests get the guests sections', async () => {
    const bundle = (await loadDraftBundle(db as never, siteId))!;
    const page = findPageByPath(bundle, '/members')!;
    assert.equal(pageIsPersonalized(page), true);
    assert.equal(pageIsPersonalized(findPageByPath(bundle, '/')!), false);

    const guest = renderPage(bundle, page, { mode: 'published', visitor: SIGNED_OUT }).html;
    assert.doesNotMatch(guest, /standards toolkit/, 'members content never reaches guests');
    assert.match(guest, /Sign in to continue/);
    assert.match(guest, /Oakville|class="hero"/, 'the "everyone" hero shows to all');
    assert.match(guest, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(guest, /data-ks-show="members"/, 'member-state attributes survive publishing');
    assert.match(guest, /data-ks-member-field="first_name"/);
    assert.match(guest, /html:not\(\[data-ks-member="in"\]\) \[data-ks-show="members"\]/);

    const member = renderPage(bundle, page, { mode: 'published', visitor: { signedIn: true, hasAccess: true, reason: null } }).html;
    assert.match(member, /standards toolkit/);
    assert.doesNotMatch(member, /Sign in to continue/);

    // Drafts show both (the owner edits both); ?ks_view previews one side.
    const draft = renderPage(bundle, page, { mode: 'edit' }).html;
    assert.match(draft, /standards toolkit/);
    assert.match(draft, /Sign in to continue/);
    assert.match(draft, /data-ks-audience="guests"/);
    const asGuest = renderPage(bundle, page, { mode: 'preview', viewAs: 'guest' }).html;
    assert.doesNotMatch(asGuest, /standards toolkit/);
    assert.match(asGuest, /"viewAs":"guest"|&quot;viewAs&quot;:&quot;guest&quot;/);
  });

  await step('without a guests section Keystone shows its own panel, worded for the visitor', async () => {
    await ok('put_page', { site_id: siteId, slug: 'members', sections: [{ section: 'hero', id: 'members-hero', audience: 'everyone' }, { section: 'library', id: 'members-library' }] });
    const bundle = (await loadDraftBundle(db as never, siteId))!;
    const page = findPageByPath(bundle, '/members')!;
    const out = renderPage(bundle, page, { mode: 'published', visitor: SIGNED_OUT, path: '/members' }).html;
    assert.match(out, /data-ks-members-only/);
    assert.match(out, /href="\/signin\?returnTo=%2Fmembers"/);
    assert.doesNotMatch(out, /standards toolkit/);
    const wrong = renderPage(bundle, page, { mode: 'published', visitor: { signedIn: true, hasAccess: false, reason: 'wrong-package' } }).html;
    assert.match(wrong, /Not included in your membership/);
    const ok2 = renderPage(bundle, page, { mode: 'published', visitor: { signedIn: true, hasAccess: true, reason: null } }).html;
    assert.doesNotMatch(ok2, /data-ks-members-only/);
  });

  await step('renderSitePath resolves the member only for personalized pages, from a real session', async () => {
    const bundle = (await loadDraftBundle(db as never, siteId))!;
    let calls = 0;
    const resolve = async () => { calls++; return SIGNED_OUT; };
    const home = await renderSitePath(db as never, bundle, siteId, '/', { mode: 'published', resolveVisitor: resolve });
    assert.equal(home.personalized, false);
    assert.equal(calls, 0, 'public pages stay cacheable and never read the cookie');
    const gated = await renderSitePath(db as never, bundle, siteId, '/members', { mode: 'published', resolveVisitor: resolve });
    assert.equal(gated.personalized, true);
    assert.equal(calls, 1);

    // A real member session (same JWT + session row as /api/membership/signin).
    db.table('members').push({ id: 'mem-1', site_id: siteId, email: 'nurse@example.org', status: 'active', is_archived: false, package_id: freeId, subscription_status: 'none' });
    const jwt = await signMemberToken({ memberId: 'mem-1', siteId, email: 'nurse@example.org' });
    db.table('member_sessions').push({ id: 'sess-1', member_id: 'mem-1', site_id: siteId, token_hash: hashMemberToken(jwt), expires_at: new Date(Date.now() + 86400e3).toISOString() });
    const visitor = await resolveMemberVisitor(db as never, siteId, jwt, [freeId]);
    assert.equal(visitor.hasAccess, true);
    assert.equal((await resolveMemberVisitor(db as never, siteId, jwt, ['another-package'])).reason, 'wrong-package');
    assert.equal((await resolveMemberVisitor(db as never, siteId, jwt)).hasAccess, true, 'any-member page');
    // An account without a package (e.g. an abandoned paid checkout) on a site that has packages.
    db.table('members').push({ id: 'mem-2', site_id: siteId, email: 'nopkg@example.org', status: 'active', is_archived: false, package_id: null, subscription_status: 'none' });
    const jwt2 = await signMemberToken({ memberId: 'mem-2', siteId, email: 'nopkg@example.org' });
    db.table('member_sessions').push({ id: 'sess-2', member_id: 'mem-2', site_id: siteId, token_hash: hashMemberToken(jwt2), expires_at: new Date(Date.now() + 86400e3).toISOString() });
    assert.equal((await resolveMemberVisitor(db as never, siteId, jwt2)).reason, 'no-package');
    assert.equal((await resolveMemberVisitor(db as never, '99999999-9999-9999-9999-999999999999', jwt)).signedIn, false, 'a token for another site never counts');
    assert.equal((await resolveMemberVisitor(db as never, siteId, 'not-a-jwt')).signedIn, false);
    db.table('member_sessions').length = 0;
    assert.equal((await resolveMemberVisitor(db as never, siteId, jwt)).signedIn, false, 'signed-out sessions are revoked');

    const counts = await ok('get_membership', { site_id: siteId });
    assert.equal(counts.members.total, 2);
    assert.doesNotMatch(JSON.stringify(counts), /nurse@example\.org/, 'agents never see members\' personal data');
  });

  await step('validator: links to another site\'s sign-in are flagged; features detect membership', async () => {
    await ok('put_section', { site_id: siteId, key: 'oldlink', name: 'Old link', html: '<section><a data-ks="cta" href="https://oldsite.kswd.ca/signin">Sign in</a></section>' });
    await ok('put_page', { site_id: siteId, slug: 'join', title: 'Join', seo: { description: 'Join' }, sections: [{ section: 'oldlink', id: 'join-old' }] });
    const report = await ok('validate', { site_id: siteId });
    assert.ok(report.warnings.some((w: { rule: string; message: string }) => w.rule === 'member-link' && /Use \/signin/.test(w.message)), JSON.stringify(report.warnings));
    assert.equal(featuresIn([header]).membership, true);
    assert.equal(featuresIn(['<a href="/signup">Join</a>']).membership, true);
    assert.equal(featuresIn(['<a href="/contact">Contact</a>']).membership, undefined);

    await ok('put_page', { site_id: siteId, slug: 'members', access: null });
    const bundle = (await loadDraftBundle(db as never, siteId))!;
    const page = findPageByPath(bundle, '/members')!;
    assert.equal(page.access, undefined, 'access: null makes the page public again');
    assert.match(renderPage(bundle, page, { mode: 'published', visitor: SIGNED_OUT }).html, /standards toolkit/);
  });

  console.log(`\n${passed} passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
