import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import Anthropic from '@anthropic-ai/sdk';
import { sendContactReplyEmail } from '@/lib/email';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Only callable internally (from /api/contact POST) or by ops admins
function assertInternal(request: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false; // secret must be set
  return request.headers.get('x-internal-secret') === secret;
}

/**
 * POST /api/contact/[id]/triage
 *
 * Runs AI triage on a stored contact submission:
 *  1. Classifies the message and scores confidence
 *  2. Generates a draft reply using the site's business context
 *  3. Auto-sends the reply if confidence >= AUTO_SEND_THRESHOLD and not spam
 *
 * Called fire-and-forget from /api/contact after inserting the submission.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!assertInternal(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();

  // Load the submission
  const { data: submission, error: fetchErr } = await db
    .from('contact_submissions')
    .select('*, sites(siteSlug, design_data, published_data, user_id)')
    .eq('id', id)
    .single();

  if (fetchErr || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  // Don't re-triage
  if (submission.status !== 'new') {
    return NextResponse.json({ skipped: true });
  }

  const site = (submission as any).sites;

  // Build business context from the site's published/design data
  const designData = site?.design_data ?? site?.published_data ?? {};
  const businessName = designData?.businessName || designData?.siteTitle || site?.siteSlug || 'Our Business';
  const businessDescription = designData?.tagline || designData?.description || designData?.aboutText || '';
  const services: string[] = designData?.services?.map((s: any) => s?.name || s?.title).filter(Boolean) ?? [];
  const faq: string[] = designData?.faq?.map((f: any) => `Q: ${f?.question} A: ${f?.answer}`).filter(Boolean) ?? [];

  const businessContext = [
    `Business name: ${businessName}`,
    businessDescription ? `Description: ${businessDescription}` : '',
    services.length ? `Services: ${services.join(', ')}` : '',
    faq.length ? `FAQ:\n${faq.join('\n')}` : '',
  ].filter(Boolean).join('\n');

  const systemPrompt = `You are a helpful assistant managing contact form messages for a small business.
Business context:
${businessContext}

Your job:
1. Classify the message into one of: booking_inquiry, general_question, complaint, spam, other
2. Assign a confidence score (0.0–1.0) for how well you can answer it without human help
3. Write a concise, friendly, professional reply if applicable (skip if spam)
4. Write a one-sentence summary for the business owner's inbox

Rules:
- If it's spam (marketing pitch, unrelated solicitation, gibberish), set classification=spam and confidence=0
- If it's a booking inquiry and you can provide helpful info about services/availability, confidence can be 0.7–0.9
- If it needs specific info you don't have (custom quotes, personal details), confidence should be ≤ 0.5
- Replies should be warm, concise (2–4 sentences max), and signed as ${businessName}
- Never make up prices, dates, or availability specifics you don't have
- Reply in the same language the customer used

Respond with valid JSON only, no markdown fences:
{
  "classification": "booking_inquiry|general_question|complaint|spam|other",
  "confidence": 0.0,
  "summary": "one sentence summary",
  "draft_reply": "reply text or null if spam"
}`;

  let classification = 'other';
  let confidence = 0;
  let summary = '';
  let draftReply: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Contact form message from ${submission.sender_name} <${submission.sender_email}>:\n\n${submission.message}`,
        },
      ],
      system: systemPrompt,
    });

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(raw);
    classification = parsed.classification ?? 'other';
    confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
    summary = parsed.summary ?? '';
    draftReply = parsed.draft_reply ?? null;
  } catch (err) {
    console.error('[triage] AI call failed:', err);
    // Store partial result so the ticket still appears in the inbox
    await db.from('contact_submissions').update({
      ai_classification: 'other',
      ai_confidence: 0,
      ai_summary: 'AI triage failed — please review manually.',
      status: 'needs_review',
    }).eq('id', id);
    return NextResponse.json({ error: 'AI triage failed' }, { status: 500 });
  }

  const AUTO_SEND_THRESHOLD = 0.85;
  const isSpam = classification === 'spam';
  const shouldAutoSend = !isSpam && confidence >= AUTO_SEND_THRESHOLD && draftReply;

  let autoSent = false;
  let replyResendId: string | null = null;

  if (shouldAutoSend && draftReply) {
    // Get the owner's "from" address (default to contact@keystoneweb.ca for now)
    const fromAddress = 'contact@keystoneweb.ca';
    const result = await sendContactReplyEmail({
      toEmail: submission.sender_email,
      toName: submission.sender_name,
      fromAddress,
      fromName: businessName,
      replyText: draftReply,
      originalMessage: submission.message,
      submissionId: id,
    });
    if (result.success) {
      autoSent = true;
      replyResendId = (result as any).messageId ?? null;
    }
  }

  const newStatus: string = isSpam
    ? 'spam'
    : autoSent
    ? 'ai_handled'
    : confidence >= 0.5
    ? 'needs_review'
    : 'needs_review';

  await db.from('contact_submissions').update({
    ai_classification: classification,
    ai_confidence: confidence,
    ai_summary: summary,
    ai_draft_reply: draftReply,
    ai_auto_sent: autoSent,
    reply_resend_id: replyResendId,
    status: newStatus,
  }).eq('id', id);

  return NextResponse.json({ classification, confidence, autoSent, status: newStatus });
}
