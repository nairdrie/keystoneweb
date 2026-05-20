'use client';

import { useState, useEffect } from 'react';
import {
    Loader2, Plus, Trash2, GripVertical,
    Package as PackageIcon, Globe, AlertCircle, Truck, Check
} from 'lucide-react';
import { COUNTRIES, REGIONS, getCountryName, type ShippingZone, type PackagingBox } from '@/lib/shipping-data';

interface ShippingPanelProps {
    siteId: string;
    shippingRequired: boolean;
    onShippingRequiredChange: (val: boolean) => void;
}

type RateType = 'flat' | 'free' | 'free_above' | 'carrier';

/**
 * Common Shippo servicelevel tokens. Empty `carrier_services` on a zone means
 * "accept any rate Shippo returns" — the merchant picks from this list to
 * restrict to specific services.
 */
const CARRIER_SERVICES: Array<{ token: string; label: string }> = [
    { token: 'usps_priority', label: 'USPS Priority Mail' },
    { token: 'usps_ground_advantage', label: 'USPS Ground Advantage' },
    { token: 'usps_priority_express', label: 'USPS Priority Mail Express' },
    { token: 'ups_ground', label: 'UPS Ground' },
    { token: 'ups_3_day_select', label: 'UPS 3 Day Select' },
    { token: 'ups_2nd_day_air', label: 'UPS 2nd Day Air' },
    { token: 'ups_next_day_air_saver', label: 'UPS Next Day Air Saver' },
    { token: 'ups_next_day_air', label: 'UPS Next Day Air' },
    { token: 'fedex_ground', label: 'FedEx Ground' },
    { token: 'fedex_express_saver', label: 'FedEx Express Saver' },
    { token: 'fedex_2_day', label: 'FedEx 2 Day' },
    { token: 'fedex_standard_overnight', label: 'FedEx Standard Overnight' },
    { token: 'fedex_priority_overnight', label: 'FedEx Priority Overnight' },
    { token: 'canada_post_regular_parcel', label: 'Canada Post Regular Parcel' },
    { token: 'canada_post_expedited_parcel', label: 'Canada Post Expedited' },
    { token: 'canada_post_xpresspost', label: 'Canada Post Xpresspost' },
    { token: 'canada_post_priority', label: 'Canada Post Priority' },
    { token: 'dhl_express_worldwide', label: 'DHL Express Worldwide' },
];

const EMPTY_FORM = {
    name: '',
    countries: [] as string[],
    regions: [] as string[],
    rate_type: 'flat' as RateType,
    rate_cents: 0,
    free_threshold_cents: 0,
    is_local_pickup: false,
    carrier_services: [] as string[],
    markup_type: 'exact' as 'exact' | 'flat',
    markup_cents: 0,
};

interface OriginForm {
    origin_line1: string;
    origin_line2: string;
    origin_city: string;
    origin_region: string;
    origin_postal: string;
    origin_country: string;
}

export default function ShippingPanel({ siteId, shippingRequired, onShippingRequiredChange }: ShippingPanelProps) {
    const [zones, setZones] = useState<ShippingZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [rateInput, setRateInput] = useState('0.00');
    const [thresholdInput, setThresholdInput] = useState('0');
    const [markupInput, setMarkupInput] = useState('0.00');

    // Ship-from / origin settings. Shippo itself is configured platform-wide
    // by Keystone; merchants only supply their warehouse address.
    const [origin, setOrigin] = useState<OriginForm>({
        origin_line1: '', origin_line2: '',
        origin_city: '', origin_region: '', origin_postal: '', origin_country: 'US',
    });
    const [shippoConfigured, setShippoConfigured] = useState(false);
    const [originSaving, setOriginSaving] = useState(false);
    const [originSaved, setOriginSaved] = useState(false);

    // Box catalog. Merchant defines one or more boxes; the packer picks per
    // cart and we send the cheapest plan to Shippo.
    const [boxes, setBoxes] = useState<PackagingBox[]>([]);
    const [boxesSaving, setBoxesSaving] = useState(false);
    const [boxesSaved, setBoxesSaved] = useState(false);
    const [newBox, setNewBox] = useState({
        name: '', length_mm: '', width_mm: '', height_mm: '',
        tare_grams: '0', max_payload_grams: '30000',
    });

    useEffect(() => {
        loadZones();
        loadShippoSettings();
    }, [siteId]);

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

    const loadShippoSettings = async () => {
        try {
            const res = await fetch(`/api/products/settings?siteId=${siteId}`);
            const data = await res.json();
            const s = data.settings || {};
            setOrigin({
                origin_line1: s.origin_line1 || '',
                origin_line2: s.origin_line2 || '',
                origin_city: s.origin_city || '',
                origin_region: s.origin_region || '',
                origin_postal: s.origin_postal || '',
                origin_country: s.origin_country || 'US',
            });
            setShippoConfigured(!!s.shippo_configured);
            setBoxes(Array.isArray(s.packaging_boxes) ? s.packaging_boxes : []);
        } catch (err) {
            console.error('Failed to load shipping settings:', err);
        }
    };

    const saveBoxes = async (next: PackagingBox[]) => {
        setBoxesSaving(true);
        setBoxesSaved(false);
        try {
            const res = await fetch('/api/products/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, packaging_boxes: next }),
            });
            if (res.ok) {
                setBoxes(next);
                setBoxesSaved(true);
                setTimeout(() => setBoxesSaved(false), 2000);
            }
        } catch (err) {
            console.error('Failed to save boxes:', err);
        } finally {
            setBoxesSaving(false);
        }
    };

    const addBox = () => {
        const n = newBox.name.trim();
        const l = parseInt(newBox.length_mm, 10);
        const w = parseInt(newBox.width_mm, 10);
        const h = parseInt(newBox.height_mm, 10);
        const tare = parseInt(newBox.tare_grams || '0', 10) || 0;
        const cap = parseInt(newBox.max_payload_grams || '30000', 10) || 30000;
        if (!n || !l || !w || !h) return;
        const next = [...boxes, {
            id: crypto.randomUUID(),
            name: n,
            length_mm: l, width_mm: w, height_mm: h,
            tare_grams: tare, max_payload_grams: cap,
        }];
        setNewBox({ name: '', length_mm: '', width_mm: '', height_mm: '', tare_grams: '0', max_payload_grams: '30000' });
        saveBoxes(next);
    };

    const removeBox = (id: string) => saveBoxes(boxes.filter(b => b.id !== id));

    const saveOrigin = async () => {
        setOriginSaving(true);
        setOriginSaved(false);
        try {
            const res = await fetch('/api/products/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, ...origin }),
            });
            if (res.ok) {
                setOriginSaved(true);
                setTimeout(() => setOriginSaved(false), 2500);
            }
        } catch (err) {
            console.error('Failed to save shipping settings:', err);
        } finally {
            setOriginSaving(false);
        }
    };

    const handleSave = async () => {
        if (!form.name.trim() || form.countries.length === 0) return;
        setSaving(true);

        try {
            const rateCents = Math.round((parseFloat(rateInput) || 0) * 100);
            const thresholdCents = Math.round((parseFloat(thresholdInput) || 0) * 100);
            const markupCents = Math.round((parseFloat(markupInput) || 0) * 100);
            const payload = {
                ...form,
                rate_cents: rateCents,
                free_threshold_cents: thresholdCents,
                markup_cents: markupCents,
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
            setRateInput('0.00');
            setThresholdInput('0');
            setMarkupInput('0.00');
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
            carrier_services: Array.isArray(zone.carrier_services) ? zone.carrier_services : [],
            markup_type: zone.markup_type || 'exact',
            markup_cents: zone.markup_cents || 0,
        });
        setRateInput((zone.rate_cents / 100).toFixed(2));
        setThresholdInput((zone.free_threshold_cents / 100).toFixed(0));
        setMarkupInput(((zone.markup_cents || 0) / 100).toFixed(2));
        setEditingId(zone.id);
        setShowForm(true);
    };

    const cancelForm = () => {
        setForm({ ...EMPTY_FORM });
        setRateInput('0.00');
        setThresholdInput('0');
        setMarkupInput('0.00');
        setShowForm(false);
        setEditingId(null);
    };

    const toggleService = (token: string) => {
        setForm(f => f.carrier_services.includes(token)
            ? { ...f, carrier_services: f.carrier_services.filter(s => s !== token) }
            : { ...f, carrier_services: [...f.carrier_services, token] });
    };

    // Which countries have region lists available
    const selectedCountriesWithRegions = form.countries.filter(c => REGIONS[c]);
    const availableRegions: Array<{ code: string; name: string; country: string }> = [];
    for (const cc of selectedCountriesWithRegions) {
        for (const r of (REGIONS[cc] || [])) {
            availableRegions.push({ code: r.code, name: r.name, country: cc });
        }
    }

    const originRegions = REGIONS[origin.origin_country] || [];

    const zoneSummary = (zone: ShippingZone): string => {
        if (zone.is_local_pickup) return 'Pickup';
        if (zone.rate_type === 'carrier') {
            const count = Array.isArray(zone.carrier_services) ? zone.carrier_services.length : 0;
            const services = count === 0 ? 'all services' : `${count} service${count === 1 ? '' : 's'}`;
            const markup = zone.markup_type === 'flat' && zone.markup_cents > 0
                ? ` + $${(zone.markup_cents / 100).toFixed(2)}`
                : '';
            return `Live rates (${services})${markup}`;
        }
        if (zone.rate_type === 'free') return 'Free';
        if (zone.rate_type === 'free_above') {
            return `$${(zone.rate_cents / 100).toFixed(2)} / Free over $${(zone.free_threshold_cents / 100).toFixed(0)}`;
        }
        return `$${(zone.rate_cents / 100).toFixed(2)}`;
    };

    return (
        <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 space-y-4">
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
                        {/* ── Ship-from (origin) address ── */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-slate-500" />
                                <h4 className="text-sm font-bold text-slate-800">Ship-from Address</h4>
                            </div>
                            <p className="text-xs text-slate-500">
                                Required for live carrier rate quoting. Your warehouse or shop address.
                            </p>

                            {/* Country */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 block mb-1">Country</label>
                                <select
                                    value={origin.origin_country}
                                    onChange={e => setOrigin({ ...origin, origin_country: e.target.value, origin_region: '' })}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                    {COUNTRIES.map(c => (
                                        <option key={c.code} value={c.code}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-600 block mb-1">Street Address</label>
                                <input
                                    type="text"
                                    value={origin.origin_line1}
                                    onChange={e => setOrigin({ ...origin, origin_line1: e.target.value })}
                                    placeholder="123 Main St"
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-medium text-slate-600 block mb-1">City</label>
                                    <input
                                        type="text"
                                        value={origin.origin_city}
                                        onChange={e => setOrigin({ ...origin, origin_city: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 block mb-1">
                                        {origin.origin_country === 'US' ? 'State' : 'Province'}
                                    </label>
                                    {originRegions.length > 0 ? (
                                        <select
                                            value={origin.origin_region}
                                            onChange={e => setOrigin({ ...origin, origin_region: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        >
                                            <option value="">Select</option>
                                            {originRegions.map(r => <option key={r.code} value={r.code}>{r.code}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={origin.origin_region}
                                            onChange={e => setOrigin({ ...origin, origin_region: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        />
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-600 block mb-1">Postal / ZIP</label>
                                <input
                                    type="text"
                                    value={origin.origin_postal}
                                    onChange={e => setOrigin({ ...origin, origin_postal: e.target.value })}
                                    placeholder={origin.origin_country === 'US' ? '10001' : 'A1B 2C3'}
                                    className="w-40 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                />
                            </div>

                            <button
                                onClick={saveOrigin}
                                disabled={originSaving}
                                className="px-3 py-2 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {originSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                                {originSaved ? <><Check className="w-3 h-3" /> Saved</> : 'Save'}
                            </button>
                        </div>

                        {/* ── Box catalog ── */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PackageIcon className="w-4 h-4 text-slate-500" />
                                    <h4 className="text-sm font-bold text-slate-800">Box Catalog</h4>
                                </div>
                                {boxesSaved && (
                                    <span className="text-[11px] text-green-700 inline-flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Saved
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">
                                Boxes you keep in stock. At checkout we'll pick the cheapest combination that fits the order
                                — multiple parcels if needed.
                            </p>

                            {boxes.length === 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                                    <p className="text-xs text-amber-700">
                                        Add at least one box. Live carrier zones won't return rates until you do.
                                    </p>
                                </div>
                            )}

                            {boxes.length > 0 && (
                                <div className="space-y-1.5">
                                    {boxes.map(b => (
                                        <div key={b.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                            <PackageIcon className="w-3.5 h-3.5 text-slate-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 truncate">{b.name}</p>
                                                <p className="text-[11px] text-slate-500">
                                                    {b.length_mm}×{b.width_mm}×{b.height_mm} mm •
                                                    tare {b.tare_grams} g • max {(b.max_payload_grams / 1000).toFixed(1)} kg
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => removeBox(b.id)}
                                                disabled={boxesSaving}
                                                className="p-1 text-red-400 hover:bg-red-50 rounded disabled:opacity-50"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                                <p className="text-xs font-bold text-slate-700">Add a box</p>
                                <input
                                    type="text"
                                    value={newBox.name}
                                    onChange={e => setNewBox({ ...newBox, name: e.target.value })}
                                    placeholder="Name (e.g. Small Mailer)"
                                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    {(['length_mm', 'width_mm', 'height_mm'] as const).map(key => (
                                        <div key={key}>
                                            <label className="text-[11px] text-slate-500 block">{key.replace('_mm', '')} (mm)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={newBox[key]}
                                                onChange={e => setNewBox({ ...newBox, [key]: e.target.value })}
                                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] text-slate-500 block">tare (g)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newBox.tare_grams}
                                            onChange={e => setNewBox({ ...newBox, tare_grams: e.target.value })}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-slate-500 block">max payload (g)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={newBox.max_payload_grams}
                                            onChange={e => setNewBox({ ...newBox, max_payload_grams: e.target.value })}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={addBox}
                                    disabled={boxesSaving || !newBox.name.trim() || !newBox.length_mm || !newBox.width_mm || !newBox.height_mm}
                                    className="w-full px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
                                >
                                    {boxesSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                                    <Plus className="w-3 h-3" /> Add box
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="py-6 text-center">
                                <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                            </div>
                        ) : (
                            <>
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
                                                        ) : zone.rate_type === 'carrier' ? (
                                                            <Truck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                                        ) : (
                                                            <Globe className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                                        )}
                                                        <span className="text-sm font-semibold text-slate-800 truncate">{zone.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-slate-500">
                                                            {zone.countries.map(c => getCountryName(c)).join(', ')}
                                                            {zone.regions.length > 0 && ` (${zone.regions.join(', ')})`}
                                                        </span>
                                                        <span className="text-xs font-medium text-slate-600">{zoneSummary(zone)}</span>
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

                                {showForm ? (
                                    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                                        <h4 className="text-sm font-bold text-slate-800">{editingId ? 'Edit Zone' : 'Add Shipping Zone'}</h4>

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

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.is_local_pickup}
                                                onChange={e => setForm({ ...form, is_local_pickup: e.target.checked, rate_type: e.target.checked ? 'free' : form.rate_type })}
                                                className="rounded border-slate-300"
                                            />
                                            <span className="text-sm text-slate-700">Local pickup (no shipping cost)</span>
                                        </label>

                                        {!form.is_local_pickup && (
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 block mb-1.5">Rate Type</label>
                                                <div className="space-y-1.5">
                                                    {([
                                                        { key: 'flat', label: 'Flat rate', desc: 'Fixed shipping cost' },
                                                        { key: 'free', label: 'Free shipping', desc: 'No shipping cost' },
                                                        { key: 'free_above', label: 'Free above threshold', desc: 'Flat rate, free when subtotal exceeds amount' },
                                                        { key: 'carrier', label: 'Live carrier rates', desc: 'Quote real-time prices from USPS, UPS, FedEx, etc. via Shippo' },
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

                                        {!form.is_local_pickup && (form.rate_type === 'flat' || form.rate_type === 'free_above') && (
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 block mb-1">Shipping Rate ($)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={rateInput}
                                                    onChange={e => setRateInput(e.target.value)}
                                                    onBlur={() => {
                                                        const n = parseFloat(rateInput);
                                                        setRateInput(isNaN(n) || n < 0 ? '0.00' : n.toFixed(2));
                                                    }}
                                                    className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        )}

                                        {!form.is_local_pickup && form.rate_type === 'free_above' && (
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 block mb-1">Free shipping when subtotal exceeds ($)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={thresholdInput}
                                                    onChange={e => setThresholdInput(e.target.value)}
                                                    onBlur={() => {
                                                        const n = parseFloat(thresholdInput);
                                                        setThresholdInput(isNaN(n) || n < 0 ? '0' : Math.round(n).toString());
                                                    }}
                                                    className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        )}

                                        {/* Carrier zone: services + markup */}
                                        {!form.is_local_pickup && form.rate_type === 'carrier' && (
                                            <>
                                                {!shippoConfigured && (
                                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                                                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                        <p className="text-xs text-amber-700">
                                                            Live rates aren&apos;t available on this Keystone install yet. Contact support to enable them.
                                                        </p>
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="text-xs font-medium text-slate-600 block mb-1">
                                                        Allowed services <span className="font-normal text-slate-400">(leave empty to allow all)</span>
                                                    </label>
                                                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
                                                        {CARRIER_SERVICES.map(s => (
                                                            <label key={s.token} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={form.carrier_services.includes(s.token)}
                                                                    onChange={() => toggleService(s.token)}
                                                                    className="rounded border-slate-300"
                                                                />
                                                                <span className="text-slate-700">{s.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-xs font-medium text-slate-600 block mb-1.5">Markup</label>
                                                    <div className="space-y-1.5">
                                                        {([
                                                            { key: 'exact', label: 'Exact', desc: 'Pass the carrier rate through unchanged' },
                                                            { key: 'flat', label: 'Flat markup', desc: 'Add a fixed handling fee to every rate' },
                                                        ] as const).map(opt => (
                                                            <label key={opt.key} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${form.markup_type === opt.key ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                                <input
                                                                    type="radio"
                                                                    name="markup_type"
                                                                    checked={form.markup_type === opt.key}
                                                                    onChange={() => setForm({ ...form, markup_type: opt.key })}
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

                                                {form.markup_type === 'flat' && (
                                                    <div>
                                                        <label className="text-xs font-medium text-slate-600 block mb-1">Flat markup ($)</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={markupInput}
                                                            onChange={e => setMarkupInput(e.target.value)}
                                                            onBlur={() => {
                                                                const n = parseFloat(markupInput);
                                                                setMarkupInput(isNaN(n) || n < 0 ? '0.00' : n.toFixed(2));
                                                            }}
                                                            className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}

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
        </div>
    );
}
