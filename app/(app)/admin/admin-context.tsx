'use client';

import { createContext, useContext } from 'react';

export interface AdminSiteData {
  id: string;
  selectedTemplateId: string;
  businessType: string;
  category: string;
  designData: Record<string, any>;
  publishedData?: Record<string, any>;
  isPublished: boolean;
  publishedDomain?: string;
  siteSlug?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminContextValue {
  siteId: string | null;
  site: AdminSiteData | null;
  siteTitle: string;
  setSiteTitle: (t: string) => void;
  isProUser: boolean;
  palette: Record<string, string>;
}

export const AdminContext = createContext<AdminContextValue>({
  siteId: null,
  site: null,
  siteTitle: 'My Website',
  setSiteTitle: () => {},
  isProUser: false,
  palette: { primary: '#dc2626', secondary: '#1e293b', accent: '#f1f5f9' },
});

export function useAdminContext() {
  return useContext(AdminContext);
}
