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
  customDomain?: string;
  pendingCustomDomain?: string;
  siteSlug?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageData {
  periodStart: string;
  periodEnd: string;
  dayOfMonth: number;
  daysInMonth: number;
  totalVisitors: number;
  totalViews: number;
  visitorLimit: number;
  usagePercent: number;
  overageVisitors: number;
  overageCost: number;
  projectedVisitors: number;
  projectedOverageCost: number;
  overageReported: boolean;
}

export interface UsagePlan {
  name: string;
  visitorLimit: number;
  storageLimitMb: number;
  overagePerThousand: number;
}

export interface SiteUsageBreakdown {
  siteId: string;
  slug: string;
  visitors: number;
  views: number;
}

export interface AdminContextValue {
  siteId: string | null;
  site: AdminSiteData | null;
  siteTitle: string;
  setSiteTitle: (t: string) => void;
  isProUser: boolean;
  palette: Record<string, string>;
  usage: UsageData | null;
  usagePlan: UsagePlan | null;
  siteBreakdown: SiteUsageBreakdown[];
  siteBlockTypes: Set<string>;
}

export const AdminContext = createContext<AdminContextValue>({
  siteId: null,
  site: null,
  siteTitle: 'My Website',
  setSiteTitle: () => {},
  isProUser: false,
  palette: { primary: '#dc2626', secondary: '#1e293b', accent: '#f1f5f9' },
  usage: null,
  usagePlan: null,
  siteBreakdown: [],
  siteBlockTypes: new Set(),
});

export function useAdminContext() {
  return useContext(AdminContext);
}
