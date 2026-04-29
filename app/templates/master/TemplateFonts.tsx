'use client';

interface TemplateFontsProps {
    titleFont: string;
    bodyFont: string;
    titleWeights: string;
    bodyWeights: string;
    fallback: 'sans-serif' | 'serif' | 'monospace';
}

/**
 * Loads Google Fonts for a template via <link rel="stylesheet"> instead of
 * @import inside an inline <style>. The @import variant is render-blocking
 * AND serially-discovered (the browser can't see the URL until after the
 * inline style is parsed). Using a real <link> lets the preload scanner
 * fetch the stylesheet in parallel with HTML parsing, and the preconnect
 * hints warm up the TLS handshake to fonts.gstatic.com so the actual font
 * files arrive sooner. React 19 hoists these tags into <head> automatically.
 */
export function TemplateFonts({
    titleFont,
    bodyFont,
    titleWeights,
    bodyWeights,
    fallback,
}: TemplateFontsProps) {
    const fontsHref = buildFontsHref(titleFont, titleWeights, bodyFont, bodyWeights);

    const typography = `
.template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6 {
    font-family: "${titleFont}", ${fallback} !important;
}
.template-wrapper .font-title {
    font-family: "${titleFont}", ${fallback};
}
`;

    return (
        <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={fontsHref} />
            <style dangerouslySetInnerHTML={{ __html: typography }} />
        </>
    );
}

function buildFontsHref(
    titleFont: string,
    titleWeights: string,
    bodyFont: string,
    bodyWeights: string,
): string {
    const families: string[] = [];
    if (titleFont === bodyFont) {
        // Same family — merge weights so Google Fonts returns a single @font-face set
        const merged = mergeWeights(titleWeights, bodyWeights);
        families.push(`${encodeFamily(titleFont)}:wght@${merged}`);
    } else {
        families.push(`${encodeFamily(titleFont)}:wght@${titleWeights}`);
        families.push(`${encodeFamily(bodyFont)}:wght@${bodyWeights}`);
    }
    return `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`;
}

function encodeFamily(name: string): string {
    return name.replace(/ /g, '+');
}

function mergeWeights(a: string, b: string): string {
    const set = new Set<number>();
    for (const w of `${a};${b}`.split(';')) {
        const n = Number(w);
        if (Number.isFinite(n) && n > 0) set.add(n);
    }
    return [...set].sort((x, y) => x - y).join(';');
}
