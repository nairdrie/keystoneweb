import path from 'path';

interface BrowserLogger {
  info(event: string, details?: Record<string, unknown>): void;
  warn(event: string, details?: Record<string, unknown>): void;
}

interface BrowserPageLike {
  goto(url: string, options?: { waitUntil?: 'domcontentloaded' | 'networkidle0' | 'networkidle2'; timeout?: number }): Promise<unknown>;
  content(): Promise<string>;
  close(): Promise<void>;
}

interface BrowserLike {
  newPage(): Promise<BrowserPageLike>;
  close(): Promise<void>;
}

interface ChromiumModuleLike {
  args: string[];
  executablePath(source: string): Promise<string>;
}

interface PuppeteerLaunchOptions {
  headless?: boolean | 'shell';
  args?: string[];
  executablePath?: string;
}

interface PuppeteerModuleLike {
  launch(options?: PuppeteerLaunchOptions): Promise<BrowserLike>;
}

let cachedExecutablePath: string | null = null;
let executablePathPromise: Promise<string> | null = null;

function getChromiumPackSource() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/chromium-pack.tar`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/chromium-pack.tar`;
  }

  return path.join(process.cwd(), 'public', 'chromium-pack.tar');
}

async function getChromiumExecutablePath(logger: BrowserLogger) {
  if (cachedExecutablePath) return cachedExecutablePath;

  if (!executablePathPromise) {
    executablePathPromise = (async () => {
      const chromium = (await import('@sparticuz/chromium-min')).default as ChromiumModuleLike;
      const source = getChromiumPackSource();
      const resolved = await chromium.executablePath(source);
      logger.info('page.browser.chromium_ready', { source, executablePath: resolved });
      cachedExecutablePath = resolved;
      return resolved;
    })().catch((error) => {
      executablePathPromise = null;
      throw error;
    });
  }

  return executablePathPromise;
}

export async function renderUrlInBrowser(url: string, logger: BrowserLogger) {
  let browser: BrowserLike | null = null;
  let page: BrowserPageLike | null = null;

  try {
    let puppeteer: PuppeteerModuleLike;
    let launchOptions: PuppeteerLaunchOptions = { headless: true };

    if (process.env.VERCEL_ENV) {
      const chromium = (await import('@sparticuz/chromium-min')).default as ChromiumModuleLike;
      puppeteer = await import('puppeteer-core') as unknown as PuppeteerModuleLike;
      launchOptions = {
        headless: true,
        args: chromium.args,
        executablePath: await getChromiumExecutablePath(logger),
      };
    } else {
      try {
        puppeteer = await import('puppeteer') as unknown as PuppeteerModuleLike;
      } catch {
        logger.warn('page.browser_unavailable', { url, reason: 'puppeteer_not_installed_locally' });
        return null;
      }
    }

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const html = await page.content();

    return {
      url,
      html,
      contentType: 'text/html',
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
