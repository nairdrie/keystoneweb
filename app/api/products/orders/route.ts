import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendOrderConfirmation, sendOrderNotification, sendOrderPaymentConfirmed, sendOrderCancellationToCustomer, sendOrderCancellationToOwner, sendOrderShipped, sendMixedOrderConfirmation, sendVendorOrderNotification, sendOwnerVendorOrderNotification } from '@/lib/email';
import { buildSiteOrigin } from '@/lib/email/order-tracking-url';
import { findMatchingZone, applyMarkup, productMissingShippingInfo, siteHasCarrierZone, type ShippingZone } from '@/lib/shipping-data';
import { getRates, buildSingleParcel, type ShippoAddress } from '@/lib/shipping/shippo';
import { getCurrentMemberFromRequest } from '@/lib/membership/current-member';
import { resolveProductAccess, parseProductOptions, resolveOptionPriceModifierCents } from '@/lib/ecommerce/resolve-price';
import Stripe from 'stripe';

/**
 * Look up or create a member row for this customer when they tick "Save my
 * info" at checkout. Guest rows have password_hash = NULL and status =
 * 'guest' until the customer claims the account via OTP / password reset.
 *
 * Never demotes an existing active/pending member back to guest, and only
 * flips marketing_opt_in false → true (never silently revokes consent).
 *
 * Returns the member id, or null on any failure (we never want a member
 * upsert hiccup to block an order from being created).
 */
async function upsertGuestMember(
    siteId: string,
    email: string,
    name: string,
    phone: string | undefined,
    shippingAddress: any,
    marketingOptIn: boolean,
): Promise<string | null> {
    try {
        const admin = createAdminClient();
        const emailLower = email.trim().toLowerCase();

        const { data: existing } = await admin
            .from('members')
            .select('id, status, marketing_opt_in, custom_fields')
            .eq('site_id', siteId)
            .eq('email', emailLower)
            .maybeSingle();

        const cf: Record<string, any> = {
            ...(existing?.custom_fields || {}),
            phone: phone || (existing?.custom_fields as any)?.phone || null,
            line1: shippingAddress?.line1 || (existing?.custom_fields as any)?.line1 || null,
            city: shippingAddress?.city || (existing?.custom_fields as any)?.city || null,
            region: shippingAddress?.region || (existing?.custom_fields as any)?.region || null,
            postal: shippingAddress?.postal || (existing?.custom_fields as any)?.postal || null,
            country: shippingAddress?.country || (existing?.custom_fields as any)?.country || null,
        };

        if (existing) {
            const updates: Record<string, any> = {
                name: name || undefined,
                custom_fields: cf,
                updated_at: new Date().toISOString(),
            };
            // Only opt-in: never revoke marketing consent automatically.
            if (marketingOptIn && !existing.marketing_opt_in) updates.marketing_opt_in = true;
            await admin.from('members').update(updates).eq('id', existing.id);
            return existing.id;
        }

        const { data: created } = await admin
            .from('members')
            .insert({
                site_id: siteId,
                email: emailLower,
                name: name || null,
                password_hash: null,
                status: 'guest',
                email_verified: false,
                custom_fields: cf,
                marketing_opt_in: !!marketingOptIn,
            })
            .select('id')
            .single();
        return created?.id || null;
    } catch (err) {
        console.error('Guest member upsert failed:', err);
        return null;
    }
}

/**
 * POST /api/products/orders — Create order (public checkout)
 * GET /api/products/orders?siteId=... — List orders (owner only)
 * PUT /api/products/orders — Update order status (owner only)
 */

/**
 * Re-quote a carrier zone via Shippo and verify that the customer-selected
 * service token + price still match. Tolerance: ±$0.50 to absorb harmless
 * rounding drift between successive quotes. Returns the authoritative
 * amount/label/token to persist on the order.
 */
async function verifyCarrierRate(args: {
    zone: ShippingZone;
    settings: {
        origin_line1: string | null;
        origin_line2: string | null;
        origin_city: string | null;
        origin_region: string | null;
        origin_postal: string | null;
        origin_country: string | null;
    } | null;
    items: any[];
    shippingAddress: any;
    chosenToken: string | null;
    clientCents: number | null;
}): Promise<
    | { ok: true; amountCents: number; label: string; serviceToken: string; carrier: string }
    | { ok: false; error: string }
> {
    const { zone, settings, items, shippingAddress, chosenToken, clientCents } = args;
    const shippoApiKey = process.env.SHIPPO_API_KEY;
    if (!chosenToken) return { ok: false, error: 'Pick a shipping option' };
    if (!shippoApiKey || !settings?.origin_line1 || !settings.origin_postal) {
        return { ok: false, error: 'Shipping is not configured for this store.' };
    }

    const parcelItems = items.map(i => ({
        qty: Math.max(1, Math.floor(Number(i.qty) || 1)),
        weight_grams: i.weight_grams || null,
        length_mm: i.length_mm || null,
        width_mm: i.width_mm || null,
        height_mm: i.height_mm || null,
    }));
    const parcel = buildSingleParcel(parcelItems);
    if (!parcel) {
        return { ok: false, error: 'One or more items in your cart are currently unavailable for shipping.' };
    }

    const addressFrom: ShippoAddress = {
        street1: settings.origin_line1!,
        street2: settings.origin_line2 || undefined,
        city: settings.origin_city || '',
        state: settings.origin_region || '',
        zip: settings.origin_postal!,
        country: settings.origin_country || 'US',
    };
    const addressTo: ShippoAddress = {
        street1: shippingAddress?.line1 || '',
        city: shippingAddress?.city || '',
        state: shippingAddress?.region || shippingAddress?.province || '',
        zip: shippingAddress?.postal || '',
        country: shippingAddress?.country || '',
    };

    let rates;
    try {
        rates = await getRates({
            apiKey: shippoApiKey,
            addressFrom,
            addressTo,
            parcels: [parcel],
        });
    } catch (err: any) {
        console.error('Shippo re-quote failed:', err?.message || err);
        return { ok: false, error: 'Could not verify shipping rate.' };
    }

    const allowed = Array.isArray(zone.carrier_services) ? zone.carrier_services : [];
    const matched = rates.find(r => r.servicelevel_token === chosenToken
        && (allowed.length === 0 || allowed.includes(r.servicelevel_token)));
    if (!matched) {
        return { ok: false, error: 'Selected shipping option is no longer available.' };
    }

    const serverCents = applyMarkup(matched.amount_cents, zone.markup_type, zone.markup_cents);
    if (clientCents !== null && Math.abs(serverCents - clientCents) > 50) {
        return { ok: false, error: 'Shipping price changed — please re-confirm at checkout.' };
    }

    const days = typeof matched.estimated_days === 'number' && matched.estimated_days > 0
        ? ` (~${matched.estimated_days} day${matched.estimated_days === 1 ? '' : 's'})`
        : '';
    return {
        ok: true,
        amountCents: serverCents,
        label: `${matched.provider} ${matched.servicelevel_name}${days}`,
        serviceToken: matched.servicelevel_token,
        carrier: matched.provider.toLowerCase(),
    };
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const body = await request.json();

    const {
        siteId, items, customerName, customerEmail, customerPhone,
        shippingAddress, shippingCents: clientShippingCents, shippingMethod: clientShippingMethod,
        shippingServiceToken: clientShippingServiceToken,
        shippingCarrier: clientShippingCarrier,
        notes, paymentMethod = 'none', stripeSessionId,
        saveProfile, marketingOptIn,
    } = body;

    if (!siteId || !items || !items.length || !customerName || !customerEmail) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Server-side price + access resolution ────────────────────────────────
    // Never trust `price_cents` from the client. For each item we re-fetch the
    // product, identify the current member via the member cookie, and run the
    // shared resolver. Gated products block the order entirely.
    const member = await getCurrentMemberFromRequest(request, siteId);

    if (items.some((i: any) => typeof i?.productId !== 'string' || !i.productId)) {
        return NextResponse.json({ error: 'Each item must reference a productId' }, { status: 400 });
    }
    const productIds = Array.from(new Set(items.map((i: any) => i.productId as string)));
    const { data: productRows, error: productFetchError } = await supabase
        .from('products')
        .select('id, site_id, name, price_cents, currency, tier_prices, allowed_package_ids, options, is_active, vendor_id, weight_grams, length_mm, width_mm, height_mm')
        .in('id', productIds as string[]);
    if (productFetchError) {
        return NextResponse.json({ error: 'Failed to validate items' }, { status: 500 });
    }
    const productById = new Map((productRows || []).map((p: any) => [p.id, p]));

    const resolvedItems: any[] = [];
    for (const rawItem of items) {
        const product = productById.get(rawItem.productId);
        if (!product || product.site_id !== siteId || !product.is_active) {
            return NextResponse.json({ error: 'Invalid product in cart' }, { status: 400 });
        }
        const qty = Math.max(1, Math.floor(Number(rawItem.qty) || 0));
        if (qty <= 0) {
            return NextResponse.json({ error: 'Invalid item quantity' }, { status: 400 });
        }
        const resolved = resolveProductAccess(product, member);
        if (!resolved.canPurchase) {
            return NextResponse.json({
                error: resolved.gateReason === 'guest'
                    ? 'Sign in with an eligible membership to purchase this item'
                    : 'Your membership does not grant access to this item',
                productId: product.id,
                gateReason: resolved.gateReason,
            }, { status: 403 });
        }
        // Apply option price modifiers from the server-side product definition.
        // Unknown selections fall back to the default — never trust client cents.
        const productOptions = parseProductOptions((product as any).options);
        const optionModifierCents = resolveOptionPriceModifierCents(productOptions, rawItem.options);
        resolvedItems.push({
            productId: product.id,
            name: product.name,
            price_cents: resolved.priceCents + optionModifierCents,
            public_price_cents: resolved.publicPriceCents + optionModifierCents,
            matched_package_id: resolved.matchedPackageId,
            currency: product.currency,
            qty,
            image: rawItem.image,
            variants: rawItem.variants,
            options: rawItem.options,
            weight_grams: (product as any).weight_grams ?? null,
            length_mm: (product as any).length_mm ?? null,
            width_mm: (product as any).width_mm ?? null,
            height_mm: (product as any).height_mm ?? null,
        });
    }

    const subtotalCents = resolvedItems.reduce((sum, item) => sum + item.price_cents * item.qty, 0);

    // If the shopper is signed in, the order is attributed to them. Otherwise,
    // an opt-in "Save my info" upserts a guest member row; we use that id to
    // attribute the order so the shop owner sees the customer in the Users tab.
    // Done after item validation so a doomed cart never creates a user row.
    let attributedMemberId: string | null = member?.memberId || null;
    if (!attributedMemberId && saveProfile && customerEmail) {
        attributedMemberId = await upsertGuestMember(
            siteId,
            customerEmail,
            customerName || '',
            customerPhone,
            shippingAddress,
            !!marketingOptIn,
        );
    }

    // Server-side shipping validation: re-calculate shipping from zones to prevent tampering
    let validatedShippingCents = 0;
    let validatedShippingMethod: string | null = null;
    let validatedShippingServiceToken: string | null = null;
    let validatedShippingCarrier: string | null = null;

    const { data: ecomSettingsRow } = await supabase
        .from('ecommerce_settings')
        .select('shipping_required, origin_line1, origin_line2, origin_city, origin_region, origin_postal, origin_country')
        .eq('site_id', siteId)
        .single();

    const shippingRequired = ecomSettingsRow?.shipping_required !== false;

    if (shippingRequired && shippingAddress) {
        const { data: zones } = await supabase
            .from('shipping_zones')
            .select('*')
            .eq('site_id', siteId)
            .eq('is_archived', false)
            .order('sort_order');

        // Hard reject when any carrier zone exists and any cart item is
        // missing dims — the storefront should already have hidden these
        // products, this is the defense-in-depth check.
        if (zones && siteHasCarrierZone(zones)) {
            const offender = resolvedItems.find(i => productMissingShippingInfo(i));
            if (offender) {
                return NextResponse.json({
                    error: `"${offender.name}" is currently unavailable for purchase.`,
                    productId: offender.productId,
                }, { status: 400 });
            }
        }

        if (zones && zones.length > 0) {
            const result = findMatchingZone(
                zones as ShippingZone[],
                shippingAddress.country || '',
                shippingAddress.region || shippingAddress.province || '',
                subtotalCents
            );
            if (result) {
                const matchedZone = result.zone;
                if (matchedZone.rate_type === 'carrier') {
                    // Re-quote Shippo with the same inputs and verify the customer's
                    // chosen service token + price. ±$0.50 tolerance covers tiny
                    // rounding drift between the two quotes.
                    const verified = await verifyCarrierRate({
                        zone: matchedZone,
                        settings: ecomSettingsRow as any,
                        items: resolvedItems,
                        shippingAddress,
                        chosenToken: clientShippingServiceToken || null,
                        clientCents: typeof clientShippingCents === 'number' ? clientShippingCents : null,
                    });
                    if (!verified.ok) {
                        return NextResponse.json({ error: verified.error }, { status: 400 });
                    }
                    validatedShippingCents = verified.amountCents;
                    validatedShippingMethod = verified.label;
                    validatedShippingServiceToken = verified.serviceToken;
                    validatedShippingCarrier = verified.carrier;
                } else {
                    validatedShippingCents = result.shippingCents;
                    validatedShippingMethod = result.label;
                }
            }
        }
    }

    // ── Check for vendor products & determine if we need to split ──────────────
    // Fetch the site's default vendor (if configured). Products with vendor_id=null
    // fall back to the default vendor; if no default exists, they're self-fulfilled.
    const { data: defaultVendorRow } = await supabase
        .from('vendors')
        .select('id')
        .eq('site_id', siteId)
        .eq('is_default', true)
        .maybeSingle();
    const defaultVendorId: string | null = defaultVendorRow?.id || null;

    // Build vendor map from the product rows we already fetched for price/access
    // resolution — no second round-trip needed.
    const productVendorMap: Record<string, string | null> = {};
    for (const p of (productRows || []) as any[]) {
        productVendorMap[p.id] = p.vendor_id || defaultVendorId;
    }

    // Group resolved items by vendor (self = self-fulfilled if no default; otherwise default vendor)
    const itemsByVendor: Record<string, any[]> = {};
    for (const item of resolvedItems) {
        const vendorId = productVendorMap[item.productId] || 'self';
        if (!itemsByVendor[vendorId]) itemsByVendor[vendorId] = [];
        itemsByVendor[vendorId].push(item);
    }

    const vendorKeys = Object.keys(itemsByVendor);
    const isMixedCart = vendorKeys.length > 1;
    const hasVendorItems = vendorKeys.some(k => k !== 'self');
    const hasSelfItems = vendorKeys.includes('self');

    // If not a mixed cart and no vendor items, use the original flow
    if (!isMixedCart && !hasVendorItems) {
        return await createSingleOrder(supabase, {
            siteId, items: resolvedItems, customerName, customerEmail, customerPhone,
            shippingAddress, validatedShippingCents, validatedShippingMethod,
            validatedShippingServiceToken, validatedShippingCarrier,
            notes, paymentMethod, shippingRequired, memberId: attributedMemberId,
        });
    }

    // ── Mixed cart / vendor cart: split into separate orders ──────────────────
    // Fetch vendor info for all vendor IDs
    const vendorIds = vendorKeys.filter(k => k !== 'self');
    let vendors: Record<string, any> = {};
    if (vendorIds.length > 0) {
        const { data: vendorRows } = await supabase
            .from('vendors')
            .select('*')
            .in('id', vendorIds);
        if (vendorRows) {
            for (const v of vendorRows) vendors[v.id] = v;
        }
    }

    // Create a parent order (groups all sub-orders)
    const { data: parentOrder, error: parentError } = await supabase
        .from('orders')
        .insert({
            site_id: siteId,
            items: resolvedItems, // full item list with server-resolved prices
            subtotal_cents: subtotalCents,
            shipping_cents: validatedShippingCents,
            shipping_method: validatedShippingMethod,
            shipping_service_token: validatedShippingServiceToken,
            shipping_carrier: validatedShippingCarrier,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone || null,
            shipping_address: shippingAddress || null,
            status: 'pending',
            payment_method: 'none',
            payment_status: 'unpaid',
            notes: notes || null,
            member_id: attributedMemberId,
        })
        .select()
        .single();

    if (parentError || !parentOrder) {
        console.error('Parent order creation error:', parentError);
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    const childOrders: any[] = [];
    const stripeOrders: any[] = [];     // orders needing Stripe checkout
    const convergeOrders: any[] = [];   // orders needing Converge Lightbox
    const cloverOrders: any[] = [];     // orders needing Clover Hosted Checkout
    const externalOrders: any[] = [];   // orders handled externally (email-based)

    // Shipping is collected by whoever actually fulfills/ships the order: the
    // self-fulfilled order if one exists, otherwise the first vendor order
    // (which would otherwise lose the shipping cost when invoicing the customer).
    const shippingBearerKey = hasSelfItems ? 'self' : vendorKeys[0];

    for (const [vendorKey, vendorItems] of Object.entries(itemsByVendor)) {
        const isSelf = vendorKey === 'self';
        const vendor = isSelf ? null : vendors[vendorKey];
        const groupSubtotal = vendorItems.reduce((sum: number, item: any) => sum + (item.price_cents * item.qty), 0);

        const bearsShipping = vendorKey === shippingBearerKey;
        const groupShipping = bearsShipping ? validatedShippingCents : 0;
        const groupShippingMethod = bearsShipping ? validatedShippingMethod : null;
        const groupShippingServiceToken = bearsShipping ? validatedShippingServiceToken : null;
        const groupShippingCarrier = bearsShipping ? validatedShippingCarrier : null;

        let orderPaymentMethod: string;
        let orderStatus: string;
        let orderPaymentStatus: string;

        if (isSelf) {
            // Self items use the customer-selected payment method
            orderPaymentMethod = paymentMethod;
            orderStatus = paymentMethod === 'none' ? 'confirmed' : 'pending';
            orderPaymentStatus = paymentMethod === 'none' ? 'paid' : 'unpaid';
        } else if (vendor?.payment_mode === 'stripe' && vendor?.stripe_account_id) {
            orderPaymentMethod = 'stripe';
            orderStatus = 'pending';
            orderPaymentStatus = 'unpaid';
        } else if (vendor?.payment_mode === 'converge' && vendor?.converge_merchant_id && vendor?.converge_user_id && vendor?.converge_pin) {
            orderPaymentMethod = 'converge';
            orderStatus = 'pending';
            orderPaymentStatus = 'unpaid';
        } else if (vendor?.payment_mode === 'clover' && vendor?.clover_merchant_id && vendor?.clover_private_token) {
            orderPaymentMethod = 'clover';
            orderStatus = 'pending';
            orderPaymentStatus = 'unpaid';
        } else {
            // Vendor with external payment or incomplete credentials — email-based flow
            orderPaymentMethod = 'external';
            orderStatus = 'pending_external';
            orderPaymentStatus = 'unpaid';
        }

        const { data: childOrder, error: childError } = await supabase
            .from('orders')
            .insert({
                site_id: siteId,
                items: vendorItems,
                subtotal_cents: groupSubtotal,
                shipping_cents: groupShipping,
                shipping_method: groupShippingMethod,
                shipping_service_token: groupShippingServiceToken,
                shipping_carrier: groupShippingCarrier,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone || null,
                shipping_address: shippingAddress || null,
                status: orderStatus,
                payment_method: orderPaymentMethod,
                payment_status: orderPaymentStatus,
                notes: notes || null,
                parent_order_id: parentOrder.id,
                vendor_id: isSelf ? null : vendorKey,
                member_id: attributedMemberId,
            })
            .select()
            .single();

        if (childError || !childOrder) {
            console.error('Child order creation error:', childError);
            continue;
        }

        childOrders.push({ ...childOrder, vendor });

        if (!isSelf && orderPaymentMethod === 'stripe') stripeOrders.push({ order: childOrder, vendor });
        if (!isSelf && orderPaymentMethod === 'converge') convergeOrders.push({ order: childOrder, vendor });
        if (!isSelf && orderPaymentMethod === 'clover') cloverOrders.push({ order: childOrder, vendor });
        if (!isSelf && orderPaymentMethod === 'external') externalOrders.push({ order: childOrder, vendor });
    }

    // Decrement inventory for all purchased products
    for (const item of resolvedItems) {
        if (item.productId) {
            const { data: product } = await supabase
                .from('products')
                .select('inventory_count')
                .eq('id', item.productId)
                .single();

            if (product && product.inventory_count > 0) {
                await supabase
                    .from('products')
                    .update({ inventory_count: product.inventory_count - item.qty })
                    .eq('id', item.productId);
            }
        }
    }

    // ── Send emails ──────────────────────────────────────────────────────────
    const { data: siteInfo } = await supabase
        .from('sites')
        .select('site_slug, design_data, published_domain, custom_domain')
        .eq('id', siteId)
        .single();
    const siteName = siteInfo?.site_slug || undefined;
    const logoUrl: string | undefined = (siteInfo?.design_data as any)?.headerLogo || (siteInfo?.design_data as any)?.siteLogo || undefined;
    const siteOrigin = buildSiteOrigin({
        customDomain: siteInfo?.custom_domain,
        publishedDomain: siteInfo?.published_domain,
    });

    const { data: ecomSettings } = await supabase
        .from('ecommerce_settings')
        .select('etransfer_email, notification_email')
        .eq('site_id', siteId)
        .single();

    const { data: bookingSettings } = !ecomSettings ? await supabase
        .from('booking_settings')
        .select('etransfer_email, notification_email')
        .eq('site_id', siteId)
        .single() : { data: null };

    const paymentConfig = ecomSettings || bookingSettings;

    const { data: emailCustomizationsRows } = await supabase
        .from('email_customizations')
        .select('email_key, overrides')
        .eq('site_id', siteId);
    const emailCustomizations: Record<string, any> = {};
    for (const row of emailCustomizationsRows || []) {
        emailCustomizations[row.email_key] = row.overrides;
    }

    // Build per-item payment status for customer email
    // A "paymentConfirmed" item is one paid in-checkout (Stripe / Converge / Clover / self with Stripe/none).
    // External-vendor items are still pending after checkout (customer hears from vendor separately).
    const itemStatuses = resolvedItems.map((item: any) => {
        const vendorId = productVendorMap[item.productId] || null;
        const vendor = vendorId ? vendors[vendorId] : null;
        if (!vendor) {
            return {
                ...item,
                fulfillment: 'self' as const,
                paymentConfirmed: paymentMethod === 'none' || paymentMethod === 'stripe',
            };
        }
        const willBePaidInCheckout =
            (vendor.payment_mode === 'stripe' && vendor.stripe_account_id) ||
            (vendor.payment_mode === 'converge' && vendor.converge_merchant_id) ||
            (vendor.payment_mode === 'clover' && vendor.clover_merchant_id);
        return {
            ...item,
            fulfillment: 'vendor' as const,
            vendorName: vendor.name,
            paymentConfirmed: willBePaidInCheckout,
        };
    });

    // Customer mixed-order confirmation
    sendMixedOrderConfirmation({
        orderId: parentOrder.id,
        items: itemStatuses,
        subtotalCents,
        shippingCents: validatedShippingCents,
        shippingMethod: validatedShippingMethod || undefined,
        currency: resolvedItems[0]?.currency || 'CAD',
        customerName,
        customerEmail,
        paymentMethod,
        etransferEmail: paymentConfig?.etransfer_email,
        siteName,
        siteOrigin,
        logoUrl,
        overrides: emailCustomizations['mixed_order_confirmed'],
    }).catch(err => console.error('Mixed order customer email failed:', err));

    // Notify each external vendor (email-only flow — they collect payment themselves)
    for (const { order: vendorOrder, vendor } of externalOrders) {
        const { data: tokenRow } = await supabase
            .from('vendor_order_tokens')
            .select('token')
            .eq('vendor_id', vendor.id)
            .eq('site_id', siteId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const ccEmails = Array.isArray(vendor.cc_notification_emails) ? vendor.cc_notification_emails : [];
        const recipients = [vendor.contact_email, ...ccEmails].filter(Boolean);

        for (const recipient of recipients) {
            sendVendorOrderNotification({
                orderId: vendorOrder.id,
                vendorName: vendor.name,
                vendorEmail: recipient,
                customerName,
                customerEmail,
                customerPhone,
                shippingAddress,
                items: vendorOrder.items,
                subtotalCents: vendorOrder.subtotal_cents,
                currency: resolvedItems[0]?.currency || 'CAD',
                portalToken: tokenRow?.token,
                siteName,
            }).catch(err => console.error('Vendor notification email failed:', err));
        }

        await supabase
            .from('orders')
            .update({ vendor_notified_at: new Date().toISOString() })
            .eq('id', vendorOrder.id);
    }

    // Notify site owner about vendor orders
    if (paymentConfig?.notification_email && (externalOrders.length > 0 || stripeOrders.length > 0)) {
        sendOwnerVendorOrderNotification({
            parentOrderId: parentOrder.id,
            childOrders: childOrders.map(co => ({
                orderId: co.id,
                vendorName: co.vendor?.name || 'Your Store',
                items: co.items,
                subtotalCents: co.subtotal_cents,
                paymentMethod: co.payment_method,
                status: co.status,
            })),
            customerName,
            customerEmail,
            currency: resolvedItems[0]?.currency || 'CAD',
            ownerEmail: paymentConfig.notification_email,
            siteName,
        }).catch(err => console.error('Owner vendor order email failed:', err));
    }

    // Build response
    const selfOrder = childOrders.find(co => !co.vendor);
    const response: any = {
        order: parentOrder,
        childOrders: childOrders.map(co => ({
            id: co.id,
            vendorId: co.vendor_id,
            vendorName: co.vendor?.name || null,
            paymentMethod: co.payment_method,
            status: co.status,
            subtotalCents: co.subtotal_cents,
            shippingCents: co.shipping_cents || 0,
        })),
        confirmationMessage: 'Thank you for your order!',
    };

    // If self-fulfilled items exist with e-transfer, include payment instructions
    if (selfOrder && paymentMethod === 'etransfer' && paymentConfig?.etransfer_email) {
        response.paymentInstructions = {
            type: 'etransfer',
            email: paymentConfig.etransfer_email,
            amount: ((selfOrder.subtotal_cents + (selfOrder.shipping_cents || 0)) / 100).toFixed(2),
            currency: resolvedItems[0]?.currency || 'CAD',
            reference: `ORDER-${selfOrder.id.slice(0, 8).toUpperCase()}`,
        };
    }

    // Stripe orders for self-fulfilled items
    if (selfOrder && paymentMethod === 'stripe') {
        response.stripeOrderId = selfOrder.id;
    }

    // Stripe orders for vendor items (returned so frontend can create separate checkout sessions)
    if (stripeOrders.length > 0) {
        response.vendorStripeOrders = stripeOrders.map(so => ({
            orderId: so.order.id,
            vendorName: so.vendor.name,
            vendorStripeAccountId: so.vendor.stripe_account_id,
        }));
    }

    // Converge orders — frontend will open the Converge Lightbox for each
    if (convergeOrders.length > 0) {
        response.vendorConvergeOrders = convergeOrders.map(co => ({
            orderId: co.order.id,
            vendorName: co.vendor.name,
            subtotalCents: co.order.subtotal_cents,
            shippingCents: co.order.shipping_cents || 0,
            demoMode: !!co.vendor.converge_demo_mode,
        }));
    }

    // Clover orders — frontend will redirect to Clover Hosted Checkout for each
    if (cloverOrders.length > 0) {
        response.vendorCloverOrders = cloverOrders.map(co => ({
            orderId: co.order.id,
            vendorName: co.vendor.name,
            subtotalCents: co.order.subtotal_cents,
            shippingCents: co.order.shipping_cents || 0,
            sandboxMode: !!co.vendor.clover_sandbox_mode,
        }));
    }

    return NextResponse.json(response);
}

/**
 * Original single-order creation (no vendor splitting needed)
 */
async function createSingleOrder(supabase: any, params: {
    siteId: string; items: any[]; customerName: string; customerEmail: string;
    customerPhone?: string; shippingAddress?: any; validatedShippingCents: number;
    validatedShippingMethod: string | null;
    validatedShippingServiceToken?: string | null;
    validatedShippingCarrier?: string | null;
    notes?: string; paymentMethod: string;
    shippingRequired: boolean; memberId?: string | null;
}) {
    const {
        siteId, items, customerName, customerEmail, customerPhone,
        shippingAddress, validatedShippingCents, validatedShippingMethod,
        validatedShippingServiceToken, validatedShippingCarrier,
        notes, paymentMethod, memberId,
    } = params;

    const subtotalCents = items.reduce((sum: number, item: any) => sum + (item.price_cents * item.qty), 0);

    // Determine status based on payment
    const status = paymentMethod === 'none' ? 'confirmed' : 'pending';
    const paymentStatus = paymentMethod === 'none' ? 'paid' : 'unpaid';

    // Server-side tax: look up flat-rate tax config and compute tax_cents.
    // Stripe's automatic_tax (when enabled) handles tax via Stripe Checkout,
    // so we skip flat-rate tax in that case to avoid double-charging.
    const { data: taxSettings } = await supabase
        .from('ecommerce_settings')
        .select('tax_rate_bps, tax_label, tax_enabled')
        .eq('site_id', siteId)
        .single();

    const taxRateBps = taxSettings?.tax_rate_bps || 0;
    const stripeAutomaticTax = paymentMethod === 'stripe' && taxSettings?.tax_enabled === true;
    const applyFlatTax = taxRateBps > 0 && !stripeAutomaticTax;
    const taxCents = applyFlatTax ? Math.round((subtotalCents + validatedShippingCents) * taxRateBps / 10000) : 0;
    const orderTaxLabel = applyFlatTax ? (taxSettings?.tax_label || 'Tax') : null;

    const { data: order, error } = await supabase
        .from('orders')
        .insert({
            site_id: siteId,
            items,
            subtotal_cents: subtotalCents,
            shipping_cents: validatedShippingCents,
            shipping_method: validatedShippingMethod,
            shipping_service_token: validatedShippingServiceToken || null,
            shipping_carrier: validatedShippingCarrier || null,
            tax_cents: taxCents,
            tax_label: orderTaxLabel,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone || null,
            shipping_address: shippingAddress || null,
            status,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            notes: notes || null,
            member_id: memberId || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Order creation error:', error);
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Decrement inventory for purchased products
    for (const item of items) {
        if (item.productId) {
            const { data: product } = await supabase
                .from('products')
                .select('inventory_count')
                .eq('id', item.productId)
                .single();

            if (product && product.inventory_count > 0) {
                await supabase
                    .from('products')
                    .update({ inventory_count: product.inventory_count - item.qty })
                    .eq('id', item.productId);
            }
        }
    }

    // Get site name + logo for customer emails
    const { data: siteInfo } = await supabase
        .from('sites')
        .select('site_slug, design_data, published_domain, custom_domain')
        .eq('id', siteId)
        .single();
    const siteName = siteInfo?.site_slug || undefined;
    const logoUrl: string | undefined = (siteInfo?.design_data as any)?.headerLogo || (siteInfo?.design_data as any)?.siteLogo || undefined;
    const siteOrigin = buildSiteOrigin({
        customDomain: siteInfo?.custom_domain,
        publishedDomain: siteInfo?.published_domain,
    });

    // Get e-commerce settings for e-transfer email + notification email
    const { data: ecomSettings } = await supabase
        .from('ecommerce_settings')
        .select('etransfer_email, notification_email')
        .eq('site_id', siteId)
        .single();

    const { data: bookingSettings } = !ecomSettings ? await supabase
        .from('booking_settings')
        .select('etransfer_email, notification_email')
        .eq('site_id', siteId)
        .single() : { data: null };

    const paymentConfig = ecomSettings || bookingSettings;

    const { data: emailCustomizationsRows } = await supabase
        .from('email_customizations')
        .select('email_key, overrides')
        .eq('site_id', siteId);
    const emailCustomizations: Record<string, any> = {};
    for (const row of emailCustomizationsRows || []) {
        emailCustomizations[row.email_key] = row.overrides;
    }

    // Build response
    const response: any = {
        order,
        confirmationMessage: 'Thank you for your order!',
    };

    const orderTotalCents = subtotalCents + validatedShippingCents;

    if (paymentMethod === 'etransfer' && paymentConfig?.etransfer_email) {
        response.paymentInstructions = {
            type: 'etransfer',
            email: paymentConfig?.etransfer_email,
            amount: (orderTotalCents / 100).toFixed(2),
            currency: items[0]?.currency || 'CAD',
            reference: `ORDER-${order.id.slice(0, 8).toUpperCase()}`,
        };
    }

    // Stripe, Converge, and Clover all confirm payment asynchronously — emails
    // are sent by their respective charge/verify endpoints, not here.
    if (paymentMethod === 'stripe' || paymentMethod === 'converge' || paymentMethod === 'clover') {
        return NextResponse.json(response);
    }

    // Send emails (fire-and-forget) for non-Stripe methods
    const emailData = {
        orderId: order.id,
        items,
        subtotalCents,
        shippingCents: validatedShippingCents,
        shippingMethod: validatedShippingMethod || undefined,
        currency: items[0]?.currency || 'CAD',
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        paymentMethod,
        etransferEmail: paymentConfig?.etransfer_email,
        siteName,
        siteOrigin,
        logoUrl,
        overrides: emailCustomizations['order_confirmed'],
        notes: notes || undefined,
        taxCents: taxCents || undefined,
        taxLabel: orderTaxLabel || undefined,
    };

    sendOrderConfirmation(emailData).catch(err => console.error('Order customer email failed:', err));

    if (paymentConfig?.notification_email) {
        sendOrderNotification(emailData, paymentConfig.notification_email)
            .catch(err => console.error('Order owner email failed:', err));
    }

    return NextResponse.json(response);
}

export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const status = request.nextUrl.searchParams.get('status');
    const includeChildren = request.nextUrl.searchParams.get('includeChildren') === 'true';

    let query = supabase
        .from('orders')
        .select('*, vendors(id, name, contact_email, payment_mode)')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    // By default, hide child orders (they're shown nested under parent)
    if (!includeChildren) {
        query = query.is('parent_order_id', null);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // For parent orders, fetch their child orders
    const orders = data || [];
    const parentIds = orders.filter(o => {
        // A parent order has children if other orders reference it
        return true; // We'll fetch children for all orders — the join is cheap
    }).map(o => o.id);

    let childOrderMap: Record<string, any[]> = {};
    if (parentIds.length > 0) {
        const { data: children } = await supabase
            .from('orders')
            .select('*, vendors(id, name, contact_email, payment_mode)')
            .in('parent_order_id', parentIds)
            .order('created_at', { ascending: true });

        if (children) {
            for (const child of children) {
                if (!childOrderMap[child.parent_order_id]) childOrderMap[child.parent_order_id] = [];
                childOrderMap[child.parent_order_id].push(child);
            }
        }
    }

    // Attach children to their parent orders
    const enrichedOrders = orders.map(order => ({
        ...order,
        childOrders: childOrderMap[order.id] || [],
    }));

    return NextResponse.json({ orders: enrichedOrders });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, status, payment_status, cancellationReason, tracking_number, tracking_carrier } = body;

    if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // Fetch the existing order before updating
    const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (fetchError || !existingOrder) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (payment_status) updates.payment_status = payment_status;
    if (cancellationReason) updates.cancellation_reason = cancellationReason;
    if (tracking_number !== undefined) updates.tracking_number = tracking_number || null;
    if (tracking_carrier !== undefined) updates.tracking_carrier = tracking_carrier || null;

    const isBeingMarkedShipped = status === 'shipped' && existingOrder.status !== 'shipped';

    const isBeingCancelled = status === 'cancelled' && existingOrder.status !== 'cancelled';

    // Attempt Stripe refund before updating if order was paid via Stripe
    let refunded = false;
    if (isBeingCancelled && existingOrder.payment_status === 'paid' && existingOrder.stripe_payment_id) {
        try {
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (stripeKey) {
                const stripe = new Stripe(stripeKey);
                await stripe.refunds.create({ payment_intent: existingOrder.stripe_payment_id });
                refunded = true;
                updates.payment_status = 'unpaid'; // reflect refund in DB
            }
        } catch (err) {
            console.error('Stripe refund failed:', err);
            // Don't block the cancellation — log and continue
        }
    }

    const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send payment confirmed email for e-transfer orders when marked as paid
    const isBeingMarkedPaid = payment_status === 'paid' && existingOrder.payment_status !== 'paid'
        && existingOrder.payment_method === 'etransfer';
    if (isBeingMarkedPaid) {
        const { data: paidSiteInfo } = await supabase
            .from('sites')
            .select('site_slug, design_data')
            .eq('id', existingOrder.site_id)
            .single();
        const paidSiteName = paidSiteInfo?.site_slug || undefined;
        const paidLogoUrl: string | undefined = (paidSiteInfo?.design_data as any)?.headerLogo || (paidSiteInfo?.design_data as any)?.siteLogo || undefined;

        const { data: paidCustomRows } = await supabase
            .from('email_customizations')
            .select('email_key, overrides')
            .eq('site_id', existingOrder.site_id)
            .eq('email_key', 'order_payment_confirmed');
        const paidOverrides = paidCustomRows?.[0]?.overrides;

        sendOrderPaymentConfirmed({
            orderId: existingOrder.id,
            items: existingOrder.items,
            subtotalCents: existingOrder.subtotal_cents,
            shippingCents: existingOrder.shipping_cents || 0,
            shippingMethod: existingOrder.shipping_method || undefined,
            taxCents: existingOrder.tax_cents || undefined,
            taxLabel: existingOrder.tax_label || undefined,
            currency: existingOrder.items[0]?.currency || 'CAD',
            customerName: existingOrder.customer_name,
            customerEmail: existingOrder.customer_email,
            paymentMethod: existingOrder.payment_method,
            siteName: paidSiteName,
            logoUrl: paidLogoUrl,
            overrides: paidOverrides,
        }).catch(err => console.error('Order payment confirmed email failed:', err));
    }

    // Send shipped email (with tracking info) when status transitions to 'shipped'
    if (isBeingMarkedShipped) {
        const { data: shippedSiteInfo } = await supabase
            .from('sites')
            .select('site_slug, design_data')
            .eq('id', existingOrder.site_id)
            .single();
        const shippedSiteName = shippedSiteInfo?.site_slug || undefined;
        const shippedLogoUrl: string | undefined = (shippedSiteInfo?.design_data as any)?.headerLogo || (shippedSiteInfo?.design_data as any)?.siteLogo || undefined;

        const { data: shippedCustomRows } = await supabase
            .from('email_customizations')
            .select('email_key, overrides')
            .eq('site_id', existingOrder.site_id)
            .eq('email_key', 'order_shipped');
        const shippedOverrides = shippedCustomRows?.[0]?.overrides;

        sendOrderShipped({
            orderId: existingOrder.id,
            items: existingOrder.items,
            subtotalCents: existingOrder.subtotal_cents,
            shippingCents: existingOrder.shipping_cents || 0,
            shippingMethod: existingOrder.shipping_method || undefined,
            currency: existingOrder.items[0]?.currency || 'CAD',
            customerName: existingOrder.customer_name,
            customerEmail: existingOrder.customer_email,
            paymentMethod: existingOrder.payment_method,
            siteName: shippedSiteName,
            logoUrl: shippedLogoUrl,
            overrides: shippedOverrides,
            shippingAddress: existingOrder.shipping_address || undefined,
            trackingNumber: data.tracking_number || undefined,
            trackingCarrier: data.tracking_carrier || undefined,
        }).catch(err => console.error('Order shipped email failed:', err));
    }

    // Restore inventory for cancelled orders
    if (isBeingCancelled && existingOrder.items?.length) {
        for (const item of existingOrder.items) {
            if (item.productId) {
                const { data: product } = await supabase
                    .from('products')
                    .select('inventory_count')
                    .eq('id', item.productId)
                    .single();
                if (product) {
                    await supabase
                        .from('products')
                        .update({ inventory_count: product.inventory_count + item.qty })
                        .eq('id', item.productId);
                }
            }
        }
    }

    // Send cancellation emails
    if (isBeingCancelled) {
        const { data: cancelSiteInfo } = await supabase
            .from('sites')
            .select('site_slug, design_data')
            .eq('id', existingOrder.site_id)
            .single();
        const cancelSiteName = cancelSiteInfo?.site_slug || undefined;
        const cancelLogoUrl: string | undefined = (cancelSiteInfo?.design_data as any)?.headerLogo || (cancelSiteInfo?.design_data as any)?.siteLogo || undefined;

        const { data: ecomSettings } = await supabase
            .from('ecommerce_settings')
            .select('notification_email')
            .eq('site_id', existingOrder.site_id)
            .single();
        const { data: bookingSettings } = !ecomSettings ? await supabase
            .from('booking_settings')
            .select('notification_email')
            .eq('site_id', existingOrder.site_id)
            .single() : { data: null };
        const notificationEmail = (ecomSettings || bookingSettings)?.notification_email;

        const { data: cancelCustomRows } = await supabase
            .from('email_customizations')
            .select('email_key, overrides')
            .eq('site_id', existingOrder.site_id)
            .eq('email_key', 'order_cancelled');
        const cancelOverrides = cancelCustomRows?.[0]?.overrides;

        const emailData = {
            orderId: existingOrder.id,
            items: existingOrder.items,
            subtotalCents: existingOrder.subtotal_cents,
            currency: existingOrder.items[0]?.currency || 'CAD',
            customerName: existingOrder.customer_name,
            customerEmail: existingOrder.customer_email,
            cancellationReason: cancellationReason || undefined,
            refunded,
            siteName: cancelSiteName,
            logoUrl: cancelLogoUrl,
            overrides: cancelOverrides,
        };

        sendOrderCancellationToCustomer(emailData)
            .catch(err => console.error('Order cancellation customer email failed:', err));

        if (notificationEmail) {
            sendOrderCancellationToOwner(emailData, notificationEmail)
                .catch(err => console.error('Order cancellation owner email failed:', err));
        }
    }

    return NextResponse.json({ order: data, refunded });
}
