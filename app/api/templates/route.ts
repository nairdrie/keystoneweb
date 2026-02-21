import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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

    // Load templates from metadata.json
    const templatesDir = path.join(process.cwd(), 'public', 'templates');
    const metadataPath = path.join(templatesDir, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      return NextResponse.json(
        { error: 'Templates metadata not found' },
        { status: 500 }
      );
    }

    const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
    const metadataWrapper = JSON.parse(metadataContent);
    const allTemplates = metadataWrapper.templates || [];

    // Filter by businessType and category
    const filteredTemplates = allTemplates.filter(
      (t: any) => t.businessType === businessType && t.category === category
    );

    // Convert to TemplatePreview format
    const templates: Template[] = filteredTemplates.map((t: any) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      tags: t.tags || [],
      // Generate imageUrl from unsplash (placeholder)
      imageUrl: `https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=${encodeURIComponent(t.id)}`,
    }));

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
