import { createClient } from '@supabase/supabase-js';
import {
  getStructuralTemplateMetadata,
  getStructuralTemplatesForSelection,
} from '@/lib/templates/structural-templates';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface TemplateMetadata {
  id: string;
  template_id: string;
  name: string;
  description: string;
  category: string;
  business_type: string;
  palettes: Record<string, Record<string, string>>;
  customizables: Record<string, string[]>;
  thumbnail_url: string;
  multi_page: boolean;
  has_blog: boolean;
  has_gallery: boolean;
  created_at: string;
  updated_at: string;
  default_content?: Record<string, unknown>;
}

/**
 * Get metadata for a single template by ID
 */
export async function getTemplateMetadata(
  templateId: string
): Promise<TemplateMetadata | null> {
  const structuralTemplate = getStructuralTemplateMetadata(templateId);
  if (structuralTemplate) return structuralTemplate as TemplateMetadata;

  // First try exact match
  let { data, error } = await supabase
    .from('template_metadata')
    .select('*')
    .eq('template_id', templateId)
    .maybeSingle();

  if (!data) {
    // If exact match not found (e.g. templateId is just "luxe" instead of "luxe_photographer"),
    // fallback to the first template that starts with this style
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('template_metadata')
      .select('*')
      .ilike('template_id', `${templateId}\\_%`)
      .limit(1)
      .maybeSingle();
      
    data = fallbackData;
    error = fallbackError;
  }

  if (error) {
    console.error(`Error fetching template metadata for ${templateId}:`, error);
    return null;
  }

  return data as TemplateMetadata;
}

/**
 * Get all templates with optional filtering
 */
export async function getAllTemplateMetadata(filters?: {
  category?: string;
  business_type?: string;
}): Promise<TemplateMetadata[]> {
  let query = supabase.from('template_metadata').select('*');

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.business_type) {
    query = query.eq('business_type', filters.business_type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching template metadata:', error);
    return [];
  }

  const structuralTemplates = getStructuralTemplatesForSelection().filter((template) => {
    const categoryMatches =
      !filters?.category ||
      template.category === filters.category ||
      template.category === 'general';
    const businessTypeMatches =
      !filters?.business_type ||
      template.business_type === filters.business_type ||
      template.business_type === 'both';
    return categoryMatches && businessTypeMatches;
  });

  const mergedById = new Map<string, TemplateMetadata>();
  for (const template of (data || []) as TemplateMetadata[]) {
    mergedById.set(template.template_id, template);
  }
  for (const template of structuralTemplates) {
    mergedById.set(template.template_id, template as TemplateMetadata);
  }

  return Array.from(mergedById.values());
}

/**
 * Get palette for a template
 */
export async function getTemplatePalette(
  templateId: string,
  paletteKey: string = 'default'
): Promise<Record<string, string> | null> {
  const metadata = await getTemplateMetadata(templateId);
  if (!metadata) return null;

  return metadata.palettes[paletteKey] || metadata.palettes['default'] || null;
}

/**
 * Get customizable fields for a template
 */
export async function getTemplateCustomizables(
  templateId: string
): Promise<Record<string, string[]> | null> {
  const metadata = await getTemplateMetadata(templateId);
  if (!metadata) return null;

  return metadata.customizables;
}

/**
 * Get all available palette names for a template
 */
export async function getAvailablePalettes(
  templateId: string
): Promise<string[]> {
  const metadata = await getTemplateMetadata(templateId);
  if (!metadata) return [];

  return Object.keys(metadata.palettes);
}
