import { BlockData } from './editor-context';

export function getBlockSlug(block: BlockData, index: number, allBlocks: BlockData[]): string {
    const rawTitle = block.data?.title || block.data?.heading || block.type;
    let baseSlug = rawTitle
        .replace(/<[^>]*>?/gm, '') // Remove HTML tags
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    
    if (!baseSlug) baseSlug = `section-${index}`;

    // Deduplicate
    const previousSlugs = new Set<string>();
    for (let i = 0; i < index; i++) {
        const prevBlock = allBlocks[i];
        const prevTitle = prevBlock.data?.title || prevBlock.data?.heading || prevBlock.type;
        let prevBase = prevTitle
            .replace(/<[^>]*>?/gm, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
            
        if (!prevBase) prevBase = `section-${i}`;
        
        let counter = 1;
        let finalPrevSlug = prevBase;
        while (previousSlugs.has(finalPrevSlug)) {
             finalPrevSlug = `${prevBase}-${counter}`;
             counter++;
        }
        previousSlugs.add(finalPrevSlug);
    }
    
    let finalSlug = baseSlug;
    let counter = 1;
    while (previousSlugs.has(finalSlug)) {
         finalSlug = `${baseSlug}-${counter}`;
         counter++;
    }
    
    return finalSlug;
}
