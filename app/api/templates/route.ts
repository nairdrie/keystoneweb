import { NextRequest, NextResponse } from 'next/server';
import { getAllTemplateMetadata, type TemplateMetadata } from '@/lib/db/template-queries';
import {
  ALL_TEMPLATE_STYLES,
  getStructuralTemplatesForSelection,
  getTemplateStyleTag,
  isStructuralTemplateId,
} from '@/lib/templates/structural-templates';
import { formatTemplateNameForCategory } from '@/lib/templates/template-category-labels';
import { getTemplatePreviewImage } from '@/lib/template-preview-assets';

interface Template {
  id: string;
  name: string;
  category: string;
  imageUrl?: string;
  tags: string[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const businessType = searchParams.get('businessType');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');

    if (!businessType || !category) {
      return NextResponse.json(
        { error: 'businessType and category are required' },
        { status: 400 }
      );
    }

    // Fetch from database and append universal structural templates so every
    // onboarding category can start from a layout-specific option.
    const dbTemplates = await getAllTemplateMetadata({
      category,
      business_type: businessType,
    });
    const structuralTemplates = getStructuralTemplatesForSelection();
    const structuralTemplateIds = new Set(structuralTemplates.map((template) => template.template_id));

    const mergedById = new Map<string, TemplateMetadata>();
    for (const template of [...dbTemplates, ...structuralTemplates]) {
      mergedById.set(template.template_id, template);
    }

    const styleOrder = new Map<string, number>(ALL_TEMPLATE_STYLES.map((style, index) => [style, index]));
    const templatesForSelection = Array.from(mergedById.values()).sort((a, b) => {
      const aStyle = ALL_TEMPLATE_STYLES.find((style) => a.template_id.toLowerCase().includes(style));
      const bStyle = ALL_TEMPLATE_STYLES.find((style) => b.template_id.toLowerCase().includes(style));
      return (styleOrder.get(aStyle || '') ?? 999) - (styleOrder.get(bStyle || '') ?? 999);
    });

    // Extract style tag from template_id (e.g. "luxe_salon" → "Luxe")
    const getStyleTag = (id: string): string => getTemplateStyleTag(id);

    // Convert to TemplatePreview format
    const templates: Template[] = templatesForSelection.map((t) => {
      const styleTag = getStyleTag(t.template_id);
      const tags = [styleTag, 'Multi-page'].filter(Boolean);
      const shouldUseCategoryName = structuralTemplateIds.has(t.template_id) || isStructuralTemplateId(t.template_id);
      if (t.business_type === 'products') tags.push('Shop');
      if (t.business_type === 'services') tags.push('Booking');
      if (t.business_type === 'portfolio') tags.push('Portfolio');
      if (t.business_type === 'both') tags.push('Flexible');
      return {
        id: t.template_id,
        name: shouldUseCategoryName ? formatTemplateNameForCategory(t.name, category) : t.name,
        category: t.category,
        tags,
        imageUrl: getTemplatePreviewImage(t.template_id) || t.thumbnail_url || `/templates/luxe.png`,
      };
    });

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTemplates = templates.slice(startIndex, endIndex);

    return NextResponse.json({
      templates: paginatedTemplates,
      total: templates.length,
      page,
      hasMore: endIndex < templates.length,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
