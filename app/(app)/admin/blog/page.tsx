'use client';

import { useAdminContext } from '../admin-context';
import { BlogPostsManager } from '@/app/components/blocks/BlogBlock';
import { BookOpen } from 'lucide-react';

export default function AdminBlogPage() {
  const { siteId, palette, siteBlockTypes } = useAdminContext();

  if (!siteId) return null;

  if (!siteBlockTypes.has('blog')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <BookOpen className="w-7 h-7 text-slate-300" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">No Blog block on this site</h2>
        <p className="text-sm text-slate-500 max-w-xs mb-5">
          Add a <strong>Blog / News</strong> block to your site to start publishing articles.
        </p>
        <a
          href={`/design?siteId=${siteId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
        >
          Open Designer
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h2 className="text-base font-bold text-slate-900">Blog</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Posts</h3>
        </div>
        <div className="p-4">
          <BlogPostsManager siteId={siteId} palette={palette} />
        </div>
      </div>
    </div>
  );
}
