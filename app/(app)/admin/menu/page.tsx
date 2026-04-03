'use client';

import { useState, useRef } from 'react';
import { useAdminContext } from '../admin-context';
import { MenuManager } from '@/app/components/blocks/MenuBlock';
import { UtensilsCrossed, FileText, Upload, Loader2, ExternalLink, Trash2, X } from 'lucide-react';

export default function AdminMenuPage() {
  const { siteId, palette, siteBlockTypes } = useAdminContext();
  const [pdfUrl, setPdfUrl] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'pdf'>('items');
  const pdfRef = useRef<HTMLInputElement>(null);

  if (!siteId) return null;

  // If site doesn't have a menu block and we got here via "All features", show prompt
  if (!siteBlockTypes.has('menu')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <UtensilsCrossed className="w-7 h-7 text-slate-300" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">No Menu block on this site</h2>
        <p className="text-sm text-slate-500 max-w-xs mb-5">
          Add a <strong>Menu</strong> block to your site to start managing menu items.
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

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('siteId', siteId);
      const res = await fetch('/api/menu/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const { fileUrl } = await res.json();
        setPdfUrl(fileUrl);
      }
    } finally {
      setUploadingPdf(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Menu</h2>
        <a
          href={`/design?siteId=${siteId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Open Designer
        </a>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'items' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          Menu Items
        </button>
        <button
          onClick={() => setActiveTab('pdf')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'pdf' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <FileText className="w-3.5 h-3.5" />
          PDF / Image Menu
        </button>
      </div>

      {activeTab === 'items' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Menu Items</h3>
            <p className="text-xs text-slate-400 mt-0.5">Add and manage your menu items. Group them by category.</p>
          </div>
          <div className="p-4">
            <MenuManager siteId={siteId} palette={palette} />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">PDF or Image Menu</h3>
            <p className="text-xs text-slate-400 mt-0.5">Upload a PDF or image of your menu. Switch your Menu block to "PDF" mode in the designer to display it.</p>
          </div>
          <div className="p-6 space-y-4">
            {pdfUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                {pdfUrl.toLowerCase().includes('.pdf') ? (
                  <div className="flex items-center gap-3 p-4">
                    <FileText className="w-8 h-8 text-red-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 text-sm">PDF uploaded</div>
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
                        {pdfUrl}
                      </a>
                    </div>
                    <button onClick={() => setPdfUrl('')} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <img src={pdfUrl} alt="Menu" className="w-full max-h-72 object-contain" />
                    <button onClick={() => setPdfUrl('')} className="absolute top-2 right-2 p-1.5 bg-white/90 text-slate-400 hover:text-red-500 rounded-lg shadow">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            <label className="flex flex-col items-center justify-center w-full bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl p-10 cursor-pointer transition-colors">
              <input ref={pdfRef} type="file" className="hidden" accept=".pdf,image/*" onChange={handlePdfUpload} disabled={uploadingPdf} />
              <Upload className={`w-8 h-8 mb-3 ${uploadingPdf ? 'text-slate-300' : 'text-slate-400'}`} />
              <div className="font-semibold text-slate-700 text-sm">{uploadingPdf ? 'Uploading…' : pdfUrl ? 'Upload a new file to replace' : 'Upload your menu'}</div>
              <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG — max 20 MB</p>
              {uploadingPdf && <Loader2 className="w-5 h-5 animate-spin mt-3 text-slate-400" />}
            </label>

            {pdfUrl && (
              <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-xl p-3">
                <strong>Next step:</strong> In the designer, click your Menu block's settings (⚙) and switch to <strong>PDF / Image</strong> mode to show this file on your site.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
