import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Vendor management for site owners.
 * A "vendor" represents a fulfillment source. payment_mode controls how it handles payment:
 *   - stripe:   funds route to vendor's connected Stripe account
 *   - converge: Converge Lightbox charges vendor's Converge merchant account
 *   - clover:   Clover Hosted Checkout charges vendor's Clover merchant account
 *   - external: no payment processed on-site; vendor contacts customer directly
 */

async function verifyOwnership(supabase: any, siteId: string, userId: string) {
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    return site && site.user_id === userId;
}

// Fields safe to return to the client — never return private credentials in plaintext
function sanitizeVendor(v: any) {
    if (!v) return v;
    return {
        ...v,
        converge_pin: v.converge_pin ? '••••••••' : null,
        clover_private_token: v.clover_private_token ? '••••••••' : null,
        clover_webhook_secret: v.clover_webhook_secret ? '••••••••' : null,
    };
}

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    if (!(await verifyOwnership(supabase, siteId, user.id))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vendors: (data || []).map(sanitizeVendor) });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { siteId, name, contactEmail, paymentMode, ccNotificationEmails, isDefault } = body;

    if (!siteId || !name || !contactEmail) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!(await verifyOwnership(supabase, siteId, user.id))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If this vendor is being marked default, unset any existing default
    if (isDefault) {
        await supabase.from('vendors').update({ is_default: false }).eq('site_id', siteId).eq('is_default', true);
    }

    const { data: vendor, error } = await supabase
        .from('vendors')
        .insert({
            site_id: siteId,
            name,
            contact_email: contactEmail,
            payment_mode: paymentMode || 'external',
            cc_notification_emails: Array.isArray(ccNotificationEmails) ? ccNotificationEmails : [],
            is_default: !!isDefault,
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Generate a portal access token
    const token = crypto.randomBytes(32).toString('hex');
    await supabase.from('vendor_order_tokens').insert({
        vendor_id: vendor.id,
        site_id: siteId,
        token,
    });

    return NextResponse.json({ vendor: sanitizeVendor(vendor), portalToken: token });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
        id, name, contactEmail, paymentMode,
        convergeMerchantId, convergeUserId, convergePin, convergeDemoMode,
        cloverMerchantId, cloverPublicKey, cloverPrivateToken, cloverWebhookSecret, cloverSandboxMode,
        ccNotificationEmails, isDefault,
    } = body;

    if (!id) return NextResponse.json({ error: 'Missing vendor id' }, { status: 400 });

    const { data: vendor } = await supabase.from('vendors').select('site_id').eq('id', id).single();
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    if (!(await verifyOwnership(supabase, vendor.site_id, user.id))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (contactEmail !== undefined) updates.contact_email = contactEmail;
    if (paymentMode !== undefined) updates.payment_mode = paymentMode;
    if (ccNotificationEmails !== undefined) updates.cc_notification_emails = Array.isArray(ccNotificationEmails) ? ccNotificationEmails : [];

    if (convergeMerchantId !== undefined) updates.converge_merchant_id = convergeMerchantId || null;
    if (convergeUserId !== undefined) updates.converge_user_id = convergeUserId || null;
    // Only overwrite PIN if a new one was provided (avoid the masked "••••••••" clobbering the real value)
    if (convergePin !== undefined && convergePin && !convergePin.startsWith('•')) updates.converge_pin = convergePin;
    if (convergeDemoMode !== undefined) updates.converge_demo_mode = !!convergeDemoMode;

    if (cloverMerchantId !== undefined) updates.clover_merchant_id = cloverMerchantId || null;
    if (cloverPublicKey !== undefined) updates.clover_public_key = cloverPublicKey || null;
    if (cloverPrivateToken !== undefined && cloverPrivateToken && !cloverPrivateToken.startsWith('•')) updates.clover_private_token = cloverPrivateToken;
    if (cloverWebhookSecret !== undefined && cloverWebhookSecret && !cloverWebhookSecret.startsWith('•')) updates.clover_webhook_secret = cloverWebhookSecret;
    if (cloverSandboxMode !== undefined) updates.clover_sandbox_mode = !!cloverSandboxMode;

    if (isDefault === true) {
        await supabase.from('vendors').update({ is_default: false }).eq('site_id', vendor.site_id).eq('is_default', true).neq('id', id);
        updates.is_default = true;
    } else if (isDefault === false) {
        updates.is_default = false;
    }

    const { data, error } = await supabase.from('vendors').update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vendor: sanitizeVendor(data) });
}

export async function DELETE(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const vendorId = request.nextUrl.searchParams.get('id');
    if (!vendorId) return NextResponse.json({ error: 'Missing vendor id' }, { status: 400 });

    const { data: vendor } = await supabase.from('vendors').select('site_id').eq('id', vendorId).single();
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    if (!(await verifyOwnership(supabase, vendor.site_id, user.id))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase.from('vendors').delete().eq('id', vendorId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
