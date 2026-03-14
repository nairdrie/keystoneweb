/**
 * Template Registry
 *
 * Maps templateId → master template component.
 * 8 master templates: luxe, vivid, airy, edge, classic, organic, sleek, vibrant
 * Template ID format: {style}_{category} (e.g., "luxe_salon", "edge_mechanic")
 *
 * Also handles legacy formats (bold → classic, elegant → sleek, starter → airy)
 */

export async function getTemplateComponent(
  templateId: string
): Promise<React.ComponentType<any> | null> {
  try {
    const n = templateId.toLowerCase().replace(/-/g, '_');

    // Luxe — sophisticated, centered logo, serif, warm/gold accents
    if (n.includes('luxe')) {
      const module = await import('./master/LuxeTemplate');
      return module.LuxeTemplate;
    }
    // Vivid — bold, colorful, energetic, chunky sans-serif
    if (n.includes('vivid')) {
      const module = await import('./master/VividTemplate');
      return module.VividTemplate;
    }
    // Airy — light, spacious, floating nav, rounded elements
    if (n.includes('airy')) {
      const module = await import('./master/AiryTemplate');
      return module.AiryTemplate;
    }
    // Edge — dark, tech-forward, angular, neon accents
    if (n.includes('edge')) {
      const module = await import('./master/EdgeTemplate');
      return module.EdgeTemplate;
    }
    // Classic — traditional, utility bar + nav, structured, trustworthy
    if (n.includes('classic')) {
      const module = await import('./master/ClassicTemplate');
      return module.ClassicTemplate;
    }
    // Organic — warm, natural, rounded shapes, earthy tones
    if (n.includes('organic')) {
      const module = await import('./master/OrganicTemplate');
      return module.OrganicTemplate;
    }
    // Sleek — ultra-minimal, bold typography, monochrome + accent
    if (n.includes('sleek')) {
      const module = await import('./master/SleekTemplate');
      return module.SleekTemplate;
    }
    // Vibrant — playful, gradient header, rounded elements, dynamic
    if (n.includes('vibrant')) {
      const module = await import('./master/VibrantTemplate');
      return module.VibrantTemplate;
    }

    // Legacy fallbacks
    if (n.includes('bold') || n.includes('pro')) {
      const module = await import('./master/ClassicProTemplate');
      return module.BoldTemplate;
    }
    if (n.includes('elegant') || n.includes('modern') || n.includes('blue')) {
      const module = await import('./master/ModernBlueTemplate');
      return module.ModernBlueTemplate;
    }
    if (n.includes('starter') || n.includes('minimal') || n.includes('white') || n.includes('clean')) {
      const module = await import('./master/MinimalWhiteTemplate');
      return module.MinimalWhiteTemplate;
    }

    console.warn(`Template style not recognized for: ${templateId}`);
    return null;
  } catch (error) {
    console.error(`Error loading template ${templateId}:`, error);
    return null;
  }
}

export function isTemplateRegistered(templateId: string): boolean {
  const n = templateId.toLowerCase().replace(/-/g, '_');
  return (
    n.includes('luxe') || n.includes('vivid') || n.includes('airy') || n.includes('edge') ||
    n.includes('classic') || n.includes('organic') || n.includes('sleek') || n.includes('vibrant') ||
    // Legacy
    n.includes('bold') || n.includes('pro') ||
    n.includes('elegant') || n.includes('modern') || n.includes('blue') ||
    n.includes('starter') || n.includes('minimal') || n.includes('white') || n.includes('clean')
  );
}

export function getRegisteredTemplates(): string[] {
  return ['luxe', 'vivid', 'airy', 'edge', 'classic', 'organic', 'sleek', 'vibrant'];
}
