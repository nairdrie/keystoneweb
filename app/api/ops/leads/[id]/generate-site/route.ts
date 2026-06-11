import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { generateSiteForLead, type LeadGenerationEvent } from '@/lib/leads/generate-site';

export const runtime = 'nodejs';
export const maxDuration = 300;

// POST /api/ops/leads/[id]/generate-site
// One-click AI site generation for a lead. Enriches the lead from Google
// (Place details, Business Profile photos, reviews), derives branding from
// their real photos via Claude vision, then runs the same multi-pass AI
// builder users get and materializes the result as a draft site owned by the
// operator, linked into the launch pipeline.
//
// Body: { prompt?: string } — optional extra build instructions. Works with
// no prompt at all: the enrichment is the brief.
//
// Streams NDJSON progress events: {type:'progress'|'result'|'error', ...}.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const prompt = body && typeof body.prompt === 'string' ? body.prompt.slice(0, 2000) : undefined;

  const db = createAdminClient();

  const { data: lead, error: leadErr } = await db
    .from('leads')
    .select('id, business_name, contact_name, email, phone, website, business_type, business_subcategory, industry, address, city, region, notes')
    .eq('id', id)
    .single();

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }
  if (!lead.business_name?.trim()) {
    return NextResponse.json(
      { error: 'Add a business name to this lead before generating a site.' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: LeadGenerationEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        } catch {
          /* controller already closed */
        }
      };

      try {
        await generateSiteForLead(db, { lead, operatorUserId: access.userId, prompt }, send);
      } catch (err) {
        console.error('[ops/leads/generate-site] unhandled error:', err);
        send({ type: 'error', message: 'Something went wrong while generating the site. Please try again.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
