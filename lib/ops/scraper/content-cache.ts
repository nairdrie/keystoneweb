import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_ROOT = path.join(process.cwd(), '.next', 'cache', 'ops-scraper-content');

function hashKey(parts: Array<string | number | boolean | null | undefined>) {
  return createHash('sha256')
    .update(parts.map((part) => String(part ?? '')).join('::'))
    .digest('hex');
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJsonFile<T>(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

export interface CacheEnvelope<T> {
  createdAt: string;
  key: string;
  value: T;
}

export async function readCache<T>(bucket: string, parts: Array<string | number | boolean | null | undefined>) {
  const key = hashKey(parts);
  const filePath = path.join(CACHE_ROOT, bucket, `${key}.json`);
  const cached = await readJsonFile<CacheEnvelope<T>>(filePath);
  return cached?.value ?? null;
}

export async function writeCache<T>(bucket: string, parts: Array<string | number | boolean | null | undefined>, value: T) {
  const key = hashKey(parts);
  const filePath = path.join(CACHE_ROOT, bucket, `${key}.json`);
  await writeJsonFile(filePath, {
    createdAt: new Date().toISOString(),
    key,
    value,
  } satisfies CacheEnvelope<T>);
}

export function makeContentHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
