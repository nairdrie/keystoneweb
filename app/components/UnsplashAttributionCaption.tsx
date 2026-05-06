import type { CSSProperties } from 'react';
import type { UnsplashAttribution } from '@/lib/unsplash/types';
import { lookupAttributionForUrl } from '@/lib/unsplash/attribution-map';

interface Props {
    /** Explicit attribution (e.g. captured from the picker). Takes precedence. */
    attribution?: UnsplashAttribution | null;
    /** URL fallback — if attribution is missing, try the static map by URL. */
    imageUrl?: string | null;
    /**
     * Defaults to "absolute" so the caption pins to the bottom-right of the
     * nearest positioned ancestor. Set to "static" if the parent already
     * provides explicit positioning.
     */
    position?: 'absolute' | 'static';
    /** Optional class merged into the wrapper (e.g. to nudge offsets). */
    className?: string;
    style?: CSSProperties;
}

/**
 * Renders the Unsplash credit caption ("Photo by {name} on Unsplash") with
 * both names linked and UTM-tagged, per Unsplash API Terms §9.
 *
 * Returns null when no attribution can be resolved — i.e., the image is not
 * from Unsplash, or it is from Unsplash but the static attribution map has
 * not yet been populated. Either way, no uncredited Unsplash caption is
 * ever rendered.
 */
export default function UnsplashAttributionCaption({
    attribution,
    imageUrl,
    position = 'absolute',
    className = '',
    style,
}: Props) {
    const resolved = attribution ?? lookupAttributionForUrl(imageUrl);
    if (!resolved) return null;

    const positionClass =
        position === 'absolute'
            ? 'absolute bottom-1 right-1 z-30 max-w-[calc(100%-0.5rem)]'
            : '';

    return (
        <div
            className={`pointer-events-auto rounded bg-black/70 px-2 py-1 text-right text-[10px] leading-tight text-white shadow ${positionClass} ${className}`}
            style={style}
        >
            Photo by{' '}
            <a
                href={resolved.photographerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                onClick={(e) => e.stopPropagation()}
            >
                {resolved.photographerName}
            </a>
            {' on '}
            <a
                href={resolved.unsplashUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                onClick={(e) => e.stopPropagation()}
            >
                Unsplash
            </a>
        </div>
    );
}
