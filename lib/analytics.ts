import { createAdminClient } from './db/supabase-admin';

export type AnalyticsEventType =
  | 'user_signup'
  | 'user_signin'
  | 'site_create'
  | 'site_edit'
  | 'site_publish'
  | 'subscription_upgrade'
  | 'subscription_cancel'
  | 'domain_purchase'
  | 'page_view'
  | 'site_delete'
  | 'site_transfer_created'
  | 'site_transfer_accepted';

/**
 * Fire-and-forget analytics event logger.
 * Never throws — a tracking failure must never break the main request flow.
 */
export async function trackEvent(
  eventType: AnalyticsEventType,
  options?: {
    userId?: string | null;
    siteId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('analytics_events').insert({
      event_type: eventType,
      user_id: options?.userId ?? null,
      site_id: options?.siteId ?? null,
      metadata: options?.metadata ?? {},
    });
  } catch (err) {
    console.error('[analytics] Failed to track event:', eventType, err);
  }
}
