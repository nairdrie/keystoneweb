import React from 'react';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import MemberSignInPage from '@/app/components/membership/MemberSignInPage';
import MemberSignUpPage from '@/app/components/membership/MemberSignUpPage';
import MemberProfilePage from '@/app/components/membership/MemberProfilePage';
import ForgotPasswordPage from '@/app/components/membership/ForgotPasswordPage';

export const MEMBER_SYSTEM_ROUTES = ['signin', 'signup', 'member', 'forgot-password'];

/**
 * Check if a given slug is a membership system route and the site has the membership block.
 */
export function isMemberSystemRoute(slug: string): boolean {
  return MEMBER_SYSTEM_ROUTES.includes(slug);
}

export function hasMembershipBlockInPages(allPages: any[]): boolean {
  return (allPages || []).some((p: any) =>
    ((p.published_data || p.design_data)?.blocks || []).some((b: any) => b.type === 'membershipGate')
  );
}

/**
 * Render a membership system page (signin, signup, member profile, forgot-password).
 * Returns the JSX for the page, wrapped in the site's template shell for consistent header/footer.
 */
export async function renderMemberSystemPage({
  site,
  slug,
  allPages,
}: {
  site: any;
  slug: string;
  allPages: any[];
}) {
  const sitePublishData = site.published_data || {};

  // Resolve palette
  const metadata = await getTemplateMetadata(site.selected_template_id);
  const palettesObj = metadata?.palettes || {};
  const requestedPalette = sitePublishData.__selectedPalette || 'default';
  let palette: Record<string, string>;
  if (requestedPalette === 'custom') {
    const defaultPalette = palettesObj['default'] || {};
    palette = {
      primary: sitePublishData.__customPalette_primary || defaultPalette.primary || '',
      secondary: sitePublishData.__customPalette_secondary || defaultPalette.secondary || '',
      accent: sitePublishData.__customPalette_accent || defaultPalette.accent || '',
    };
  } else {
    palette = palettesObj[requestedPalette] || palettesObj['default'] || {};
  }

  const siteName = site.site_slug || '';
  const branding = { siteLogo: sitePublishData.headerLogo || sitePublishData.siteLogo || '' };

  const pageComponents: Record<string, React.ReactElement> = {
    signin: <MemberSignInPage siteId={site.id} siteName={siteName} palette={palette} branding={branding} />,
    signup: <MemberSignUpPage siteId={site.id} siteName={siteName} palette={palette} branding={branding} />,
    member: <MemberProfilePage siteId={site.id} siteName={siteName} palette={palette} />,
    'forgot-password': <ForgotPasswordPage siteId={site.id} siteName={siteName} palette={palette} branding={branding} />,
  };

  return pageComponents[slug] || null;
}
