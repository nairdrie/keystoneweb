import fs from 'node:fs';
import path from 'node:path';

const smokeUrl = process.env.CARD_PRESET_SMOKE_URL || 'http://127.0.0.1:3000/card-preset-edit-smoke';
const failIfMissing = process.env.CI === 'true' || process.env.REQUIRE_PLAYWRIGHT === 'true';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const message = 'Playwright is not installed. Install playwright or run with REQUIRE_PLAYWRIGHT=true in CI to enforce this smoke test.';
  if (failIfMissing) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`${message} Skipping card preset edit-mode visual smoke.`);
  process.exit(0);
}

const browser = await chromium.launch();
const failures = [];
const screenshotDir = path.join(process.cwd(), '.tmp', 'card-preset-smoke');
fs.mkdirSync(screenshotDir, { recursive: true });

try {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1200 },
    { name: 'mobile', width: 390, height: 1100 },
  ]) {
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(smokeUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('[data-card-preset-edit-smoke="ready"]', { timeout: 15000 });
      await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}.png`), fullPage: true });

      const viewportFailures = await page.evaluate(() => {
        const failures = [];
        const blocks = Array.from(document.querySelectorAll('.ks-block[data-tour="builder-section"]'));
        for (const block of blocks) {
          const wrapperRect = block.getBoundingClientRect();
          const dataRoot = block.querySelector(':scope > [data-block-id]');
          const contentRect = dataRoot?.getBoundingClientRect();
          const type = block.getAttribute('class')?.match(/ks-block-([^\s]+)/)?.[1] || 'unknown';
          const id = dataRoot?.getAttribute('data-block-id') || type;

          if (!contentRect) {
            failures.push(`${id}: missing data-block content root`);
            continue;
          }

          if (contentRect.top < wrapperRect.top - 2) {
            failures.push(`${id}: content starts above edit wrapper by ${Math.round(wrapperRect.top - contentRect.top)}px`);
          }
          if (contentRect.left < wrapperRect.left - 2) {
            failures.push(`${id}: content starts left of edit wrapper by ${Math.round(wrapperRect.left - contentRect.left)}px`);
          }
          if (contentRect.right > wrapperRect.right + 2) {
            failures.push(`${id}: content extends right of edit wrapper by ${Math.round(contentRect.right - wrapperRect.right)}px`);
          }

          const overflowingDescendant = Array.from(dataRoot.querySelectorAll('*')).find((node) => {
            const rect = node.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            if (node.closest('[role="dialog"], [data-tour="add-block-menu"]')) return false;
            return rect.top < wrapperRect.top - 4 || rect.left < wrapperRect.left - 4 || rect.right > wrapperRect.right + 4;
          });

          if (overflowingDescendant) {
            const rect = overflowingDescendant.getBoundingClientRect();
            failures.push(`${id}: descendant overflows edit wrapper (${Math.round(rect.left)}, ${Math.round(rect.top)}, ${Math.round(rect.right)}, ${Math.round(rect.bottom)})`);
          }
        }

        if (blocks.length < 8) {
          failures.push(`Expected at least 8 edit-mode smoke blocks, found ${blocks.length}`);
        }

        return failures;
      });

      failures.push(...viewportFailures.map((failure) => `${viewport.name}: ${failure}`));
    } catch (error) {
      failures.push(`${viewport.name}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Card preset edit-mode visual smoke passed for ${smokeUrl}`);
