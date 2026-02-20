import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

interface UserSite {
  id: string;
  title: string;
  updatedAt: string;
  businessType: string;
  category: string;
}

/**
 * GET /api/user/sites
 * Fetch all sites owned by the authenticated user
 * Returns sites ordered by most recently updated first
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all sites owned by this user, ordered by updated_at DESC
    const { data: sites, error } = await supabase
      .from('sites')
      .select('id, design_data, business_type, category, updated_at, created_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching user sites:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sites' },
        { status: 500 }
      );
    }

    // Map to response format
    const userSites: UserSite[] = sites.map(site => ({
      id: site.id,
      title: site.design_data?.title || 'Untitled Site',
      updatedAt: site.updated_at,
      businessType: site.business_type,
      category: site.category,
    }));

    return NextResponse.json({
      sites: userSites,
      count: userSites.length,
    });
  } catch (error) {
    console.error('Error in GET /api/user/sites:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
