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
    const titleParam = `${titleFont.replace(/ /g, '+')}:wght@${titleWeights}`;
    const bodyParam = `${bodyFont.replace(/ /g, '+')}:wght@${bodyWeights}`;
    const fontsHref = `https://fonts.googleapis.com/css2?family=${titleParam}&family=${bodyParam}&display=swap`;

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
