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
            from: 'Keystone Web Design <bookings@keystoneweb.ca>',
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
            from: 'Keystone Web Design <bookings@keystoneweb.ca>',
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
