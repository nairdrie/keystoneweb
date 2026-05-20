/**
 * Cart packing algorithm.
 *
 * Given a cart of items (each with dims + weight) and a catalog of merchant-
 * defined boxes, generate one candidate packing plan per box size that can
 * actually hold the items. Callers (the rate-quote and order-create routes)
 * then quote each candidate with Shippo and pick the cheapest plan per
 * carrier service. The chosen plan persists on the order so the merchant
 * knows exactly how to pack.
 *
 * Approximations used (matching Shopify's documented heuristics):
 *   - "Fits" = item's longest edge ≤ box's longest edge (loose 1-D check;
 *     true 3-D bin packing is NP-hard and rarely changes the outcome for
 *     typical e-commerce carts).
 *   - Capacity per box = box volume × PACKING_EFFICIENCY (0.80).
 *   - We never split an item across parcels.
 *   - ships_alone items always get their own parcel (one per unit), even if
 *     they would otherwise fit alongside other items.
 */

import type { PackagingBox, PackingPlan, PlanParcel } from '@/lib/shipping-data';
import type { ShippoParcel } from '@/lib/shipping/shippo';

/** Industry-standard estimate — items rarely pack to 100 % of a box's volume. */
const PACKING_EFFICIENCY = 0.80;

export interface PackerItem {
    productId: string;
    name: string;
    qty: number;
    weight_grams: number;
    length_mm: number;
    width_mm: number;
    height_mm: number;
    ships_alone?: boolean;
}

/** Sort items longest-edge descending — first-fit-decreasing variant. */
function longestEdge(it: { length_mm: number; width_mm: number; height_mm: number }): number {
    return Math.max(it.length_mm, it.width_mm, it.height_mm);
}

function boxLongestEdge(b: PackagingBox): number {
    return Math.max(b.length_mm, b.width_mm, b.height_mm);
}

function itemVolume(it: { length_mm: number; width_mm: number; height_mm: number }): number {
    return it.length_mm * it.width_mm * it.height_mm;
}

function boxVolume(b: PackagingBox): number {
    return b.length_mm * b.width_mm * b.height_mm;
}

/** True if `item` could conceivably go into `box` on its own. */
function itemFitsBox(item: PackerItem, box: PackagingBox): boolean {
    return longestEdge(item) <= boxLongestEdge(box)
        && itemVolume(item) <= boxVolume(box) * PACKING_EFFICIENCY
        && item.weight_grams <= box.max_payload_grams;
}

/** Smallest box (by volume) that can hold one unit of the item. */
function smallestFittingBox(item: PackerItem, boxes: PackagingBox[]): PackagingBox | null {
    const sorted = [...boxes].sort((a, b) => boxVolume(a) - boxVolume(b));
    return sorted.find(b => itemFitsBox(item, b)) || null;
}

/**
 * Pack a list of (qty-expanded) items into copies of one chosen box using
 * first-fit-decreasing. Returns null if any item cannot fit the box at all.
 */
function packIntoBox(units: PackerItem[], box: PackagingBox): PlanParcel[] | null {
    // Each unit is one physical item; merge qty up-front so the packer never has
    // to think about quantities.
    const sorted = [...units].sort((a, b) => itemVolume(b) - itemVolume(a));
    if (sorted.some(u => !itemFitsBox(u, box))) return null;

    const usableVolume = boxVolume(box) * PACKING_EFFICIENCY;
    const parcels: Array<{ remainingVol: number; remainingWeight: number; items: PackerItem[] }> = [];

    for (const unit of sorted) {
        const fit = parcels.find(p =>
            p.remainingVol >= itemVolume(unit) && p.remainingWeight >= unit.weight_grams);
        if (fit) {
            fit.remainingVol -= itemVolume(unit);
            fit.remainingWeight -= unit.weight_grams;
            fit.items.push(unit);
        } else {
            parcels.push({
                remainingVol: usableVolume - itemVolume(unit),
                remainingWeight: box.max_payload_grams - unit.weight_grams,
                items: [unit],
            });
        }
    }

    return parcels.map(p => {
        // Collapse like items back into { productId, name, qty } lines.
        const lineMap = new Map<string, { productId: string; name: string; qty: number }>();
        for (const u of p.items) {
            const prev = lineMap.get(u.productId);
            if (prev) prev.qty += 1;
            else lineMap.set(u.productId, { productId: u.productId, name: u.name, qty: 1 });
        }
        const totalWeight = p.items.reduce((sum, u) => sum + u.weight_grams, 0) + box.tare_grams;
        return {
            box_id: box.id,
            box_name: box.name,
            length_mm: box.length_mm,
            width_mm: box.width_mm,
            height_mm: box.height_mm,
            weight_grams: totalWeight,
            items: Array.from(lineMap.values()),
        };
    });
}

/**
 * Build one parcel per ships_alone unit — using the smallest box that fits, or
 * the item's own dimensions if nothing in the catalog is large enough (think
 * yoga mat in a tube the merchant ships in its own packaging).
 */
function packShipsAlone(items: PackerItem[], boxes: PackagingBox[]): PlanParcel[] {
    const parcels: PlanParcel[] = [];
    for (const item of items) {
        for (let i = 0; i < item.qty; i++) {
            const box = smallestFittingBox(item, boxes);
            if (box) {
                parcels.push({
                    box_id: box.id,
                    box_name: box.name,
                    length_mm: box.length_mm,
                    width_mm: box.width_mm,
                    height_mm: box.height_mm,
                    weight_grams: item.weight_grams + box.tare_grams,
                    items: [{ productId: item.productId, name: item.name, qty: 1 }],
                });
            } else {
                // No box fits — ship the item in its own packaging using its
                // own dims. Tare is 0 (item *is* the parcel).
                parcels.push({
                    box_id: null,
                    box_name: 'Own packaging',
                    length_mm: item.length_mm,
                    width_mm: item.width_mm,
                    height_mm: item.height_mm,
                    weight_grams: item.weight_grams,
                    items: [{ productId: item.productId, name: item.name, qty: 1 }],
                });
            }
        }
    }
    return parcels;
}

/**
 * Expand items by qty into individual physical units so the bin packer can
 * place them one at a time.
 */
function expand(items: PackerItem[]): PackerItem[] {
    const out: PackerItem[] = [];
    for (const it of items) {
        for (let i = 0; i < it.qty; i++) out.push({ ...it, qty: 1 });
    }
    return out;
}

/**
 * Generate candidate packing plans — one per box size in the catalog that can
 * hold every combinable item. ships_alone items get appended to every plan
 * (they're invariant across box choices). Returns an empty array if no plan
 * is feasible.
 */
export function generatePackingPlans(
    items: PackerItem[],
    boxes: PackagingBox[],
): PackingPlan[] {
    if (!Array.isArray(boxes) || boxes.length === 0) return [];

    const aloneItems = items.filter(i => i.ships_alone);
    const combinableItems = items.filter(i => !i.ships_alone);
    const aloneParcels = packShipsAlone(aloneItems, boxes);

    if (combinableItems.length === 0) {
        // Cart is entirely ships_alone items — single plan.
        return aloneParcels.length > 0 ? [{ parcels: aloneParcels }] : [];
    }

    const expanded = expand(combinableItems);
    const plans: PackingPlan[] = [];
    for (const box of boxes) {
        const combinedParcels = packIntoBox(expanded, box);
        if (!combinedParcels) continue;
        plans.push({ parcels: [...aloneParcels, ...combinedParcels] });
    }

    // De-duplicate plans that produce identical parcels (e.g. two box sizes
    // both produce one parcel of identical dims because of efficiency rounding).
    const seen = new Set<string>();
    return plans.filter(plan => {
        const key = JSON.stringify(plan.parcels.map(p => `${p.box_id}|${p.weight_grams}|${p.length_mm}x${p.width_mm}x${p.height_mm}`).sort());
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** Convert a packing plan to the parcels[] payload Shippo expects. */
export function planToShippoParcels(plan: PackingPlan): ShippoParcel[] {
    return plan.parcels.map(p => ({
        length: (p.length_mm / 10).toFixed(2),
        width: (p.width_mm / 10).toFixed(2),
        height: (p.height_mm / 10).toFixed(2),
        distance_unit: 'cm',
        weight: p.weight_grams.toFixed(0),
        mass_unit: 'g',
    }));
}
