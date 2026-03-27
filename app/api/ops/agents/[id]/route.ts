import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

function assertAdmin(userEmail: string | undefined) {
  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!userEmail || !adminEmails.includes(userEmail.toLowerCase())) {
    throw new Error('Forbidden');
  }
}

// GET /api/ops/agents/[id] — get agent details + usage stats
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    assertAdmin(user?.email);

    const db = createAdminClient();

    const { data: agent, error } = await db
      .from('users')
      .select('id, email, business_name, agent_contact_email, created_at, updated_at')
      .eq('id', id)
      .eq('is_agent', true)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Fetch their sites
    const { data: sites } = await db
      .from('sites')
      .select('id, site_slug, is_published, created_at')
      .eq('user_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Fetch contact submissions for their contact email
    const { count: contactCount } = await db
      .from('contact_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('sender_email', agent.agent_contact_email ?? '');

    // Fetch support threads addressed to their contact email
    const { count: supportCount } = await db
      .from('support_requests')
      .select('id', { count: 'exact', head: true })
      .is('thread_id', null)
      .eq('from_email', agent.agent_contact_email ?? '');

    return NextResponse.json({
      agent,
      sites: sites ?? [],
      stats: {
        site_count: (sites ?? []).length,
        contact_count: contactCount ?? 0,
        support_thread_count: supportCount ?? 0,
      },
    });
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[ops/agents/[id] GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/ops/agents/[id] — update agent (contact_email, deactivate, etc.)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    assertAdmin(user?.email);

    const body = await request.json();
    const allowed = ['agent_contact_email', 'is_agent', 'business_name'];
    const updates: Record<string, any> = {};

    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (updates.agent_contact_email && !updates.agent_contact_email.endsWith('@keystoneweb.ca')) {
      return NextResponse.json(
        { error: 'agent_contact_email must be a @keystoneweb.ca address' },
        { status: 400 }
      );
    }

    const db = createAdminClient();
    const { data, error } = await db
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ agent: data });
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[ops/agents/[id] PATCH]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
