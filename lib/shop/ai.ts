/**
 * AI helpers for the Shop tab:
 *   - readSupplierInvoice: photo/PDF of a parts invoice → supplier, number, lines, suggested job
 *   - parseVoiceNote: a mechanic's spoken note → clean diagnosis + draft estimate lines
 *   - transcribeAudio: server-side speech-to-text fallback when the browser can't transcribe
 *
 * Same direct-fetch pattern as lib/leads/image-extract.ts (no SDK, AI_BUILDER_API_KEY),
 * with JSON-schema structured output so replies always parse.
 */

import { extractJSON } from '@/lib/ai/ai-client';
import type { LineKind, PartCondition } from './types';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.SHOP_AI_MODEL || 'claude-opus-5';
const AI_TIMEOUT_MS = 110_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class ShopAiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'ShopAiError';
    this.status = status;
  }
}

export function aiConfigured(): boolean {
  return !!process.env.AI_BUILDER_API_KEY;
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };

async function callClaude(system: string, content: ContentBlock[], schema: Record<string, unknown>): Promise<unknown> {
  const apiKey = process.env.AI_BUILDER_API_KEY;
  if (!apiKey) throw new ShopAiError('AI reading isn’t set up on this server (AI_BUILDER_API_KEY).', 503);

  // Refusal fallbacks and effort are only sent to models that accept them.
  const useFallbacks = /^claude-(opus-5|fable-5)/.test(MODEL);
  const useEffort = /^claude-(opus-(4-[5-9]|5)|sonnet-(4-6|5)|fable-5)/.test(MODEL);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (useFallbacks) headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        ...(useFallbacks ? { fallbacks: 'default' } : {}),
        system,
        output_config: {
          ...(useEffort ? { effort: 'medium' } : {}),
          format: { type: 'json_schema', schema },
        },
        messages: [{ role: 'user', content }],
      }),
    });
  } catch (err) {
    throw new ShopAiError(err instanceof Error && err.name === 'TimeoutError' ? 'The AI took too long. Try again.' : 'Couldn’t reach the AI service.', 504);
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`[shop/ai] Anthropic ${res.status}:`, body.slice(0, 500));
    throw new ShopAiError(res.status === 429 || res.status === 529 ? 'The AI service is busy. Try again in a minute.' : 'The AI service returned an error.', 502);
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new ShopAiError('The AI declined to read this. Enter it by hand.', 422);
  const text = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    return extractJSON(text);
  }
}

async function shrinkImage(buffer: Buffer, mime: string): Promise<{ buffer: Buffer; mime: string }> {
  if (buffer.length <= MAX_IMAGE_BYTES && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
    return { buffer, mime };
  }
  try {
    const sharp = (await import('sharp')).default;
    const out = await sharp(buffer).rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    return { buffer: out, mime: 'image/jpeg' };
  } catch {
    throw new ShopAiError('This photo is too large or in a format the AI can’t read. Enter the lines by hand.', 422);
  }
}

// ── Supplier invoices ──────────────────────────────────────────────────────

export interface ReadInvoiceLine {
  description: string;
  part_number: string;
  qty: number;
  unit_cost_cents: number;
  line_total_cents: number;
  is_core: boolean;
}

export interface ReadInvoiceResult {
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  handwritten_note: string;
  lines: ReadInvoiceLine[];
  suggested_job_ro: number;
  suggestion_reason: string;
}

const INVOICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['supplier_name', 'invoice_number', 'invoice_date', 'subtotal_cents', 'tax_cents', 'total_cents', 'handwritten_note', 'lines', 'suggested_job_ro', 'suggestion_reason'],
  properties: {
    supplier_name: { type: 'string', description: 'The wholesaler that issued the invoice, as printed. Empty if unreadable.' },
    invoice_number: { type: 'string', description: 'Invoice number as printed. Empty if unreadable.' },
    invoice_date: { type: 'string', description: 'Invoice date as YYYY-MM-DD. Empty if unreadable.' },
    subtotal_cents: { type: 'integer', description: 'Pre-tax total in cents. 0 if unreadable.' },
    tax_cents: { type: 'integer', description: 'GST/HST in cents. 0 if unreadable.' },
    total_cents: { type: 'integer', description: 'Invoice total in cents. 0 if unreadable.' },
    handwritten_note: { type: 'string', description: 'Any handwritten or PO/reference text naming a customer, car or job (e.g. "SANTOS CRV"). Empty if none.' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'part_number', 'qty', 'unit_cost_cents', 'line_total_cents', 'is_core'],
        properties: {
          description: { type: 'string' },
          part_number: { type: 'string', description: 'Empty if none.' },
          qty: { type: 'number' },
          unit_cost_cents: { type: 'integer', description: 'The shop’s cost per unit in cents.' },
          line_total_cents: { type: 'integer' },
          is_core: { type: 'boolean', description: 'True for a refundable core charge or core deposit line.' },
        },
      },
    },
    suggested_job_ro: { type: 'integer', description: 'RO number of the open job these parts are most likely for, or 0 if none fits (e.g. shop stock).' },
    suggestion_reason: { type: 'string', description: 'One short sentence explaining the suggestion, for the service desk.' },
  },
};

export interface OpenJobContext {
  ro_number: number;
  customer: string;
  vehicle: string;
  parts: string[];
}

export async function readSupplierInvoice(input: {
  buffer: Buffer;
  mime: string;
  suppliers: string[];
  openJobs: OpenJobContext[];
}): Promise<ReadInvoiceResult> {
  let block: ContentBlock;
  if (input.mime === 'application/pdf') {
    if (input.buffer.length > 30 * 1024 * 1024) throw new ShopAiError('This PDF is too large for the AI to read.', 413);
    block = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.buffer.toString('base64') } };
  } else {
    const img = await shrinkImage(input.buffer, input.mime);
    block = { type: 'image', source: { type: 'base64', media_type: img.mime, data: img.buffer.toString('base64') } };
  }
  const system = `You read auto-parts supplier invoices for an independent repair shop in Canada and return structured data.

Read every line item exactly as printed: description, part number, quantity, unit cost and line total, all in cents. Core charges and core deposits are separate lines with is_core true. Use 0 or an empty string for anything you can’t read; never guess a number.

Then decide which open job the parts are for. Use handwritten or reference text (customer names, vehicle models, RO numbers) first, then part descriptions that match a job’s estimate. Suggest 0 when nothing fits, such as shop supplies or restocking.`;
  const context = [
    input.suppliers.length ? `Known suppliers: ${input.suppliers.join('; ')}` : 'No suppliers saved yet.',
    'Open jobs:',
    ...(input.openJobs.length
      ? input.openJobs.map(j => `- RO ${j.ro_number}: ${j.customer}, ${j.vehicle}. Parts on the estimate: ${j.parts.length ? j.parts.join('; ') : 'none yet'}`)
      : ['- none']),
  ].join('\n');
  const result = (await callClaude(system, [block, { type: 'text', text: `${context}\n\nRead this invoice.` }], INVOICE_SCHEMA)) as ReadInvoiceResult;
  return {
    supplier_name: String(result.supplier_name || '').trim(),
    invoice_number: String(result.invoice_number || '').trim(),
    invoice_date: /^\d{4}-\d{2}-\d{2}$/.test(result.invoice_date || '') ? result.invoice_date : '',
    subtotal_cents: Math.max(0, Math.round(Number(result.subtotal_cents) || 0)),
    tax_cents: Math.max(0, Math.round(Number(result.tax_cents) || 0)),
    total_cents: Math.max(0, Math.round(Number(result.total_cents) || 0)),
    handwritten_note: String(result.handwritten_note || '').trim(),
    lines: (Array.isArray(result.lines) ? result.lines : []).slice(0, 80).map(l => ({
      description: String(l.description || '').trim() || 'Part',
      part_number: String(l.part_number || '').trim(),
      qty: Number(l.qty) > 0 ? Number(l.qty) : 1,
      unit_cost_cents: Math.round(Number(l.unit_cost_cents) || 0),
      line_total_cents: Math.round(Number(l.line_total_cents) || 0),
      is_core: !!l.is_core,
    })),
    suggested_job_ro: Math.max(0, Math.round(Number(result.suggested_job_ro) || 0)),
    suggestion_reason: String(result.suggestion_reason || '').trim(),
  };
}

// ── Voice notes ────────────────────────────────────────────────────────────

export interface DraftLine {
  kind: LineKind;
  description: string;
  hours: number | null;
  qty: number;
  part_number: string | null;
  condition: PartCondition | null;
  no_warranty: boolean;
  is_added_work: boolean;
}

export interface VoiceNoteResult {
  summary: string;
  diagnosis: string;
  extra_work_found: boolean;
  lines: DraftLine[];
}

const VOICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'diagnosis', 'extra_work_found', 'lines'],
  properties: {
    summary: { type: 'string', description: 'One short sentence for the job timeline.' },
    diagnosis: { type: 'string', description: 'The mechanic’s findings as clear written notes for the job file. Empty if the note has no findings.' },
    extra_work_found: { type: 'boolean', description: 'True if the mechanic did or recommends work beyond the approved lines.' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'description', 'hours', 'qty', 'part_number', 'condition', 'no_warranty', 'is_added_work'],
        properties: {
          kind: { type: 'string', enum: ['labour', 'part', 'supply', 'sublet'] },
          description: { type: 'string' },
          hours: { type: 'number', description: 'Labour hours the mechanic said (0.4 for "point four"). 0 if not stated or not labour.' },
          qty: { type: 'number' },
          part_number: { type: 'string', description: 'Empty unless the mechanic said one.' },
          condition: { type: 'string', enum: ['new_non_oem', 'new_oem', 'reconditioned', 'used', 'unknown'] },
          no_warranty: { type: 'boolean', description: 'True for fluids, filters, lights, tires and batteries.' },
          is_added_work: { type: 'boolean', description: 'True for work that is not on the approved estimate.' },
        },
      },
    },
  },
};

export async function parseVoiceNote(input: {
  transcript: string;
  mode: 'diagnosis' | 'done' | 'note';
  vehicle: string;
  complaint: string;
  approvedLines: string[];
  draftLines: string[];
}): Promise<VoiceNoteResult> {
  const system = `You turn a mechanic’s spoken notes into written notes and draft estimate lines for the service desk of an independent auto repair shop in Ontario.

Write the diagnosis the way a service advisor would file it: plain, specific, no filler. For lines, add one labour line per distinct job and one part line per distinct part, with quantities. Never invent prices, part numbers or hours the mechanic didn’t say. Mark fluids, filters, lights, tires and batteries as no_warranty.

Mode "diagnosis": the car hasn’t been approved yet; draft every line of the recommended repair.
Mode "done": the repair is finished; add lines only for work beyond the approved lines, with is_added_work true, and set extra_work_found accordingly. Return no lines if nothing extra was done.
Mode "note": a general update; return lines only if the mechanic clearly recommends new work.`;
  const text = [
    `Mode: ${input.mode}`,
    `Vehicle: ${input.vehicle}`,
    `Customer’s complaint: ${input.complaint}`,
    `Approved lines: ${input.approvedLines.length ? input.approvedLines.join('; ') : 'none'}`,
    `Lines already drafted: ${input.draftLines.length ? input.draftLines.join('; ') : 'none'}`,
    '',
    `The mechanic said: “${input.transcript.trim()}”`,
  ].join('\n');
  const result = (await callClaude(system, [{ type: 'text', text }], VOICE_SCHEMA)) as {
    summary: string; diagnosis: string; extra_work_found: boolean;
    lines: { kind: LineKind; description: string; hours: number; qty: number; part_number: string; condition: string; no_warranty: boolean; is_added_work: boolean }[];
  };
  return {
    summary: String(result.summary || '').trim(),
    diagnosis: String(result.diagnosis || '').trim(),
    extra_work_found: !!result.extra_work_found,
    lines: (Array.isArray(result.lines) ? result.lines : []).slice(0, 30).map(l => ({
      kind: (['labour', 'part', 'supply', 'sublet'].includes(l.kind) ? l.kind : 'labour') as LineKind,
      description: String(l.description || '').trim() || 'Work',
      hours: l.kind === 'labour' && Number(l.hours) > 0 ? Math.round(Number(l.hours) * 10) / 10 : null,
      qty: Number(l.qty) > 0 ? Number(l.qty) : 1,
      part_number: String(l.part_number || '').trim() || null,
      condition: (['new_non_oem', 'new_oem', 'reconditioned', 'used'].includes(l.condition) ? l.condition : null) as PartCondition | null,
      no_warranty: !!l.no_warranty,
      is_added_work: input.mode === 'done' ? true : !!l.is_added_work,
    })),
  };
}

// ── Speech to text (fallback) ──────────────────────────────────────────────

export function transcriptionConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function transcribeAudio(buffer: Buffer, mime: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ShopAiError('This browser can’t turn speech into text, and no transcription service is set up. Type the note instead.', 503);
  const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('mpeg') ? 'mp3' : mime.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), `note.${ext}`);
  form.append('model', process.env.SHOP_TRANSCRIBE_MODEL || 'whisper-1');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) {
    console.error('[shop/ai] transcription failed', res.status, (await res.text()).slice(0, 300));
    throw new ShopAiError('Couldn’t transcribe the recording. Type the note instead.', 502);
  }
  const data = await res.json();
  return String(data.text || '').trim();
}
