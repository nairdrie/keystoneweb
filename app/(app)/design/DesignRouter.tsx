'use client';

/**
 * Picks the editor for a site: agent-built (engine v2) sites get the
 * click-to-edit content editor; every other site keeps the classic editor,
 * unchanged.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import EditorContent from '../editor/editor-content-v2';
import EditorLoadingScreen from '../../components/EditorLoadingScreen';
import V2Editor from './v2/V2Editor';

export default function DesignRouter() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get('siteId');
  const [resolved, setResolved] = useState<{ siteId: string | null; engine: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v2/engine${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ''}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { siteId, engine: 'blocks_v1' }))
      .catch(() => ({ siteId, engine: 'blocks_v1' }))
      .then((d) => { if (!cancelled) setResolved({ siteId: d.siteId ?? siteId, engine: d.engine || 'blocks_v1' }); });
    return () => { cancelled = true; };
  }, [siteId]);

  if (!resolved) return <EditorLoadingScreen />;
  // Keyed by site so switching sites starts a fresh editor (page, selection, canvas).
  if (resolved.engine === 'sections_v2' && resolved.siteId) return <V2Editor key={resolved.siteId} siteId={resolved.siteId} />;
  return <EditorContent />;
}
