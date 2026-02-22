/**
 * Template Registry
 * 
 * Maps templateId → dynamic import path
 * Allows rendering any template component based on ID
 * 
 * Structure:
 * - Each template is a folder: app/templates/[templateName]/
 * - Each template has a page.tsx that exports the component
 * - Dynamic imports allow rendering without loading all templates
 */

// Map of template IDs to their component paths
// This allows us to dynamically import the right template component
const TEMPLATE_REGISTRY: Record<
  string,
  () => Promise<{ default: React.ComponentType<any> }>
> = {
  // Services > Plumber
  'classic-pro-plumber': () =>
    import('./plumber/classic-pro').then((m) => ({ default: m.ClassicProPlumber })),
  'modern-blue-plumber': () =>
    import('./plumber/modern-blue').then((m) => ({ default: m.ModernBluePlumber })),

  // Add more templates as they're converted:
  // Services > Fitness
  // 'minimal-clean-fitness': () =>
  //   import('./fitness/minimal-clean').then((m) => ({ default: m.MinimalCleanFitness })),
  //
  // 'template-id': () => import('./category/component-name').then(m => ({default: m.ComponentName}))
};

/**
 * Get a template component by ID
 * Returns the React component or null if not found
 */
export async function getTemplateComponent(
  templateId: string
): Promise<React.ComponentType<any> | null> {
  const importer = TEMPLATE_REGISTRY[templateId];

  if (!importer) {
    console.warn(`Template not found: ${templateId}`);
    return null;
  }

  try {
    const module = await importer();
    return module.default;
  } catch (error) {
    console.error(`Error loading template ${templateId}:`, error);
    return null;
  }
}

/**
 * Check if a template is registered
 */
export function isTemplateRegistered(templateId: string): boolean {
  return templateId in TEMPLATE_REGISTRY;
}

/**
 * Get all registered template IDs
 */
export function getRegisteredTemplates(): string[] {
  return Object.keys(TEMPLATE_REGISTRY);
}
