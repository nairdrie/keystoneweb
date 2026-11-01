/**
 * Minimal in-memory stand-in for the parts of supabase-js the v2 engine uses
 * (from().select/insert/upsert/update/delete with eq/neq/in/is/ilike/gt,
 * order, limit, single, maybeSingle, count/head, storage). Test-only.
 */
import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

const PRIMARY_KEYS: Record<string, string[]> = {
  v2_themes: ['site_id'],
  v2_page_layouts: ['page_id'],
  v2_content: ['site_id', 'instance_id', 'field', 'locale'],
  user_subscriptions: ['user_id'],
};

const DEFAULTS: Record<string, () => Row> = {
  sites: () => ({ engine: 'blocks_v1', is_published: false, design_data: {}, deleted_at: null, v2_release_id: null, published_domain: null, custom_domain: null }),
  pages: () => ({ is_visible_in_nav: true, nav_order: 0, design_data: {} }),
  v2_themes: () => ({ tokens: [], owner_overrides: {}, fonts: [], global_css: '', global_js: '', header_section: null, footer_section: null, version: 1 }),
  v2_sections: () => ({ css: '', js: '', schema: {}, version: 1 }),
  v2_page_layouts: () => ({ instances: [], version: 1 }),
  v2_content: () => ({ locale: 'default', owner_edited: false, rev: 1 }),
  products: () => ({ is_archived: false, is_active: true, status: 'draft', sort_order: 0, currency: 'CAD', images: [] }),
  booking_services: () => ({ is_archived: false, is_active: true, status: 'draft', sort_order: 0, currency: 'CAD' }),
  api_tokens: () => ({ scopes: ['sites:read', 'sites:write'], revoked_at: null, expires_at: null, last_used_at: null }),
};

const UNIQUE: Record<string, string[][]> = {
  v2_sections: [['site_id', 'key']],
  api_tokens: [['token_hash']],
};

export class FakeSupabase {
  tables: Record<string, Row[]> = {};
  storageObjects: Record<string, Buffer> = {};

  table(name: string): Row[] {
    return (this.tables[name] ||= []);
  }

  from(name: string) {
    return new Query(this, name);
  }

  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, buf: Buffer) => {
        this.storageObjects[`${bucket}/${path}`] = buf;
        return { data: { path }, error: null };
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${bucket}/${path}` } }),
      list: async () => ({ data: [], error: null }),
    }),
  };
}

class Query implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null; count?: number | null }> {
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private filters: Filter[] = [];
  private payload: Row[] = [];
  private patch: Row = {};
  private returning = false;
  private orderBy: { col: string; asc: boolean } | null = null;
  private max: number | null = null;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private countMode = false;
  private head = false;
  private conflict: string[] | null = null;
  private ignoreDuplicates = false;

  constructor(private db: FakeSupabase, private name: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.countMode = !!opts?.count;
      this.head = !!opts?.head;
    } else {
      this.returning = true;
    }
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflict = opts?.onConflict ? opts.onConflict.split(',').map((c) => c.trim()) : null;
    this.ignoreDuplicates = !!opts?.ignoreDuplicates;
    return this;
  }
  update(patch: Row) {
    this.op = 'update';
    this.patch = patch;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col: string, value: unknown) { this.filters.push((r) => r[col] === value); return this; }
  neq(col: string, value: unknown) { this.filters.push((r) => r[col] !== value); return this; }
  in(col: string, values: unknown[]) { this.filters.push((r) => values.includes(r[col])); return this; }
  is(col: string, value: unknown) { this.filters.push((r) => (r[col] ?? null) === value); return this; }
  gt(col: string, value: unknown) { this.filters.push((r) => String(r[col] ?? '') > String(value)); return this; }
  ilike(col: string, pattern: string) {
    const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i');
    this.filters.push((r) => re.test(String(r[col] ?? '')));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  then<A, B>(onfulfilled?: ((v: { data: unknown; error: { message: string } | null; count?: number | null }) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }

  private matches(row: Row) {
    return this.filters.every((f) => f(row));
  }

  private keyOf(row: Row, cols: string[]) {
    return cols.map((c) => JSON.stringify(row[c] ?? null)).join('|');
  }

  private finish(rows: Row[], count?: number) {
    let out = rows.map((r) => structuredClone(r));
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out.sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : String(a[col] ?? '') > String(b[col] ?? '') ? 1 : 0) * (asc ? 1 : -1));
    }
    if (this.max !== null) out = out.slice(0, this.max);
    if (this.mode === 'single') {
      if (out.length !== 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
      return { data: out[0], error: null };
    }
    if (this.mode === 'maybe') return { data: out[0] ?? null, error: null };
    return { data: this.head ? null : out, error: null, count: this.countMode ? count ?? out.length : null };
  }

  private checkUnique(table: Row[], row: Row, except?: Row) {
    for (const cols of UNIQUE[this.name] || []) {
      if (table.some((r) => r !== except && this.keyOf(r, cols) === this.keyOf(row, cols))) {
        return { message: `duplicate key value violates unique constraint (${cols.join(',')})`, code: '23505' };
      }
    }
    return null;
  }

  private execute() {
    const table = this.db.table(this.name);
    const now = new Date().toISOString();
    switch (this.op) {
      case 'select': {
        const rows = table.filter((r) => this.matches(r));
        return this.finish(rows, rows.length);
      }
      case 'insert': {
        const inserted: Row[] = [];
        for (const raw of this.payload) {
          const row: Row = { ...(DEFAULTS[this.name]?.() || {}), created_at: now, updated_at: now, ...raw };
          if (!PRIMARY_KEYS[this.name] && row.id === undefined) row.id = randomUUID();
          const pk = PRIMARY_KEYS[this.name] || ['id'];
          if (table.some((r) => this.keyOf(r, pk) === this.keyOf(row, pk))) return { data: null, error: { message: 'duplicate key value violates primary key', code: '23505' } };
          const uniqueErr = this.checkUnique(table, row);
          if (uniqueErr) return { data: null, error: uniqueErr };
          table.push(row);
          inserted.push(row);
        }
        return this.returning ? this.finish(inserted) : { data: null, error: null };
      }
      case 'upsert': {
        const cols = this.conflict || PRIMARY_KEYS[this.name] || ['id'];
        const touched: Row[] = [];
        for (const raw of this.payload) {
          const existing = table.find((r) => this.keyOf(r, cols) === this.keyOf(raw, cols));
          if (existing) {
            if (this.ignoreDuplicates) continue;
            Object.assign(existing, raw, { updated_at: (raw.updated_at as string) || now });
            touched.push(existing);
          } else {
            const row: Row = { ...(DEFAULTS[this.name]?.() || {}), created_at: now, updated_at: now, ...raw };
            if (!PRIMARY_KEYS[this.name] && row.id === undefined) row.id = randomUUID();
            table.push(row);
            touched.push(row);
          }
        }
        return this.returning ? this.finish(touched) : { data: null, error: null };
      }
      case 'update': {
        const rows = table.filter((r) => this.matches(r));
        for (const r of rows) Object.assign(r, this.patch);
        return this.returning ? this.finish(rows) : { data: null, error: null };
      }
      case 'delete': {
        const keep = table.filter((r) => !this.matches(r));
        this.db.tables[this.name] = keep;
        return { data: null, error: null };
      }
    }
  }
}
