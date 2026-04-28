import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { auditUrl, type PageSpeedResult } from '@/lib/leads/pagespeed';
import { sniffCms, type CmsResult } from '@/lib/leads/cms-sniffer';
import { computePitch } from '@/lib/leads/pitch-angles';

// PageSpeed audits take 10–30s each. With 60s function timeout we can
// process ~3 in parallel safely. Run the cron multiple times per day so
// pending always drains.
const BATCH_SIZE = 5;
const PARALLELISM = 3;

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();

  // Pull oldest pending prospects with a website. Stale 'auditing' rows
  // (older than 10 minutes — i.e. a previous run timed out mid-flight)
  // get re-claimed.
  const reclaimCutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: pending } = await db
    .from('lead_prospects')
    .select('id, website, name, city, region, business_types')
    .or(`audit_status.eq.pending,and(audit_status.eq.auditing,audit_attempted_at.lt.${reclaimCutoff})`)
    .not('website', 'is', null)
    .order('discovered_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (!pending || pending.length === 0) {
    return NextResponse.json({ message: 'no pending prospects', audited: 0 });
  }

  // Mark them auditing so a concurrent cron run doesn't re-pick the same rows.
  const ids = pending.map((p) => p.id);
  await db
    .from('lead_prospects')
    .update({ audit_status: 'auditing', audit_attempted_at: new Date().toISOString() })
    .in('id', ids);

  // Process in chunks of PARALLELISM
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (let i = 0; i < pending.length; i += PARALLELISM) {
    const chunk = pending.slice(i, i + PARALLELISM);
    const settled = await Promise.allSettled(chunk.map((p) => auditOne(db, p)));
    for (let j = 0; j < settled.length; j++) {
      const s = settled[j];
      const id = chunk[j].id;
      if (s.status === 'fulfilled') {
        results.push({ id, ok: true });
      } else {
        const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
        results.push({ id, ok: false, error: msg });
        // Mark failed so we don't loop on the same broken site forever.
        await db
          .from('lead_prospects')
          .update({
            audit_status: 'failed',
            audit_completed_at: new Date().toISOString(),
            audit_error: msg.slice(0, 500),
          })
          .eq('id', id);
      }
    }
  }

  console.log(
    `[cron/leads/audit] processed ${results.length} (${results.filter((r) => r.ok).length} ok, ` +
      `${results.filter((r) => !r.ok).length} failed)`,
  );

  return NextResponse.json({
    audited: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    errors: results.filter((r) => r.error).map((r) => ({ id: r.id, error: r.error })),
  });
}

async function auditOne(
  db: ReturnType<typeof createAdminClient>,
  prospect: {
    id: string;
    website: string | null;
    name: string;
    city: string | null;
    region: string | null;
    business_types: string[] | null;
  },
) {
  if (!prospect.website) return;

  // Run PageSpeed and CMS sniff in parallel — independent network calls.
  const [psiSettled, cmsSettled] = await Promise.allSettled([
    auditUrl(prospect.website),
    sniffCms(prospect.website),
  ]);

  const audit: PageSpeedResult | null =
    psiSettled.status === 'fulfilled' ? psiSettled.value : null;
  const cms: CmsResult | null =
    cmsSettled.status === 'fulfilled' ? cmsSettled.value : null;

  // Derive a "primary niche" string from the business_types for the pitch
  // copy (Google's types are like 'plumber', 'electrician', etc.).
  const niche = prospect.business_types?.[0]?.replace(/_/g, ' ') ?? null;

  const pitch = computePitch({
    hasWebsite: true,
    audit,
    cms: cms?.cms ?? null,
    cmsConfidence: cms?.confidence ?? null,
    niche,
    city: prospect.city,
  });

  const psiError =
    psiSettled.status === 'rejected'
      ? psiSettled.reason instanceof Error
        ? psiSettled.reason.message
        : String(psiSettled.reason)
      : null;

  await db
    .from('lead_prospects')
    .update({
      audit_status: 'audited',
      audit_completed_at: new Date().toISOString(),
      audit_error: psiError ? psiError.slice(0, 500) : null,
      perf_score: audit?.perfScore ?? null,
      seo_score: audit?.seoScore ?? null,
      best_practices_score: audit?.bestPracticesScore ?? null,
      accessibility_score: audit?.accessibilityScore ?? null,
      mobile_load_seconds: audit?.mobileLoadSeconds ?? null,
      uses_https: audit?.usesHttps ?? null,
      failed_audits: audit?.failedAudits ?? [],
      cms: cms?.cms ?? 'unknown',
      cms_confidence: cms?.confidence ?? null,
      cms_signals: cms ? { signals: cms.signals, finalUrl: cms.finalUrl } : null,
      pitch_angles: pitch.angles,
      pitch_strength: pitch.strength,
    })
    .eq('id', prospect.id);
}
