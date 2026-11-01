/**
 * Screenshots of drafts for agents (MCP `screenshot` tool).
 *
 * Providers, in order:
 *   1. KS_SCREENSHOT_URL — the standalone service in services/screenshot
 *      (POST { url, viewports, fullPage }, Bearer KS_SCREENSHOT_TOKEN)
 *   2. Playwright installed on this server (local dev, self-hosted, staging)
 * Images are downscaled and re-encoded as JPEG so they stay cheap for agents.
 */
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { OpError } from './ops';
import { captureWithChromium, VIEWPORTS, type Diagnostics, type PwChromium, type ViewportName } from './screenshot-core';

export type { ViewportName } from './screenshot-core';

export interface Screenshot {
  viewport: ViewportName;
  mimeType: 'image/jpeg';
  data: string; // base64
  width: number;
  height: number;
  truncated: boolean;
  diagnostics: Diagnostics;
}

const OUTPUT_WIDTH: Record<ViewportName, number> = { desktop: 1200, tablet: 820, mobile: 390 };
const MAX_OUTPUT_HEIGHT = 6000;

interface RawResult { viewport: ViewportName; png: Buffer; diagnostics: Diagnostics }

async function viaService(url: string, viewports: ViewportName[], fullPage: boolean): Promise<RawResult[]> {
  const res = await fetch(process.env.KS_SCREENSHOT_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.KS_SCREENSHOT_TOKEN || ''}` },
    body: JSON.stringify({ url, viewports, fullPage }),
    signal: AbortSignal.timeout(110_000),
  });
  if (!res.ok) throw new OpError(`Screenshot service failed (HTTP ${res.status})`, 502);
  const body = (await res.json()) as { shots: Array<{ viewport: ViewportName; png: string; diagnostics: Diagnostics }> };
  return body.shots.map((s) => ({ viewport: s.viewport, png: Buffer.from(s.png, 'base64'), diagnostics: s.diagnostics }));
}

function localChromium(): PwChromium | null {
  try {
    // Resolved at runtime (not bundled): only present where Playwright is installed.
    const req = createRequire(`${process.cwd()}/package.json`);
    const moduleName = process.env.KS_PLAYWRIGHT_MODULE || 'playwright';
    return (req(moduleName) as { chromium: PwChromium }).chromium;
  } catch {
    return null;
  }
}

export function screenshotsAvailable(): boolean {
  return !!process.env.KS_SCREENSHOT_URL || !!localChromium();
}

export async function captureScreenshots(url: string, viewports: ViewportName[], fullPage: boolean): Promise<Screenshot[]> {
  const valid = viewports.filter((v): v is ViewportName => v in VIEWPORTS);
  if (!valid.length) throw new OpError('Choose at least one viewport: desktop, tablet or mobile');

  let raw: RawResult[];
  if (process.env.KS_SCREENSHOT_URL) {
    raw = await viaService(url, valid, fullPage);
  } else {
    const chromium = localChromium();
    if (!chromium) {
      throw new OpError('Screenshots are not configured on this server. Set KS_SCREENSHOT_URL to the screenshot service (services/screenshot), or install Playwright. Use the preview link meanwhile.', 501);
    }
    raw = await captureWithChromium(chromium, url, valid, fullPage);
  }

  return Promise.all(raw.map(async (shot) => {
    const width = OUTPUT_WIDTH[shot.viewport];
    const meta = await sharp(shot.png).metadata();
    const scale = meta.width ? Math.min(1, width / meta.width) : 1;
    const scaledHeight = Math.round((meta.height || 0) * scale);
    const truncated = scaledHeight > MAX_OUTPUT_HEIGHT || shot.diagnostics.pageHeight > (meta.height || 0) + 2;
    let img = sharp(shot.png).resize({ width: Math.round((meta.width || width) * scale) });
    if (scaledHeight > MAX_OUTPUT_HEIGHT) {
      img = sharp(await img.toBuffer()).extract({ left: 0, top: 0, width: Math.round((meta.width || width) * scale), height: MAX_OUTPUT_HEIGHT });
    }
    const out = await img.jpeg({ quality: 72, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    return {
      viewport: shot.viewport,
      mimeType: 'image/jpeg' as const,
      data: out.data.toString('base64'),
      width: out.info.width,
      height: out.info.height,
      truncated,
      diagnostics: shot.diagnostics,
    };
  }));
}
