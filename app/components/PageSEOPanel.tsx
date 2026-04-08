'use client';

import { useState, useEffect } from 'react';

interface PageSEOPanelProps {
  pageTitle: string;
  seoTitle: string;
  seoDescription: string;
  onUpdate: (field: 'seoTitle' | 'seoDescription', value: string) => void;
}

export default function PageSEOPanel({ pageTitle, seoTitle, seoDescription, onUpdate }: PageSEOPanelProps) {
  const [localTitle, setLocalTitle] = useState(seoTitle);
  const [localDesc, setLocalDesc] = useState(seoDescription);

  // Sync when page changes
  useEffect(() => {
    setLocalTitle(seoTitle);
    setLocalDesc(seoDescription);
  }, [seoTitle, seoDescription]);

  const handleTitleBlur = () => {
    if (localTitle !== seoTitle) onUpdate('seoTitle', localTitle);
  };

  const handleDescBlur = () => {
    if (localDesc !== seoDescription) onUpdate('seoDescription', localDesc);
  };

  const titleLen = localTitle.length;
  const descLen = localDesc.length;

  // Google SERP preview
  const previewTitle = localTitle || pageTitle || 'Page Title';
  const previewDesc = localDesc || 'Add a meta description to control how this page appears in search results.';

  return (
    <div className="p-4 space-y-4">
      {/* SEO Title */}
      <div>
        <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1">
          Page Title Tag
        </label>
        <input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder={pageTitle || 'Page title for search engines'}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none text-slate-800"
        />
        <p className={`text-[10px] mt-1 ${titleLen > 60 ? 'text-amber-600' : 'text-slate-400'}`}>
          {titleLen}/60 characters
        </p>
      </div>

      {/* Meta Description */}
      <div>
        <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1">
          Meta Description
        </label>
        <textarea
          value={localDesc}
          onChange={(e) => setLocalDesc(e.target.value)}
          onBlur={handleDescBlur}
          placeholder="Brief description for search results..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none resize-none text-slate-800"
        />
        <p className={`text-[10px] mt-1 ${descLen > 160 ? 'text-amber-600' : 'text-slate-400'}`}>
          {descLen}/160 characters
        </p>
      </div>

      {/* SERP Preview */}
      <div>
        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wide mb-2">
          Search Preview
        </p>
        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-0.5">
          <div className="text-sm font-medium text-blue-700 truncate leading-tight">
            {previewTitle}
          </div>
          <div className="text-[11px] text-green-700 truncate">
            yoursite.com
          </div>
          <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {previewDesc}
          </div>
        </div>
      </div>
    </div>
  );
}
