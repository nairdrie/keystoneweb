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

        // Determine header content and payment section based on payment method
        let headerIcon = '✅';
        let headerBg = '#dcfce7';
        let headerTitle = 'Booking Confirmed';
        let headerSubtitle = data.confirmationMessage || 'We look forward to seeing you!';
        let paymentSection = '';

        if (data.paymentMethod === 'etransfer') {
            headerIcon = '⏳';
            headerBg = '#fef9c3';
            headerTitle = 'Booking Received';
            headerSubtitle = 'Your booking is pending — please send your e-transfer payment to confirm your appointment.';
            if (data.etransferEmail) {
                paymentSection = `
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-top: 16px;">
                    <h3 style="margin: 0 0 10px; color: #92400e; font-size: 14px; font-weight: 700;">💸 Send Your e-Transfer Payment</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr><td style="padding: 4px 0; color: #78350f;">Send to</td><td style="padding: 4px 0; text-align: right; font-weight: 700; color: #92400e;">${data.etransferEmail}</td></tr>
                        <tr><td style="padding: 4px 0; color: #78350f;">Amount</td><td style="padding: 4px 0; text-align: right; font-weight: 700; color: #92400e;">${priceStr}</td></tr>
                        <tr><td style="padding: 4px 0; color: #78350f;">Reference</td><td style="padding: 4px 0; text-align: right; font-weight: 700; font-family: monospace; color: #92400e;">${refId}</td></tr>
                    </table>
                    <p style="margin: 10px 0 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                        Once your payment is received, you will get a confirmation email with your booking details.
                    </p>
                </div>
                `;
            }
        } else if (data.paymentMethod === 'none') {
            paymentSection = `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-top: 16px;">
                <p style="margin: 0; color: #166534; font-size: 14px;">
                    💵 <strong>Payment due at appointment</strong> — please bring ${priceStr} to your appointment.
                </p>
            </div>
            `;
        }

        const subject = data.paymentMethod === 'etransfer'
            ? `Booking Pending — ${data.serviceName}`
            : `Booking Confirmed — ${data.serviceName}`;

        await resend.emails.send({
            from: 'Keystone Web Design <bookings@keystoneweb.ca>',
            to: data.customerEmail,
            subject,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
                    <div style="text-align: center; padding: 24px 0;">
                        <div style="width: 48px; height: 48px; background: ${headerBg}; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">${headerIcon}</div>
                        <h1 style="margin: 12px 0 4px; font-size: 22px; color: #111827;">${headerTitle}</h1>
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">${headerSubtitle}</p>
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

        const paymentMethodLabel = data.paymentMethod === 'etransfer' ? 'Interac e-Transfer'
            : data.paymentMethod === 'stripe' ? 'Stripe (paid online)'
            : 'Pay in person';

        // Payment-specific action section for the owner
        let actionSection = '';
        if (data.paymentMethod === 'etransfer') {
            actionSection = `
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-top: 16px;">
                <h3 style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: 700;">⚠️ Awaiting e-Transfer Payment</h3>
                <p style="margin: 0 0 8px; color: #78350f; font-size: 14px; line-height: 1.5;">
                    <strong>${data.customerName}</strong> has submitted a booking but payment has not yet been received.
                    They have been instructed to send <strong>${priceStr}</strong> (Ref: <strong>${refId}</strong>) to your e-transfer address.
                </p>
                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                    Once you receive the e-transfer, log in to your dashboard and confirm the booking.
                    This will send <strong>${data.customerName}</strong> their booking confirmation email.
                </p>
            </div>
            `;
        } else if (data.paymentMethod === 'none') {
            actionSection = `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-top: 16px;">
                <p style="margin: 0; color: #166534; font-size: 14px;">
                    💵 <strong>Collect payment in person</strong> — remember to collect <strong>${priceStr}</strong> at the time of the appointment.
                </p>
            </div>
            `;
        }

        const subject = data.paymentMethod === 'etransfer'
            ? `New Booking (Awaiting Payment) — ${data.serviceName} with ${data.customerName}`
            : `New Booking — ${data.serviceName} with ${data.customerName}`;

        await resend.emails.send({
            from: 'Keystone Web Design <bookings@keystoneweb.ca>',
            to: ownerEmail,
            subject,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
                    <div style="text-align: center; padding: 24px 0;">
                        <div style="width: 48px; height: 48px; background: #dbeafe; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">📅</div>
                        <h1 style="margin: 12px 0 4px; font-size: 22px; color: #111827;">New Booking</h1>
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">You have a new appointment request</p>
                    </div>

                    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr><td style="padding: 6px 0; color: #6b7280;">Service</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.serviceName}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Date</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${dateFormatted}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Time</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.startTime}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Duration</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.duration} min</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Price</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${priceStr}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Payment</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${paymentMethodLabel}</td></tr>
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

                    ${actionSection}

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

/**
 * Send payment confirmed / booking confirmed email to the customer
 * Called when the owner marks an e-transfer booking as confirmed
 */
export async function sendCustomerPaymentConfirmed(data: BookingEmailData) {
    try {
        const dateFormatted = new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });

        const priceStr = data.priceCents > 0 ? `$${(data.priceCents / 100).toFixed(2)} ${data.currency}` : 'Free';
        const refId = data.bookingId.slice(0, 8).toUpperCase();

        await resend.emails.send({
            from: 'Keystone Web Design <bookings@keystoneweb.ca>',
            to: data.customerEmail,
            subject: `Booking Confirmed — ${data.serviceName}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
                    <div style="text-align: center; padding: 24px 0;">
                        <div style="width: 48px; height: 48px; background: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">✅</div>
                        <h1 style="margin: 12px 0 4px; font-size: 22px; color: #111827;">Payment Received — Booking Confirmed</h1>
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">${data.confirmationMessage || 'Your payment has been received. We look forward to seeing you!'}</p>
                    </div>

                    <div style="background: #f9fafb; border-radius: 8px; padding: 16px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr><td style="padding: 6px 0; color: #6b7280;">Service</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.serviceName}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Date</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${dateFormatted}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Time</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.startTime}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Duration</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${data.duration} min</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Amount Paid</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #111827;">${priceStr}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Ref #</td><td style="padding: 6px 0; text-align: right; font-weight: 600; font-family: monospace; color: #111827;">${refId}</td></tr>
                        </table>
                    </div>

                    <div style="background: #dcfce7; border-radius: 8px; padding: 14px; margin-top: 16px;">
                        <p style="margin: 0; color: #166534; font-size: 14px; text-align: center;">
                            ✓ Your e-transfer payment has been confirmed
                        </p>
                    </div>

                    <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">
                        Powered by Keystone Web Design
                    </p>
                </div>
            `,
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to send customer payment confirmed email:', error);
        return { success: false, error };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Order Emails
// ═══════════════════════════════════════════════════════════════════════════════

interface OrderEmailData {
    orderId: string;
    items: Array<{ name: string; price_cents: number; qty: number; variants?: Record<string, string> }>;
    subtotalCents: number;
    currency: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    shippingAddress?: { line1?: string; city?: string; province?: string; postal?: string };
    paymentMethod: string;
    etransferEmail?: string;
}

export async function sendOrderConfirmation(data: OrderEmailData) {
    try {
        const refId = `ORDER-${data.orderId.slice(0, 8).toUpperCase()}`;
        const total = `$${(data.subtotalCents / 100).toFixed(2)} ${data.currency}`;

        const itemsHtml = data.items.map(item => {
            const varStr = item.variants ? Object.values(item.variants).join(', ') : '';
            return `<tr>
                <td style="padding:6px 0;color:#111827;font-size:14px;">${item.name}${varStr ? ` <span style="color:#6b7280">(${varStr})</span>` : ''}</td>
                <td style="padding:6px 0;text-align:center;color:#6b7280;font-size:14px;">x${item.qty}</td>
                <td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;font-size:14px;">$${(item.price_cents * item.qty / 100).toFixed(2)}</td>
            </tr>`;
        }).join('');

        let paymentSection = '';
        if (data.paymentMethod === 'etransfer' && data.etransferEmail) {
            paymentSection = `
                <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-top:16px;">
                    <h3 style="margin:0 0 8px;color:#92400e;font-size:14px;">💸 Payment via Interac e-Transfer</h3>
                    <p style="margin:0;color:#78350f;font-size:14px;">Send <strong>${total}</strong> to: <strong>${data.etransferEmail}</strong></p>
                    <p style="margin:4px 0 0;color:#92400e;font-size:12px;">Reference: <strong>${refId}</strong></p>
                </div>`;
        }

        await resend.emails.send({
            from: 'Keystone Web Design <orders@keystoneweb.ca>',
            to: data.customerEmail,
            subject: `Order Confirmed — ${refId}`,
            html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;">
                    <div style="text-align:center;padding:24px 0;">
                        <div style="width:48px;height:48px;background:#dcfce7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:24px;">🛍️</div>
                        <h1 style="margin:12px 0 4px;font-size:22px;color:#111827;">Order Confirmed</h1>
                        <p style="margin:0;color:#6b7280;font-size:14px;">Thank you for your order, ${data.customerName}!</p>
                    </div>
                    <div style="background:#f9fafb;border-radius:8px;padding:16px;">
                        <table style="width:100%;border-collapse:collapse;">${itemsHtml}
                            <tr><td colspan="2" style="padding:8px 0 4px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Total</td><td style="padding:8px 0 4px;border-top:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111827;font-size:16px;">${total}</td></tr>
                        </table>
                    </div>
                    ${paymentSection}
                    <p style="margin-top:16px;font-size:12px;color:#9ca3af;text-align:center;">Ref: ${refId}</p>
                    <p style="margin-top:8px;font-size:12px;color:#9ca3af;text-align:center;">Powered by Keystone Web Design</p>
                </div>`,
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to send order confirmation email:', error);
        return { success: false, error };
    }
}

export async function sendOrderNotification(data: OrderEmailData, ownerEmail: string) {
    try {
        const refId = `ORDER-${data.orderId.slice(0, 8).toUpperCase()}`;
        const total = `$${(data.subtotalCents / 100).toFixed(2)} ${data.currency}`;
        const itemsSummary = data.items.map(i => `${i.qty}x ${i.name}`).join(', ');

        await resend.emails.send({
            from: 'Keystone Web Design <orders@keystoneweb.ca>',
            to: ownerEmail,
            subject: `New Order — ${refId} from ${data.customerName}`,
            html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;">
                    <div style="text-align:center;padding:24px 0;">
                        <div style="width:48px;height:48px;background:#dbeafe;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:24px;">📦</div>
                        <h1 style="margin:12px 0 4px;font-size:22px;color:#111827;">New Order</h1>
                        <p style="margin:0;color:#6b7280;font-size:14px;">${refId} — ${total}</p>
                    </div>
                    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:16px;">
                        <p style="margin:0;font-size:14px;color:#111827;"><strong>Items:</strong> ${itemsSummary}</p>
                        <p style="margin:8px 0 0;font-size:14px;color:#111827;"><strong>Payment:</strong> ${data.paymentMethod === 'etransfer' ? 'e-Transfer' : data.paymentMethod === 'stripe' ? 'Stripe' : 'Pay on delivery'}</p>
                    </div>
                    <div style="background:#f0f9ff;border-radius:8px;padding:16px;">
                        <h3 style="margin:0 0 8px;font-size:14px;color:#0c4a6e;">Customer</h3>
                        <p style="margin:2px 0;font-size:14px;color:#111827;"><strong>${data.customerName}</strong></p>
                        <p style="margin:2px 0;font-size:14px;color:#111827;">📧 ${data.customerEmail}</p>
                        ${data.customerPhone ? `<p style="margin:2px 0;font-size:14px;color:#111827;">📱 ${data.customerPhone}</p>` : ''}
                        ${data.shippingAddress ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;">📍 ${[data.shippingAddress.line1, data.shippingAddress.city, data.shippingAddress.province, data.shippingAddress.postal].filter(Boolean).join(', ')}</p>` : ''}
                    </div>
                    <p style="margin-top:24px;font-size:12px;color:#9ca3af;text-align:center;">Powered by Keystone Web Design</p>
                </div>`,
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to send order notification email:', error);
        return { success: false, error };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Support Request Emails
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Notify ops admins that a new support request has arrived via email.
 */
export async function sendSupportRequestNotification(data: {
    fromName: string | null;
    fromEmail: string;
    subject: string;
    bodyPreview: string | null;
}, adminEmails: string[]) {
    if (!adminEmails.length) return { success: true };

    try {
        const displayName = data.fromName ? `${data.fromName} <${data.fromEmail}>` : data.fromEmail;
        const preview = data.bodyPreview
            ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-top:16px;">
                <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;line-height:1.5;">${data.bodyPreview}</p>
               </div>`
            : '';

        await resend.emails.send({
            from: 'Keystone Web Design <support@keystoneweb.ca>',
            to: adminEmails,
            subject: `New Support Request — ${data.subject}`,
            html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;">
                    <div style="text-align:center;padding:24px 0;">
                        <div style="width:48px;height:48px;background:#fef3c7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:24px;">📬</div>
                        <h1 style="margin:12px 0 4px;font-size:22px;color:#111827;">New Support Request</h1>
                        <p style="margin:0;color:#6b7280;font-size:14px;">A new email has arrived at support@keystoneweb.ca</p>
                    </div>
                    <div style="background:#f0f9ff;border-radius:8px;padding:16px;">
                        <table style="width:100%;border-collapse:collapse;font-size:14px;">
                            <tr><td style="padding:4px 0;color:#6b7280;width:60px;">From</td><td style="padding:4px 0;font-weight:600;color:#111827;">${displayName}</td></tr>
                            <tr><td style="padding:4px 0;color:#6b7280;">Subject</td><td style="padding:4px 0;font-weight:600;color:#111827;">${data.subject}</td></tr>
                        </table>
                    </div>
                    ${preview}
                    <div style="text-align:center;margin-top:20px;">
                        <a href="https://ops.keystoneweb.ca/support" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600;">View in Ops Dashboard</a>
                    </div>
                    <p style="margin-top:24px;font-size:12px;color:#9ca3af;text-align:center;">Powered by Keystone Web Design</p>
                </div>
            `,
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to send support request notification email:', error);
        return { success: false, error };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Contact Form Emails
// ═══════════════════════════════════════════════════════════════════════════════

interface ContactEmailData {
    siteName: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    message: string;
}

/**
 * Send new contact form notification email to the business owner
 */
export async function sendContactFormNotification(data: ContactEmailData, ownerEmail: string) {
    try {
        await resend.emails.send({
            from: 'Keystone Web Design <contact@keystoneweb.ca>',
            to: ownerEmail,
            subject: `New Message — ${data.siteName}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
                    <div style="text-align: center; padding: 24px 0;">
                         <div style="width: 48px; height: 48px; background: #e0e7ff; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">💬</div>
                        <h1 style="margin: 12px 0 4px; font-size: 22px; color: #111827;">New Message</h1>
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">Someone reached out from your website</p>
                    </div>
                    
                    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                        <p style="margin: 0; font-size: 15px; color: #111827; white-space: pre-wrap; line-height: 1.5;">${data.message}</p>
                    </div>
                    
                    <div style="background: #f0f9ff; border-radius: 8px; padding: 16px;">
                        <h3 style="margin: 0 0 8px; font-size: 14px; color: #0c4a6e;">Contact Details</h3>
                        <p style="margin: 2px 0; font-size: 14px; color: #111827;"><strong>${data.customerName}</strong></p>
                        <p style="margin: 2px 0; font-size: 14px; color: #111827;">📧 <a href="mailto:${data.customerEmail}" style="color: #0284c7;">${data.customerEmail}</a></p>
                        ${data.customerPhone ? `<p style="margin: 2px 0; font-size: 14px; color: #111827;">📱 <a href="tel:${data.customerPhone}" style="color: #0284c7;">${data.customerPhone}</a></p>` : ''}
                    </div>
                    
                    <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">
                        Powered by Keystone Web Design
                    </p>
                </div>
            `,
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to send contact notification email:', error);
        return { success: false, error };
    }
}

/**
 * Send a reply from the site owner (or AI) back to a contact form submitter.
 * `fromAddress` should be a verified Resend sender (e.g. contact@keystoneweb.ca).
 */
export async function sendContactReplyEmail(data: {
    toEmail: string;
    toName: string;
    fromAddress: string;   // verified sender address
    fromName: string;      // display name, e.g. business name
    replyText: string;
    originalMessage: string;
    submissionId: string;  // used as a thread reference token
}) {
    try {
        const { data: sent, error } = await resend.emails.send({
            from: `${data.fromName} <${data.fromAddress}>`,
            to: data.toEmail,
            replyTo: data.fromAddress,
            subject: `Re: Your message to ${data.fromName}`,
            html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;">
                    <div style="background:#f9fafb;border-left:4px solid #dc2626;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
                        <p style="margin:0;font-size:15px;color:#111827;line-height:1.6;">${data.replyText.replace(/\n/g, '<br>')}</p>
                    </div>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
                    <p style="font-size:12px;color:#9ca3af;margin:0 0 8px;">Your original message:</p>
                    <blockquote style="margin:0;padding:12px 16px;background:#f3f4f6;border-radius:6px;font-size:13px;color:#6b7280;line-height:1.6;">
                        ${data.originalMessage.replace(/\n/g, '<br>')}
                    </blockquote>
                    <p style="margin-top:24px;font-size:11px;color:#d1d5db;text-align:center;">
                        ref:${data.submissionId}
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error('Failed to send contact reply email:', error);
            return { success: false, error };
        }

        return { success: true, messageId: sent?.id };
    } catch (error) {
        console.error('Failed to send contact reply email:', error);
        return { success: false, error };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Subscription Emails
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendSubscriptionPurchaseEmail(data: {
    customerEmail: string;
    customerName?: string;
    planName: string;
    loginUrl: string;
}) {
    try {
        await resend.emails.send({
            from: 'Keystone Web Design <noreply@keystoneweb.ca>',
            to: data.customerEmail,
            subject: `Subscription Confirmed — ${data.planName}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff;">
                    <!-- Header bar -->
                    <div style="background: #fe4545; height: 4px; border-radius: 4px 4px 0 0;"></div>

                    <!-- Body -->
                    <div style="padding: 40px 32px;">
                        <!-- Logo wordmark -->
                        <img style="width:200px; margin-bottom:32px;" src="https://www.keystoneweb.ca/assets/logo/keystone-logo.png" alt="Keystone Web" />

                        <!-- Heading -->
                        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #171717; letter-spacing: -0.02em;">Subscription Confirmed</h1>
                        <p style="margin: 0 0 28px; font-size: 15px; color: #6b7280; line-height: 1.6;">
                            Thanks for subscribing${data.customerName ? `, ${data.customerName}` : ''}! Your <strong>${data.planName}</strong> subscription is now active.
                        </p>

                        <!-- CTA Button -->
                        <a href="${data.loginUrl}" style="display: inline-block; background: #fe4545; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 13px 28px; border-radius: 8px; letter-spacing: 0.01em;">
                            Go to Dashboard →
                        </a>

                        <!-- Divider -->
                        <div style="border-top: 1px solid #f3f4f6; margin: 32px 0;"></div>

                        <!-- Security note -->
                        <p style="margin: 0 0 8px; font-size: 13px; color: #9ca3af; line-height: 1.6;">
                            If you have any questions or need help, just reply to this email to reach our support team.
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #f3f4f6; border-radius: 0 0 4px 4px;">
                        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                            Powered by <strong style="color: #6b7280;">Keystone Web Design</strong>
                        </p>
                    </div>
                </div>
            `,
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to send subscription purchase email:', error);
        return { success: false, error };
    }
}

export async function sendSubscriptionCancelledEmail(data: {
    customerEmail: string;
    customerName?: string;
    planName: string;
}) {
    try {
        await resend.emails.send({
            from: 'Keystone Web Design <noreply@keystoneweb.ca>',
            to: data.customerEmail,
            subject: `Subscription Cancelled — ${data.planName}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff;">
                    <!-- Header bar -->
                    <div style="background: #fe4545; height: 4px; border-radius: 4px 4px 0 0;"></div>

                    <!-- Body -->
                    <div style="padding: 40px 32px;">
                        <!-- Logo wordmark -->
                        <img style="width:200px; margin-bottom:32px;" src="https://www.keystoneweb.ca/assets/logo/keystone-logo.png" alt="Keystone Web" />

                        <!-- Heading -->
                        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #171717; letter-spacing: -0.02em;">Subscription Cancelled</h1>
                        <p style="margin: 0 0 28px; font-size: 15px; color: #6b7280; line-height: 1.6;">
                            We've processed the cancellation of your <strong>${data.planName}</strong> plan. You'll retain access to your features until the end of your billing cycle.
                        </p>

                        <!-- CTA Button -->
                        <a href="https://keystoneweb.ca/settings" style="display: inline-block; background: #fe4545; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 13px 28px; border-radius: 8px; letter-spacing: 0.01em;">
                            Reactivate Subscription →
                        </a>

                        <!-- Divider -->
                        <div style="border-top: 1px solid #f3f4f6; margin: 32px 0;"></div>

                        <!-- Security note -->
                        <p style="margin: 0 0 8px; font-size: 13px; color: #9ca3af; line-height: 1.6;">
                            We're sorry to see you go. If you have a moment, we'd appreciate your feedback so we can improve. Just reply to this email.
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #f3f4f6; border-radius: 0 0 4px 4px;">
                        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                            Powered by <strong style="color: #6b7280;">Keystone Web Design</strong>
                        </p>
                    </div>
                </div>
            `,
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to send subscription cancelled email:', error);
        return { success: false, error };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Auth Emails
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendWelcomeEmail(data: {
    customerEmail: string;
    customerName?: string;
    loginUrl: string;
}) {
    try {
        await resend.emails.send({
            from: 'Keystone Web Design <noreply@keystoneweb.ca>',
            to: data.customerEmail,
            subject: `Welcome to Keystone Web Design`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff;">
                    <!-- Header bar -->
                    <div style="background: #fe4545; height: 4px; border-radius: 4px 4px 0 0;"></div>

                    <!-- Body -->
                    <div style="padding: 40px 32px;">
                        <!-- Logo wordmark -->
                        <img style="width:200px; margin-bottom:32px;" src="https://www.keystoneweb.ca/assets/logo/keystone-logo.png" alt="Keystone Web" />

                        <!-- Heading -->
                        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #171717; letter-spacing: -0.02em;">Welcome to Keystone!</h1>
                        <p style="margin: 0 0 28px; font-size: 15px; color: #6b7280; line-height: 1.6;">
                            Hi${data.customerName ? ` ${data.customerName}` : ''}, thanks for creating an account with us. We're thrilled to have you on board! You can now log in to the dashboard to start exploring your account.
                        </p>

                        <!-- CTA Button -->
                        <a href="${data.loginUrl}" style="display: inline-block; background: #fe4545; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 13px 28px; border-radius: 8px; letter-spacing: 0.01em;">
                            Log in to Dashboard →
                        </a>

                        <!-- Divider -->
                        <div style="border-top: 1px solid #f3f4f6; margin: 32px 0;"></div>

                        <!-- Security note -->
                        <p style="margin: 0 0 8px; font-size: 13px; color: #9ca3af; line-height: 1.6;">
                            If you have any questions or need help, just reply to this email to reach our support team.
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #f3f4f6; border-radius: 0 0 4px 4px;">
                        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                            Powered by <strong style="color: #6b7280;">Keystone Web Design</strong>
                        </p>
                    </div>
                </div>
            `,
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to send welcome email:', error);
        return { success: false, error };
    }
}
