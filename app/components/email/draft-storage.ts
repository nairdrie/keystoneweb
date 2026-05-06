// Shared types for email drafts (stored in DB via /api/email/drafts)
export interface EmailDraft {
  id: string;
  site_id: string;
  thread_id: string | null;  // null = compose draft
  address_id: string | null;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  created_at: string;
  updated_at: string;
}

// Split-panel resize preference — the only thing kept in localStorage
const SPLIT_WIDTH_KEY = 'email-split-width';
export const DEFAULT_SPLIT_WIDTH = 360;
export const MIN_SPLIT_WIDTH = 220;
export const MAX_SPLIT_WIDTH = 680;

export function getSplitWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_SPLIT_WIDTH;
  try {
    const saved = localStorage.getItem(SPLIT_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_SPLIT_WIDTH;
  } catch { return DEFAULT_SPLIT_WIDTH; }
}

export function setSplitWidth(width: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SPLIT_WIDTH_KEY, String(width));
}
