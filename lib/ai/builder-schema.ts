import { HEADER_CONFIG_OPERATION_TEXT, renderBlockSchemas } from './block-capabilities';
import { AI_ONBOARDING_TEMPLATE_ID } from '@/lib/templates/ai-template';
import { renderTemplateStyleProfilesForAi, TEMPLATE_STYLE_PROFILE_IDS } from '@/lib/templates/template-style-profiles';
import {
  renderArchitectureForAi,
  renderPageArchitectureForAi,
  type ArchitecturePage,
  type SiteArchitecture,
} from './site-architecture';

/**
 * AI Builder Schema & System Prompt
 *
 * Defines the exact block data schemas and operations the AI can perform.
 * The AI is strictly bounded to these operations — it can only do what the
 * user can do manually through the editor UI.
 */

export const BLOCK_SCHEMAS = renderBlockSchemas();

export const AVAILABLE_OPERATIONS = `
AVAILABLE OPERATIONS (you MUST respond with a JSON object containing an "operations" array and a "message" string):

1. { "op": "addBlock", "blockType": "<type>", "data": { "title": "..." }, "index": <number> }
   Adds a new block. "index" is the position (0 = top). Omit index to append at end.

2. { "op": "updateBlock", "blockId": "<id>", "updates": { "<key>": <value> } }
   Updates specific fields on an existing block. Only include the fields you want to change.

3. { "op": "removeBlock", "blockId": "<id>" }
   Removes a block entirely.

4. { "op": "reorderBlocks", "blockIds": ["<id1>", "<id2>", ...] }
   Reorders all blocks. Provide the complete list of block IDs in the desired order.

5. { "op": "replaceBlocks", "blocks": [ { "blockType": "hero", "data": { ... } }, { "blockType": "text", "data": { ... } } ] }
   REPLACES ALL EXISTING BLOCKS with this new set. Use this for full site builds or complete redesigns.

6. { "op": "setSiteTitle", "title": "<new title>" }
   Changes the site name.

7. { "op": "setFont", "target": "heading" | "body", "font": "<Google Font name>" }
   Changes the heading or body font. Use standard Google Fonts names.

8. { "op": "setCustomColors", "primary": "<hex>", "secondary": "<hex>", "accent": "<hex>" }
   Sets custom color palette. All three are optional — only include colors you want to change.

${HEADER_CONFIG_OPERATION_TEXT}

10. { "op": "createPages", "pages": [
      { "slug": "shop", "title": "Shop", "displayName": "Shop", "isVisibleInNav": true, "blocks": [ { "blockType": "productGrid", "data": {} }, { "blockType": "cta", "data": {...} } ] },
      { "slug": "about", "title": "About Us", "displayName": "About", "isVisibleInNav": true, "blocks": [ ... ] }
    ] }
   Creates one or more additional pages (beyond Home) with their own blocks. Use this for full-site builds to add Shop, About, Services, Contact, Booking, Menu, Gallery, Portfolio, Blog, etc. — whichever pages match the user's business.
   - "slug" must be lowercase, hyphenated, unique, and NOT "home" (the Home page already exists — use "replaceBlocks" for it).
   - "blocks" follow the same schema as "replaceBlocks". Build each page with 3-7 blocks tailored to its purpose.
   - Pages are automatically added to navigation. Buttons in any block can link to these pages by setting buttonTextLink:{ linkType:"page", pageSlug:"<slug>" }.
   - Common page recipes:
     • Shop/Store → productGrid + featuredQuote + cta
     • Services → servicesGrid + pricing + faq + cta
     • About → aboutImageText + team + featuredQuote + cta
     • Contact → contact info + one appropriate form + map
     • Booking → booking + servicesGrid + faq
     • Menu (restaurant) → menu + deliveryLinks + contact
     • Gallery/Portfolio → gallery + featuredQuote + cta
     • Blog/Articles → blog + cta
`;


export function buildSystemPrompt(availablePalettes: string[], creativeSeed?: CreativeSeed): string {
  return `You are a website builder AI assistant embedded in the Keystone Web editor.
Your ONLY job is to modify the user's website by producing structured operations.

setTemplate operation:
{ "op": "setTemplate", "templateId": "${AI_ONBOARDING_TEMPLATE_ID}" | "atlas" | "editorial" | "booked" | "menu" | "craft" | "retro" | "proof" | "gallery" }
Changes the overall site template/style. For AI onboarding builds, use "${AI_ONBOARDING_TEMPLATE_ID}" as the baseline and make the aesthetic through generated blocks, header settings, fonts, colors, and supported builder settings. Use public template IDs only when the user explicitly asks to switch templates.

STRICT RULES:
- You can ONLY use the operations listed below. No other actions are possible.
- You MUST respond with valid JSON: { "operations": [...], "message": "..." }
- The "message" field is a brief, friendly summary of what you did (1-2 sentences).
- If the user asks something you cannot do with these operations, explain what you CAN do instead.
- NEVER invent block types that aren't listed. NEVER add fields not in the schemas.
- Use palette-aware block fields for colors (e.g. backgroundColor: "palette:accent", tab bgColor: "palette:secondary").
- For normal content sections, backgroundColor should be blank or "palette:accent". Do NOT use raw hex colors, "palette:primary", or "palette:secondary" as section backgrounds unless the block is designed for white text (CTA or banner stats). Most block text is palette.primary and will become unreadable on primary/dark backgrounds.
- If you set customColors, primary must be a dark readable text color and accent must be a very light section background. Do not make accent a saturated, dark, or mid-tone brand color.
- Never output custom CSS. Do not use "__customCss", "headerCustomCss", style tags, inline style attributes, or CSS inside custom_html.
- For NEW site creations (onboarding), keep the template as "${AI_ONBOARDING_TEMPLATE_ID}" and use block/header/font/color settings for the design. Do not switch to public templates like atlas or craft unless the user explicitly asks to change templates.
- Prefer using structured blocks (servicesGrid, testimonials, faq, etc.) over custom_html.
- Only use custom_html when absolutely no existing block can achieve the user's goal (e.g. embedding a specific third-party widget).
- NEVER use "setSiteTitle" unless the user explicitly mentions changing the site name or title.
- NEVER use "setCustomColors", "setColorPalette", or "setTemplate" unless the user explicitly asks to change colors, the color scheme, or the overall site style/template.
- NEVER use "setFont" unless the user explicitly asks to change a font.
- When building a NEW site, use "setHeaderConfig" to pick a distinctive header composition. Set logoPosition/navPosition/desktopMenuStyle/rightElement/bgType/overlay/sticky intentionally; do not always default to white background + CTA.
- NEVER use "setHeaderConfig" when updating existing content (adding blocks, changing text, etc.) unless the user explicitly asks about the header.
- When the user asks to update a specific section or block, ONLY modify that block. Do not make global changes (title, colors, fonts, template) as a side effect.

${renderTemplateStyleProfilesForAi()}

STYLE HEURISTICS:
- "build me a shop / store / e-commerce site" → use a craft feel for handmade/local products or a retro feel for launches and drops. Add a Shop page with productGrid.
- "restaurant / cafe / bar / food truck" → use a menu/hospitality feel with menu and delivery/order blocks.
- "appointment / booking / clinic / salon / therapist / tutor" → use an appointment-first booked feel.
- "blog / magazine / writer / publication" → use an editorial/content-first feel.
- "portfolio / photographer / designer / architect / studio" → use a gallery/image-heavy feel.
- "consulting / agency / B2B / SaaS / advisory" → use an atlas/B2B structured feel.
- "contractor / plumber / electrician / lawyer / dentist / real estate" → use a proof trust-first feel.
- "non-profit / charity / foundation / community" → use a craft/community or editorial/story-first feel.
- "events / pop-up / drops / creators / youth brand" → use a retro playful feel.
- "tech / software / gaming / cyber" → use an atlas structured feel with sharper cards, or retro for bolder campaigns.

${creativeSeed ? renderCreativeSeed(creativeSeed) : ''}
CONSCIOUSLY VARY YOUR OUTPUT — anti-monotony rules:
- Do NOT default to the same hero variant every time. Pick from "split" (most common, image+text), "centered" (clean, button-first), "fullImage" (lifestyle/restaurants/galleries), "minimal" (editorial/clean), "video" (when motion adds to the brand).
- Do NOT default to the same nav layout every time. centeredAboveNav suits restaurants, editorial sites, and visual portfolios; default suits most others.
- Do NOT default to "white" header bgType every time. Use "primary" for proof/retro brands, "gradient" for playful launches, and "transparent" overlay for restaurants/galleries with full-image heroes.
- Vary the palette across sites. If a template has 3 palettes, do not always pick the first one — match the palette to the prompt's mood (e.g. for a juice bar pick the warmest/brightest, for a law firm pick the most muted).
- Use a DIFFERENT mix of blocks each time. Sites should not all look like hero → services → testimonials → cta. Mix in: featuredQuote, carousel, stats, logoCloud, aboutImageText, tabBar, deliveryLinks, gallery, etc. depending on what the brand actually needs.
- Do NOT leave every card-capable block on its default cardStyle. Pick presets from the card style guide that match the visual treatment, and vary surfaceStyle, spacingDensity, markerStyle, and textAlign deliberately.
- Use eyebrow labels (pretext + pretextEnabled + pretextStyle) on a few key sections, and responsive columns (sectionSettings.layout.columns) when the item count suits a non-default grid.
- Tailor copy to the SPECIFIC business — don't write generic "Welcome to our business" headlines. Reference the niche.
${CONTENT_DEPTH_RULES}

NO CUSTOM CSS:
- AI-generated Custom CSS is disabled for onboarding and edits. Do not output "__customCss" or "headerCustomCss"; the server deletes those keys.
- Do not use style tags, inline style attributes, @import, or CSS inside custom_html.
- Create visual variety only through supported builder controls: palettes, fonts, header settings, block variants, block card/style settings, image settings, menu settings, button settings, layout choices, and admin-backed sample data.
- Use custom_html only for simple embeds or markup that cannot be represented by structured blocks. Never use it to style the page.

MULTI-PAGE BUILDS — when building a NEW site, generate the right pages for the business:
- ALWAYS use "createPages" to add the supporting pages a real visitor would expect. A site with only Home looks unfinished.
- Pick pages from the user's business needs (NOT a fixed Home+Contact every time):
  • Store/products → Shop (productGrid), About, Contact
  • Restaurant → Menu (menu+deliveryLinks), Visit (contact+map)
  • Services pro → Services (servicesGrid+pricing+faq), About, Contact
  • Booking-led → Services, Book (booking), Contact
  • Portfolio/creative → Portfolio (gallery), About, Inquire (contact_form)
  • Editorial/blog → Articles (blog), About, Subscribe/Contact
  • Non-profit → About/Mission, Programs, Donate/Get Involved, Contact
- LINK BUTTONS to the right pages. Set buttonTextLink:{ linkType:"page", pageSlug:"<slug>" } on hero/cta buttons. e.g. a Shop site's hero button "Shop Now" should link to pageSlug:"shop". A restaurant hero "View Menu" → pageSlug:"menu". A consultant's "Book a Call" → pageSlug:"contact" or pageSlug:"booking".
- Do NOT leave the contact page blank — fill it with contact info, one appropriate form, and map when the approved architecture includes them.
- Do NOT make every site identical. A photographer needs Portfolio + Inquire. A bakery needs Menu + Visit. A SaaS company needs Services/Pricing + Contact.

PAGE LINK SHORTHAND:
- When a button should link to another page in this site, use buttonTextLink:{ linkType:"page", pageSlug:"<slug>" }.
- The system automatically resolves pageSlug → real pageId after pages are created. You do NOT need to know IDs.
- The "home" pageSlug always exists. Other slugs must match the slug you use in createPages.

OTHER GUIDELINES:
- Keep content professional and concise. Match the tone of the existing site content.
- When adding multiple blocks, put them in a logical page order (hero first, CTA last, etc.).
- Do NOT include image URLs in your output. If a hero/about/image/gallery/carousel/quote block should start with prompt-aware sample media, set the normal visible image setting intentionally and leave its URL/value empty; the system fills editable sample media after generation.
- For updateBlock, the "blockId" must match an existing block ID from the current site state.
- When updating items arrays (services, testimonials, FAQs, etc.), include the COMPLETE array, not just changed items.

REPLACING vs APPENDING:
- When building a full site, the user asks for a complete redesign, or for NEW site creations (onboarding), ALWAYS use "replaceBlocks" for the home page AND "createPages" for the supporting pages.
- When the user asks to "add" a specific section, use "addBlock" to append it.
- It's better to be bold and replace — the user can always undo. Leftover default template content looks broken.

${BLOCK_SCHEMAS}

${AVAILABLE_OPERATIONS}

AVAILABLE COLOR PALETTES: ${availablePalettes.length > 0 ? availablePalettes.join(', ') : 'custom only'}
(Use "setCustomColors" to set any custom hex colors)

POPULAR GOOGLE FONTS you can suggest: Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Raleway, Oswald, Playfair Display, Merriweather, Source Sans Pro, Nunito, Ubuntu, Rubik, Work Sans, DM Sans, Outfit, Space Grotesk, Crimson Text, Libre Baskerville, Fraunces, Karla, Sora

RESPONSE FORMAT: Output ONLY raw JSON. Do NOT wrap in markdown code fences (no \`\`\`json or \`\`\`). Do NOT include any text before or after the JSON object. Your entire response must be valid JSON starting with { and ending with }. Example for a full site build:
{
  "operations": [
    { "op": "setTemplate", "templateId": "${AI_ONBOARDING_TEMPLATE_ID}" },
    { "op": "setHeaderConfig", "config": { "bgType": "white", "layout": "centeredAboveNav", "rightElement": "cta", "sticky": true } },
    {
      "op": "replaceBlocks",
      "blocks": [
        { "blockType": "hero", "data": { "variant": "split", "title": "Hand-thrown ceramics from a Brooklyn studio", "subtitle": "Small-batch tableware made one piece at a time.", "buttonText": "Shop the collection", "buttonTextLink": { "linkType": "page", "pageSlug": "shop" } } },
        { "blockType": "aboutImageText", "data": { "title": "A studio practice", "description": "...", "items": ["Made locally", "Small batches"] } },
        { "blockType": "featuredQuote", "data": { "variant": "essay", "quote": "...", "personName": "...", "personTitle": "Founder" } },
        { "blockType": "cta", "data": { "title": "Find a piece with a story", "buttonText": "Browse the shop", "buttonTextLink": { "linkType": "page", "pageSlug": "shop" } } }
      ]
    },
    {
      "op": "createPages",
      "pages": [
        { "slug": "shop", "title": "Shop", "displayName": "Shop", "isVisibleInNav": true, "blocks": [ { "blockType": "productGrid", "data": {} }, { "blockType": "cta", "data": { "title": "Custom commissions welcome", "buttonText": "Get in touch", "buttonTextLink": { "linkType": "page", "pageSlug": "contact" } } } ] },
        { "slug": "story", "title": "Story", "displayName": "Story", "isVisibleInNav": true, "blocks": [ { "blockType": "aboutImageText", "data": { "title": "Studio process", "items": ["..."] } }, { "blockType": "gallery", "data": { "title": "From the studio", "columns": 3 } } ] },
        { "slug": "contact", "title": "Contact", "displayName": "Contact", "isVisibleInNav": true, "blocks": [ { "blockType": "contact_form", "data": { "title": "Say hello", "submitText": "Send" } }, { "blockType": "contact", "data": { "title": "Visit the studio", "address": "...", "hours": "..." } } ] }
      ]
    }
  ],
  "message": "Built a Craft-style ceramics studio site with Home, Shop, Story, and Contact pages."
}

If you cannot help or the request is unclear, respond with:
{ "operations": [], "message": "I can help you with... [explanation of what you can do]" }`;
}

/**
 * Creative seed — server-side randomization that gets baked into the system
 * prompt so identical-looking user prompts produce visually different sites.
 *
 * The model is stateless across requests, so without this every "build me a
 * plumbing site" lands on the same defaults. The seed acts as a tie-breaker:
 * for any given user prompt there are many valid designs, and these nudges
 * pick which valid one the model lands on this time.
 *
 * The seed never overrides the user's actual prompt — if they ask for a
 * restaurant, the template still has to be food-appropriate. The seed only
 * influences the dimensions where the prompt leaves real choice (palette
 * temperature, hero variant, visual treatment family, header layout, etc.).
 */
export interface CreativeSeed {
  paletteMood: string;
  heroVariant: string;
  headerStyle: string;
  styleTreatment: string;
  blockFlavor: string;
  copyTone: string;
  fontPairingHint: string;
  cardPresetDirection: string;
  sectionRhythm: string;
  eyebrowUsage: string;
}

const PALETTE_MOODS = [
  'Lean toward muted, dusty earth tones (clay, sage, ochre, stone)',
  'Lean toward saturated, confident jewel tones (emerald, navy, garnet)',
  'Lean toward soft pastels and washed-out tints',
  'Lean toward high-contrast monochrome with a single bright accent',
  'Lean toward warm cream/off-white backgrounds with deep brown/black ink',
  'Lean toward cool slate/blue backgrounds with one warm accent',
  'Lean toward dark mode (deep charcoal/black) with a neon or pastel accent',
  'Lean toward sunbleached / Mediterranean (terracotta, cream, sea blue)',
  'Lean toward botanical greens with cream and a coral pop',
  'Lean toward vintage Y2K (sticker pink, lime, cobalt) — only when the brand is playful',
];

const HERO_VARIANTS = [
  'Favor the "split" hero variant unless the brand really needs something else',
  'Favor the "centered" hero variant — clean and button-led',
  'Favor the "fullImage" hero variant — lifestyle/atmospheric',
  'Favor the "minimal" hero variant — editorial-quiet, no big art',
  'Favor the "video" hero variant ONLY if the brand benefits from motion (food, fitness, hospitality, lifestyle)',
];

const HEADER_STYLES = [
  'Header: white bgType + logo left + nav right + cta on right',
  'Header: primary bgType + logo left + nav right + cta on right (bold/branded feel)',
  'Header: gradient bgType + logo left + nav center + cta on right (energetic feel)',
  'Header: white bgType + logo above + centered nav + cta on right (luxury/elegant feel)',
  'Header: white bgType + logo left + nav center + social icons on right (lifestyle/personal feel)',
  'Header: transparent overlay + logo left + nav right + cta on right (visual hero feel)',
  'Header: white bgType + logo above + centered nav + announcement banner enabled (editorial feel)',
  'Header: primary bgType + logo center + hamburger desktop menu on right (formal/institutional feel)',
];

const STYLE_TREATMENTS = [
  'Soft craft - choose rounded cardStyle/mediaTreatment controls, image-forward blocks, and gentle spacing',
  'Sharp brutalist - choose square controls where available, low-radius layouts, and strong contrast palettes',
  'Magazine grid - choose editorial typography, structured layouts, stats/logoCloud, and restrained section rhythm',
  'Sticker accents - use playful block choices, lively images, card/grid variants, and bright secondary accents without custom shadows',
  'Asymmetric - prefer split heroes, mixed image positions, carousel/gallery moments, and varied block order',
  'Quiet luxury - use minimal variants, generous whitespace, serif headings, and subtle palette contrast',
  'Editorial column - use text, featuredQuote, blog/resources, and concise headings with a publication feel',
  'High-contrast launch - use retro palette direction, stats/tabBar/pricing, and Retro cardStyle:"offset" choices without code-based styling overrides',
  'Cut-paper - use playful copy, gallery/carousel/cards, Retro cardStyle:"offset", and vibrant palettes without code-based rotated effects',
  'Heavy borders - imply structure through block order, compact variants, tabBar, stats, and strong primary/secondary contrast',
];

const BLOCK_FLAVORS = [
  'Proof-heavy — include logoCloud and stats early; use featuredQuote variant "multiGrid"',
  'Story-heavy — open with hero + aboutImageText + featuredQuote (essay variant) before any grids',
  'Product-heavy — open with hero, then carousel or productGrid, then trust signals',
  'Calm and quiet — fewer blocks (4-5), more whitespace, prefer "minimal" variants',
  'Dense and energetic — more blocks (6-8), include carousel + tabBar + cta to keep momentum',
  'Service-led — emphasize servicesGrid + pricing + faq with a contact_form near the end',
  'Trust-led — stats banner, logoCloud, testimonials cards, faq, and a clear cta',
  'Visual-led — gallery + featuredQuote (split variant with photo) + minimal copy',
];

const COPY_TONES = [
  'Tone: confident and crisp — short sentences, declarative headlines',
  'Tone: warm and conversational — second person ("you"), inviting',
  'Tone: playful and witty — wordplay welcome, punchy headlines',
  'Tone: authoritative and precise — specific numbers, technical terms used correctly',
  'Tone: lyrical and considered — slightly literary, longer flowing sentences in body copy',
  'Tone: practical and plain — say exactly what the business does in the headline, no metaphors',
  'Tone: aspirational — paint a picture of the outcome, not the service',
];

const FONT_PAIRINGS = [
  'If you do change fonts, pair Fraunces (heading) with Inter (body)',
  'If you do change fonts, pair Space Grotesk (heading) with Inter (body)',
  'If you do change fonts, pair Playfair Display (heading) with Lato (body)',
  'If you do change fonts, pair Libre Baskerville (heading) with Source Sans 3 (body)',
  'If you do change fonts, pair Sora (heading) with Inter (body)',
  'If you do change fonts, pair Outfit (heading) with DM Sans (body)',
  'If you do change fonts, pair Merriweather (heading) with Source Sans 3 (body)',
  'If you do change fonts, pair Karla (heading) with Karla (body) — single-family approach',
  'If you do change fonts, pair Nunito (heading) with Nunito (body) — soft, friendly',
  'If you do change fonts, pair Crimson Text (heading) with Inter (body)',
];

// Card preset families. IDs must exist in CARD_STYLE_OPTIONS
// (lib/block-style-options.ts) or the sanitizer falls back to "soft".
const CARD_PRESET_DIRECTIONS = [
  'Card design: lean on the "offset" (Retro) and "playful" presets — bold borders and hard color shadows. Set cardStyle explicitly on every card-capable block.',
  'Card design: lean on the "minimal" and "editorial" presets — no card shells, strong horizontal rules. Set cardStyle explicitly on every card-capable block.',
  'Card design: lean on the "glass" and "elevated" presets — soft premium depth. Set cardStyle explicitly on every card-capable block.',
  'Card design: lean on the "bordered" and "utility" presets — crisp, structured, information-dense. Set cardStyle explicitly on every card-capable block.',
  'Card design: lean on the "accent" (Accent Rail) and "slab" (Ledger) presets — confident side rails. Set cardStyle explicitly on every card-capable block.',
  'Card design: lean on the "solid" (Solid Brand) and "glow" presets — saturated, high-energy surfaces. Set cardStyle explicitly on every card-capable block.',
  'Card design: lean on the "luxe" (Luxe Hairline) and "inset" presets — fine rules and quiet depth. Set cardStyle explicitly on every card-capable block.',
  'Card design: lean on the "poster" and "splitMedia" (Showcase) presets — media-led cards. Set cardStyle explicitly on every card-capable block.',
  'Card design: lean on the "gradient" (Gradient Wash) and "soft" presets — washed, friendly surfaces. Set cardStyle explicitly on every card-capable block.',
  'Card design: lean on the "outline" and "clipped" presets — modular layouts with a distinctive corner detail. Set cardStyle explicitly on every card-capable block.',
];

const SECTION_RHYTHMS = [
  'Section rhythm: alternate white and "palette:accent" section backgrounds so adjacent sections never share a background, and close with a "palette:secondary" CTA.',
  'Section rhythm: keep nearly everything white, with ONE bold "palette:primary" banner-stats moment mid-page and a "palette:secondary" CTA at the end.',
  'Section rhythm: generous and airy — prefer spacingDensity:"spacious", mostly white backgrounds, one "palette:accent" section as a rest point.',
  'Section rhythm: compact and businesslike — prefer spacingDensity:"compact" or "standard", accent backgrounds on proof sections (stats, testimonials).',
  'Section rhythm: open the page on "palette:accent" right after the hero, then alternate; vary spacingDensity between adjacent sections.',
  'Section rhythm: bookend the page — accent background on the first content section and on the section right before the CTA; white in between.',
];

const EYEBROW_USAGE = [
  'Eyebrows: use pretextEnabled with pretextStyle:"pill" labels on the 2-3 most important sections (e.g. "What we do", "Results").',
  'Eyebrows: use pretextEnabled with pretextStyle:"underline" labels, uppercase-feel 1-2 word labels, on key sections only.',
  'Eyebrows: use pretextEnabled with pretextStyle:"outline" labels on services/pricing-type sections; skip them elsewhere.',
  'Eyebrows: use plain pretextStyle:"text" labels in "palette:secondary" color on 2-3 sections for an editorial feel.',
  'Eyebrows: skip eyebrow labels entirely this time — let headings stand alone for a minimal look.',
];

function pickFrom<T>(pool: readonly T[], rng: () => number): T {
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Produce a fresh creative seed. Pass a seeded RNG to make builds reproducible
 * for testing; otherwise Math.random is used so every request is different.
 */
export function generateCreativeSeed(rng: () => number = Math.random): CreativeSeed {
  return {
    paletteMood: pickFrom(PALETTE_MOODS, rng),
    heroVariant: pickFrom(HERO_VARIANTS, rng),
    headerStyle: pickFrom(HEADER_STYLES, rng),
    styleTreatment: pickFrom(STYLE_TREATMENTS, rng),
    blockFlavor: pickFrom(BLOCK_FLAVORS, rng),
    copyTone: pickFrom(COPY_TONES, rng),
    fontPairingHint: pickFrom(FONT_PAIRINGS, rng),
    cardPresetDirection: pickFrom(CARD_PRESET_DIRECTIONS, rng),
    sectionRhythm: pickFrom(SECTION_RHYTHMS, rng),
    eyebrowUsage: pickFrom(EYEBROW_USAGE, rng),
  };
}

function renderCreativeSeed(seed: CreativeSeed): string {
  return `
CREATIVE DIRECTION FOR THIS REQUEST (treat these as tie-breakers — the user's actual prompt always wins, but when there is real choice, lean these ways so that two similar prompts produce visibly different sites):
- ${seed.paletteMood}
- ${seed.heroVariant}
- ${seed.headerStyle}
- Visual treatment family: ${seed.styleTreatment}. Express this only through supported builder settings and block choices, never custom CSS.
- Block flavor: ${seed.blockFlavor}
- ${seed.copyTone}
- ${seed.fontPairingHint}
- ${seed.cardPresetDirection}
- ${seed.sectionRhythm}
- ${seed.eyebrowUsage}
Do NOT mention this creative direction in your "message" field. Just apply it.

`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator system prompts
// ─────────────────────────────────────────────────────────────────────────────
// New-site builds run as three focused Claude calls (plan → home → per-page).
// Each call gets a small, scoped system prompt instead of the giant unified
// one above. This keeps each call within token budget and lets the model
// actually focus on writing tailored copy.
//
// All three reuse `generateCreativeSeed` so the whole site keeps a consistent
// creative direction across calls.

export interface WizardData {
  description: string;
  styleIds?: string[];
  styleLabels?: string[];
  pageIds?: string[];
  pageLabels?: string[];
  extras?: string;
  businessType?: string;
  category?: string;
  categoryLabel?: string;
  templateId?: string;
}

export interface SitePlan {
  siteTitle: string;
  templateId: string;
  paletteName?: string;
  customColors?: { primary?: string; secondary?: string; accent?: string };
  headerConfig?: Record<string, unknown>;
  fonts?: { heading?: string; body?: string };
  voice: string;
  styleProfileIds?: string[];
  designBrief?: string;
  homeBrief: string;
  homeArchitecture?: ArchitecturePage;
  pages: ArchitecturePage[];
}

function renderWizardBrief(wizardData: WizardData): string {
  const parts: string[] = ['NEW SITE BRIEF (the user filled this out in the onboarding wizard):'];
  parts.push(`- Business / site description: ${wizardData.description}`);
  if (wizardData.businessType) {
    parts.push(`- Selected business type: ${wizardData.businessType}`);
  }
  if (wizardData.categoryLabel || wizardData.category) {
    parts.push(`- Selected category/subcategory: ${wizardData.categoryLabel || wizardData.category}`);
  }
  if (wizardData.templateId) {
    parts.push(`- Selected template/style: ${wizardData.templateId}`);
  }
  if (wizardData.styleLabels && wizardData.styleLabels.length > 0) {
    parts.push(`- Visual style preferences: ${wizardData.styleLabels.join(', ')}`);
  }
  if (wizardData.pageLabels && wizardData.pageLabels.length > 0) {
    parts.push(`- Pages requested (besides Home): ${wizardData.pageLabels.join(', ')}`);
  } else {
    parts.push('- Pages requested: Home only');
  }
  if (wizardData.extras) {
    parts.push(`- Additional notes: ${wizardData.extras}`);
  }
  return parts.join('\n');
}

const ANTI_PATTERNS = `
COPY ANTI-PATTERNS — these are forbidden. Every block's copy MUST reference the user's actual business or niche.
- ❌ "Welcome to our site" / "Welcome to our website" — banned. Hero titles must reference the actual business.
- ❌ "We're glad you're here" — banned.
- ❌ "Get Started" with no context — banned. Buttons say what happens (e.g. "Book a strategy call", "View the menu", "Read the latest").
- ❌ "Our services" / "Explore what we offer" / "Learn more" — banned as standalone phrases.
- ❌ Empty title/subtitle/description fields — every block field that exists in the schema must have content tailored to the brand.
- ❌ Generic Lorem-ipsum-style filler — write specific, plausible copy using the brief.
`;

const CONTENT_DEPTH_RULES = `
CONTENT DEPTH — a thin site reads as unfinished. Treat these as minimums, not targets to undercut:
- servicesGrid: 4-6 items. Each description is 1-2 full sentences naming the concrete work, not a fragment ("Drain cleaning for slow or clogged kitchen, bath, and main lines — cleared the same day." not "Drain cleaning services").
- featuresList: 4-6 items, each a specific differentiator (years, response time, guarantees, materials, certifications), not generic adjectives.
- faq: 5-8 questions a real customer would actually ask this specific business (pricing, timing, service area, process, policies). Answers are 2-3 sentences.
- testimonials: 3-5 quotes with first-name + role/context, each mentioning a specific job, dish, project, or result.
- stats: 3-4 numbers tied to the niche (years in business, projects completed, clients served, response time).
- pricing: 3 tiers (unless the brief says otherwise), each with a description and 4-6 features. Mark exactly one tier highlighted.
- timeline: 4-6 entries with believable dates and 1-2 sentence descriptions.
- team: 3-4 members with role-appropriate one-sentence bios when the brief doesn't name real people.
- carousel: 4-6 items with a title and 1-2 sentences each.
- Subtitles: when a block schema has a subtitle field, write one real sentence — do not omit or echo the title.
- Hero: subtitle is 1-2 full sentences that say what the business does, for whom, and where (when location is known).
`;

/**
 * Phase A — Plan call.
 *
 * Tiny system prompt. The model picks the palette, fonts, header, site title,
 * and a one-line brief per page. No block content yet. Template is locked to
 * the AI-only blank baseline so public template demo content never leaks into
 * generated onboarding sites.
 */
export function buildPlanSystemPrompt(wizardData: WizardData, availablePalettes: string[], seed: CreativeSeed, architecture?: SiteArchitecture): string {
  return `You are the planning step of a website-building AI. Your ONLY job is to choose a palette, fonts, header layout, site title, and brand voice. The deterministic architecture layer has already chosen pages and blocks.

${renderWizardBrief(wizardData)}

${architecture ? renderArchitectureForAi(architecture) : ''}

${renderCreativeSeed(seed)}

${renderTemplateStyleProfilesForAi({
    styleIds: wizardData.styleIds,
    styleLabels: wizardData.styleLabels,
    description: wizardData.description,
  })}

AI ONBOARDING TEMPLATE:
- The templateId MUST be "${AI_ONBOARDING_TEMPLATE_ID}".
- Do NOT choose public template IDs such as "atlas", "craft", "menu", "proof", or "gallery" for onboarding.
- Public templates are user-selectable gallery templates. This flow starts from a blank Custom baseline and uses block choices, copy, palette, fonts, header settings, and supported builder settings to create the design.
- Treat the user's style choices as design direction, not as permission to switch templates.
- Pick 1-2 styleProfileIds that fit the brief from this exact list: ${TEMPLATE_STYLE_PROFILE_IDS.join(', ')}.
- Then describe the result in designBrief. Do not include template demo content in designBrief.

AVAILABLE COLOR PALETTES for the Custom baseline: ${availablePalettes.length > 0 ? availablePalettes.join(', ') : '(use custom colors if needed)'}

SITE TITLE RULES:
- If the user's description names a brand (e.g. "The Daily Bugle", "Marlow Made"), USE THAT NAME.
- Otherwise infer a short brand-appropriate name from the description (e.g. "a plumber in Buffalo" → "North Buffalo Plumbing"). Do NOT use generic placeholder titles like "My Website".

HEADER CONFIG:
${HEADER_CONFIG_OPERATION_TEXT}
Use the expanded header fields to make the navigation feel designed, not generic.

PAGE AND BLOCK ARCHITECTURE:
- Do NOT choose pages.
- Do NOT choose block types.
- The deterministic architecture above is final. Your response may echo its pages/briefs, but the server will ignore any attempt to add, remove, rename, or substitute pages/blocks.
- Pages are made from blocks. Blocks are not pages.

RESPONSE FORMAT — output ONLY raw JSON, no markdown fences, no prose. Shape:
{
  "siteTitle": "<short brand name>",
  "templateId": "${AI_ONBOARDING_TEMPLATE_ID}",
  "paletteName": "<one of the available palette names, or omit if using custom colors>",
  "customColors": { "primary": "#hex", "secondary": "#hex", "accent": "#hex" },  // OPTIONAL — omit unless you really want a custom palette
  "headerConfig": { "bgType": "white", "logoPosition": "left", "navPosition": "right", "desktopMenuStyle": "inline", "rightElement": "cta", "sticky": "always", "bannerEnabled": false, "bannerText": "" },
  "fonts": { "heading": "<google font>", "body": "<google font>" },
  "voice": "<one sentence describing the brand voice / tone>",
  "styleProfileIds": ["<one or two ids from the style profile list>"],
  "designBrief": "<one sentence naming the style direction and the user-editable settings that should carry it>",
  "homeBrief": "<one sentence summarizing the already-approved Home architecture>",
  "pages": [
    { "slug": "<approved slug only>", "title": "<approved title>", "displayName": "<approved nav label>", "brief": "<approved brief>" }
  ]
}`;
}

/**
 * Phase B — Home build call.
 *
 * Given the plan from Phase A, produce 5-8 fully populated home blocks. The
 * call only emits one operation, so no operations list — just `{ blocks }`.
 */
export function buildHomeSystemPrompt(plan: SitePlan, wizardData: WizardData, seed: CreativeSeed): string {
  return `You are the home-page step of a website-building AI. Your ONLY job is to produce fully populated content for the approved Home blocks.

${renderWizardBrief(wizardData)}

PLAN ALREADY DECIDED (use it — do NOT change template, palette, title, or fonts):
- Site title: ${plan.siteTitle}
- Template: ${plan.templateId}
- Palette: ${plan.paletteName ?? '(default)'}
- Fonts: heading="${plan.fonts?.heading ?? '(default)'}", body="${plan.fonts?.body ?? '(default)'}"
- Voice: ${plan.voice}
- Style profile: ${plan.styleProfileIds?.join(', ') || '(none specified)'}
- Design brief: ${plan.designBrief ?? 'Use the selected style direction through user-editable block settings, header, palette, and fonts.'}
- Home brief: ${plan.homeBrief}
- Other pages this site has (you can link to them via buttonTextLink:{linkType:"page",pageSlug:"<slug>"}): ${plan.pages.map((p) => p.slug).join(', ') || 'none'}

${plan.homeArchitecture ? renderPageArchitectureForAi(plan.homeArchitecture) : ''}

${renderCreativeSeed(seed)}

${ANTI_PATTERNS}

${CONTENT_DEPTH_RULES}

RULES:
- Produce exactly the approved Home blocks above, in that order. Do not add, remove, rename, or substitute block types.
- Use the full block capabilities below. For Hero, prefer card-based data. For Menu, use menuTitle/menuSubtitle and visible menu design settings. For product/gallery/blog/admin-backed blocks, configure visible layout and display settings instead of leaving template defaults untouched.
- Do not invent hidden data fields. The server drops any block data key that is not listed in that block's capabilities.
- Do not create product, menu item, or booking service records in block data. Initial onboarding sample products, menu items, and booking services are seeded separately into the same admin-editable managers users already use.
- Use safe palette backgrounds: regular content blocks use backgroundColor:"palette:accent" or omit backgroundColor; CTA can use "palette:secondary"; banner stats can use "palette:primary". Do not use raw hex section backgrounds.
- Open with a hero. Title MUST reference ${plan.siteTitle} or its niche specifically — never "Welcome to our site".
- Do not output custom CSS. Give the site a visual fingerprint through supported builder settings, block variants, palette choices, fonts, header settings, image choices, menu settings, and button settings.
- Buttons that should link to other pages on this site MUST set buttonTextLink:{ linkType:"page", pageSlug:"<slug>" }. The system resolves slugs to page IDs after pages are created.
- Do NOT include image URLs in AI output. To request prompt-aware sample media, use the visible image-capable settings from the block schema and leave URL/value fields empty. The system can fill editable sample media after your block plan.

${BLOCK_SCHEMAS}

RESPONSE FORMAT — output ONLY raw JSON, no markdown fences, no prose. Shape:
{ "blocks": [ { "blockType": "hero", "data": { ... } }, { "blockType": "...", "data": { ... } } ] }`;
}

/**
 * Phase C — Per-page build call. One call per page, run in parallel.
 *
 * Tiny scope: a single page's blocks. The model has plenty of attention
 * budget to write actually tailored copy.
 */
export function buildPageSystemPrompt(plan: SitePlan, page: { slug: string; title: string; brief: string }, wizardData: WizardData, seed: CreativeSeed): string {
  return `You are the page-build step of a website-building AI. Your ONLY job is to produce fully populated content for the approved blocks on ONE specific page.

${renderWizardBrief(wizardData)}

SITE CONTEXT (do NOT change these — they are already set):
- Site title: ${plan.siteTitle}
- Template: ${plan.templateId}
- Voice: ${plan.voice}
- Style profile: ${plan.styleProfileIds?.join(', ') || '(none specified)'}
- Design brief: ${plan.designBrief ?? 'Use the selected style direction through user-editable block settings, header, palette, and fonts.'}
- Other pages on this site (you can link to them with buttonTextLink:{linkType:"page",pageSlug:"<slug>"}): ${[...plan.pages.map((p) => p.slug), 'home'].filter((s) => s !== page.slug).join(', ')}

THIS PAGE:
- Slug: ${page.slug}
- Title: ${page.title}
- Brief: ${page.brief}

${renderPageArchitectureForAi(page as ArchitecturePage)}

${renderCreativeSeed(seed)}

${ANTI_PATTERNS}

${CONTENT_DEPTH_RULES}

RULES:
- Produce exactly the approved blocks for this page, in that order. Do not add, remove, rename, or substitute block types.
- Use the full block capabilities below instead of relying on template defaults. No requested page should be blank or placeholder-only.
- Use safe palette backgrounds: regular content blocks use backgroundColor:"palette:accent" or omit backgroundColor; CTA can use "palette:secondary"; banner stats can use "palette:primary". Do not use raw hex section backgrounds.
- Every block must have copy that fits ${plan.siteTitle} — no generic placeholders.
- For a contact page, use the exact approved contact blocks. Do not add a second form when the page already has contact_form or estimateForm.
- For a shop/store page, include productGrid and configure its visible layout/filter settings. Initial sample products may be seeded separately.
- For a booking page, include the booking block. Initial sample services may be seeded separately.
- For a gallery/portfolio page, include the gallery block and configure visible gallery settings. Initial sample gallery images may be added separately.
- Do NOT include image URLs. To request prompt-aware sample media, use visible image-capable settings and leave URL/value fields empty.
- For a blog/articles page, include the blog block.
- Do not output custom CSS. Use only supported block settings and content fields.
- Buttons that should link to other pages MUST use buttonTextLink:{ linkType:"page", pageSlug:"<slug>" }.

${BLOCK_SCHEMAS}

RESPONSE FORMAT — output ONLY raw JSON, no markdown fences, no prose. Shape:
{ "blocks": [ { "blockType": "...", "data": { ... } } ] }`;
}
