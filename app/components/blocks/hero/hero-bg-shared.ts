/**
 * Shared types and helpers for Hero block animated/static backgrounds.
 *
 * Both animations and patterns expose:
 *   - a list of named "color slots" (e.g. "Glow", "Highlight", "Base")
 *   - default tokens for each slot, drawn from palette:primary/secondary/accent
 *
 * The renderer resolves the tokens (or hex codes) into real hex strings
 * and passes the array down to the component, indexed by slot order. This
 * keeps the components agnostic of the palette plumbing and makes preview
 * thumbnails trivial to render with arbitrary colors.
 */

export interface ColorSlot {
    /** Human-readable label shown in the editor (e.g. "Glow"). */
    label: string;
    /** Default value: a palette token like "palette:primary" or a literal hex. */
    defaultToken: string;
}

export interface HeroBgVariantMeta<TId extends string> {
    id: TId;
    label: string;
    description: string;
    /** Ordered color slots. Components read colors[i] for slot i. */
    colorSlots: readonly ColorSlot[];
}

/** Mix two hex colors via CSS color-mix syntax with a transparency fallback. */
export function mix(color: string, percent: number, against: string = 'transparent'): string {
    const safe = color || '#000000';
    return `color-mix(in srgb, ${safe} ${percent}%, ${against})`;
}

/**
 * Resolve a single slot color from an optional override array, falling back
 * to the meta's default token via the supplied palette resolver.
 */
export function resolveSlotColors(
    slots: readonly ColorSlot[],
    overrides: readonly string[] | undefined,
    palette: Record<string, string | undefined>,
    resolve: (token: string, palette: Record<string, string | undefined>, fallback?: string) => string,
): string[] {
    return slots.map((slot, i) => {
        const raw = overrides?.[i] || slot.defaultToken;
        // Sensible final fallback so animations always have *something* drawable.
        return resolve(raw, palette, '#1f2937');
    });
}
