/**
 * Keystone membership on agent-built sites.
 *
 * Keystone runs accounts, sign-in, sign-up (incl. paid packages through the
 * owner's Stripe), password resets and the member's account page, on hosted
 * pages in the site's own header/footer (/signin, /signup, /member,
 * /forgot-password). Agents design the marketing around it, mark pages and
 * sections members-only (enforced on the server, lib/v2/render.ts), and can
 * set up packages and the sign-up form. Owners manage members in Admin → Users.
 * Agents never see members' personal data, only counts.
 */
import type { OpsContext } from './ops';
import { OpError } from './ops';
import { loadDraftBundle, loadSiteRow } from './store';
import { effectiveAudience } from './render';
import { formatMoney } from './collections';
import { toPlainText } from './sanitize';
import { BILLING_INTERVALS, createStripePackagePrice, isPaidPackage, StripePackageError } from '@/lib/membership/stripe-packages';

type Json = Record<string, unknown>;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Hosted membership pages on every v2 site. */
export const MEMBER_PAGES = {
  '/signin': 'Sign in (password). Add ?returnTo=/path to come back to a page after signing in.',
  '/signup': 'Join: the sign-up form and package choice; paid packages go to Stripe checkout. /signup?package=<id> preselects one.',
  '/member': 'The member\'s account: profile, password, subscription (Stripe billing portal), data export, sign out.',
  '/forgot-password': 'Password reset by email.',
} as const;

const FIELD_TYPES = ['text', 'email', 'password', 'tel', 'number', 'date', 'url', 'textarea', 'select', 'multiselect', 'checkbox'] as const;

function describePackage(p: Row) {
  const paid = isPaidPackage(p.price_cents, p.billing_interval);
  const price = paid ? formatMoney(p.price_cents, p.currency || 'CAD') : '';
  const per = p.billing_interval === 'month' ? ' / month' : p.billing_interval === 'year' ? ' / year' : p.billing_interval === 'one_time' ? ' once' : '';
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    price: paid ? `${price}${per}` : 'Free',
    price_cents: p.price_cents || 0,
    currency: p.currency || 'CAD',
    billing_interval: p.billing_interval || 'free',
    trial_days: p.trial_days || 0,
    features: Array.isArray(p.features) ? p.features : [],
    active: p.is_active !== false,
    sort_order: p.sort_order ?? 0,
    signup_url: `/signup?package=${p.id}`,
    ...(paid && !p.stripe_price_id ? { warning: 'No Stripe price: members can\'t pay for this package. Recreate it after the owner connects Stripe.' } : {}),
  };
}

export async function opGetMembership(ctx: OpsContext) {
  const [site, settingsRes, packagesRes, membersRes, bundle] = await Promise.all([
    loadSiteRow(ctx.db, ctx.siteId),
    ctx.db.from('membership_settings').select('*').eq('site_id', ctx.siteId).maybeSingle(),
    ctx.db.from('membership_packages').select('*').eq('site_id', ctx.siteId).eq('is_archived', false).order('sort_order'),
    ctx.db.from('members').select('status').eq('site_id', ctx.siteId).eq('is_archived', false).limit(20000),
    loadDraftBundle(ctx.db, ctx.siteId),
  ]);
  const { data: stripeRow } = await ctx.db.from('sites').select('stripe_account_id').eq('id', ctx.siteId).maybeSingle();
  const settings = settingsRes.data as Row | null;
  const counts: Record<string, number> = {};
  for (const m of (membersRes.data || []) as Row[]) counts[m.status || 'unknown'] = (counts[m.status || 'unknown'] || 0) + 1;

  const pages = (bundle?.pages || []).map((p) => {
    const sections = p.instances.map((i) => ({ id: i.id, section: i.section, audience: effectiveAudience(p, i) }));
    const personal = !!p.access || sections.some((s) => s.audience !== 'everyone');
    return personal ? { slug: p.slug, access: p.access || null, sections } : null;
  }).filter(Boolean);

  return {
    configured: !!settings,
    stripeConnected: !!stripeRow?.stripe_account_id,
    settings: settings
      ? {
          require_email_verification: settings.require_email_verification !== false,
          notification_email: settings.notification_email || null,
          privacy_policy_url: settings.privacy_policy_url || null,
          marketing_opt_in_label: settings.marketing_opt_in_label || null,
          signup_form: settings.signup_form_fields || null,
        }
      : null,
    packages: ((packagesRes.data || []) as Row[]).map(describePackage),
    members: { total: (membersRes.data || []).length, byStatus: counts },
    gatedPages: pages,
    hostedPages: MEMBER_PAGES,
    liveSite: site?.is_published ? (site.custom_domain || (site.published_domain ? `${site.published_domain}.kswd.ca` : null)) : null,
    note: [
      'Members, payments and emails are managed by the owner in Admin → Users. You only see counts.',
      settings ? '' : 'Membership isn\'t set up yet: call configure_membership (sign-up form, email verification) and upsert_membership_packages.',
      stripeRow?.stripe_account_id ? '' : 'Stripe isn\'t connected, so only free packages can be created. The owner connects Stripe in Admin → Users → Packages.',
    ].filter(Boolean),
  };
}

export interface PackageInput {
  id?: string;
  name?: string;
  description?: string;
  price_cents?: number;
  currency?: string;
  billing_interval?: string;
  trial_days?: number;
  features?: string[];
  active?: boolean;
  sort_order?: number;
}

export async function opUpsertMembershipPackages(ctx: OpsContext, list: PackageInput[]) {
  if (!Array.isArray(list) || !list.length) throw new OpError('packages is required');
  if (list.length > 20) throw new OpError('At most 20 packages per call');
  const { data: site } = await ctx.db.from('sites').select('id, stripe_account_id').eq('id', ctx.siteId).maybeSingle();
  // A settings row turns membership on for the site (defaults: email verification on).
  await ctx.db.from('membership_settings').upsert({ site_id: ctx.siteId, is_enabled: true }, { onConflict: 'site_id', ignoreDuplicates: true });

  const results = [];
  for (const [i, p] of list.entries()) {
    const features = Array.isArray(p.features) ? p.features.map((f) => toPlainText(String(f)).slice(0, 200)).filter(Boolean).slice(0, 20) : undefined;
    const common: Json = {
      ...(p.name !== undefined ? { name: toPlainText(String(p.name)).slice(0, 120) } : {}),
      ...(p.description !== undefined ? { description: toPlainText(String(p.description)).slice(0, 2000) || null } : {}),
      ...(features ? { features } : {}),
      ...(p.active !== undefined ? { is_active: !!p.active } : {}),
      ...(p.sort_order !== undefined && Number.isFinite(Number(p.sort_order)) ? { sort_order: Number(p.sort_order) } : {}),
      ...(p.trial_days !== undefined ? { trial_days: Math.max(0, Math.min(365, Math.round(Number(p.trial_days) || 0))) } : {}),
    };

    if (p.id) {
      const { data: existing } = await ctx.db.from('membership_packages').select('*').eq('id', String(p.id)).eq('site_id', ctx.siteId).maybeSingle();
      if (!existing) throw new OpError(`packages[${i}]: package ${p.id} not found on this site`, 404);
      const priceChanged = (p.price_cents !== undefined && Math.round(Number(p.price_cents) || 0) !== (existing.price_cents || 0)) ||
        (p.billing_interval !== undefined && p.billing_interval !== existing.billing_interval);
      if (priceChanged) {
        throw new OpError(`packages[${i}]: a package's price and billing can't change (members may already pay it). Create a new package and set active: false on "${existing.name}".`);
      }
      if (common.name === '') throw new OpError(`packages[${i}].name can't be empty`);
      const { error } = await ctx.db.from('membership_packages').update({ ...common, updated_at: new Date().toISOString() }).eq('id', existing.id).eq('site_id', ctx.siteId);
      if (error) throw new OpError(`Could not update package ${existing.id}: ${error.message}`, 500);
      results.push({ id: existing.id, updated: true });
      continue;
    }

    const name = String(common.name || '');
    if (!name) throw new OpError(`packages[${i}].name is required`);
    const interval = String(p.billing_interval || ((Number(p.price_cents) || 0) > 0 ? 'year' : 'free'));
    if (!(BILLING_INTERVALS as string[]).includes(interval)) throw new OpError(`packages[${i}].billing_interval must be one of ${BILLING_INTERVALS.join(', ')}`);
    const priceCents = interval === 'free' ? 0 : Math.max(0, Math.round(Number(p.price_cents) || 0));
    const currency = /^[A-Z]{3}$/i.test(String(p.currency || '')) ? String(p.currency).toUpperCase() : 'CAD';
    let stripe: { stripeProductId: string | null; stripePriceId: string | null } = { stripeProductId: null, stripePriceId: null };
    if (isPaidPackage(priceCents, interval)) {
      try {
        stripe = await createStripePackagePrice({ stripeAccountId: site?.stripe_account_id, name, description: (common.description as string) || null, priceCents, currency, billingInterval: interval });
      } catch (e) {
        if (e instanceof StripePackageError) throw new OpError(`packages[${i}] "${name}": ${e.message}. The owner connects Stripe in Admin → Users → Packages; free packages work without it.`, e.status);
        throw e;
      }
    }
    const { data, error } = await ctx.db.from('membership_packages').insert({
      site_id: ctx.siteId,
      name,
      description: (common.description as string) || null,
      price_cents: priceCents,
      currency,
      billing_interval: priceCents ? interval : 'free',
      trial_days: (common.trial_days as number) || 0,
      features: features || [],
      sort_order: (common.sort_order as number) ?? i,
      is_active: p.active !== false,
      is_archived: false,
      stripe_product_id: stripe.stripeProductId,
      stripe_price_id: stripe.stripePriceId,
    }).select('id').single();
    if (error) throw new OpError(`Could not create package "${name}": ${error.message}`, 500);
    results.push({ id: data.id, created: true, signup_url: `/signup?package=${data.id}` });
  }
  return { packages: results };
}

export interface SignupFieldInput { key?: string; label?: string; type?: string; required?: boolean; options?: string[] }
export interface MembershipSettingsInput {
  require_email_verification?: boolean;
  notification_email?: string | null;
  privacy_policy_url?: string | null;
  marketing_opt_in_label?: string | null;
  signup_form?: Array<{ title?: string; fields?: SignupFieldInput[] }>;
}

/** Normalise sign-up form stages; email + password are always in the first stage. */
export function normalizeSignupForm(stages: Array<{ title?: string; fields?: SignupFieldInput[] }>) {
  if (!Array.isArray(stages) || !stages.length) throw new OpError('signup_form needs at least one stage');
  if (stages.length > 6) throw new OpError('signup_form: at most 6 stages');
  const seen = new Set<string>();
  const out = stages.map((stage, si) => {
    const fields = (Array.isArray(stage.fields) ? stage.fields : []).slice(0, 30).map((f, fi) => {
      const label = toPlainText(String(f.label || '')).slice(0, 120);
      const key = String(f.key || label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
      if (!key) throw new OpError(`signup_form[${si}].fields[${fi}] needs a key or label`);
      if (seen.has(key)) throw new OpError(`signup_form: field key "${key}" is used twice`);
      seen.add(key);
      const type = String(f.type || (key === 'email' ? 'email' : key === 'password' ? 'password' : 'text'));
      if (!(FIELD_TYPES as readonly string[]).includes(type)) throw new OpError(`signup_form field "${key}": type must be one of ${FIELD_TYPES.join(', ')}`);
      const options = Array.isArray(f.options) ? f.options.map((o) => toPlainText(String(o)).slice(0, 120)).filter(Boolean).slice(0, 100) : undefined;
      if ((type === 'select' || type === 'multiselect') && !options?.length) throw new OpError(`signup_form field "${key}" (${type}) needs options`);
      return { key, label: label || key, type, required: key === 'email' || key === 'password' ? true : !!f.required, ...(options?.length ? { options } : {}) };
    });
    return { id: `stage_${si + 1}`, title: toPlainText(String(stage.title || (si ? `Step ${si + 1}` : 'Account details'))).slice(0, 80), fields };
  });
  const first = out[0].fields;
  if (!seen.has('password')) first.unshift({ key: 'password', label: 'Password', type: 'password', required: true });
  if (!seen.has('email')) first.unshift({ key: 'email', label: 'Email', type: 'email', required: true });
  return { stages: out };
}

export async function opConfigureMembership(ctx: OpsContext, input: MembershipSettingsInput) {
  const row: Json = { site_id: ctx.siteId, is_enabled: true, updated_at: new Date().toISOString() };
  if (input.require_email_verification !== undefined) row.require_email_verification = !!input.require_email_verification;
  if (input.notification_email !== undefined) {
    const email = input.notification_email ? String(input.notification_email).trim() : '';
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new OpError('notification_email is not an email address');
    row.notification_email = email || null;
  }
  if (input.privacy_policy_url !== undefined) {
    const url = input.privacy_policy_url ? String(input.privacy_policy_url).trim() : '';
    if (url && !/^(https:\/\/|\/)/.test(url)) throw new OpError('privacy_policy_url must start with https:// or /');
    row.privacy_policy_url = url || null;
  }
  if (input.marketing_opt_in_label !== undefined) row.marketing_opt_in_label = input.marketing_opt_in_label ? toPlainText(String(input.marketing_opt_in_label)).slice(0, 200) : null;
  if (input.signup_form !== undefined) row.signup_form_fields = normalizeSignupForm(input.signup_form);
  const { error } = await ctx.db.from('membership_settings').upsert(row, { onConflict: 'site_id' });
  if (error) throw new OpError(`Could not save membership settings: ${error.message}`, 500);
  return { saved: Object.keys(row).filter((k) => k !== 'site_id' && k !== 'updated_at'), ...(row.signup_form_fields ? { signup_form: row.signup_form_fields } : {}) };
}
