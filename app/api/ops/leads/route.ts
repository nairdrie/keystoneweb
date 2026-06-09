import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { isLeadIndustry, isLeadSource, isLeadStatus } from '@/lib/ops/leads';

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/ops/leads — create a new lead.
// Used by the NewLeadButton modal on /ops/leads. Accepts JSON OR
// multipart/form-data (when an image is being uploaded). Both admins and
// agents may create leads; full visibility is enforced at the page level.
export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  const isMultipart = contentType.includes('multipart/form-data');

  let fields: Record<string, unknown>;
  let imageFile: File | null = null;

  if (isMultipart) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }
    fields = {};
    for (const [k, v] of formData.entries()) {
      if (k === 'file' && v instanceof File) {
        imageFile = v;
      } else if (typeof v === 'string') {
        fields[k] = v;
      }
    }
  } else {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    fields = body;
  }

  const source = typeof fields.source === 'string' ? fields.source : 'other';
  if (!isLeadSource(source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  const status = typeof fields.status === 'string' ? fields.status : 'new';
  if (!isLeadStatus(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Industry is optional; empty string / absent → null.
  const industry =
    typeof fields.industry === 'string' && fields.industry.trim() ? fields.industry.trim() : null;
  if (industry !== null && !isLeadIndustry(industry)) {
    return NextResponse.json({ error: 'Invalid industry' }, { status: 400 });
  }

  const email =
    typeof fields.email === 'string' && fields.email.trim()
      ? fields.email.trim().toLowerCase()
      : null;

  // Pre-generate UUID so we can use it both as the lead row id and the
  // storage folder. Avoids a circular dependency between insert and upload.
  const leadId = crypto.randomUUID();

  const db = createAdminClient();
  let imageStoragePath: string | null = null;

  if (imageFile && imageFile.size > 0) {
    const MAX_BYTES = 10 * 1024 * 1024;
    if (imageFile.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 10 MB)' }, { status: 413 });
    }
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image file' }, { status: 400 });
    }

    const ext = extFromName(imageFile.name) || extFromMime(imageFile.type) || 'jpg';
    const path = `${leadId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await imageFile.arrayBuffer());

    const { error: uploadErr } = await db.storage
      .from('lead-images')
      .upload(path, buffer, {
        contentType: imageFile.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error('[ops/leads] image upload failed:', uploadErr);
      return NextResponse.json({ error: 'Image upload failed' }, { status: 500 });
    }
    imageStoragePath = path;
  }

  const insert = {
    id: leadId,
    contact_name: trimOrNull(fields.contact_name),
    person_role: trimOrNull(fields.person_role),
    business_name: trimOrNull(fields.business_name),
    email,
    phone: trimOrNull(fields.phone),
    website: trimOrNull(fields.website),
    business_type: trimOrNull(fields.business_type),
    industry,
    address: trimOrNull(fields.address),
    city: trimOrNull(fields.city),
    source,
    source_detail: trimOrNull(fields.source_detail),
    status,
    notes: trimOrNull(fields.notes),
    image_storage_path: imageStoragePath,
    assignee_user_id:
      typeof fields.assignee_user_id === 'string' ? fields.assignee_user_id : null,
  };

  if (
    !insert.contact_name &&
    !insert.business_name &&
    !insert.email &&
    !insert.phone &&
    !imageStoragePath
  ) {
    // If we already uploaded an image, leave it orphaned — cheap to clean
    // later — and surface the validation error to the user.
    return NextResponse.json(
      { error: 'At least one of contact name, business, email, phone, or image is required.' },
      { status: 400 },
    );
  }

  const { data, error } = await db.from('leads').insert(insert).select().single();

  if (error) {
    console.error('[ops/leads] create failed:', error);
    // Roll back the image upload if the insert failed so we don't orphan it.
    if (imageStoragePath) {
      await db.storage.from('lead-images').remove([imageStoragePath]).catch(() => {});
    }
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extFromName(name: string): string | null {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name);
  return m ? m[1].toLowerCase() : null;
}

function extFromMime(type: string): string | null {
  const m = /^image\/([a-zA-Z0-9]+)/.exec(type);
  if (!m) return null;
  return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
}
