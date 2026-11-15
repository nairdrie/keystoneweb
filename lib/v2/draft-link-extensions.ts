/**
 * Extensions for expired draft preview links. A draft token's own expiry is
 * baked into its signature, so extending a link records a new expiry for that
 * exact token here; the renderer accepts an expired token while its extension
 * is still running. The URL the owner already shared keeps working.
 */
import type { Db } from './store';
import { draftTokenHash } from './preview-token';

/** How long one "Extend" click keeps a link alive. */
export const DRAFT_LINK_EXTENSION_SECONDS = 7 * 24 * 3600;

/** The extended expiry for a token, or null if it was never extended. */
export async function draftLinkExtendedUntil(db: Db, token: string, siteId: string): Promise<Date | null> {
  try {
    const { data, error } = await db
      .from('v2_draft_link_extensions')
      .select('expires_at')
      .eq('token_hash', draftTokenHash(token))
      .eq('site_id', siteId)
      .maybeSingle();
    if (error || !data?.expires_at) return null;
    return new Date(data.expires_at as string);
  } catch {
    // Fail closed (link stays expired), e.g. before the migration is applied.
    return null;
  }
}

export async function extendDraftLink(db: Db, token: string, siteId: string, userId: string): Promise<Date> {
  const expiresAt = new Date(Date.now() + DRAFT_LINK_EXTENSION_SECONDS * 1000);
  const { error } = await db.from('v2_draft_link_extensions').upsert(
    {
      token_hash: draftTokenHash(token),
      site_id: siteId,
      expires_at: expiresAt.toISOString(),
      extended_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token_hash' },
  );
  if (error) throw new Error(error.message);
  return expiresAt;
}
