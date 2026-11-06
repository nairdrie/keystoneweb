/**
 * Content-layer value handling, shared by the owner editor and agent tools.
 *
 * Paths address fields inside an instance: "title", "items.2.name",
 * "items.0.tags.1.label". The first segment is the stored (top-level) field;
 * list items are addressed by index.
 */
import type { FieldSchema } from './types';
import { safeHref, safeSrc, sanitizeInline, sanitizeRich, toPlainText } from './sanitize';

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentError';
  }
}

export function splitPath(path: string): { field: string; rest: string[] } {
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length) throw new ContentError('Empty field path');
  return { field: parts[0], rest: parts.slice(1) };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Coerce an incoming value (string shorthand or object) into the stored shape for a field type. */
export function normalizeFieldValue(field: FieldSchema, raw: unknown, current?: unknown): unknown {
  const keepHidden = isObj(current) && current.hidden && !(isObj(raw) && 'hidden' in raw) ? { hidden: true } : {};
  const hidden = isObj(raw) && typeof raw.hidden === 'boolean' ? { hidden: raw.hidden } : keepHidden;

  switch (field.type) {
    case 'text':
    case 'richtext': {
      const html = typeof raw === 'string' ? raw : isObj(raw) ? String(raw.html ?? (isObj(current) ? current.html ?? '' : '')) : '';
      let clean = field.type === 'text' ? sanitizeInline(html) : sanitizeRich(html);
      if (field.max && toPlainText(clean).length > field.max * 2) clean = toPlainText(clean).slice(0, field.max * 2);
      return { html: clean, ...hidden };
    }
    case 'image':
    case 'bg': {
      const base = isObj(current) ? current : {};
      const src = typeof raw === 'string' ? raw : isObj(raw) && 'src' in raw ? raw.src : base.src;
      const out: Obj = { src: safeSrc(src) };
      if (field.type === 'image') {
        const alt = isObj(raw) && 'alt' in raw ? raw.alt : base.alt;
        if (alt !== undefined) out.alt = toPlainText(String(alt ?? '')).slice(0, 300);
      }
      if (src && !out.src) throw new ContentError(`"${field.id}": image URL must be https:// or a site path`);
      return { ...out, ...hidden };
    }
    case 'link': {
      const base = isObj(current) ? current : {};
      const r: Obj = typeof raw === 'string' ? { href: raw } : isObj(raw) ? raw : {};
      const out: Obj = { href: safeHref(r.href ?? base.href ?? '#') };
      if (!field.hrefOnly) out.label = sanitizeInline(String(r.label ?? base.label ?? ''));
      const newTab = r.newTab ?? base.newTab;
      if (newTab) out.newTab = true;
      return { ...out, ...hidden };
    }
    case 'toggle': {
      if (typeof raw === 'boolean') return { hidden: !raw };
      if (isObj(raw)) return { hidden: !!raw.hidden };
      if (raw === 'hidden') return { hidden: true };
      return { hidden: false };
    }
    case 'list': {
      const items = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.items) ? raw.items : isObj(current) && Array.isArray(current.items) ? current.items : [];
      if (field.maxItems && items.length > field.maxItems) {
        throw new ContentError(`"${field.id}" allows at most ${field.maxItems} items`);
      }
      const itemFields = field.item || [];
      const normalized = items.map((item, i) => normalizeItem(itemFields, item, isObj(current) && Array.isArray(current.items) ? current.items[i] : undefined));
      return { items: normalized, ...hidden };
    }
  }
}

function normalizeItem(fields: FieldSchema[], raw: unknown, current: unknown): Obj {
  const src = isObj(raw) ? raw : {};
  const cur = isObj(current) ? current : {};
  const out: Obj = {};
  for (const f of fields) {
    if (f.id in src) out[f.id] = normalizeFieldValue(f, src[f.id], cur[f.id]);
    else if (f.id in cur) out[f.id] = cur[f.id];
  }
  return out;
}

/** Set the value at `rest` inside a top-level field value, returning the new top-level value. */
export function applyFieldChange(fields: FieldSchema[], current: unknown, fieldId: string, rest: string[], raw: unknown): unknown {
  const field = fields.find((f) => f.id === fieldId);
  if (!field) throw new ContentError(`Unknown field "${fieldId}"`);
  if (!rest.length) return normalizeFieldValue(field, raw, current);
  if (field.type !== 'list') throw new ContentError(`"${fieldId}" is not a list`);

  const list = isObj(current) && Array.isArray(current.items) ? current : { items: [] as unknown[] };
  const items = [...(list.items as unknown[])];
  const index = Number(rest[0]);
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    throw new ContentError(`"${fieldId}" has no item ${rest[0]}`);
  }
  if (rest.length === 1) {
    items[index] = normalizeItem(field.item || [], raw, items[index]);
    return { ...list, items };
  }
  const item = isObj(items[index]) ? { ...(items[index] as Obj) } : {};
  const subId = rest[1];
  item[subId] = applyFieldChange(field.item || [], item[subId], subId, rest.slice(2), raw);
  items[index] = item;
  return { ...list, items };
}

export type ListOp =
  | { op: 'add'; index?: number }
  | { op: 'duplicate'; index: number }
  | { op: 'remove'; index: number }
  | { op: 'move'; index: number; to: number };

/**
 * Apply a list operation at `rest` (path from the top-level field to the list,
 * e.g. [] for the field itself, ['2', 'tags'] for a nested list).
 * `templateItem` seeds new items (usually the first default item).
 */
export function applyListOp(
  fields: FieldSchema[],
  current: unknown,
  fieldId: string,
  rest: string[],
  operation: ListOp,
  templateItem: Obj | undefined,
): unknown {
  const field = fields.find((f) => f.id === fieldId);
  if (!field) throw new ContentError(`Unknown field "${fieldId}"`);
  if (field.type !== 'list') throw new ContentError(`"${fieldId}" is not a list`);

  const list = isObj(current) && Array.isArray(current.items) ? current : { items: [] as unknown[] };
  const items = [...(list.items as unknown[])];

  if (rest.length) {
    const index = Number(rest[0]);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) throw new ContentError(`"${fieldId}" has no item ${rest[0]}`);
    const item = isObj(items[index]) ? { ...(items[index] as Obj) } : {};
    const subId = rest[1];
    const subTemplate = templateItem && isObj(templateItem[subId]) ? firstItem(templateItem[subId]) : undefined;
    item[subId] = applyListOp(field.item || [], item[subId], subId, rest.slice(2), operation, subTemplate);
    items[index] = item;
    return { ...list, items };
  }

  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < items.length;
  switch (operation.op) {
    case 'add': {
      if (field.maxItems && items.length >= field.maxItems) throw new ContentError(`"${fieldId}" allows at most ${field.maxItems} items`);
      const at = operation.index === undefined ? items.length : Math.max(0, Math.min(items.length, operation.index));
      items.splice(at, 0, structuredClone(templateItem || {}));
      break;
    }
    case 'duplicate': {
      if (!inRange(operation.index)) throw new ContentError(`"${fieldId}" has no item ${operation.index}`);
      if (field.maxItems && items.length >= field.maxItems) throw new ContentError(`"${fieldId}" allows at most ${field.maxItems} items`);
      items.splice(operation.index + 1, 0, structuredClone(items[operation.index]));
      break;
    }
    case 'remove': {
      if (!inRange(operation.index)) throw new ContentError(`"${fieldId}" has no item ${operation.index}`);
      if (field.minItems && items.length <= field.minItems) throw new ContentError(`"${fieldId}" needs at least ${field.minItems} items`);
      items.splice(operation.index, 1);
      break;
    }
    case 'move': {
      if (!inRange(operation.index) || !inRange(operation.to)) throw new ContentError('Move index out of range');
      const [moved] = items.splice(operation.index, 1);
      items.splice(operation.to, 0, moved);
      break;
    }
  }
  return { ...list, items };
}

function firstItem(listValue: unknown): Obj | undefined {
  return isObj(listValue) && Array.isArray(listValue.items) && isObj(listValue.items[0]) ? (listValue.items[0] as Obj) : undefined;
}

/** First default item of the list at `rest` inside the defaults for a field. */
export function defaultListItem(defaults: Obj, fieldId: string, rest: string[]): Obj | undefined {
  let value: unknown = defaults[fieldId];
  for (let i = 0; i + 1 < rest.length; i += 2) {
    const item = firstItem(value);
    value = item ? item[rest[i + 1]] : undefined;
  }
  return firstItem(value);
}
