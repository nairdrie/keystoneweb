import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendContactFormNotification } from '@/lib/email';
import { triageContactSubmission } from '@/lib/contact/triage';
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
        const { siteId, name, email, phone, message, _hp } = body;

        // Honeypot: bots fill hidden fields; humans leave them blank
        if (_hp) {
            return NextResponse.json({ success: true, message: 'Message sent successfully' });
        }

        if (!siteId || !name || !email || !message) {
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
        if (message.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json(
                { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
                { status: 400 }
            );
        }
        if (message.trim().length < 5) {
            return NextResponse.json({ error: 'Message is too short.' }, { status: 400 });
        }

        const admin = createAdminClient();

        // 1. Persist the submission immediately
        const { data: submission, error: insertError } = await admin
            .from('contact_submissions')
            .insert({
                site_id: siteId,
                sender_name: name,
                sender_email: email,
                sender_phone: phone ?? null,
                message,
                status: 'new',
            })
            .select('id')
            .single();

        if (insertError || !submission) {
            console.error('Failed to persist contact submission:', insertError);
            // Non-fatal — still attempt email delivery below
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
            { siteName, customerName: name, customerEmail: email, customerPhone: phone, message, submissionId: submission?.id, siteId },
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
