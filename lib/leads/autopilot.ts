// Lead autopilot — automated follow-up engine for the ops lead pipeline.
//
// Operators enroll a lead (usually right after generating a preview site).
// On each cron tick we:
//   1. HOOK CHECK — if the lead replied (email_received / inbound contact
//      events) or an operator logged interest since our last touch, flip the
//      enrollment to 'hooked' and email the ops admins: a human takes over.
//   2. DECIDE — for due enrollments, give Claude the lead record, the preview
//      site link, and the full touch history, and let it decide the next
//      action: send_email | send_sms | wait | flag_human | stop.
//   3. ACT — send the email via Resend (logged to ops_sent_emails +
//      lead_contact_events so the lead timeline stays in sync), or SMS via
//      Twilio when TWILIO_* env vars are configured, then schedule the next
//      tick respecting min_hours_between_touches and max_touches.
//
// Guardrails: bounded touches, business-hours sends (cron schedule), explicit
// identification as Keystone Web in every message, immediate stop on any
// opt-out language, and hard stop when the lead hits do_not_contact/lost.

import { createAdminClient } from '@/lib/db/supabase-admin';
import { resend } from '@/lib/email/resend';
import { buildSignatureHtml, buildSignatureText, nameFromEmail } from '@/lib/email/signature';
import { getOpsAdminEmailList } from '@/lib/ops/access';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const AUTOPILOT_MODEL = process.env.LEADS_AUTOPILOT_MODEL || 'claude-sonnet-4-6';
const AUTOPILOT_FROM_EMAIL = process.env.LEADS_AUTOPILOT_FROM_EMAIL || 'sales@keystoneweb.ca';
const APP_BASE_URL = 'https://keystoneweb.ca';

export interface AutopilotTickResult {
  processed: number;
  emailsSent: number;
  smsSent: number;
  hooked: number;
  stopped: number;
  waited: number;
  errors: number;
}

interface AutopilotRow {
  id: string;
  lead_id: string;
  status: string;
  channels: { email?: boolean; sms?: boolean } | null;
  max_touches: number;
  min_hours_between_touches: number;
  touches_sent: number;
  next_action_at: string | null;
  last_action_at: string | null;
  enrolled_by_user_id: string | null;
  created_at: string;
}

interface LeadRow {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  industry: string | null;
  business_type: string | null;
  status: string;
  assignee_user_id: string | null;
  notes: string | null;
}

// The rep the outreach is sent as: their @keystoneweb.ca handle and display
// name (same identity the ops Email tab uses), plus their user id so the
// send is logged to their inbox.
interface AutopilotSender {
  fromEmail: string;
  senderName: string;
  userId: string | null;
}

interface Decision {
  action: 'send_email' | 'send_sms' | 'wait' | 'flag_human' | 'stop';
  reason: string;
  subject?: string;
  body?: string;
  sms_body?: string;
  wait_hours?: number;
}

export async function runAutopilotTick(db: SupabaseAdmin, options: { limit?: number } = {}): Promise<AutopilotTickResult> {
  const limit = options.limit ?? 10;
  const result: AutopilotTickResult = { processed: 0, emailsSent: 0, smsSent: 0, hooked: 0, stopped: 0, waited: 0, errors: 0 };

  // ── 1. Hook check across ALL active enrollments ────────────────────────────
  const { data: activeRows } = await db
    .from('lead_autopilot')
    .select('*')
    .eq('status', 'active');

  for (const enrollment of (activeRows ?? []) as AutopilotRow[]) {
    try {
      const hookReason = await detectHook(db, enrollment);
      if (hookReason) {
        await markHooked(db, enrollment, hookReason);
        result.hooked++;
      }
    } catch (err) {
      console.error('[autopilot] hook check failed', enrollment.lead_id, err);
    }
  }

  // ── 2. Process due enrollments ─────────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const { data: dueRows } = await db
    .from('lead_autopilot')
    .select('*')
    .eq('status', 'active')
    .lte('next_action_at', nowIso)
    .order('next_action_at', { ascending: true })
    .limit(limit);

  for (const enrollment of (dueRows ?? []) as AutopilotRow[]) {
    result.processed++;
    try {
      await processEnrollment(db, enrollment, result);
    } catch (err) {
      result.errors++;
      console.error('[autopilot] enrollment failed', enrollment.lead_id, err);
      await logEvent(db, enrollment, 'error', errorMessage(err));
      // Back off a day so a persistent failure doesn't spin every tick.
      await db.from('lead_autopilot')
        .update({ next_action_at: hoursFromNow(24) })
        .eq('id', enrollment.id);
    }
  }

  return result;
}

async function processEnrollment(db: SupabaseAdmin, enrollment: AutopilotRow, result: AutopilotTickResult) {
  const { data: lead } = await db
    .from('leads')
    .select('id, business_name, contact_name, email, phone, city, industry, business_type, status, assignee_user_id, notes')
    .eq('id', enrollment.lead_id)
    .single();

  if (!lead) {
    await stopEnrollment(db, enrollment, 'Lead no longer exists.');
    result.stopped++;
    return;
  }

  // Hard stops independent of the model.
  if (['do_not_contact', 'lost', 'converted'].includes(lead.status)) {
    await stopEnrollment(db, enrollment, `Lead status is ${lead.status}.`);
    result.stopped++;
    return;
  }
  if (enrollment.touches_sent >= enrollment.max_touches) {
    await stopEnrollment(db, enrollment, `Reached the ${enrollment.max_touches}-touch limit without a reply.`);
    result.stopped++;
    return;
  }

  const channels = enrollment.channels ?? { email: true, sms: false };
  const canEmail = channels.email !== false && Boolean(lead.email);
  const canSms = channels.sms === true && Boolean(lead.phone) && twilioConfigured();

  if (!canEmail && !canSms) {
    await stopEnrollment(db, enrollment, 'No usable outreach channel (missing email/phone or channel disabled).');
    result.stopped++;
    return;
  }

  const sender = await resolveSender(db, enrollment, lead);
  const context = await buildDecisionContext(db, enrollment, lead, { canEmail, canSms, sender });
  const decision = await decideNextAction(context);

  await db.from('lead_autopilot').update({ last_decision: { action: decision.action, reason: decision.reason } }).eq('id', enrollment.id);
  await logEvent(db, enrollment, 'decision', `${decision.action}: ${decision.reason}`, decision as unknown as Record<string, unknown>);

  switch (decision.action) {
    case 'send_email': {
      if (!canEmail || !decision.subject || !decision.body) {
        await scheduleNext(db, enrollment, 24, false);
        result.waited++;
        return;
      }
      await sendAutopilotEmail(db, enrollment, lead, sender, decision.subject, decision.body);
      await scheduleNext(db, enrollment, Math.max(decision.wait_hours ?? enrollment.min_hours_between_touches, enrollment.min_hours_between_touches), true);
      result.emailsSent++;
      return;
    }
    case 'send_sms': {
      if (!canSms || !decision.sms_body) {
        await scheduleNext(db, enrollment, 24, false);
        result.waited++;
        return;
      }
      await sendAutopilotSms(db, enrollment, lead, decision.sms_body);
      await scheduleNext(db, enrollment, Math.max(decision.wait_hours ?? enrollment.min_hours_between_touches, enrollment.min_hours_between_touches), true);
      result.smsSent++;
      return;
    }
    case 'flag_human': {
      await markHooked(db, enrollment, decision.reason || 'Claude flagged this lead for human follow-up.');
      result.hooked++;
      return;
    }
    case 'stop': {
      await stopEnrollment(db, enrollment, decision.reason || 'Claude decided to stop outreach.');
      result.stopped++;
      return;
    }
    case 'wait':
    default: {
      const hours = Math.min(Math.max(decision.wait_hours ?? 48, 4), 24 * 14);
      await db.from('lead_autopilot').update({ next_action_at: hoursFromNow(hours) }).eq('id', enrollment.id);
      await logEvent(db, enrollment, 'wait', `Waiting ${hours}h: ${decision.reason}`);
      result.waited++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook detection — a reply or operator-logged interest means a human takes over
// ─────────────────────────────────────────────────────────────────────────────

async function detectHook(db: SupabaseAdmin, enrollment: AutopilotRow): Promise<string | null> {
  const since = enrollment.last_action_at ?? enrollment.created_at;
  const { data: events } = await db
    .from('lead_contact_events')
    .select('kind, outcome, notes, occurred_at')
    .eq('lead_id', enrollment.lead_id)
    .gt('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(20);

  for (const event of events ?? []) {
    if (event.kind === 'email_received') {
      return 'The lead replied by email.';
    }
    if (['interested', 'meeting_booked', 'callback_scheduled'].includes(event.outcome ?? '')) {
      return `An interaction was logged with outcome "${event.outcome}".`;
    }
  }
  return null;
}

async function markHooked(db: SupabaseAdmin, enrollment: AutopilotRow, reason: string) {
  await db.from('lead_autopilot')
    .update({ status: 'hooked', hook_reason: reason })
    .eq('id', enrollment.id);
  await logEvent(db, enrollment, 'hooked', reason);
  await notifyAdminsOfHook(db, enrollment, reason);
}

async function notifyAdminsOfHook(db: SupabaseAdmin, enrollment: AutopilotRow, reason: string) {
  try {
    const [{ data: lead }, admins] = await Promise.all([
      db.from('leads').select('business_name, contact_name, email, phone').eq('id', enrollment.lead_id).single(),
      getOpsAdminEmailList(),
    ]);
    if (!admins || admins.length === 0) return;

    const name = lead?.business_name || lead?.contact_name || 'A lead';
    const leadUrl = `${APP_BASE_URL}/ops/leads/${enrollment.lead_id}`;
    await resend.emails.send({
      from: `Keystone Autopilot <${AUTOPILOT_FROM_EMAIL}>`,
      to: admins,
      subject: `🐟 Fish on the hook: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937;">
          <p><strong>${escapeHtml(name)}</strong> needs a human.</p>
          <p>${escapeHtml(reason)}</p>
          <p>
            ${lead?.email ? `Email: ${escapeHtml(lead.email)}<br/>` : ''}
            ${lead?.phone ? `Phone: ${escapeHtml(lead.phone)}<br/>` : ''}
          </p>
          <p><a href="${leadUrl}">Open the lead in ops</a> — autopilot has paused on this lead until you act.</p>
        </div>
      `,
      text: `${name} needs a human. ${reason}\n\n${leadUrl}`,
    });
  } catch (err) {
    console.error('[autopilot] hook notification failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sender resolution — outreach goes out as a real rep, not a generic inbox
// ─────────────────────────────────────────────────────────────────────────────

// Prefer the lead's assignee, then whoever enrolled the lead. A rep qualifies
// when they have an agent_contact_email (their @keystoneweb.ca handle — the
// same identity the ops Email tab sends from). Falls back to the configured
// autopilot address when no rep handle is available.
async function resolveSender(db: SupabaseAdmin, enrollment: AutopilotRow, lead: LeadRow): Promise<AutopilotSender> {
  const candidateIds = [lead.assignee_user_id, enrollment.enrolled_by_user_id]
    .filter((id): id is string => Boolean(id));

  if (candidateIds.length > 0) {
    const { data: users } = await db
      .from('users')
      .select('id, email, agent_contact_email')
      .in('id', candidateIds);

    for (const candidateId of candidateIds) {
      const user = (users ?? []).find((u) => u.id === candidateId);
      const contactEmail = user?.agent_contact_email?.toLowerCase().trim();
      if (user && contactEmail) {
        return {
          fromEmail: contactEmail,
          senderName: nameFromEmail(user.email ?? contactEmail),
          userId: user.id,
        };
      }
    }
  }

  return {
    fromEmail: AUTOPILOT_FROM_EMAIL,
    senderName: nameFromEmail(AUTOPILOT_FROM_EMAIL),
    userId: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision call
// ─────────────────────────────────────────────────────────────────────────────

interface DecisionContext {
  lead: LeadRow;
  enrollment: AutopilotRow;
  canEmail: boolean;
  canSms: boolean;
  sender: AutopilotSender;
  previewUrl: string | null;
  history: string;
  daysSinceEnrollment: number;
}

async function buildDecisionContext(
  db: SupabaseAdmin,
  enrollment: AutopilotRow,
  lead: LeadRow,
  channels: { canEmail: boolean; canSms: boolean; sender: AutopilotSender },
): Promise<DecisionContext> {
  const { data: generation } = await db
    .from('lead_site_generations')
    .select('site_id, status')
    .eq('lead_id', lead.id)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previewUrl = generation?.site_id ? `${APP_BASE_URL}/preview?siteId=${generation.site_id}` : null;

  const [{ data: contactEvents }, { data: autopilotEvents }] = await Promise.all([
    db.from('lead_contact_events')
      .select('kind, outcome, notes, occurred_at')
      .eq('lead_id', lead.id)
      .order('occurred_at', { ascending: false })
      .limit(15),
    db.from('lead_autopilot_events')
      .select('kind, summary, detail, created_at')
      .eq('autopilot_id', enrollment.id)
      .in('kind', ['email_sent', 'sms_sent'])
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const historyLines: string[] = [];
  for (const event of contactEvents ?? []) {
    historyLines.push(`- [${event.occurred_at}] ${event.kind}${event.outcome ? ` (${event.outcome})` : ''}${event.notes ? `: ${String(event.notes).slice(0, 200)}` : ''}`);
  }
  for (const event of autopilotEvents ?? []) {
    const detail = event.detail as { subject?: string; body?: string; sms_body?: string } | null;
    historyLines.push(`- [${event.created_at}] autopilot ${event.kind}${detail?.subject ? `: "${detail.subject}"` : ''}${detail?.body ? ` — ${String(detail.body).slice(0, 300)}` : ''}${detail?.sms_body ? ` — ${String(detail.sms_body).slice(0, 200)}` : ''}`);
  }
  historyLines.sort().reverse();

  return {
    lead,
    enrollment,
    canEmail: channels.canEmail,
    canSms: channels.canSms,
    sender: channels.sender,
    previewUrl,
    history: historyLines.join('\n') || '(no prior outreach logged)',
    daysSinceEnrollment: Math.floor((Date.now() - new Date(enrollment.created_at).getTime()) / 86_400_000),
  };
}

function decisionSystemPrompt(context: DecisionContext): string {
  return `You are the outreach autopilot for Keystone Web, a Toronto-area website agency/platform. We build a free preview website for a local business, then reach out to show it to them. Your goal is to get the lead to LOOK AT THEIR PREVIEW SITE and REPLY (or book a call) — not to close a sale by email.

THE LEAD:
- Business: ${context.lead.business_name ?? '(unknown)'}
- Contact: ${context.lead.contact_name ?? '(unknown)'}
- Industry: ${context.lead.industry ?? context.lead.business_type ?? '(unknown)'}
- City: ${context.lead.city ?? '(unknown)'}
- Email: ${context.lead.email ?? '(none)'}
- Phone: ${context.lead.phone ?? '(none)'}
- Pipeline status: ${context.lead.status}
- Operator notes: ${context.lead.notes?.slice(0, 400) ?? '(none)'}
- Preview site we built for them: ${context.previewUrl ?? '(none yet — do not claim one exists)'}

OUTREACH STATE:
- Touches sent so far: ${context.enrollment.touches_sent} of a hard max ${context.enrollment.max_touches}
- Days since enrollment: ${context.daysSinceEnrollment}
- Channels available right now: ${[context.canEmail ? 'email' : null, context.canSms ? 'sms' : null].filter(Boolean).join(', ') || 'none'}

FULL TOUCH HISTORY (newest first):
${context.history}

YOUR IDENTITY:
- You write as ${context.sender.senderName} (${context.sender.fromEmail}), a real rep at Keystone Web. The email is sent from their address.
- Write in first person ("I built…", "I noticed…"), in a voice a real person named ${context.sender.senderName} would use.
- Do NOT add a sign-off, name, or signature at the end of the body — ${context.sender.senderName}'s signature block is appended automatically.

RULES:
- Always identify as Keystone Web. Never pretend to be a customer or use deceptive subject lines.
- Reference their actual business specifics. Short, human, zero corporate filler. Emails: 60-120 words, one clear ask. SMS: under 300 characters.
- Include the preview link in the first email when one exists.
- Each touch must add something new (a different angle, a specific feature of their preview, a soft deadline). Never re-send the same pitch.
- Every email body must end with: "If you'd rather not hear from us, just reply 'no thanks' and we won't contact you again." SMS must end with "Reply STOP to opt out."
- If the history shows ANY reply, interest, annoyance, or opt-out: do NOT send. Choose flag_human (interest/reply) or stop (annoyance/opt-out).
- If history shows a recent touch (under ${context.enrollment.min_hours_between_touches}h ago), choose wait.
- Prefer email; use SMS only if email is unavailable or 2+ emails have gone unanswered and SMS is available.
- If nothing useful remains to say, stop.

Respond with ONLY a JSON object (no markdown fences):
{
  "action": "send_email" | "send_sms" | "wait" | "flag_human" | "stop",
  "reason": "<one sentence for the ops dashboard>",
  "subject": "<email subject — required for send_email>",
  "body": "<plain-text email body — required for send_email>",
  "sms_body": "<sms text — required for send_sms>",
  "wait_hours": <number — required for wait, optional otherwise>
}`;
}

async function decideNextAction(context: DecisionContext): Promise<Decision> {
  const apiKey = process.env.AI_BUILDER_API_KEY;
  if (!apiKey) {
    return { action: 'wait', reason: 'AI_BUILDER_API_KEY not configured.', wait_hours: 24 };
  }

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AUTOPILOT_MODEL,
      max_tokens: 1500,
      system: decisionSystemPrompt(context),
      messages: [{ role: 'user', content: 'Decide the next action now and return the JSON object.' }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Autopilot decision API error ${response.status}`);
  }

  const data = await response.json();
  const raw: string = data.content?.[0]?.text?.trim() ?? '';
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Autopilot decision was not valid JSON');
  }

  const action = typeof parsed.action === 'string' ? parsed.action : 'wait';
  const validActions = new Set(['send_email', 'send_sms', 'wait', 'flag_human', 'stop']);
  return {
    action: (validActions.has(action) ? action : 'wait') as Decision['action'],
    reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 500) : '',
    subject: typeof parsed.subject === 'string' ? parsed.subject.slice(0, 200) : undefined,
    body: typeof parsed.body === 'string' ? parsed.body.slice(0, 4000) : undefined,
    sms_body: typeof parsed.sms_body === 'string' ? parsed.sms_body.slice(0, 320) : undefined,
    wait_hours: typeof parsed.wait_hours === 'number' && Number.isFinite(parsed.wait_hours) ? parsed.wait_hours : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel sends
// ─────────────────────────────────────────────────────────────────────────────

async function sendAutopilotEmail(db: SupabaseAdmin, enrollment: AutopilotRow, lead: LeadRow, sender: AutopilotSender, subject: string, body: string) {
  if (!lead.email) throw new Error('Lead has no email');

  // Same format as the manual ops Email tab: rep identity, body, and the
  // standard Keystone signature block.
  const { data, error } = await resend.emails.send({
    from: `${sender.senderName} <${sender.fromEmail}>`,
    to: [lead.email],
    subject,
    replyTo: sender.fromEmail,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937;">
        <div style="margin: 0 0 24px 0;">${escapeHtml(body).replace(/\n/g, '<br/>')}</div>
        ${buildSignatureHtml({ senderName: sender.senderName, fromEmail: sender.fromEmail })}
      </div>
    `,
    text: `${body}\n\n${buildSignatureText({ senderName: sender.senderName, fromEmail: sender.fromEmail })}`,
  });
  if (error) throw new Error(`Resend: ${error.message}`);

  // Mirror the manual ops email flow so replies and timelines stay in sync,
  // attributed to the rep so the thread shows up in their ops inbox.
  const { data: sentRow } = await db
    .from('ops_sent_emails')
    .insert({
      sent_by_user_id: sender.userId,
      from_email: sender.fromEmail,
      to_email: lead.email.toLowerCase(),
      subject,
      resend_id: data?.id ?? null,
    })
    .select('id')
    .single();

  await db.from('lead_contact_events').insert({
    lead_id: lead.id,
    kind: 'email_sent',
    occurred_at: new Date().toISOString(),
    notes: `[autopilot] ${subject}`,
    created_by_user_id: sender.userId,
    ops_sent_email_id: sentRow?.id ?? null,
  });

  await logEvent(db, enrollment, 'email_sent', subject, { subject, body, from: sender.fromEmail });
}

function twilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

async function sendAutopilotSms(db: SupabaseAdmin, enrollment: AutopilotRow, lead: LeadRow, body: string) {
  if (!lead.phone) throw new Error('Lead has no phone');
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: lead.phone, From: from, Body: body }).toString(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Twilio ${response.status}: ${detail.slice(0, 200)}`);
  }

  await db.from('lead_contact_events').insert({
    lead_id: lead.id,
    kind: 'sms',
    occurred_at: new Date().toISOString(),
    notes: `[autopilot] ${body.slice(0, 300)}`,
  });

  await logEvent(db, enrollment, 'sms_sent', body.slice(0, 120), { sms_body: body });
}

// ─────────────────────────────────────────────────────────────────────────────
// State helpers
// ─────────────────────────────────────────────────────────────────────────────

async function scheduleNext(db: SupabaseAdmin, enrollment: AutopilotRow, hours: number, countTouch: boolean) {
  await db.from('lead_autopilot')
    .update({
      next_action_at: hoursFromNow(hours),
      ...(countTouch ? { touches_sent: enrollment.touches_sent + 1, last_action_at: new Date().toISOString() } : {}),
    })
    .eq('id', enrollment.id);
}

async function stopEnrollment(db: SupabaseAdmin, enrollment: AutopilotRow, reason: string) {
  await db.from('lead_autopilot')
    .update({ status: 'stopped', stop_reason: reason })
    .eq('id', enrollment.id);
  await logEvent(db, enrollment, 'stopped', reason);
}

async function logEvent(db: SupabaseAdmin, enrollment: AutopilotRow, kind: string, summary: string, detail?: Record<string, unknown>) {
  await db.from('lead_autopilot_events').insert({
    autopilot_id: enrollment.id,
    lead_id: enrollment.lead_id,
    kind,
    summary: summary.slice(0, 500),
    detail: detail ?? null,
  });
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
