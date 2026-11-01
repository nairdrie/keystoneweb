/**
 * Browser capture for agent previews: screenshots at real device sizes plus
 * the layout problems agents most often miss. No app imports, so the
 * standalone screenshot service (services/screenshot) can reuse it.
 */

export type ViewportName = 'desktop' | 'tablet' | 'mobile';

export const VIEWPORTS: Record<ViewportName, { width: number; height: number; isMobile?: boolean; hasTouch?: boolean }> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
};

export interface Diagnostics {
  pageHeight: number;
  /** px of horizontal overflow (0 = none) and the elements causing it */
  overflowX: number;
  overflowElements: string[];
  brokenImages: string[];
  /** visible-area text that is still opacity:0 / hidden after scrolling (stuck animations) */
  invisibleText: string[];
  /** links/buttons smaller than 32px on touch viewports */
  smallTapTargets: number;
  consoleErrors: string[];
}

export interface RawShot {
  viewport: ViewportName;
  width: number;
  png: Buffer;
  diagnostics: Diagnostics;
}

// Minimal structural types for the parts of Playwright we use.
interface PwPage {
  on(event: string, cb: (arg: any) => void): void; // eslint-disable-line @typescript-eslint/no-explicit-any
  goto(url: string, opts: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: (...args: any[]) => T | Promise<T>, arg?: unknown): Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
  waitForTimeout(ms: number): Promise<void>;
  screenshot(opts: Record<string, unknown>): Promise<Buffer>;
}
interface PwContext { newPage(): Promise<PwPage>; close(): Promise<void> }
interface PwBrowser { newContext(opts: Record<string, unknown>): Promise<PwContext>; close(): Promise<void> }
export interface PwChromium { launch(opts?: Record<string, unknown>): Promise<PwBrowser> }

const MAX_CAPTURE_HEIGHT = 9000;

export async function captureWithChromium(
  chromium: PwChromium,
  url: string,
  viewports: ViewportName[],
  fullPage: boolean,
): Promise<RawShot[]> {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const shots: RawShot[] = [];
    for (const name of viewports) {
      const vp = VIEWPORTS[name];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        isMobile: !!vp.isMobile,
        hasTouch: !!vp.hasTouch,
        reducedMotion: 'no-preference',
      });
      try {
        const page = await context.newPage();
        const consoleErrors: string[] = [];
        page.on('console', (msg: { type(): string; text(): string }) => {
          if (msg.type() === 'error' && consoleErrors.length < 20) consoleErrors.push(msg.text().slice(0, 300));
        });
        page.on('pageerror', (err: Error) => {
          if (consoleErrors.length < 20) consoleErrors.push(`Uncaught: ${String(err?.message || err).slice(0, 300)}`);
        });
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
        } catch {
          await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
        }
        // Scroll through the page so scroll-triggered reveals and lazy images run.
        await page.evaluate(async () => {
          const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 120));
          }
          window.scrollTo(0, 0);
          try { await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready; } catch { /* ignore */ }
        });
        await page.waitForTimeout(600);

        const diagnostics = await page.evaluate(({ touch, deviceWidth }: { touch: boolean; deviceWidth: number }) => {
          const describe = (el: Element) => {
            const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean)[0];
            const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
            return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''}>${text ? ` "${text}"` : ''}`;
          };
          // Measure against the device width: mobile browsers widen the layout
          // viewport to fit overflowing content, which would hide the problem.
          const w = deviceWidth;
          const overflowX = Math.max(0, document.documentElement.scrollWidth - w);
          const overflowElements: string[] = [];
          if (overflowX > 1) {
            for (const el of Array.from(document.querySelectorAll('body *'))) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.right > w + 1 && getComputedStyle(el).position !== 'fixed') {
                overflowElements.push(describe(el));
                if (overflowElements.length >= 6) break;
              }
            }
          }
          const brokenImages = Array.from(document.images)
            .filter((img) => img.currentSrc && img.complete && img.naturalWidth === 0)
            .map((img) => img.currentSrc)
            .slice(0, 10);
          const invisibleText = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,a,button,li,span'))
            .filter((el) => {
              if (!(el.textContent || '').trim() || el.closest('[hidden],[aria-hidden="true"]')) return false;
              const r = el.getBoundingClientRect();
              if (!r.height || !r.width) return false;
              let node: Element | null = el;
              while (node && node !== document.body) {
                const cs = getComputedStyle(node);
                if (cs.opacity === '0' || cs.visibility === 'hidden') return true;
                node = node.parentElement;
              }
              return false;
            })
            .slice(0, 8)
            .map(describe);
          const smallTapTargets = touch
            ? Array.from(document.querySelectorAll('a[href],button,[role="button"],input,select,textarea')).filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32);
              }).length
            : 0;
          return { pageHeight: document.documentElement.scrollHeight, overflowX, overflowElements, brokenImages, invisibleText, smallTapTargets };
        }, { touch: !!vp.hasTouch, deviceWidth: vp.width });

        // Very long pages are capped (agents get a "truncated" flag and can ask for a section).
        const capped = fullPage && diagnostics.pageHeight > MAX_CAPTURE_HEIGHT;
        const png = await page.screenshot(
          capped
            ? { type: 'png', clip: { x: 0, y: 0, width: vp.width, height: MAX_CAPTURE_HEIGHT }, fullPage: true }
            : { type: 'png', fullPage },
        );
        shots.push({ viewport: name, width: vp.width, png, diagnostics: { ...diagnostics, consoleErrors } });
      } finally {
        await context.close();
      }
    }
    return shots;
  } finally {
    await browser.close();
  }
}
