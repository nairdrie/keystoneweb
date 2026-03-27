import Anthropic from '@anthropic-ai/sdk';
import { sendContactReplyEmail } from '@/lib/email';
import { SupabaseClient } from '@supabase/supabase-js';

const AUTO_SEND_THRESHOLD = 0.85;

/**
 * Run AI triage on a stored contact_submission.
 * Classifies the message, generates a draft reply, and auto-sends if confident.
 * Safe to call fire-and-forget — all errors are caught internally.
 */
export async function triageContactSubmission(
  submissionId: string,
  db: SupabaseClient
): Promise<void> {
  // Load submission + site context
  const { data: submission, error: fetchErr } = await db
    .from('contact_submissions')
    .select('*, sites(siteSlug, design_data, published_data, user_id)')
    .eq('id', submissionId)
    .single();

  if (fetchErr || !submission) {
    console.error('[triage] Submission not found:', submissionId, fetchErr);
    return;
  }

  if (submission.status !== 'new') return; // already processed

  const site = (submission as any).sites;
  const designData = site?.design_data ?? site?.published_data ?? {};
  const businessName =
    designData?.businessName || designData?.siteTitle || site?.siteSlug || 'Our Business';
  const businessDescription =
    designData?.tagline || designData?.description || designData?.aboutText || '';
  const services: string[] =
    designData?.services?.map((s: any) => s?.name || s?.title).filter(Boolean) ?? [];
  const faq: string[] =
    designData?.faq?.map((f: any) => `Q: ${f?.question} A: ${f?.answer}`).filter(Boolean) ?? [];

  const businessContext = [
    `Business name: ${businessName}`,
    businessDescription ? `Description: ${businessDescription}` : '',
    services.length ? `Services: ${services.join(', ')}` : '',
    faq.length ? `FAQ:\n${faq.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const apiKey = process.env.AI_BUILDER_API_KEY;
  if (!apiKey) {
    console.error('[triage] AI_BUILDER_API_KEY is not set');
    await db
      .from('contact_submissions')
      .update({ status: 'needs_review', ai_summary: 'AI triage skipped — API key not configured.' })
      .eq('id', submissionId);
    return;
  }

  const anthropic = new Anthropic({ apiKey });

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
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Contact form message from ${submission.sender_name} <${submission.sender_email}>:\n\n${submission.message}`,
        },
      ],
    });

    const raw =
      response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(raw);
    classification = parsed.classification ?? 'other';
    confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
    summary = parsed.summary ?? '';
    draftReply = parsed.draft_reply ?? null;
  } catch (err) {
    console.error('[triage] AI call failed:', err);
    await db
      .from('contact_submissions')
      .update({
        ai_classification: 'other',
        ai_confidence: 0,
        ai_summary: 'AI triage failed — please review manually.',
        status: 'needs_review',
      })
      .eq('id', submissionId);
    return;
  }

  const isSpam = classification === 'spam';
  const shouldAutoSend = !isSpam && confidence >= AUTO_SEND_THRESHOLD && draftReply;

  let autoSent = false;
  let replyResendId: string | null = null;

  if (shouldAutoSend && draftReply) {
    const result = await sendContactReplyEmail({
      toEmail: submission.sender_email,
      toName: submission.sender_name,
      fromAddress: 'contact@keystoneweb.ca',
      fromName: businessName,
      replyText: draftReply,
      originalMessage: submission.message,
      submissionId,
    });
    if (result.success) {
      autoSent = true;
      replyResendId = (result as any).messageId ?? null;
    }
  }

  const newStatus = isSpam ? 'spam' : autoSent ? 'ai_handled' : 'needs_review';

  await db
    .from('contact_submissions')
    .update({
      ai_classification: classification,
      ai_confidence: confidence,
      ai_summary: summary,
      ai_draft_reply: draftReply,
      ai_auto_sent: autoSent,
      reply_resend_id: replyResendId,
      status: newStatus,
    })
    .eq('id', submissionId);
}
