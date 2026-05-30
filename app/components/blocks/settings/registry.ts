import type {
    BlockSettingsSchema,
    ColorSettingsControl,
    RangeSettingsControl,
    SelectSettingsControl,
    SettingsControl,
    SettingsOption,
    SettingsSection,
    SettingsVisibility,
    TextSettingsControl,
    ToggleSettingsControl,
} from './schema';

type ChoiceFieldConfig = {
    key: string;
    label: string;
    defaultValue: string | number | boolean;
    options: SettingsOption[];
    visibleWhen?: SettingsVisibility;
};

type DisplayControlConfig =
    | (Omit<ToggleSettingsControl, 'id' | 'field' | 'visibleWhen'> & { key: string; visibleWhen?: SettingsVisibility })
    | (Omit<SelectSettingsControl, 'id' | 'field' | 'visibleWhen'> & { key: string; visibleWhen?: SettingsVisibility })
    | (Omit<RangeSettingsControl, 'id' | 'field' | 'visibleWhen'> & { key: string; visibleWhen?: SettingsVisibility })
    | (Omit<TextSettingsControl, 'id' | 'field' | 'visibleWhen'> & { key: string; visibleWhen?: SettingsVisibility });

const MEDIA_ASPECT_OPTIONS: SettingsOption[] = [
    { value: 'landscape', label: 'Landscape' },
    { value: 'square', label: 'Square' },
    { value: 'portrait', label: 'Portrait' },
    { value: 'wide', label: 'Wide' },
];

const MEDIA_TREATMENT_OPTIONS: SettingsOption[] = [
    { value: 'contained', label: 'Contained' },
    { value: 'fullBleed', label: 'Full bleed' },
    { value: 'framed', label: 'Framed' },
    { value: 'soft', label: 'Soft radius' },
    { value: 'circle', label: 'Circle' },
];

const TEXT_ALIGN_OPTIONS: SettingsOption[] = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
];

const CAROUSEL_LAYOUT_OPTIONS: SettingsOption[] = [
    { value: 'cards', label: 'Cards' },
    { value: 'slides', label: 'Split Slides' },
    { value: 'minimal', label: 'Minimal' },
];

const CAROUSEL_MEDIA_LAYOUT_OPTIONS: SettingsOption[] = [
    { value: 'stacked', label: 'Stacked' },
    { value: 'split', label: 'Side-by-side' },
    { value: 'fullBleed', label: 'Edge-to-edge' },
    { value: 'none', label: 'Hidden' },
];

const AUTOPLAY_VARIANTS = ['slides', 'minimal'];

const GENERIC_SCHEMA_TITLES: Record<string, string> = {
    text: 'Rich Text Paragraph Settings',
    image: 'Image Section Settings',
    custom_html: 'Custom HTML / Embed Settings',
    customHtml: 'Custom HTML / Embed Settings',
    customHTML: 'Custom HTML / Embed Settings',
    featuresList: 'Features / Why Us Settings',
    cta: 'Call to Action Settings',
    gallery: 'Image Gallery Settings',
    booking: 'Booking / Appointments Settings',
    contact_form: 'Contact Form Settings',
    contactForm: 'Contact Form Settings',
    logoCloud: 'Logo Cloud / Partners Settings',
    pricing: 'Pricing Table Settings',
    team: 'Team Members Settings',
    blog: 'Blog / News Settings',
    events: 'Events Settings',
    pdf: 'PDF Viewer Settings',
    resources: 'Resources Settings',
    deliveryLinks: 'Delivery App Links Settings',
    featuredQuote: 'Featured Quote Settings',
    chatSupport: 'Chat Support Settings',
    video: 'Video Embed Settings',
    socialFeed: 'Social Media Embeds Settings',
    tabBar: 'Tab Bar / Menu Bar Settings',
    userProfile: 'User Profile Settings',
    membershipGate: 'Membership Gate Settings',
};

const LEGACY_SCHEMA_TITLES: Record<string, string> = {
    aboutImageText: 'About (Image + Text) Settings',
    contact: 'Contact Info Settings',
    estimateForm: 'Estimate / Quote Form Settings',
    faq: 'FAQ Accordion Settings',
    hero: 'Hero Section Settings',
    map: 'Map Settings',
    menu: 'Menu Settings',
    productGrid: 'Product Catalog Settings',
    servicesGrid: 'Services Grid Settings',
    sideBySide: 'Side by Side Settings',
    stats: 'Stats / Numbers Settings',
    testimonials: 'Testimonials Settings',
    timeline: 'Timeline Settings',
};

const BLOCK_SUBTITLES: Record<string, string> = {
    gallery: 'Tune gallery behavior, image rhythm, and section styling.',
    team: 'Choose a team layout and control member details.',
    blog: 'Control the blog feed layout and visible metadata.',
    events: 'Choose which events appear and how they are sorted.',
    pdf: 'Configure viewer actions and custom CSS.',
    socialFeed: 'Lay out social embeds and adjust the block styling.',
    tabBar: 'Adjust tabs, alignment, colors, and custom CSS.',
};

const LAYOUT_FIELDS: Record<string, ChoiceFieldConfig[]> = {
    pricing: [
        {
            key: 'variant',
            label: 'Pricing layout',
            defaultValue: 'cards',
            options: [
                { value: 'cards', label: 'Pricing Cards' },
                { value: 'comparison', label: 'Comparison' },
                { value: 'simple', label: 'Simple List' },
            ],
        },
    ],
    logoCloud: [
        {
            key: 'variant',
            label: 'Logo layout',
            defaultValue: 'inline',
            options: [
                { value: 'inline', label: 'Inline Row' },
                { value: 'grid', label: 'Logo Grid' },
                { value: 'marquee', label: 'Marquee' },
            ],
        },
    ],
    featuredQuote: [
        {
            key: 'variant',
            label: 'Quote layout',
            defaultValue: 'centered',
            options: [
                { value: 'centered', label: 'Centered' },
                { value: 'split', label: 'Split' },
                { value: 'minimal', label: 'Minimal' },
                { value: 'essay', label: 'Essay' },
                { value: 'multiGrid', label: 'Multi-Person' },
            ],
        },
        {
            key: 'imagePosition',
            label: 'Image position',
            defaultValue: 'right',
            options: [
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
            ],
            visibleWhen: { field: 'variant', equals: 'split' },
        },
    ],
    video: [
        {
            key: 'variant',
            label: 'Video layout',
            defaultValue: 'contained',
            options: [
                { value: 'contained', label: 'Contained' },
                { value: 'fullWidth', label: 'Full Width' },
            ],
        },
    ],
    blog: [
        {
            key: 'layout',
            label: 'Blog layout',
            defaultValue: 'grid',
            options: [
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
                { value: 'magazine', label: 'Magazine' },
            ],
        },
    ],
    resources: [
        {
            key: 'variant',
            label: 'Resource layout',
            defaultValue: 'grid',
            options: [
                { value: 'grid', label: 'Card Grid' },
                { value: 'list', label: 'Document List' },
            ],
        },
    ],
    socialFeed: [
        {
            key: 'variant',
            label: 'Feed layout',
            defaultValue: 'grid',
            options: [
                { value: 'grid', label: 'Grid' },
                { value: 'single', label: 'Single Column' },
            ],
        },
    ],
    tabBar: [
        {
            key: 'tabAlign',
            label: 'Tab alignment',
            defaultValue: 'left',
            options: [
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
                { value: 'stretch', label: 'Stretch' },
            ],
        },
    ],
};

const STYLE_FIELDS: Record<string, ChoiceFieldConfig[]> = {
    gallery: [
        {
            key: 'frameStyle',
            label: 'Image frame',
            defaultValue: 'clean',
            options: [
                { value: 'clean', label: 'Clean' },
                { value: 'rounded', label: 'Rounded' },
                { value: 'gapless', label: 'Gapless' },
                { value: 'editorial', label: 'Editorial' },
                { value: 'poster', label: 'Poster' },
            ],
        },
        {
            key: 'mediaAspect',
            label: 'Image aspect ratio',
            defaultValue: 'square',
            options: MEDIA_ASPECT_OPTIONS,
        },
    ],
    tabBar: [
        {
            key: 'tabStyle',
            label: 'Tab style',
            defaultValue: 'underline',
            options: [
                { value: 'underline', label: 'Underline' },
                { value: 'pills', label: 'Pills' },
                { value: 'tabs', label: 'Tabs' },
                { value: 'buttons', label: 'Buttons' },
            ],
        },
    ],
    featuredQuote: [
        {
            key: 'textAlign',
            label: 'Text alignment',
            defaultValue: 'left',
            options: TEXT_ALIGN_OPTIONS,
        },
    ],
    image: [
        {
            key: 'mediaTreatment',
            label: 'Image frame',
            defaultValue: 'contained',
            options: MEDIA_TREATMENT_OPTIONS,
        },
    ],
};

const DISPLAY_CONTROLS: Record<string, DisplayControlConfig[]> = {
    gallery: [
        { kind: 'toggle', key: 'showLightboxNav', label: 'Show lightbox navigation', defaultValue: true },
        { kind: 'toggle', key: 'showLightboxThumbs', label: 'Show thumbnail strip', defaultValue: true },
        { kind: 'toggle', key: 'showSeeMore', label: 'Show "See More" button', defaultValue: false },
        { kind: 'toggle', key: 'autoScroll', label: 'Auto-scroll images', defaultValue: false },
        {
            kind: 'select',
            key: 'autoScrollRows',
            label: 'Auto-scroll rows',
            defaultValue: 2,
            visibleWhen: { field: 'autoScroll', equals: true },
            options: [
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
            ],
        },
    ],
    team: [
        { kind: 'toggle', key: 'showBio', label: 'Show descriptions', description: 'Show each member bio.', defaultValue: true },
    ],
    blog: [
        { kind: 'toggle', key: 'showAuthor', label: 'Show author', defaultValue: true },
        { kind: 'toggle', key: 'showDate', label: 'Show date', defaultValue: true },
        { kind: 'toggle', key: 'showTags', label: 'Show tags', defaultValue: true },
        { kind: 'toggle', key: 'showExcerpt', label: 'Show excerpt', defaultValue: true },
    ],
    events: [
        {
            kind: 'select',
            key: 'sortOrder',
            label: 'Sort order',
            defaultValue: 'desc',
            options: [
                { value: 'asc', label: 'Closest first' },
                { value: 'desc', label: 'Newest first' },
            ],
        },
        { kind: 'toggle', key: 'showPast', label: 'Show past events', defaultValue: false },
    ],
    pdf: [
        { kind: 'toggle', key: 'showDownload', label: 'Show download button', defaultValue: true },
        { kind: 'text', key: 'downloadLabel', label: 'Download label', defaultValue: 'Download PDF', placeholder: 'Download PDF' },
        { kind: 'url', key: 'pdfUrl', label: 'PDF URL', defaultValue: '', placeholder: 'https://example.com/file.pdf' },
    ],
    video: [
        { kind: 'url', key: 'videoUrl', label: 'Video URL', defaultValue: '', placeholder: 'YouTube, Vimeo, or direct video URL' },
    ],
    cta: [
        { kind: 'toggle', key: 'showPattern', label: 'Show background pattern', defaultValue: false },
    ],
    contact_form: [
        { kind: 'text', key: 'submitText', label: 'Submit button text', defaultValue: 'Send Message', placeholder: 'Send Message' },
        { kind: 'text', key: 'successMessage', label: 'Success message', defaultValue: 'Thank you for your message! We will get back to you shortly.' },
    ],
};

const FOREGROUND_COLOR_BLOCKS = new Set([
    'featuresList',
    'cta',
    'gallery',
    'contact_form',
    'contactForm',
    'logoCloud',
    'pricing',
    'team',
    'events',
    'resources',
    'deliveryLinks',
    'featuredQuote',
]);

const PRETEXT_BLOCKS = new Set([
    'featuresList',
    'cta',
    'gallery',
    'team',
    'pricing',
    'resources',
    'deliveryLinks',
]);

const COLUMN_BLOCKS = new Set([
    'gallery',
    'pricing',
    'team',
    'blog',
    'deliveryLinks',
    'events',
    'resources',
    'logoCloud',
    'socialFeed',
]);

const CARD_STYLE_BLOCKS = new Set([
    'contact_form',
    'contactForm',
    'featuresList',
    'pricing',
]);

export const carouselSettingsSchema: BlockSettingsSchema = {
    blockType: 'carousel',
    title: 'Content Carousel Settings',
    subtitle: 'Set carousel layout, motion, cards, media, and section styling.',
    sections: [
        {
            id: 'layout',
            title: 'Layout',
            controls: [
                { id: 'section-layout', kind: 'layout' },
                {
                    id: 'carousel-layout',
                    kind: 'select',
                    field: 'variant',
                    label: 'Carousel layout',
                    defaultValue: 'cards',
                    options: CAROUSEL_LAYOUT_OPTIONS,
                },
                {
                    id: 'cards-per-view',
                    kind: 'responsiveColumns',
                    label: 'Cards per view',
                    visibleWhen: { field: 'variant', equals: 'cards' },
                },
                {
                    id: 'card-media-layout',
                    kind: 'cardMediaLayout',
                    label: 'Media placement',
                    description: 'Controls where image or icon media appears inside each card.',
                    fallbackPreset: 'soft',
                    options: CAROUSEL_MEDIA_LAYOUT_OPTIONS,
                    visibleWhen: { field: 'variant', equals: 'cards' },
                },
            ],
        },
        {
            id: 'display',
            title: 'Display',
            controls: [
                {
                    id: 'autoplay',
                    kind: 'toggle',
                    field: 'autoPlay',
                    label: 'Auto-scroll slides',
                    defaultValue: true,
                    visibleWhen: { field: 'variant', in: AUTOPLAY_VARIANTS },
                },
                {
                    id: 'interval',
                    kind: 'range',
                    field: 'interval',
                    label: 'Interval',
                    defaultValue: 5,
                    min: 2,
                    max: 15,
                    step: 1,
                    suffix: 's',
                    visibleWhen: [
                        { field: 'variant', in: AUTOPLAY_VARIANTS },
                        { field: 'autoPlay', equals: true },
                    ],
                },
            ],
        },
        {
            id: 'style',
            title: 'Style',
            controls: [
                ...getColorControls('carousel'),
                {
                    id: 'label',
                    kind: 'pretext',
                    labelName: 'label',
                },
                {
                    id: 'card-style',
                    kind: 'cardStyle',
                    fallbackPreset: 'soft',
                    supportsMedia: true,
                    supportsIcon: true,
                    supportsTextAlign: true,
                    mediaControls: {
                        layout: false,
                        aspect: true,
                        size: true,
                        radius: true,
                    },
                },
            ],
        },
        getAdvancedSection(),
    ],
};

const genericSchemas = Object.fromEntries(
    Object.entries(GENERIC_SCHEMA_TITLES).map(([blockType, title]) => [
        blockType,
        createGenericSchema(blockType, title),
    ]),
) as Record<string, BlockSettingsSchema>;

const legacySchemas = Object.fromEntries(
    Object.entries(LEGACY_SCHEMA_TITLES).map(([blockType, title]) => [
        blockType,
        createLegacySchema(blockType, title),
    ]),
) as Record<string, BlockSettingsSchema>;

export const BLOCK_SETTINGS_SCHEMAS: Record<string, BlockSettingsSchema> = {
    ...legacySchemas,
    ...genericSchemas,
    carousel: carouselSettingsSchema,
};

export const SCHEMA_REGISTERED_BLOCK_TYPES = Object.keys(BLOCK_SETTINGS_SCHEMAS);

export const SCHEMA_MIGRATED_BLOCK_TYPES = [
    ...Object.keys(GENERIC_SCHEMA_TITLES),
    'carousel',
] as const;

export function getBlockSettingsSchema(blockType: string): BlockSettingsSchema | undefined {
    return BLOCK_SETTINGS_SCHEMAS[blockType];
}

export function isSchemaMigratedBlock(blockType: string): boolean {
    return (SCHEMA_MIGRATED_BLOCK_TYPES as readonly string[]).includes(blockType);
}

function createGenericSchema(blockType: string, title: string): BlockSettingsSchema {
    const sections: SettingsSection[] = [
        {
            id: 'layout',
            title: 'Layout',
            controls: [
                { id: 'section-layout', kind: 'layout' },
                ...getChoiceControls(blockType, LAYOUT_FIELDS),
                ...getResponsiveColumnControl(blockType),
            ],
        },
    ];
    const displayControls = getDisplayControls(blockType);
    const styleControls: SettingsControl[] = [
        ...getColorControls(blockType),
        ...getPretextControl(blockType),
        ...getCardStyleControls(blockType),
        ...getChoiceControls(blockType, STYLE_FIELDS),
    ];

    if (displayControls.length > 0) {
        sections.push({
            id: 'display',
            title: 'Display',
            controls: displayControls,
        });
    }

    if (styleControls.length > 0) {
        sections.push({
            id: 'style',
            title: 'Style',
            controls: styleControls,
        });
    }

    sections.push(getAdvancedSection());

    return {
        blockType,
        title,
        subtitle: BLOCK_SUBTITLES[blockType] || 'Adjust this block and preview changes before saving.',
        sections,
    };
}

function createLegacySchema(blockType: string, title: string): BlockSettingsSchema {
    return {
        blockType,
        title,
        subtitle: 'This block is registered for the central settings schema migration.',
        sections: [
            {
                id: 'advanced',
                title: 'Advanced',
                controls: [
                    {
                        id: 'legacy-panel',
                        kind: 'custom',
                        renderKey: 'legacyPanel',
                    },
                ],
            },
        ],
    };
}

function getChoiceControls(blockType: string, source: Record<string, ChoiceFieldConfig[]>): SelectSettingsControl[] {
    return (source[blockType] || []).map((field) => ({
        id: field.key,
        kind: 'select',
        field: field.key,
        label: field.label,
        defaultValue: field.defaultValue,
        options: field.options,
        visibleWhen: field.visibleWhen,
    }));
}

function getDisplayControls(blockType: string): SettingsControl[] {
    return (DISPLAY_CONTROLS[blockType] || []).map((control) => {
        const { key, visibleWhen, ...rest } = control;
        return {
            ...rest,
            id: key,
            field: key,
            visibleWhen,
        } as SettingsControl;
    });
}

function getColorControls(blockType: string): ColorSettingsControl[] {
    const controls: ColorSettingsControl[] = [
        {
            id: 'background-color',
            kind: 'color',
            field: 'backgroundColor',
            label: 'Section background',
            defaultValue: '',
            fallback: getBackgroundFallback(blockType),
            placeholder: 'Default',
        },
    ];

    if (FOREGROUND_COLOR_BLOCKS.has(blockType) || blockType === 'carousel') {
        controls.push({
            id: 'foreground-color',
            kind: 'color',
            field: 'foregroundColor',
            label: 'Section text color',
            defaultValue: '',
            fallback: '#0f172a',
            placeholder: 'Default',
        });
    }

    if (blockType === 'tabBar') {
        controls.push(
            {
                id: 'active-color',
                kind: 'color',
                field: 'activeColor',
                label: 'Active tab color',
                defaultValue: 'palette:primary',
                fallback: '#374151',
                placeholder: 'palette:primary',
            },
            {
                id: 'bar-background',
                kind: 'color',
                field: 'bgColor',
                label: 'Bar background',
                defaultValue: '',
                fallback: '#ffffff',
                placeholder: 'Transparent',
            },
        );
    }

    return controls;
}

function getPretextControl(blockType: string): SettingsControl[] {
    if (!PRETEXT_BLOCKS.has(blockType)) return [];
    return [{
        id: 'label',
        kind: 'pretext',
        labelName: blockType === 'aboutImageText' ? 'eyebrow' : 'label',
    }];
}

function getCardStyleControls(blockType: string): SettingsControl[] {
    if (!CARD_STYLE_BLOCKS.has(blockType)) return [];
    return [{
        id: 'card-style',
        kind: 'cardStyle',
        fallbackPreset: 'soft',
        supportsMarker: blockType === 'featuresList',
        supportsTextAlign: blockType !== 'contact_form' && blockType !== 'contactForm',
    }];
}

function getResponsiveColumnControl(blockType: string): SettingsControl[] {
    if (!COLUMN_BLOCKS.has(blockType)) return [];
    const visibleWhen = blockType === 'logoCloud'
        ? { field: 'variant', equals: 'grid' }
        : blockType === 'socialFeed'
            ? { field: 'variant', equals: 'grid' }
            : undefined;

    return [{
        id: 'columns',
        kind: 'responsiveColumns',
        label: 'Columns',
        visibleWhen,
    }];
}

function getAdvancedSection(): SettingsSection {
    return {
        id: 'advanced',
        title: 'Advanced',
        controls: [
            {
                id: 'advanced-css',
                kind: 'advancedCss',
            },
        ],
    };
}

function getBackgroundFallback(blockType: string): string {
    switch (blockType) {
        case 'deliveryLinks':
        case 'featuredQuote':
            return 'palette:accent';
        case 'cta':
            return 'palette:secondary';
        case 'resources':
            return '#f8fafc';
        default:
            return '#ffffff';
    }
}
