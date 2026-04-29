'use client';

import { useState } from 'react';
import { Menu, X, Settings, Facebook, Instagram, Twitter, Linkedin, Youtube, Phone } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEditorContext } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';
import EditableButton from '@/app/components/EditableButton';
import NavMenu from '@/app/components/NavMenu';
import HeaderCartIcon from '@/app/components/ecommerce/HeaderCartIcon';
import HeaderProductSearch from '@/app/components/ecommerce/HeaderProductSearch';
import HeaderMemberIcon from '@/app/components/membership/HeaderMemberIcon';
import { useMember } from '@/app/components/membership/MemberProvider';
import HeaderLanguageSelector from '@/app/components/HeaderLanguageSelector';
import HeaderSettingsModal, { type SiteHeaderDefaults, type HeaderBgType, type HeaderLayout } from '@/app/components/HeaderSettingsModal';

export type { SiteHeaderDefaults, HeaderBgType, HeaderLayout };

// ─── Color helpers ─────────────────────────────────────────────────────────

function isHexDark(hex: string): boolean {
    const h = hex.replace('#', '');
    if (h.length < 6) return false;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

function getBgStyle(bgType: HeaderBgType, p: Record<string, string>, custom: string): React.CSSProperties {
    switch (bgType) {
        case 'primary':   return { backgroundColor: p.primary };
        case 'secondary': return { backgroundColor: p.secondary };
        case 'gradient':  return { background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` };
        case 'custom':    return custom ? { backgroundColor: custom } : {};
        default:          return {};
    }
}

function getTextIsLight(bgType: HeaderBgType, p: Record<string, string>, custom: string): boolean {
    if (bgType === 'primary')   return isHexDark(p.primary   || '#374151');
    if (bgType === 'secondary') return isHexDark(p.secondary || '#10b981');
    if (bgType === 'gradient')  return true;
    if (bgType === 'custom' && custom) return isHexDark(custom);
    return false;
}

// ─── Main component ─────────────────────────────────────────────────────────

interface SiteHeaderProps {
    palette: Record<string, string>;
    isEditMode: boolean;
    defaults?: SiteHeaderDefaults;
}

export default function SiteHeader({ palette, isEditMode, defaults = {} }: SiteHeaderProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => {});
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

    // Member auth state — needed early for CTA replacement
    const memberCtx = useMember();
    const member = memberCtx?.member ?? null;

    // ── Resolve config (user override > template default > system default) ──
    const layout: HeaderLayout    = siteContent.headerLayout  || defaults.layout  || 'default';
    const bgType: HeaderBgType    = siteContent.headerBgType  || defaults.bgType  || 'white';
    const bgCustom: string        = siteContent.headerBgColor || defaults.bgCustom || '';
    const isSticky: boolean       = siteContent.headerSticky != null
        ? siteContent.headerSticky !== 'none'
        : (defaults.sticky ?? true);
    const showBanner: boolean     = siteContent.headerShowBanner != null
        ? Boolean(siteContent.headerShowBanner)
        : (defaults.showBanner ?? false);
    const rightSide: 'cta' | 'social' | 'none' = siteContent.headerRightSide || 'cta';

    // Typography
    const navFontSize      = siteContent.headerNavFontSize    || '';
    const navFontWeight    = siteContent.headerNavFontWeight  || '';
    const navColorOverride = siteContent.headerNavColor       || '';
    const headerCustomCss  = siteContent.headerCustomCss      || '';
    const isProUser        = context?.isProUser ?? false;

    // Social links
    const socialLinks = [
        { key: 'facebook',  url: siteContent.headerSocialFacebook  || '', Icon: Facebook },
        { key: 'instagram', url: siteContent.headerSocialInstagram || '', Icon: Instagram },
        { key: 'x',         url: siteContent.headerSocialX         || '', Icon: Twitter },
        { key: 'linkedin',  url: siteContent.headerSocialLinkedin  || '', Icon: Linkedin },
        { key: 'youtube',   url: siteContent.headerSocialYoutube   || '', Icon: Youtube },
    ].filter(s => s.url);

    const pPrimary   = palette.primary   || '#374151';
    const pSecondary = palette.secondary || '#10b981';

    // ── Background computation ──────────────────────────────────────────────
    // userSetBg: true when user explicitly set a bg (or template defaults to non-white)
    const userSetBg     = !!siteContent.headerBgType;
    const effectiveBg   = userSetBg ? bgType : (defaults.bgType || 'white');
    const textIsLight   = getTextIsLight(effectiveBg, palette, bgCustom);

    // When bg is white (user-selected or default-white), apply bgClass; otherwise use inline style
    const useBgClass  = (!siteContent.headerBgType && (!defaults.bgType || defaults.bgType === 'white'))
        || siteContent.headerBgType === 'white';
    const bgInlineStyle: React.CSSProperties = !useBgClass ? getBgStyle(effectiveBg, palette, bgCustom) : {};
    const borderDynStyle: React.CSSProperties = defaults.borderStyleFn ? defaults.borderStyleFn(palette) : {};
    const headerInlineStyle: React.CSSProperties = { ...bgInlineStyle, ...borderDynStyle };

    // ── Nav item styling ────────────────────────────────────────────────────
    const autoNavClass = textIsLight
        ? 'text-sm font-medium text-white/80 hover:text-white transition-colors'
        : 'text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors';
    const autoMobileNavClass = textIsLight
        ? 'text-sm font-medium text-white/80 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors'
        : 'text-sm font-medium text-slate-600 hover:text-slate-900 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors';

    const resolvedNavItemClass = (userSetBg || !defaults.navItemClass)
        ? autoNavClass
        : defaults.navItemClass;
    const resolvedMobileNavItemClass = (userSetBg || !defaults.mobileNavItemClass)
        ? autoMobileNavClass
        : defaults.mobileNavItemClass;
    const resolvedSubmenuClass = userSetBg
        ? (textIsLight ? 'bg-slate-900 border border-slate-700 shadow-xl' : 'bg-white border border-slate-100 shadow-lg')
        : (defaults.submenuClass || 'bg-white border border-slate-100 shadow-lg');

    // Nav typography + custom CSS injected via scoped <style>
    const hasNavStyle = !!(navFontSize || navFontWeight || navColorOverride);
    const navStyleSheet = hasNavStyle ? `
        .ks-site-header .ks-nav-items a,
        .ks-site-header .ks-nav-items button {
            ${navFontSize ? `font-size: ${navFontSize} !important;` : ''}
            ${navFontWeight ? `font-weight: ${navFontWeight} !important;` : ''}
            ${navColorOverride ? `color: ${navColorOverride} !important;` : ''}
        }
    ` : '';
    const hasHeaderStyle = hasNavStyle || !!headerCustomCss;
    const headerStyleSheet = hasHeaderStyle
        ? navStyleSheet + (headerCustomCss ? `\n.ks-site-header { ${headerCustomCss} }` : '')
        : '';

    // ── Logo ────────────────────────────────────────────────────────────────
    const logoSize  = defaults.logoSize  || 36;
    const logoClass = defaults.logoClass || 'rounded';
    const logoFallbackStyle: React.CSSProperties = defaults.logoStyleFn
        ? defaults.logoStyleFn(palette)
        : { backgroundColor: textIsLight ? 'rgba(255,255,255,0.2)' : pPrimary, color: '#ffffff' };

    const logoEl = siteContent.showHeaderLogo !== false && ((siteContent.headerLogo || siteContent.siteLogo)
        ? (
            <img
                src={siteContent.headerLogo || siteContent.siteLogo}
                alt={siteContent.siteTitle || 'Logo'}
                className={`object-contain`}
                style={{ height: siteContent.headerLogoHeight ? `${siteContent.headerLogoHeight}px` : `${logoSize}px`, width: 'auto' }}
            />
        ) : (
            <div
                className={`flex items-center justify-center font-bold text-sm text-white shrink-0 ${logoClass}`}
                style={{ width: `${logoSize}px`, height: `${logoSize}px`, ...logoFallbackStyle }}
            >
                {(siteContent.siteTitle || 'S')[0]?.toUpperCase()}
            </div>
        )
    );

    const titleColor = (userSetBg && textIsLight) || (!userSetBg && (defaults.bgType === 'primary' || defaults.bgType === 'gradient' || defaults.bgType === 'secondary' || (defaults.bgType === 'custom' && isHexDark(defaults.bgCustom || '')))) ? '#ffffff' : pPrimary;

    const titleEl = (
        <EditableText
            as="div"
            contentKey="siteTitle"
            styleData={siteContent['siteTitle__styles']}
            content={siteContent.siteTitle}
            defaultValue="Site Name"
            isEditMode={isEditMode}
            onSave={updateSiteContent}
            className="text-lg font-semibold tracking-wide font-title"
            style={{ color: titleColor }}
        />
    );

    // ── CTA / Right side element ────────────────────────────────────────────
    const baseCtaClass = defaults.ctaClass || 'px-5 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 cursor-pointer inline-flex items-center justify-center';
    const baseCtaStyle: React.CSSProperties = defaults.ctaStyleFn
        ? defaults.ctaStyleFn(palette, textIsLight)
        : textIsLight
            ? { backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }
            : { backgroundColor: pPrimary, color: '#ffffff' };

    // Apply user button-style overrides (shape/fill) only when they differ from
    // the template's default — preserves each template's original look unless
    // the user explicitly chooses a different style in the button settings modal.
    const ctaDefaultShape = defaults.ctaDefaultShape || 'rounded';
    const ctaDefaultFill = defaults.ctaDefaultFill || 'filled';
    const userShape = siteContent.navButtonTextIcon?.shape as ('square' | 'rounded' | 'pill' | undefined);
    const userFill = siteContent.navButtonTextIcon?.fill as ('filled' | 'outline' | undefined);

    const stripRadius = (cls: string) =>
        cls.replace(/\brounded(-(none|sm|md|lg|xl|2xl|3xl|full))?\b/g, '').replace(/\s+/g, ' ').trim();
    const shapeRadiusClass = (s: 'square' | 'rounded' | 'pill') =>
        s === 'square' ? 'rounded-none' : s === 'pill' ? 'rounded-full' : 'rounded-lg';

    let ctaClass = baseCtaClass;
    let resolvedCtaStyle: React.CSSProperties = baseCtaStyle;

    if (userShape && userShape !== ctaDefaultShape) {
        ctaClass = `${stripRadius(ctaClass)} ${shapeRadiusClass(userShape)}`.trim();
    }

    if (userFill && userFill !== ctaDefaultFill) {
        if (userFill === 'outline') {
            const accent = (typeof baseCtaStyle.backgroundColor === 'string' && baseCtaStyle.backgroundColor) ||
                (typeof baseCtaStyle.color === 'string' && baseCtaStyle.color) ||
                pSecondary || pPrimary;
            ctaClass = ctaClass.replace(/\btext-white\b/g, '').replace(/\s+/g, ' ').trim();
            if (!/\bborder-2\b/.test(ctaClass)) ctaClass = `${ctaClass} border-2`;
            resolvedCtaStyle = {
                ...baseCtaStyle,
                background: 'transparent',
                backgroundColor: 'transparent',
                color: accent,
                borderColor: accent,
                boxShadow: 'none',
            };
        } else {
            // outline → filled
            const accent = (typeof baseCtaStyle.borderColor === 'string' && baseCtaStyle.borderColor) ||
                (typeof baseCtaStyle.color === 'string' && baseCtaStyle.color) ||
                pSecondary || pPrimary;
            ctaClass = ctaClass.replace(/\bborder-2\b/g, '').replace(/\s+/g, ' ').trim();
            resolvedCtaStyle = {
                ...baseCtaStyle,
                backgroundColor: accent,
                color: '#ffffff',
                borderColor: undefined,
            };
        }
    }

    // Check if membership is active site-wide (to default CTA link to /signup)
    const hasMembershipBlock = !!siteContent.__hasMembershipBlock;

    const defaultCtaLabel = hasMembershipBlock ? 'Sign Up' : (defaults.defaultCtaLabel || 'Contact');

    // Member sign-in link (shown below CTA button when membership block exists)
    const showMemberSignIn = hasMembershipBlock && (siteContent.headerShowMemberSignIn !== false);
    const memberSignInText = siteContent.headerMemberSignInText || 'Already a member? Sign In';
    const memberSignInEl = showMemberSignIn ? (
        <a
            href={isEditMode ? undefined : '/signin'}
            onClick={isEditMode ? (e: React.MouseEvent) => e.preventDefault() : undefined}
            className={`text-xs transition-opacity hover:opacity-80 whitespace-nowrap ${textIsLight ? 'text-white/70' : 'text-slate-500'}`}
        >
            {memberSignInText}
        </a>
    ) : null;

    // ── Banner ──────────────────────────────────────────────────────────────
    const bannerBgType  = siteContent.headerBannerBgType  || 'primary';
    const bannerBgColor = siteContent.headerBannerBgColor || '';
    const bannerBgStyle: React.CSSProperties = bannerBgType === 'primary' ? { backgroundColor: pPrimary }
        : bannerBgType === 'secondary' ? { backgroundColor: pSecondary }
        : bannerBgColor ? { backgroundColor: bannerBgColor }
        : { backgroundColor: pPrimary };

    const containerClass = defaults.containerClass || 'max-w-6xl';

    const bannerEl = showBanner ? (
        <div className="text-white text-xs py-2" style={bannerBgStyle}>
            <div className={`${containerClass} mx-auto px-4 flex items-center ${defaults.isBannerClassic ? 'justify-between' : 'justify-center'}`}>
                {defaults.isBannerClassic ? (
                    <>
                        <span className="flex items-center gap-1.5 opacity-80">
                            <Phone className="w-3 h-3" />
                            <EditableText
                                as="span"
                                contentKey="bannerPhone"
                                styleData={siteContent['bannerPhone__styles']}
                                content={siteContent.bannerPhone}
                                defaultValue="Call us: (555) 123-4567"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                            />
                        </span>
                        <EditableText
                            as="span"
                            contentKey="bannerHours"
                            styleData={siteContent['bannerHours__styles']}
                            content={siteContent.bannerHours}
                            defaultValue="Mon-Fri 8am - 6pm"
                            isEditMode={isEditMode}
                            onSave={updateSiteContent}
                            className="opacity-60 hidden sm:block"
                        />
                    </>
                ) : (
                    <EditableText
                        as="span"
                        contentKey="headerBannerText"
                        content={siteContent.headerBannerText}
                        defaultValue="🎉 Special offer — Limited time only!"
                        isEditMode={isEditMode}
                        onSave={updateSiteContent}
                        className="text-center"
                    />
                )}
            </div>
        </div>
    ) : null;

    // ── Mobile toggle color ─────────────────────────────────────────────────
    const mobileIconColor = textIsLight ? 'text-white' : 'text-slate-500';
    const cartIconColor   = textIsLight ? '#ffffff' : pPrimary;

    // When a member is signed in, replace CTA with profile icon + welcome text on all pages
    const memberRightEl = member ? (() => {
        const firstName = member.name?.split(' ')[0] || member.email.split('@')[0];
        return (
            <div className="flex items-center gap-2">
                <span className={`hidden md:block text-sm ${textIsLight ? 'text-white/80' : 'text-slate-600'}`}>
                    Welcome, {firstName}
                </span>
                <HeaderMemberIcon color={cartIconColor} />
            </div>
        );
    })() : null;

    const rightEl = (() => {
        if (rightSide === 'none') return memberRightEl;
        if (member) return memberRightEl;
        if (rightSide === 'social') {
            if (socialLinks.length === 0 && isEditMode) {
                return <span className="text-xs opacity-40 italic">Add links in Header Settings</span>;
            }
            if (socialLinks.length === 0) return null;
            return (
                <div className="flex items-center gap-1">
                    {socialLinks.map(({ key, url, Icon }) => (
                        <a
                            key={key}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => isEditMode && e.preventDefault()}
                            className={`p-1.5 rounded-full transition-all hover:opacity-80 ${textIsLight ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                        >
                            <Icon className="w-4 h-4" />
                        </a>
                    ))}
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center gap-1">
                <EditableButton
                    contentKey="navButtonText"
                    label={siteContent.navButtonText}
                    linkData={hasMembershipBlock && !siteContent.navButtonTextLink ? { type: 'url', value: '/signup' } : siteContent.navButtonTextLink}
                    iconData={siteContent.navButtonTextIcon}
                    defaultLabel={defaultCtaLabel}
                    isEditMode={isEditMode}
                    onSave={updateSiteContent}
                    className={ctaClass}
                    style={resolvedCtaStyle}
                    defaultShape={ctaDefaultShape}
                    defaultFill={ctaDefaultFill}
                />
                {memberSignInEl}
            </div>
        );
    })();

    const homePageId = context?.pages?.find((p: any) => p.slug === 'home')?.id || '';
    const homeHref = isEditor
        ? `/editor?siteId=${context?.siteId}&pageId=${homePageId}`
        : context?.previewSiteId
            ? `/preview?siteId=${context.previewSiteId}&pageId=${homePageId}`
            : '/';

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // ── Settings cog (edit mode hover) ─────────────────────────────────────
    const settingsCog = isEditMode ? (
        <button
            onClick={(e) => { e.stopPropagation(); setSettingsOpen(true); }}
            className="absolute top-2 right-3 z-[200] opacity-0 group-hover:opacity-100 transition-all p-1.5 bg-white/90 backdrop-blur-sm rounded-md shadow border border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-slate-500"
            title="Header Settings"
        >
            <Settings className="w-3.5 h-3.5" />
        </button>
    ) : null;

    const settingsModal = settingsOpen ? (
        <HeaderSettingsModal
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            siteContent={siteContent}
            updateSiteContent={updateSiteContent}
            palette={palette}
            defaults={defaults}
            isProUser={isProUser}
        />
    ) : null;

    // ── Nav elements ────────────────────────────────────────────────────────
    const logoLink = (
        <Link href={homeHref} aria-label="Home" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            {logoEl}
            {titleEl}
        </Link>
    );

    const desktopNav = (
        <div className="hidden md:flex items-center gap-6">
            <div className="ks-nav-items">
                <NavMenu
                    className="flex items-center gap-6"
                    itemClassName={resolvedNavItemClass}
                    submenuClassName={resolvedSubmenuClass}
                />
            </div>
            <HeaderLanguageSelector />
            <HeaderProductSearch color={cartIconColor} />
            <HeaderCartIcon color={cartIconColor} />
            {rightEl}
        </div>
    );

    const mobileBorderStyle = defaults.mobileBorderStyleFn ? defaults.mobileBorderStyleFn(palette) : {};
    const mobileMenu = mobileMenuOpen ? (
        <div
            className={`md:hidden border-t py-4 space-y-1 ${defaults.mobileBorderClass || 'border-slate-100'}`}
            style={mobileBorderStyle}
        >
            <div className="ks-nav-items">
                <NavMenu
                    className="flex flex-col"
                    itemClassName={resolvedMobileNavItemClass}
                />
            </div>
            {rightSide === 'cta' && (
                <div className="mt-3">
                    {member ? (
                        <div className="flex items-center gap-3 px-3 py-2">
                            <HeaderMemberIcon color={cartIconColor} />
                            <span className={`text-sm ${textIsLight ? 'text-white/80' : 'text-slate-600'}`}>
                                Welcome, {member.name?.split(' ')[0] || member.email.split('@')[0]}
                            </span>
                        </div>
                    ) : (
                        <>
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink}
                                iconData={siteContent.navButtonTextIcon}
                                defaultLabel={defaultCtaLabel}
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className={`w-full ${ctaClass}`}
                                style={resolvedCtaStyle}
                                defaultShape={ctaDefaultShape}
                                defaultFill={ctaDefaultFill}
                            />
                            {memberSignInEl && (
                                <div className="text-center mt-2">{memberSignInEl}</div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    ) : null;

    const mobileSocialIcons = rightSide === 'social' && socialLinks.length > 0 ? (
        <div className="flex items-center gap-0.5">
            {socialLinks.map(({ key, url, Icon }) => (
                <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => isEditMode && e.preventDefault()}
                    className={`p-1.5 rounded-full transition-all hover:opacity-80 ${textIsLight ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                >
                    <Icon className="w-4 h-4" />
                </a>
            ))}
        </div>
    ) : null;

    const mobileToggle = (
        <div className="flex md:hidden items-center gap-1">
            <HeaderProductSearch color={cartIconColor} />
            <HeaderCartIcon color={cartIconColor} />
            {member && <HeaderMemberIcon color={cartIconColor} />}
            <button className={`p-2 ${mobileIconColor}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            {mobileSocialIcons}
        </div>
    );

    const stickyClass  = isSticky ? 'sticky top-0 z-50' : 'relative z-10';
    const bgClassFinal = useBgClass ? (defaults.bgClass || 'bg-white') : '';

    // ── FLOATING LAYOUT (Airy) ──────────────────────────────────────────────
    if (defaults.isFloating) {
        const pillBgClass    = useBgClass ? (defaults.bgClass || 'bg-white/90') : '';
        const pillInlineStyle: React.CSSProperties = !useBgClass ? bgInlineStyle : {};

        return (
            <>
                {bannerEl}
                <header className={`${isSticky ? 'sticky top-0 z-50 h-0 overflow-visible' : 'relative'} ${isEditMode ? 'group relative' : ''}`}>
                    {hasHeaderStyle && <style dangerouslySetInnerHTML={{ __html: headerStyleSheet }} />}
                    <div className="pt-3 px-4">
                        <div
                            className={`ks-site-header ${containerClass} mx-auto ${pillBgClass} backdrop-blur-xl rounded-2xl shadow-lg shadow-black/5 border border-white/50 px-5 relative`}
                            style={pillInlineStyle}
                        >
                            {defaults.hasAccentLine && (
                                <div className="h-0.5 w-full absolute top-0 left-0 rounded-t-2xl"
                                    style={{ background: `linear-gradient(90deg, transparent, ${defaults.accentColor || pSecondary}, transparent)` }} />
                            )}
                            <div className="flex items-center justify-between min-h-14 py-3">
                                {logoLink}
                                {desktopNav}
                                {mobileToggle}
                            </div>
                            {mobileMenu}
                        </div>
                    </div>
                    {settingsCog}
                    {settingsModal}
                </header>
            </>
        );
    }

    // ── CENTERED ABOVE NAV LAYOUT (Luxe) ───────────────────────────────────
    if (layout === 'centeredAboveNav') {
        return (
            <>
                {bannerEl}
                <header
                    className={`ks-site-header ${stickyClass} ${bgClassFinal} ${defaults.borderClass || 'border-b border-gray-100'} ${isEditMode ? 'group relative' : 'relative'}`}
                    style={headerInlineStyle}
                >
                    {hasHeaderStyle && <style dangerouslySetInnerHTML={{ __html: headerStyleSheet }} />}
                    {defaults.hasAccentLine && (
                        <div className="h-0.5 w-full"
                            style={{ background: `linear-gradient(90deg, transparent, ${defaults.accentColor || pSecondary}, transparent)` }} />
                    )}
                    {/* Logo + name centered row */}
                    <div className="text-center py-6 px-4">
                        <Link href={homeHref} aria-label="Home" className="inline-flex flex-col items-center gap-2 transition-opacity hover:opacity-90">
                            {logoEl}
                            {titleEl}
                        </Link>
                    </div>
                    {/* Nav bar */}
                    <nav className={`border-t ${textIsLight ? 'border-white/20' : 'border-gray-100'}`}>
                        <div className={`${containerClass} mx-auto px-6`}>
                            <div className="hidden md:flex items-center justify-center h-12 gap-8">
                                <div className="ks-nav-items">
                                    <NavMenu
                                        className="flex items-center gap-8"
                                        itemClassName={resolvedNavItemClass}
                                        submenuClassName={resolvedSubmenuClass}
                                    />
                                </div>
                                <HeaderLanguageSelector />
                                <HeaderProductSearch color={cartIconColor} />
                                <HeaderCartIcon color={cartIconColor} />
                                {rightEl}
                            </div>
                            <div className="flex md:hidden items-center justify-between h-12">
                                <div className="flex items-center gap-1">
                                    <HeaderProductSearch color={cartIconColor} />
                                    <HeaderCartIcon color={cartIconColor} />
                                    {member && <HeaderMemberIcon color={cartIconColor} />}
                                    <button className={`p-2 ${mobileIconColor}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                                    </button>
                                </div>
                                {mobileSocialIcons}
                            </div>
                            {mobileMenu}
                        </div>
                    </nav>
                    {settingsCog}
                    {settingsModal}
                </header>
            </>
        );
    }

    // ── DEFAULT LAYOUT ──────────────────────────────────────────────────────
    return (
        <>
            {bannerEl}
            <header
                className={`ks-site-header ${stickyClass} ${bgClassFinal} ${defaults.borderClass || ''} ${isEditMode ? 'group relative' : 'relative'}`}
                style={headerInlineStyle}
            >
                {hasHeaderStyle && <style dangerouslySetInnerHTML={{ __html: headerStyleSheet }} />}
                {defaults.hasAccentLine && (
                    <div className="h-0.5 w-full"
                        style={{ background: `linear-gradient(90deg, transparent, ${defaults.accentColor || pSecondary}, transparent)` }} />
                )}
                <div className={`${containerClass} mx-auto px-4`}>
                    <div className="flex items-center justify-between min-h-16 py-3">
                        {logoLink}
                        {desktopNav}
                        {mobileToggle}
                    </div>
                    {mobileMenu}
                </div>
                {settingsCog}
                {settingsModal}
            </header>
        </>
    );
}
