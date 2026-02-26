import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * GET /api/domains/check-availability?subdomain=something-unique&baseDomain=kswd.ca
 * Check if a subdomain is available at the specified base domain
 * 
 * Returns:
 * {
 *   available: boolean,
 *   subdomain: string,
 *   fullDomain: string, // e.g., something-unique.kswd.ca
 *   message: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subdomain = searchParams.get('subdomain');
    const baseDomain = searchParams.get('baseDomain') || 'kswd.ca';

    if (!subdomain) {
      return NextResponse.json(
        { error: 'subdomain query parameter is required' },
        { status: 400 }
      );
    }

    // Validate subdomain format
    // Must be 3-63 chars, alphanumeric + hyphens, no leading/trailing hyphens
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json({
        available: false,
        subdomain,
        fullDomain: `${subdomain}.${baseDomain}`,
        message: 'Invalid subdomain. Use alphanumeric characters and hyphens only (3-63 chars).',
      });
    }

    const supabase = await createClient();
    const fullDomain = `${subdomain}.${baseDomain}`;

    // Check if subdomain is already taken
    const { data: existing, error } = await supabase
      .from('sites')
      .select('id')
      .eq('published_domain', fullDomain)
      .single();

    // If no error and data exists, subdomain is taken
    if (!error && existing) {
      return NextResponse.json({
        available: false,
        subdomain,
        fullDomain,
        message: 'This subdomain is already taken. Choose another.',
      });
    }

    // Subdomain is available
    return NextResponse.json({
      available: true,
      subdomain,
      fullDomain,
      message: 'Great! This subdomain is available.',
    });
  } catch (error) {
    console.error('Error checking domain availability:', error);
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    );
  }
}
