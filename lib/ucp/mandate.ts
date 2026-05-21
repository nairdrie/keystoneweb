/**
 * AP2 (Agent Payments Protocol v2) mandate primitives.
 *
 * Three mandate types, signed in sequence by a UCP agent:
 *   - intent:  "the user wants a foo under $50, ships to Toronto"
 *   - cart:    "this exact cart, totalling $X, is what the agent committed to"
 *   - payment: "use this tokenized payment method to charge $X for that cart"
 *
 * The platform is the Merchant of Record — Google/OpenAI/Anthropic act as
 * plumbing. We MUST refuse to charge a different amount or different cart
 * than the agent signed for. To enforce this we:
 *
 *   1. Canonicalize the mandate payload (stable JSON, no whitespace, sorted
 *      keys), SHA-256 it.
 *   2. Sign the hash with HMAC-SHA256 over UCP_MANDATE_SECRET so we can
 *      verify any mandate without DB lookup if needed.
 *   3. Persist payload+hash+signature to ucp_mandates so we get a tamper
 *      audit trail and replay protection (unique index on payload_hash).
 *
 * In a future iteration the signing key will become an asymmetric key pair
 * (Ed25519) so the agent can verify *our* counter-signature too; the
 * `signatureAlg` field already accommodates that upgrade.
 */

import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { UcpCart, UcpMandate, UcpMoney } from './types';

const MANDATE_SECRET = () => {
  const s = process.env.UCP_MANDATE_SECRET;
  if (!s || s.length < 32) {
    // Lazy error: only thrown when a mandate is actually issued/verified,
    // so dev environments without the secret still boot.
    throw new Error('UCP_MANDATE_SECRET must be set (>=32 chars) to issue or verify UCP mandates');
  }
  return s;
};

export const MANDATE_PUBLIC_KEY_ID = 'ucp-hmac-v1';

/** Stable stringify — sorts object keys at every depth, no extra whitespace. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hmacHex(input: string): string {
  return createHmac('sha256', MANDATE_SECRET()).update(input).digest('hex');
}

export interface IssueMandateInput {
  type: 'intent' | 'cart' | 'payment';
  siteId: string;
  cartId?: string;
  agentId: string;
  agentSessionId?: string;
  cart?: UcpCart;
  intent?: { summary: string; constraints?: Record<string, unknown> };
  amount?: UcpMoney;
  paymentMethod?: { type: 'google_pay' | 'apple_pay' | 'card_token' | 'wallet_token'; token?: string };
  ttlSeconds?: number; // defaults to 15 min for payment, 1 day for intent/cart
}

export function issueMandate(input: IssueMandateInput): UcpMandate {
  const issuedAt = new Date();
  const defaultTtl = input.type === 'payment' ? 15 * 60 : 24 * 60 * 60;
  const expiresAt = new Date(issuedAt.getTime() + (input.ttlSeconds ?? defaultTtl) * 1000);

  const payload = {
    cart: input.cart,
    intent: input.intent,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    nonce: randomUUID(),
  };

  const payloadHash = sha256Hex(canonicalize(payload));
  const signature = hmacHex(payloadHash);

  return {
    id: randomUUID(),
    type: input.type,
    siteId: input.siteId,
    cartId: input.cartId,
    agentId: input.agentId,
    agentSessionId: input.agentSessionId,
    payload,
    payloadHash,
    signature,
    signatureAlg: 'HMAC-SHA256',
    status: 'issued',
  };
}

export interface VerifyMandateResult {
  ok: boolean;
  reason?: 'bad_signature' | 'expired' | 'amount_mismatch' | 'cart_mismatch' | 'wrong_site' | 'malformed';
  mandate?: UcpMandate;
}

export function verifyMandate(
  mandate: Pick<UcpMandate, 'payload' | 'payloadHash' | 'signature' | 'signatureAlg' | 'siteId'>,
  ctx: { siteId: string; expectedAmountCents?: number; expectedCartId?: string },
): VerifyMandateResult {
  try {
    if (mandate.signatureAlg !== 'HMAC-SHA256') return { ok: false, reason: 'malformed' };
    const recomputedHash = sha256Hex(canonicalize(mandate.payload));
    if (recomputedHash !== mandate.payloadHash) return { ok: false, reason: 'bad_signature' };
    const recomputedSig = hmacHex(mandate.payloadHash);
    if (recomputedSig !== mandate.signature) return { ok: false, reason: 'bad_signature' };
    if (mandate.siteId !== ctx.siteId) return { ok: false, reason: 'wrong_site' };
    if (new Date(mandate.payload.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'expired' };
    if (ctx.expectedAmountCents !== undefined && mandate.payload.amount) {
      if (mandate.payload.amount.amount !== ctx.expectedAmountCents) return { ok: false, reason: 'amount_mismatch' };
    }
    if (ctx.expectedCartId !== undefined && mandate.payload.cart) {
      if (mandate.payload.cart.id !== ctx.expectedCartId) return { ok: false, reason: 'cart_mismatch' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}
