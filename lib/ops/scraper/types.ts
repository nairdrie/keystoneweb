export type ScraperPreset = 'products' | 'services' | 'content' | 'other';

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
}

export interface ScraperResult {
  preset: ScraperPreset;
  provider: ScraperProvider;
  providerLabel: string;
  csv: string;
  filename: string;
  rawJson: string;
  warnings: string[];
  summary: ScraperSummary;
  previewRows: string[][];
  metadata: {
    sourceUrl: string;
    strategy: string;
  };
}
