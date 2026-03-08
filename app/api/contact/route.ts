import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { sendContactFormNotification } from '@/lib/email';

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { siteId, name, email, phone, message } = body;

        // Validation
        if (!siteId || !name || !email || !message) {
            return NextResponse.json(
                { error: 'Missing required fields: name, email, message' },
                { status: 400 }
            );
        }

        // 1. Get the site owner's notification email (prefer booking settings, fallback to site owner email)
        const { data: settings } = await supabase
            .from('booking_settings')
            .select('notification_email')
            .eq('site_id', siteId)
            .single();

        let ownerEmail = settings?.notification_email;

        // Fallback: Get the actual site owner's email
        if (!ownerEmail) {
            const { data: site } = await supabase
                .from('sites')
                .select('user_id, siteSlug')
                .eq('id', siteId)
                .single();

            if (site?.user_id) {
                const { data: user } = await supabase.auth.admin.getUserById(site.user_id);
                if (user?.user?.email) {
                    ownerEmail = user.user.email;
                }
            }
        }

        if (!ownerEmail) {
            console.error('No owner email found for site:', siteId);
            return NextResponse.json(
                { error: 'Could not deliver message: Business owner email not configured.' },
                { status: 500 }
            );
        }

        // Get site details for the email subject
        const { data: siteDetails } = await supabase
            .from('sites')
            .select('siteSlug')
            .eq('id', siteId)
            .single();

        const siteName = siteDetails?.siteSlug || 'Your Website';

        // 2. Send the email via Resend
        const emailData = {
            siteName,
            customerName: name,
            customerEmail: email,
            customerPhone: phone,
            message,
        };

        const result = await sendContactFormNotification(emailData, ownerEmail);

        if (!result.success) {
            throw result.error;
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
