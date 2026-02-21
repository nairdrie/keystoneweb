import { NextResponse, NextRequest } from 'next/server';

/**
 * GET /api/templates/metadata
 * 
 * Returns paginated template metadata based on business type and category.
 * This is the primary endpoint for fetching templates in the onboarding wizard.
 * 
 * Query params:
 * - businessType: 'services' | 'products' | 'both'
 * - category: category ID (e.g., 'plumber', 'ecommerce')
 * - page: page number (default 1)
 * - limit: results per page (default 12)
 */

// Import all template metadata
// (This will be auto-populated from templates.json)
import templates from '@/public/templates/metadata.json';

interface TemplateMetadata {
  id: string;
  name: string;
  businessType: string;
  category: string;
  tags: string[];
  description: string;
  sections: string[];
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  imageUrl: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessType = searchParams.get('businessType');
  const category = searchParams.get('category');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '12'));

  try {
    // Filter templates by business type and category
    // metadata.json has structure: { version, generatedAt, totalTemplates, categories, templates: [...] }
    const meta = templates as any;
    const templateList: TemplateMetadata[] = meta.templates || [];
    let filtered = templateList.filter((t: TemplateMetadata) => {
      let match = true;
      if (businessType) match = match && t.businessType === businessType;
      if (category) match = match && t.category === category;
      return match;
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = filtered.slice(start, end);

    return NextResponse.json({
      templates: paginated,
      total,
      page,
      limit,
      hasMore: end < total,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
