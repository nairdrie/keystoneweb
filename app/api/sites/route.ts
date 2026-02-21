import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/db/supabase-server';

interface CreateSiteRequest {
  selectedTemplateId: string;
  businessType: string;
  category: string;
  userId?: string | null; // Optional - set if user is authenticated
}

interface SiteData {
  id: string;
  userId: string | null; // null until authenticated
  selectedTemplateId: string;
  businessType: string;
  category: string;
  designData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Helper to map Supabase data to SiteData
function mapSupabaseToSiteData(row: any): SiteData {
  return {
    id: row.id,
    userId: row.user_id,
    selectedTemplateId: row.selected_template_id,
    businessType: row.business_type,
    category: row.category,
    designData: row.design_data || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSiteRequest = await request.json();
    const { selectedTemplateId, businessType, category, userId } = body;

    if (!selectedTemplateId || !businessType || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate new site ID
    const siteId = uuidv4();
    const now = new Date().toISOString();

    // Create server-side Supabase client (handles auth via cookies)
    const supabase = await createClient();

    // Insert into Supabase
    // userId is set immediately if user is authenticated (from onboarding)
    // or null if creating as guest (claimed on first save)
    const { data, error } = await supabase
      .from('sites')
      .insert({
        id: siteId,
        user_id: userId || null,
        selected_template_id: selectedTemplateId,
        business_type: businessType,
        category,
        design_data: {}, // Empty until user customizes
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating site:', error);
      return NextResponse.json(
        { error: 'Failed to create site in database' },
        { status: 500 }
      );
    }

    const siteData = mapSupabaseToSiteData(data);

    return NextResponse.json(
      {
        siteId: siteData.id,
        message: 'Site created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating site:', error);
    return NextResponse.json(
      { error: 'Failed to create site' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('id');

    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      );
    }

    // Create server-side Supabase client
    const supabase = await createClient();

    // Fetch from Supabase
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (error || !data) {
      console.error('Supabase error fetching site:', error);
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    const siteData = mapSupabaseToSiteData(data);
    return NextResponse.json(siteData);
  } catch (error) {
    console.error('Error fetching site:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Create server-side Supabase client
    const supabase = await createClient();

    // ✅ Security: Always use getUser() for authorization checks
    // This cryptographically verifies the JWT token with Supabase backend
    // NEVER use getSession() which only reads local cookies unvalidated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('Auth error in PATCH /api/sites:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized: User authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { siteId, designData, userId } = body;

    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      );
    }

    // ✅ Security: Verify ownership - userId from JWT must match site.user_id
    if (userId && userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit your own sites' },
        { status: 403 }
      );
    }

    // Fetch current site to merge design data
    const { data: currentSite, error: fetchError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (fetchError || !currentSite) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    // ✅ Security: If site already has an owner, verify it matches current user
    if (currentSite.user_id && currentSite.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: This site is owned by another user' },
        { status: 403 }
      );
    }

    // Merge design data
    const mergedDesignData = {
      ...(currentSite.design_data || {}),
      ...(designData || {}),
    };

    // Update in Supabase - set userId if this is the first save
    const { data: updatedSite, error: updateError } = await supabase
      .from('sites')
      .update({
        user_id: user.id, // Claim ownership on first save
        design_data: mergedDesignData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase error updating site:', updateError);
      return NextResponse.json(
        { error: 'Failed to update site' },
        { status: 500 }
      );
    }

    const siteData = mapSupabaseToSiteData(updatedSite);

    return NextResponse.json({
      message: 'Site updated successfully',
      site: siteData,
    });
  } catch (error) {
    console.error('Error updating site:', error);
    return NextResponse.json(
      { error: 'Failed to update site' },
      { status: 500 }
    );
  }
}
