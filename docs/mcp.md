# Keystone MCP Server

Keystone exposes its website builder over the **Model Context Protocol (MCP)** so
an MCP client — most notably **Claude Code** — can build and edit sites
conversationally. The endpoint speaks JSON‑RPC 2.0 over Streamable HTTP and is
stateless (no sessions, serverless‑friendly).

- **Endpoint:** `POST /api/mcp`
- **Transport:** Streamable HTTP (`application/json` responses)
- **Auth:** `Authorization: Bearer ksk_…` personal token, scoped to one user

Every tool call runs **as the token's owner** and can only read or modify sites
that user owns — the same ownership rule the editor enforces.

## 1. Run the migration

```bash
psql "$DATABASE_URL" -f migrations/093_mcp_tokens.sql
```

This creates `public.mcp_tokens` (token hashes only — raw tokens are never
stored).

## 2. Mint a token

```bash
node scripts/create-mcp-token.mjs you@example.com "Claude Code"
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the
environment (or `.env.local`). The raw token is printed **once** — store it.

## 3. Connect Claude Code

```bash
claude mcp add --transport http keystone \
  https://<your-host>/api/mcp \
  --header "Authorization: Bearer ksk_…"
```

For local development, point at `http://localhost:3000/api/mcp`.

Then, in Claude Code:

> "List my Keystone sites." · "Create a site for a plumber called Acme Plumbing,
> then add a hero, a services grid and a contact form to the home page."

## Tools

| Tool | Purpose |
| --- | --- |
| `list_sites` | List the user's sites (id, name, publish status). |
| `get_site` | Theme, template, publish status, and the page list with block counts. |
| `get_page` | Full ordered blocks of one page (`slug: "home"` for home). |
| `create_site` | Create a new draft site; returns `siteId`. |
| `duplicate_site` | Clone an existing site into a new draft. |
| `list_block_types` | Every supported block type with a one‑line purpose. |
| `describe_block` | Editable fields, allowed values and guidance for one block type. |
| `set_page_blocks` | Replace all blocks on a page with an ordered list. |
| `add_block` | Append/insert one block on a page. |
| `update_block` | Merge new field values into one block. |
| `remove_block` | Delete one block. |
| `create_page` | Add a page (and nav entry). |
| `delete_page` | Delete a page (not `home`). |
| `set_theme` | Site title, fonts, and primary/secondary/accent colors. |

A typical build flow: `create_site` → `list_block_types` / `describe_block` to
learn the shapes → `set_page_blocks` (or repeated `add_block`) for the home page
→ `create_page` for inner pages → `set_theme` for fonts and colors. Publishing is
intentionally **not** exposed yet — it has plan/subscription and domain
provisioning rules; do that from the app.

## Security model

- Tokens are random 24‑byte secrets prefixed `ksk_`; only their SHA‑256 hash is
  stored, with RLS enabled (service‑role access only).
- Authentication happens before any JSON‑RPC parsing; an invalid/revoked token
  gets `401`.
- Block content is run through the same `sanitizeAiBlockData` scrubbing the AI
  builder uses, so MCP‑authored content is held to the same safety bar.
- Revoke a token by setting `revoked_at = now()` on its `mcp_tokens` row.
