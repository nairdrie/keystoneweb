// One-click AI site generation for ops leads.
//
// Runs the SAME three-pass orchestrator the user-facing AI onboarding wizard
// uses (plan → home → pages), but feeds it a brief assembled from the lead
// record plus Google enrichment (verified contact info, hours, reviews,
// Business Profile photos, and vision-derived branding), then materializes
// the result server-side as a draft site owned by the operator — ready to
// preview on a cold call.

import { createAdminClient } from '@/lib/db/supabase-admin';
import { orchestrateNewSiteBuild, type OrchestratorOperation, type ProgressEvent } from '@/lib/ai/builder-orchestrator';
import { type WizardData } from '@/lib/ai/builder-schema';
import { createSiteFromAiOperations } from '@/lib/ai/apply-operations';
import { sanitizeAiCustomColors } from '@/lib/ai/block-capabilities';
import { enrichLead, type LeadEnrichment } from '@/lib/leads/enrich';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export interface LeadRecord {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  business_type: string | null;
  business_subcategory: string | null;
  industry: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  notes: string | null;
}

export type LeadGenerationEvent =
  | { type: 'progress'; step: string; message: string }
  | { type: 'result'; siteId: string; siteTitle: string; launchRequestId: string | null; generationId: string }
  | { type: 'error'; message: string };

export interface GenerateSiteForLeadInput {
  lead: LeadRecord;
  operatorUserId: string;
  prompt?: string;
}

// Lead industry → AI builder category vocabulary (site-architecture.ts).
// Unmapped industries fall back to description-based inference.
const INDUSTRY_TO_CATEGORY: Record<string, { category?: string; businessType: string; label: string }> = {
  automotive: { category: 'mechanic', businessType: 'services', label: 'Automotive' },
  landscaping: { category: 'landscaping', businessType: 'services', label: 'Landscaping' },
  accounting: { businessType: 'services', label: 'Accounting' },
  handyman: { category: 'handyman', businessType: 'services', label: 'Handyman' },
  roofing: { category: 'trades', businessType: 'services', label: 'Roofing' },
  real_estate: { businessType: 'services', label: 'Real Estate' },
  dental: { category: 'clinic', businessType: 'services', label: 'Dental' },
  spa: { category: 'wellness', businessType: 'services', label: 'Spa' },
  plumbing: { category: 'plumber', businessType: 'services', label: 'Plumbing' },
  electrical: { category: 'electrician', businessType: 'services', label: 'Electrical' },
  hvac: { category: 'hvac', businessType: 'services', label: 'HVAC' },
  cleaning: { category: 'cleaning', businessType: 'services', label: 'Cleaning' },
  salon: { category: 'salon', businessType: 'services', label: 'Salon / Barber' },
  fitness: { category: 'fitness', businessType: 'services', label: 'Fitness' },
  restaurant: { category: 'restaurant', businessType: 'services', label: 'Restaurant' },
  legal: { businessType: 'services', label: 'Legal' },
  medical: { category: 'clinic', businessType: 'services', label: 'Medical' },
  construction: { category: 'trades', businessType: 'services', label: 'Construction' },
  painting: { category: 'trades', businessType: 'services', label: 'Painting' },
  pest_control: { category: 'trades', businessType: 'services', label: 'Pest Control' },
  photography: { category: 'photographer', businessType: 'portfolio', label: 'Photography' },
  retail: { category: 'products', businessType: 'products', label: 'Retail' },
};

export async function generateSiteForLead(
  db: SupabaseAdmin,
  input: GenerateSiteForLeadInput,
  emit: (event: LeadGenerationEvent) => void,
): Promise<void> {
  const { lead, operatorUserId } = input;
  const businessName = lead.business_name?.trim();
  if (!businessName) {
    emit({ type: 'error', message: 'Add a business name to this lead before generating a site.' });
    return;
  }

  // ── Record the generation attempt up front so the dashboard sees it ───────
  const { data: generation, error: generationError } = await db
    .from('lead_site_generations')
    .insert({
      lead_id: lead.id,
      status: 'generating',
      prompt: input.prompt?.trim() || null,
      created_by_user_id: operatorUserId,
    })
    .select('id')
    .single();

  if (generationError || !generation) {
    // Log the real Postgres error so the cause is diagnosable. The most common
    // reason is migration 090 not being applied (the table doesn't exist yet).
    console.error('[leads/generate-site] failed to insert lead_site_generations:', generationError);
    const tableMissing = generationError?.code === '42P01'
      || /relation .*lead_site_generations.* does not exist/i.test(generationError?.message ?? '');
    emit({
      type: 'error',
      message: tableMissing
        ? 'Site generation isn\'t set up yet — the database migration (090_lead_site_generations_and_autopilot.sql) needs to be applied.'
        : `Failed to record the generation: ${generationError?.message ?? 'unknown error'}. Try again.`,
    });
    return;
  }
  const generationId = generation.id as string;

  const fail = async (message: string) => {
    await db
      .from('lead_site_generations')
      .update({ status: 'failed', error: message.slice(0, 1000), completed_at: new Date().toISOString() })
      .eq('id', generationId);
    emit({ type: 'error', message });
  };

  try {
    // ── Enrichment ───────────────────────────────────────────────────────────
    emit({ type: 'progress', step: 'enrich', message: `Searching Google for ${businessName}…` });

    const placeId = await findPromotedProspectPlaceId(db, lead.id);
    const enrichment = await enrichLead({
      businessName,
      city: lead.city,
      region: lead.region,
      address: lead.address,
      website: lead.website,
      placeId,
    });

    if (enrichment.photoUrls?.length) {
      emit({ type: 'progress', step: 'enrich', message: 'Analyzing their Business Profile photos for branding…' });
    }

    await db
      .from('lead_site_generations')
      .update({ enrichment: enrichmentSummaryForStorage(enrichment) })
      .eq('id', generationId);

    // ── Build the brief and run the same orchestrator users get ─────────────
    const wizardData = buildWizardDataForLead(lead, enrichment, input.prompt);
    const availablePalettes = await fetchAiTemplatePalettes(db);

    let operations: OrchestratorOperation[] | null = null;
    let orchestratorError: string | null = null;

    await orchestrateNewSiteBuild(
      { wizardData, availablePalettes },
      (event: ProgressEvent) => {
        if (event.type === 'progress') {
          emit({ type: 'progress', step: event.step, message: event.message });
        } else if (event.type === 'result') {
          operations = event.operations;
        } else if (event.type === 'error') {
          orchestratorError = event.message;
        }
      },
    );

    if (!operations) {
      await fail(orchestratorError || 'The AI build did not produce a site. Try again.');
      return;
    }

    // ── Ground the generated site in the enriched facts ─────────────────────
    emit({ type: 'progress', step: 'finalize', message: 'Filling in their real contact details and photos…' });
    let finalOperations = applyEnrichmentToOperations(operations, lead, enrichment);
    finalOperations = ensureBrandColors(finalOperations, enrichment);

    // ── Materialize as a draft site owned by the operator ───────────────────
    const mapping = INDUSTRY_TO_CATEGORY[lead.industry ?? ''] ?? { businessType: 'services', label: lead.business_type || 'Business' };
    const applied = await createSiteFromAiOperations(db, {
      userId: operatorUserId,
      slugBase: businessName,
      businessType: mapping.businessType,
      category: mapping.category || lead.business_type || 'other',
      operations: finalOperations,
    });

    // ── Link into the launch service pipeline ────────────────────────────────
    const launchRequestId = await upsertLaunchRequest(db, lead, applied.siteId, operatorUserId);
    await db.from('leads').update({ status: 'building' }).eq('id', lead.id).in('status', ['new', 'researching', 'contacted', 'qualified', 'proposal_sent', 'negotiating']);

    await db
      .from('lead_site_generations')
      .update({
        status: 'succeeded',
        site_id: applied.siteId,
        launch_request_id: launchRequestId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', generationId);

    emit({
      type: 'result',
      siteId: applied.siteId,
      siteTitle: applied.siteTitle,
      launchRequestId,
      generationId,
    });
  } catch (err) {
    console.error('[leads/generate-site] failed:', err);
    await fail(err instanceof Error ? err.message : 'Site generation failed.');
  }
}

async function findPromotedProspectPlaceId(db: SupabaseAdmin, leadId: string): Promise<string | null> {
  const { data } = await db
    .from('lead_prospects')
    .select('place_id')
    .eq('promoted_lead_id', leadId)
    .maybeSingle();
  return data?.place_id ?? null;
}

async function fetchAiTemplatePalettes(db: SupabaseAdmin): Promise<string[]> {
  const { data } = await db
    .from('template_metadata')
    .select('palettes')
    .eq('template_id', 'custom_ai')
    .maybeSingle();
  return data?.palettes && typeof data.palettes === 'object' ? Object.keys(data.palettes) : [];
}

export function buildWizardDataForLead(lead: LeadRecord, enrichment: LeadEnrichment, prompt?: string): WizardData {
  const businessName = lead.business_name?.trim() || 'the business';
  const location = [lead.city, lead.region].filter(Boolean).join(', ')
    || enrichment.place?.address
    || '';

  const mapping = INDUSTRY_TO_CATEGORY[lead.industry ?? ''];
  const niche = lead.business_subcategory || lead.business_type || mapping?.label || '';

  const descriptionParts: string[] = [
    `A website for "${businessName}"${niche ? `, a ${niche} business` : ''}${location ? ` in ${location}` : ''}.`,
  ];
  if (enrichment.place?.editorialSummary) {
    descriptionParts.push(`Google describes them as: ${enrichment.place.editorialSummary}`);
  }
  if (enrichment.websiteMeta?.description) {
    descriptionParts.push(`Their current website says: "${enrichment.websiteMeta.description}"`);
  }
  if (enrichment.place?.rating && enrichment.place.reviewCount) {
    descriptionParts.push(`They have a ${enrichment.place.rating}-star Google rating across ${enrichment.place.reviewCount} reviews.`);
  }
  if (enrichment.reviews && enrichment.reviews.length > 0) {
    const quotes = enrichment.reviews.slice(0, 3).map((review) => `"${review.text.slice(0, 200)}"`).join(' / ');
    descriptionParts.push(`Real customer review excerpts (use these to inform testimonials and copy, paraphrase rather than fabricate): ${quotes}`);
  }
  if (lead.notes) {
    descriptionParts.push(`Operator research notes: ${lead.notes.slice(0, 400)}`);
  }
  if (prompt?.trim()) {
    descriptionParts.push(`Operator build instructions (highest priority): ${prompt.trim()}`);
  }

  const extrasParts: string[] = [];
  const phone = lead.phone || enrichment.place?.phone;
  const email = lead.email;
  const address = lead.address || enrichment.place?.address;
  const hours = enrichment.place?.hours?.join('; ');
  const factLines = [
    phone ? `phone ${phone}` : null,
    email ? `email ${email}` : null,
    address ? `address ${address}` : null,
    hours ? `hours ${hours}` : null,
  ].filter(Boolean);
  if (factLines.length > 0) {
    extrasParts.push(`Use these EXACT verified business details wherever contact info appears (do not invent placeholders): ${factLines.join(' | ')}.`);
  }
  if (enrichment.branding?.styleKeywords?.length) {
    extrasParts.push(`Brand style direction from their real business photos: ${enrichment.branding.styleKeywords.join(', ')}.`);
  }
  if (enrichment.branding?.imageryNotes) {
    extrasParts.push(`Their imagery: ${enrichment.branding.imageryNotes}`);
  }
  if (enrichment.branding?.primary || enrichment.branding?.secondary || enrichment.branding?.accent) {
    const colors = [
      enrichment.branding.primary ? `primary ${enrichment.branding.primary}` : null,
      enrichment.branding.secondary ? `secondary ${enrichment.branding.secondary}` : null,
      enrichment.branding.accent ? `accent ${enrichment.branding.accent}` : null,
    ].filter(Boolean).join(', ');
    extrasParts.push(`Set these brand colors with setCustomColors (derived from their real photos): ${colors}.`);
  }

  return {
    description: descriptionParts.join(' ').slice(0, 2500),
    extras: extrasParts.join(' ').slice(0, 1500) || undefined,
    businessType: mapping?.businessType,
    category: mapping?.category,
    categoryLabel: niche || undefined,
  };
}

// Deterministically overwrite contact-ish blocks with verified data and swap
// stock sample media for the business's real Google Business Profile photos.
export function applyEnrichmentToOperations(
  operations: OrchestratorOperation[],
  lead: LeadRecord,
  enrichment: LeadEnrichment,
): OrchestratorOperation[] {
  const phone = lead.phone || enrichment.place?.phone || null;
  const email = lead.email || null;
  const address = lead.address || enrichment.place?.address || null;
  const hours = enrichment.place?.hours?.length ? enrichment.place.hours.join('\n') : null;
  const businessName = lead.business_name?.trim() || 'Our location';

  const photoQueue = [...(enrichment.photoUrls ?? [])];
  const nextPhoto = () => photoQueue.shift() ?? null;
  // Round-robin reuse once the queue is exhausted so galleries still fill.
  const allPhotos = enrichment.photoUrls ?? [];

  const isStockOrEmpty = (value: unknown) =>
    !value || (typeof value === 'string' && /images\.unsplash\.com/.test(value));

  const updateBlock = (blockType: string | undefined, data: Record<string, unknown>) => {
    if (!blockType) return data;

    if (blockType === 'contact') {
      if (phone) data.phone = phone;
      if (email) data.email = email;
      if (address) data.address = address;
      if (hours) data.hours = hours;
    }

    if (blockType === 'map' && address) {
      data.address = address;
      data.locations = [{
        id: 'loc-1',
        label: businessName,
        address,
        ...(enrichment.place?.latitude != null && enrichment.place?.longitude != null
          ? { latitude: enrichment.place.latitude, longitude: enrichment.place.longitude }
          : {}),
      }];
    }

    if (allPhotos.length > 0) {
      if (blockType === 'gallery' && Array.isArray(data.images)) {
        const replaceAll = (data.images as unknown[]).every((image) => {
          const url = typeof image === 'string' ? image : (image as Record<string, unknown>)?.url;
          return isStockOrEmpty(url);
        });
        if (replaceAll) {
          data.images = allPhotos.slice(0, Math.max((data.images as unknown[]).length, 6));
        }
      }
      if (blockType === 'image' && isStockOrEmpty(data.image)) {
        const photo = nextPhoto();
        if (photo) data.image = photo;
      }
      if (blockType === 'aboutImageText' && isStockOrEmpty(data.image)) {
        const photo = nextPhoto();
        if (photo) data.image = photo;
      }
      if (blockType === 'hero' && Array.isArray(data.cards)) {
        for (const card of data.cards as Array<Record<string, unknown>>) {
          if (!card || typeof card !== 'object') continue;
          const background = card.background as Record<string, unknown> | undefined;
          if (background?.type === 'image') {
            const image = (background.image ?? {}) as Record<string, unknown>;
            if (isStockOrEmpty(image.url)) {
              const photo = nextPhoto();
              if (photo) background.image = { ...image, url: photo };
            }
          }
          const content = card.content as Record<string, unknown> | undefined;
          const contentImage = content?.image as Record<string, unknown> | undefined;
          if (contentImage?.enabled && isStockOrEmpty(contentImage.url)) {
            const photo = nextPhoto();
            if (photo) contentImage.url = photo;
          }
        }
      }
      if (blockType === 'carousel' && Array.isArray(data.items)) {
        for (const item of data.items as Array<Record<string, unknown>>) {
          if (item && typeof item === 'object' && item.mediaType === 'image' && isStockOrEmpty(item.image)) {
            const photo = nextPhoto();
            if (photo) item.image = photo;
          }
        }
      }
    }

    return data;
  };

  return operations.map((op) => {
    if (op.op === 'replaceBlocks' && Array.isArray(op.blocks)) {
      return {
        ...op,
        blocks: (op.blocks as Array<Record<string, unknown>>).map((block) => ({
          ...block,
          data: updateBlock(block.blockType as string | undefined, { ...(block.data as Record<string, unknown> ?? {}) }),
        })),
      };
    }
    if (op.op === 'createPages' && Array.isArray(op.pages)) {
      return {
        ...op,
        pages: (op.pages as Array<Record<string, unknown>>).map((page) => ({
          ...page,
          blocks: Array.isArray(page.blocks)
            ? (page.blocks as Array<Record<string, unknown>>).map((block) => ({
                ...block,
                data: updateBlock(block.blockType as string | undefined, { ...(block.data as Record<string, unknown> ?? {}) }),
              }))
            : page.blocks,
        })),
      };
    }
    return op;
  });
}

// Guarantee vision-derived brand colors land even if the planner ignored the
// brief. Colors pass through the same readability sanitizer as user builds.
export function ensureBrandColors(
  operations: OrchestratorOperation[],
  enrichment: LeadEnrichment,
): OrchestratorOperation[] {
  const branding = enrichment.branding;
  if (!branding || (!branding.primary && !branding.secondary && !branding.accent)) return operations;

  const hasColorsOp = operations.some((op) => op.op === 'setCustomColors');
  if (hasColorsOp) return operations;

  const colors = sanitizeAiCustomColors({
    primary: branding.primary,
    secondary: branding.secondary,
    accent: branding.accent,
  });
  if (Object.keys(colors).length === 0) return operations;

  // Insert after setTemplate (always the first op) so application order matches
  // the orchestrator's own assembly.
  const result = [...operations];
  result.splice(1, 0, { op: 'setCustomColors', ...colors });
  return result;
}

async function upsertLaunchRequest(
  db: SupabaseAdmin,
  lead: LeadRecord,
  siteId: string,
  operatorUserId: string,
): Promise<string | null> {
  const { data: existing } = await db
    .from('launch_requests')
    .select('id')
    .eq('lead_id', lead.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await db
      .from('launch_requests')
      .update({ site_id: siteId, status: 'building' })
      .eq('id', existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await db
    .from('launch_requests')
    .insert({
      name: lead.contact_name || lead.business_name,
      email: lead.email || '',
      phone: lead.phone,
      business_name: lead.business_name,
      business_type: lead.business_type,
      status: 'building',
      site_id: siteId,
      assignee_user_id: operatorUserId,
      lead_id: lead.id,
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('[leads/generate-site] failed to create launch_request:', error);
    return null;
  }
  return created.id as string;
}

function enrichmentSummaryForStorage(enrichment: LeadEnrichment): Record<string, unknown> {
  return {
    place: enrichment.place ?? null,
    reviews: enrichment.reviews ?? null,
    photoUrls: enrichment.photoUrls ?? null,
    branding: enrichment.branding ?? null,
    websiteMeta: enrichment.websiteMeta ?? null,
    errors: enrichment.errors ?? null,
  };
}
