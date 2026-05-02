'use client';

import { use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Legacy detail route — older notification emails sent customers to
 * /admin/inbox/<submissionId>?siteId=…
 *
 * The new email client renders the thread inline, so this page just
 * redirects to /admin/inbox?siteId=…&messageId=<submissionId>.
 */
export default function LegacyInboxDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const siteId = search.get('siteId') ?? '';
    const params = new URLSearchParams();
    if (siteId) params.set('siteId', siteId);
    if (id) params.set('messageId', id);
    router.replace(`/admin/inbox?${params.toString()}`);
  }, [id, search, router]);

  return null;
}
