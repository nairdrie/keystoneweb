import { NextRequest, NextResponse } from 'next/server';
import { getAllTemplateMetadata } from '@/lib/db/template-queries';

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

    // Fetch from database
    const dbTemplates = await getAllTemplateMetadata({
      category,
      business_type: businessType,
    });

    // Extract style tag from template_id (e.g. "luxe_salon" → "Luxe")
    const getStyleTag = (id: string): string => {
      const styles = ['luxe', 'vivid', 'airy', 'edge', 'classic', 'organic', 'sleek', 'vibrant'];
      for (const style of styles) {
        if (id.toLowerCase().includes(style)) {
          return style.charAt(0).toUpperCase() + style.slice(1);
        }
      }
      // Legacy fallback
      if (id.includes('bold')) return 'Bold';
      if (id.includes('elegant')) return 'Elegant';
      if (id.includes('starter')) return 'Starter';
      return '';
    };

    // Convert to TemplatePreview format
    const templates: Template[] = dbTemplates.map((t) => {
      const styleTag = getStyleTag(t.template_id);
      const tags = [styleTag, 'Multi-page'].filter(Boolean);
      if (t.business_type === 'products') tags.push('Shop');
      if (t.business_type === 'services') tags.push('Booking');
      return {
        id: t.template_id,
        name: t.name,
        category: t.category,
        tags,
        imageUrl: t.thumbnail_url || `https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=${encodeURIComponent(t.template_id)}`,
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
