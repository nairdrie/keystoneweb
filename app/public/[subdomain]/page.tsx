import { createClient } from '@/lib/db/supabase-server';
import PublicSiteRenderer from './client';

export const dynamic = 'force-dynamic'; // Always fetch fresh data

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;

  console.log('=== PUBLIC SITE PAGE ===');
  console.log('Subdomain:', subdomain);

  try {
    const supabase = await createClient();

    // Debug: Fetch all published sites to see what's in the database
    const { data: allSites } = await supabase
      .from('sites')
      .select('id, published_domain, is_published, subscription_status')
      .eq('is_published', true)
      .limit(20);

    console.log('All published sites in DB:', allSites?.map(s => ({
      id: s.id,
      published_domain: s.published_domain,
      is_published: s.is_published,
      subscription_status: s.subscription_status,
    })));

    // Fetch the published site by subdomain
    console.log(`Querying for published_domain = '${subdomain}'`);
    let { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('published_domain', subdomain)
      .eq('is_published', true)
      .single();

    console.log('Query result:', { found: !!site, error });

    // Fallback: Try with full domain format (in case stored as "akdesigns.kswd.ca")
    if (!site && !error) {
      const fullDomain = `${subdomain}.kswd.ca`;
      console.log(`Not found, trying full domain: '${fullDomain}'`);
      const { data: fullSite, error: fullError } = await supabase
        .from('sites')
        .select('*')
        .eq('published_domain', fullDomain)
        .eq('is_published', true)
        .single();
      site = fullSite;
      error = fullError;
      console.log('Fallback result:', { found: !!site, error });
    }

    if (error || !site) {
      console.error('Site not found:', { subdomain, error: error?.message });
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Site Not Found</h1>
            <p className="text-slate-600 mb-6">
              The site at <code className="bg-slate-100 px-2 py-1 rounded">{subdomain}.kswd.ca</code> does not exist or is not published yet.
            </p>
            <details className="text-left bg-slate-100 p-4 rounded text-xs">
              <summary className="cursor-pointer font-mono font-bold">Debug Information</summary>
              <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap">
{JSON.stringify({
  subdomain,
  searchedFor: subdomain,
  errorCode: error?.code,
  errorMessage: error?.message,
  publishedSitesInDB: allSites?.length ?? 0,
}, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    console.log('Site found:', {
      id: site.id,
      published_domain: site.published_domain,
      is_published: site.is_published,
      subscription_status: site.subscription_status,
    });

    // Verify subscription is still active
    // Allow rendering if subscription_status is 'active' OR if it's a published site (for backward compat)
    if (site.subscription_status && site.subscription_status !== 'active') {
      console.warn('Site subscription not active:', site.subscription_status);
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Subscription Expired</h1>
            <p className="text-slate-600 mb-2">
              This site's subscription is no longer active.
            </p>
            <p className="text-slate-500 text-sm">
              Status: <code className="bg-slate-100 px-1 rounded">{site.subscription_status}</code>
            </p>
          </div>
        </div>
      );
    }

    console.log('Rendering site:', site.id);

    // Render the published site (read-only)
    return (
      <PublicSiteRenderer
        siteId={site.id}
        templateId={site.selected_template_id}
        designData={site.design_data || {}}
      />
    );
  } catch (error) {
    console.error('Error rendering published site:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Error Loading Site</h1>
          <p className="text-slate-600 mb-6">
            Something went wrong while loading your site.
          </p>
          <details className="text-left bg-slate-100 p-4 rounded text-xs">
            <summary className="cursor-pointer font-mono font-bold">Error Details</summary>
            <pre className="mt-2 overflow-auto text-xs whitespace-pre-wrap">
              {errorMsg}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
