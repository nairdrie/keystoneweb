import sanitizeHtml from 'sanitize-html';

const cssColor = [
    /^#[0-9a-f]{3,8}$/i,
    /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
    /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
    /^[a-z]+$/i,
];

export function sanitizeRichHtml(html: string): string {
    if (!html) return '';

    return sanitizeHtml(html, {
        allowedTags: [
            ...sanitizeHtml.defaults.allowedTags,
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'span',
            'u',
            's',
            'strike',
            'pre',
            'code',
            'br',
            'hr',
            'img',
        ],
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            '*': ['class', 'style', 'aria-label', 'aria-hidden'],
            a: ['href', 'name', 'target', 'rel', 'title'],
            img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
        },
        allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        allowedSchemesByTag: {
            img: ['http', 'https', 'data'],
        },
        allowedStyles: {
            '*': {
                color: cssColor,
                'background-color': cssColor,
                'text-align': [/^(left|right|center|justify)$/],
                'font-weight': [/^(normal|bold|[1-9]00)$/],
                'font-style': [/^(normal|italic)$/],
                'font-family': [/^[\w\s,'"-]+$/],
                'font-size': [/^\d+(\.\d+)?(px|rem|em|%)$/, /^(xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)$/],
                'text-shadow': [/^[\w\s,.()#%/-]+$/],
                'line-height': [/^\d+(\.\d+)?(px|rem|em|%)?$/],
                'letter-spacing': [/^-?\d+(\.\d+)?(px|rem|em)$/],
                'text-decoration': [/^[a-z\s-]+$/i],
                'text-indent': [/^-?\d+(\.\d+)?(px|rem|em|%)$/],
                'margin-left': [/^-?\d+(\.\d+)?(px|rem|em|%)$/],
                'margin-right': [/^-?\d+(\.\d+)?(px|rem|em|%)$/],
                'padding-left': [/^\d+(\.\d+)?(px|rem|em|%)$/],
                'padding-right': [/^\d+(\.\d+)?(px|rem|em|%)$/],
                'white-space': [/^(normal|nowrap|pre|pre-line|pre-wrap)$/],
            },
        },
    });
}
