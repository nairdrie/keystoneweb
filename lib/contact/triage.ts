import { sendContactReplyEmail } from '@/lib/email';
import { SupabaseClient } from '@supabase/supabase-js';

const AUTO_SEND_THRESHOLD = 0.85;

// ---------------------------------------------------------------------------
// Pre-screening: detect obvious spam/gibberish without calling the AI.
// Returns true if the message should be marked spam immediately.
// ---------------------------------------------------------------------------

const SPAM_KEYWORDS = [
  // SEO/marketing solicitation
  'seo', 'search engine', 'google ranking', 'backlink', 'link building',
  'digital marketing agency', 'web traffic', 'social media followers',
  // Financial scams
  'crypto', 'bitcoin', 'investment opportunity', 'wire transfer', 'western union',
  'make money', 'earn $', 'earn money', 'passive income',
  // Generic spam phrases
  'click here', 'limited time offer', 'act now', 'free trial',
  'buy now', 'order now', 'best price', 'lowest price',
  'unsub', 'unsubscribe',
];

/**
 * Measure character-level entropy as a rough gibberish detector.
 * Real language text has higher entropy (more varied characters) than
 * repeated or random keyboard-mash strings.
 */
function charEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const c of str) freq[c] = (freq[c] ?? 0) + 1;
  const len = str.length;
  return Object.values(freq).reduce((sum, f) => {
    const p = f / len;
    return sum - p * Math.log2(p);
  }, 0);
}

function isObviousSpam(message: string, name: string): boolean {
  const lower = message.toLowerCase();

  // Very short messages that are just gibberish characters (< 15 chars with low entropy)
  if (message.trim().length < 15) return true;

  // Gibberish detection: low character entropy relative to length
  // Normal English text ~3.5–4.5 bits; keyboard mash is < 2.5
  const entropy = charEntropy(message.toLowerCase().replace(/\s/g, ''));
  if (message.length > 10 && entropy < 2.5) return true;

  // Very high ratio of repeated characters (aaaaaaa, fjfjfjfj, etc.)
  const uniqueChars = new Set(message.toLowerCase().replace(/\s/g, '')).size;
  const totalChars = message.replace(/\s/g, '').length;
  if (totalChars > 10 && uniqueChars / totalChars < 0.15) return true;

  // Spam keyword check (whole-word match for short keywords to reduce false positives)
  for (const kw of SPAM_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }

  // Excessive URLs
  const urlCount = (message.match(/https?:\/\//g) ?? []).length;
  if (urlCount >= 3) return true;

  // Excessive ALL CAPS (>70% of alpha chars)
  const alpha = message.replace(/[^a-zA-Z]/g, '');
  if (alpha.length > 10) {
    const upperRatio = (alpha.match(/[A-Z]/g) ?? []).length / alpha.length;
    if (upperRatio > 0.7) return true;
  }

  return false;
}

/**
 * Run AI triage on a stored contact_submission.
 * Classifies the message, generates a draft reply, and auto-sends if confident.
 * Safe to call fire-and-forget — all errors are caught internally.
 */
export async function triageContactSubmission(
  submissionId: string,
  db: SupabaseClient
): Promise<void> {
  // Load submission (no join — avoids PostgREST schema-cache failures)
  const { data: submission, error: fetchErr } = await db
    .from('contact_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (fetchErr || !submission) {
    console.error('[triage] Submission not found:', submissionId, fetchErr);
    return;
  }

  if (submission.status !== 'new') return; // already processed

  // Pre-screen: skip AI entirely for obvious spam/gibberish
  if (isObviousSpam(submission.message, submission.sender_name)) {
    await db
      .from('contact_submissions')
      .update({
        ai_classification: 'spam',
        ai_confidence: 0,
        ai_summary: 'Pre-screened as spam (gibberish or known spam pattern).',
        ai_draft_reply: null,
        ai_auto_sent: false,
        status: 'spam',
      })
      .eq('id', submissionId);
    return;
  }

  // Load site context separately
  const { data: site } = await db
    .from('sites')
    .select('site_slug, design_data, published_data, user_id, contact_ai_replies_enabled, published_domain')
    .eq('id', submission.site_id)
    .single();

  const designData = site?.design_data ?? site?.published_data ?? {};
  const businessName =
    designData?.businessName || designData?.siteTitle || site?.site_slug || 'Our Business';
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

  const systemPrompt = `You are a helpful assistant managing contact form messages for a small business.
Business context:
${businessContext}

Your job:
1. Classify the message into one of: booking_inquiry, general_question, complaint, spam, other
2. Assign a confidence score (0.0–1.0) for how well you can answer it without human help
3. Write a concise, friendly, professional reply if applicable (skip if spam)
4. Write a one-sentence summary for the business owner's inbox

Rules:
- If it's spam (marketing pitch, unrelated solicitation, gibberish, random characters, nonsense, no real question or request), set classification=spam and confidence=0
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
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            // Truncate to 1500 chars max to cap token usage; real messages are shorter
            content: `Contact form message from ${submission.sender_name} <${submission.sender_email}>:\n\n${submission.message.slice(0, 1500)}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const raw: string = data.content?.[0]?.text?.trim() ?? '';
    // Strip markdown code fences the model sometimes adds despite instructions
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(json);
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
  // Respect the per-site AI auto-reply toggle (default true if column not yet migrated)
  const aiRepliesEnabled = site?.contact_ai_replies_enabled !== false;
  const shouldAutoSend = !isSpam && aiRepliesEnabled && confidence >= AUTO_SEND_THRESHOLD && draftReply;

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
      replyToAddress: site?.published_domain ? `${site.published_domain}@kswd.ca` : undefined,
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
