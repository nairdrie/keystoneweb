/**
 * Site Data Types
 * Core types for the multi-tenant CMS site system
 */

export type BusinessType = 'services' | 'products' | 'both';

export interface SiteData {
  // Core Identifiers
  id: string; // UUID for the site
  userId: string | null; // Null until user authenticates and claims site
  
  // Template & Classification
  selectedTemplateId: string; // ID of the selected template
  businessType: BusinessType; // services | products | both
  category: string; // Category from onboarding (e.g., 'plumber', 'ecommerce')
  
  // Design & Customization
  designData: SiteDesignData;
  
  // Metadata
  createdAt: string; // ISO-8601 timestamp
  updatedAt: string; // ISO-8601 timestamp
  publishedAt?: string; // ISO-8601 timestamp when first published
  
  // Domain & URL
  customDomain?: string; // Custom domain if user purchases one
  siteSlug?: string; // Auto-generated slug (later: user-editable)
}

export interface SiteDesignData {
  // Basic Site Info
  title?: string; // Website title/brand name
  description?: string; // Short tagline/description
  logo?: string; // Logo image URL or base64
  
  // Styling
  colors?: {
    primary?: string; // Primary brand color (hex)
    secondary?: string; // Secondary color
    accent?: string; // Accent color
  };
  
  fonts?: {
    headingFont?: string; // Font family for headings
    bodyFont?: string; // Font family for body text
  };
  
  // Content Sections
  hero?: {
    headline?: string;
    subheadline?: string;
    backgroundImage?: string;
    ctaText?: string;
    ctaUrl?: string;
  };
  
  sections?: Array<{
    id: string;
    type: 'text' | 'gallery' | 'testimonial' | 'features' | 'custom';
    content: Record<string, any>;
  }>;
  
  // Contact & Social
  contactEmail?: string;
  phone?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  
  // SEO
  seoTitle?: string; // Page title for SEO
  seoDescription?: string; // Meta description
  seoKeywords?: string[];
  
  // Footer
  footerText?: string;
  copyrightYear?: number;
  
  // Additional custom data
  [key: string]: any;
}

export interface CreateSiteRequest {
  selectedTemplateId: string;
  businessType: BusinessType;
  category: string;
}

export interface UpdateSiteRequest {
  siteId: string;
  designData: Partial<SiteDesignData>;
}

export interface TemplatePreview {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  tags: string[];
  description?: string;
}

export interface TemplatesResponse {
  templates: TemplatePreview[];
  total: number;
  page: number;
  hasMore: boolean;
}
