/**
 * Text content moderation using the OpenAI Moderation API (free).
 * https://platform.openai.com/docs/guides/moderation
 *
 * Scans blog posts, product descriptions, events, and other text content
 * for CSAM solicitation, illegal content, and other harmful material.
 *
 * Env vars: OPENAI_API_KEY
 *
 * If unconfigured, returns clean (fail-open) unless MODERATION_STRICT=true.
 */

export type TextModerationResult = {
  flagged: boolean;
  categories: string[];
  rawResponse?: unknown;
};

// Categories we treat as actionable (subset of OpenAI's full category list)
const ACTIONABLE_CATEGORIES = [
  'sexual/minors',
  'sexual',
  'violence',
  'hate',
  'self-harm',
  'harassment',
];

export async function scanText(text: string): Promise<TextModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (process.env.MODERATION_STRICT === 'true') {
      throw new Error('OpenAI API key not configured (MODERATION_STRICT=true)');
    }
    console.warn('[moderation] OpenAI API key not configured — skipping text scan');
    return { flagged: false, categories: [] };
  }

  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[moderation] OpenAI Moderation API error:', response.status, errorText);
    if (process.env.MODERATION_STRICT === 'true') {
      throw new Error(`OpenAI Moderation API returned ${response.status}`);
    }
    return { flagged: false, categories: [] };
  }

  const data = await response.json() as {
    results: Array<{
      flagged: boolean;
      categories: Record<string, boolean>;
      category_scores: Record<string, number>;
    }>;
  };

  const result = data.results?.[0];
  if (!result) return { flagged: false, categories: [] };

  const flaggedCategories = ACTIONABLE_CATEGORIES.filter(
    (cat) => result.categories[cat] === true
  );

  return {
    flagged: flaggedCategories.length > 0,
    categories: flaggedCategories,
    rawResponse: result,
  };
}
