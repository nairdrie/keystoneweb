export type ScraperPreset = 'products' | 'services' | 'content' | 'other';
export type ScraperMode = 'fast' | 'standard' | 'deep';
export type { ContentNormalizationModel } from './models';

export type ScraperProvider =
  | 'shopify'
  | 'woocommerce'
  | 'vagaro'
  | 'squarespace'
  | 'wix'
  | 'bigcommerce'
  | 'webflow'
  | 'generic';

export interface ScrapedProductOption {
  name: string;
  value: string;
}

export interface ScrapedProductVariant {
  id: string;
  name: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  availability: string;
  options: ScrapedProductOption[];
}

export interface ScrapedProduct {
  sourceUrl: string;
  canonicalUrl: string;
  productName: string;
  shortDescription: string;
  fullDescription: string;
  price: string;
  compareAtPrice: string;
  currency: string;
  sku: string;
  brand: string;
  category: string;
  tags: string[];
  mainImageUrl: string;
  additionalImageUrls: string[];
  availability: string;
  variants: ScrapedProductVariant[];
}

export interface ScraperSummary {
  discoveredPages: number;
  productsExtracted: number;
  csvRows: number;
  failedPages: number;
  skippedProducts: number;
  pagesExtracted?: number;
  builderCompatiblePages?: number;
  approximatedPages?: number;
  manualCleanupPages?: number;
  navigationItems?: number;
  globalsFound?: number;
  cachedPages?: number;
  llmPages?: number;
  blogPagesSkipped?: number;
}

export type BuilderCompatibilityStatus = 'supported' | 'approximated' | 'manual_cleanup';

export interface ContentPagePreview {
  title: string;
  url: string;
  slug: string;
  inferredType: string;
  confidence: number;
  compatibilityStatus: BuilderCompatibilityStatus;
  warningsCount: number;
  warnings: string[];
  builderBlocks: string[];
  sourceSectionCount: number;
  builderSectionCount: number;
}

export interface ContentCompatibilityPageReport {
  title: string;
  url: string;
  slug: string;
  inferredType: string;
  confidence: number;
  compatibilityStatus: BuilderCompatibilityStatus;
  supportedSections: number;
  approximatedSections: number;
  unsupportedSections: number;
  manualFollowUpRequired: boolean;
  builderBlocks: string[];
  warnings: string[];
}

export interface ContentCompatibilityReport {
  fullySupportedPages: number;
  approximatedPages: number;
  manualCleanupPages: number;
  supportedSections: number;
  approximatedSections: number;
  unsupportedSections: number;
  manualFollowUpRequired: boolean;
  pages: ContentCompatibilityPageReport[];
}

export interface ContentGlobalsPreview {
  navigationCount: number;
  footerNavigationCount: number;
  hasContactInfo: boolean;
  socialCount: number;
  legalLinkCount: number;
  logoCount: number;
  repeatedGlobalCtaCount: number;
}

export interface ContentExportFileMeta {
  path: string;
  size: number;
}

export interface ContentBudgetPreview {
  maxPages: number;
  maxDepth: number;
  tokenBudget: number;
  estimatedTokensUsed: number;
  llmPagesUsed: number;
  llmFallbackPages: number;
  exhausted: boolean;
}

export interface ContentCachePreview {
  pageHits: number;
  pageMisses: number;
  normalizationHits: number;
  jobHit: boolean;
}

export interface ContentTemplateSuggestion {
  style: string;
  businessType: 'services' | 'products' | 'both';
  reason: string;
}

export interface ContentScraperPreview {
  mode: ScraperMode;
  includeBlog: boolean;
  aiOnly: boolean;
  templateSuggestion: ContentTemplateSuggestion;
  pages: ContentPagePreview[];
  globals: ContentGlobalsPreview;
  compatibility: ContentCompatibilityReport;
  exportFiles: ContentExportFileMeta[];
  budget: ContentBudgetPreview;
  cache: ContentCachePreview;
}

export interface ContentBuilderImportPayload {
  schemaVersion: number;
  generatedAt: string;
  sourceUrl: string;
  mode: ScraperMode;
  includeBlog: boolean;
  aiOnly?: boolean;
  templateSuggestion: {
    style: string;
    businessType: 'services' | 'products' | 'both';
    reason: string;
  };
  builderSiteModel: {
    selectedTemplateStyle: string;
    businessType: 'services' | 'products' | 'both';
    designData: Record<string, unknown>;
    navigation: Array<{
      navOrder: number;
      label: string;
      pageSlug: string;
      href: string;
      linkType: string;
      isVisibleInPrimaryNav: boolean;
    }>;
    footerLinks: Array<{
      label: string;
      url: string;
      external: boolean;
    }>;
    contactInfo: Record<string, unknown>;
  };
  pages: Array<Record<string, unknown>>;
}

export interface ScraperResult {
  preset: ScraperPreset;
  provider: ScraperProvider;
  providerLabel: string;
  csv: string;
  filename: string;
  rawJson: string;
  zipBase64?: string;
  zipFilename?: string;
  warnings: string[];
  summary: ScraperSummary;
  previewRows: string[][];
  contentData?: ContentScraperPreview;
  builderImport?: ContentBuilderImportPayload;
  metadata: {
    sourceUrl: string;
    strategy: string;
    mode?: ScraperMode;
    aiOnly?: boolean;
    traceId?: string;
    normalizationProvider?: string;
    normalizationModel?: string;
    normalizationModelSource?: 'ui' | 'env' | 'default';
  };
}
