'use client';

import { createContext, useContext, ReactNode } from 'react';

export interface BlockData {
  id: string;
  type: string;
  data: Record<string, any>;
}

export interface EditorContextType {
  /** Current content object (templateId -> { key: value }) */
  content: Record<string, any>;

  /** Ordered array of modular blocks for the page **/
  blocks?: BlockData[];

  /** Block CRUD methods **/
  addBlock?: (type: string, index?: number) => void;
  removeBlock?: (id: string) => void;
  moveBlock?: (id: string, direction: 'up' | 'down') => void;
  updateBlockData?: (id: string, key: string, value: any) => void;

  /** Whether we're in edit mode */
  isEditMode: boolean;

  /** Callback to update a content value */
  updateContent: (key: string, value: string) => void;

  /** Current palette being used */
  palette?: Record<string, string>;

  /** Available palettes for this template */
  availablePalettes?: string[];

  /** Change the active palette */
  setPalette?: (paletteKey: string) => void;

  /** Site ID for image uploads */
  siteId?: string;

  /** Function to upload image to Supabase Storage */
  uploadImage?: (file: File, contentKey: string) => Promise<string>;
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
