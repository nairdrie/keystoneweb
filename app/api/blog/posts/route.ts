import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { scanText } from '@/lib/moderation/text-scan';
import { handleModerationResult } from '@/lib/moderation/report';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

/**
 * GET /api/blog/posts?siteId=...          — List all posts for a site
 * GET /api/blog/posts?siteId=...&id=...   — Get single post by id
 * POST /api/blog/posts                    — Create post (owner)
 * PUT /api/blog/posts                     — Update post (owner)
 * DELETE /api/blog/posts?id=...           — Delete post (owner)
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    const postId = request.nextUrl.searchParams.get('id');
    const slug = request.nextUrl.searchParams.get('slug');

    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    if (postId) {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('id', postId)
            .eq('site_id', siteId)
            .eq('is_archived', false)
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ post: data });
    }

    if (slug) {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('slug', slug)
            .eq('site_id', siteId)
            .eq('is_archived', false)
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ post: data });
    }

    const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_archived', false)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { siteId, title, excerpt, content, cover_image, author, tags, is_published, is_featured } = body;

    if (!siteId || !title) {
        return NextResponse.json({ error: 'Missing siteId or title' }, { status: 400 });
    }

    let access;
    try {
        access = await requireSiteAccess(siteId, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase, targetUserId } = access;

    // Scan post text for illegal content before storing
    const textToScan = [title, excerpt, content].filter(Boolean).join('\n\n');
    const textScanResult = await scanText(textToScan);
    if (textScanResult.flagged) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? request.headers.get('x-real-ip')
            ?? null;
        await handleModerationResult(
            { ...textScanResult, severity: 'review' as const },
            {
                siteId:      siteId,
                userId:      targetUserId,
                ipAddress:   ip,
                contentType: 'text',
                contentRef:  null,
                contentHash: null,
            }
        );
        return NextResponse.json({ error: 'Content policy violation' }, { status: 422 });
    }

    // Generate unique slug
    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let attempt = 0;
    while (true) {
        const { data: existing } = await supabase
            .from('blog_posts')
            .select('id')
            .eq('site_id', siteId)
            .eq('slug', slug)
            .maybeSingle();
        if (!existing) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
    }

    // Get next sort_order
    const { data: existing } = await supabase
        .from('blog_posts')
        .select('sort_order')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: false })
        .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    if (is_featured === true) {
        const { error: featuredError } = await supabase
            .from('blog_posts')
            .update({ is_featured: false })
            .eq('site_id', siteId);

        if (featuredError) {
            return NextResponse.json({ error: featuredError.message }, { status: 500 });
        }
    }

    const { data, error } = await supabase
        .from('blog_posts')
        .insert({
            site_id: siteId,
            title,
            slug,
            excerpt: excerpt || null,
            content: content || null,
            cover_image: cover_image || null,
            author: author || null,
            tags: tags || [],
            is_published: is_published ?? false,
            is_featured: is_featured === true,
            published_at: is_published ? new Date().toISOString() : null,
            sort_order: nextOrder,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ post: data });
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
        return NextResponse.json({ error: 'Missing post id' }, { status: 400 });
    }

    const adminLookup = createAdminClient();
    const { data: current, error: currentError } = await adminLookup
        .from('blog_posts')
        .select('site_id, published_at')
        .eq('id', id)
        .single();

    if (currentError || !current) {
        return NextResponse.json({ error: currentError?.message || 'Post not found' }, { status: 404 });
    }

    let access;
    try {
        access = await requireSiteAccess(current.site_id, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const allowedFields = ['title', 'excerpt', 'content', 'cover_image', 'author', 'tags', 'is_published', 'is_featured', 'sort_order'];

    for (const key of allowedFields) {
        if (fields[key] !== undefined) updates[key] = fields[key];
    }

    // Regenerate slug if title changed
    if (fields.title) {
        updates.slug = fields.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    // Set published_at when first publishing
    if (fields.is_published === true) {
        // Only set published_at if not already set
        if (current && !current.published_at) {
            updates.published_at = new Date().toISOString();
        }
    }

    if (fields.is_featured === true) {
        const { error: featuredError } = await supabase
            .from('blog_posts')
            .update({ is_featured: false })
            .eq('site_id', current.site_id)
            .neq('id', id);

        if (featuredError) {
            return NextResponse.json({ error: featuredError.message }, { status: 500 });
        }
    }

    const { data, error } = await supabase
        .from('blog_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ post: data });
}

export async function DELETE(request: NextRequest) {
    const postId = request.nextUrl.searchParams.get('id');
    if (!postId) {
        return NextResponse.json({ error: 'Missing post id' }, { status: 400 });
    }

    const adminLookup = createAdminClient();
    const { data: post } = await adminLookup.from('blog_posts').select('site_id').eq('id', postId).single();
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let access;
    try {
        access = await requireSiteAccess(post.site_id, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const { error } = await supabase
        .from('blog_posts')
        .update({ is_archived: true, archived_on: new Date().toISOString() })
        .eq('id', postId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
