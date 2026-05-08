import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendContactFormNotification } from '@/lib/email';
import { triageContactSubmission, isObviousSpam } from '@/lib/contact/triage';
import { isContactRateLimited, getRateLimitResetSecs } from '@/lib/contact/rate-limit';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    // IP-based rate limiting — extract IP from headers
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') ?? 'unknown';

    if (isContactRateLimited(ip)) {
        const resetSecs = getRateLimitResetSecs(ip);
        return NextResponse.json(
            { error: `Too many messages. Please wait ${Math.ceil(resetSecs / 60)} minute(s) before trying again.` },
            { status: 429 }
        );
    }

    try {
        const body = await request.json();
        const { siteId, name, email, phone, message, _hp, source_type, metadata } = body;

        // Honeypot: bots fill hidden fields; humans leave them blank
        if (_hp) {
            return NextResponse.json({ success: true, message: 'Message sent successfully' });
        }

        // Validate optional source_type
        const ALLOWED_SOURCE_TYPES = ['contact_form', 'estimate_form', 'booking', 'inbound_email'];
        if (source_type && !ALLOWED_SOURCE_TYPES.includes(source_type)) {
            return NextResponse.json({ error: 'Invalid source_type.' }, { status: 400 });
        }

        // Validate metadata size (max 10KB)
        if (metadata && JSON.stringify(metadata).length > 10240) {
            return NextResponse.json({ error: 'Metadata is too large (max 10KB).' }, { status: 400 });
        }

        // Auto-compose message from structured fields for estimate form submissions
        let composedMessage = message;
        if (source_type === 'estimate_form' && metadata?.fields && Array.isArray(metadata.fields)) {
            const fieldLines = metadata.fields
                .map((f: { label: string; value: unknown; unit?: string }) =>
                    `${f.label}: ${f.value ?? '—'}${f.unit ? ` ${f.unit}` : ''}`)
                .join('\n');
            composedMessage = `Estimate form submission:\n${fieldLines}`;
            const contact = metadata.contact && typeof metadata.contact === 'object' ? metadata.contact : {};
            const contactLines = [
                contact.address ? `Address: ${contact.address}` : null,
                contact.preferredDate ? `Preferred date: ${contact.preferredDate}` : null,
                contact.phone ? `Phone: ${contact.phone}` : null,
            ].filter(Boolean);
            if (contactLines.length > 0) {
                composedMessage += `\n\nContact details:\n${contactLines.join('\n')}`;
            }
            const notes = typeof message === 'string' && message.trim()
                ? message.trim()
                : typeof contact.message === 'string' ? contact.message.trim() : '';
            if (notes) {
                composedMessage += `\n\nAdditional notes:\n${notes}`;
            }
        }

        if (!siteId || !name || !email || !composedMessage) {
            return NextResponse.json(
                { error: 'Missing required fields: name, email, message' },
                { status: 400 }
            );
        }

        // Field length validation
        if (name.length > MAX_NAME_LENGTH) {
            return NextResponse.json({ error: 'Name is too long.' }, { status: 400 });
        }
        if (email.length > MAX_EMAIL_LENGTH) {
            return NextResponse.json({ error: 'Email address is too long.' }, { status: 400 });
        }
        if (composedMessage.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json(
                { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
                { status: 400 }
            );
        }
        if (composedMessage.trim().length < 5) {
            return NextResponse.json({ error: 'Message is too short.' }, { status: 400 });
        }

        const admin = createAdminClient();

        // Resolve the site's primary inbox address so notifications carry the right addressId
        const { data: primaryAddress } = await admin
            .from('site_inbox_addresses')
            .select('id')
            .eq('site_id', siteId)
            .eq('is_primary', true)
            .maybeSingle();

        // 1. Persist the submission immediately
        const { data: submission, error: insertError } = await admin
            .from('contact_submissions')
            .insert({
                site_id: siteId,
                sender_name: name,
                sender_email: email,
                sender_phone: phone ?? null,
                message: composedMessage,
                status: 'new',
                direction: 'inbound',
                source_type: source_type || 'contact_form',
                metadata: metadata || {},
                inbox_address_id: primaryAddress?.id ?? null,
            })
            .select('id')
            .single();

        if (insertError || !submission) {
            console.error('Failed to persist contact submission:', insertError);
            // Non-fatal — still attempt email delivery below
        }

        // 1b. Pre-screen for obvious spam — skip notification email entirely
        if (isObviousSpam(composedMessage, name)) {
            if (submission?.id) {
                await admin
                    .from('contact_submissions')
                    .update({
                        ai_classification: 'spam',
                        ai_confidence: 0,
                        ai_summary: 'Pre-screened as spam (gibberish or known spam pattern).',
                        ai_draft_reply: null,
                        ai_auto_sent: false,
                        status: 'spam',
                    })
                    .eq('id', submission.id);
            }
            // Return success so bots don't retry
            return NextResponse.json({ success: true, message: 'Message sent successfully' });
        }

        // 2. Get site owner's notification email
        const { data: settings } = await supabase
            .from('booking_settings')
            .select('notification_email')
            .eq('site_id', siteId)
            .single();

        let ownerEmail = settings?.notification_email;

        if (!ownerEmail) {
            const { data: site } = await supabase
                .from('sites')
                .select('user_id, site_slug')
                .eq('id', siteId)
                .single();

            if (site?.user_id) {
                const { data: user } = await supabase.auth.admin.getUserById(site.user_id);
                if (user?.user?.email) ownerEmail = user.user.email;
            }
        }

        if (!ownerEmail) {
            console.error('No owner email found for site:', siteId);
            return NextResponse.json(
                { error: 'Could not deliver message: Business owner email not configured.' },
                { status: 500 }
            );
        }

        const { data: siteDetails } = await supabase
            .from('sites')
            .select('site_slug')
            .eq('id', siteId)
            .single();

        const siteName = siteDetails?.site_slug || 'Your Website';

        // 3. Send email notification to owner (existing behaviour)
        const result = await sendContactFormNotification(
            {
                siteName,
                customerName: name,
                customerEmail: email,
                customerPhone: phone,
                message: composedMessage,
                submissionId: submission?.id,
                siteId,
                sourceType: source_type,
                metadata,
                inboxAddressId: primaryAddress?.id ?? null,
                previewBody: composedMessage,
            },
            ownerEmail
        );

        if (!result.success) {
            throw result.error;
        }

        // 4. Fire AI triage in the background — non-blocking, non-fatal
        if (submission?.id) {
            triageContactSubmission(submission.id, admin).catch(err => {
                console.error('[contact] Triage error (non-fatal):', err);
            });
        }

        return NextResponse.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Contact API Error:', error);
        return NextResponse.json(
            { error: 'Something went wrong. Please try again later.' },
            { status: 500 }
        );
    }
}
