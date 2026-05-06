export interface ComposeDraft {
  id: string;
  addressId: string | null;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  savedAt: string;
}

export interface ReplyDraft {
  bodyHtml: string;
  bodyText: string;
  ccDraft: string;
  bccDraft: string;
  savedAt: string;
}

function composeDraftKey(siteId: string) {
  return `email-compose-drafts-${siteId}`;
}

function replyDraftKey(siteId: string, threadId: string) {
  return `email-reply-draft-${siteId}-${threadId}`;
}

export function getComposeDrafts(siteId: string): ComposeDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(composeDraftKey(siteId)) ?? '[]');
  } catch { return []; }
}

export function saveComposeDraft(siteId: string, draft: ComposeDraft): void {
  if (typeof window === 'undefined') return;
  const drafts = getComposeDrafts(siteId);
  const idx = drafts.findIndex(d => d.id === draft.id);
  if (idx >= 0) drafts[idx] = draft;
  else drafts.unshift(draft);
  localStorage.setItem(composeDraftKey(siteId), JSON.stringify(drafts));
}

export function deleteComposeDraft(siteId: string, draftId: string): void {
  if (typeof window === 'undefined') return;
  const drafts = getComposeDrafts(siteId).filter(d => d.id !== draftId);
  localStorage.setItem(composeDraftKey(siteId), JSON.stringify(drafts));
}

export function getReplyDraft(siteId: string, threadId: string): ReplyDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(replyDraftKey(siteId, threadId));
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

export function saveReplyDraft(siteId: string, threadId: string, draft: ReplyDraft): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(replyDraftKey(siteId, threadId), JSON.stringify(draft));
}

export function clearReplyDraft(siteId: string, threadId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(replyDraftKey(siteId, threadId));
}

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
