'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Trash2, AlertTriangle } from 'lucide-react';
import AlertModal from './ui/AlertModal';

interface Page {
  id: string;
  slug: string;
  title: string;
  display_name: string;
  is_visible_in_nav: boolean;
  nav_order: number;
}

interface PageSelectorProps {
  siteId: string;
  currentPageId?: string;
  onPageChange: (page: Page) => void;
  onPageCreate?: (page: Page) => void;
}

export default function PageSelector({
  siteId,
  currentPageId,
  onPageChange,
  onPageCreate,
}: PageSelectorProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title?: string; message: string; type?: 'success' | 'error' | 'info' }>({ isOpen: false, message: '' });

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Fetch pages
  useEffect(() => {
    const fetchPages = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/pages?siteId=${siteId}`, {
          credentials: 'include',
        });

        if (!res.ok) throw new Error('Failed to fetch pages');
        const data = await res.json();
        setPages(data.pages || []);
      } catch (err) {
        console.error('Error fetching pages:', err);
        setError('Failed to load pages');
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [siteId]);

  const currentPage = pages.find(p => p.id === currentPageId);

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;

    try {
      // Convert title to slug (lowercase, replace spaces with hyphens)
      const slug = newPageTitle.toLowerCase().replace(/\s+/g, '-');

      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId,
          slug,
          title: newPageTitle,
          displayName: newPageTitle,
        }),
      });

      if (!res.ok) throw new Error('Failed to create page');
      const data = await res.json();
      const newPage = data.page;

      setPages([...pages, newPage]);
      setNewPageTitle('');
      setIsCreating(false);

      // Switch to new page
      onPageChange(newPage);
      onPageCreate?.(newPage);
    } catch (err) {
      console.error('Error creating page:', err);
      setAlertConfig({ isOpen: true, title: 'Error', message: 'Failed to create page', type: 'error' });
    }
  };

  const handleDeletePage = async () => {
    if (!deleteTarget) return;
    const pageId = deleteTarget.id;

    try {
      const res = await fetch(`/api/pages?id=${pageId}&siteId=${siteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete page');

      setPages(pages.filter(p => p.id !== pageId));
      if (currentPageId === pageId && pages.length > 1) {
        // Switch to first remaining page
        const remaining = pages.filter(p => p.id !== pageId);
        onPageChange(remaining[0]);
      }
      setDeleteTarget(null);
      setDeleteConfirmText('');
    } catch (err) {
      console.error('Error deleting page:', err);
      setAlertConfig({ isOpen: true, title: 'Error', message: 'Failed to delete page', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="px-3 py-2 bg-slate-50 text-sm text-slate-500">
        Loading pages...
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Page selector dropdown */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 h-8 rounded-full bg-white border border-slate-200 hover:border-slate-300 text-sm font-medium text-slate-900"
      >
        <span className="truncate max-w-[150px]">
          {currentPage?.title || 'Select Page'}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-500" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg z-50 w-48">
          {/* Page list */}
          <div className="max-h-64 overflow-y-auto">
            {pages.map(page => (
              <div
                key={page.id}
                className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer group ${page.id === currentPageId ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                  }`}
                onClick={() => {
                  onPageChange(page);
                  setIsOpen(false);
                }}
              >
                <span className="text-sm font-medium text-slate-900">
                  {page.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(page);
                    setDeleteConfirmText('');
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </div>
            ))}
          </div>

          {/* Create new page */}
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-2 border-t border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Page
            </button>
          ) : (
            <div className="border-t border-slate-200 p-3 space-y-2">
              <input
                type="text"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreatePage();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewPageTitle('');
                  }
                }}
                placeholder="Page title..."
                className="w-full px-2 py-1 text-sm text-slate-900 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreatePage}
                  disabled={!newPageTitle.trim()}
                  className="flex-1 px-2 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewPageTitle('');
                  }}
                  className="flex-1 px-2 py-1 text-sm font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Page</h3>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 mb-4">
              To confirm, type <strong className="text-red-600">{deleteTarget.title}</strong> below:
            </p>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && deleteConfirmText === deleteTarget.title) handleDeletePage();
                if (e.key === 'Escape') { setDeleteTarget(null); setDeleteConfirmText(''); }
              }}
              placeholder={deleteTarget.title}
              className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}
                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePage}
                disabled={deleteConfirmText !== deleteTarget.title}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
    </div>
  );
}
