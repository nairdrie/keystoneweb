'use client';

import { BlockData, useEditorContext } from '@/lib/editor-context';
import { useState, useRef } from 'react';
import { Upload, Download, FileText, X } from 'lucide-react';

export default function PDFBlock({ block, palette }: { block: BlockData; palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;
    const siteId = context?.siteId;

    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const pdfUrl: string = block.data.pdfUrl || '';
    const title: string = block.data.title || '';
    const showDownload: boolean = block.data.showDownload !== false;
    const downloadLabel: string = block.data.downloadLabel || 'Download PDF';

    const updateData = (key: string, value: any) => {
        context?.updateBlockData?.(block.id, key, value);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !siteId) return;

        if (file.type !== 'application/pdf') {
            setUploadError('Please select a PDF file');
            return;
        }

        setUploading(true);
        setUploadError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('siteId', siteId);

            const res = await fetch('/api/sites/upload-pdf', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Upload failed');
            }

            const { pdfUrl: uploadedUrl } = await res.json();
            updateData('pdfUrl', uploadedUrl);
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <section className="py-12 bg-white">
            <div className="max-w-5xl mx-auto px-4">

                {/* Title */}
                {isEditMode ? (
                    <input
                        type="text"
                        value={title}
                        onChange={e => updateData('title', e.target.value)}
                        placeholder="Section title (optional)"
                        className="mb-4 block w-full text-2xl font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-400 placeholder:text-slate-300"
                    />
                ) : title ? (
                    <h2 className="mb-6 text-2xl font-bold text-slate-800">{title}</h2>
                ) : null}

                {/* Upload area — shown in edit mode when no PDF uploaded yet */}
                {isEditMode && !pdfUrl && (
                    <div
                        className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-3 py-16 cursor-pointer hover:border-blue-400 hover:bg-slate-50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FileText className="w-10 h-10 text-slate-400" />
                        <p className="text-slate-600 font-medium">Click to upload a PDF</p>
                        <p className="text-slate-400 text-sm">Max 20 MB</p>
                        {uploading && <p className="text-blue-500 text-sm animate-pulse">Uploading…</p>}
                        {uploadError && <p className="text-red-500 text-sm">{uploadError}</p>}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>
                )}

                {/* PDF viewer */}
                {pdfUrl && (
                    <div>
                        {/* Edit-mode controls */}
                        {isEditMode && (
                            <div className="flex flex-wrap items-center gap-4 mb-3">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    <Upload className="w-4 h-4" />
                                    Replace PDF
                                </button>
                                <button
                                    onClick={() => updateData('pdfUrl', '')}
                                    className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium"
                                >
                                    <X className="w-4 h-4" />
                                    Remove
                                </button>
                                {uploading && <span className="text-blue-500 text-sm animate-pulse">Uploading…</span>}
                                {uploadError && <span className="text-red-500 text-sm">{uploadError}</span>}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                        )}

                        {/* Iframe viewer */}
                        <div
                            className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm"
                            style={{ height: '680px' }}
                        >
                            <iframe
                                src={pdfUrl}
                                className="w-full h-full"
                                title={title || 'PDF Document'}
                            />
                        </div>
                    </div>
                )}

                {/* Download button row */}
                {pdfUrl && (
                    <div className="mt-5 flex flex-wrap items-center gap-4">
                        {isEditMode && (
                            <>
                                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={showDownload}
                                        onChange={e => updateData('showDownload', e.target.checked)}
                                        className="rounded"
                                    />
                                    Show download button
                                </label>
                                {showDownload && (
                                    <input
                                        type="text"
                                        value={downloadLabel}
                                        onChange={e => updateData('downloadLabel', e.target.value)}
                                        placeholder="Button label"
                                        className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 w-40"
                                    />
                                )}
                            </>
                        )}
                        {showDownload && (
                            <a
                                href={pdfUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                                style={{ backgroundColor: palette?.primary || '#3b82f6' }}
                            >
                                <Download className="w-4 h-4" />
                                {downloadLabel}
                            </a>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
