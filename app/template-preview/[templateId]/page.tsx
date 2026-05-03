import EditorContent, { type SiteData } from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata, type TemplateMetadata } from '@/lib/db/template-queries';
import { getStructuralTemplateMetadata } from '@/lib/templates/structural-templates';
import type { BlockData, NavItem } from '@/lib/editor-context';

export const dynamic = 'force-dynamic';

const FALLBACK_PALETTE = {
  primary: '#111827',
  secondary: '#dc2626',
  accent: '#f8fafc',
};

const FALLBACK_NAMES: Record<string, string> = {
  luxe: 'Maison Atelier',
  vivid: 'Pulse Studio',
  airy: 'Airy Wellness',
  edge: 'Edge Labs',
  classic: 'Hargrove & Associates',
  organic: 'Maple & Root',
  sleek: 'Northline Studio',
  vibrant: 'Bright Market',
  atlas: 'Atlas Advisory',
  editorial: 'Northstar Journal',
  booked: 'Booked Wellness',
  menu: 'Juniper Table',
  craft: 'Oak & Thread',
  retro: 'Neon House',
  proof: 'Proof Partners',
  gallery: 'Northlight Studio',
};

const PREVIEW_WIDTH = 1440;
const PREVIEW_HEIGHT = 810;

type PageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function TemplatePreviewPage({ params }: PageProps) {
  const { templateId } = await params;
  const cleanTemplateId = decodeURIComponent(templateId);
  const metadata = await loadTemplateMetadata(cleanTemplateId);
  const TemplateComp = await getTemplateComponent(cleanTemplateId);

  if (!TemplateComp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">
        Template preview unavailable.
      </div>
    );
  }

  const rawContent = metadata?.default_content || getFallbackContent(cleanTemplateId);
  const blocks = normalizeBlocks(rawContent.blocks, cleanTemplateId);
  const previewBlocks = blocks.slice(0, 1);
  const selectedPalette = getString(rawContent.__selectedPalette) || 'default';
  const paletteData = selectPalette(metadata, selectedPalette, cleanTemplateId);
  const navItems = normalizeNavItems(rawContent.__navItems, blocks);
  const designData = {
    ...rawContent,
    siteTitle: getString(rawContent.siteTitle) || FALLBACK_NAMES[cleanTemplateId] || metadata?.name || 'Template Preview',
    navButtonText: getString(rawContent.navButtonText) || 'Start',
    __selectedPalette: selectedPalette,
    __navItems: navItems,
    __pages: [{ id: 'home', slug: 'home', title: 'Home' }],
    __hasProductBlock: previewBlocks.some((block) => block.type === 'productGrid'),
    __hasMembershipBlock: previewBlocks.some((block) => block.type === 'membershipGate'),
    __hasChatSupportBlock: previewBlocks.some((block) => block.type === 'chatSupport'),
    blocks: previewBlocks,
  };

  const previewSite: SiteData = {
    id: `template-preview-${cleanTemplateId}`,
    userId: null,
    selectedTemplateId: cleanTemplateId,
    businessType: metadata?.business_type || '',
    category: metadata?.category || '',
    designData,
    isPublished: false,
    createdAt: '',
    updatedAt: '',
  };
  const previewBackground = paletteData.accent || '#ffffff';

  return (
    <div className="template-preview-frame min-h-screen" style={{ backgroundColor: previewBackground }}>
      <style>{`
        nextjs-portal,
        [data-nextjs-toast],
        [data-nextjs-dialog],
        [data-nextjs-dev-tools-button],
        [data-nextjs-dev-tools-panel] {
          display: none !important;
        }

        html,
        body {
          width: ${PREVIEW_WIDTH}px !important;
          height: ${PREVIEW_HEIGHT}px !important;
          min-width: ${PREVIEW_WIDTH}px !important;
          min-height: ${PREVIEW_HEIGHT}px !important;
          max-width: ${PREVIEW_WIDTH}px !important;
          max-height: ${PREVIEW_HEIGHT}px !important;
          margin: 0 !important;
          overflow: hidden !important;
          background: ${previewBackground} !important;
        }

        .template-preview-frame,
        .template-preview-frame > div,
        .template-preview-frame .template-wrapper,
        .template-preview-frame .template-wrapper main,
        .template-preview-frame .template-wrapper main > div,
        .template-preview-frame .template-wrapper main [data-tour="builder-section-frame"]:first-child,
        .template-preview-frame .template-wrapper main [data-tour="builder-section-frame"]:first-child .ks-block,
        .template-preview-frame .template-wrapper main [data-tour="builder-section-frame"]:first-child .ks-block > * {
          width: ${PREVIEW_WIDTH}px !important;
          height: ${PREVIEW_HEIGHT}px !important;
          min-width: ${PREVIEW_WIDTH}px !important;
          min-height: ${PREVIEW_HEIGHT}px !important;
          max-width: ${PREVIEW_WIDTH}px !important;
          max-height: ${PREVIEW_HEIGHT}px !important;
          overflow: hidden !important;
        }

        .template-preview-frame .template-wrapper main {
          flex: none !important;
        }

        .template-preview-frame .template-wrapper main [data-tour="builder-section-frame"]:first-child .ks-block {
          background: var(--accent, ${previewBackground}) !important;
        }

        .template-preview-frame .template-wrapper main [data-tour="builder-section-frame"]:not(:first-child),
        .template-preview-frame .template-wrapper footer {
          display: none !important;
        }

        .template-preview-frame .template-wrapper,
        .template-preview-frame .template-wrapper main,
        .template-preview-frame .template-wrapper > div {
          background: ${previewBackground} !important;
        }
      `}</style>
      <EditorContent
        isPublicView={true}
        isPreviewView={true}
        publicSiteData={previewSite}
        precomputedPalette={paletteData}
      >
        <TemplateComp palette={paletteData} isEditMode={false} />
      </EditorContent>
    </div>
  );
}

async function loadTemplateMetadata(templateId: string): Promise<TemplateMetadata | null> {
  const structural = getStructuralTemplateMetadata(templateId);
  if (structural) return structural as TemplateMetadata;

  try {
    return await getTemplateMetadata(templateId);
  } catch (error) {
    console.error(`Error loading template preview metadata for ${templateId}:`, error);
    return null;
  }
}

function selectPalette(
  metadata: TemplateMetadata | null,
  selectedPalette: string,
  templateId: string
): Record<string, string> {
  const palettes = metadata?.palettes || {};
  const requestedPalette = selectedPalette === 'custom' ? 'default' : selectedPalette;
  return palettes[requestedPalette] || palettes.default || Object.values(palettes)[0] || {
    ...FALLBACK_PALETTE,
    secondary: getFallbackAccent(templateId),
  };
}

function normalizeBlocks(value: unknown, templateId: string): BlockData[] {
  const fallbackBlocks = getFallbackContent(templateId).blocks;
  const rawBlocks: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray(fallbackBlocks)
      ? fallbackBlocks
      : [];

  return rawBlocks
    .map((block, index) => {
      const record = getRecord(block);
      const type = getString(record.type);
      if (!type) return null;

      return {
        id: getString(record.id) || `template-preview-${templateId}-${index}`,
        type,
        data: getRecord(record.data),
      };
    })
    .filter((block): block is BlockData => Boolean(block));
}

function normalizeNavItems(value: unknown, blocks: BlockData[]): NavItem[] {
  if (Array.isArray(value)) {
    const navItems = value
      .map((item, index) => normalizeNavItem(item, index))
      .filter((item): item is NavItem => Boolean(item));
    if (navItems.length > 0) return navItems;
  }

  const sectionTarget = blocks.find((block) => block.type !== 'hero')?.id || blocks[0]?.id || 'home';
  return [
    { id: 'home', label: 'Home', linkType: 'section', href: '#home', blockId: blocks[0]?.id },
    { id: 'work', label: 'Work', linkType: 'section', href: `#${sectionTarget}`, blockId: sectionTarget },
    { id: 'contact', label: 'Contact', linkType: 'section', href: '#contact' },
  ];
}

function normalizeNavItem(value: unknown, index: number): NavItem | null {
  const record = getRecord(value);
  const label = getString(record.label);
  if (!label) return null;

  const linkType = record.linkType === 'page' || record.linkType === 'custom' ? record.linkType : 'section';
  const href = getString(record.href) || '#';
  return {
    id: getString(record.id) || `preview-nav-${index}`,
    label,
    linkType,
    href,
    pageId: getString(record.pageId),
    blockId: getString(record.blockId),
    children: Array.isArray(record.children)
      ? record.children
          .map((child, childIndex) => normalizeNavItem(child, childIndex))
          .filter((child): child is NavItem => Boolean(child))
      : undefined,
  };
}

function getFallbackContent(templateId: string): Record<string, unknown> {
  const siteTitle = FALLBACK_NAMES[templateId] || 'Template Preview';
  return {
    siteTitle,
    navButtonText: 'Start',
    __navItems: [
      { id: 'home', label: 'Home', linkType: 'section', href: '#home' },
      { id: 'services', label: 'Services', linkType: 'section', href: '#services' },
      { id: 'contact', label: 'Contact', linkType: 'section', href: '#contact' },
    ],
    blocks: [
      {
        type: 'hero',
        data: {
          title: `${siteTitle} website preview`,
          subtitle: 'A polished starting point using the live template renderer.',
          buttonText: 'Get Started',
        },
      },
      { type: 'stats', data: {} },
      { type: 'servicesGrid', data: {} },
      { type: 'cta', data: {} },
    ],
  };
}

function getFallbackAccent(templateId: string): string {
  const accents: Record<string, string> = {
    luxe: '#c9a96e',
    vivid: '#f97316',
    airy: '#38bdf8',
    edge: '#a855f7',
    classic: '#1e40af',
    organic: '#65a30d',
    sleek: '#0f172a',
    vibrant: '#ec4899',
    atlas: '#2f6f73',
    editorial: '#b91c1c',
    booked: '#0f9f8f',
    menu: '#d97706',
    craft: '#c46a3a',
    retro: '#ff4fd8',
    proof: '#15803d',
    gallery: '#111111',
  };
  return accents[templateId] || FALLBACK_PALETTE.secondary;
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
