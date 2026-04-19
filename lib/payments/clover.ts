/**
 * Clover (Fiserv) payment integration helpers.
 *
 * We use Hosted Checkout (redirect flow): simplest, SAQ A compliant, handles all card UI on Clover's side.
 *   1. Server: createCheckoutSession() → { href, checkoutSessionId } (15 min expiration)
 *   2. Client: window.location.href = href
 *   3. Customer pays on Clover's hosted page
 *   4. Clover redirects back to the merchant-dashboard-configured return URL
 *   5. Clover fires a webhook to the configured URL with the payment result
 */

import crypto from 'crypto';

export interface CloverCredentials {
    merchantId: string;
    privateToken: string;
    sandboxMode?: boolean;
}

function apiBase(sandboxMode: boolean) {
    return sandboxMode
        ? 'https://apisandbox.dev.clover.com'
        : 'https://api.clover.com';
}

export interface CloverLineItem {
    name: string;
    price: number;        // cents
    unitQty: number;
    note?: string;
}

export interface CloverCheckoutParams {
    customer: {
        email: string;
        firstName?: string;
        lastName?: string;
        phoneNumber?: string;
    };
    lineItems: CloverLineItem[];
    shippingCents?: number;  // added as an extra line item if non-zero
    tipsEnabled?: boolean;
}

export interface CloverCheckoutSession {
    href: string;
    checkoutSessionId: string;
    createdTime: number;
    expirationTime: number;
}

/**
 * Create a Clover Hosted Checkout session.
 */
export async function createCheckoutSession(
    creds: CloverCredentials,
    params: CloverCheckoutParams
): Promise<CloverCheckoutSession> {
    const lineItems = [...params.lineItems];

    // Fold shipping into a synthetic line item if present
    if (params.shippingCents && params.shippingCents > 0) {
        lineItems.push({
            name: 'Shipping',
            price: params.shippingCents,
            unitQty: 1,
        });
    }

    const body = {
        customer: params.customer,
        shoppingCart: {
            lineItems: lineItems.map(i => ({
                name: i.name,
                price: i.price,
                unitQty: i.unitQty,
                ...(i.note ? { note: i.note } : {}),
            })),
        },
        ...(params.tipsEnabled !== undefined ? { tips: { enabled: params.tipsEnabled } } : {}),
    };

    const url = `${apiBase(!!creds.sandboxMode)}/invoicingcheckoutservice/v1/checkouts`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'X-Clover-Merchant-Id': creds.merchantId,
            'Authorization': `Bearer ${creds.privateToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Clover checkout session error (${res.status}): ${text}`);
    }

    const data = await res.json();
    if (!data.href || !data.checkoutSessionId) {
        throw new Error('Clover checkout session response missing href/checkoutSessionId');
    }
    return data as CloverCheckoutSession;
}

/**
 * Verify a Clover webhook signature.
 * Clover signs with header: Clover-Signature: t=<timestamp>,v1=<hex>
 * HMAC-SHA256(secret, `${t}.${rawBody}`) must equal v1.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
    if (!signatureHeader) return false;
    const parts: Record<string, string> = {};
    for (const segment of signatureHeader.split(',')) {
        const [k, v] = segment.split('=');
        if (k && v) parts[k.trim()] = v.trim();
    }
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) return false;

    const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
    } catch {
        return false;
    }
}

export function hasValidCloverCredentials(vendor: any): boolean {
    return !!(vendor?.clover_merchant_id && vendor?.clover_private_token);
}
