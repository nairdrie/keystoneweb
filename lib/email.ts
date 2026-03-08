import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface BookingEmailData {
    serviceName: string;
    date: string;       // YYYY-MM-DD
    startTime: string;  // display format e.g. "9:00 AM"
    duration: number;
    priceCents: number;
    currency: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    notes?: string;
    bookingId: string;
    paymentMethod: string;
    etransferEmail?: string;
    confirmationMessage?: string;
}

/**
 * Send booking confirmation email to the customer
 */
export async function sendCustomerConfirmation(data: BookingEmailData) {
    try {
        const dateFormatted = new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });

        const priceStr = data.priceCents > 0 ? `$${(data.priceCents / 100).toFixed(2)} ${data.currency}` : 'Free';
        const refId = data.bookingId.slice(0, 8).toUpperCase();

        let paymentSection = '';
        if (data.paymentMethod === 'etransfer' && data.etransferEmail) {
            paymentSection = `
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-top: 16px;">
                    <h3 style="margin: 0 0 8px; color: #92400e; font-size: 14px;">💸 Payment via Interac e-Transfer</h3>
                    <p style="margin: 0; color: #78350f; font-size: 14px;">
                        Send <strong>${priceStr}</strong> to: <strong>${data.etransferEmail}</strong>
                    </p>
                    <p style="margin: 4px 0 0; color: #92400e; font-size: 12px;">
                        Reference: <strong>${refId}</strong>
                    </p>
                </div>
            `;
        }

        await resend.emails.send({
            from: 'Keystone Web <bookings@keystoneweb.design>',
            to: data.customerEmail,
            subject: `Booking Confirmed — ${data.serviceName}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
                    <div style="text-align: center; padding: 24px 0;">
                        <div style="width: 48px; height: 48px; background: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">✅</div>
                        <h1 style="margin: 12px 0 4px; font-size: 22px; color: #111827;">Booking Confirmed</h1>
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">${data.confirmationMessage || 'We look forward to seeing you!'}</p>
                    </div>
                    
                    <div style="background: #f9fafb; border-radius: 8px; padding: 16px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr><td style="padding: 6px 0; color: #6b7280;">Service</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.serviceName}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Date</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${dateFormatted}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Time</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.startTime}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Duration</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.duration} min</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Price</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${priceStr}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Ref #</td><td style="padding: 6px 0; text-align: right; font-weight: 600; font-family: monospace; color: #111827;">${refId}</td></tr>
                        </table>
                    </div>
                    
                    ${paymentSection}
                    
                    <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">
                        Powered by Keystone Web Design
                    </p>
                </div>
            `,
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to send customer confirmation email:', error);
        return { success: false, error };
    }
}

/**
 * Send new booking notification email to the business owner
 */
export async function sendOwnerNotification(data: BookingEmailData, ownerEmail: string) {
    try {
        const dateFormatted = new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });

        const priceStr = data.priceCents > 0 ? `$${(data.priceCents / 100).toFixed(2)} ${data.currency}` : 'Free';
        const refId = data.bookingId.slice(0, 8).toUpperCase();

        await resend.emails.send({
            from: 'Keystone Web <bookings@keystoneweb.ca>',
            to: ownerEmail,
            subject: `New Booking — ${data.serviceName} with ${data.customerName}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
                    <div style="text-align: center; padding: 24px 0;">
                        <div style="width: 48px; height: 48px; background: #dbeafe; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">📅</div>
                        <h1 style="margin: 12px 0 4px; font-size: 22px; color: #111827;">New Booking</h1>
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">You have a new appointment</p>
                    </div>
                    
                    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr><td style="padding: 6px 0; color: #6b7280;">Service</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.serviceName}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Date</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${dateFormatted}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Time</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.startTime}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Duration</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.duration} min</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Price</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${priceStr}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Payment</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.paymentMethod === 'etransfer' ? 'e-Transfer' : data.paymentMethod === 'stripe' ? 'Stripe' : 'Pay in person'}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Ref #</td><td style="padding: 6px 0; text-align: right; font-weight: 600; font-family: monospace; color: #111827;">${refId}</td></tr>
                        </table>
                    </div>
                    
                    <div style="background: #f0f9ff; border-radius: 8px; padding: 16px;">
                        <h3 style="margin: 0 0 8px; font-size: 14px; color: #0c4a6e;">Customer Details</h3>
                        <p style="margin: 2px 0; font-size: 14px; color: #111827;"><strong>${data.customerName}</strong></p>
                        <p style="margin: 2px 0; font-size: 14px; color: #111827;">📧 ${data.customerEmail}</p>
                        ${data.customerPhone ? `<p style="margin: 2px 0; font-size: 14px; color: #111827;">📱 ${data.customerPhone}</p>` : ''}
                        ${data.notes ? `<p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;"><em>Notes: ${data.notes}</em></p>` : ''}
                    </div>
                    
                    <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">
                        Powered by Keystone Web Design
                    </p>
                </div>
            `,
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to send owner notification email:', error);
        return { success: false, error };
    }
}
