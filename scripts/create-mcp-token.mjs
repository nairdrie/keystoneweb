#!/usr/bin/env node
// Mint a personal MCP access token for a Keystone user.
//
//   node scripts/create-mcp-token.mjs <user-email> [token-name]
//
// The raw token is printed ONCE — store it now, it cannot be recovered. Only its
// SHA-256 hash is saved to public.mcp_tokens. Use the printed token to connect
// an MCP client (e.g. Claude Code) to the /api/mcp endpoint:
//
//   claude mcp add --transport http keystone \
//     https://<host>/api/mcp --header "Authorization: Bearer <token>"
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
// environment (or in .env.local / .env).

import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// ── Minimal .env loader (no dependency) ───────────────────────────────────────
for (const file of ['.env.local', '.env']) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const email = process.argv[2];
const tokenName = process.argv[3] || 'Claude Code';

if (!email) {
  console.error('Usage: node scripts/create-mcp-token.mjs <user-email> [token-name]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: user, error: userErr } = await admin
  .from('users')
  .select('id, email')
  .eq('email', email)
  .maybeSingle();

if (userErr) {
  console.error('Failed to look up user:', userErr.message);
  process.exit(1);
}
if (!user) {
  console.error(`No user found with email ${email}.`);
  process.exit(1);
}

const TOKEN_PREFIX = 'ksk_';
const token = `${TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
const tokenHash = createHash('sha256').update(token).digest('hex');
const tokenPrefix = token.slice(0, TOKEN_PREFIX.length + 6);

const { error: insertErr } = await admin.from('mcp_tokens').insert({
  user_id: user.id,
  name: tokenName,
  token_hash: tokenHash,
  token_prefix: tokenPrefix,
});

if (insertErr) {
  console.error('Failed to create token:', insertErr.message);
  process.exit(1);
}

console.log('');
console.log(`✅ MCP token created for ${user.email} (${tokenName})`);
console.log('');
console.log('   Store this token now — it will not be shown again:');
console.log('');
console.log(`   ${token}`);
console.log('');
console.log('   Connect Claude Code:');
console.log(`   claude mcp add --transport http keystone https://<your-host>/api/mcp --header "Authorization: Bearer ${token}"`);
console.log('');
