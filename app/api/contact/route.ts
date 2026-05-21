import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendContactFormNotification, sendEstimateQuoteCustomerConfirmation } from '@/lib/email';
import { triageContactSubmission, isObviousSpam } from '@/lib/contact/triage';
import { isContactRateLimited, getRateLimitResetSecs } from '@/lib/contact/rate-limit';
import { ensureKswdInboxAddress } from '@/lib/email/inbox-addresses';
import {
    calculateQuote,
    getFieldDisplayValue,
    getQuoteDisplayText,
    normalizeEstimateQuoteSettings,
    type EstimateQuoteSettings,
    type QuoteCalculationResult,
} from '@/lib/estimate-quote';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_METADATA_LENGTH = 75000;

type MetadataRecord = Record<string, unknown>;

export async function POST(request: NextRequest) {
    // IP-based rate limiting - extract IP from headers
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
        const sourceType = typeof source_type === 'string' ? source_type : undefined;

        // Honeypot: bots fill hidden fields; humans leave them blank
        if (_hp) {
            return NextResponse.json({ success: true, message: 'Message sent successfully' });
        }

        // Validate optional source_type
        const ALLOWED_SOURCE_TYPES = ['contact_form', 'estimate_form', 'booking', 'inbound_email'];
        if (sourceType && !ALLOWED_SOURCE_TYPES.includes(sourceType)) {
            return NextResponse.json({ error: 'Invalid source_type.' }, { status: 400 });
        }

        if (metadata && JSON.stringify(metadata).length > MAX_METADATA_LENGTH) {
            return NextResponse.json({ error: 'Metadata is too large.' }, { status: 400 });
        }

        const admin = createAdminClient();
        let processedMetadata = toRecord(metadata);
        let composedMessage = typeof message === 'string' ? message : '';
        let quoteSettings: EstimateQuoteSettings | null = null;
        let quoteResult: QuoteCalculationResult | null = null;

        if (sourceType === 'estimate_form') {
            const prepared = await prepareEstimateSubmission(admin, siteId, processedMetadata, composedMessage);
            processedMetadata = prepared.metadata;
            composedMessage = prepared.message;
            quoteSettings = prepared.settings;
            quoteResult = prepared.result;
        }

        processedMetadata = shrinkMetadata(processedMetadata);

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
            if (sourceType === 'estimate_form') {
                composedMessage = `${composedMessage.slice(0, MAX_MESSAGE_LENGTH - 24)}\n\n[Message truncated]`;
            } else {
                return NextResponse.json(
                    { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
                    { status: 400 }
                );
            }
        }
        if (composedMessage.trim().length < 5) {
            return NextResponse.json({ error: 'Message is too short.' }, { status: 400 });
        }

        // Resolve the site's primary inbox address so notifications carry the right addressId.
        // If the address row doesn't exist yet (site published but inbox never opened),
        // create it now so the submission lands on the primary tab instead of being
        // hidden behind every address filter.
        const { data: siteForAddress } = await admin
            .from('sites')
            .select('published_domain')
            .eq('id', siteId)
            .maybeSingle();
        if (siteForAddress?.published_domain) {
            await ensureKswdInboxAddress(admin, siteId, siteForAddress.published_domain);
        }
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
                source_type: sourceType || 'contact_form',
                metadata: processedMetadata,
                inbox_address_id: primaryAddress?.id ?? null,
            })
            .select('id')
            .single();

        if (insertError || !submission) {
            console.error('Failed to persist contact submission:', insertError);
            // Non-fatal - still attempt email delivery below
        }

        // 1b. Pre-screen for obvious spam - skip notification email entirely
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
        const { data: settings } = await admin
            .from('booking_settings')
            .select('notification_email')
            .eq('site_id', siteId)
            .single();

        let ownerEmail = settings?.notification_email;

        const { data: siteDetails } = await admin
            .from('sites')
            .select('user_id, site_slug')
            .eq('id', siteId)
            .single();

        if (!ownerEmail && siteDetails?.user_id) {
            const { data: user } = await admin.auth.admin.getUserById(siteDetails.user_id);
            if (user?.user?.email) ownerEmail = user.user.email;
        }

        if (!ownerEmail) {
            console.error('No owner email found for site:', siteId);
            return NextResponse.json(
                { error: 'Could not deliver message: Business owner email not configured.' },
                { status: 500 }
            );
        }

        const siteName = siteDetails?.site_slug || 'Your Website';
        const recipients = uniqueEmails([
            ownerEmail,
            ...(quoteSettings?.notifications.businessRecipients || []),
        ]);

        // 3. Send email notification to owner and any quote-specific recipients
        const notificationResults = await Promise.all(recipients.map((recipient) =>
            sendContactFormNotification(
                {
                    siteName,
                    customerName: name,
                    customerEmail: email,
                    customerPhone: phone,
                    message: composedMessage,
                    submissionId: submission?.id,
                    siteId,
                    sourceType,
                    metadata: processedMetadata,
                    inboxAddressId: primaryAddress?.id ?? null,
                    previewBody: composedMessage,
                },
                recipient
            )
        ));

        const failedNotification = notificationResults.find((result) => !result.success);
        if (failedNotification) {
            throw failedNotification.error;
        }

        if (
            sourceType === 'estimate_form' &&
            quoteSettings?.notifications.sendCustomerEmail &&
            quoteResult &&
            typeof email === 'string' &&
            email !== 'estimate-request@kswd.ca'
        ) {
            const customerResult = await sendEstimateQuoteCustomerConfirmation({
                siteName,
                customerName: name,
                customerEmail: email,
                metadata: processedMetadata,
                settings: quoteSettings,
                result: quoteResult,
                submissionId: submission?.id,
            });
            if (!customerResult.success) {
                console.error('Failed to send estimate customer confirmation:', customerResult.error);
            }
        }

        // 4. Fire AI triage in the background - non-blocking, non-fatal
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

async function prepareEstimateSubmission(
    admin: ReturnType<typeof createAdminClient>,
    siteId: unknown,
    metadata: MetadataRecord,
    message: string,
): Promise<{ metadata: MetadataRecord; message: string; settings: EstimateQuoteSettings | null; result: QuoteCalculationResult | null }> {
    let settingsSource = 'submitted-metadata';
    let settingsInput: MetadataRecord | null = isRecord(metadata.estimateQuoteSettings)
        ? { estimateQuoteSettings: metadata.estimateQuoteSettings }
        : null;

    if (typeof siteId === 'string') {
        const blockData = await findEstimateBlockData(admin, siteId, metadata.blockId);
        if (blockData) {
            settingsInput = blockData;
            settingsSource = 'server-block';
        }
    }

    if (!settingsInput) {
        const warnings = appendWarning(metadata.pricingWarnings, 'Server could not find quote settings for validation.');
        const nextMetadata = { ...metadata, pricingWarnings: warnings, serverCalculated: false };
        return { metadata: nextMetadata, message: composeEstimateMessage(nextMetadata, message), settings: null, result: null };
    }

    const settings = normalizeEstimateQuoteSettings(settingsInput);
    const quoteValues = buildQuoteValues(settings, metadata);
    const result = calculateQuote(settings, quoteValues);
    const displayVisible = result.displayMode !== 'hidden';
    const nextMetadata: MetadataRecord = {
        ...metadata,
        blockSettingsSource: settingsSource,
        quoteValues,
        quoteResult: result,
        quoteDisplayText: getQuoteDisplayText(result),
        quoteStatus: readString(metadata.quoteStatus, 'new'),
        quoteMode: settings.quoteMode,
        displayMode: result.displayMode,
        triggeredRuleIds: result.triggeredRuleIds,
        inactiveRuleIds: result.inactiveRuleIds,
        pricingWarnings: result.warnings,
        serverCalculated: true,
        fields: settings.fields.map((field) => ({
            id: field.id,
            label: field.label,
            value: getFieldDisplayValue(field, quoteValues[field.id]),
            rawValue: quoteValues[field.id] ?? '',
            type: field.type,
            unit: field.unit || undefined,
        })),
        contact: normalizeContact(metadata.contact),
        notifications: settings.notifications,
        deposit: settings.deposit,
        crm: settings.crm,
        tracking: toRecord(metadata.tracking),
    };

    if (displayVisible) {
        nextMetadata.estimate_shown = metadata.estimate_shown === true;
        nextMetadata.estimate_low_cents = result.rangeLowCents ?? result.totalCents;
        nextMetadata.estimate_high_cents = result.rangeHighCents ?? result.totalCents;
        nextMetadata.estimate_currency = result.currency;
        nextMetadata.estimate_disclaimer = settings.display.disclaimer;
    }

    return {
        metadata: nextMetadata,
        message: composeEstimateMessage(nextMetadata, message),
        settings,
        result,
    };
}

async function findEstimateBlockData(
    admin: ReturnType<typeof createAdminClient>,
    siteId: string,
    blockId: unknown,
): Promise<MetadataRecord | null> {
    const desiredBlockId = typeof blockId === 'string' ? blockId : '';
    const { data: pages } = await admin
        .from('pages')
        .select('design_data, published_data')
        .eq('site_id', siteId);

    for (const page of pages || []) {
        const block = findEstimateBlockInData(page.published_data, desiredBlockId)
            || findEstimateBlockInData(page.design_data, desiredBlockId);
        if (block) return block.data;
    }

    const { data: site } = await admin
        .from('sites')
        .select('design_data, published_data')
        .eq('id', siteId)
        .maybeSingle();

    const block = findEstimateBlockInData(site?.published_data, desiredBlockId)
        || findEstimateBlockInData(site?.design_data, desiredBlockId);
    return block?.data || null;
}

function findEstimateBlockInData(data: unknown, desiredBlockId: string): { data: MetadataRecord } | null {
    if (!isRecord(data)) return null;
    const blocks = Array.isArray(data.blocks) ? data.blocks : Array.isArray(data.__blocks) ? data.__blocks : [];
    for (const block of blocks) {
        if (!isRecord(block)) continue;
        const type = readString(block.type, '');
        const id = readString(block.id, '');
        if (type !== 'estimateForm') continue;
        if (desiredBlockId && id !== desiredBlockId) continue;
        return { data: toRecord(block.data) };
    }
    return null;
}

function buildQuoteValues(settings: EstimateQuoteSettings, metadata: MetadataRecord): Record<string, unknown> {
    const values = toRecord(metadata.quoteValues);
    const fieldRows = Array.isArray(metadata.fields) ? metadata.fields : [];
    for (const row of fieldRows) {
        if (!isRecord(row)) continue;
        const id = readString(row.id, '');
        if (!id || values[id] !== undefined) continue;
        values[id] = row.rawValue ?? row.value ?? '';
    }
    for (const field of settings.fields) {
        if (values[field.id] === undefined && field.defaultValue !== undefined) {
            values[field.id] = field.defaultValue;
        }
    }
    return values;
}

function composeEstimateMessage(metadata: MetadataRecord, fallbackMessage: string): string {
    const fields = Array.isArray(metadata.fields) ? metadata.fields : [];
    const fieldLines = fields
        .map((f) => {
            if (!isRecord(f)) return null;
            const label = readString(f.label, 'Field');
            const value = f.value ?? '-';
            const unit = readString(f.unit, '');
            return `${label}: ${String(value || '-')}${unit ? ` ${unit}` : ''}`;
        })
        .filter(Boolean)
        .join('\n');

    let composed = fieldLines ? `Estimate form submission:\n${fieldLines}` : 'Estimate form submission';
    const contact = normalizeContact(metadata.contact);
    const contactLines = [
        contact.address ? `Address: ${contact.address}` : null,
        contact.preferredDate ? `Preferred date: ${contact.preferredDate}` : null,
        contact.phone ? `Phone: ${contact.phone}` : null,
    ].filter(Boolean);
    if (contactLines.length > 0) {
        composed += `\n\nContact details:\n${contactLines.join('\n')}`;
    }

    const result = toRecord(metadata.quoteResult);
    if (result.totalCents !== undefined && result.currency) {
        composed += `\n\nQuote summary:\n${readString(metadata.quoteDisplayText, 'Request quote')}`;
    }

    const notes = fallbackMessage.trim()
        || (typeof contact.message === 'string' ? contact.message.trim() : '');
    if (notes) {
        composed += `\n\nAdditional notes:\n${notes}`;
    }
    return composed;
}

function normalizeContact(value: unknown): Record<string, string> {
    const contact = toRecord(value);
    return {
        name: readString(contact.name, ''),
        email: readString(contact.email, ''),
        phone: readString(contact.phone, ''),
        company: readString(contact.company, ''),
        address: readString(contact.address, ''),
        preferredDate: readString(contact.preferredDate, ''),
        message: readString(contact.message, ''),
    };
}

function shrinkMetadata(metadata: MetadataRecord): MetadataRecord {
    if (JSON.stringify(metadata).length <= MAX_METADATA_LENGTH) return metadata;
    const next = { ...metadata };
    delete next.estimateQuoteSettings;
    return next;
}

function appendWarning(value: unknown, warning: string): string[] {
    const current = Array.isArray(value) ? value.map(String) : [];
    return Array.from(new Set([...current, warning]));
}

function uniqueEmails(values: string[]): string[] {
    const seen = new Set<string>();
    const emails: string[] = [];
    for (const value of values) {
        const email = String(value || '').trim();
        if (!email || seen.has(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
        seen.add(email);
        emails.push(email);
    }
    return emails;
}

function toRecord(value: unknown): MetadataRecord {
    return isRecord(value) ? { ...value } : {};
}

function isRecord(value: unknown): value is MetadataRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}
