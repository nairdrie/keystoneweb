import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);
const resolveTxt = promisify(dns.resolveTxt);

/**
 * POST /api/domains/verify-dns
 * Verify that DNS records are correctly configured for an external domain
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await request.json();

    if (!siteId) {
      return NextResponse.json(
        { error: 'Missing required field: siteId' },
        { status: 400 }
      );
    }

    // Get site with custom domain
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id, custom_domain')
      .eq('id', siteId)
      .single();

    if (siteError || !site || site.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Site not found or access denied' },
        { status: 404 }
      );
    }

    if (!site.custom_domain) {
      return NextResponse.json(
        { error: 'No custom domain configured for this site' },
        { status: 400 }
      );
    }

    const domain = site.custom_domain;
    const verificationToken = `kswd-verify-${siteId.slice(0, 8)}`;

    const checks = {
      cname: false,
      txt: false,
    };

    // Check CNAME record for www subdomain
    try {
      const cnameRecords = await resolveCname(`www.${domain}`);
      checks.cname = cnameRecords.some(
        (record) => record.toLowerCase() === 'sites.kswd.ca'
      );
    } catch {
      // CNAME not found
    }

    // Check TXT record for verification
    try {
      const txtRecords = await resolveTxt(domain);
      checks.txt = txtRecords.some(
        (record) => record.join('').includes(verificationToken)
      );
    } catch {
      // TXT not found
    }

    const verified = checks.cname && checks.txt;

    if (verified) {
      // Mark DNS records as verified
      await supabase
        .from('dns_records')
        .update({ verified_at: new Date().toISOString() })
        .eq('site_id', siteId);
    }

    return NextResponse.json({
      verified,
      domain,
      checks,
      message: verified
        ? 'DNS records verified! Your custom domain is active.'
        : 'DNS records not yet detected. This can take up to 48 hours after making changes.',
    });
  } catch (error) {
    console.error('Error verifying DNS:', error);
    return NextResponse.json(
      { error: 'Failed to verify DNS records' },
      { status: 500 }
    );
  }
}
