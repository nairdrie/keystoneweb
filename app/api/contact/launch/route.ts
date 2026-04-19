import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendSupportRequestNotification } from '@/lib/email';

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'support@keystoneweb.ca';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LOGO_STATUSES = ['have_it', 'need_help', 'in_progress'];
const DOMAIN_STATUSES = ['have_one', 'need_one', 'not_sure'];
const LAUNCH_TIMINGS = ['asap', 'two_weeks', 'one_month', 'flexible'];
const BUDGET_BANDS = ['under_500', '500_to_1000', 'over_1000', 'not_sure'];
const BUSINESS_TYPES = ['services', 'products', 'portfolio', 'nonprofit', 'other'];

function sanitizeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function sanitizeStringArray(value: unknown, maxItems = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function formatLabel(value: string | null): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = sanitizeString(body.name, 120);
    const email = sanitizeString(body.email, 200);
    const phone = sanitizeString(body.phone, 40);
    const businessName = sanitizeString(body.businessName, 200);

    if (!name || !email || !phone || !businessName) {
      return NextResponse.json(
        { error: 'Name, email, phone, and business name are required.' },
        { status: 400 },
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const rawBusinessType = sanitizeString(body.businessType, 40);
    const businessType =
      rawBusinessType && BUSINESS_TYPES.includes(rawBusinessType) ? rawBusinessType : null;
    const subCategory = sanitizeString(body.subCategory, 120);

    const pages = sanitizeStringArray(body.pages, 20);

    const rawLogoStatus = sanitizeString(body.logoStatus, 40);
    const logoStatus =
      rawLogoStatus && LOGO_STATUSES.includes(rawLogoStatus) ? rawLogoStatus : null;

    const rawDomainStatus = sanitizeString(body.domainStatus, 40);
    const domainStatus =
      rawDomainStatus && DOMAIN_STATUSES.includes(rawDomainStatus) ? rawDomainStatus : null;

    const rawLaunchTiming = sanitizeString(body.launchTiming, 40);
    const launchTiming =
      rawLaunchTiming && LAUNCH_TIMINGS.includes(rawLaunchTiming) ? rawLaunchTiming : null;

    const rawBudgetBand = sanitizeString(body.budgetBand, 40);
    const budgetBand =
      rawBudgetBand && BUDGET_BANDS.includes(rawBudgetBand) ? rawBudgetBand : null;

    const preferredDays = sanitizeStringArray(body.preferredDays, 7);
    const preferredTimes = sanitizeStringArray(body.preferredTimes, 4);
    const schedulingNotes = sanitizeString(body.schedulingNotes, 500);

    const description = sanitizeString(body.description, 2000);
    const referralSource = sanitizeString(body.referralSource, 200);

    const db = createAdminClient();
    const { data: inserted, error: insertError } = await db
      .from('launch_requests')
      .insert({
        name,
        email,
        phone,
        business_name: businessName,
        business_type: businessType,
        sub_category: subCategory,
        pages,
        logo_status: logoStatus,
        domain_status: domainStatus,
        launch_timing: launchTiming,
        budget_band: budgetBand,
        preferred_days: preferredDays,
        preferred_times: preferredTimes,
        scheduling_notes: schedulingNotes,
        description,
        referral_source: referralSource,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to insert launch_request:', insertError);
      return NextResponse.json({ error: 'Failed to save your request. Please try again.' }, { status: 500 });
    }

    const subject = `[Launch Service] ${businessName} — ${name}`;
    const previewLines = [
      `Business type: ${formatLabel(businessType)}${subCategory ? ` (${subCategory})` : ''}`,
      `Pages: ${pages.length ? pages.join(', ') : '—'}`,
      `Logo: ${formatLabel(logoStatus)} · Domain: ${formatLabel(domainStatus)}`,
      `Timing: ${formatLabel(launchTiming)} · Budget: ${formatLabel(budgetBand)}`,
      `Preferred days: ${preferredDays.length ? preferredDays.join(', ') : '—'}`,
      `Preferred times: ${preferredTimes.length ? preferredTimes.join(', ') : '—'}`,
      schedulingNotes ? `Scheduling notes: ${schedulingNotes}` : null,
      description ? `\nDescription:\n${description}` : null,
      referralSource ? `\nHeard about us via: ${referralSource}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    // Fire-and-forget style — if email fails we still return success since
    // the request is persisted and surfaced in /ops/launch.
    try {
      await sendSupportRequestNotification(
        {
          fromName: name,
          fromEmail: email,
          subject,
          bodyPreview: previewLines.slice(0, 2000),
        },
        [CONTACT_EMAIL],
      );
    } catch (emailError) {
      console.error('Failed to send launch request notification:', emailError);
    }

    return NextResponse.json({ success: true, id: inserted?.id });
  } catch (error) {
    console.error('Launch contact error:', error);
    return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 });
  }
}
