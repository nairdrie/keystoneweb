/**
 * Shape of attribution required by Unsplash API Terms §9.
 *
 * Whenever an Unsplash photo is displayed in the rendered product (preview
 * or published), this object MUST be present alongside the URL so the UI
 * can render the credit caption ("Photo by {name} on Unsplash") with both
 * names linked and UTM-tagged per Unsplash brand requirements.
 */
export interface UnsplashAttribution {
    photographerName: string;
    photographerUrl: string;
    unsplashUrl: string;
}

/** Convenience tuple used by template helpers. */
export interface AttributedImage {
    url: string;
    attribution: UnsplashAttribution | null;
}
