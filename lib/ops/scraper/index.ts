import { runProductScraper } from './products';
import { runServicesScraper } from './services';
import type { ScraperPreset } from './types';

export async function runOpsScraper(url: string, preset: ScraperPreset) {
  if (preset === 'products') {
    return runProductScraper(url);
  }

  if (preset === 'services') {
    return runServicesScraper(url);
  }

  throw new Error('This scraper preset is coming soon.');
}
