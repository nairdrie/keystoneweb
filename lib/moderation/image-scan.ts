/**
 * Image content moderation — two-layer detection:
 *
 * Layer 1: Project Arachnid Shield (C3P)
 *   Hash-matches against the NCMEC/Cybertip.ca database of known CSAEM.
 *   Free API, register at https://www.projectarachnid.ca/en/
 *   Env vars: ARACHNID_SHIELD_USERNAME, ARACHNID_SHIELD_PASSWORD
 *
 * Layer 2: Google Cloud Vision SafeSearch
 *   AI classifier for adult/violent content beyond known hashes.
 *   Catches novel/AI-generated CSAEM where no hash exists yet.
 *   Env var: GOOGLE_SERVICE_ACCOUNT_JSON (paste the full service account JSON as a string)
 *
 * If either API is unconfigured, that layer is skipped (fail-open with a warning).
 * Set MODERATION_STRICT=true to fail-closed if APIs are unavailable.
 */

import { SignJWT, importPKCS8 } from 'jose';

export type ImageModerationResult = {
  blocked: boolean;
  severity: 'csaem' | 'adult' | 'review' | 'clean';
  method: 'arachnid_hash' | 'vision_classifier' | 'clean';
  reportable: boolean; // true = CSAEM match, must report to Cybertip.ca
  rawResponse?: unknown;
};

// Likelihood levels returned by Google Vision SafeSearch
const LIKELIHOOD_RANK: Record<string, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

// ─── Layer 1: Project Arachnid Shield ────────────────────────────────────────

async function checkArachnidShield(buffer: Buffer): Promise<ImageModerationResult | null> {
  const username = process.env.ARACHNID_SHIELD_USERNAME;
  const password = process.env.ARACHNID_SHIELD_PASSWORD;

  if (!username || !password) {
    if (process.env.MODERATION_STRICT === 'true') {
      throw new Error('Arachnid Shield credentials not configured (MODERATION_STRICT=true)');
    }
    console.warn('[moderation] Arachnid Shield not configured — skipping hash check');
    return null;
  }

  const credentials = Buffer.from(`${username}:${password}`).toString('base64');

  // The Shield API accepts image bytes as a multipart upload
  const formData = new FormData();
  formData.append('media', new Blob([new Uint8Array(buffer)]), 'upload');

  const response = await fetch('https://shield.projectarachnid.ca/v1/media/scan', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[moderation] Arachnid Shield error:', response.status, text);
    if (process.env.MODERATION_STRICT === 'true') {
      throw new Error(`Arachnid Shield returned ${response.status}`);
    }
    return null;
  }

  const data = await response.json() as {
    is_match: boolean;
    hash?: string;
  };

  if (data.is_match) {
    return {
      blocked: true,
      severity: 'csaem',
      method: 'arachnid_hash',
      reportable: true,
      rawResponse: data,
    };
  }

  return null; // clean per hash check — proceed to layer 2
}

// ─── Google Service Account OAuth2 token (cached per cold start) ─────────────

let _cachedToken: { token: string; expiresAt: number } | null = null;

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  // Reuse token if valid for at least another 60 seconds
  if (_cachedToken && _cachedToken.expiresAt - 60_000 > Date.now()) {
    return _cachedToken.token;
  }

  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
    token_uri: string;
  };

  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(sa.private_key, 'RS256');

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/cloud-vision',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(sa.client_email)
    .setAudience(sa.token_uri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const tokenRes = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${text}`);
  }

  const { access_token, expires_in } = await tokenRes.json() as {
    access_token: string;
    expires_in: number;
  };

  _cachedToken = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

// ─── Layer 2: Google Cloud Vision SafeSearch ──────────────────────────────────

async function checkVisionSafeSearch(buffer: Buffer): Promise<ImageModerationResult | null> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    if (process.env.MODERATION_STRICT === 'true') {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured (MODERATION_STRICT=true)');
    }
    console.warn('[moderation] Google Vision not configured — skipping classifier check');
    return null;
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(serviceAccountJson);
  } catch (err) {
    console.error('[moderation] Failed to get Google access token:', err);
    if (process.env.MODERATION_STRICT === 'true') throw err;
    return null;
  }

  const base64Image = buffer.toString('base64');

  const response = await fetch(
    'https://vision.googleapis.com/v1/images:annotate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'SAFE_SEARCH_DETECTION' }],
        }],
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error('[moderation] Google Vision error:', response.status, text);
    if (process.env.MODERATION_STRICT === 'true') {
      throw new Error(`Google Vision returned ${response.status}`);
    }
    return null;
  }

  const data = await response.json() as {
    responses: Array<{
      safeSearchAnnotation?: {
        adult: string;
        racy: string;
        violence: string;
        medical: string;
      };
    }>;
  };

  const annotation = data.responses?.[0]?.safeSearchAnnotation;
  if (!annotation) return null;

  const adultRank = LIKELIHOOD_RANK[annotation.adult] ?? 0;
  const racyRank = LIKELIHOOD_RANK[annotation.racy] ?? 0;
  const maxRank = Math.max(adultRank, racyRank);

  if (maxRank >= LIKELIHOOD_RANK.VERY_LIKELY) {
    // High confidence — block immediately
    return {
      blocked: true,
      severity: 'adult',
      method: 'vision_classifier',
      reportable: false, // classifier alone doesn't confirm CSAEM; ops reviews these
      rawResponse: annotation,
    };
  }

  if (maxRank >= LIKELIHOOD_RANK.LIKELY) {
    // Moderate confidence — queue for ops review
    return {
      blocked: true,
      severity: 'review',
      method: 'vision_classifier',
      reportable: false,
      rawResponse: annotation,
    };
  }

  return null; // clean
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scanImage(buffer: Buffer): Promise<ImageModerationResult> {
  // Layer 1: hash check (fast, definitive for known CSAEM)
  const hashResult = await checkArachnidShield(buffer);
  if (hashResult) return hashResult;

  // Layer 2: AI classifier (catches novel/AI-generated content)
  const classifierResult = await checkVisionSafeSearch(buffer);
  if (classifierResult) return classifierResult;

  return {
    blocked: false,
    severity: 'clean',
    method: 'clean',
    reportable: false,
  };
}
