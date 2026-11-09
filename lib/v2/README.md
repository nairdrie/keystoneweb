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

1. Apply `migrations/095_agent_sites_v2.sql` and `096_agent_sites_v2_concurrency.sql`.
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

## Business features (store, booking, reviews)

Agents design how business data looks; Keystone runs the logic (`get_guide topic=business`):

- **Live collections in agent markup**: `data-ks-collection="products|services|posts|post"` with an item template and
  `data-ks-bind` / `data-ks-bind-bg` / `data-ks-if`, filled from the products, booking and blog tables at request time
  (`lib/v2/collections.ts`), so new products and posts show up without republishing.
- **Blog**: owners write posts in Admin → Blog (`blog_posts`); articles live at `/blog/<slug>`. The agent designs the
  lists and one article layout page (`put_page { template: "post" }`, `data-ks-collection="post"` incl. the sanitized
  `content`); without it Keystone shows a plain article in the site's header/footer (`lib/v2/articles.ts`).
- **Actions**: `data-ks-action="add-to-cart|open-cart|book"`, live `data-ks-cart-count`. The cart uses the same
  storage format as Keystone's checkout (`public/ks/runtime.js`).
- **Hosted flows in the site's design**: `/cart`, `/book[?service=id]`, `/product/<id>` and `/order-confirmation`
  run Keystone's existing cart/checkout, booking and product components wrapped in the agent's header, footer and
  tokens (`app/v2flow`, middleware rewrite). `set_theme.platform` picks their colours.
- **Structured data**: lists marked `data-ks-schema="reviews|faq"` and live services become JSON-LD.
- **Agent tools**: `get_business_data`, `upsert_services`, `upsert_products`, `upsert_posts`.
- **Admin**: the Booking and Ecommerce tabs appear for v2 sites whose design uses those features.

## Membership (accounts, sign-in, members-only pages)

Same split as the business features: Keystone runs accounts and payments, the agent designs around them
(`get_guide topic=membership`). Members, packages and settings are the classic tables (`members`,
`membership_packages`, `membership_settings`, session cookie `ks_member_token`, host-only on the site's domain).

- **Hosted pages in the site's design**: `/signin`, `/signup[?package=id]`, `/member` (account) and `/forgot-password`
  run the existing membership components inside the agent's header/footer (`app/v2flow`, middleware rewrite). Same
  paths as classic sites, so verification and reset emails land on them.
- **Members-only pages and sections, enforced on the server**: `put_page { access: { members: true, packages? } }`
  (stored as `pages.design_data.v2Access`) and per-instance `audience: everyone|members|guests` (in the layout).
  `renderPage` drops sections the visitor shouldn't get; with no "guests" section it adds a plain sign-in panel.
  The `/v2r` route resolves the member (`lib/membership/access.ts`: active status, package, paid subscription in good
  standing) only for such pages and serves them `private, no-store`; they're noindex and left out of sitemap/llms.txt.
  Drafts show every section; `?ks_view=member|guest` previews one side.
- **Signed-in state in agent markup** (cosmetic, `public/ks/runtime.js`): `data-ks-show="members|guests"`,
  `data-ks-member-field="name|first_name|email|package"`, actions `signin|signup|account|signout`, `html[data-ks-member]`.
- **Agent tools**: `get_membership` (packages, form, settings, counts only — never members' personal data),
  `configure_membership`, `upsert_membership_packages` (paid packages on the owner's connected Stripe,
  `lib/membership/stripe-packages.ts`). The validator warns on links to another site's `/signin`.
- **Admin**: the Users tab appears for v2 sites using any of the above (`featuresIn`, `/api/v2/engine`).

## Archie v2 (in-editor AI)

Owners get Archie inside the v2 editor (`app/(app)/design/v2/archie.tsx`):

- **Click anything they can't edit** (shapes, svgs, backgrounds, spacing, custom HTML) → `public/ks/editor.js` outlines it
  and posts `ask` with the section instance, a CSS path inside the section, trimmed markup and style hints. A popover
  opens next to the click.
- **"Ask for a change"** opens the same popover docked under the button (no element reference). "Ask a human" still
  sends the old change request to the Keystone team.

`POST /api/v2/archie` (NDJSON stream) runs a Claude tool loop (`lib/v2/archie.ts`) over the MCP tools, locked to the
site (site_id injected, no publish / other sites / staff tools). The clicked section's code is preloaded. A restore
point is taken before Archie's first write and returned as **Undo**. Every request is saved as a run in `v2_activity`
(action `archie`: prompt, target, progress, reply, undo point), so the docked panel shows recent work after a refresh,
and runs keep going (`after()`) if the editor is closed; the editor polls a running one and reloads when it finishes.
One run at a time per site; Stop is checked between model turns. Archie sees only the last 6 runs from the past 24h,
trimmed, so the prompt never grows. Each request counts as one AI prompt against the
classic AI Builder limits (staff exempt; refunded if nothing happened). Env: `AI_BUILDER_API_KEY` (or
`ARCHIE_API_KEY`), optional `ARCHIE_MODEL` (default `claude-sonnet-5-5`).

Try it locally without Supabase: `npx tsx scripts/dev-v2-archie.ts` (port 3200; prints the editor URL and a session cookie).

## "Powered by Keystone" (required on every site)

Enforced by the platform, so it holds for external MCP agents, Archie and our team alike:

- **Renderer** (`lib/v2/render.ts`): an element with `data-ks-attribution` (agents put `<p data-ks-attribution></p>` in the
  footer) is always filled with "Powered by <a href=https://keystoneweb.ca>Keystone</a>"; its own text/href are ignored and
  `hidden`/`aria-hidden` are dropped. Agents style it with CSS. No slot (forgotten, removed, no footer) → a plain fallback
  line is rendered after the footer, on pages and on the hosted cart/booking/product pages.
- **Runtime** (`public/ks/runtime.js`): if the slot is hidden, shrunk, off-screen or transparent after scripts run, a plain
  badge is appended (waits for scroll-reveal fades and background tabs).
- **Validator**: CSS that hides the slot and scripts that reference it are errors (publish blocked); a footer without a
  slot is a warning.
- **Agents are told** in the MCP `initialize` instructions (in every external client's system prompt), the `set_layout`
  description, `get_guide` and Archie's prompt.

## Agent screenshots

The MCP `screenshot` tool returns desktop/tablet/mobile JPEGs of a draft (scripts running) plus problems found:
sideways scrolling (and which elements cause it), broken images, text left invisible by animations, small tap
targets and JS errors. Provider: `KS_SCREENSHOT_URL` + `KS_SCREENSHOT_TOKEN` pointing at the service in
`services/screenshot` (Dockerfile included; Vercel functions can't run Chromium well), or a local Playwright
install (dev/staging).

## Stale-write protection

Every write is a compare-and-swap (migration 096 adds `v2_content.rev`; sections, layouts and the theme use
`version`). Callers that pass the version they read (`expected_version` / `expected_rev`, which the owner editor
always does) get a 409 "changed by someone else" instead of overwriting; internal races retry on fresh data, so
concurrent edits never lose each other.

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
| `lib/v2/archie.ts`, `app/api/v2/archie/route.ts` | Archie v2 (in-editor AI over the MCP tools) |

## Tests

- `npm run test:v2` — compiler/renderer unit tests + a full agent/owner flow against an in-memory DB
  (runs in `prebuild`).
- `npm run test:v2:e2e` — real Next dev server + Chromium, with Supabase emulated over HTTP.
  Set `E2E_SCREENSHOTS=<dir>` for screenshots.

## Not yet in v2

Menu, events and translations still render only in classic sites. Member-only product prices (`tier_prices`) aren't
applied on v2 product lists yet, and owners can't toggle members-only pages in the v2 editor (agents set them).
