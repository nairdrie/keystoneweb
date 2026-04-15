import { buildSystemPrompt } from '@/lib/ai/builder-schema';
import { VALID_BUILDER_BLOCK_TYPE_SET } from '@/lib/ai/builder-blocks';

export interface AIBuilderMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIBuilderSiteState {
  title?: string;
  blocks?: Array<Record<string, unknown>>;
  palette?: string;
  headingFont?: string;
  bodyFont?: string;
  pages?: Array<Record<string, unknown>>;
}

export interface RunAIBuilderOptions {
  apiKey: string;
  provider: string;
  modelId: string;
  prompt: string;
  history?: AIBuilderMessage[];
  siteState?: AIBuilderSiteState | null;
  availablePalettes?: string[];
  isNewSite?: boolean;
  enableMultiPage?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface RunAIBuilderResult {
  operations: Array<Record<string, unknown>>;
  message: string;
  rawResponse: string;
}

const VALID_OPS = new Set([
  'addBlock',
  'updateBlock',
  'removeBlock',
  'reorderBlocks',
  'setSiteTitle',
  'setFont',
  'setCustomColors',
  'setTemplate',
  'replaceBlocks',
  'setHeaderConfig',
  'setPages',
]);

const VALID_TEMPLATES = new Set(['luxe', 'vivid', 'airy', 'edge', 'classic', 'organic', 'sleek', 'vibrant']);
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function slugify(value: unknown, fallback: string) {
  const normalized = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

function uniqueSlug(base: string, used: Set<string>) {
  let candidate = base || 'page';
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function sanitizeBlock(rawBlock: unknown, index: number) {
  const block = asRecord(rawBlock);
  const type = normalizeString(block.blockType || block.type);
  if (!VALID_BUILDER_BLOCK_TYPE_SET.has(type)) return null;
  const data = asRecord(block.data);

  return {
    id: normalizeString(block.id) || `block-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 11)}`,
    type,
    data: deepSanitizeStrings(data),
  };
}

function sanitizePageBlocks(blocks: unknown) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((block, index) => sanitizeBlock(block, index))
    .filter((block): block is { id: string; type: string; data: unknown } => Boolean(block));
}

function sanitizeSetPagesOperation(op: Record<string, unknown>) {
  if (!Array.isArray(op.pages)) return null;

  const usedSlugs = new Set<string>();
  const pages = op.pages.slice(0, 30).map((rawPage, index) => {
    const page = asRecord(rawPage);
    const slug = uniqueSlug(slugify(page.slug, index === 0 ? 'home' : `page-${index + 1}`), usedSlugs);
    const title = stripTags(normalizeString(page.title) || (slug === 'home' ? 'Home' : `Page ${index + 1}`)).slice(0, 160);
    const displayName = stripTags(normalizeString(page.displayName || page.display_name) || title).slice(0, 160);
    const blocks = sanitizePageBlocks(page.blocks);

    return {
      slug,
      title,
      displayName,
      isVisibleInNav: typeof page.isVisibleInNav === 'boolean'
        ? page.isVisibleInNav
        : typeof page.is_visible_in_nav === 'boolean'
          ? page.is_visible_in_nav
          : index < 8,
      navOrder: typeof page.navOrder === 'number'
        ? Math.max(0, Math.floor(page.navOrder))
        : typeof page.nav_order === 'number'
          ? Math.max(0, Math.floor(page.nav_order))
          : index,
      seoTitle: stripTags(normalizeString(page.seoTitle || page.seo_title)).slice(0, 200),
      seoDescription: stripTags(normalizeString(page.seoDescription || page.seo_description)).slice(0, 500),
      blocks,
    };
  }).filter((page) => page.blocks.length > 0 || page.slug === 'home');

  if (pages.length === 0) return null;
  if (!pages.some((page) => page.slug === 'home')) {
    pages[0].slug = 'home';
    pages[0].title = pages[0].title || 'Home';
    pages[0].displayName = pages[0].displayName || 'Home';
    pages[0].navOrder = 0;
  }

  const pageSlugSet = new Set(pages.map((page) => page.slug));
  const navigation = Array.isArray(op.navigation)
    ? op.navigation.slice(0, 20).map((rawItem, index) => {
      const item = asRecord(rawItem);
      const pageSlug = slugify(item.pageSlug || item.page_slug || item.slug, '');
      if (!pageSlugSet.has(pageSlug)) return null;
      return {
        label: stripTags(normalizeString(item.label) || pages.find((page) => page.slug === pageSlug)?.displayName || pageSlug).slice(0, 120),
        pageSlug,
        navOrder: typeof item.navOrder === 'number' ? Math.max(0, Math.floor(item.navOrder)) : index,
      };
    }).filter((item): item is { label: string; pageSlug: string; navOrder: number } => Boolean(item))
    : [];

  return { op: 'setPages', pages, navigation };
}

export function sanitizeOperations(operations: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(operations)) return [];

  const sanitized = operations
    .filter((op): op is Record<string, unknown> => op && typeof op === 'object' && VALID_OPS.has(normalizeString((op as Record<string, unknown>).op)))
    .map((op): Record<string, unknown> | null => {
      switch (op.op) {
        case 'setTemplate': {
          const templateId = normalizeString(op.templateId);
          if (!VALID_TEMPLATES.has(templateId)) return null;
          return { op: 'setTemplate', templateId };
        }
        case 'replaceBlocks': {
          const blocks = sanitizePageBlocks(op.blocks);
          return { op: 'replaceBlocks', blocks };
        }
        case 'addBlock': {
          const block = sanitizeBlock({ blockType: op.blockType, data: op.data }, 0);
          if (!block) return null;
          return {
            op: 'addBlock',
            blockType: block.type,
            data: block.data,
            ...(typeof op.index === 'number' ? { index: Math.max(0, Math.floor(op.index)) } : {}),
          };
        }
        case 'updateBlock': {
          if (typeof op.blockId !== 'string' || typeof op.updates !== 'object') return null;
          return { op: 'updateBlock', blockId: op.blockId, updates: deepSanitizeStrings(op.updates) };
        }
        case 'removeBlock': {
          if (typeof op.blockId !== 'string') return null;
          return { op: 'removeBlock', blockId: op.blockId };
        }
        case 'reorderBlocks': {
          if (!Array.isArray(op.blockIds) || !op.blockIds.every((id) => typeof id === 'string')) return null;
          return { op: 'reorderBlocks', blockIds: op.blockIds };
        }
        case 'setSiteTitle': {
          const title = stripTags(normalizeString(op.title)).slice(0, 200);
          if (!title) return null;
          return { op: 'setSiteTitle', title };
        }
        case 'setFont': {
          const target = normalizeString(op.target);
          const font = normalizeString(op.font).replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50);
          if (!['heading', 'body'].includes(target) || !font) return null;
          return { op: 'setFont', target, font };
        }
        case 'setCustomColors': {
          const colors: Record<string, string> = {};
          for (const key of ['primary', 'secondary', 'accent'] as const) {
            const value = normalizeString(op[key]);
            if (HEX_COLOR.test(value)) colors[key] = value;
          }
          if (Object.keys(colors).length === 0) return null;
          return { op: 'setCustomColors', ...colors };
        }
        case 'setHeaderConfig': {
          const config = sanitizeHeaderConfig(op.config);
          if (Object.keys(config).length === 0) return null;
          return { op: 'setHeaderConfig', config };
        }
        case 'setPages':
          return sanitizeSetPagesOperation(op);
        default:
          return null;
      }
    })
  return sanitized.filter((op): op is Record<string, unknown> => Boolean(op));
}

function sanitizeHeaderConfig(value: unknown) {
  const input = asRecord(value);
  const validBgTypes = new Set(['white', 'primary', 'secondary', 'gradient', 'custom']);
  const validLayouts = new Set(['default', 'centeredAboveNav']);
  const validRightElements = new Set(['cta', 'social', 'none']);
  const config: Record<string, unknown> = {};
  if (validBgTypes.has(normalizeString(input.bgType))) config.bgType = normalizeString(input.bgType);
  if (validLayouts.has(normalizeString(input.layout))) config.layout = normalizeString(input.layout);
  if (typeof input.sticky === 'boolean') config.sticky = input.sticky;
  if (validRightElements.has(normalizeString(input.rightElement))) config.rightElement = normalizeString(input.rightElement);
  if (typeof input.bannerEnabled === 'boolean') config.bannerEnabled = input.bannerEnabled;
  if (typeof input.bannerText === 'string') config.bannerText = stripTags(input.bannerText).slice(0, 200);
  return config;
}

function deepSanitizeStrings(obj: unknown): unknown {
  if (typeof obj === 'string') return stripTags(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitizeStrings);
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (/^on[A-Z]/.test(key)) continue;
      result[key] = deepSanitizeStrings(val);
    }
    return result;
  }
  return obj;
}

function stripTags(str: string): string {
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[\s>]/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

function extractJSON(raw: string): { operations?: unknown; message?: unknown } {
  const cleaned = raw.trim();

  try {
    const result = JSON.parse(cleaned);
    if (result && typeof result === 'object') return result;
  } catch {
    // continue
  }

  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      const result = JSON.parse(fenceMatch[1].trim());
      if (result && typeof result === 'object') return result;
    } catch {
      // continue
    }
  }

  const leadingFenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]+)/);
  if (leadingFenceMatch) {
    try {
      const result = JSON.parse(leadingFenceMatch[1].replace(/\n?```\s*$/, '').trim());
      if (result && typeof result === 'object') return result;
    } catch {
      // continue
    }
  }

  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < cleaned.length; i += 1) {
      const ch = cleaned[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            const result = JSON.parse(cleaned.slice(firstBrace, i + 1));
            if (result && typeof result === 'object') return result;
          } catch {
            // continue scanning
          }
        }
      }
    }
  }

  throw new Error('No valid JSON found in AI response');
}

function buildSiteContext(siteState?: AIBuilderSiteState | null) {
  if (!siteState) return '';

  return `
CURRENT SITE STATE:
- Site Title: "${siteState.title || 'Untitled'}"
- Current Blocks: ${JSON.stringify((siteState.blocks || []).map((b) => ({ id: b.id, type: b.type, data: b.data })), null, 2)}
- Current Pages: ${JSON.stringify((siteState.pages || []).map((p) => ({ slug: p.slug, title: p.title, blocks: p.blocks })), null, 2)}
- Current Palette: ${siteState.palette || 'default'}
- Heading Font: ${siteState.headingFont || 'default'}
- Body Font: ${siteState.bodyFont || 'default'}
`;
}

export async function runAIBuilder(options: RunAIBuilderOptions): Promise<RunAIBuilderResult> {
  const provider = options.provider || 'anthropic';
  const systemPrompt = buildSystemPrompt(options.availablePalettes || [], {
    enableMultiPage: Boolean(options.enableMultiPage),
  });
  const newSiteContext = options.isNewSite ? `
CONTEXT: This is a BRAND NEW site being built from scratch. The current blocks are placeholders and should be replaced with content tailored to the user's request.
` : '';
  const latestUserMessage = `${buildSiteContext(options.siteState)}${newSiteContext}
USER REQUEST: ${options.prompt}`;

  const rawResponse = provider === 'anthropic'
    ? await callAnthropic(options.apiKey, options.modelId, systemPrompt, options.history || [], latestUserMessage, options.maxTokens, options.temperature)
    : await callOpenAI(options.apiKey, options.modelId, systemPrompt, options.history || [], latestUserMessage, options.maxTokens, options.temperature);

  const parsed = extractJSON(rawResponse);
  const operations = sanitizeOperations(parsed.operations || []);
  let safeMessage = typeof parsed.message === 'string' ? parsed.message.slice(0, 1000) : 'Done.';
  if (safeMessage.trim().startsWith('{') || safeMessage.trim().startsWith('[') || safeMessage.includes('"op":')) {
    safeMessage = operations.length > 0
      ? `I've made ${operations.length} change${operations.length === 1 ? '' : 's'} to your site.`
      : 'Done.';
  }

  return { operations, message: safeMessage, rawResponse };
}

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  history: AIBuilderMessage[],
  latestUserMessage: string,
  maxTokens = 4096,
  temperature = 0.2
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [
        ...history,
        { role: 'user', content: latestUserMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`Anthropic API error ${res.status}:`, errBody);
    throw new Error('AI service unavailable.');
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAI(
  apiKey: string,
  model: string,
  system: string,
  history: AIBuilderMessage[],
  latestUserMessage: string,
  maxTokens = 4096,
  temperature = 0.2
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: system },
        ...history,
        { role: 'user', content: latestUserMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`OpenAI API error ${res.status}:`, errBody);
    throw new Error('AI service unavailable.');
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}
