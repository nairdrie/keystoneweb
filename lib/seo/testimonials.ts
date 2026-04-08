/**
 * Extract testimonial items from published page data blocks.
 * Scans for 'testimonials' block types and collects their items.
 */
export function extractTestimonials(
  publishedData: Record<string, any>,
): { name?: string; quote?: string; rating?: number }[] {
  const blocks = publishedData?.blocks || [];
  const items: { name?: string; quote?: string; rating?: number }[] = [];

  for (const block of blocks) {
    if (block.type === 'testimonials' && Array.isArray(block.data?.items)) {
      for (const item of block.data.items) {
        items.push({
          name: item.name,
          quote: item.quote,
          rating: item.rating ?? 5,
        });
      }
    }
  }

  return items;
}
