import { createClient } from '@supabase/supabase-js';

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
}

/**
 * Get metadata for a single template by ID
 */
export async function getTemplateMetadata(
  templateId: string
): Promise<TemplateMetadata | null> {
  const { data, error } = await supabase
    .from('template_metadata')
    .select('*')
    .eq('template_id', templateId)
    .single();

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

  return (data || []) as TemplateMetadata[];
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
