/** Client-side helpers and types for the v2 (agent-built site) editor. */

export interface FieldInfo {
  id: string;
  type: 'text' | 'richtext' | 'image' | 'link' | 'bg' | 'toggle' | 'list';
  label?: string;
  max?: number;
  aspect?: string;
  optional?: boolean;
  hrefOnly?: boolean;
  item?: FieldInfo[];
}

export interface InstanceContent {
  page?: string;
  instance: string;
  section: string;
  fields: FieldInfo[];
  values: Record<string, { value: unknown; source: string; rev?: number }>;
}

export interface ThemeTokenInfo {
  name: string;
  value: string;
  label?: string;
  group?: string;
  type?: 'color' | 'font' | 'length' | 'text';
  editable?: boolean;
}

export interface PageInfo {
  id: string;
  slug: string;
  title: string;
  navLabel: string;
  showInNav: boolean;
  navOrder: number;
  seo: { title?: string; description?: string; ogImage?: string };
  sections: Array<{ id: string; section: string; hidden?: boolean }>;
  layoutVersion?: number;
}

export interface EditorState {
  site: {
    id: string;
    title: string;
    isPublished: boolean;
    publishedDomain: string | null;
    domain: string | null;
    logo: string | null;
    contactEmail: string | null;
    businessProfile: Record<string, unknown> | null;
  };
  theme: {
    tokens: ThemeTokenInfo[];
    ownerOverrides: Record<string, string>;
    header: string | null;
    footer: string | null;
  };
  sections: Array<{ key: string; name: string; fields: FieldInfo[] }>;
  pages: PageInfo[];
  ownerEditedFields: string[];
  content: InstanceContent[];
  canvas: { editBase: string; previewBase: string };
  appUrl: string;
}

export class EditorApiError extends Error {
  details?: unknown;
  status?: number;
  constructor(message: string, details?: unknown, status?: number) {
    super(message);
    this.details = details;
    this.status = status;
  }
  /** Someone else (e.g. the AI designer) changed this since the editor loaded it. */
  get isStale(): boolean {
    return this.status === 409 && (this.details as { reason?: string } | undefined)?.reason === 'stale';
  }
}

export async function loadEditorState(siteId: string): Promise<EditorState> {
  const res = await fetch(`/api/v2/editor?siteId=${encodeURIComponent(siteId)}`, { credentials: 'include', cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new EditorApiError(body.error || 'Could not load the editor', body.details);
  return body as EditorState;
}

export async function editorOp<T = Record<string, unknown>>(siteId: string, op: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/api/v2/editor', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId, op, ...args }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new EditorApiError(body.error || 'Something went wrong', body.details, res.status);
  return body as T;
}

export function pagePath(slug: string): string {
  return slug === 'home' ? '' : `/${slug}`;
}

/** Plain text of stored inline/rich HTML, for the form view. */
export function htmlToText(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, '');
  const div = document.createElement('div');
  div.innerHTML = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, '\n\n');
  return (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export function textToHtml(text: string, rich: boolean): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (!rich) return esc(text).replace(/\n/g, '<br>');
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export const FONT_CHOICES = [
  'Inter', 'DM Sans', 'Manrope', 'Outfit', 'Work Sans', 'Poppins', 'Montserrat', 'Space Grotesk', 'Archivo', 'Plus Jakarta Sans',
  'Fraunces', 'Playfair Display', 'Lora', 'Libre Baskerville', 'Cormorant Garamond', 'Source Serif 4', 'DM Serif Display', 'Instrument Serif',
];
