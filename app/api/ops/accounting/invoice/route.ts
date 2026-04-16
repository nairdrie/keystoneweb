import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';

/**
 * POST /api/ops/accounting/invoice
 * Upload an invoice file and attach it to an accounting entry.
 * Body: FormData with file + entryId
 */
export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const entryId = formData.get('entryId') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }
  if (!entryId) {
    return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, PNG, JPEG, and WebP files are allowed' }, { status: 400 });
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const db = createAdminClient();

  // Verify entry exists
  const { data: entry, error: entryError } = await db
    .from('accounting_entries')
    .select('id')
    .eq('id', entryId)
    .single();

  if (entryError || !entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  // Upload to Supabase storage
  const ext = file.name.split('.').pop() ?? 'pdf';
  const storagePath = `invoices/${entryId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await db.storage
    .from('invoices')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('[accounting/invoice POST upload]', uploadError);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }

  // Update entry with invoice path
  const { data: updated, error: updateError } = await db
    .from('accounting_entries')
    .update({
      invoice_storage_path: storagePath,
      invoice_filename: file.name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .select()
    .single();

  if (updateError) {
    console.error('[accounting/invoice POST update]', updateError);
    return NextResponse.json({ error: 'File uploaded but failed to link to entry' }, { status: 500 });
  }

  return NextResponse.json(updated);
}

/**
 * GET /api/ops/accounting/invoice?path=...
 * Get a signed URL for downloading an invoice.
 */
export async function GET(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const path = new URL(request.url).searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db.storage
    .from('invoices')
    .createSignedUrl(path, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    console.error('[accounting/invoice GET]', error);
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
