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

// ─── Search-URL image resolution ──────────────────────────────────────────────

const SEARCH_PAGE_TIMEOUT = 10_000;
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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
 * Is this URL a search-engine results page rather than a direct image? Those
 * can't be downloaded as an image, but the real image can often be recovered
 * from the results HTML. Host matching is exact (or subdomain) so a spoofed
 * host like `bing.com.attacker.example` is not treated as a search engine.
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

function decodeHtmlAndJson(s: string): string {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
        .replace(/\\u002f/gi, '/')
        .replace(/\\\//g, '/');
}

/**
 * Best-effort extraction of direct image URLs from a search-results page.
 * Returns an ordered, de-duplicated list of candidate direct image URLs
 * (empty on any failure — the caller degrades gracefully).
 */
export async function extractImageUrlsFromSearchPage(searchUrl: string): Promise<string[]> {
    const MAX_HTML_BYTES = 3 * 1024 * 1024;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_PAGE_TIMEOUT);
    try {
        const res = await fetch(searchUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
        });
        if (!res.ok) return [];

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) return [];

        // Bounded, streaming read: never materialize more than MAX_HTML_BYTES,
        // and keep the read under the abort timeout.
        let html = '';
        const reader = res.body?.getReader();
        if (reader) {
            const decoder = new TextDecoder();
            let received = 0;
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                received += value.length;
                html += decoder.decode(value, { stream: true });
                if (received >= MAX_HTML_BYTES) { try { await reader.cancel(); } catch { /* ignore */ } break; }
            }
            html += decoder.decode();
        } else {
            html = (await res.text()).slice(0, MAX_HTML_BYTES);
        }

        const candidates: string[] = [];
        const push = (raw: string) => {
            const decoded = decodeHtmlAndJson(raw);
            if (/^https?:\/\//i.test(decoded)) candidates.push(decoded);
        };

        // Bing embeds the true media URL as "murl" inside each result tile.
        for (const m of html.matchAll(/murl&quot;:&quot;(.*?)&quot;/gi)) push(m[1]);
        for (const m of html.matchAll(/"murl":"(.*?)"/gi)) push(m[1]);
        // Google / generic: imgurl or mediaurl query params on result anchors.
        for (const m of html.matchAll(/(?:imgurl|mediaurl)=([^"'&\s]+)/gi)) {
            try { push(decodeURIComponent(m[1])); } catch { /* skip */ }
        }

        // De-dup and keep only plausible image URLs.
        const seen = new Set<string>();
        const out: string[] = [];
        for (const c of candidates) {
            if (seen.has(c)) continue;
            seen.add(c);
            if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(c) || !isImageSearchUrl(c)) out.push(c);
            if (out.length >= 5) break;
        }
        return out;
    } catch {
        return [];
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Turn one raw image source into an ordered list of direct-image candidates.
 * Direct URLs pass through unchanged; search-engine URLs are resolved to the
 * real images found on their results page.
 */
export async function resolveImageCandidates(source: string): Promise<string[]> {
    if (isImageSearchUrl(source)) return extractImageUrlsFromSearchPage(source);
    return [source];
}

/**
 * Download + upload images from raw sources, resolving search-engine URLs to
 * real images first. For each source we attach the first candidate that
 * downloads successfully (so a search URL yields at most one image), stopping
 * once `maxImages` have been attached.
 */
export async function downloadAndUploadImagesSmart(
    sources: string[],
    siteId: string,
    userId: string,
    supabase: any,
    maxImages = 6,
): Promise<{ publicUrls: string[]; uploaded: number; failed: number; totalBytes: number }> {
    const publicUrls: string[] = [];
    let uploaded = 0;
    let failed = 0;
    let totalBytes = 0;

    for (const source of sources) {
        if (publicUrls.length >= maxImages) break;
        const candidates = await resolveImageCandidates(source);
        let attached = false;
        for (const candidate of candidates) {
            const r = await downloadAndUploadImage(candidate, siteId, userId, supabase);
            if (r) {
                publicUrls.push(r.publicUrl);
                uploaded++;
                totalBytes += r.sizeBytes;
                attached = true;
                break;
            }
        }
        if (!attached) failed++;
    }

    return { publicUrls, uploaded, failed, totalBytes };
}
