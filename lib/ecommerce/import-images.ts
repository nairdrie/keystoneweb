import sharp from 'sharp';

const IMAGE_DOWNLOAD_TIMEOUT = 15_000;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export async function downloadAndUploadImage(
    imageUrl: string,
    siteId: string,
    userId: string,
    supabase: any,
): Promise<{ publicUrl: string; sizeBytes: number } | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT);

        const res = await fetch(imageUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'KeystoneWeb/1.0 ProductImporter' },
        });
        clearTimeout(timeout);

        if (!res.ok) return null;

        const arrayBuffer = await res.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuffer);

        if (inputBuffer.length > MAX_IMAGE_SIZE) return null;
        if (inputBuffer.length === 0) return null;

        let finalBuffer: Buffer;
        let contentType: string;
        let ext: string;

        try {
            const image = sharp(inputBuffer);
            const metadata = await image.metadata();
            const isTransparent = metadata.format === 'png' || metadata.format === 'webp' || metadata.format === 'gif';

            if (isTransparent) {
                finalBuffer = await image
                    .resize({ width: 2000, withoutEnlargement: true })
                    .toBuffer();
                contentType = `image/${metadata.format}`;
                ext = metadata.format === 'png' ? 'png' : metadata.format === 'webp' ? 'webp' : 'gif';
            } else {
                finalBuffer = await image
                    .resize({ width: 2000, withoutEnlargement: true })
                    .jpeg({ quality: 85, mozjpeg: true })
                    .toBuffer();
                contentType = 'image/jpeg';
                ext = 'jpg';
            }
        } catch {
            return null;
        }

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).slice(2, 8);
        const safeName = extractFileName(imageUrl);
        const storagePath = `${siteId}/${timestamp}-${randomStr}-${safeName}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('site-assets')
            .upload(storagePath, finalBuffer, {
                contentType,
                cacheControl: '31536000',
                upsert: false,
            });

        if (uploadError) return null;

        const { data: { publicUrl } } = supabase.storage
            .from('site-assets')
            .getPublicUrl(uploadData.path);

        await supabase.from('site_media').upsert({
            site_id: siteId,
            user_id: userId,
            storage_path: uploadData.path,
            public_url: publicUrl,
            file_name: `${safeName}.${ext}`,
            media_type: 'image',
            mime_type: contentType,
            size_bytes: finalBuffer.length,
        }, { onConflict: 'storage_path', ignoreDuplicates: true });

        return { publicUrl, sizeBytes: finalBuffer.length };
    } catch {
        return null;
    }
}

function extractFileName(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const basename = pathname.split('/').pop() || 'product-image';
        return basename
            .replace(/\.[^/.]+$/, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .slice(0, 60) || 'product-image';
    } catch {
        return 'product-image';
    }
}

/**
 * Download a list of image URLs concurrently (batches of 3), uploading each to storage.
 * Returns the successfully uploaded public URLs plus aggregate stats.
 */
export async function downloadAndUploadImages(
    urls: string[],
    siteId: string,
    userId: string,
    supabase: any,
): Promise<{ publicUrls: string[]; uploaded: number; failed: number; totalBytes: number }> {
    const publicUrls: string[] = [];
    let uploaded = 0;
    let failed = 0;
    let totalBytes = 0;

    for (let batch = 0; batch < urls.length; batch += 3) {
        const batchUrls = urls.slice(batch, batch + 3);
        const results = await Promise.all(
            batchUrls.map(url => downloadAndUploadImage(url, siteId, userId, supabase))
        );
        for (const r of results) {
            if (r) {
                publicUrls.push(r.publicUrl);
                uploaded++;
                totalBytes += r.sizeBytes;
            } else {
                failed++;
            }
        }
    }

    return { publicUrls, uploaded, failed, totalBytes };
}

/**
 * Parse an image_urls CSV cell. Accepts pipe (|), comma, semicolon, or newline-separated URLs.
 * Returns absolute http(s) URLs only.
 *
 * Search-engine result URLs (e.g. a Bing image-search link) legitimately
 * contain their own commas/spaces inside the `q=` query, so we only split on
 * separators that appear *between* URLs — i.e. before an `http(s)://`.
 */
export function parseImageUrlsCell(val: string | undefined): string[] {
    if (!val || !val.trim()) return [];
    const trimmed = val.trim();
    // Split before each subsequent http(s):// so a single search URL that
    // contains commas/pipes in its query string stays intact.
    const parts = trimmed.split(/(?=https?:\/\/)/i);
    return parts
        .map(s => s.replace(/[\s|,;]+$/g, '').trim())
        .filter(s => /^https?:\/\//i.test(s));
}

// ─── Search-URL detection ─────────────────────────────────────────────────────

/** Exact host or a subdomain of it — not a substring (blocks bing.com.evil.tld). */
function hostMatches(host: string, base: string): boolean {
    return host === base || host.endsWith('.' + base);
}

/** google.<tld> or a subdomain of it, where the labels after "google" are TLDs. */
function isGoogleHost(host: string): boolean {
    const labels = host.split('.');
    const gi = labels.indexOf('google');
    if (gi === -1) return false;
    const tld = labels.slice(gi + 1);
    return tld.length > 0 && tld.every(l => l.length >= 2 && l.length <= 3);
}

/**
 * Is this URL a search-engine results page rather than a direct image? We never
 * download from these: a results page has no content-safety guarantee and the
 * "top" image can't be trusted to be the right (or an appropriate) product
 * image, so importing one onto a live storefront is unsafe. Host matching is
 * exact (or subdomain) so a spoofed host like `bing.com.attacker.example` isn't
 * treated as a search engine.
 */
export function isImageSearchUrl(url: string): boolean {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        const path = u.pathname.toLowerCase();
        if (hostMatches(host, 'bing.com') && path.includes('/images/')) return true;
        if (isGoogleHost(host) && (path.includes('/search') || path.includes('/imgres')) && (u.searchParams.get('tbm') === 'isch' || u.searchParams.has('imgurl') || path.includes('/imgres'))) return true;
        if (hostMatches(host, 'duckduckgo.com') && u.searchParams.get('iax') === 'images') return true;
        return false;
    } catch {
        return false;
    }
}

/**
 * Which of these raw image sources are safe to download? Only direct image
 * URLs — search-engine results pages are dropped, never scraped.
 */
export function directImageUrls(sources: string[]): string[] {
    return sources.filter(s => /^https?:\/\//i.test(s) && !isImageSearchUrl(s));
}

