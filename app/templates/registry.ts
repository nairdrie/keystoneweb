/**
 * Template Registry
 *
 * Maps templateId to a master template component.
 * Template ID format: {style}_{category} (for example, "luxe_salon").
 *
 * The structural styles reuse the closest master shell; their block data,
 * section order, and scoped block CSS provide the visual differentiation.
 */

interface TemplateShellProps {
  palette: Record<string, string>;
  isEditMode: boolean;
  children?: React.ReactNode;
}

type TemplateComponent = React.ComponentType<TemplateShellProps>;

export async function getTemplateComponent(templateId: string): Promise<TemplateComponent | null> {
  try {
    const n = templateId.toLowerCase().replace(/-/g, '_');

    if (n.includes('luxe')) {
      const templateModule = await import('./master/LuxeTemplate');
      return templateModule.LuxeTemplate;
    }
    if (n.includes('vivid')) {
      const templateModule = await import('./master/VividTemplate');
      return templateModule.VividTemplate;
    }
    if (n.includes('airy')) {
      const templateModule = await import('./master/AiryTemplate');
      return templateModule.AiryTemplate;
    }
    if (n.includes('edge')) {
      const templateModule = await import('./master/EdgeTemplate');
      return templateModule.EdgeTemplate;
    }
    if (n.includes('classic')) {
      const templateModule = await import('./master/ClassicTemplate');
      return templateModule.ClassicTemplate;
    }
    if (n.includes('organic')) {
      const templateModule = await import('./master/OrganicTemplate');
      return templateModule.OrganicTemplate;
    }
    if (n.includes('sleek')) {
      const templateModule = await import('./master/SleekTemplate');
      return templateModule.SleekTemplate;
    }
    if (n.includes('vibrant')) {
      const templateModule = await import('./master/VibrantTemplate');
      return templateModule.VibrantTemplate;
    }

    if (n.includes('atlas')) {
      const templateModule = await import('./master/SleekTemplate');
      return templateModule.SleekTemplate;
    }
    if (n.includes('editorial')) {
      const templateModule = await import('./master/LuxeTemplate');
      return templateModule.LuxeTemplate;
    }
    if (n.includes('booked')) {
      const templateModule = await import('./master/AiryTemplate');
      return templateModule.AiryTemplate;
    }
    if (n.includes('menu') || n.includes('craft')) {
      const templateModule = await import('./master/OrganicTemplate');
      return templateModule.OrganicTemplate;
    }
    if (n.includes('retro')) {
      const templateModule = await import('./master/VibrantTemplate');
      return templateModule.VibrantTemplate;
    }
    if (n.includes('proof')) {
      const templateModule = await import('./master/ClassicTemplate');
      return templateModule.ClassicTemplate;
    }
    if (n.includes('gallery')) {
      const templateModule = await import('./master/SleekTemplate');
      return templateModule.SleekTemplate;
    }

    if (n.includes('bold') || n.includes('pro')) {
      const templateModule = await import('./master/ClassicProTemplate');
      return templateModule.BoldTemplate;
    }
    if (n.includes('elegant') || n.includes('modern') || n.includes('blue')) {
      const templateModule = await import('./master/ModernBlueTemplate');
      return templateModule.ModernBlueTemplate;
    }
    if (n.includes('starter') || n.includes('minimal') || n.includes('white') || n.includes('clean')) {
      const templateModule = await import('./master/MinimalWhiteTemplate');
      return templateModule.MinimalWhiteTemplate;
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
    n.includes('atlas') || n.includes('editorial') || n.includes('booked') || n.includes('menu') ||
    n.includes('craft') || n.includes('retro') || n.includes('proof') || n.includes('gallery') ||
    n.includes('bold') || n.includes('pro') ||
    n.includes('elegant') || n.includes('modern') || n.includes('blue') ||
    n.includes('starter') || n.includes('minimal') || n.includes('white') || n.includes('clean')
  );
}

export function getRegisteredTemplates(): string[] {
  return [
    'luxe',
    'vivid',
    'airy',
    'edge',
    'classic',
    'organic',
    'sleek',
    'vibrant',
    'atlas',
    'editorial',
    'booked',
    'menu',
    'craft',
    'retro',
    'proof',
    'gallery',
  ];
}
