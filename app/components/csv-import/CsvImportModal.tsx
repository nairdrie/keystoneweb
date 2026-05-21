'use client';

import { useState, useRef, useCallback } from 'react';
import {
    X, Upload, Download, FileText, CheckCircle2, AlertTriangle,
    Loader2, ChevronDown, ChevronRight, Sparkles, Info, FileJson,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CsvImportType = 'services' | 'products';

type FileFormat = 'csv' | 'json';

interface ImportResult {
    imported: number;
    modified: number;
    already_exists: number;
    skipped: number;
    errors: { row: number; name: string; error: string }[];
    mapping?: Record<string, string | null>;
    total: number;
    images?: { uploaded: number; failed: number; totalBytes: number };
    source?: { provider: string | null; sourceUrl: string | null };
}

interface CsvImportModalProps {
    siteId: string;
    type: CsvImportType;
    onClose: () => void;
    onImported: () => void;
}

// ─── CSV Templates ────────────────────────────────────────────────────────────

const SERVICES_TEMPLATE_HEADERS = [
    'name', 'description', 'price', 'compare_at_price',
    'duration_minutes', 'currency', 'is_featured', 'status',
    'category', 'options', 'options_required',
];

const SERVICES_TEMPLATE_ROWS = [
    [
        'Deep Tissue Massage',
        'A therapeutic massage targeting deep muscle layers to relieve tension.',
        '90.00', '110.00', '60', 'CAD', 'true', 'published',
        'Massage',
        'Single Session:90.00:override | 3-Pack:250.00:override | Aromatherapy Add-on:15.00:addon',
        'required',
    ],
    [
        'Swedish Relaxation Massage',
        'A gentle full-body massage promoting relaxation and circulation.',
        '75.00', '', '45', 'CAD', 'false', 'published',
        'Massage',
        '',
        'optional',
    ],
    [
        'Signature Facial',
        'A deep-cleansing facial customized for your skin type.',
        '95.00', '120.00', '60', 'CAD', 'true', 'published',
        'Skin Care',
        'Standard:95.00:override | Premium:130.00:override | Eye Treatment Add-on:20.00:addon',
        'required',
    ],
    [
        'Hot Stone Therapy',
        'Smooth heated stones placed on key points to ease tension.',
        '120.00', '140.00', '75', 'CAD', 'false', 'draft',
        'Massage',
        '',
        'optional',
    ],
];

const PRODUCTS_TEMPLATE_HEADERS = [
    'name', 'description', 'price', 'compare_at_price',
    'currency', 'inventory_count', 'status', 'variants',
    'member_prices', 'allowed_packages', 'image_urls',
];

// member_prices format:    "Package Name:price | Other Package:price"   (price in dollars; clamped to <= public price)
// allowed_packages format: "Package Name | Other Package"               (blank/empty = anyone can buy)
// image_urls format:       "https://.../a.jpg | https://.../b.jpg"      (images are downloaded and uploaded into your media library)
// Package names are matched case-insensitively against your existing membership packages.
const PRODUCTS_TEMPLATE_ROWS = [
    [
        'Classic Logo T-Shirt',
        'Soft 100% cotton tee with embroidered logo.',
        '35.00', '45.00', 'CAD', '150', 'published',
        'Size:XS,S,M,L,XL,2XL | Color:Black,White,Navy',
        'Gold:28.00 | Silver:32.00',
        '',
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200 | https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=1200',
    ],
    [
        'Branded Water Bottle',
        'BPA-free 750ml insulated bottle. Keeps drinks cold 24hrs.',
        '28.00', '', 'CAD', '75', 'published',
        'Color:Black,Silver,Rose Gold',
        'Gold:22.00',
        '',
        'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=1200',
    ],
    [
        'Members-only Hoodie',
        'Heavyweight hoodie available exclusively to Gold members.',
        '80.00', '', 'CAD', '50', 'published',
        'Size:S,M,L,XL',
        'Gold:60.00',
        'Gold',
        '',
    ],
    [
        'Gift Card',
        'Give the gift of choice. Redeemable in-store and online.',
        '50.00', '', 'CAD', '-1', 'draft',
        '',
        '',
        '',
        '',
    ],
];

function generateTemplateCSV(type: CsvImportType): string {
    const headers = type === 'services' ? SERVICES_TEMPLATE_HEADERS : PRODUCTS_TEMPLATE_HEADERS;
    const rows = type === 'services' ? SERVICES_TEMPLATE_ROWS : PRODUCTS_TEMPLATE_ROWS;

    const escapeCsvValue = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    };

    const lines = [
        headers.join(','),
        ...rows.map(row => row.map(escapeCsvValue).join(',')),
    ];

    return lines.join('\n');
}

function downloadTemplate(type: CsvImportType) {
    const csv = generateTemplateCSV(type);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = type === 'services' ? 'services-import-template.csv' : 'products-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ─── File Validation (client-side pre-check) ──────────────────────────────────

const MAX_CSV_FILE_SIZE = 2 * 1024 * 1024;  // 2MB
const MAX_JSON_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS_PREVIEW = 500;

function detectFileFormat(file: File): FileFormat | null {
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) return 'csv';
    if (name.endsWith('.json')) return 'json';
    return null;
}

function validateFile(file: File): string | null {
    const format = detectFileFormat(file);
    if (!format) {
        return 'File must have a .csv or .json extension.';
    }
    if (file.size === 0) {
        return 'File is empty.';
    }
    const maxSize = format === 'json' ? MAX_JSON_FILE_SIZE : MAX_CSV_FILE_SIZE;
    const maxLabel = format === 'json' ? '10MB' : '2MB';
    if (file.size > maxSize) {
        return `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${maxLabel}.`;
    }
    return null;
}

interface CsvPreview { type: 'csv'; rowCount: number; headers: string[] }
interface JsonPreview { type: 'json'; productCount: number; provider: string | null; sourceUrl: string | null; sampleNames: string[] }
type FilePreview = CsvPreview | JsonPreview;

async function previewFile(file: File): Promise<FilePreview | null> {
    try {
        const text = await file.text();
        const format = detectFileFormat(file);

        if (format === 'json') {
            const data = JSON.parse(text);
            if (!data.products || !Array.isArray(data.products)) return null;
            return {
                type: 'json',
                productCount: data.products.length,
                provider: data.provider || null,
                sourceUrl: data.sourceUrl || null,
                sampleNames: data.products.slice(0, 5).map((p: any) => p.productName || '(unnamed)'),
            };
        }

        // CSV preview
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
        if (lines.length < 2) return null;
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
        return { type: 'csv', rowCount: lines.length - 1, headers };
    } catch {
        return null;
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CsvImportModal({ siteId, type, onClose, onImported }: CsvImportModalProps) {
    const [dragOver, setDragOver] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileFormat, setFileFormat] = useState<FileFormat | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [preview, setPreview] = useState<FilePreview | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [showErrorDetails, setShowErrorDetails] = useState(false);
    const [showMappingDetails, setShowMappingDetails] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const typeLabel = type === 'services' ? 'Services' : 'Products';
    const itemLabel = type === 'services' ? 'service' : 'product';

    const handleFile = useCallback(async (file: File) => {
        setResult(null);
        setFileError(null);
        setPreview(null);
        setFileFormat(null);

        const err = validateFile(file);
        if (err) {
            setFileError(err);
            setSelectedFile(null);
            return;
        }

        const format = detectFileFormat(file);
        if (format === 'json' && type === 'services') {
            setFileError('JSON import is only supported for products. Please use CSV for services.');
            setSelectedFile(null);
            return;
        }

        setSelectedFile(file);
        setFileFormat(format);
        const p = await previewFile(file);
        if (!p) {
            setFileError(format === 'json'
                ? 'Could not read JSON. Make sure the file contains a valid "products" array.'
                : 'Could not read CSV. Make sure the file is not empty and is valid UTF-8.');
            setSelectedFile(null);
            return;
        }
        if (p.type === 'csv' && p.rowCount > MAX_ROWS_PREVIEW) {
            setFileError(`CSV has ${p.rowCount} rows. Maximum allowed is ${MAX_ROWS_PREVIEW}. Please split it into smaller files.`);
            setSelectedFile(null);
            return;
        }
        if (p.type === 'json' && p.productCount > MAX_ROWS_PREVIEW) {
            setFileError(`JSON has ${p.productCount} products. Maximum allowed is ${MAX_ROWS_PREVIEW}. Please split it into smaller files.`);
            setSelectedFile(null);
            return;
        }
        setPreview(p);
    }, [type]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
    };

    const handleImport = async () => {
        if (!selectedFile) return;
        setUploading(true);
        setResult(null);
        setFileError(null);

        try {
            const form = new FormData();
            form.append('file', selectedFile);
            form.append('siteId', siteId);

            const isJson = fileFormat === 'json';
            if (!isJson) {
                form.append('type', type);
            }

            const endpoint = isJson ? '/api/json-import' : '/api/csv-import';

            const res = await fetch(endpoint, {
                method: 'POST',
                body: form,
            });

            const data = await res.json();

            if (!res.ok) {
                setFileError(data.error || 'Import failed. Please try again.');
                return;
            }

            setResult(data);
            if (data.imported > 0 || data.modified > 0) {
                onImported();
            }
        } catch (err: any) {
            setFileError(err.message || 'Network error. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setFileFormat(null);
        setPreview(null);
        setResult(null);
        setFileError(null);
        setShowErrorDetails(false);
        setShowMappingDetails(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Import {typeLabel}</h2>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            {type === 'products' ? (
                                <>
                                    <Sparkles className="w-3 h-3 text-purple-500" />
                                    Upload CSV or JSON — AI auto-maps columns for CSV
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-3 h-3 text-purple-500" />
                                    AI will auto-map your columns — flexible format accepted
                                </>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Template Download */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-semibold text-blue-900">Start with the template</span>
                                </div>
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    Download our pre-filled template with example data. Your own CSV doesn't need to match exactly — AI will figure it out.
                                </p>
                            </div>
                            <button
                                onClick={() => downloadTemplate(type)}
                                className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Download
                            </button>
                        </div>

                        {/* Field reference */}
                        <div className="mt-3 pt-3 border-t border-blue-200">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1.5">Supported fields</p>
                            <div className="flex flex-wrap gap-1">
                                {(type === 'services' ? SERVICES_TEMPLATE_HEADERS : PRODUCTS_TEMPLATE_HEADERS).map(h => (
                                    <span key={h} className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-mono">{h}</span>
                                ))}
                            </div>
                            {type === 'services' && (
                                <div className="mt-1.5 space-y-0.5">
                                    <p className="text-[10px] text-blue-600">
                                        <strong>options:</strong> <span className="font-mono">"Name:Price:override | Add-on:Price:addon"</span> — type is <span className="font-mono">override</span> (replaces base price) or <span className="font-mono">addon</span> (adds to it)
                                    </p>
                                    <p className="text-[10px] text-blue-600">
                                        <strong>options_required:</strong> <span className="font-mono">required</span> or <span className="font-mono">optional</span>
                                    </p>
                                    <p className="text-[10px] text-blue-600">
                                        <strong>category:</strong> category name — created automatically if it doesn't exist
                                    </p>
                                </div>
                            )}
                            {type === 'products' && (
                                <div className="mt-1.5 space-y-0.5">
                                    <p className="text-[10px] text-blue-600">
                                        <strong>variants:</strong> use <span className="font-mono">"Size:S,M,L | Color:Red,Blue"</span> or JSON array
                                    </p>
                                    <p className="text-[10px] text-blue-600">
                                        <strong>image_urls:</strong> pipe- or comma-separated <span className="font-mono">https://...</span> links — images are downloaded and added automatically
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* File Upload */}
                    {!result && (
                        <>
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : selectedFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100'}`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={type === 'products' ? '.csv,text/csv,.json,application/json' : '.csv,text/csv'}
                                    className="hidden"
                                    onChange={handleInputChange}
                                />
                                {selectedFile ? (
                                    <div className="space-y-1">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                                        <p className="text-sm font-semibold text-emerald-700">{selectedFile.name}</p>
                                        <p className="text-xs text-emerald-600">
                                            {(selectedFile.size / 1024).toFixed(1)}KB
                                            {preview?.type === 'csv' && ` · ${preview.rowCount} row${preview.rowCount !== 1 ? 's' : ''} · ${preview.headers.length} columns`}
                                            {preview?.type === 'json' && ` · ${preview.productCount} product${preview.productCount !== 1 ? 's' : ''}${preview.provider ? ` · ${preview.provider}` : ''}`}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                                        <p className="text-sm font-semibold text-slate-700">
                                            {type === 'products' ? 'Drop your CSV or JSON here' : 'Drop your CSV here'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {type === 'products' ? 'or click to browse · CSV max 2MB · JSON max 10MB · 500 items' : 'or click to browse · max 2MB · 500 rows'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Detected columns preview (CSV) */}
                            {preview?.type === 'csv' && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <Info className="w-3.5 h-3.5 text-slate-500" />
                                        <span className="text-xs font-semibold text-slate-600">Detected columns</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {preview.headers.map(h => (
                                            <span key={h} className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded font-mono">{h}</span>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-purple-400" />
                                        AI will map these to the correct fields automatically
                                    </p>
                                </div>
                            )}

                            {/* JSON preview */}
                            {preview?.type === 'json' && (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2.5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <FileJson className="w-3.5 h-3.5 text-purple-500" />
                                        <span className="text-xs font-semibold text-purple-700">JSON Product Import</span>
                                    </div>
                                    {preview.provider && (
                                        <p className="text-[10px] text-purple-600 mb-1">
                                            Source: <strong>{preview.provider}</strong>
                                            {preview.sourceUrl && <span className="text-purple-400"> · {preview.sourceUrl}</span>}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-purple-600 mb-1.5">
                                        <strong>{preview.productCount}</strong> product{preview.productCount !== 1 ? 's' : ''} found — images will be downloaded and uploaded automatically
                                    </p>
                                    <div className="space-y-0.5">
                                        {preview.sampleNames.map((name, i) => (
                                            <div key={i} className="text-[10px] text-purple-600 truncate">· {name}</div>
                                        ))}
                                        {preview.productCount > 5 && (
                                            <div className="text-[10px] text-purple-400">...and {preview.productCount - 5} more</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Error */}
                    {fileError && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{fileError}</p>
                        </div>
                    )}

                    {/* Import Result */}
                    {result && (
                        <div className="space-y-3">
                            {/* Summary */}
                            <div className={`rounded-xl p-4 border ${(result.imported > 0 || result.modified > 0) ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className={`w-5 h-5 ${(result.imported > 0 || result.modified > 0) ? 'text-emerald-500' : 'text-amber-500'}`} />
                                    <span className={`text-sm font-bold ${(result.imported > 0 || result.modified > 0) ? 'text-emerald-800' : 'text-amber-800'}`}>
                                        Import complete
                                    </span>
                                </div>
                                <div className="grid grid-cols-5 gap-1.5">
                                    <div className="bg-white rounded-lg p-2 text-center border border-emerald-200">
                                        <div className="text-base font-bold text-emerald-700">{result.imported}</div>
                                        <div className="text-[10px] text-slate-500">Imported</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 text-center border border-blue-200">
                                        <div className="text-base font-bold text-blue-700">{result.modified}</div>
                                        <div className="text-[10px] text-slate-500">Updated</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 text-center border border-slate-200">
                                        <div className="text-base font-bold text-slate-400">{result.already_exists}</div>
                                        <div className="text-[10px] text-slate-500">Unchanged</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 text-center border border-slate-200">
                                        <div className="text-base font-bold text-slate-400">{result.skipped}</div>
                                        <div className="text-[10px] text-slate-500">Skipped</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 text-center border border-slate-200">
                                        <div className={`text-base font-bold ${result.errors.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>{result.errors.length}</div>
                                        <div className="text-[10px] text-slate-500">Errors</div>
                                    </div>
                                </div>
                            </div>

                            {/* Image import stats (JSON only) */}
                            {result.images && (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <FileJson className="w-3.5 h-3.5 text-purple-500" />
                                        <span className="text-xs font-semibold text-purple-700">Image Import</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <div className="bg-white rounded-lg p-2 text-center border border-purple-200">
                                            <div className="text-base font-bold text-purple-700">{result.images.uploaded}</div>
                                            <div className="text-[10px] text-slate-500">Uploaded</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 text-center border border-purple-200">
                                            <div className={`text-base font-bold ${result.images.failed > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{result.images.failed}</div>
                                            <div className="text-[10px] text-slate-500">Failed</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 text-center border border-purple-200">
                                            <div className="text-base font-bold text-purple-700">{(result.images.totalBytes / (1024 * 1024)).toFixed(1)}</div>
                                            <div className="text-[10px] text-slate-500">MB used</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Column mapping accordion (CSV only) */}
                            {result.mapping && (
                                <>
                                    <button
                                        onClick={() => setShowMappingDetails(v => !v)}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                            AI column mapping used
                                        </span>
                                        {showMappingDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </button>
                                    {showMappingDetails && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                                            {Object.entries(result.mapping).filter(([, v]) => v !== null).map(([field, col]) => (
                                                <div key={field} className="flex items-center gap-2 text-xs">
                                                    <span className="font-mono text-slate-500 w-32 shrink-0">{field}</span>
                                                    <span className="text-slate-400">←</span>
                                                    <span className="font-mono text-slate-700">{col}</span>
                                                </div>
                                            ))}
                                            {Object.entries(result.mapping).filter(([, v]) => v === null).length > 0 && (
                                                <div className="pt-1 border-t border-slate-200 mt-1">
                                                    <p className="text-[10px] text-slate-400">Not found: {Object.entries(result.mapping).filter(([, v]) => v === null).map(([f]) => f).join(', ')}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Errors accordion */}
                            {result.errors.length > 0 && (
                                <>
                                    <button
                                        onClick={() => setShowErrorDetails(v => !v)}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} had errors
                                        </span>
                                        {showErrorDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </button>
                                    {showErrorDetails && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                                            {result.errors.map(e => (
                                                <div key={e.row} className="text-xs text-red-700">
                                                    <span className="font-semibold">Row {e.row}</span>
                                                    {e.name && <span className="text-red-500"> ({e.name})</span>}
                                                    <span className="text-red-500">: {e.error}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between gap-3">
                    {result ? (
                        <>
                            <button onClick={handleReset} className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
                                Import another file
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg transition-colors"
                            >
                                Done
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!selectedFile || uploading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {fileFormat === 'json' ? 'Importing (downloading images)...' : 'Importing...'}
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Import {typeLabel}
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
