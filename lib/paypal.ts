/**
 * PayPal REST helper — bring-your-own-credentials model.
 *
 * Each site stores its own PayPal REST app Client ID + Secret (see the
 * `sites.paypal_client_id` / `paypal_secret` / `paypal_sandbox_mode` columns).
 * Orders are created and captured with the site owner's own OAuth token, so the
 * owner is the merchant of record, funds settle straight to their PayPal
 * account, and they pay PayPal's fees / own refunds. No Partner approval or
 * `payee` / `PayPal-Auth-Assertion` plumbing is required.
 *
 * The platform-level env credentials below are used ONLY by the webhook
 * signature verifier (an optional reconciliation safety net); they are not
 * needed for the core checkout flow.
 */
import { createAdminClient } from './db/supabase-admin';

const PLATFORM_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PLATFORM_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PLATFORM_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
const PLATFORM_API_BASE =
  process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com';

const LIVE_API_BASE = 'https://api-m.paypal.com';
const SANDBOX_API_BASE = 'https://api-m.sandbox.paypal.com';

// ── Per-site credentials ──────────────────────────────────────────────────
export type PaypalCreds = {
  clientId: string;
  secret: string;
  sandbox: boolean;
};

export function apiBaseFor(sandbox: boolean): string {
  return sandbox ? SANDBOX_API_BASE : LIVE_API_BASE;
}

/**
 * Load a site's PayPal credentials (including the secret) via the admin client.
 * Returns null if the site hasn't connected PayPal. NEVER expose the secret to
 * the browser — call this only from server routes.
 */
export async function getSitePaypalCreds(
  siteId: string
): Promise<PaypalCreds | null> {
  const db = createAdminClient();
  const { data } = await db
    .from('sites')
    .select('paypal_client_id, paypal_secret, paypal_sandbox_mode')
    .eq('id', siteId)
    .single();

  if (!data?.paypal_client_id || !data?.paypal_secret) return null;
  return {
    clientId: data.paypal_client_id,
    secret: data.paypal_secret,
    sandbox: !!data.paypal_sandbox_mode,
  };
}

// ── OAuth access-token (client-credentials) with per-credential cache ──────
const tokenCache: Record<
  string,
  { access_token: string; expires_at: number }
> = {};

async function fetchAccessToken(
  base: string,
  clientId: string,
  secret: string
): Promise<string> {
  const cacheKey = `${base}|${clientId}`;
  const cached = tokenCache[cacheKey];
  if (cached && cached.expires_at - 60_000 > Date.now()) {
    return cached.access_token;
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  tokenCache[cacheKey] = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export function getAccessToken(creds: PaypalCreds): Promise<string> {
  return fetchAccessToken(apiBaseFor(creds.sandbox), creds.clientId, creds.secret);
}

// ── Orders ────────────────────────────────────────────────────────────────
export type PaypalMoney = { currency_code: string; value: string };

export type PaypalItem = {
  name: string;
  quantity: string;
  unit_amount: PaypalMoney;
  description?: string;
  sku?: string;
};

type CreateOrderParams = {
  currency: string; // ISO 4217
  items: PaypalItem[];
  shippingCents?: number;
  taxCents?: number;
  customId: string; // our internal order/booking id
  description?: string;
  returnUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
};

/**
 * Convert cents -> string formatted to 2 decimal places. PayPal Orders v2
 * requires two-decimal strings for currencies that have minor units.
 */
function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function sumItemsCents(items: PaypalItem[]): number {
  return items.reduce((sum, it) => {
    const qty = parseInt(it.quantity, 10) || 0;
    const unit = Math.round(parseFloat(it.unit_amount.value) * 100);
    return sum + qty * unit;
  }, 0);
}

export async function createOrder(
  creds: PaypalCreds,
  params: CreateOrderParams
): Promise<{ id: string; status: string; raw: any }> {
  const token = await getAccessToken(creds);
  const currency = (params.currency || 'USD').toUpperCase();

  const itemTotalCents = sumItemsCents(params.items);
  const shippingCents = params.shippingCents || 0;
  const taxCents = params.taxCents || 0;
  const totalCents = itemTotalCents + shippingCents + taxCents;

  const breakdown: any = {
    item_total: { currency_code: currency, value: centsToAmount(itemTotalCents) },
  };
  if (shippingCents > 0) {
    breakdown.shipping = {
      currency_code: currency,
      value: centsToAmount(shippingCents),
    };
  }
  if (taxCents > 0) {
    breakdown.tax_total = {
      currency_code: currency,
      value: centsToAmount(taxCents),
    };
  }

  const body: any = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: params.customId,
        custom_id: params.customId,
        invoice_id: `${params.customId}-${Date.now()}`,
        description: params.description,
        amount: {
          currency_code: currency,
          value: centsToAmount(totalCents),
          breakdown,
        },
        items: params.items,
      },
    ],
    application_context: {
      shipping_preference: 'NO_SHIPPING', // keep UX in our app; no PayPal collection
      user_action: 'PAY_NOW',
      ...(params.returnUrl ? { return_url: params.returnUrl } : {}),
      ...(params.cancelUrl ? { cancel_url: params.cancelUrl } : {}),
    },
  };

  if (params.customerEmail) {
    body.payment_source = {
      paypal: {
        experience_context: body.application_context,
        email_address: params.customerEmail,
      },
    };
  }

  const res = await fetch(`${apiBaseFor(creds.sandbox)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create-order failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return { id: data.id, status: data.status, raw: data };
}

export async function captureOrder(
  creds: PaypalCreds,
  paypalOrderId: string
): Promise<{
  id: string;
  status: string;
  captureId: string | null;
  amountCents: number;
  currency: string;
  raw: any;
}> {
  const token = await getAccessToken(creds);

  const res = await fetch(
    `${apiBaseFor(creds.sandbox)}/v2/checkout/orders/${encodeURIComponent(
      paypalOrderId
    )}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    }
  );

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    throw new Error(
      `PayPal capture-order failed (${res.status}): ${JSON.stringify(data)}`
    );
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  const amountCents = capture?.amount?.value
    ? Math.round(parseFloat(capture.amount.value) * 100)
    : 0;
  const currency = capture?.amount?.currency_code || 'USD';

  return {
    id: data.id,
    status: data.status,
    captureId: capture?.id || null,
    amountCents,
    currency,
    raw: data,
  };
}

// ── Webhook signature verification (optional reconciliation safety net) ────
export async function verifyWebhookSignature(params: {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  rawBody: string;
}): Promise<boolean> {
  if (!PLATFORM_WEBHOOK_ID || !PLATFORM_CLIENT_ID || !PLATFORM_CLIENT_SECRET) {
    return false;
  }

  const token = await fetchAccessToken(
    PLATFORM_API_BASE,
    PLATFORM_CLIENT_ID,
    PLATFORM_CLIENT_SECRET
  );
  const res = await fetch(
    `${PLATFORM_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: params.authAlgo,
        cert_url: params.certUrl,
        transmission_id: params.transmissionId,
        transmission_sig: params.transmissionSig,
        transmission_time: params.transmissionTime,
        webhook_id: PLATFORM_WEBHOOK_ID,
        webhook_event: JSON.parse(params.rawBody),
      }),
    }
  );

  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === 'SUCCESS';
}

// ── Transaction log helper (parallel to recordStripeTransaction) ────────
export async function recordPaypalTransaction(data: {
  paypal_event_id: string;
  paypal_merchant_id?: string | null;
  paypal_order_id?: string | null;
  paypal_capture_id?: string | null;
  site_id?: string | null;
  user_id?: string | null;
  event_type: string;
  transaction_type: string;
  description?: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  metadata?: Record<string, any>;
}) {
  try {
    const db = createAdminClient();
    const { error } = await db.from('paypal_transactions').upsert(data, {
      onConflict: 'paypal_event_id',
      ignoreDuplicates: true,
    });
    if (error) {
      console.error('Failed to record paypal transaction:', error);
    }
  } catch (err) {
    console.error('Error recording paypal transaction:', err);
  }
}
