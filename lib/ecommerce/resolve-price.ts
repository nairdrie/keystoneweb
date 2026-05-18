/**
 * Single source of truth for mapping a product row + the viewing member
 * to the price they can be charged and whether they're allowed to purchase.
 *
 * Pure function — no I/O. Callers are responsible for providing the
 * product row (from DB) and the authenticated member (from the member cookie).
 *
 * Security invariants:
 *   - The member price is always clamped to <= the public price, so a
 *     misconfigured tier can never charge a member more than a guest.
 *   - If `allowed_package_ids` is non-empty, only members whose packageId
 *     is in that list can purchase.
 */

export interface TierPriceEntry {
  packageId: string;
  priceCents: number;
}

/**
 * A required, price-modifying selection on a product (e.g. "Quantity:
 * Single | Case of 24"). Distinct from `variants` which are equal-priced
 * choices like Size or Colour.
 */
export interface ProductOptionValue {
  label: string;
  priceModifierCents: number;
}

export interface ProductOptionGroup {
  name: string;
  values: ProductOptionValue[];
  defaultIndex: number;
}

export interface ProductPricingRow {
  price_cents: number;
  tier_prices?: unknown;
  allowed_package_ids?: unknown;
  options?: unknown;
}

export interface PricingMember {
  packageId: string | null | undefined;
}

export type GateReason = 'guest' | 'wrong-tier' | 'unavailable' | null;

export interface ResolvedProductAccess {
  priceCents: number;
  publicPriceCents: number;
  matchedPackageId: string | null;
  canPurchase: boolean;
  gateReason: GateReason;
}

function parseTierPrices(raw: unknown): TierPriceEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: TierPriceEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const packageId = (entry as any).packageId;
    const priceCents = (entry as any).priceCents;
    if (typeof packageId === 'string' && typeof priceCents === 'number' && Number.isFinite(priceCents) && priceCents >= 0) {
      out.push({ packageId, priceCents: Math.round(priceCents) });
    }
  }
  return out;
}

function parseAllowedPackageIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

export function parseProductOptions(raw: unknown): ProductOptionGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductOptionGroup[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const name = (entry as any).name;
    const values = (entry as any).values;
    if (typeof name !== 'string' || !name.trim()) continue;
    if (!Array.isArray(values) || values.length === 0) continue;
    const cleanValues: ProductOptionValue[] = [];
    for (const v of values) {
      if (!v || typeof v !== 'object') continue;
      const label = (v as any).label;
      const mod = (v as any).priceModifierCents;
      if (typeof label !== 'string' || !label.trim()) continue;
      const modNum = Number.isFinite(mod) ? Math.max(0, Math.round(Number(mod))) : 0;
      cleanValues.push({ label: label.trim(), priceModifierCents: modNum });
    }
    if (cleanValues.length === 0) continue;
    let defaultIndex = Number((entry as any).defaultIndex);
    if (!Number.isInteger(defaultIndex) || defaultIndex < 0 || defaultIndex >= cleanValues.length) {
      defaultIndex = 0;
    }
    out.push({ name: name.trim(), values: cleanValues, defaultIndex });
  }
  return out;
}

/**
 * Given a product's option groups and the customer's selected labels (by
 * group name), return the total cents to add to the unit price. Unknown
 * groups are ignored; missing selections fall back to the default value's
 * modifier so the price always lands in a deterministic state.
 */
export function resolveOptionPriceModifierCents(
  options: ProductOptionGroup[],
  selected: Record<string, string> | null | undefined,
): number {
  let total = 0;
  for (const group of options) {
    const sel = selected?.[group.name];
    let value: ProductOptionValue | undefined;
    if (sel) value = group.values.find(v => v.label === sel);
    if (!value) value = group.values[group.defaultIndex] || group.values[0];
    if (value) total += value.priceModifierCents;
  }
  return total;
}

export function resolveProductAccess(
  product: ProductPricingRow,
  member: PricingMember | null | undefined,
): ResolvedProductAccess {
  const publicPriceCents = Math.max(0, Math.round(product.price_cents ?? 0));
  const tierPrices = parseTierPrices(product.tier_prices);
  const allowedPackageIds = parseAllowedPackageIds(product.allowed_package_ids);
  const memberPackageId = member?.packageId ?? null;

  let canPurchase = true;
  let gateReason: GateReason = null;
  if (allowedPackageIds.length > 0) {
    if (!memberPackageId) {
      canPurchase = false;
      gateReason = 'guest';
    } else if (!allowedPackageIds.includes(memberPackageId)) {
      canPurchase = false;
      gateReason = 'wrong-tier';
    }
  }

  let priceCents = publicPriceCents;
  let matchedPackageId: string | null = null;
  if (memberPackageId) {
    const match = tierPrices.find(t => t.packageId === memberPackageId);
    if (match) {
      // Clamp: members never pay more than a guest would.
      priceCents = Math.min(match.priceCents, publicPriceCents);
      matchedPackageId = match.packageId;
    }
  }

  return { priceCents, publicPriceCents, matchedPackageId, canPurchase, gateReason };
}
