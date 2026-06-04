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
  inboxCustomEmail?: string;
  marketingEnabled?: boolean;
  googleAdsCustomerId?: string | null;
  auctionsEnabled?: boolean;
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
  refreshInboxUnread: () => void;
  focusMode: boolean;
  setFocusMode: (v: boolean) => void;
  /** Register whether the current tab has unsaved edits (drives nav guards). */
  setHasUnsavedChanges: (v: boolean) => void;
  /**
   * Run `action` only after confirming the user is OK losing unsaved changes.
   * If nothing is dirty, the action runs immediately.
   */
  confirmNavigation: (action: () => void) => void;
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
  refreshInboxUnread: () => {},
  focusMode: false,
  setFocusMode: () => {},
  setHasUnsavedChanges: () => {},
  confirmNavigation: (action) => action(),
});

export function useAdminContext() {
  return useContext(AdminContext);
}
