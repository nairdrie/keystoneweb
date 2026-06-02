import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const WIDTH = 1440;
const HEIGHT = 810;

const DEFAULT_TEMPLATE_IDS = [
  'atlas',
  'editorial',
  'booked',
  'menu',
  'craft',
  'retro',
  'proof',
  'gallery',
  'builder',
  'commerce',
  'foundation',
  'wellness',
  'estate',
  'studio',
  'learn',
  'occasion',
];

const TEMPLATE_PREVIEWS = {
  atlas: {
    name: 'Utility',
    tagline: 'Compact. Structured. Data-ready.',
    body: 'Dense stats, service grids, and repeatable process sections.',
    accent: '#2f6f73',
    background: '#f4f8f7',
    ink: '#163235',
    preset: 'utility',
  },
  editorial: {
    name: 'Editorial Rule',
    tagline: 'Rule-led. Authoritative. Paper-like.',
    body: 'Publication-style blocks with strong rules and authored sections.',
    accent: '#b91c1c',
    background: '#faf7f1',
    ink: '#2b211d',
    preset: 'editorial',
  },
  booked: {
    name: 'Raised',
    tagline: 'Elevated. Soft. Appointment-ready.',
    body: 'Premium cards, soft depth, and clear booking paths.',
    accent: '#0f9f8f',
    background: '#f1fbf8',
    ink: '#123b37',
    preset: 'elevated',
  },
  menu: {
    name: 'Poster',
    tagline: 'Image-led. Edge-to-edge. Direct.',
    body: 'Visual feature cards for menus, galleries, and highlights.',
    accent: '#d97706',
    background: '#fff7ed',
    ink: '#3a2408',
    preset: 'poster',
  },
  craft: {
    name: 'Showcase',
    tagline: 'Media-forward. Warm. Story-rich.',
    body: 'Framed media, maker proof, and spacious product storytelling.',
    accent: '#c46a3a',
    background: '#fff8f2',
    ink: '#3b251c',
    preset: 'splitMedia',
  },
  retro: {
    name: 'Retro',
    tagline: 'Throwback. Punchy. Shadowed.',
    body: 'Bold borders, hard color shadows, and loud calls to action.',
    accent: '#ff4fd8',
    background: '#fff5fd',
    ink: '#26112a',
    preset: 'offset',
  },
  proof: {
    name: 'Ledger',
    tagline: 'Documented. Trust-heavy. Rail-led.',
    body: 'Document-like proof cards, testimonials, and intake flows.',
    accent: '#15803d',
    background: '#f5fbf6',
    ink: '#17351f',
    preset: 'slab',
  },
  gallery: {
    name: 'Clipped',
    tagline: 'Angular. Visual. Portfolio-ready.',
    body: 'Clipped corners, image-led project cards, and minimal chrome.',
    accent: '#111111',
    background: '#f6f6f5',
    ink: '#121212',
    preset: 'clipped',
  },
  builder: {
    name: 'Bordered',
    tagline: 'Crisp. Practical. Service-ready.',
    body: 'Structured borders, estimate paths, stats, and proof blocks.',
    accent: '#f59e0b',
    background: '#fff9eb',
    ink: '#332511',
    preset: 'bordered',
  },
  commerce: {
    name: 'Gradient Wash',
    tagline: 'Color-washed. Product-led. Conversion-ready.',
    body: 'Gradient offer cards, product sections, and feature blocks.',
    accent: '#2563eb',
    background: '#f3f7ff',
    ink: '#15264a',
    preset: 'gradient',
  },
  foundation: {
    name: 'Inset',
    tagline: 'Pressed-in. Warm. Grounded.',
    body: 'Inset surfaces, community sections, and readable proof cards.',
    accent: '#0f766e',
    background: '#f3faf8',
    ink: '#173734',
    preset: 'inset',
  },
  wellness: {
    name: 'Soft',
    tagline: 'Pillowed. Gentle. Reassuring.',
    body: 'Relaxed service sections, care content, and calm testimonials.',
    accent: '#16a34a',
    background: '#f4fbf1',
    ink: '#19351f',
    preset: 'soft',
  },
  estate: {
    name: 'Luxe Hairline',
    tagline: 'Refined. Visual. Premium.',
    body: 'Fine rules, restrained depth, property cards, and gallery flow.',
    accent: '#a16207',
    background: '#f8f5ef',
    ink: '#2c251c',
    preset: 'luxe',
  },
  studio: {
    name: 'Outline',
    tagline: 'Dashed. Modular. Precise.',
    body: 'Dashed outlines, modular services, and clipped media.',
    accent: '#db2777',
    background: '#fff4f8',
    ink: '#301424',
    preset: 'outline',
  },
  learn: {
    name: 'Accent Rail',
    tagline: 'Guided. Compact. Learning-ready.',
    body: 'Accent rails for modules, pricing, resources, and next steps.',
    accent: '#2563eb',
    background: '#f4f7ff',
    ink: '#17264a',
    preset: 'accent',
  },
  occasion: {
    name: 'Playful',
    tagline: 'Chunky. Lifted. Celebratory.',
    body: 'Lively event cards, glow accents, and cheerful inquiry paths.',
    accent: '#ec4899',
    background: '#fff3f8',
    ink: '#351326',
    preset: 'playful',
  },
};

const args = process.argv.slice(2);
const templateIds = args.filter((arg) => !arg.startsWith('--'));
const idsToGenerate = templateIds.length > 0 ? templateIds : DEFAULT_TEMPLATE_IDS;
const outputDir = path.resolve(process.cwd(), 'public/templates');

mkdirSync(outputDir, { recursive: true });

for (const id of idsToGenerate) {
  const preview = TEMPLATE_PREVIEWS[id];

  if (!preview) {
    console.error(`Unknown template preview id: ${id}`);
    process.exit(1);
  }

  const outputPath = path.join(outputDir, `${id}.svg`);
  writeFileSync(outputPath, buildPreviewSvg(id, preview), 'utf8');
  console.log(`Generated public/templates/${id}.svg`);
}

function buildPreviewSvg(id, preview) {
  const accentSoft = mix(preview.accent, '#ffffff', 0.82);
  const accentPale = mix(preview.accent, '#ffffff', 0.92);
  const accentDark = mix(preview.accent, '#000000', 0.28);
  const grain = drawBackgroundPattern(id, preview);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeAttr(preview.name)} template preview">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${preview.background}" />
      <stop offset="0.52" stop-color="${accentPale}" />
      <stop offset="1" stop-color="${mix(preview.accent, '#ffffff', 0.72)}" />
    </linearGradient>
    <linearGradient id="wash-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${preview.accent}" stop-opacity="0.95" />
      <stop offset="0.55" stop-color="${mix(preview.accent, '#ffffff', 0.44)}" stop-opacity="0.92" />
      <stop offset="1" stop-color="${mix(preview.accent, '#111827', 0.18)}" stop-opacity="0.94" />
    </linearGradient>
    <filter id="shadow-${id}" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="${accentDark}" flood-opacity="0.2" />
    </filter>
    <filter id="lift-${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="10" dy="14" stdDeviation="0" flood-color="${mix(preview.accent, '#facc15', 0.35)}" flood-opacity="0.92" />
    </filter>
    <clipPath id="clip-main-${id}">
      <path d="M0 0 H430 V235 L394 280 H0 Z" />
    </clipPath>
    <clipPath id="clip-small-${id}">
      <path d="M0 0 H270 V122 L240 154 H0 Z" />
    </clipPath>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg-${id})" />
  ${grain}
  <rect x="60" y="48" width="1320" height="694" rx="34" fill="#ffffff" opacity="0.74" />
  <rect x="60" y="48" width="1320" height="694" rx="34" fill="none" stroke="${mix(preview.accent, '#ffffff', 0.55)}" stroke-width="1.5" />

  ${drawNav(preview, accentSoft, accentDark)}
  ${drawHeroCopy(preview, accentSoft, accentDark)}
  ${drawPreviewDeck(id, preview)}
  ${drawFooterStrip(preview, accentSoft, accentDark)}
</svg>`;
}

function drawNav(preview, accentSoft, accentDark) {
  return `
  <g>
    <rect x="100" y="78" width="1240" height="72" rx="20" fill="#ffffff" opacity="0.86" />
    <rect x="100" y="78" width="1240" height="72" rx="20" fill="none" stroke="${accentSoft}" stroke-width="1.4" />
    <rect x="128" y="97" width="34" height="34" rx="8" fill="${preview.accent}" />
    <rect x="136" y="105" width="18" height="18" rx="4" fill="#ffffff" opacity="0.9" />
    <text x="178" y="121" fill="${preview.ink}" font-size="22" font-weight="800" font-family="Inter, Arial, sans-serif">${escapeText(preview.name)}</text>
    ${drawPill(1000, 99, 96, 30, 'Style', accentSoft, accentDark)}
    ${drawPill(1110, 99, 94, 30, 'Blocks', '#ffffff', '#53606a')}
    <rect x="1218" y="94" width="92" height="40" rx="13" fill="${preview.ink}" />
    <text x="1244" y="120" fill="#ffffff" font-size="14" font-weight="800" font-family="Inter, Arial, sans-serif">Start</text>
  </g>`;
}

function drawHeroCopy(preview, accentSoft, accentDark) {
  return `
  <g>
    ${drawPill(112, 190, 154, 34, 'Preset style', accentSoft, accentDark)}
    <text x="112" y="279" fill="${preview.ink}" font-size="78" font-weight="900" letter-spacing="0" font-family="Inter, Arial, sans-serif">${escapeText(preview.name)}</text>
    <text x="116" y="326" fill="${accentDark}" font-size="26" font-weight="750" letter-spacing="0" font-family="Inter, Arial, sans-serif">${escapeText(preview.tagline)}</text>
    ${drawWrappedLine(preview.body, 116, 380, 24, '#475569')}
    <rect x="116" y="440" width="148" height="50" rx="15" fill="${preview.accent}" />
    <text x="148" y="471" fill="#ffffff" font-size="16" font-weight="850" font-family="Inter, Arial, sans-serif">Preview</text>
    <rect x="282" y="440" width="156" height="50" rx="15" fill="#ffffff" stroke="${accentSoft}" stroke-width="1.6" />
    <text x="316" y="471" fill="${preview.ink}" font-size="16" font-weight="800" font-family="Inter, Arial, sans-serif">Sections</text>
    <g transform="translate(116 550)">
      ${drawMetric(0, '16', 'blocks', preview)}
      ${drawMetric(142, '4', 'flows', preview)}
      ${drawMetric(284, '1', 'preset', preview)}
    </g>
  </g>`;
}

function drawPreviewDeck(id, preview) {
  const accentSoft = mix(preview.accent, '#ffffff', 0.82);
  const accentDark = mix(preview.accent, '#000000', 0.24);

  return `
  <g>
    <rect x="668" y="180" width="642" height="476" rx="30" fill="${mix(preview.accent, '#ffffff', 0.9)}" opacity="0.82" />
    <rect x="692" y="205" width="594" height="424" rx="24" fill="#ffffff" opacity="0.72" />
    <g transform="translate(724 232)">
      ${drawPresetCard(id, preview.preset, 0, 0, 430, 280, preview, 'Primary')}
    </g>
    <g transform="translate(1030 424)">
      ${drawPresetCard(id, preview.preset, 0, 0, 270, 154, preview, 'Detail')}
    </g>
    <g transform="translate(690 502)">
      ${drawMiniStack(preview, accentSoft, accentDark)}
    </g>
    <g transform="translate(1140 214)">
      <circle cx="0" cy="0" r="52" fill="${preview.accent}" opacity="0.1" />
      <circle cx="0" cy="0" r="22" fill="${preview.accent}" opacity="0.32" />
    </g>
  </g>`;
}

function drawFooterStrip(preview, accentSoft, accentDark) {
  return `
  <g>
    <rect x="100" y="678" width="1240" height="1.5" fill="${accentSoft}" />
    ${drawPill(112, 702, 138, 34, 'Responsive', '#ffffff', '#53606a')}
    ${drawPill(266, 702, 116, 34, 'Cards', '#ffffff', '#53606a')}
    ${drawPill(398, 702, 132, 34, 'Sections', '#ffffff', '#53606a')}
    <text x="1010" y="726" fill="${accentDark}" font-size="18" font-weight="800" font-family="Inter, Arial, sans-serif">Drawn preset preview</text>
    <rect x="1236" y="705" width="74" height="24" rx="12" fill="${preview.accent}" opacity="0.16" />
  </g>`;
}

function drawPresetCard(id, preset, x, y, w, h, preview, label) {
  const accent = preview.accent;
  const ink = preview.ink;
  const soft = mix(accent, '#ffffff', 0.84);
  const pale = mix(accent, '#ffffff', 0.92);
  const dark = mix(accent, '#000000', 0.26);
  const title = label === 'Primary' ? preview.name : label;

  switch (preset) {
    case 'utility':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="14" fill="#ffffff" stroke="${dark}" stroke-width="1.5" />
        <rect x="20" y="20" width="${w - 40}" height="50" rx="10" fill="${pale}" />
        <text x="38" y="52" fill="${ink}" font-size="20" font-weight="850" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        ${drawStatGrid(24, 94, w - 48, h - 118, preview, 3, 2)}
      </g>`;
    case 'editorial':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="6" fill="#fffdf8" stroke="${ink}" stroke-width="1.4" />
        <rect x="24" y="28" width="${w - 48}" height="4" fill="${accent}" />
        <text x="24" y="76" fill="${ink}" font-size="34" font-weight="700" font-family="Georgia, serif">${escapeText(title)}</text>
        <line x1="24" y1="102" x2="${w - 24}" y2="102" stroke="${ink}" stroke-width="1" />
        ${drawTextRows(24, 132, w - 80, 5, ink, 0.28)}
        <rect x="${w - 118}" y="${h - 66}" width="94" height="42" rx="0" fill="${accent}" />
      </g>`;
    case 'elevated':
      return `
      <g transform="translate(${x} ${y})" filter="url(#shadow-${id})">
        <rect width="${w}" height="${h}" rx="28" fill="#ffffff" />
        <rect x="22" y="22" width="${w - 44}" height="${h * 0.44}" rx="22" fill="${soft}" />
        <circle cx="${w - 70}" cy="62" r="20" fill="${accent}" opacity="0.8" />
        <text x="28" y="${h * 0.58}" fill="${ink}" font-size="30" font-weight="850" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        ${drawTextRows(30, h * 0.68, w - 80, 3, ink, 0.22)}
      </g>`;
    case 'poster':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="18" fill="${ink}" />
        <rect x="0" y="0" width="${w}" height="${h * 0.62}" rx="18" fill="url(#wash-${id})" />
        <rect x="0" y="${h * 0.49}" width="${w}" height="${h * 0.13}" fill="${accent}" opacity="0.58" />
        <text x="28" y="${h - 64}" fill="#ffffff" font-size="32" font-weight="900" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        <rect x="28" y="${h - 42}" width="120" height="16" rx="8" fill="#ffffff" opacity="0.4" />
      </g>`;
    case 'splitMedia':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="18" fill="#ffffff" stroke="${soft}" stroke-width="1.6" />
        <rect x="18" y="18" width="${Math.round(w * 0.43)}" height="${h - 36}" rx="14" fill="url(#wash-${id})" />
        <circle cx="${Math.round(w * 0.25)}" cy="${Math.round(h * 0.35)}" r="40" fill="#ffffff" opacity="0.26" />
        <text x="${Math.round(w * 0.5)}" y="70" fill="${ink}" font-size="28" font-weight="850" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        ${drawTextRows(Math.round(w * 0.5), 100, Math.round(w * 0.38), 5, ink, 0.24)}
        <rect x="${Math.round(w * 0.5)}" y="${h - 72}" width="128" height="38" rx="12" fill="${accent}" />
      </g>`;
    case 'offset':
      return `
      <g transform="translate(${x} ${y})" filter="url(#lift-${id})">
        <rect width="${w}" height="${h}" rx="8" fill="#fff8bf" stroke="${ink}" stroke-width="4" />
        <rect x="24" y="24" width="${w - 48}" height="58" rx="0" fill="${accent}" stroke="${ink}" stroke-width="3" />
        <text x="38" y="63" fill="#ffffff" font-size="28" font-weight="950" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        ${drawTextRows(30, 116, w - 70, 4, ink, 0.34)}
        <rect x="30" y="${h - 70}" width="132" height="38" rx="0" fill="#111111" />
        <text x="50" y="${h - 45}" fill="#ffffff" font-size="14" font-weight="900" font-family="Inter, Arial, sans-serif">RETRO</text>
      </g>`;
    case 'slab':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="16" fill="#fffdf5" stroke="${soft}" stroke-width="1.5" />
        <rect x="0" y="0" width="18" height="${h}" rx="8" fill="${accent}" />
        <rect x="38" y="26" width="${w - 70}" height="42" rx="8" fill="${pale}" />
        <text x="54" y="55" fill="${ink}" font-size="24" font-weight="850" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        ${drawLedgerRows(44, 98, w - 72, h - 130, preview)}
      </g>`;
    case 'solid':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="14" fill="${accent}" />
        <text x="24" y="54" fill="#ffffff" font-size="26" font-weight="850" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        ${drawTextRows(24, 82, w - 56, 3, '#ffffff', 0.42)}
      </g>`;
    case 'clipped':
      return `
      <g transform="translate(${x} ${y})">
        <g clip-path="url(#${w > 300 ? `clip-main-${id}` : `clip-small-${id}`})">
          <rect width="${w}" height="${h}" fill="#ffffff" />
          <rect width="${w}" height="${Math.round(h * 0.52)}" fill="url(#wash-${id})" />
          <rect x="28" y="${Math.round(h * 0.62)}" width="${w - 90}" height="12" fill="${ink}" opacity="0.92" />
          <rect x="28" y="${Math.round(h * 0.72)}" width="${w - 140}" height="10" fill="${ink}" opacity="0.28" />
        </g>
        <path d="M0 0 H${w} V${h - 45} L${w - 38} ${h} H0 Z" fill="none" stroke="${ink}" stroke-width="2" />
      </g>`;
    case 'bordered':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="10" fill="#ffffff" stroke="${ink}" stroke-width="2" />
        <line x1="0" y1="72" x2="${w}" y2="72" stroke="${ink}" stroke-width="2" />
        <line x1="${w * 0.6}" y1="72" x2="${w * 0.6}" y2="${h}" stroke="${ink}" stroke-width="2" />
        <text x="24" y="46" fill="${ink}" font-size="24" font-weight="900" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        <rect x="24" y="104" width="${Math.round(w * 0.48)}" height="${h - 132}" rx="8" fill="${soft}" />
        ${drawStatGrid(w * 0.65, 104, w * 0.25, h - 132, preview, 1, 3)}
      </g>`;
    case 'gradient':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="22" fill="url(#wash-${id})" />
        <rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="18" fill="#ffffff" opacity="0.18" />
        <text x="34" y="72" fill="#ffffff" font-size="32" font-weight="900" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        <rect x="34" y="${h - 88}" width="${w - 68}" height="48" rx="14" fill="#ffffff" opacity="0.9" />
        <rect x="54" y="${h - 70}" width="${w - 190}" height="12" rx="6" fill="${accent}" opacity="0.7" />
      </g>`;
    case 'inset':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="22" fill="${pale}" />
        <rect x="18" y="18" width="${w - 36}" height="${h - 36}" rx="18" fill="${mix(accent, '#000000', 0.06)}" opacity="0.12" />
        <rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="16" fill="#ffffff" opacity="0.72" />
        <text x="42" y="72" fill="${ink}" font-size="30" font-weight="850" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        ${drawTextRows(42, 104, w - 100, 4, ink, 0.25)}
      </g>`;
    case 'soft':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="34" fill="${pale}" />
        <rect x="26" y="26" width="${w - 52}" height="${h - 52}" rx="28" fill="#ffffff" opacity="0.82" />
        <text x="46" y="76" fill="${ink}" font-size="30" font-weight="850" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        <circle cx="${w - 76}" cy="70" r="28" fill="${accent}" opacity="0.22" />
        ${drawSoftPills(46, 112, w - 92, preview)}
      </g>`;
    case 'luxe':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="12" fill="#211c17" />
        <rect x="18" y="18" width="${w - 36}" height="${h - 36}" rx="8" fill="none" stroke="${mix(accent, '#ffffff', 0.35)}" stroke-width="1" />
        <rect x="34" y="34" width="${w - 68}" height="${Math.round(h * 0.48)}" rx="6" fill="url(#wash-${id})" opacity="0.78" />
        <text x="34" y="${h - 76}" fill="#f8f2e8" font-size="30" font-weight="750" font-family="Georgia, serif">${escapeText(title)}</text>
        <line x1="34" y1="${h - 52}" x2="${w - 34}" y2="${h - 52}" stroke="${mix(accent, '#ffffff', 0.4)}" stroke-width="1" />
      </g>`;
    case 'outline':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="18" fill="#ffffff" opacity="0.62" stroke="${ink}" stroke-width="2" stroke-dasharray="10 8" />
        <rect x="28" y="28" width="${w - 56}" height="70" rx="14" fill="${pale}" stroke="${accent}" stroke-width="2" stroke-dasharray="8 7" />
        <text x="44" y="73" fill="${ink}" font-size="28" font-weight="850" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        ${drawTextRows(34, 132, w - 96, 4, ink, 0.24)}
      </g>`;
    case 'accent':
      return `
      <g transform="translate(${x} ${y})">
        <rect width="${w}" height="${h}" rx="16" fill="#ffffff" stroke="${soft}" stroke-width="1.6" />
        <rect x="0" y="0" width="12" height="${h}" rx="6" fill="${accent}" />
        <text x="34" y="62" fill="${ink}" font-size="30" font-weight="850" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        ${drawModuleRows(34, 96, w - 64, h - 118, preview)}
      </g>`;
    case 'playful':
      return `
      <g transform="translate(${x} ${y})" filter="url(#lift-${id})">
        <rect width="${w}" height="${h}" rx="26" fill="${mix(accent, '#ffffff', 0.72)}" stroke="${ink}" stroke-width="3" />
        <circle cx="${w - 64}" cy="54" r="30" fill="#facc15" stroke="${ink}" stroke-width="3" />
        <rect x="28" y="30" width="${w - 110}" height="62" rx="20" fill="#ffffff" stroke="${ink}" stroke-width="3" />
        <text x="48" y="70" fill="${ink}" font-size="28" font-weight="950" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        <rect x="34" y="${h - 82}" width="142" height="42" rx="17" fill="${accent}" stroke="${ink}" stroke-width="3" />
      </g>`;
    case 'glow':
      return `
      <g transform="translate(${x} ${y})">
        <rect x="-10" y="-10" width="${w + 20}" height="${h + 20}" rx="32" fill="${accent}" opacity="0.18" />
        <rect width="${w}" height="${h}" rx="28" fill="#ffffff" stroke="${soft}" stroke-width="1.5" />
        <circle cx="${w - 56}" cy="50" r="42" fill="${accent}" opacity="0.2" />
        <text x="28" y="66" fill="${ink}" font-size="28" font-weight="900" font-family="Inter, Arial, sans-serif">${escapeText(title)}</text>
        ${drawTextRows(28, 96, w - 82, 3, ink, 0.24)}
      </g>`;
    default:
      return drawPresetCard(id, 'bordered', x, y, w, h, preview, label);
  }
}

function drawBackgroundPattern(id, preview) {
  const accentSoft = mix(preview.accent, '#ffffff', 0.7);

  if (preview.preset === 'editorial' || preview.preset === 'luxe') {
    return `
  <g opacity="0.28">
    ${Array.from({ length: 9 }, (_, index) => `<line x1="0" y1="${120 + index * 72}" x2="${WIDTH}" y2="${120 + index * 72}" stroke="${accentSoft}" stroke-width="1" />`).join('')}
  </g>`;
  }

  if (preview.preset === 'offset' || preview.preset === 'playful') {
    return `
  <g opacity="0.22">
    <circle cx="210" cy="156" r="68" fill="${preview.accent}" />
    <rect x="1160" y="106" width="116" height="116" rx="24" fill="#facc15" transform="rotate(8 1218 164)" />
    <rect x="104" y="612" width="126" height="38" rx="19" fill="${mix(preview.accent, '#ffffff', 0.45)}" transform="rotate(-6 167 631)" />
  </g>`;
  }

  return `
  <g opacity="0.24">
    <circle cx="1180" cy="140" r="132" fill="${accentSoft}" />
    <circle cx="160" cy="650" r="118" fill="${mix(preview.accent, '#ffffff', 0.78)}" />
    <path d="M1030 704 C1120 610 1248 628 1346 520" fill="none" stroke="${accentSoft}" stroke-width="18" stroke-linecap="round" />
  </g>`;
}

function drawMiniStack(preview, accentSoft, accentDark) {
  return `
  <g>
    <rect x="0" y="0" width="330" height="112" rx="18" fill="#ffffff" stroke="${accentSoft}" stroke-width="1.5" />
    <rect x="20" y="20" width="58" height="58" rx="14" fill="${preview.accent}" opacity="0.18" />
    <rect x="98" y="24" width="174" height="12" rx="6" fill="${accentDark}" opacity="0.52" />
    <rect x="98" y="52" width="218" height="10" rx="5" fill="${accentDark}" opacity="0.18" />
    <rect x="98" y="74" width="150" height="10" rx="5" fill="${accentDark}" opacity="0.14" />
    <rect x="20" y="132" width="214" height="52" rx="16" fill="${preview.accent}" opacity="0.14" />
    <rect x="254" y="132" width="116" height="52" rx="16" fill="#ffffff" stroke="${accentSoft}" stroke-width="1.5" />
  </g>`;
}

function drawMetric(x, value, label, preview) {
  return `
    <g transform="translate(${x} 0)">
      <text x="0" y="0" fill="${preview.ink}" font-size="40" font-weight="900" font-family="Inter, Arial, sans-serif">${escapeText(value)}</text>
      <text x="0" y="31" fill="${mix(preview.ink, '#ffffff', 0.32)}" font-size="15" font-weight="800" font-family="Inter, Arial, sans-serif">${escapeText(label)}</text>
    </g>`;
}

function drawPill(x, y, w, h, label, fill, color) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${mix(fill, '#000000', 0.08)}" stroke-width="1" />
    <text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" fill="${color}" font-size="13" font-weight="850" font-family="Inter, Arial, sans-serif">${escapeText(label)}</text>`;
}

function drawWrappedLine(text, x, y, size, color) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 48 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);

  return lines.slice(0, 2).map((line, index) =>
    `<text x="${x}" y="${y + index * (size + 9)}" fill="${color}" font-size="${size}" font-weight="600" font-family="Inter, Arial, sans-serif">${escapeText(line)}</text>`
  ).join('');
}

function drawTextRows(x, y, width, count, color, opacity) {
  return Array.from({ length: count }, (_, index) => {
    const rowWidth = Math.max(38, width - index * 24 - (index % 2) * 32);
    return `<rect x="${x}" y="${y + index * 24}" width="${rowWidth}" height="10" rx="5" fill="${color}" opacity="${opacity}" />`;
  }).join('');
}

function drawStatGrid(x, y, width, height, preview, columns, rows) {
  const gap = 12;
  const cellW = (width - gap * (columns - 1)) / columns;
  const cellH = (height - gap * (rows - 1)) / rows;
  const soft = mix(preview.accent, '#ffffff', 0.86);
  const dark = mix(preview.accent, '#000000', 0.2);

  return Array.from({ length: rows * columns }, (_, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const cx = x + col * (cellW + gap);
    const cy = y + row * (cellH + gap);
    return `
      <g>
        <rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" rx="12" fill="${soft}" />
        <rect x="${cx + 16}" y="${cy + 18}" width="${cellW * 0.42}" height="11" rx="5.5" fill="${dark}" opacity="0.46" />
        <rect x="${cx + 16}" y="${cy + 46}" width="${cellW * 0.68}" height="9" rx="4.5" fill="${dark}" opacity="0.18" />
      </g>`;
  }).join('');
}

function drawLedgerRows(x, y, width, height, preview) {
  const rows = 4;
  const rowH = height / rows;
  const soft = mix(preview.accent, '#ffffff', 0.84);

  return Array.from({ length: rows }, (_, index) => {
    const cy = y + index * rowH;
    return `
      <g>
        <line x1="${x}" y1="${cy}" x2="${x + width}" y2="${cy}" stroke="${soft}" stroke-width="1.5" />
        <circle cx="${x + 12}" cy="${cy + rowH / 2}" r="5" fill="${preview.accent}" opacity="0.72" />
        <rect x="${x + 34}" y="${cy + rowH / 2 - 6}" width="${width * (0.62 - index * 0.05)}" height="12" rx="6" fill="${preview.ink}" opacity="0.18" />
        <rect x="${x + width - 78}" y="${cy + rowH / 2 - 9}" width="58" height="18" rx="9" fill="${soft}" />
      </g>`;
  }).join('');
}

function drawModuleRows(x, y, width, height, preview) {
  const rows = 3;
  const gap = 14;
  const rowH = (height - gap * (rows - 1)) / rows;
  const soft = mix(preview.accent, '#ffffff', 0.86);

  return Array.from({ length: rows }, (_, index) => {
    const cy = y + index * (rowH + gap);
    return `
      <g>
        <rect x="${x}" y="${cy}" width="${width}" height="${rowH}" rx="14" fill="${soft}" />
        <rect x="${x + 18}" y="${cy + rowH / 2 - 14}" width="28" height="28" rx="9" fill="${preview.accent}" />
        <text x="${x + 27}" y="${cy + rowH / 2 + 6}" fill="#ffffff" font-size="15" font-weight="900" font-family="Inter, Arial, sans-serif">${index + 1}</text>
        <rect x="${x + 62}" y="${cy + rowH / 2 - 12}" width="${width * 0.48}" height="10" rx="5" fill="${preview.ink}" opacity="0.34" />
        <rect x="${x + 62}" y="${cy + rowH / 2 + 10}" width="${width * 0.32}" height="8" rx="4" fill="${preview.ink}" opacity="0.18" />
      </g>`;
  }).join('');
}

function drawSoftPills(x, y, width, preview) {
  const soft = mix(preview.accent, '#ffffff', 0.84);
  const labels = ['Care', 'Plan', 'Proof'];

  return labels.map((label, index) => {
    const pillX = x + index * ((width - 24) / 3);
    return `
      <g>
        <rect x="${pillX}" y="${y}" width="${(width - 34) / 3}" height="48" rx="24" fill="${soft}" />
        <text x="${pillX + 24}" y="${y + 30}" fill="${preview.ink}" font-size="15" font-weight="850" font-family="Inter, Arial, sans-serif">${label}</text>
      </g>`;
  }).join('');
}

function mix(hex, targetHex, amount) {
  const color = hexToRgb(hex);
  const target = hexToRgb(targetHex);

  return rgbToHex({
    r: Math.round(color.r + (target.r - color.r) * amount),
    g: Math.round(color.g + (target.g - color.g) * amount),
    b: Math.round(color.b + (target.b - color.b) * amount),
  });
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
