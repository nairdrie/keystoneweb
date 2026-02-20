import { NextResponse } from 'next/server';
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

interface TemplateData {
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
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const templateId = params.id;

  try {
    // Template file structure: /public/templates/{businessType}/{category}/{id}.json
    // HTML file: /public/templates/{businessType}/{category}/{id}.html

    // First, search for the template metadata in all subdirectories
    const templatesDir = path.join(process.cwd(), 'public', 'templates');
    
    let templateData: TemplateData | null = null;
    let htmlPath: string | null = null;

    // Recursively search for template files
    function searchTemplates(dir: string): boolean {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (searchTemplates(fullPath)) return true;
        } else if (entry.name === `${templateId}.json`) {
          templateData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          htmlPath = fullPath.replace('.json', '.html');
          return true;
        }
      }
      return false;
    }

    if (!searchTemplates(templatesDir)) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Read HTML content
    if (!htmlPath || !fs.existsSync(htmlPath)) {
      return NextResponse.json(
        { error: 'Template HTML not found' },
        { status: 404 }
      );
    }

    const html = fs.readFileSync(htmlPath, 'utf-8');

    return NextResponse.json({
      id: templateId,
      metadata: templateData,
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
