/**
 * Shared types for the Universal Commerce Protocol (UCP) handler. These
 * intentionally mirror the open-source UCP primitives so a Gemini / A2A
 * agent built against the spec can interoperate with us without per-merchant
 * shims:
 *
 *   - Catalog primitives (UcpProduct, UcpVariant, UcpPriceTier)
 *   - Cart primitives (UcpCart, UcpCartItem, UcpCartTotals)
 *   - Quote primitive (UcpQuote)
 *   - Mandate primitive (UcpMandate) — AP2 envelope
 *   - Capability manifest (UcpManifest) — served at /.well-known/ucp.json
 *
 * Anything we add beyond the spec (e.g. `gateReason`, `aiAttributes`)
 * lives under additive optional fields so spec-strict consumers ignore them.
 */

export type UcpAgentId =
  | 'google-gemini'
  | 'google-shopping'
  | 'openai-operator'
  | 'openai-chatgpt'
  | 'anthropic-claude'
  | 'perplexity'
  | 'meta-ai'
  | 'microsoft-copilot'
  | 'unknown-bot'
  | 'browser'
  | string;

export type UcpSurface =
  | 'ucp_rest'
  | 'mcp'
  | 'a2a'
  | 'feed'
  | 'robots'
  | 'scrape'
  | 'checkout';

export interface UcpMoney {
  amount: number;        // integer minor units (cents)
  currency: string;      // ISO 4217 e.g. "USD"
}

export interface UcpProduct {
  id: string;
  sku?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  title: string;
  brand?: string | null;
  description?: string | null;
  url: string;
  images: string[];
  price: UcpMoney;
  compareAtPrice?: UcpMoney | null;
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'unavailable';
  inventoryCount?: number | null;
  condition: 'new' | 'refurbished' | 'used';
  category?: string | null;
  subcategory?: string | null;
  tags: string[];
  variants: Array<{ name: string; options: string[] }>;
  /** AI-readable conversational attributes (material, fit, socket, etc.). */
  aiAttributes: Record<string, string | number | boolean>;
  /** Whether the merchant has opted this listing into native_commerce. */
  nativeCommerce: boolean;
  /** Membership/B2B gate flag — agents should not attempt to purchase. */
  gated: boolean;
  gateReason?: 'guest' | 'wrong-tier' | 'unavailable' | null;
  shippingDimensions?: {
    weightGrams: number | null;
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
  } | null;
  updatedAt: string;
}

export interface UcpCartItem {
  productId: string;
  qty: number;
  variants?: Record<string, string>;
  options?: Record<string, string>;
  unitPriceCents: number;
  lineSubtotalCents: number;
  title?: string;
  imageUrl?: string;
}

export interface UcpCartTotals {
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
}

export interface UcpCart {
  id: string;
  siteId: string;
  currency: string;
  items: UcpCartItem[];
  totals: UcpCartTotals;
  shippingAddress?: UcpAddress | null;
  promoCodes: string[];
  status: 'open' | 'checking_out' | 'converted' | 'abandoned';
  expiresAt: string;
  updatedAt: string;
}

export interface UcpAddress {
  name?: string;
  email?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface UcpQuoteRequest {
  cartId?: string;
  items?: UcpCartItem[];
  shippingAddress?: UcpAddress;
  promoCodes?: string[];
}

export interface UcpQuote {
  cartId?: string;
  totals: UcpCartTotals;
  shippingOptions: Array<{
    id: string;
    label: string;
    amountCents: number;
    estDeliveryDays?: number | null;
  }>;
  promotions: Array<{
    code: string;
    label: string;
    discountCents: number;
  }>;
  taxBreakdown?: Array<{ label: string; amountCents: number }>;
  generatedAt: string;
}

/**
 * AP2 mandate envelope. The `payload` is canonicalized and SHA-256'd to
 * produce `payloadHash`; we sign that hash with the platform secret so the
 * checkout side can prove "this is the exact cart/intent the agent agreed
 * to charge". An agent compromised after issuance can't silently swap items.
 */
export interface UcpMandate {
  id: string;
  type: 'intent' | 'cart' | 'payment';
  siteId: string;
  cartId?: string;
  agentId: string;
  agentSessionId?: string;
  payload: {
    cart?: UcpCart;
    intent?: { summary: string; constraints?: Record<string, unknown> };
    amount?: UcpMoney;
    paymentMethod?: { type: 'google_pay' | 'apple_pay' | 'card_token' | 'wallet_token'; token?: string };
    issuedAt: string;
    expiresAt: string;
    nonce: string;
  };
  payloadHash: string;
  signature: string;
  signatureAlg: 'HMAC-SHA256';
  status: 'issued' | 'verified' | 'consumed' | 'revoked' | 'expired';
}

export interface UcpManifest {
  protocol: 'UCP';
  version: '0.1';
  merchantOfRecord: { name: string; siteId: string; legalEntity?: string | null };
  capabilities: {
    rest: boolean;
    mcp: boolean;
    a2a: boolean;
    ap2: boolean;
    nativeCommerce: boolean;
    realtimePrice: boolean;
    promotions: boolean;
    shippingQuotes: boolean;
    taxQuotes: boolean;
    googlePay: boolean;
  };
  endpoints: {
    products: string;
    product: string;
    cart: string;
    quote: string;
    checkout: string;
    mandate: string;
    promotions: string;
    mcp: string;
    a2a: string;
    feed: string;
  };
  supportedCurrencies: string[];
  signature: {
    algorithm: 'HMAC-SHA256';
    publicKeyId: string;
  };
}
