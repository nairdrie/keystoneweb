import Stripe from 'stripe';
import { htmlToPlainText } from '@/lib/email/sanitize';

import {
    DEFAULT_CONNECT_COUNTRY,
    isConnectCountry,
    type ConnectCountry,
} from './stripe-connect-countries';

export { CONNECT_COUNTRIES, isConnectCountry, type ConnectCountry } from './stripe-connect-countries';

/** Requested country if valid, else the site's business-profile country if supported, else Canada. */
export function resolveConnectCountry(requested: unknown, businessProfile: unknown): ConnectCountry {
    if (isConnectCountry(requested)) return requested;
    const profileCountry = (businessProfile as { addressCountry?: unknown } | null)?.addressCountry;
    const upper = typeof profileCountry === 'string' ? profileCountry.toUpperCase() : null;
    return isConnectCountry(upper) ? upper : DEFAULT_CONNECT_COUNTRY;
}

/** Public business details Stripe shows customers (checkout page, receipts, card statement). */
export function publicBusinessProfile(site: {
    design_data?: unknown;
    site_slug?: string | null;
    custom_domain?: string | null;
    published_domain?: string | null;
}): Stripe.AccountCreateParams.BusinessProfile | undefined {
    const rawTitle = (site.design_data as { siteTitle?: unknown } | null)?.siteTitle;
    const name = htmlToPlainText(typeof rawTitle === 'string' ? rawTitle : '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
    const domain = site.custom_domain || site.published_domain;
    const profile: Stripe.AccountCreateParams.BusinessProfile = {};
    if (name) profile.name = name;
    if (domain) profile.url = `https://${domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}`;
    return Object.keys(profile).length ? profile : undefined;
}

/**
 * Returns a Connect account id to send through onboarding, creating one if
 * needed. If an existing account never finished onboarding and the owner now
 * explicitly asks for a different country, the stale account is deleted and
 * replaced: its country cannot be changed in place.
 */
export async function ensureConnectAccount(
    stripe: Stripe,
    opts: {
        existingAccountId: string | null;
        /** Only set when the owner explicitly chose a country. */
        requestedCountry: ConnectCountry | null;
        fallbackCountry: ConnectCountry;
        email?: string | null;
        businessProfile?: Stripe.AccountCreateParams.BusinessProfile;
        metadata: Record<string, string>;
    },
): Promise<{ accountId: string; created: boolean }> {
    if (opts.existingAccountId) {
        let existing: Stripe.Account | null = null;
        try {
            existing = await stripe.accounts.retrieve(opts.existingAccountId);
        } catch (err) {
            // Account deleted on Stripe's side (or no longer ours): create a new one.
            const e = err as { code?: string; statusCode?: number };
            if (e.code !== 'account_invalid' && e.statusCode !== 404 && e.statusCode !== 403) throw err;
        }
        if (existing && !(existing as { deleted?: boolean }).deleted) {
            const wrongCountry = opts.requestedCountry && existing.country !== opts.requestedCountry;
            if (!wrongCountry || existing.details_submitted) {
                return { accountId: existing.id, created: false };
            }
            try {
                await stripe.accounts.del(existing.id);
            } catch (err) {
                // Not fatal: the new account replaces it in our DB either way.
                console.warn('Could not delete unfinished Stripe account', existing.id, err);
            }
        }
    }

    const params: Stripe.AccountCreateParams = {
        type: 'express',
        country: opts.requestedCountry || opts.fallbackCountry,
        email: opts.email || undefined,
        capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
        },
        // business_type is left unset so the owner picks individual / company in onboarding.
        metadata: opts.metadata,
    };
    let account: Stripe.Account;
    try {
        account = await stripe.accounts.create({ ...params, business_profile: opts.businessProfile });
    } catch (err) {
        // A prefill Stripe rejects (e.g. a URL it won't accept) shouldn't block onboarding.
        if (!opts.businessProfile || (err as { type?: string }).type !== 'StripeInvalidRequestError') throw err;
        account = await stripe.accounts.create(params);
    }
    return { accountId: account.id, created: true };
}

/** Owner-facing status of a connected account, for the admin panels. */
export async function getConnectStatus(stripe: Stripe, accountId: string | null) {
    if (!accountId) return { connected: false, onboarded: false, country: null as string | null };
    try {
        const account = await stripe.accounts.retrieve(accountId);
        return {
            connected: true,
            onboarded: !!account.details_submitted,
            country: account.country || null,
        };
    } catch {
        return { connected: false, onboarded: false, country: null as string | null };
    }
}

let platformCountry: Promise<string | null> | null = null;

/** The platform (Keystone) Stripe account's country, cached per process. */
export function getPlatformCountry(stripe: Stripe): Promise<string | null> {
    if (!platformCountry) {
        platformCountry = stripe.accounts
            .retrieveCurrent()
            .then(a => a.country || null)
            .catch(() => {
                platformCountry = null;
                return null;
            });
    }
    return platformCountry;
}
