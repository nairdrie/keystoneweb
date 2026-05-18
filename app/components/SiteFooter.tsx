'use client';

import { useState } from 'react';
import {
    Settings,
    Facebook,
    Instagram,
    Twitter,
    Linkedin,
    Youtube,
    Phone,
    Mail,
    MapPin,
} from 'lucide-react';
import { useEditorContext, BlockDataProvider, NavItem } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';
import NavMenu from '@/app/components/NavMenu';
import FooterSettingsPanel from '@/app/components/blocks/footer/FooterSettingsPanel';
import { parseSiteTitleStyles, stripHighlight } from '@/lib/site-title-utils';

// ─── Types ─────────────────────────────────────────────────────────────────

export type FooterLayout = 'simple' | 'centered' | 'columns' | 'minimal' | 'card';
export type FooterBgType =
    | 'transparent'
    | 'primary'
    | 'secondary'
    | 'gradient'
    | 'dark'
    | 'white'
    | 'custom';

export interface SiteFooterDefaults {
    layout?: FooterLayout;
    bgType?: FooterBgType;
    /** Custom hex color when bgType is 'custom' */
    bgCustom?: string;
    /** Tailwind class applied when no inline bg style is used (e.g. 'bg-white' / '') */
    bgClass?: string;
    /** Top border class (e.g. 'border-t border-slate-100') */
    borderClass?: string;
    /** Inline border style fn (e.g. for templates with palette-based border colors) */
    borderStyleFn?: (palette: Record<string, string>) => React.CSSProperties;
    /** Container width class */
    containerClass?: string;
    /** Vertical padding class */
    paddingClass?: string;
    /** Hint that the bg is dark and text should be light */
    textIsLight?: boolean;
    /** Pixel size for the logo (used both for image and fallback square) */
    logoSize?: number;
    /** Class added to the fallback logo square */
    logoClass?: string;
    /** Inline style fn for the fallback logo square */
    logoStyleFn?: (palette: Record<string, string>) => React.CSSProperties;
    /** Optional small text rendered before the logo (e.g. '// ' for Edge) */
    logoFallbackPrefix?: string;
    /** Card wrapper class when layout='card' (e.g. 'bg-white rounded-2xl shadow-sm p-8') */
    cardClass?: string;
    /** Class for the title text */
    titleClass?: string;
    /** When true, the tagline element is shown unless the user explicitly turns it off. Used for templates
     *  whose existing hardcoded footer contained a slogan (e.g. Classic). */
    defaultShowTagline?: boolean;
    /** Placeholder text used when the tagline is shown but no value is set. Templates with an existing
     *  hardcoded tagline supply their original copy so unedited published sites are unchanged. */
    defaultTaglineText?: string;
    /** When true, the copyright element is shown unless the user explicitly turns it off. Used for templates
     *  whose existing hardcoded footer already had a copyright line (e.g. Sleek, Organic). */
    defaultShowCopyright?: boolean;
    /** Placeholder copyright text. `{year}` and `{title}` are replaced. Templates with an existing
     *  hardcoded copyright supply their original copy so unedited published sites are unchanged. */
    defaultCopyrightText?: string;
}

// ─── Color helpers ─────────────────────────────────────────────────────────

function isHexDark(hex: string): boolean {
    const h = hex.replace('#', '');
    if (h.length < 6) return false;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

function getBgStyle(
    bgType: FooterBgType,
    p: Record<string, string>,
    custom: string,
): React.CSSProperties {
    switch (bgType) {
        case 'primary':
            return { backgroundColor: p.primary };
        case 'secondary':
            return { backgroundColor: p.secondary };
        case 'gradient':
            return { background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` };
        case 'dark':
            return { backgroundColor: '#0a0f1a' };
        case 'custom':
            return custom ? { backgroundColor: custom } : {};
        case 'white':
        case 'transparent':
        default:
            return {};
    }
}

function bgIsLight(
    bgType: FooterBgType,
    p: Record<string, string>,
    custom: string,
    fallback: boolean,
): boolean {
    if (bgType === 'primary') return isHexDark(p.primary || '#374151');
    if (bgType === 'secondary') return isHexDark(p.secondary || '#10b981');
    if (bgType === 'gradient') return true;
    if (bgType === 'dark') return true;
    if (bgType === 'custom' && custom) return isHexDark(custom);
    return fallback;
}

// ─── Component ─────────────────────────────────────────────────────────────

interface SiteFooterProps {
    palette: Record<string, string>;
    isEditMode: boolean;
    defaults?: SiteFooterDefaults;
}

export default function SiteFooter({
    palette,
    isEditMode,
    defaults = {},
}: SiteFooterProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => {});
    const isProUser = context?.isProUser ?? false;
    const headerNavItems = context?.navItems || [];

    // ── Resolved values (siteContent override > defaults > system default) ──
    const layout: FooterLayout = (siteContent.footerLayout as FooterLayout) || defaults.layout || 'simple';
    const bgType: FooterBgType = (siteContent.footerBgType as FooterBgType) || defaults.bgType || 'transparent';
    const bgCustom: string = siteContent.footerBgColor || defaults.bgCustom || '';

    const showLogo: boolean = siteContent.showFooterLogo !== false;
    const showTitle: boolean = siteContent.showFooterTitle !== false;
    const showTagline: boolean = siteContent.showFooterTagline !== undefined
        ? !!siteContent.showFooterTagline
        : !!defaults.defaultShowTagline;
    const showCopyright: boolean = siteContent.showFooterCopyright !== undefined
        ? !!siteContent.showFooterCopyright
        : !!defaults.defaultShowCopyright;
    const showSocial: boolean = !!siteContent.showFooterSocial;
    const showContact: boolean = !!siteContent.showFooterContact;
    const showLegalLinks: boolean = !!siteContent.showFooterLegalLinks;

    const navMode: 'none' | 'header' | 'custom' = (siteContent.footerNavMode as 'none' | 'header' | 'custom') || 'none';
    const customFooterNavItems: NavItem[] = Array.isArray(siteContent.footerNavItems)
        ? (siteContent.footerNavItems as NavItem[])
        : [];

    const logoPosition: 'left' | 'center' = (siteContent.footerLogoPosition as 'left' | 'center')
        || (layout === 'centered' || layout === 'card' ? 'center' : 'left');

    const customCss: string = siteContent.footerCustomCss || '';
    const textColorOverride: string = siteContent.footerTextColor || '';
    const linkColorOverride: string = siteContent.footerLinkColor || '';

    // ── Background computation ──────────────────────────────────────────────
    const userSetBg = !!siteContent.footerBgType;
    const effectiveBg = userSetBg ? bgType : (defaults.bgType || 'transparent');
    const textIsLight = bgIsLight(
        effectiveBg,
        palette,
        bgCustom,
        defaults.textIsLight ?? false,
    );

    // When bg is white/transparent (user-selected or default), apply bgClass; otherwise use inline style
    const useBgClass = effectiveBg === 'transparent' || effectiveBg === 'white';
    const bgInlineStyle: React.CSSProperties = !useBgClass
        ? getBgStyle(effectiveBg, palette, bgCustom)
        : {};
    const borderDynStyle: React.CSSProperties =
        !userSetBg && defaults.borderStyleFn ? defaults.borderStyleFn(palette) : {};
    const footerInlineStyle: React.CSSProperties = { ...bgInlineStyle, ...borderDynStyle };

    // Effective bg-class when using transparent/white. Templates supply their
    // base bg class (e.g. 'bg-white' or '' for transparent). When the user
    // explicitly chooses 'white' we override regardless of template default.
    const effectiveBgClass = useBgClass
        ? (effectiveBg === 'white' ? 'bg-white' : (defaults.bgClass || ''))
        : '';

    // Border class (only applies when no user bg override, otherwise we drop
    // the border so the new bg owns the visual separation).
    const effectiveBorderClass = userSetBg
        ? ''
        : (defaults.borderClass || '');

    // ── Container / spacing ────────────────────────────────────────────────
    const containerClass = defaults.containerClass || 'max-w-7xl';
    const paddingClass = defaults.paddingClass || 'py-12';

    const pPrimary = palette.primary || '#374151';
    const pSecondary = palette.secondary || '#10b981';

    // ── Resolved text colors ───────────────────────────────────────────────
    const baseTextColor = textColorOverride
        || (textIsLight ? '#ffffff' : pPrimary);
    const dimTextClass = textIsLight ? 'text-white/60' : 'text-slate-400';
    const subtleTextClass = textIsLight ? 'text-white/40' : 'text-slate-300';
    const linkClass = textIsLight ? 'text-white/80 hover:text-white' : 'text-slate-600 hover:text-slate-900';
    const navItemClass = `text-sm font-medium ${linkClass} transition-colors`;
    const socialIconClass = `p-1.5 rounded-full transition-all hover:opacity-80 ${
        textIsLight
            ? 'text-white/70 hover:text-white hover:bg-white/10'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
    }`;

    // ── Logo ──────────────────────────────────────────────────────────────
    const logoSize = defaults.logoSize || 28;
    const logoClass = defaults.logoClass || 'rounded';
    const logoFallbackStyle: React.CSSProperties = defaults.logoStyleFn
        ? defaults.logoStyleFn(palette)
        : { backgroundColor: textIsLight ? 'rgba(255,255,255,0.15)' : pPrimary, color: '#ffffff' };

    const logoHeight = siteContent.footerLogoHeight ? Number(siteContent.footerLogoHeight) : logoSize;

    const logoEl = showLogo ? (
        (siteContent.footerLogo || siteContent.siteLogo) ? (
            <img
                src={siteContent.footerLogo || siteContent.siteLogo}
                alt={stripHighlight(siteContent.siteTitle) || 'Site logo'}
                className="ks-footer-logo object-contain"
                style={{ height: `${logoHeight}px`, width: 'auto' }}
            />
        ) : defaults.logoFallbackPrefix ? (
            <span className="ks-footer-logo font-mono text-xs" style={{ color: pSecondary }}>
                {defaults.logoFallbackPrefix}
            </span>
        ) : (
            <div
                className={`ks-footer-logo aspect-square flex items-center justify-center font-bold text-xs shrink-0 ${logoClass}`}
                style={{ height: `${logoHeight}px`, ...logoFallbackStyle }}
            >
                {(stripHighlight(siteContent.siteTitle) || 'S')[0]?.toUpperCase()}
            </div>
        )
    ) : null;

    // ── Title ─────────────────────────────────────────────────────────────
    const titleClass = defaults.titleClass || 'font-bold text-sm';
    const titleEl = showTitle ? (
        <EditableText
            as="span"
            contentKey="siteTitle"
            styleData={siteContent['siteTitle__styles']}
            content={siteContent.siteTitle}
            defaultValue="Your Business"
            isEditMode={isEditMode}
            onSave={updateSiteContent}
            className={titleClass}
            style={{
                color: baseTextColor,
                ...parseSiteTitleStyles(siteContent['siteTitle__styles']),
            }}
        />
    ) : null;

    // ── Tagline ───────────────────────────────────────────────────────────
    // Falls back to legacy `footerSlogan` field so templates that previously
    // rendered a slogan continue to display it for unedited published sites.
    const taglineContent = siteContent.footerTagline ?? siteContent.footerSlogan;
    const taglineKey = siteContent.footerTagline !== undefined || !siteContent.footerSlogan
        ? 'footerTagline'
        : 'footerSlogan';
    const taglineDefault = defaults.defaultTaglineText
        || 'Add a short tagline that describes what you do.';
    const taglineEl = showTagline ? (
        <EditableText
            as="p"
            contentKey={taglineKey}
            content={taglineContent}
            defaultValue={taglineDefault}
            isEditMode={isEditMode}
            onSave={updateSiteContent}
            className={`text-sm mt-2 ${dimTextClass} max-w-md`}
        />
    ) : null;

    // ── Copyright ─────────────────────────────────────────────────────────
    const year = new Date().getFullYear();
    const titleText = stripHighlight(siteContent.siteTitle) || 'Your Business';
    const interpolate = (text: string): string =>
        text.replace(/\{year\}/g, String(year)).replace(/\{title\}/g, titleText);
    const copyrightDefault = defaults.defaultCopyrightText
        ? interpolate(defaults.defaultCopyrightText)
        : `© ${year} ${titleText}`;
    const copyrightEl = showCopyright ? (
        <EditableText
            as="p"
            contentKey="footerCopyrightText"
            content={
                typeof siteContent.footerCopyrightText === 'string'
                    ? interpolate(siteContent.footerCopyrightText)
                    : siteContent.footerCopyrightText
            }
            defaultValue={copyrightDefault}
            isEditMode={isEditMode}
            onSave={updateSiteContent}
            className={`text-xs ${dimTextClass}`}
        />
    ) : null;

    // ── Powered by ────────────────────────────────────────────────────────
    // Always shown with fixed text and link — this is the only footer element
    // that is intentionally not editable or removable.
    const poweredByEl = (
        <p className={`text-xs ${subtleTextClass}`}>
            Powered by{' '}
            <a
                href="https://keystoneweb.ca"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => isEditMode && e.preventDefault()}
                className="underline hover:opacity-80 transition-opacity"
            >
                Keystone
            </a>
        </p>
    );

    // ── Social links ──────────────────────────────────────────────────────
    const socialLinks = [
        { key: 'facebook', url: siteContent.footerSocialFacebook || '', Icon: Facebook },
        { key: 'instagram', url: siteContent.footerSocialInstagram || '', Icon: Instagram },
        { key: 'x', url: siteContent.footerSocialX || '', Icon: Twitter },
        { key: 'linkedin', url: siteContent.footerSocialLinkedin || '', Icon: Linkedin },
        { key: 'youtube', url: siteContent.footerSocialYoutube || '', Icon: Youtube },
    ].filter((s) => s.url);

    const socialEl =
        showSocial && (socialLinks.length > 0 || isEditMode) ? (
            <div className="flex items-center gap-1">
                {socialLinks.length === 0 && isEditMode ? (
                    <span className={`text-xs italic ${subtleTextClass}`}>Add social URLs in settings</span>
                ) : (
                    socialLinks.map(({ key, url, Icon }) => (
                        <a
                            key={key}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => isEditMode && e.preventDefault()}
                            className={socialIconClass}
                            aria-label={key}
                        >
                            <Icon className="w-4 h-4" />
                        </a>
                    ))
                )}
            </div>
        ) : null;

    // ── Contact info ──────────────────────────────────────────────────────
    const phone = siteContent.footerContactPhone || '';
    const email = siteContent.footerContactEmail || '';
    const address = siteContent.footerContactAddress || '';
    const contactEl = showContact && (phone || email || address || isEditMode) ? (
        <div className={`space-y-1.5 text-sm ${dimTextClass}`}>
            {(phone || isEditMode) && (
                <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <EditableText
                        as="span"
                        contentKey="footerContactPhone"
                        content={siteContent.footerContactPhone}
                        defaultValue={isEditMode ? '(555) 123-4567' : ''}
                        isEditMode={isEditMode}
                        onSave={updateSiteContent}
                    />
                </div>
            )}
            {(email || isEditMode) && (
                <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <EditableText
                        as="span"
                        contentKey="footerContactEmail"
                        content={siteContent.footerContactEmail}
                        defaultValue={isEditMode ? 'hello@example.com' : ''}
                        isEditMode={isEditMode}
                        onSave={updateSiteContent}
                    />
                </div>
            )}
            {(address || isEditMode) && (
                <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <EditableText
                        as="span"
                        contentKey="footerContactAddress"
                        content={siteContent.footerContactAddress}
                        defaultValue={isEditMode ? '123 Main St, City, ST 12345' : ''}
                        isEditMode={isEditMode}
                        onSave={updateSiteContent}
                    />
                </div>
            )}
        </div>
    ) : null;

    // ── Nav menu ──────────────────────────────────────────────────────────
    // 'header' mode: reuse the header navItems via NavMenu.
    // 'custom' mode: render footer-specific items inline.
    const navItemsToRender: NavItem[] = navMode === 'header'
        ? headerNavItems
        : navMode === 'custom'
            ? customFooterNavItems
            : [];

    // When mirroring the header menu, match the header's submenu styling rather
    // than auto-styling from the footer's bg — otherwise the footer dropdown
    // looks unrelated to the header dropdown the user is replicating.
    const headerBgTypeRaw = siteContent.headerBgType as string | undefined;
    const headerUserSetBg = !!headerBgTypeRaw;
    const headerEffectiveBg = headerUserSetBg ? headerBgTypeRaw : 'white';
    const headerBgCustom = siteContent.headerBgColor || '';
    const headerTextIsLight = (() => {
        if (headerEffectiveBg === 'primary')   return isHexDark(palette.primary   || '#374151');
        if (headerEffectiveBg === 'secondary') return isHexDark(palette.secondary || '#10b981');
        if (headerEffectiveBg === 'gradient')  return true;
        if (headerEffectiveBg === 'dark')      return true;
        if (headerEffectiveBg === 'custom' && headerBgCustom) return isHexDark(headerBgCustom);
        return false;
    })();
    const headerSubmenuClass = headerTextIsLight
        ? 'bg-slate-900 border border-slate-700 shadow-xl'
        : 'bg-white border border-slate-100 shadow-lg';

    const navEl = navMode !== 'none' && (navItemsToRender.length > 0 || isEditMode) ? (
        <nav className={`ks-footer-nav flex flex-wrap items-center gap-x-5 gap-y-2 ${
            layout === 'columns' ? 'flex-col items-start gap-y-2' : ''
        }`}>
            {navMode === 'header' ? (
                // Reuse the same navItems via NavMenu — using the header's submenu
                // styling so the dropdowns look identical to the header's.
                // Submenus open upward since the footer sits at the bottom.
                <NavMenu
                    className={layout === 'columns' ? 'flex flex-col gap-2' : 'flex flex-wrap items-center gap-x-5 gap-y-2'}
                    itemClassName={navItemClass}
                    submenuClassName={headerSubmenuClass}
                    bar="primary"
                    dropDirection="up"
                />
            ) : (
                // Custom footer items — flat list (no submenus in footer).
                customFooterNavItems.map((item) => (
                    <a
                        key={item.id}
                        href={item.href || '#'}
                        onClick={(e) => isEditMode && e.preventDefault()}
                        className={navItemClass}
                    >
                        {item.label}
                    </a>
                ))
            )}
            {navItemsToRender.length === 0 && isEditMode && (
                <span className={`text-xs italic ${subtleTextClass}`}>
                    {navMode === 'header' ? 'Add header menu items' : 'Add footer links in settings'}
                </span>
            )}
        </nav>
    ) : null;

    // ── Legal links (small links e.g. Privacy / Terms in bottom row) ──────
    const legalItems: NavItem[] = Array.isArray(siteContent.footerLegalLinks)
        ? (siteContent.footerLegalLinks as NavItem[])
        : [];
    const legalEl = showLegalLinks && (legalItems.length > 0 || isEditMode) ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {legalItems.map((item) => (
                <a
                    key={item.id}
                    href={item.href || '#'}
                    onClick={(e) => isEditMode && e.preventDefault()}
                    className={`text-xs ${linkClass} transition-colors`}
                >
                    {item.label}
                </a>
            ))}
            {legalItems.length === 0 && isEditMode && (
                <span className={`text-xs italic ${subtleTextClass}`}>Add legal links in settings</span>
            )}
        </div>
    ) : null;

    // ── Brand cluster (logo + title) ───────────────────────────────────────
    const brandCluster = (logoEl || titleEl) ? (
        <div className={`flex items-center gap-2 ${logoPosition === 'center' ? 'justify-center' : ''}`}>
            {logoEl}
            {titleEl}
        </div>
    ) : null;

    // ── Settings cog ──────────────────────────────────────────────────────
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsCog = isEditMode ? (
        <button
            onClick={(e) => {
                e.stopPropagation();
                setSettingsOpen(true);
            }}
            className="absolute top-2 right-3 z-[200] opacity-0 group-hover:opacity-100 transition-all p-1.5 bg-white/90 backdrop-blur-sm rounded-md shadow border border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-slate-500"
            title="Footer settings"
            aria-label="Footer settings"
        >
            <Settings className="w-3.5 h-3.5" />
        </button>
    ) : null;

    const settingsModal = settingsOpen ? (
        <FooterSettingsPanel
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            palette={palette}
            defaults={defaults}
            isProUser={isProUser}
        />
    ) : null;

    // ── Custom CSS scoping ────────────────────────────────────────────────
    const hasCustomCss = !!customCss;
    const linkColorRule = linkColorOverride
        ? `.ks-site-footer a { color: ${linkColorOverride}; }`
        : '';
    const styleSheet = [
        hasCustomCss ? `.ks-site-footer { ${customCss} }` : '',
        linkColorRule,
    ]
        .filter(Boolean)
        .join('\n');
    const hasStyleSheet = !!styleSheet;

    // ── Layout renderers ──────────────────────────────────────────────────

    // Each layout returns the inner content for the <footer>. The outer
    // <footer> handles bg/border/edit-mode wiring uniformly below.

    function renderSimple() {
        // Logo+title left, info right. On mobile stacks vertically.
        const left = (
            <div className="flex flex-col gap-2 items-center md:items-start">
                {brandCluster}
                {taglineEl}
                {showContact && contactEl}
            </div>
        );
        const right = (
            <div className="flex flex-col gap-2 items-center md:items-end">
                {socialEl}
                {navEl}
                {legalEl}
                {copyrightEl}
                {poweredByEl}
            </div>
        );
        return (
            <div className={`${containerClass} mx-auto px-4`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {left}
                    {right}
                </div>
            </div>
        );
    }

    function renderCentered() {
        return (
            <div className={`${containerClass} mx-auto px-6 text-center`}>
                <div className="flex flex-col items-center gap-3">
                    {brandCluster}
                    {taglineEl}
                    {navEl && <div className="mt-2">{navEl}</div>}
                    {showContact && <div className="mt-2">{contactEl}</div>}
                    {socialEl && <div className="mt-2">{socialEl}</div>}
                    {legalEl && <div className="mt-2">{legalEl}</div>}
                    {copyrightEl && <div className="mt-2">{copyrightEl}</div>}
                    <div className="mt-2">{poweredByEl}</div>
                </div>
            </div>
        );
    }

    function renderColumns() {
        // 3-4 column layout: brand, nav, social/contact
        return (
            <div className={`${containerClass} mx-auto px-4`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Column 1: Brand */}
                    <div className="space-y-3">
                        {brandCluster && <div className="flex items-center gap-2">{logoEl}{titleEl}</div>}
                        {taglineEl}
                    </div>
                    {/* Column 2: Nav */}
                    {navEl && (
                        <div className="space-y-2">
                            <p className={`text-xs font-bold uppercase tracking-wide ${dimTextClass}`}>Links</p>
                            {navEl}
                        </div>
                    )}
                    {/* Column 3: Contact */}
                    {showContact && (
                        <div className="space-y-2">
                            <p className={`text-xs font-bold uppercase tracking-wide ${dimTextClass}`}>Contact</p>
                            {contactEl}
                        </div>
                    )}
                    {/* Column 4: Social */}
                    {showSocial && (
                        <div className="space-y-2">
                            <p className={`text-xs font-bold uppercase tracking-wide ${dimTextClass}`}>Follow</p>
                            {socialEl}
                        </div>
                    )}
                </div>
                <div className={`mt-10 pt-6 border-t ${textIsLight ? 'border-white/10' : 'border-slate-100'} flex flex-col sm:flex-row items-center justify-between gap-3`}>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        {copyrightEl}
                        {legalEl}
                    </div>
                    {poweredByEl}
                </div>
            </div>
        );
    }

    function renderMinimal() {
        return (
            <div className={`${containerClass} mx-auto px-6 flex items-center justify-between gap-4 flex-wrap`}>
                <div className="flex items-center gap-2">
                    {brandCluster}
                </div>
                <div className="flex flex-col items-end gap-1">
                    {copyrightEl}
                    {poweredByEl}
                </div>
            </div>
        );
    }

    function renderCard() {
        const cardClass = defaults.cardClass || 'bg-white rounded-2xl shadow-sm p-8';
        return (
            <div className={`${containerClass} mx-auto px-4`}>
                <div className={`${cardClass} text-center`}>
                    <div className="flex flex-col items-center gap-3">
                        {brandCluster}
                        {taglineEl}
                        {navEl && <div className="mt-2">{navEl}</div>}
                        {showContact && <div className="mt-2">{contactEl}</div>}
                        {socialEl && <div className="mt-2">{socialEl}</div>}
                        {legalEl && <div className="mt-2">{legalEl}</div>}
                        {copyrightEl && <div className="mt-1">{copyrightEl}</div>}
                        <div className="mt-1">{poweredByEl}</div>
                    </div>
                </div>
            </div>
        );
    }

    let body: React.ReactNode = null;
    switch (layout) {
        case 'centered':
            body = renderCentered();
            break;
        case 'columns':
            body = renderColumns();
            break;
        case 'minimal':
            body = renderMinimal();
            break;
        case 'card':
            body = renderCard();
            break;
        case 'simple':
        default:
            body = renderSimple();
            break;
    }

    const wrapperClasses = [
        'ks-site-footer relative',
        effectiveBgClass,
        effectiveBorderClass,
        paddingClass,
        isEditMode ? 'group' : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <BlockDataProvider value={siteContent} saveMeta={updateSiteContent}>
            <footer className={wrapperClasses} style={footerInlineStyle}>
                {hasStyleSheet && <style dangerouslySetInnerHTML={{ __html: styleSheet }} />}
                {body}
                {settingsCog}
                {settingsModal}
            </footer>
        </BlockDataProvider>
    );
}
