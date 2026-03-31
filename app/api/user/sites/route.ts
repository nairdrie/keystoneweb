import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

interface UserSite {
  id: string;
  siteSlug?: string;
  updatedAt: string;
  businessType: string;
  category: string;
  isPublished: boolean;
  publishedDomain?: string;
  customDomain?: string;
}

/**
 * GET /api/user/sites
 * Fetch all sites owned by the authenticated user.
 * Returns sites ordered by most recently updated first.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: sites, error } = await supabase
      .from('sites')
      .select('id, site_slug, business_type, category, updated_at, created_at, is_published, published_domain, custom_domain')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching user sites:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sites' },
        { status: 500 }
      );
    }

    const userSites: UserSite[] = sites.map(site => ({
      id: site.id,
      siteSlug: site.site_slug || undefined,
      updatedAt: site.updated_at,
      businessType: site.business_type,
      category: site.category,
      isPublished: site.is_published || false,
      publishedDomain: site.published_domain || undefined,
      customDomain: site.custom_domain || undefined,
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
