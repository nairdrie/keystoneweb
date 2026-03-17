import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

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
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ post: data });
    }

    const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, title, excerpt, content, cover_image, author, tags, is_published } = body;

    if (!siteId || !title) {
        return NextResponse.json({ error: 'Missing siteId or title' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate unique slug
    let baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
        return NextResponse.json({ error: 'Missing post id' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    const allowedFields = ['title', 'excerpt', 'content', 'cover_image', 'author', 'tags', 'is_published', 'sort_order'];

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
        const { data: current } = await supabase.from('blog_posts').select('published_at').eq('id', id).single();
        if (current && !current.published_at) {
            updates.published_at = new Date().toISOString();
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

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', postId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
