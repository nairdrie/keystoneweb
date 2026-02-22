import {
  getAllTemplateMetadata,
  getTemplateMetadata,
} from '@/lib/db/template-queries';

/**
 * GET /api/templates/metadata
 * 
 * Returns metadata for all templates or filtered results
 * 
 * Query params:
 * - category: Filter by category (e.g., 'plumber', 'fitness')
 * - business_type: Filter by business type (e.g., 'services')
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category') || undefined;
    const businessType = searchParams.get('business_type') || undefined;

    const templates = await getAllTemplateMetadata({
      category: category as string | undefined,
      business_type: businessType as string | undefined,
    });

    return Response.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Error fetching template metadata:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to fetch template metadata',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/templates/metadata/[templateId]
 * 
 * Returns metadata for a specific template
 */
export async function getTemplateMetadataRoute(templateId: string) {
  try {
    const template = await getTemplateMetadata(templateId);

    if (!template) {
      return Response.json(
        {
          success: false,
          error: 'Template not found',
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error(`Error fetching metadata for template ${templateId}:`, error);
    return Response.json(
      {
        success: false,
        error: 'Failed to fetch template metadata',
      },
      { status: 500 }
    );
  }
}
