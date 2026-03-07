/**
 * Template Registry
 * 
 * Maps templateId → master template component.
 * New format: bold_*, elegant_*, starter_*
 * Also handles legacy formats (_classic, _modern, _minimal, and dash-separated)
 */

export async function getTemplateComponent(
  templateId: string
): Promise<React.ComponentType<any> | null> {
  try {
    const n = templateId.toLowerCase().replace(/-/g, '_');

    // Bold template (was ClassicPro) — trades, mechanics, HVAC
    if (n.includes('bold') || n.includes('classic') || n.includes('pro')) {
      const module = await import('./master/ClassicProTemplate');
      return module.BoldTemplate;
    }
    // Elegant template (was ModernBlue) — salons, consulting, agencies
    else if (n.includes('elegant') || n.includes('modern') || n.includes('blue')) {
      const module = await import('./master/ModernBlueTemplate');
      return module.ModernBlueTemplate;
    }
    // Starter template (was MinimalWhite) — freelancers, cleaning, landscaping
    else if (n.includes('starter') || n.includes('minimal') || n.includes('white') || n.includes('clean')) {
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
  return n.includes('bold') || n.includes('classic') || n.includes('pro') ||
    n.includes('elegant') || n.includes('modern') || n.includes('blue') ||
    n.includes('starter') || n.includes('minimal') || n.includes('white') || n.includes('clean');
}

export function getRegisteredTemplates(): string[] {
  return ['bold', 'elegant', 'starter'];
}
