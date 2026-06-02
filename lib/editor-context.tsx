'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useContext, ReactNode } from 'react';

export interface BlockData {
  id: string;
  type: string;
  data: Record<string, any>;
}

export interface SideBySideBackgroundOverrideState {
  parentBlockId: string;
  enabled: boolean;
  disable: () => void;
}

export interface NavItem {
  id: string;
  label: string;
  linkType: 'page' | 'section' | 'custom';
  href: string;
  pageId?: string;
  blockId?: string;
  /** When the linked page contains a Products block, optionally scope it to a category via ?category= */
  categoryFilter?: string;
  /** Optional subcategory companion to categoryFilter (?subcategory=) */
  subcategoryFilter?: string;
  /** Optional sub-items for dropdown menus */
  children?: NavItem[];
  /**
   * Which header bar this item renders on. Defaults to 'primary'.
   * Used when the secondary navigation bar is enabled in Header Settings.
   */
  bar?: 'primary' | 'secondary';
}

export interface EditorContextType {
  /** Current page-level content */
  content: Record<string, any>;

  /** Site-level content (header title, CTA, etc.) — shared across all pages */
  siteContent: Record<string, any> & {
    titleFont?: string;
    bodyFont?: string;
  };

  /** Update a site-level content value (header fields) */
  updateSiteContent: (key: string, value: any) => void;

  /** Dynamic nav menu items (site-level) */
  navItems: NavItem[];

  /** Replace the entire navItems array */
  updateNavItems: (items: NavItem[]) => void;

  /** Available pages for linking */
  pages?: Array<{ id: string; slug: string; title: string }>;

  /** Current page id, used to resolve "Current page" section links */
  currentPageId?: string;

  /** Current template id, used for template-scoped defaults such as card presets */
  currentTemplateId?: string;

  /** Ordered array of modular blocks for the page **/
  blocks?: BlockData[];

  /** Block CRUD methods **/
  addBlock?: (type: string, index?: number) => void;
  removeBlock?: (id: string) => void;
  moveBlock?: (id: string, direction: 'up' | 'down') => void;
  updateBlockData?: (id: string, key: string, value: any) => void;
  updateBlockDataBatch?: (id: string, updates: Record<string, any>) => void;
  sideBySideBackgroundOverride?: SideBySideBackgroundOverrideState;
  isAiBuilderActive?: boolean;
  /** Whether we're in edit mode */
  isEditMode: boolean;

  /** Callback to update a page-level content value */
  updateContent: (key: string, value: string) => void;

  /** Current palette being used */
  palette?: Record<string, string>;

  /** Available palettes for this template */
  availablePalettes?: string[];

  /** Change the active palette */
  setPalette?: (paletteKey: string) => void;

  /** Site ID for image uploads */
  siteId?: string;

  /** Site category for contextual suggestions (e.g. Unsplash default search) */
  siteCategory?: string;

  /** Function to upload image to Supabase Storage */
  uploadImage?: (file: File, contentKey: string) => Promise<string>;

  /** Track an unsaved change in the editor history */
  addChange?: (field: string, label: string, from: string, to: string) => void;

  /** Whether the current user is on a Pro subscription */
  isProUser?: boolean;

  /**
   * Run a navigation/side-effect action, prompting the user first if there
   * are unsaved changes in the editor. Used by blocks (e.g. product grid)
   * that link to other parts of the app.
   */
  requestNavigation?: (action: () => void) => void;

  /**
   * When set, indicates the site is being viewed in draft preview mode.
   * NavMenu and SiteHeader use this to generate /preview?siteId=X&pageId=Y
   * links instead of /{slug} links.
   */
  previewSiteId?: string;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export interface EditorProviderProps {
  children: ReactNode;
  value: EditorContextType;
}

/**
 * Provider that wraps the template with editor context
 * Used in the editor page to pass edit mode, content, and callbacks to templates
 */
export function EditorProvider({ children, value }: EditorProviderProps) {
  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}

/**
 * Hook to access editor context from within templates
 * Templates use this to know if they're in edit mode, access current content, etc.
 */
export function useEditorContext(): EditorContextType | undefined {
  return useContext(EditorContext);
}

/**
 * Per-block data context. Each block wraps its render in <BlockDataProvider value={data}>
 * so descendant EditableText components can resolve their styleData (stored under
 * `${contentKey}__styles`) without every call site having to thread the prop manually.
 *
 * `saveMeta` is an optional sibling persistence channel used to write per-field
 * metadata (e.g. `${contentKey}__removed`) without going through the block's
 * bespoke per-item onSave handler.
 */
interface BlockDataContextValue {
  data: Record<string, unknown> | undefined;
  saveMeta?: (key: string, value: unknown) => void;
}

const BlockDataContext = createContext<BlockDataContextValue | undefined>(undefined);

export function BlockDataProvider({
  value,
  saveMeta,
  children,
}: {
  value: Record<string, unknown> | undefined;
  saveMeta?: (key: string, value: unknown) => void;
  children: ReactNode;
}) {
  return (
    <BlockDataContext.Provider value={{ data: value, saveMeta }}>
      {children}
    </BlockDataContext.Provider>
  );
}

export function useBlockData(): Record<string, unknown> | undefined {
  return useContext(BlockDataContext)?.data;
}

export function useBlockMetaSave(): ((key: string, value: unknown) => void) | undefined {
  return useContext(BlockDataContext)?.saveMeta;
}

