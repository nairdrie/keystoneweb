'use client';

import EditableText from '@/app/components/EditableText';
import EditableButton from '@/app/components/EditableButton';
import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';
import Link from 'next/link';
import NavMenu from '@/app/components/NavMenu';
import HeaderCartIcon from '@/app/components/ecommerce/HeaderCartIcon';
import HeaderLanguageSelector from '@/app/components/HeaderLanguageSelector';
import { Menu, X, Phone } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

interface MasterTemplateProps {
    palette: Record<string, string>;
    isEditMode: boolean;
    children?: React.ReactNode;
}

/**
 * Classic Template — Traditional, structured, trustworthy.
 * Top utility bar + main nav below, structured grid, professional serif/sans pairing.
 * Perfect for plumbers, electricians, HVAC, consulting, trades.
 */
export function ClassicTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#1e3a5f';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f8fafc';

    const titleFont = siteContent.titleFont || 'Merriweather';
    const bodyFont = siteContent.bodyFont || 'Source Sans 3';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;700;900&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6, .template-wrapper .font-title {
                    font-family: "${titleFont}", serif !important;
                }
            `}} />

            {/* Top utility bar */}
            <div className="text-white text-xs py-2" style={{ backgroundColor: pPrimary }}>
                <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 opacity-80">
                        <Phone className="w-3 h-3" />
                        <span>Call us: (555) 123-4567</span>
                    </span>
                    <span className="opacity-60 hidden sm:block">Mon-Fri 8am - 6pm</span>
                </div>
            </div>

            {/* Main header */}
            <header className="sticky top-0 z-50 bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <Link
                            href={isEditor ? `/editor?siteId=${context?.siteId}&pageId=${context?.pages?.find(p => p.slug === 'home')?.id || ''}` : '/'}
                            aria-label="Home"
                            className="flex items-center gap-3 transition-opacity hover:opacity-90"
                        >
                            {siteContent.siteLogo ? (
                                <img src={siteContent.siteLogo} alt="" className="w-10 h-10 object-contain"  style={{ height: siteContent.headerLogoHeight ? `${siteContent.headerLogoHeight}px` : undefined, width: siteContent.headerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div className="w-10 h-10 rounded flex items-center justify-center font-bold text-sm text-white" style={{ backgroundColor: pPrimary }}>
                                    {(siteContent.siteTitle || 'C')[0]?.toUpperCase()}
                                </div>
                            )}
                            <EditableText
                                as="div"
                                contentKey="siteTitle"
                                styleData={siteContent['siteTitle__styles']}
                                content={siteContent.siteTitle}
                                defaultValue="Classic Services"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="text-xl font-bold font-title"
                                style={{ color: pPrimary }}
                            />
                        </Link>

                        <div className="hidden md:flex items-center gap-8">
                            <NavMenu
                                className="flex items-center gap-6"
                                itemClassName="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
                                submenuClassName="bg-white border border-gray-200 shadow-xl"
                            />
                            <HeaderLanguageSelector />
                            <HeaderCartIcon color={pPrimary} />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Get a Quote"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-6 py-2.5 rounded text-white text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: pSecondary }}
                            />
                        </div>

                        <div className="flex md:hidden items-center gap-2">
                            <HeaderCartIcon color={pPrimary} />
                            <button className="p-2 text-gray-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>

                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-gray-100 py-4 space-y-2">
                            <NavMenu
                                className="flex flex-col gap-1"
                                itemClassName="text-sm font-semibold text-gray-700 hover:text-gray-900 py-2 px-3 rounded hover:bg-gray-50 transition-colors"
                            />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Get a Quote"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="w-full mt-3 px-5 py-2.5 rounded text-white text-sm font-bold flex items-center justify-center"
                                style={{ backgroundColor: pSecondary }}
                            />
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — structured two-row */}
            <footer style={{ backgroundColor: pPrimary }}>
                <div className="max-w-7xl mx-auto px-4 py-12">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            {siteContent.siteLogo ? (
                                <img src={siteContent.siteLogo} alt="" className="w-10 h-10 object-contain rounded"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div className="w-10 h-10 rounded flex items-center justify-center font-bold text-sm text-white" style={{ backgroundColor: pSecondary }}>
                                    {(siteContent.siteTitle || 'C')[0]?.toUpperCase()}
                                </div>
                            )}
                            <div>
                                <div className="font-bold text-lg text-white font-title">{siteContent.siteTitle || 'Classic Services'}</div>
                                <p className="text-sm text-white/50 mt-1">Professional service you can trust.</p>
                            </div>
                        </div>
                        <EditableButton
                            contentKey="navButtonText"
                            label={siteContent.navButtonText}
                            linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                            defaultLabel="Get a Quote"
                            isEditMode={isEditMode}
                            onSave={updateSiteContent}
                            className="px-8 py-3 rounded text-white text-sm font-bold transition-all hover:opacity-90 cursor-pointer inline-flex items-center justify-center"
                            style={{ backgroundColor: pSecondary }}
                        />
                    </div>
                </div>
                <div className="border-t border-white/10 py-4">
                    <div className="max-w-7xl mx-auto px-4 text-center">
                        <p className="text-xs text-white/30">
                            Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
