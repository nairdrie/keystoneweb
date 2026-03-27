import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendContactFormNotification } from '@/lib/email';

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { siteId, name, email, phone, message } = body;

        if (!siteId || !name || !email || !message) {
            return NextResponse.json(
                { error: 'Missing required fields: name, email, message' },
                { status: 400 }
            );
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
            // Don't fail the user-facing request — still attempt email delivery below
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
                .select('user_id, siteSlug')
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
            .select('siteSlug')
            .eq('id', siteId)
            .single();

        const siteName = siteDetails?.siteSlug || 'Your Website';

        // 3. Send email notification to owner (existing behaviour)
        const result = await sendContactFormNotification(
            { siteName, customerName: name, customerEmail: email, customerPhone: phone, message },
            ownerEmail
        );

        if (!result.success) {
            throw result.error;
        }

        // 4. Fire AI triage async — don't await, don't block the response
        if (submission?.id) {
            fetch(`${request.nextUrl.origin}/api/contact/${submission.id}/triage`, {
                method: 'POST',
                headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '' },
            }).catch(() => {
                // Best-effort — triage failure is non-fatal
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
