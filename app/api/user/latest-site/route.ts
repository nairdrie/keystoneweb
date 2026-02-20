import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

interface SiteData {
  id: string;
  userId: string | null;
  selectedTemplateId: string;
  businessType: string;
  category: string;
  designData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/user/latest-site
 * Fetch the most recently updated site owned by the authenticated user
 * Used to auto-load the editor with their last worked-on site
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

    // Fetch the most recently updated site owned by this user
    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // PGRST116 = no rows found (user has no sites yet)
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'No sites found', message: 'User has no sites yet' },
          { status: 404 }
        );
      }
      console.error('Error fetching latest site:', error);
      return NextResponse.json(
        { error: 'Failed to fetch site' },
        { status: 500 }
      );
    }

    // Map to response format
    const siteData: SiteData = {
      id: site.id,
      userId: site.user_id,
      selectedTemplateId: site.selected_template_id,
      businessType: site.business_type,
      category: site.category,
      designData: site.design_data || {},
      createdAt: site.created_at,
      updatedAt: site.updated_at,
    };

    return NextResponse.json({
      site: siteData,
    });
  } catch (error) {
    console.error('Error in GET /api/user/latest-site:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
