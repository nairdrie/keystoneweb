import React from 'react';

/** Strip {{highlight}} syntax to plain text — use for <title>, alt text, etc. */
export function stripHighlight(text: string): string {
    return text.replace(/\{\{(.*?)\}\}/g, '$1').replace(/\\n|\n/g, ' ');
}

/** Parse {{highlight}} syntax into React nodes with ksw-highlight spans */
export function renderSiteTitle(text: string): React.ReactNode {
    const parts = text.split(/(\{\{.*?\}\})/g);
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
        part.startsWith('{{') && part.endsWith('}}')
            ? <span key={i} className="ksw-highlight">{part.slice(2, -2)}</span>
            : part
    );
}

/** Parse siteTitle__styles JSON into React.CSSProperties */
export function parseSiteTitleStyles(styleData?: string | Record<string, any>): React.CSSProperties {
    if (!styleData) return {};
    try {
        const s = typeof styleData === 'string' ? JSON.parse(styleData) : styleData;
        return {
            ...(s.fontFamily ? { fontFamily: `"${s.fontFamily}", sans-serif` } : {}),
            ...(s.fontSize   ? { fontSize:   s.fontSize   } : {}),
            ...(s.color      ? { color:       s.color      } : {}),
            ...(s.fontWeight ? { fontWeight:  s.fontWeight } : {}),
        };
    } catch { return {}; }
}
