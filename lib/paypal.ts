/**
 * PayPal Commerce Platform (Partner) REST helper.
 *
 * Platform (Keystone) = PayPal Partner. Each site owner connects their PayPal
 * business account via a Partner Referral; we then create checkout orders on
 * behalf of that owner using `payee.merchant_id` and the `PayPal-Auth-Assertion`
 * header so funds settle directly to the owner's PayPal account (owner is
 * merchant of record, owner pays PayPal fees, owner handles refunds).
 *
 * Mirrors the role of the Stripe Connect integration in app/api/stripe/*.
 */
import { createAdminClient } from './db/supabase-admin';

const PAYPAL_API_BASE =
  process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_PARTNER_MERCHANT_ID = process.env.PAYPAL_PARTNER_MERCHANT_ID || '';
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';

export function isPaypalConfigured() {
  return Boolean(
    PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET && PAYPAL_PARTNER_MERCHANT_ID
  );
}

// ── OAuth access-token (client-credentials) with in-memory cache ──────────
let cachedToken: { access_token: string; expires_at: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at - 60_000 > Date.now()) {
    return cachedToken.access_token;
  }

  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
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
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// ── PayPal-Auth-Assertion (unsigned JWT; PayPal accepts alg:none here) ────
export function buildAuthAssertion(merchantId: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' })
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iss: PAYPAL_CLIENT_ID, payer_id: merchantId })
  ).toString('base64url');
  return `${header}.${payload}.`;
}

// ── Partner Referrals: create a seller-onboarding link ────────────────────
type PartnerReferralParams = {
  siteId: string;
  returnUrl: string;
  email?: string;
  advancedCard?: boolean;
};

export async function createPartnerReferral(
  params: PartnerReferralParams
): Promise<string> {
  const token = await getAccessToken();

  const features = ['PAYMENT', 'REFUND'];
  const products: string[] = [];
  if (params.advancedCard) {
    features.push('ADVANCED_TRANSACTIONS_SEARCH', 'VAULT');
    products.push('PPCP');
  }

  const body: any = {
    tracking_id: params.siteId,
    operations: [
      {
        operation: 'API_INTEGRATION',
        api_integration_preference: {
          rest_api_integration: {
            integration_method: 'PAYPAL',
            integration_type: 'THIRD_PARTY',
            third_party_details: { features },
          },
        },
      },
    ],
    ...(products.length ? { products } : {}),
    legal_consents: [{ type: 'SHARE_DATA_CONSENT', granted: true }],
    partner_config_override: {
      return_url: params.returnUrl,
      return_url_description:
        'Return to your Keystone dashboard to finish connecting PayPal.',
    },
  };

  if (params.email) {
    body.email = params.email;
  }

  const res = await fetch(
    `${PAYPAL_API_BASE}/v2/customer/partner-referrals`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal partner-referrals failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const actionUrl = (data.links || []).find(
    (l: any) => l.rel === 'action_url'
  )?.href;
  if (!actionUrl) {
    throw new Error('PayPal partner-referrals returned no action_url');
  }
  return actionUrl as string;
}

// ── Merchant integration status ──────────────────────────────────────────
export type MerchantIntegrationStatus = {
  merchant_id: string;
  primary_email_confirmed: boolean;
  payments_receivable: boolean;
  oauth_integrations?: Array<{
    oauth_third_party?: Array<{ scopes?: string[] }>;
  }>;
  products?: Array<{ name: string; vetting_status?: string; capabilities?: string[] }>;
};

export async function getMerchantIntegrationStatus(
  merchantId: string
): Promise<MerchantIntegrationStatus> {
  const token = await getAccessToken();
  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/customer/partners/${PAYPAL_PARTNER_MERCHANT_ID}/merchant-integrations/${merchantId}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal merchant-status failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Orders: create ──────────────────────────────────────────────────────
export type PaypalMoney = { currency_code: string; value: string };

export type PaypalItem = {
  name: string;
  quantity: string;
  unit_amount: PaypalMoney;
  description?: string;
  sku?: string;
};

type CreateOrderParams = {
  merchantId: string;
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

export async function createOrder(params: CreateOrderParams): Promise<{
  id: string;
  status: string;
  raw: any;
}> {
  const token = await getAccessToken();
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
        payee: { merchant_id: params.merchantId },
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

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Auth-Assertion': buildAuthAssertion(params.merchantId),
      'PayPal-Partner-Attribution-Id': 'Keystone_SP_PPCP',
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

// ── Orders: capture ─────────────────────────────────────────────────────
export async function captureOrder(
  paypalOrderId: string,
  merchantId: string
): Promise<{ id: string; status: string; captureId: string | null; amountCents: number; currency: string; raw: any }> {
  const token = await getAccessToken();

  const res = await fetch(
    `${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Auth-Assertion': buildAuthAssertion(merchantId),
        'PayPal-Partner-Attribution-Id': 'Keystone_SP_PPCP',
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

// ── Webhook signature verification ──────────────────────────────────────
export async function verifyWebhookSignature(params: {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  rawBody: string;
}): Promise<boolean> {
  if (!PAYPAL_WEBHOOK_ID) return false;

  const token = await getAccessToken();
  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
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
        webhook_id: PAYPAL_WEBHOOK_ID,
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
