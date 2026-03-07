import { useState, useCallback } from 'react';

export interface Page {
  id: string;
  slug: string;
  title: string;
  display_name: string;
  is_visible_in_nav: boolean;
  nav_order: number;
  design_data?: Record<string, any>;
  published_data?: Record<string, any>;
}

export function usePages(siteId: string) {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch pages for site
  const fetchPages = useCallback(async () => {
    if (!siteId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/pages?siteId=${siteId}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to fetch pages');
      }

      const data = await res.json();
      const fetchedPages = data.pages || [];

      // If no pages exist, create default "Home" page
      if (fetchedPages.length === 0) {
        await createPage('home', 'Home', 'Home');
        // Re-fetch inline (not recursive!) after creating the default page
        const res2 = await fetch(`/api/pages?siteId=${siteId}`, { credentials: 'include' });
        if (res2.ok) {
          const data2 = await res2.json();
          const createdPages = data2.pages || [];
          setPages(createdPages);
          if (createdPages.length > 0) {
            setCurrentPageId(createdPages[0].id);
          }
        }
      } else {
        setPages(fetchedPages);
        // Set current page to first visible or first page
        if (fetchedPages.length > 0) {
          setCurrentPageId(fetchedPages[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching pages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  // Create new page
  const createPage = useCallback(
    async (slug: string, title: string, displayName: string) => {
      try {
        const res = await fetch('/api/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            siteId,
            slug,
            title,
            displayName,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to create page');
        }

        const data = await res.json();
        return data.page;
      } catch (err) {
        console.error('Error creating page:', err);
        throw err;
      }
    },
    [siteId]
  );

  // Update page
  const updatePage = useCallback(
    async (pageId: string, updates: Partial<Page>) => {
      try {
        const res = await fetch('/api/pages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            id: pageId,
            siteId,
            ...updates,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to update page');
        }

        const data = await res.json();
        setPages(pages.map(p => p.id === pageId ? data.page : p));
        return data.page;
      } catch (err) {
        console.error('Error updating page:', err);
        throw err;
      }
    },
    [siteId, pages]
  );

  // Delete page
  const deletePage = useCallback(
    async (pageId: string) => {
      try {
        const res = await fetch(`/api/pages?id=${pageId}&siteId=${siteId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Failed to delete page');
        }

        const remaining = pages.filter(p => p.id !== pageId);
        setPages(remaining);

        // Switch to another page if current was deleted
        if (currentPageId === pageId && remaining.length > 0) {
          setCurrentPageId(remaining[0].id);
        }
      } catch (err) {
        console.error('Error deleting page:', err);
        throw err;
      }
    },
    [siteId, pages, currentPageId]
  );

  return {
    pages,
    currentPageId,
    setCurrentPageId,
    loading,
    error,
    fetchPages,
    createPage,
    updatePage,
    deletePage,
    currentPage: currentPageId ? pages.find(p => p.id === currentPageId) : null,
  };
}
