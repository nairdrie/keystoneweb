'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Layout, Palette, Type, Code, Lock, Crown } from 'lucide-react';

export type HeaderBgType = 'white' | 'primary' | 'secondary' | 'gradient' | 'custom';
export type HeaderLayout = 'default' | 'centeredAboveNav';

export interface SiteHeaderDefaults {
    layout?: HeaderLayout;
    bgType?: HeaderBgType;
    bgCustom?: string;
    bgClass?: string;           // bg + blur classes for the default white look (e.g. 'bg-white/95 backdrop-blur-sm')
    borderClass?: string;       // always-on border/shadow classes
    borderStyleFn?: (p: Record<string, string>) => React.CSSProperties; // for dynamic border colors (Edge)
    sticky?: boolean;
    showBanner?: boolean;
    isBannerClassic?: boolean;  // uses bannerPhone/bannerHours EditableText fields
    isFloating?: boolean;       // Airy pill nav — h-0 overflow-visible layout
    hasAccentLine?: boolean;    // Edge neon gradient top line
    accentColor?: string;       // accent line color
    containerClass?: string;
    navItemClass?: string;
    mobileNavItemClass?: string;
    submenuClass?: string;
    mobileBorderClass?: string;
    mobileBorderStyleFn?: (p: Record<string, string>) => React.CSSProperties;
    logoSize?: number;
    logoClass?: string;
    logoStyleFn?: (p: Record<string, string>) => React.CSSProperties;
    defaultCtaLabel?: string;
    ctaClass?: string;
    ctaStyleFn?: (p: Record<string, string>, textIsLight: boolean) => React.CSSProperties;
}

interface HeaderSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    siteContent: Record<string, any>;
    updateSiteContent: (key: string, value: any) => void;
    palette: Record<string, string>;
    defaults: SiteHeaderDefaults;
    isProUser?: boolean;
}

type TabType = 'layout' | 'style' | 'typography' | 'css';

export default function HeaderSettingsModal({
    isOpen,
    onClose,
    siteContent,
    updateSiteContent,
    palette,
    defaults,
    isProUser,
}: HeaderSettingsModalProps) {
    const mouseDownOnBackdrop = useRef(false);
    const [activeTab, setActiveTab] = useState<TabType>('layout');

    // Layout
    const [layout, setLayout] = useState<HeaderLayout>('default');
    const [rightSide, setRightSide] = useState<'cta' | 'social' | 'none'>('cta');
    const [showBanner, setShowBanner] = useState(false);
    const [bannerText, setBannerText] = useState('');
    const [bannerBgType, setBannerBgType] = useState<'primary' | 'secondary' | 'custom'>('primary');
    const [bannerBgColor, setBannerBgColor] = useState('');
    // Social
    const [socialFacebook, setSocialFacebook] = useState('');
    const [socialInstagram, setSocialInstagram] = useState('');
    const [socialX, setSocialX] = useState('');
    const [socialLinkedin, setSocialLinkedin] = useState('');
    const [socialYoutube, setSocialYoutube] = useState('');
    // Style
    const [bgType, setBgType] = useState<HeaderBgType>('white');
    const [bgColor, setBgColor] = useState('');
    const [sticky, setSticky] = useState<'always' | 'none'>('always');
    // Typography
    const [navFontSize, setNavFontSize] = useState('');
    const [navFontWeight, setNavFontWeight] = useState('');
    const [navColor, setNavColor] = useState('');
    // CSS
    const [customCss, setCustomCss] = useState('');
    // Member sign-in link
    const [showMemberSignIn, setShowMemberSignIn] = useState(true);
    const [memberSignInText, setMemberSignInText] = useState('');
    // Product search
    const [showProductSearch, setShowProductSearch] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        setLayout(siteContent.headerLayout || defaults.layout || 'default');
        setRightSide(siteContent.headerRightSide || 'cta');
        setShowBanner(siteContent.headerShowBanner != null ? Boolean(siteContent.headerShowBanner) : (defaults.showBanner ?? false));
        setBannerText(siteContent.headerBannerText || '');
        setBannerBgType(siteContent.headerBannerBgType || 'primary');
        setBannerBgColor(siteContent.headerBannerBgColor || '');
        setSocialFacebook(siteContent.headerSocialFacebook || '');
        setSocialInstagram(siteContent.headerSocialInstagram || '');
        setSocialX(siteContent.headerSocialX || '');
        setSocialLinkedin(siteContent.headerSocialLinkedin || '');
        setSocialYoutube(siteContent.headerSocialYoutube || '');
        setBgType(siteContent.headerBgType || defaults.bgType || 'white');
        setBgColor(siteContent.headerBgColor || '');
        setSticky(siteContent.headerSticky || (defaults.sticky === false ? 'none' : 'always'));
        setNavFontSize(siteContent.headerNavFontSize || '');
        setShowMemberSignIn(siteContent.headerShowMemberSignIn !== false);
        setMemberSignInText(siteContent.headerMemberSignInText || '');
        setShowProductSearch(siteContent.headerShowProductSearch !== false);
        setNavFontWeight(siteContent.headerNavFontWeight || '');
        setNavColor(siteContent.headerNavColor || '');
        setCustomCss(siteContent.headerCustomCss || '');
    }, [isOpen, siteContent, defaults]);

    if (!isOpen) return null;

    const handleSave = () => {
        updateSiteContent('headerLayout', layout);
        updateSiteContent('headerRightSide', rightSide);
        updateSiteContent('headerShowBanner', showBanner);
        updateSiteContent('headerBannerText', bannerText);
        updateSiteContent('headerBannerBgType', bannerBgType);
        updateSiteContent('headerBannerBgColor', bannerBgColor);
        updateSiteContent('headerSocialFacebook', socialFacebook);
        updateSiteContent('headerSocialInstagram', socialInstagram);
        updateSiteContent('headerSocialX', socialX);
        updateSiteContent('headerSocialLinkedin', socialLinkedin);
        updateSiteContent('headerSocialYoutube', socialYoutube);
        updateSiteContent('headerBgType', bgType);
        updateSiteContent('headerBgColor', bgType === 'custom' ? bgColor : '');
        updateSiteContent('headerSticky', sticky);
        updateSiteContent('headerNavFontSize', navFontSize);
        updateSiteContent('headerNavFontWeight', navFontWeight);
        updateSiteContent('headerNavColor', navColor);
        updateSiteContent('headerCustomCss', customCss);
        updateSiteContent('headerShowMemberSignIn', showMemberSignIn);
        updateSiteContent('headerMemberSignInText', memberSignInText);
        updateSiteContent('headerShowProductSearch', showProductSearch);
        onClose();
    };

    const pPrimary = palette.primary || '#374151';
    const pSecondary = palette.secondary || '#10b981';

    const getBgPreviewStyle = (value: HeaderBgType): React.CSSProperties => {
        switch (value) {
            case 'white':     return { backgroundColor: '#ffffff', border: '1px solid #e2e8f0' };
            case 'primary':   return { backgroundColor: pPrimary };
            case 'secondary': return { backgroundColor: pSecondary };
            case 'gradient':  return { background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` };
            case 'custom':    return { backgroundColor: bgColor || '#e2e8f0' };
        }
    };

    const tabs: { id: TabType; label: string; Icon: React.FC<any> }[] = [
        { id: 'layout', label: 'Layout', Icon: Layout },
        { id: 'style', label: 'Style', Icon: Palette },
        { id: 'typography', label: 'Typography', Icon: Type },
        { id: 'css', label: 'CSS', Icon: Code },
    ];

    const modal = (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
                onClick={() => { if (mouseDownOnBackdrop.current) onClose(); }}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Header Settings</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Customize layout, background, and typography</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 px-6">
                    {tabs.map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <Icon className="w-4 h-4" />{label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* ── LAYOUT TAB ── */}
                    {activeTab === 'layout' && (
                        <>
                            {/* Layout variant */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-3">Header Layout</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { value: 'default' as HeaderLayout, label: 'Logo Left, Nav Right', desc: 'Standard horizontal layout — logo on left, links + CTA on right' },
                                        { value: 'centeredAboveNav' as HeaderLayout, label: 'Logo Centered Above Nav', desc: 'Logo & site name centered on top row, navigation bar below' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setLayout(opt.value)}
                                            className={`p-4 border rounded-xl text-left transition-all ${layout === opt.value ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            {/* Mini diagram */}
                                            <div className={`h-7 rounded bg-slate-100 mb-2.5 flex items-center px-2 gap-1.5 ${opt.value === 'centeredAboveNav' ? 'justify-center' : 'justify-between'}`}>
                                                {opt.value === 'default' ? (
                                                    <>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-3.5 h-3.5 rounded bg-slate-400" />
                                                            <div className="w-8 h-1.5 rounded bg-slate-400" />
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-5 h-1.5 rounded bg-slate-300" />
                                                            <div className="w-5 h-1.5 rounded bg-slate-300" />
                                                            <div className="w-8 h-3.5 rounded bg-blue-400" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-0.5 w-full">
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-3 h-3 rounded bg-slate-400" />
                                                            <div className="w-10 h-1.5 rounded bg-slate-400" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="font-semibold text-sm text-slate-900">{opt.label}</div>
                                            <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Right side element */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-3">Right-Side Element</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { value: 'cta' as const, label: 'CTA Button', desc: 'Call-to-action button' },
                                        { value: 'social' as const, label: 'Social Links', desc: 'Social media icons' },
                                        { value: 'none' as const, label: 'None', desc: 'Clean, minimal look' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setRightSide(opt.value)}
                                            className={`p-3 border rounded-xl text-left transition-all ${rightSide === opt.value ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            <div className="font-semibold text-sm text-slate-900">{opt.label}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Social link inputs */}
                            {rightSide === 'social' && (
                                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Social Link URLs</p>
                                    {[
                                        { label: 'Facebook', value: socialFacebook, set: setSocialFacebook },
                                        { label: 'Instagram', value: socialInstagram, set: setSocialInstagram },
                                        { label: 'X / Twitter', value: socialX, set: setSocialX },
                                        { label: 'LinkedIn', value: socialLinkedin, set: setSocialLinkedin },
                                        { label: 'YouTube', value: socialYoutube, set: setSocialYoutube },
                                    ].map(({ label, value, set }) => (
                                        <div key={label} className="flex items-center gap-3">
                                            <span className="text-sm text-slate-600 w-24 shrink-0">{label}</span>
                                            <input
                                                type="url"
                                                value={value}
                                                onChange={(e) => set(e.target.value)}
                                                placeholder="https://..."
                                                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Announcement Banner */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-800">Announcement Banner</label>
                                        <p className="text-xs text-slate-500 mt-0.5">Thin bar above the navigation</p>
                                    </div>
                                    <button
                                        onClick={() => setShowBanner(!showBanner)}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${showBanner ? 'bg-blue-600' : 'bg-slate-200'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${showBanner ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                {showBanner && (
                                    <div className="space-y-3 bg-slate-50 rounded-xl p-4">
                                        {defaults.isBannerClassic ? (
                                            <p className="text-sm text-slate-600">This template uses Phone + Hours banner fields. Edit the text directly in the header.</p>
                                        ) : (
                                            <div>
                                                <label className="block text-xs text-slate-600 mb-1">Banner Text</label>
                                                <input
                                                    type="text"
                                                    value={bannerText}
                                                    onChange={(e) => setBannerText(e.target.value)}
                                                    placeholder="🎉 Special offer — Limited time only!"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs text-slate-600 mb-2">Banner Background</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {[
                                                    { value: 'primary' as const, label: 'Primary', color: pPrimary },
                                                    { value: 'secondary' as const, label: 'Secondary', color: pSecondary },
                                                    { value: 'custom' as const, label: 'Custom', color: bannerBgColor || '#000000' },
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setBannerBgType(opt.value)}
                                                        className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-medium transition-all ${bannerBgType === opt.value ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                                                    >
                                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: opt.color }} />
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {bannerBgType === 'custom' && (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <input type="color" value={bannerBgColor || '#000000'} onChange={(e) => setBannerBgColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                                                    <input type="text" value={bannerBgColor} onChange={(e) => setBannerBgColor(e.target.value)} placeholder="#000000" className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Member Sign-In Link */}
                            {siteContent.__hasMembershipBlock && rightSide === 'cta' && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <label className="text-sm font-semibold text-slate-800">"Already a member?" Link</label>
                                            <p className="text-xs text-slate-500 mt-0.5">Shown below the CTA button — links to the sign-in page</p>
                                        </div>
                                        <button
                                            onClick={() => setShowMemberSignIn(!showMemberSignIn)}
                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${showMemberSignIn ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${showMemberSignIn ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    {showMemberSignIn && (
                                        <div className="bg-slate-50 rounded-xl p-4">
                                            <label className="block text-xs text-slate-600 mb-1">Link Text</label>
                                            <input
                                                type="text"
                                                value={memberSignInText}
                                                onChange={(e) => setMemberSignInText(e.target.value)}
                                                placeholder="Already a member? Sign In"
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Product Search */}
                            {siteContent.__hasProductBlock && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <label className="text-sm font-semibold text-slate-800">Product Search</label>
                                            <p className="text-xs text-slate-500 mt-0.5">Show a search icon in the header to let visitors find products</p>
                                        </div>
                                        <button
                                            onClick={() => setShowProductSearch(!showProductSearch)}
                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${showProductSearch ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${showProductSearch ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── STYLE TAB ── */}
                    {activeTab === 'style' && (
                        <>
                            {/* Background */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-3">Header Background</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {([ 'white', 'primary', 'secondary', 'gradient', 'custom' ] as HeaderBgType[]).map((value) => {
                                        const labels: Record<HeaderBgType, string> = {
                                            white: 'White / Default',
                                            primary: 'Primary Color',
                                            secondary: 'Secondary Color',
                                            gradient: 'Gradient',
                                            custom: 'Custom Color',
                                        };
                                        return (
                                            <button
                                                key={value}
                                                onClick={() => setBgType(value)}
                                                className={`flex items-center gap-3 p-3 border rounded-xl text-left transition-all ${bgType === value ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                                            >
                                                <div className="w-8 h-8 rounded-lg shrink-0 shadow-sm" style={getBgPreviewStyle(value)} />
                                                <span className="text-sm font-medium text-slate-800">{labels[value]}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {bgType === 'custom' && (
                                    <div className="flex items-center gap-3 mt-3">
                                        <input type="color" value={bgColor || '#ffffff'} onChange={(e) => setBgColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-slate-200" />
                                        <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} placeholder="#ffffff" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                        <button onClick={() => setBgColor('')} className="px-3 py-2 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Reset</button>
                                    </div>
                                )}
                            </div>

                            {/* Sticky */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-3">Scroll Behavior</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { value: 'always' as const, label: 'Always Visible (Sticky)', desc: 'Header stays fixed at top of screen as you scroll' },
                                        { value: 'none' as const, label: 'Scrolls Away', desc: 'Header scrolls up with the page content' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setSticky(opt.value)}
                                            className={`p-4 border rounded-xl text-left transition-all ${sticky === opt.value ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            <div className="font-semibold text-sm text-slate-900">{opt.label}</div>
                                            <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── TYPOGRAPHY TAB ── */}
                    {activeTab === 'typography' && (
                        <>
                            {/* Font Size */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-1">Nav Item Font Size</label>
                                <p className="text-xs text-slate-500 mb-3">Override the default size (leave blank to use template default)</p>
                                <input
                                    type="text"
                                    value={navFontSize}
                                    onChange={(e) => setNavFontSize(e.target.value)}
                                    placeholder="e.g. 14px, 0.875rem, 1rem"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {['12px', '13px', '14px', '15px', '16px', '18px'].map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setNavFontSize(navFontSize === size ? '' : size)}
                                            className={`px-2 py-1 text-xs rounded border transition-colors ${navFontSize === size ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                        >{size}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Font Weight */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-3">Nav Item Font Weight</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: '300', label: 'Light' },
                                        { value: '400', label: 'Regular' },
                                        { value: '500', label: 'Medium' },
                                        { value: '600', label: 'Semi-Bold' },
                                        { value: '700', label: 'Bold' },
                                        { value: '800', label: 'Extra Bold' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setNavFontWeight(navFontWeight === opt.value ? '' : opt.value)}
                                            className={`py-2 px-3 border rounded-lg text-sm transition-all ${navFontWeight === opt.value ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                            style={{ fontWeight: parseInt(opt.value) }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Nav Color */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-800 mb-1">Nav Item Color</label>
                                <p className="text-xs text-slate-500 mb-3">Leave blank to use the template's auto color based on background</p>
                                <div className="flex items-center gap-3">
                                    <input type="color" value={navColor || '#666666'} onChange={(e) => setNavColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-slate-200" />
                                    <input type="text" value={navColor} onChange={(e) => setNavColor(e.target.value)} placeholder="Leave blank for auto" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                    {navColor && <button onClick={() => setNavColor('')} className="px-3 py-2 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Clear</button>}
                                </div>
                            </div>
                        </>
                    )}
                    {/* ── CSS TAB ── */}
                    {activeTab === 'css' && (
                        isProUser ? (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-700 mb-1">Custom CSS for the header</p>
                                    <p className="text-xs text-slate-500 mb-3">
                                        Styles are scoped to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">.ks-site-header</code>.
                                        Use child selectors to target elements inside the header,
                                        e.g. <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">a {'{'} letter-spacing: 0.1em; {'}'}</code>
                                    </p>
                                </div>
                                <textarea
                                    value={customCss}
                                    onChange={(e) => setCustomCss(e.target.value)}
                                    placeholder={`/* Example: */\na {\n  letter-spacing: 0.05em;\n  text-transform: uppercase;\n}\n\n.ks-site-header {\n  border-bottom: 2px solid red;\n}`}
                                    className="w-full bg-slate-950 text-green-400 font-mono text-sm p-4 min-h-[280px] outline-none border border-slate-700 rounded-lg resize-y selection:bg-green-900"
                                    spellCheck={false}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                                    <Lock className="w-8 h-8 text-amber-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Custom CSS is a Pro Feature</h3>
                                <p className="text-sm text-slate-500 max-w-sm mb-6">
                                    Upgrade to Pro to add custom CSS to the header. Get full control over styling with scoped CSS.
                                </p>
                                <a
                                    href="/pricing"
                                    className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                                >
                                    <Crown className="w-5 h-5" />
                                    Upgrade to Pro
                                </a>
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors">
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
