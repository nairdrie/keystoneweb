'use client';

import { useState, useEffect } from 'react';
import {
    Loader2, Plus, Trash2, ChevronDown, ChevronRight, GripVertical,
    MapPin, Truck, Package as PackageIcon, Globe, AlertCircle
} from 'lucide-react';
import { COUNTRIES, REGIONS, getCountryName, getRegionName, type ShippingZone } from '@/lib/shipping-data';

interface ShippingPanelProps {
    siteId: string;
    shippingRequired: boolean;
    onShippingRequiredChange: (val: boolean) => void;
}

const EMPTY_FORM = {
    name: '',
    countries: [] as string[],
    regions: [] as string[],
    rate_type: 'flat' as 'flat' | 'free' | 'free_above',
    rate_cents: 0,
    free_threshold_cents: 0,
    is_local_pickup: false,
};

export default function ShippingPanel({ siteId, shippingRequired, onShippingRequiredChange }: ShippingPanelProps) {
    const [expanded, setExpanded] = useState(false);
    const [zones, setZones] = useState<ShippingZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });

    useEffect(() => {
        if (!expanded) return;
        loadZones();
    }, [siteId, expanded]);

    const loadZones = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/shipping-zones?siteId=${siteId}`);
            const data = await res.json();
            setZones(data.zones || []);
        } catch (err) {
            console.error('Failed to load shipping zones:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.name.trim() || form.countries.length === 0) return;
        setSaving(true);

        try {
            const payload = {
                ...form,
                rate_cents: Math.round(form.rate_cents),
                free_threshold_cents: Math.round(form.free_threshold_cents),
            };

            if (editingId) {
                const res = await fetch('/api/shipping-zones', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingId, siteId, ...payload }),
                });
                const data = await res.json();
                if (data.zone) {
                    setZones(zones.map(z => z.id === editingId ? data.zone : z));
                }
            } else {
                const maxSort = zones.reduce((max, z) => Math.max(max, z.sort_order), -1);
                const res = await fetch('/api/shipping-zones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ siteId, ...payload, sort_order: maxSort + 1 }),
                });
                const data = await res.json();
                if (data.zone) {
                    setZones([...zones, data.zone]);
                }
            }

            setForm({ ...EMPTY_FORM });
            setShowForm(false);
            setEditingId(null);
        } catch (err) {
            console.error('Failed to save zone:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch(`/api/shipping-zones?id=${id}`, { method: 'DELETE' });
            setZones(zones.filter(z => z.id !== id));
        } catch (err) {
            console.error('Failed to delete zone:', err);
        }
    };

    const startEdit = (zone: ShippingZone) => {
        setForm({
            name: zone.name,
            countries: zone.countries,
            regions: zone.regions,
            rate_type: zone.rate_type,
            rate_cents: zone.rate_cents,
            free_threshold_cents: zone.free_threshold_cents,
            is_local_pickup: zone.is_local_pickup,
        });
        setEditingId(zone.id);
        setShowForm(true);
    };

    const cancelForm = () => {
        setForm({ ...EMPTY_FORM });
        setShowForm(false);
        setEditingId(null);
    };

    // Which countries have region lists available
    const selectedCountriesWithRegions = form.countries.filter(c => REGIONS[c]);

    // Build flat region options for selected countries
    const availableRegions: Array<{ code: string; name: string; country: string }> = [];
    for (const cc of selectedCountriesWithRegions) {
        for (const r of (REGIONS[cc] || [])) {
            availableRegions.push({ code: r.code, name: r.name, country: cc });
        }
    }

    return (
        <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Truck className="w-4 h-4 text-slate-500" />
                    Shipping
                </span>
                {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {expanded && (
                <div className="border-t border-slate-200 p-4 space-y-4">
                    {/* Shipping required toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Physical products</p>
                            <p className="text-xs text-slate-500">Require shipping address at checkout</p>
                        </div>
                        <button
                            onClick={() => onShippingRequiredChange(!shippingRequired)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${shippingRequired ? 'bg-green-500' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${shippingRequired ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>

                    {shippingRequired && (
                        <>
                            {loading ? (
                                <div className="py-6 text-center">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                                </div>
                            ) : (
                                <>
                                    {/* Zone list */}
                                    {zones.length === 0 && !showForm && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-semibold text-amber-800">No shipping zones configured</p>
                                                    <p className="text-xs text-amber-600 mt-0.5">Customers won&apos;t be able to check out until you add at least one zone.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {zones.length > 0 && (
                                        <div className="space-y-2">
                                            {zones.map(zone => (
                                                <div key={zone.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                                                    <GripVertical className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            {zone.is_local_pickup ? (
                                                                <PackageIcon className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                                                            ) : (
                                                                <Globe className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                                            )}
                                                            <span className="text-sm font-semibold text-slate-800 truncate">{zone.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-xs text-slate-500">
                                                                {zone.countries.map(c => getCountryName(c)).join(', ')}
                                                                {zone.regions.length > 0 && ` (${zone.regions.map(r => r).join(', ')})`}
                                                            </span>
                                                            <span className="text-xs font-medium text-slate-600">
                                                                {zone.is_local_pickup ? 'Pickup' :
                                                                    zone.rate_type === 'free' ? 'Free' :
                                                                        zone.rate_type === 'free_above' ? `$${(zone.rate_cents / 100).toFixed(2)} / Free over $${(zone.free_threshold_cents / 100).toFixed(0)}` :
                                                                            `$${(zone.rate_cents / 100).toFixed(2)}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => startEdit(zone)} className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded">Edit</button>
                                                    <button onClick={() => handleDelete(zone.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add / Edit form */}
                                    {showForm ? (
                                        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                                            <h4 className="text-sm font-bold text-slate-800">{editingId ? 'Edit Zone' : 'Add Shipping Zone'}</h4>

                                            {/* Zone name */}
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 block mb-1">Zone Name</label>
                                                <input
                                                    type="text"
                                                    value={form.name}
                                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                                    placeholder="e.g. Local, Canada, US"
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>

                                            {/* Countries multi-select */}
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 block mb-1">Countries</label>
                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                    {form.countries.map(code => (
                                                        <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                                                            {getCountryName(code)}
                                                            <button onClick={() => setForm({ ...form, countries: form.countries.filter(c => c !== code), regions: form.regions.filter(r => !REGIONS[code]?.some(reg => reg.code === r)) })} className="hover:text-blue-900">&times;</button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <select
                                                    value=""
                                                    onChange={e => {
                                                        if (e.target.value && !form.countries.includes(e.target.value)) {
                                                            setForm({ ...form, countries: [...form.countries, e.target.value] });
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">Add country...</option>
                                                    {COUNTRIES.filter(c => !form.countries.includes(c.code)).map(c => (
                                                        <option key={c.code} value={c.code}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Regions (optional) */}
                                            {availableRegions.length > 0 && (
                                                <div>
                                                    <label className="text-xs font-medium text-slate-600 block mb-1">
                                                        Regions <span className="font-normal text-slate-400">(optional — leave empty for all regions)</span>
                                                    </label>
                                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                                        {form.regions.map(code => {
                                                            const reg = availableRegions.find(r => r.code === code);
                                                            return (
                                                                <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                                                                    {reg?.name || code}
                                                                    <button onClick={() => setForm({ ...form, regions: form.regions.filter(r => r !== code) })} className="hover:text-green-900">&times;</button>
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                    <select
                                                        value=""
                                                        onChange={e => {
                                                            if (e.target.value && !form.regions.includes(e.target.value)) {
                                                                setForm({ ...form, regions: [...form.regions, e.target.value] });
                                                            }
                                                        }}
                                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">Add region...</option>
                                                        {availableRegions.filter(r => !form.regions.includes(r.code)).map(r => (
                                                            <option key={`${r.country}-${r.code}`} value={r.code}>{r.name} ({r.country})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Local pickup */}
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.is_local_pickup}
                                                    onChange={e => setForm({ ...form, is_local_pickup: e.target.checked, rate_type: e.target.checked ? 'free' : form.rate_type })}
                                                    className="rounded border-slate-300"
                                                />
                                                <span className="text-sm text-slate-700">Local pickup (no shipping cost)</span>
                                            </label>

                                            {/* Rate type */}
                                            {!form.is_local_pickup && (
                                                <div>
                                                    <label className="text-xs font-medium text-slate-600 block mb-1.5">Rate Type</label>
                                                    <div className="space-y-1.5">
                                                        {([
                                                            { key: 'flat', label: 'Flat rate', desc: 'Fixed shipping cost' },
                                                            { key: 'free', label: 'Free shipping', desc: 'No shipping cost' },
                                                            { key: 'free_above', label: 'Free above threshold', desc: 'Flat rate, free when subtotal exceeds amount' },
                                                        ] as const).map(opt => (
                                                            <label key={opt.key} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${form.rate_type === opt.key ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                                <input
                                                                    type="radio"
                                                                    name="rate_type"
                                                                    checked={form.rate_type === opt.key}
                                                                    onChange={() => setForm({ ...form, rate_type: opt.key })}
                                                                    className="text-blue-500"
                                                                />
                                                                <div>
                                                                    <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                                                                    <p className="text-xs text-slate-500">{opt.desc}</p>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Rate amount */}
                                            {!form.is_local_pickup && (form.rate_type === 'flat' || form.rate_type === 'free_above') && (
                                                <div>
                                                    <label className="text-xs font-medium text-slate-600 block mb-1">Shipping Rate ($)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={(form.rate_cents / 100).toFixed(2)}
                                                        onChange={e => setForm({ ...form, rate_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                                                        className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            )}

                                            {/* Free threshold */}
                                            {!form.is_local_pickup && form.rate_type === 'free_above' && (
                                                <div>
                                                    <label className="text-xs font-medium text-slate-600 block mb-1">Free shipping when subtotal exceeds ($)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={(form.free_threshold_cents / 100).toFixed(0)}
                                                        onChange={e => setForm({ ...form, free_threshold_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                                                        className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            )}

                                            {/* Form actions */}
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving || !form.name.trim() || form.countries.length === 0}
                                                    className="px-4 py-2 text-sm font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-40 flex items-center gap-1.5"
                                                >
                                                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                                    {editingId ? 'Save Changes' : 'Add Zone'}
                                                </button>
                                                <button
                                                    onClick={cancelForm}
                                                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setForm({ ...EMPTY_FORM }); setShowForm(true); setEditingId(null); }}
                                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Shipping Zone
                                        </button>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
