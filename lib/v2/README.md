# Agent-built sites (engine v2)

Keystone now has two site engines:

| | `blocks_v1` (classic) | `sections_v2` (agent-built) |
|---|---|---|
| Who designs | The owner, with block settings | An AI agent (or our team) through the MCP server |
| Stored as | `sites/pages.design_data` JSON blocks | `v2_themes`, `v2_sections`, `v2_page_layouts`, `v2_content` |
| Rendered by | `EditorContent` + template shells (React) | `lib/v2/render.ts` → plain HTML document (`/v2r/...`) |
| Edited in | Classic editor | Click-to-edit content editor (`app/(app)/design/v2`) |

Every existing site is `blocks_v1` (the column default) and is untouched: v2 code only runs when
`sites.engine = 'sections_v2'`.

## Setup

1. Apply `migrations/095_agent_sites_v2.sql`.
2. Optional: set `KS_V2_PREVIEW_SECRET` (signs draft/preview links; falls back to a hash of
   `SUPABASE_SERVICE_ROLE_KEY`).
3. Create a token: **Account Settings → Agent access → Create token** (tick *Can publish* only for
   trusted internal agents).
4. Connect an agent, e.g. Claude Code:

   ```bash
   claude mcp add --transport http keystone https://keystoneweb.ca/api/mcp \
     --header "Authorization: Bearer ks_pat_…"
   ```

   Then: *"Use the keystone MCP to build a site for <business>. Read get_guide first."*

## The model

- **Design** (agent-owned): theme tokens (CSS custom properties; some marked owner-editable),
  global CSS/JS, and *sections* — annotated HTML + scoped CSS + an optional JS module.
- **Content** (owner-owned, agent-seeded): one row per field per section instance. The text in the
  agent's HTML is only the default.
- **Structure**: `pages` (existing table) + ordered section instances per page; header/footer are
  global sections.

Rules enforced in `lib/v2/ops.ts` (shared by the editor and MCP):

- Agents can't overwrite a field the owner edited unless called with `force` (only when the human asked).
- A restore point is taken before changes (at most every 10 minutes per actor type); every change is
  logged in `v2_activity`.
- All content is sanitized on write and again on render. Agent JS never runs on our servers.

The section markup contract (data-ks attributes) is documented for agents in `lib/v2/guide.ts`
(served by the `get_guide` tool). The compiler (`compile.ts`) rejects visible text or images that
the owner couldn't edit.

## Security

- Published v2 sites are served on `*.kswd.ca` / custom domains with a CSP that only allows scripts
  from the site itself and the CDN allowlist in `policy.ts`.
- Drafts (`/v2r/draft/<signed token>`) are served with `Content-Security-Policy: sandbox`, so agent
  JS runs in an opaque origin even though drafts are served from the app host. The editor canvas is
  also a sandboxed iframe that talks to the editor only through `postMessage`.
- `/v2r/pub/<siteId>` reached directly on the app host is sandboxed the same way.

## Files

| Path | What |
|---|---|
| `lib/v2/compile.ts` | Section HTML → field schema, defaults, issues |
| `lib/v2/render.ts` | Bundle → HTML document (published / edit / preview) |
| `lib/v2/ops.ts` | All site operations (editor + agents) |
| `lib/v2/store.ts` | Persistence, snapshots, restore |
| `lib/v2/validate.ts` | Site-wide validation (blocks publish on errors) |
| `lib/v2/mcp-server.ts`, `mcp-tools.ts` | MCP JSON-RPC + tools |
| `lib/v2/publish.ts` | Shared v2 publish (publish route, Launch Service, MCP) |
| `public/ks/runtime.js` | Site runtime: agent modules, forms → inbox, page views |
| `public/ks/editor.js` | In-canvas editing (sandboxed iframe) |
| `app/v2r/[mode]/[key]/[[...path]]/route.ts` | Renderer route |
| `app/api/mcp/route.ts` | MCP endpoint |
| `app/api/v2/editor/route.ts` | Owner editor API |
| `app/(app)/design/v2/*` | Owner editor UI |

## Tests

- `npm run test:v2` — compiler/renderer unit tests + a full agent/owner flow against an in-memory DB
  (runs in `prebuild`).
- `npm run test:v2:e2e` — real Next dev server + Chromium, with Supabase emulated over HTTP.
  Set `E2E_SCREENSHOTS=<dir>` for screenshots.

## Not yet in v2

Booking, products/cart, menu, events, blog lists, membership gating and translations still render
only in classic sites. Platform data can't yet be looped over in agent markup (`data-ks-collection`
is reserved). Preview screenshots for agents, OAuth for third-party agent connectors, and the
in-editor "Ask AI" are later phases.
