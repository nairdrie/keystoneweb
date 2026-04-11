import { runProductScraper } from './products';
import { runServicesScraper } from './services';
import { runContentScraper } from './content';
import type { ContentNormalizationModel, ScraperMode, ScraperPreset } from './types';

export async function runOpsScraper(
  url: string,
  preset: ScraperPreset,
  options?: { mode?: ScraperMode; includeBlog?: boolean; llmModel?: ContentNormalizationModel; aiOnly?: boolean }
) {
  if (preset === 'products') {
    return runProductScraper(url);
  }

  if (preset === 'services') {
    return runServicesScraper(url);
  }

  if (preset === 'content') {
    return runContentScraper(url, options);
  }

  throw new Error('This scraper preset is coming soon.');
}
