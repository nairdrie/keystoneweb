import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { hashPassword } from '@/lib/membership/auth';

interface ImportMember {
  email: string;
  name?: string;
  password_hash?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
  current_period_end?: string;
  custom_fields?: Record<string, any>;
  country?: string;
  province?: string;
  status?: string;
}

/**
 * POST /api/membership/import
 * Bulk import members into a site's membership.
 * Accepts JSON array of member records. Preserves Stripe customer IDs and password hashes.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, members, defaultPackageId, skipDuplicates } = body as {
      siteId: string;
      members: ImportMember[];
      defaultPackageId?: string;
      skipDuplicates?: boolean;
    };

    if (!siteId || !members || !Array.isArray(members)) {
      return NextResponse.json({ error: 'Missing siteId or members array' }, { status: 400 });
    }

    if (members.length > 1000) {
      return NextResponse.json({ error: 'Maximum 1000 members per import' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // Generate a fallback password hash for members without one
    const fallbackHash = await hashPassword(crypto.randomUUID());

    let imported = 0;
    let skipped = 0;
    const errors: { email: string; reason: string }[] = [];

    for (const m of members) {
      if (!m.email) {
        errors.push({ email: '(empty)', reason: 'Missing email' });
        continue;
      }

      const emailLower = m.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
        errors.push({ email: emailLower, reason: 'Invalid email format' });
        continue;
      }

      const row: Record<string, any> = {
        site_id: siteId,
        email: emailLower,
        password_hash: m.password_hash || fallbackHash,
        name: m.name || null,
        status: m.status || 'active',
        email_verified: true,
        custom_fields: m.custom_fields || {},
        package_id: defaultPackageId || null,
        stripe_customer_id: m.stripe_customer_id || null,
        stripe_subscription_id: m.stripe_subscription_id || null,
        subscription_status: m.subscription_status || 'none',
        current_period_end: m.current_period_end || null,
        country: m.country || null,
        province: m.province || null,
        marketing_opt_in: false,
        signed_up_at: new Date().toISOString(),
      };

      if (skipDuplicates) {
        // Try insert, skip on conflict
        const { error: insertError } = await adminClient
          .from('members')
          .upsert(row, { onConflict: 'site_id,email', ignoreDuplicates: true });

        if (insertError) {
          errors.push({ email: emailLower, reason: insertError.message });
        } else {
          imported++;
        }
      } else {
        const { error: insertError } = await adminClient
          .from('members')
          .insert(row);

        if (insertError) {
          if (insertError.code === '23505') {
            skipped++;
          } else {
            errors.push({ email: emailLower, reason: insertError.message });
          }
        } else {
          imported++;
        }
      }
    }

    return NextResponse.json({ imported, skipped, errors });
  } catch (error: any) {
    console.error('Member import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
