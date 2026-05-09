'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Menu, X, Settings, Facebook, Instagram, Twitter, Linkedin, Youtube, Phone, User } from 'lucide-react';
import { useHeaderHeight } from '@/lib/hooks/useHeaderHeight';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEditorContext, BlockDataProvider } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';
import EditableButton from '@/app/components/EditableButton';
import NavMenu from '@/app/components/NavMenu';
import HeaderCartIcon from '@/app/components/ecommerce/HeaderCartIcon';
import HeaderProductSearch from '@/app/components/ecommerce/HeaderProductSearch';
import HeaderMemberIcon from '@/app/components/membership/HeaderMemberIcon';
import { useMember } from '@/app/components/membership/MemberProvider';
import HeaderLanguageSelector from '@/app/components/HeaderLanguageSelector';
import HeaderSettingsPanel, {
    DEFAULT_HEADER_ELEMENT_ORDER,
    type HeaderRightElement,
} from '@/app/components/blocks/header/HeaderSettingsPanel';
import {
    type SiteHeaderDefaults,
    type HeaderBgType,
    type HeaderLayout,
    type LogoPosition,
    type NavPosition,
    type DesktopMenuStyle,
    type HamburgerPosition,
    type HeaderOverlayStyle,
} from '@/app/components/HeaderSettingsModal';

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
        case 'transparent': return { backgroundColor: 'transparent' };
        default:          return {};
    }
}

function getTextIsLight(bgType: HeaderBgType, p: Record<string, string>, custom: string): boolean {
    if (bgType === 'primary')   return isHexDark(p.primary   || '#374151');
    if (bgType === 'secondary') return isHexDark(p.secondary || '#10b981');
    if (bgType === 'gradient')  return true;
    if (bgType === 'custom' && custom) return isHexDark(custom);
    if (bgType === 'transparent') return true; // assume hero/image behind — default to light text
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
    const headerRef = useRef<HTMLElement | null>(null);

    // Member auth state — needed early for CTA replacement
    const memberCtx = useMember();
    const member = memberCtx?.member ?? null;

    // ── Resolve config (user override > template default > system default) ──
    const legacyLayout: HeaderLayout = siteContent.headerLayout || defaults.layout || 'default';
    const derivedLogoPos: LogoPosition = legacyLayout === 'centeredAboveNav' ? 'above' : 'left';
    const derivedNavPos: NavPosition = legacyLayout === 'centeredAboveNav' ? 'center' : 'right';
    const logoPosition: LogoPosition = siteContent.headerLogoPosition || defaults.logoPosition || derivedLogoPos;
    const navPosition: NavPosition = siteContent.headerNavPosition || defaults.navPosition || derivedNavPos;
    const desktopMenuStyle: DesktopMenuStyle = siteContent.headerDesktopMenuStyle || defaults.desktopMenuStyle || 'inline';
    const hamburgerPosition: HamburgerPosition = siteContent.headerHamburgerPosition || defaults.hamburgerPosition || 'right';
    const overlay: boolean = siteContent.headerOverlay != null
        ? Boolean(siteContent.headerOverlay)
        : (defaults.overlay ?? false);
    const overlayStyle: HeaderOverlayStyle = siteContent.headerOverlayStyle || 'dropShadow';
    const bgType: HeaderBgType    = siteContent.headerBgType  || defaults.bgType  || 'white';
    const bgCustom: string        = siteContent.headerBgColor || defaults.bgCustom || '';
    const isSticky: boolean       = siteContent.headerSticky != null
        ? siteContent.headerSticky !== 'none'
        : (defaults.sticky ?? true);
    const scrollBgChange: boolean = !!siteContent.headerScrollBgChange;
    const scrollBgUseCustom: boolean = !!siteContent.headerScrollBgUseCustom;
    const scrollBgType: HeaderBgType = siteContent.headerScrollBgType || 'white';
    const scrollBgColor: string = siteContent.headerScrollBgColor || '';
    const showBanner: boolean     = siteContent.headerShowBanner != null
        ? Boolean(siteContent.headerShowBanner)
        : (defaults.showBanner ?? false);
    const rightSide: 'cta' | 'social' | 'none' = siteContent.headerRightSide || 'cta';

    // New: secondary nav bar
    const secondaryBarEnabled: boolean = !!siteContent.headerSecondaryBarEnabled;
    const secondaryBarBgType: 'primary' | 'secondary' | 'custom' = siteContent.headerSecondaryBarBgType || 'secondary';
    const secondaryBarBgColor: string = siteContent.headerSecondaryBarBgColor || '';

    // New: search style + always-visible profile icon
    const searchStyle: 'icon' | 'wide' = siteContent.headerSearchStyle || 'icon';
    const profileAlwaysVisible: boolean = !!siteContent.headerProfileAlwaysVisible;

    // New: configurable element order for the desktop right-side cluster
    const rawElementOrder = Array.isArray(siteContent.headerElementOrder) ? siteContent.headerElementOrder : null;
    const elementOrder: HeaderRightElement[] = (() => {
        const valid = (rawElementOrder || []).filter(
            (v: unknown): v is HeaderRightElement =>
                typeof v === 'string' && (DEFAULT_HEADER_ELEMENT_ORDER as readonly string[]).includes(v)
        );
        DEFAULT_HEADER_ELEMENT_ORDER.forEach((el) => { if (!valid.includes(el)) valid.push(el); });
        return valid;
    })();

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
    const isTransparent = effectiveBg === 'transparent';

    // Publish the header height + overlay-ness to CSS so first-block heroes can
    // size themselves around the header.
    useHeaderHeight(headerRef, { overlay: overlay || isTransparent });
    const textIsLight   = getTextIsLight(effectiveBg, palette, bgCustom);

    // ── Scroll-bg-change detection ──────────────────────────────────────────
    // hasScrolled is only consulted while `scrollBgChange` is enabled — when
    // it's disabled the bg layer is not rendered, so a stale value is
    // harmless. We avoid a synchronous setState in the disabled branch.
    const [hasScrolled, setHasScrolled] = useState(false);
    useEffect(() => {
        if (!scrollBgChange) return;
        const el = headerRef.current;
        const win = el?.ownerDocument?.defaultView ?? (typeof window !== 'undefined' ? window : null);
        if (!win) return;
        const handler = () => setHasScrolled(win.scrollY > 8);
        handler();
        win.addEventListener('scroll', handler, { passive: true });
        return () => win.removeEventListener('scroll', handler);
    }, [scrollBgChange]);

    // When bg is white (user-selected or default-white), apply bgClass; otherwise use inline style
    const useBgClass  = isTransparent
        || (!siteContent.headerBgType && (!defaults.bgType || defaults.bgType === 'white'))
        || siteContent.headerBgType === 'white';
    const bgInlineStyle: React.CSSProperties = !useBgClass ? getBgStyle(effectiveBg, palette, bgCustom) : {};
    const borderDynStyle: React.CSSProperties = (!isTransparent && defaults.borderStyleFn) ? defaults.borderStyleFn(palette) : {};
    const headerInlineStyle: React.CSSProperties = { ...bgInlineStyle, ...borderDynStyle };

    // Scrolled-bg layer: rendered as an absolutely positioned div over the
    // header, which fades in via opacity when the page is scrolled. Defaults
    // to white when the user enables the change but doesn't pick a custom bg.
    const scrolledBgDescriptor: HeaderBgType = scrollBgUseCustom ? scrollBgType : 'white';
    const scrolledBgInlineStyle: React.CSSProperties = (() => {
        if (scrolledBgDescriptor === 'white') return { backgroundColor: '#ffffff' };
        if (scrolledBgDescriptor === 'transparent') return { backgroundColor: 'transparent' };
        return getBgStyle(scrolledBgDescriptor, palette, scrollBgColor);
    })();

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
    // ── Logo ────────────────────────────────────────────────────────────────
    const logoSize  = defaults.logoSize  || 36;
    const logoClass = defaults.logoClass || 'rounded';
    const logoFallbackStyle: React.CSSProperties = defaults.logoStyleFn
        ? defaults.logoStyleFn(palette)
        : { backgroundColor: textIsLight ? 'rgba(255,255,255,0.2)' : pPrimary, color: '#ffffff' };

    const baseLogoHeight = siteContent.headerLogoHeight ? Number(siteContent.headerLogoHeight) : logoSize;
    const mdLogoHeight = siteContent.headerLogoHeightMd ? Number(siteContent.headerLogoHeightMd) : null;
    const smLogoHeight = siteContent.headerLogoHeightSm ? Number(siteContent.headerLogoHeightSm) : null;
    const hasResponsiveLogo = mdLogoHeight != null || smLogoHeight != null;
    const responsiveLogoCss = hasResponsiveLogo
        ? `${mdLogoHeight != null ? `@media (max-width: 1023px) { .ks-site-header .ks-header-logo { height: ${mdLogoHeight}px !important; } }` : ''}
${smLogoHeight != null ? `@media (max-width: 767px) { .ks-site-header .ks-header-logo { height: ${smLogoHeight}px !important; } }` : ''}`
        : '';

    const hasHeaderStyle = hasNavStyle || !!headerCustomCss || hasResponsiveLogo;
    const headerStyleSheet = hasHeaderStyle
        ? navStyleSheet + (headerCustomCss ? `\n.ks-site-header { ${headerCustomCss} }` : '') + (responsiveLogoCss ? `\n${responsiveLogoCss}` : '')
        : '';

    const logoEl = siteContent.showHeaderLogo !== false && ((siteContent.headerLogo || siteContent.siteLogo)
        ? (
            <img
                src={siteContent.headerLogo || siteContent.siteLogo}
                alt={siteContent.siteTitle || 'Logo'}
                className={`ks-header-logo object-contain`}
                style={{ height: `${baseLogoHeight}px`, width: 'auto' }}
            />
        ) : (
            <div
                className={`ks-header-logo aspect-square flex items-center justify-center font-bold text-sm text-white shrink-0 ${logoClass}`}
                style={{ height: `${baseLogoHeight}px`, ...logoFallbackStyle }}
            >
                {(siteContent.siteTitle || 'S')[0]?.toUpperCase()}
            </div>
        )
    );

    const titleColor = (userSetBg && textIsLight) || (!userSetBg && (defaults.bgType === 'primary' || defaults.bgType === 'gradient' || defaults.bgType === 'secondary' || defaults.bgType === 'transparent' || (defaults.bgType === 'custom' && isHexDark(defaults.bgCustom || '')))) ? '#ffffff' : pPrimary;

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
    const userFill = siteContent.navButtonTextIcon?.fill as ('filled' | 'outline' | 'ghost' | undefined);
    const userIconOnly = !!siteContent.navButtonTextIcon?.iconOnly;

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
        } else if (userFill === 'ghost') {
            const accent = (typeof baseCtaStyle.backgroundColor === 'string' && baseCtaStyle.backgroundColor) ||
                (typeof baseCtaStyle.color === 'string' && baseCtaStyle.color) ||
                pSecondary || pPrimary;
            ctaClass = ctaClass
                .replace(/\btext-white\b/g, '')
                .replace(/\bborder-2\b/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            resolvedCtaStyle = {
                ...baseCtaStyle,
                background: 'transparent',
                backgroundColor: 'transparent',
                color: textIsLight ? '#ffffff' : accent,
                border: 'none',
                borderColor: undefined,
                boxShadow: 'none',
            };
        } else {
            // outline/ghost → filled
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

    // Icon-only: tighten padding so the button is roughly square around the icon
    if (userIconOnly) {
        ctaClass = ctaClass
            .replace(/\bpx-\d+(\.\d+)?\b/g, '')
            .replace(/\bpy-\d+(\.\d+)?\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        ctaClass = `${ctaClass} p-2`;
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

    // Profile slot: member icon when signed in, or always-visible "sign in" icon
    // when configured (links to /signin for unauthed visitors).
    const profileSlotEl = (() => {
        if (member) {
            const firstName = member.name?.split(' ')[0] || member.email.split('@')[0];
            return (
                <div className="flex items-center gap-2">
                    <span className={`hidden md:block text-sm ${textIsLight ? 'text-white/80' : 'text-slate-600'}`}>
                        Welcome, {firstName}
                    </span>
                    <HeaderMemberIcon color={cartIconColor} />
                </div>
            );
        }
        if (profileAlwaysVisible) {
            return (
                <Link
                    href={isEditMode ? '#' : '/signin'}
                    onClick={isEditMode ? (e) => e.preventDefault() : undefined}
                    aria-label="Sign in"
                    className="relative p-2 rounded-full hover:bg-slate-100 transition-colors inline-flex items-center justify-center"
                    style={{ color: cartIconColor }}
                >
                    <User className="w-5 h-5" />
                </Link>
            );
        }
        return null;
    })();

    // Backwards-compat alias used by existing layout code paths.
    const memberRightEl = profileSlotEl;

    const rightEl = (() => {
        if (rightSide === 'none') return memberRightEl;
        if (member) return memberRightEl;
        if (rightSide === 'social') {
            if (socialLinks.length === 0 && isEditMode) {
                return <span className="text-xs opacity-40 italic">Add links in Settings</span>;
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

    const homePageId = context?.pages?.find((p: { slug?: string; id?: string }) => p.slug === 'home')?.id || '';
    const homeHref = isEditor
        ? `/editor?siteId=${context?.siteId}&pageId=${homePageId}`
        : context?.previewSiteId
            ? `/preview?siteId=${context.previewSiteId}&pageId=${homePageId}`
            : '/';

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // animation state
    const [menuMounted, setMenuMounted] = useState(false);        // DOM presence
    const menuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const MENU_ANIM_MS = 220;

    const openMobileMenu = useCallback(() => {
        if (menuCloseTimer.current) clearTimeout(menuCloseTimer.current);
        setMenuMounted(true);
        requestAnimationFrame(() => requestAnimationFrame(() => setMobileMenuOpen(true)));
    }, []);

    const closeMobileMenu = useCallback(() => {
        setMobileMenuOpen(false);
        menuCloseTimer.current = setTimeout(() => setMenuMounted(false), MENU_ANIM_MS);
    }, []);

    const toggleMobileMenu = useCallback(() => {
        if (mobileMenuOpen) closeMobileMenu(); else openMobileMenu();
    }, [mobileMenuOpen, openMobileMenu, closeMobileMenu]);

    const [settingsOpen, setSettingsOpen] = useState(false);

    // ── Settings cog (edit mode hover) ─────────────────────────────────────
    const settingsCog = isEditMode ? (
        <button
            onClick={(e) => { e.stopPropagation(); setSettingsOpen(true); }}
            className="absolute top-2 right-3 z-[200] opacity-0 group-hover:opacity-100 transition-all p-1.5 bg-white/90 backdrop-blur-sm rounded-md shadow border border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-slate-500"
            title="Settings"
        >
            <Settings className="w-3.5 h-3.5" />
        </button>
    ) : null;

    const settingsModal = settingsOpen ? (
        <HeaderSettingsPanel
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            palette={palette}
            defaults={defaults}
            isProUser={isProUser}
        />
    ) : null;

    // ── Nav element pieces ──────────────────────────────────────────────────
    const logoLink = (
        <Link href={homeHref} aria-label="Home" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            {logoEl}
            {titleEl}
        </Link>
    );

    const navLinksEl = (
        <div className="ks-nav-items">
            <NavMenu
                className="flex items-center gap-6"
                itemClassName={resolvedNavItemClass}
                submenuClassName={resolvedSubmenuClass}
                bar={secondaryBarEnabled ? 'primary' : undefined}
            />
        </div>
    );

    // Secondary navigation bar (rendered below the header when enabled).
    const secondaryBarBgStyle: React.CSSProperties = (() => {
        if (secondaryBarBgType === 'primary') return { backgroundColor: pPrimary };
        if (secondaryBarBgType === 'secondary') return { backgroundColor: pSecondary };
        if (secondaryBarBgColor) return { backgroundColor: secondaryBarBgColor };
        return { backgroundColor: pSecondary };
    })();
    const secondaryBarTextLight = (() => {
        const bgHex = secondaryBarBgType === 'primary'
            ? pPrimary
            : secondaryBarBgType === 'custom'
                ? (secondaryBarBgColor || pSecondary)
                : pSecondary;
        return isHexDark(bgHex);
    })();
    const secondaryBarItemClass = secondaryBarTextLight
        ? 'text-sm font-medium text-white/85 hover:text-white transition-colors'
        : 'text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors';
    const secondaryBarSubmenuClass = secondaryBarTextLight
        ? 'bg-slate-900 border border-slate-700 shadow-xl'
        : 'bg-white border border-slate-100 shadow-lg';

    const secondaryBarEl = secondaryBarEnabled ? (
        <div className="hidden md:block border-t border-black/10" style={secondaryBarBgStyle}>
            <div className={`${containerClass} mx-auto px-4 py-2 flex items-center justify-center`}>
                <div className="ks-nav-items ks-nav-secondary">
                    <NavMenu
                        className="flex items-center gap-6"
                        itemClassName={secondaryBarItemClass}
                        submenuClassName={secondaryBarSubmenuClass}
                        bar="secondary"
                    />
                </div>
            </div>
        </div>
    ) : null;

    // CTA slot: skipped when a member is signed in (profile slot owns the right side then).
    const ctaSlotEl = member ? null : rightEl;

    const desktopUtilsEl = (
        <>
            {elementOrder.map((el) => {
                switch (el) {
                    case 'language':
                        return <HeaderLanguageSelector key="language" />;
                    case 'search':
                        return <HeaderProductSearch key="search" color={cartIconColor} style={searchStyle} />;
                    case 'cart':
                        return <HeaderCartIcon key="cart" color={cartIconColor} />;
                    case 'profile':
                        return profileSlotEl ? <span key="profile">{profileSlotEl}</span> : null;
                    case 'cta':
                        return ctaSlotEl ? <span key="cta">{ctaSlotEl}</span> : null;
                    default:
                        return null;
                }
            })}
        </>
    );

    const desktopHamburgerBtn = (
        <button
            className={`p-2 ${mobileIconColor}`}
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
            <span className="relative w-5 h-5 flex items-center justify-center">
                <Menu className={`absolute w-5 h-5 transition-all duration-[220ms] ${mobileMenuOpen ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} />
                <X className={`absolute w-5 h-5 transition-all duration-[220ms] ${mobileMenuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`} />
            </span>
        </button>
    );

    const useDesktopHamburger = desktopMenuStyle === 'hamburger';

    const mobileBorderStyle = defaults.mobileBorderStyleFn ? defaults.mobileBorderStyleFn(palette) : {};
    // Drawer (mobile + desktop-hamburger). Always rendered on small screens; on desktop only when hamburger mode.
    const drawerMenu = menuMounted ? (
        <div
            className={`${useDesktopHamburger ? '' : 'md:hidden'} overflow-hidden transition-[max-height,opacity] duration-[220ms] ease-out`}
            style={{ maxHeight: mobileMenuOpen ? '800px' : '0', opacity: mobileMenuOpen ? 1 : 0 }}
        >
        <div
            className={`border-t py-4 space-y-1 ${defaults.mobileBorderClass || 'border-slate-100'}`}
            style={mobileBorderStyle}
        >
            <div className="ks-nav-items">
                <NavMenu
                    className="flex flex-col"
                    itemClassName={resolvedMobileNavItemClass}
                />
            </div>
            {rightSide === 'cta' && (
                <div className="mt-3 md:hidden">
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

    // Mobile-only top-right cluster: small utilities + hamburger
    const mobileToggleCluster = (position: 'left' | 'right') => (
        <div className={`flex md:hidden items-center gap-1 ${position === 'left' ? 'order-first' : ''}`}>
            {position === 'right' && (
                <>
                    <HeaderProductSearch color={cartIconColor} />
                    <HeaderCartIcon color={cartIconColor} />
                    {member && <HeaderMemberIcon color={cartIconColor} />}
                </>
            )}
            <button className={`p-2 ${mobileIconColor}`} onClick={toggleMobileMenu} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}>
                <span className="relative w-5 h-5 flex items-center justify-center">
                    <Menu className={`absolute w-5 h-5 transition-all duration-[220ms] ${mobileMenuOpen ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} />
                    <X className={`absolute w-5 h-5 transition-all duration-[220ms] ${mobileMenuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`} />
                </span>
            </button>
            {position === 'right' && mobileSocialIcons}
        </div>
    );

    // ── Build single-row content (3-zone grid) ──────────────────────────────
    // Used by every layout except logoPosition === 'above'.
    const renderSingleRow = (heightClass = 'min-h-16 py-3') => {
        const left: React.ReactNode[] = [];
        const center: React.ReactNode[] = [];
        const right: React.ReactNode[] = [];

        if (logoPosition === 'left')   left.push(<div key="logo">{logoLink}</div>);
        if (logoPosition === 'center') center.push(<div key="logo">{logoLink}</div>);

        if (useDesktopHamburger) {
            const ham = <div key="ham" className="hidden md:inline-flex">{desktopHamburgerBtn}</div>;
            if (hamburgerPosition === 'left') left.push(ham);
            else right.unshift(ham);
        } else {
            const navWrap = <div key="nav" className="hidden md:flex items-center gap-6">{navLinksEl}</div>;
            if (navPosition === 'left')   left.push(navWrap);
            if (navPosition === 'center') center.push(navWrap);
            if (navPosition === 'right')  right.push(navWrap);
        }

        right.push(
            <div key="utils" className="hidden md:flex items-center gap-6">
                {desktopUtilsEl}
            </div>
        );

        // Mobile cluster — show alongside the logo on mobile
        const mobileCluster = mobileToggleCluster(hamburgerPosition);

        return (
            <div className={`flex items-center gap-3 ${heightClass}`}>
                <div className="flex items-center justify-start gap-4 shrink-0">
                    {hamburgerPosition === 'left' ? mobileCluster : null}
                    {left}
                </div>
                <div className="flex-1 flex items-center justify-center gap-4 min-w-0">
                    {center}
                </div>
                <div className="flex items-center justify-end gap-4 shrink-0">
                    {right}
                    {hamburgerPosition === 'right' ? mobileCluster : null}
                </div>
            </div>
        );
    };

    // When the header is "always visible" AND floats over content, the inner
    // styled element needs `position: fixed` — using `sticky` inside the
    // h-0 wrapper would only pin the inner element while the (zero-height)
    // wrapper is in view, so it would scroll away after a few pixels.
    const stickyClass = overlay && isSticky
        ? 'fixed top-0 left-0 right-0 z-50'
        : isSticky
            ? 'sticky top-0 z-50'
            : 'relative z-10';
    const overlayWrapperClass = overlay ? 'h-0 overflow-visible' : '';
    const transparentBgClass = overlay && overlayStyle === 'dropShadow'
        ? 'bg-gradient-to-b from-black/45 via-black/15 to-transparent'
        : 'bg-transparent';
    const bgClassFinal = useBgClass ? (isTransparent ? transparentBgClass : (defaults.bgClass || 'bg-white')) : '';
    // When transparent, suppress template default border/shadow for clean overlay
    const borderClassFinal = isTransparent ? '' : (defaults.borderClass || '');

    // ── FLOATING (pill) LAYOUT — preserved for templates like Airy ──────────
    if (defaults.isFloating) {
        const pillBgClass    = useBgClass ? (isTransparent ? transparentBgClass : (defaults.bgClass || 'bg-white/90')) : '';
        const pillInlineStyle: React.CSSProperties = !useBgClass ? bgInlineStyle : {};
        // Floating pill always overlays (h-0) when sticky, and also when overlay=true
        const wrapperClass = (overlay || isSticky) ? `${isSticky ? 'sticky top-0 z-50' : 'relative z-50'} h-0 overflow-visible` : 'relative';

        const pillScrollBgLayer = scrollBgChange ? (
            <div
                className="ks-scroll-bg-layer absolute inset-0 transition-opacity duration-300 ease-out pointer-events-none -z-10 rounded-2xl"
                style={{ ...scrolledBgInlineStyle, opacity: hasScrolled ? 1 : 0 }}
                aria-hidden
            />
        ) : null;

        return (
            <>
                {bannerEl}
                <header ref={headerRef} className={`${wrapperClass} ${isEditMode ? 'group relative' : ''}`}>
                    {hasHeaderStyle && <style dangerouslySetInnerHTML={{ __html: headerStyleSheet }} />}
                    <div className="pt-3 px-4">
                        <div
                            className={`ks-site-header ${containerClass} mx-auto ${pillBgClass} ${isTransparent ? '' : 'backdrop-blur-xl shadow-lg shadow-black/5 border border-white/50'} rounded-2xl px-5 relative ${scrollBgChange ? 'isolate' : ''}`}
                            style={pillInlineStyle}
                        >
                            {pillScrollBgLayer}
                            {defaults.hasAccentLine && (
                                <div className="h-0.5 w-full absolute top-0 left-0 rounded-t-2xl"
                                    style={{ background: `linear-gradient(90deg, transparent, ${defaults.accentColor || pSecondary}, transparent)` }} />
                            )}
                            {logoPosition === 'above' ? (
                                <>
                                    <div className="text-center pt-3">
                                        <Link href={homeHref} aria-label="Home" className="inline-flex flex-col items-center gap-2 transition-opacity hover:opacity-90">
                                            {logoEl}
                                            {titleEl}
                                        </Link>
                                    </div>
                                    {renderSingleRow('min-h-12 py-2')}
                                </>
                            ) : (
                                renderSingleRow('min-h-14 py-3')
                            )}
                            {drawerMenu}
                        </div>
                    </div>
                    {secondaryBarEl}
                    {settingsCog}
                    {settingsModal}
                </header>
            </>
        );
    }

    // ── LOGO ABOVE NAV (Luxe-style two-row) ────────────────────────────────
    if (logoPosition === 'above') {
        const navContent = useDesktopHamburger ? desktopHamburgerBtn : navLinksEl;
        const utilsCluster = <div className="flex items-center gap-6">{desktopUtilsEl}</div>;

        const navRow = navPosition === 'center' ? (
            <div className="hidden md:flex items-center justify-center h-12 gap-8 relative">
                {navContent}
                <div className="absolute right-0">{utilsCluster}</div>
            </div>
        ) : navPosition === 'right' ? (
            <div className="hidden md:flex items-center justify-end h-12 gap-8">
                {navContent}
                {utilsCluster}
            </div>
        ) : (
            <div className="hidden md:flex items-center h-12 gap-8">
                {navContent}
                <div className="ml-auto">{utilsCluster}</div>
            </div>
        );

        const innerHeaderClass = `${stickyClass} ${bgClassFinal} ${scrollBgChange ? 'isolate' : ''} ${isTransparent ? '' : (defaults.borderClass || 'border-b border-gray-100')}`;

        const aboveScrollBgLayer = scrollBgChange ? (
            <div
                className="ks-scroll-bg-layer absolute inset-0 transition-opacity duration-300 ease-out pointer-events-none -z-10"
                style={{ ...scrolledBgInlineStyle, opacity: hasScrolled ? 1 : 0 }}
                aria-hidden
            />
        ) : null;

        const inner = (
            <>
                {aboveScrollBgLayer}
                {defaults.hasAccentLine && (
                    <div className="h-0.5 w-full"
                        style={{ background: `linear-gradient(90deg, transparent, ${defaults.accentColor || pSecondary}, transparent)` }} />
                )}
                {/* Top row: logo centered (mobile cluster floats right) */}
                <div className="relative text-center py-6 px-4">
                    <Link href={homeHref} aria-label="Home" className="inline-flex flex-col items-center gap-2 transition-opacity hover:opacity-90">
                        {logoEl}
                        {titleEl}
                    </Link>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {mobileToggleCluster('right')}
                    </div>
                </div>
                {/* Nav bar */}
                <nav className={`border-t ${textIsLight ? 'border-white/20' : 'border-gray-100'}`}>
                    <div className={`${containerClass} mx-auto px-6`}>
                        {navRow}
                        {drawerMenu}
                    </div>
                </nav>
                {secondaryBarEl}
            </>
        );

        return (
            <>
                {bannerEl}
                <header
                    ref={headerRef}
                    className={`ks-site-header ${overlay ? overlayWrapperClass : innerHeaderClass} ${isEditMode ? 'group relative' : 'relative'}`}
                    style={overlay ? {} : headerInlineStyle}
                >
                    {hasHeaderStyle && <style dangerouslySetInnerHTML={{ __html: headerStyleSheet }} />}
                    <div
                        className={overlay ? innerHeaderClass : 'contents'}
                        style={overlay ? headerInlineStyle : undefined}
                    >
                        {inner}
                    </div>
                    {settingsCog}
                    {settingsModal}
                </header>
            </>
        );
    }

    // ── DEFAULT (single-row) LAYOUT ─────────────────────────────────────────
    const innerClassName = `ks-site-header ${stickyClass} ${bgClassFinal} ${borderClassFinal} ${scrollBgChange ? 'isolate' : ''} ${isEditMode ? 'group relative' : 'relative'}`;
    const innerStyle = headerInlineStyle;

    const scrollBgLayer = scrollBgChange ? (
        <div
            className="ks-scroll-bg-layer absolute inset-0 transition-opacity duration-300 ease-out pointer-events-none -z-10"
            style={{ ...scrolledBgInlineStyle, opacity: hasScrolled ? 1 : 0 }}
            aria-hidden
        />
    ) : null;

    const defaultInnerContent = (
        <>
            {scrollBgLayer}
            {defaults.hasAccentLine && (
                <div className="h-0.5 w-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${defaults.accentColor || pSecondary}, transparent)` }} />
            )}
            <div className={`${containerClass} mx-auto px-4`}>
                {renderSingleRow()}
                {drawerMenu}
            </div>
            {secondaryBarEl}
        </>
    );

    // Always wrap inner content in a single <div> so {settingsCog} and
    // {settingsModal} sit at a stable position in the React tree across
    // overlay toggles. Without this, the panel state (open sections) would
    // reset every time the user flips "Float over content".
    return (
        <BlockDataProvider value={siteContent}>
            {bannerEl}
            <header ref={headerRef} className={overlay ? `${overlayWrapperClass} ${isEditMode ? 'group relative' : ''}` : innerClassName} style={overlay ? {} : innerStyle}>
                {hasHeaderStyle && <style dangerouslySetInnerHTML={{ __html: headerStyleSheet }} />}
                <div
                    className={overlay ? innerClassName : 'contents'}
                    style={overlay ? innerStyle : undefined}
                >
                    {defaultInnerContent}
                </div>
                {settingsCog}
                {settingsModal}
            </header>
        </BlockDataProvider>
    );
}
