/**
 * Content moderation reporting and evidence logging.
 *
 * Handles:
 *  1. Logging a moderation_events row (legal evidence preservation)
 *  2. Reporting to Cybertip.ca (Canadian mandatory reporting obligation)
 *  3. Sending an internal ops alert email
 *
 * Cybertip.ca reporting: No public REST API exists — C3P requires a direct
 * arrangement for programmatic reporting. Contact C3P at cybertip.ca to set
 * up programmatic access. Set CYBERTIP_API_KEY and CYBERTIP_API_URL once
 * credentials are obtained. Until then, this function logs the incident and
 * sends an ops alert so a human can file the Cybertip.ca report manually.
 *
 * Legal context: Mandatory Reporting Act (S.C. 2011, c. 4) requires reporting
 * to Cybertip.ca when advised of an internet address where CSAEM may be
 * publicly available. Bill C-16 (First Reading Dec 2025) will extend this
 * obligation to all internet services and raise the preservation period to 1 year.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendModerationAlert } from '@/lib/email';
import type { ImageModerationResult } from './image-scan';
import type { TextModerationResult } from './text-scan';

export type ModerationIncident = {
  siteId: string | null;
  userId: string | null;
  ipAddress: string | null;
  contentType: 'image' | 'pdf' | 'text';
  contentRef: string | null;         // storage_path for files
  contentHash: string | null;        // perceptual hash from Arachnid Shield
  detectionMethod: 'arachnid_hash' | 'vision_classifier' | 'text_classifier';
  severity: 'csaem' | 'adult' | 'review';
  actionTaken: 'blocked' | 'quarantined' | 'reported';
  rawResponse?: unknown;
};

// ─── 1. Log to moderation_events ─────────────────────────────────────────────

export async function logModerationEvent(incident: ModerationIncident): Promise<string | null> {
  try {
    const db = createAdminClient();

    const { data, error } = await db
      .from('moderation_events')
      .insert({
        site_id:          incident.siteId,
        user_id:          incident.userId,
        ip_address:       incident.ipAddress,
        content_type:     incident.contentType,
        content_ref:      incident.contentRef,
        content_hash:     incident.contentHash,
        detection_method: incident.detectionMethod,
        severity:         incident.severity,
        action_taken:     incident.actionTaken,
        raw_response:     incident.rawResponse ?? null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[moderation] Failed to log moderation event:', error);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error('[moderation] Unexpected error logging moderation event:', err);
    return null;
  }
}

// ─── 2. Report to Cybertip.ca ─────────────────────────────────────────────────

export async function reportToCybertip(
  eventId: string | null,
  incident: ModerationIncident
): Promise<string | null> {
  const apiUrl = process.env.CYBERTIP_API_URL;
  const apiKey = process.env.CYBERTIP_API_KEY;

  if (!apiUrl || !apiKey) {
    // Log warning — ops team must file the Cybertip.ca report manually
    console.warn(
      '[moderation] CYBERTIP_API_URL/CYBERTIP_API_KEY not configured. ' +
      `Manual Cybertip.ca report required for moderation_event ${eventId}. ` +
      'Contact C3P at cybertip.ca to set up programmatic reporting.'
    );
    return null;
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        event_id:     eventId,
        site_id:      incident.siteId,
        content_type: incident.contentType,
        content_ref:  incident.contentRef,
        severity:     incident.severity,
        detected_at:  new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[moderation] Cybertip.ca API error:', response.status, text);
      return null;
    }

    const data = await response.json() as { report_id?: string };
    return data.report_id ?? null;
  } catch (err) {
    console.error('[moderation] Failed to submit Cybertip.ca report:', err);
    return null;
  }
}

// ─── 3. Update event with Cybertip report ID ──────────────────────────────────

export async function saveCybertipReportId(
  eventId: string,
  reportId: string
): Promise<void> {
  try {
    const db = createAdminClient();
    await db
      .from('moderation_events')
      .update({ cybertip_report_id: reportId })
      .eq('id', eventId);
  } catch (err) {
    console.error('[moderation] Failed to save Cybertip report ID:', err);
  }
}

// ─── Convenience: full reporting pipeline ────────────────────────────────────

/**
 * Run the full reporting pipeline for an image moderation result:
 *  1. Log the event
 *  2. Submit to Cybertip.ca (if configured; otherwise alert ops)
 *  3. Save Cybertip report ID back to the event
 *
 * Call this after calling scanImage() when result.reportable is true (CSAEM)
 * or when result.blocked is true (adult/review).
 */
export async function handleModerationResult(
  result: ImageModerationResult | (TextModerationResult & { severity: 'review' }),
  incident: Omit<ModerationIncident, 'severity' | 'detectionMethod' | 'actionTaken'>
): Promise<void> {
  const isImage = 'method' in result;

  const fullIncident: ModerationIncident = {
    ...incident,
    severity:         isImage ? (result as ImageModerationResult).severity as 'csaem' | 'adult' | 'review' : 'review',
    detectionMethod:  isImage
      ? ((result as ImageModerationResult).method === 'arachnid_hash' ? 'arachnid_hash' : 'vision_classifier')
      : 'text_classifier',
    actionTaken:      isImage && (result as ImageModerationResult).reportable ? 'reported' : 'blocked',
    rawResponse:      (result as { rawResponse?: unknown }).rawResponse,
  };

  const eventId = await logModerationEvent(fullIncident);

  let cybertipId: string | null = null;
  if (isImage && (result as ImageModerationResult).reportable && eventId) {
    cybertipId = await reportToCybertip(eventId, fullIncident);
    if (cybertipId) {
      await saveCybertipReportId(eventId, cybertipId);
    }
  }

  // Always send an internal ops alert (fire-and-forget)
  sendModerationAlert({
    eventId,
    severity:         fullIncident.severity,
    contentType:      fullIncident.contentType,
    detectionMethod:  fullIncident.detectionMethod,
    siteId:           fullIncident.siteId,
    userId:           fullIncident.userId,
    contentRef:       fullIncident.contentRef,
    cybertipReportId: cybertipId,
  }).catch((err) => console.error('[moderation] Alert email failed:', err));
}
