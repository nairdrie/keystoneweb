import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);

async function main() {
  try {
    console.log('[ops scraper] preparing Vercel chromium archive');

    const binDir = join(projectRoot, 'node_modules', '@sparticuz', 'chromium', 'bin');

    if (!existsSync(binDir)) {
      console.log('[ops scraper] chromium bin directory not found, skipping archive creation');
      return;
    }

    const publicDir = join(projectRoot, 'public');
    const outputPath = join(publicDir, 'chromium-pack.tar');
    mkdirSync(publicDir, { recursive: true });

    const tarResult = spawnSync('tar', ['-cf', outputPath, '-C', binDir, '.'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    if (tarResult.status !== 0) {
      throw new Error(`tar exited with code ${tarResult.status ?? 'unknown'}`);
    }

    console.log(`[ops scraper] chromium archive ready at ${outputPath}`);
  } catch (error) {
    console.error('[ops scraper] failed to prepare chromium archive:', error instanceof Error ? error.message : error);
    console.log('[ops scraper] continuing without build-time chromium archive');
    process.exit(0);
  }
}

main();
