import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/templates/[id]
 * 
 * Returns the full HTML content of a template by ID.
 * This is used when the editor needs to render the complete template.
 * 
 * Returns:
 * {
 *   id: string;
 *   metadata: {...};
 *   html: string;  // Full HTML template content
 * }
 */

interface TemplateMetadata {
  id: string;
  name: string;
  businessType: string;
  category: string;
  style: string;
  tags: string[];
  description: string;
  sections: string[];
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

  try {
    const templatesDir = path.join(process.cwd(), 'public', 'templates');
    const metadataPath = path.join(templatesDir, 'metadata.json');

    // Read metadata.json to find template info
    if (!fs.existsSync(metadataPath)) {
      return NextResponse.json(
        { error: 'Templates metadata not found' },
        { status: 500 }
      );
    }

    const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
    const metadataWrapper = JSON.parse(metadataContent);
    const allTemplates: TemplateMetadata[] = metadataWrapper.templates || [];

    // Find template by ID
    const templateMetadata = allTemplates.find(t => t.id === templateId);

    if (!templateMetadata) {
      return NextResponse.json(
        { error: `Template '${templateId}' not found in metadata` },
        { status: 404 }
      );
    }

    // Map metadata to HTML file path
    // Template naming: {category}-{style}.html or similar
    // For example: svc_handyman_classic -> classic-pro.html (based on style)
    const styleMap: Record<string, string> = {
      'classic': 'classic-pro',
      'modern': 'modern-blue',
      'minimal': 'minimal-white',
    };

    const styleName = styleMap[templateMetadata.style] || templateMetadata.style;
    const htmlFileName = `${styleName}.html`;
    const htmlPath = path.join(
      templatesDir,
      templateMetadata.businessType,
      templateMetadata.category,
      htmlFileName
    );

    // Check if HTML file exists
    if (!fs.existsSync(htmlPath)) {
      console.error(`HTML file not found at: ${htmlPath}`);
      return NextResponse.json(
        { error: `Template HTML file not found: ${htmlFileName}` },
        { status: 404 }
      );
    }

    const html = fs.readFileSync(htmlPath, 'utf-8');

    return NextResponse.json({
      id: templateId,
      metadata: templateMetadata,
      html,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}
