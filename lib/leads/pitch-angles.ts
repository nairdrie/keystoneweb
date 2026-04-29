// Turns raw audit data (PageSpeed scores + CMS sniff) into:
//   - a numeric pitch_strength used to sort prospects
//   - a list of human-readable pitch angles ops can copy/paste into outreach
//
// Higher pitch_strength = more compelling pitch surface (broken site, no SSL,
// DIY builder, etc.). We deliberately don't normalize this to 0-100 — it's an
// internal sort key.

import type { Cms } from './cms-sniffer';
import type { PageSpeedResult } from './pagespeed';

export interface PitchInputs {
  hasWebsite: boolean;
  audit: PageSpeedResult | null;
  cms: Cms | null;
  cmsConfidence: 'high' | 'medium' | 'low' | null;
  niche: string | null;
  city: string | null;
}

export interface PitchOutput {
  strength: number;
  angles: string[];
}

const CMS_LABELS: Record<Cms, string> = {
  wix: 'Wix',
  squarespace: 'Squarespace',
  weebly: 'Weebly',
  godaddy: 'GoDaddy Website Builder',
  wordpress: 'WordPress',
  shopify: 'Shopify',
  webflow: 'Webflow',
  joomla: 'Joomla',
  drupal: 'Drupal',
  duda: 'Duda',
  unknown: 'unknown CMS',
};

// CMS pitch buckets — affects scoring + framing.
const DIY_BUILDERS = new Set<Cms>(['wix', 'squarespace', 'weebly', 'godaddy', 'duda']);
const LEGACY_CMS = new Set<Cms>(['joomla', 'drupal']);

export function computePitch(inputs: PitchInputs): PitchOutput {
  const angles: string[] = [];
  let strength = 0;

  // --- No website is the strongest possible pitch ---
  if (!inputs.hasWebsite) {
    angles.push('No website — only Google Business Profile');
    strength += 100;
    if (inputs.niche && inputs.city) {
      angles.push(`Competitors in ${inputs.city} are ranking; this ${inputs.niche} isn't`);
      strength += 5;
    }
    return { strength, angles };
  }

  const a = inputs.audit;

  // --- HTTPS / SSL ---
  if (a?.usesHttps === false) {
    angles.push("Site doesn't use HTTPS — browsers show security warnings");
    strength += 40;
  }

  // --- Performance ---
  if (typeof a?.perfScore === 'number') {
    if (a.perfScore < 30) {
      strength += 50;
      angles.push(performanceAngle(a));
    } else if (a.perfScore < 50) {
      strength += 30;
      angles.push(performanceAngle(a));
    } else if (a.perfScore < 70) {
      strength += 10;
    }
  }

  // --- SEO ---
  if (typeof a?.seoScore === 'number') {
    if (a.seoScore < 50) {
      strength += 25;
      angles.push(`Mobile SEO score ${a.seoScore}/100 — likely losing organic traffic`);
    } else if (a.seoScore < 70) {
      strength += 10;
    }
  }

  // --- CMS framing ---
  if (inputs.cms && inputs.cms !== 'unknown' && inputs.cmsConfidence !== 'low') {
    const label = CMS_LABELS[inputs.cms];
    if (DIY_BUILDERS.has(inputs.cms)) {
      strength += 20;
      angles.push(`Built on ${label} — DIY template, easy to upgrade`);
    } else if (LEGACY_CMS.has(inputs.cms)) {
      strength += 30;
      angles.push(`Built on ${label} — legacy CMS, security and maintenance risk`);
    } else if (inputs.cms === 'wordpress') {
      strength += 5;
      angles.push('Built on WordPress — likely outdated theme/plugins');
    }
  }

  // --- Specific failed audits worth calling out ---
  if (a?.failedAudits) {
    if (a.failedAudits.includes('viewport')) {
      strength += 15;
      angles.push('No mobile viewport tag — site renders broken on phones');
    }
    if (a.failedAudits.includes('tap-targets')) {
      strength += 10;
      angles.push('Mobile tap targets too small / too close together');
    }
    if (a.failedAudits.includes('content-width')) {
      strength += 10;
      angles.push("Content doesn't fit mobile viewport (horizontal scrolling)");
    }
    if (a.failedAudits.includes('meta-description')) {
      strength += 5;
      angles.push('Missing meta description (hurts Google snippets)');
    }
    if (a.failedAudits.includes('document-title')) {
      strength += 8;
      angles.push('Missing or broken page title');
    }
    if (a.failedAudits.includes('image-alt')) {
      strength += 3;
      angles.push('Images missing alt text');
    }
  }

  // --- Audit failed entirely (site dead / unreachable) ---
  if (!a) {
    strength += 60;
    angles.push("Couldn't audit the site — likely broken or down");
  }

  return { strength, angles };
}

function performanceAngle(a: PageSpeedResult): string {
  if (a.mobileLoadSeconds && a.mobileLoadSeconds >= 4) {
    return `Mobile site loads in ${a.mobileLoadSeconds}s (Performance ${a.perfScore}/100)`;
  }
  return `Mobile Performance score ${a.perfScore}/100`;
}
