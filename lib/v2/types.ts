/**
 * Engine v2 ("agent-built sites") shared types.
 *
 * A v2 site is design (theme + section templates, written by agents),
 * content (field values, owned by the site owner) and structure (pages and the
 * ordered section instances on each). See lib/v2/guide.ts for the authoring
 * contract agents follow.
 */

export const ENGINE_V1 = 'blocks_v1';
export const ENGINE_V2 = 'sections_v2';
export type SiteEngine = typeof ENGINE_V1 | typeof ENGINE_V2;

export type FieldType = 'text' | 'richtext' | 'image' | 'link' | 'bg' | 'toggle' | 'list';

export interface FieldHints {
  label?: string;
  max?: number;          // max characters (text) — enforced by the editor
  aspect?: string;       // e.g. "4/5" (image) — crop ratio in the editor
  minItems?: number;     // lists
  maxItems?: number;     // lists
  optional?: boolean;    // owner may hide this element
}

export interface FieldSchema extends FieldHints {
  id: string;
  type: FieldType;
  /** link fields whose label is made of child markup only edit the href */
  hrefOnly?: boolean;
  /** list fields: schema of one item */
  item?: FieldSchema[];
}

/** Values stored in the content layer, by field type. */
export interface ImageValue { src: string; alt?: string; hidden?: boolean }
export interface LinkValue { href: string; label?: string; newTab?: boolean; hidden?: boolean }
export interface TextValue { html: string; hidden?: boolean }
export type ListItemValue = Record<string, unknown>;
export interface ListValue { items: ListItemValue[]; hidden?: boolean }
export interface ToggleValue { hidden: boolean }

export interface CompileIssue {
  level: 'error' | 'warning';
  rule: string;
  message: string;
  /** short excerpt of the offending markup */
  snippet?: string;
  fix?: string;
}

export interface CompiledSection {
  fields: FieldSchema[];
  defaults: Record<string, unknown>;
  issues: CompileIssue[];
  stats: { boundFields: number; textNodes: number; unboundTextNodes: number };
}

export interface ThemeToken {
  name: string;           // CSS custom property without the leading "--"
  value: string;
  label?: string;
  group?: string;
  type?: 'color' | 'font' | 'length' | 'text';
  editable?: boolean;     // shown to the owner in the Brand panel
}

export interface ThemeRecord {
  tokens: ThemeToken[];
  owner_overrides: Record<string, string>;
  fonts: Array<{ family: string; weights?: string }>;
  global_css: string;
  global_js: string;
  header_section: string | null;
  footer_section: string | null;
  version?: number;
}

export interface SectionRecord {
  key: string;
  name: string;
  html: string;
  css: string;
  js: string;
  schema: CompiledSection | Record<string, never>;
  version?: number;
}

export interface SectionInstance {
  id: string;
  section: string;
  hidden?: boolean;
}

export interface PageRecord {
  id: string;
  slug: string;
  title: string;
  display_name: string;
  is_visible_in_nav: boolean;
  nav_order: number;
  seo: { title?: string; description?: string; ogImage?: string };
  instances: SectionInstance[];
}

export interface SiteMeta {
  id: string;
  title: string;
  logo: string | null;
  favicon: string | null;
  contactEmail: string | null;
  businessProfile: Record<string, unknown> | null;
  domain: string | null;
}

/** Everything needed to render a site. Drafts and releases share this shape. */
export interface SiteBundle {
  site: SiteMeta;
  theme: ThemeRecord;
  sections: Record<string, SectionRecord>;
  pages: PageRecord[];
  /** content[instanceId][fieldId] = value */
  content: Record<string, Record<string, unknown>>;
  /** fields the owner has edited: "instanceId/fieldId" */
  ownerEdited: string[];
}

export type RenderMode = 'published' | 'edit' | 'preview';

export interface Actor {
  type: 'owner' | 'agent' | 'staff';
  label: string;
}

export const GLOBAL_INSTANCE_HEADER = 'header';
export const GLOBAL_INSTANCE_FOOTER = 'footer';
