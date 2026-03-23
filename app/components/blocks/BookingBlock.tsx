'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import {
    Calendar, Clock, Plus, Trash2, Settings, ChevronLeft, ChevronRight,
    Check, Loader2, User, Mail, Phone, MessageSquare, DollarSign, LayoutTemplate,
    Edit2, Search, X, CreditCard, Package
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ServiceOption {
    id: string;
    name: string;
    price_cents: number;
}

interface Service {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price_cents: number;
    currency: string;
    is_active: boolean;
    sort_order: number;
    category_id?: string | null;
    booking_categories?: { name: string } | null;
    options?: ServiceOption[] | null;
}

interface Category {
    id: string;
    name: string;
    sort_order: number;
}

interface AvailabilityDay {
    id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
}

interface BookingSettings {
    timezone: string;
    buffer_minutes: number;
    max_advance_days: number;
    require_payment: boolean;
    payment_methods: { none: boolean; etransfer: boolean; stripe: boolean };
    etransfer_email: string | null;
    confirmation_message: string | null;
    notification_email: string | null;
}

interface Slot {
    startTime: string;
    endTime: string;
    display: string;
}

interface BookingBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function BookingBlock({ id, data, isEditMode, palette, updateContent }: BookingBlockProps) {
    const context = useEditorContext();
    const siteId = context?.siteId;

    if (!siteId) {
        return <div className="py-12 text-center text-slate-400">Booking block requires a saved site.</div>;
    }

    if (isEditMode) {
        return <BookingSetup siteId={siteId} palette={palette} />;
    }

    return <BookingFlow siteId={siteId} palette={palette} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR: Booking Setup
// ═══════════════════════════════════════════════════════════════════════════════

function BookingSetup({ siteId, palette }: { siteId: string; palette: Record<string, string> }) {
    const [activeTab, setActiveTab] = useState<'categories' | 'services' | 'hours' | 'settings'>('services');
    const [categories, setCategories] = useState<Category[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
    const [settings, setSettings] = useState<BookingSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';

    // Initialize booking settings if they don't exist, then load data
    useEffect(() => {
        (async () => {
            setLoading(true);
            // Ensure settings exist (creates default availability via trigger)
            const settingsRes = await fetch(`/api/bookings/settings?siteId=${siteId}`);
            const settingsData = await settingsRes.json();

            if (!settingsData.settings) {
                await fetch('/api/bookings/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ siteId }),
                });
            }

            // Now fetch everything
            const [catRes, svcRes, avRes, stRes] = await Promise.all([
                fetch(`/api/bookings/categories?siteId=${siteId}`),
                fetch(`/api/bookings/services?siteId=${siteId}`),
                fetch(`/api/bookings/availability?siteId=${siteId}`),
                fetch(`/api/bookings/settings?siteId=${siteId}`),
            ]);

            const catData = await catRes.json();
            const svcData = await svcRes.json();
            const avData = await avRes.json();
            const stData = await stRes.json();

            setCategories(catData.categories || []);
            setServices(svcData.services || []);
            setAvailability(avData.availability || []);
            setSettings(stData.settings || null);
            setLoading(false);
        })();
    }, [siteId]);

    if (loading) {
        return (
            <section className="py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                <p className="text-sm text-slate-500 mt-3">Loading booking setup...</p>
            </section>
        );
    }

    const tabs = [
        { id: 'categories' as const, label: 'Categories', icon: <LayoutTemplate className="w-4 h-4" /> },
        { id: 'services' as const, label: 'Services', icon: <DollarSign className="w-4 h-4" /> },
        { id: 'hours' as const, label: 'Hours', icon: <Clock className="w-4 h-4" /> },
        { id: 'settings' as const, label: 'Settings', icon: <Settings className="w-4 h-4" /> },
    ];

    return (
        <section className="py-12 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white border-2 border-blue-200 rounded-2xl shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            Booking System Setup
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Configure your services, hours, and settings</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {activeTab === 'categories' && (
                            <CategoriesEditor
                                siteId={siteId}
                                categories={categories}
                                setCategories={setCategories}
                            />
                        )}
                        {activeTab === 'services' && (
                            <ServicesEditor
                                siteId={siteId}
                                services={services}
                                setServices={setServices}
                                categories={categories}
                            />
                        )}
                        {activeTab === 'hours' && (
                            <HoursEditor
                                siteId={siteId}
                                availability={availability}
                                setAvailability={setAvailability}
                            />
                        )}
                        {activeTab === 'settings' && settings && (
                            <SettingsEditor
                                siteId={siteId}
                                settings={settings}
                                setSettings={setSettings}
                            />
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Categories Editor ──────────────────────────────────────────────────────────

function CategoriesEditor({ siteId, categories, setCategories }: {
    siteId: string;
    categories: Category[];
    setCategories: (c: Category[]) => void;
}) {
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setAdding(true);
        const res = await fetch('/api/bookings/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteId, name: newName }),
        });
        const data = await res.json();
        if (data.category) { setCategories([...categories, data.category]); setNewName(''); }
        setAdding(false);
    };

    const handleDelete = async (categoryId: string) => {
        await fetch(`/api/bookings/categories?id=${categoryId}`, { method: 'DELETE' });
        setCategories(categories.filter(c => c.id !== categoryId));
    };

    const handleSaveEdit = async (categoryId: string) => {
        if (!editName.trim()) return;
        const res = await fetch('/api/bookings/categories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: categoryId, name: editName.trim() }),
        });
        const data = await res.json();
        if (data.category) setCategories(categories.map(c => c.id === categoryId ? data.category : c));
        setEditingId(null);
    };

    return (
        <div className="space-y-4">
            {categories.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No categories yet. Add your first category below if you want to group your services.</p>
            )}
            {categories.map(category => (
                <div key={category.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                    {editingId === category.id ? (
                        <>
                            <input
                                type="text" value={editName}
                                onChange={e => setEditName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(category.id); if (e.key === 'Escape') setEditingId(null); }}
                                className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                            <button onClick={() => handleSaveEdit(category.id)} className="p-1 hover:bg-green-50 rounded text-green-600"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400"><X className="w-4 h-4" /></button>
                        </>
                    ) : (
                        <>
                            <div className="flex-1 min-w-0"><h4 className="font-semibold text-slate-900 text-sm">{category.name}</h4></div>
                            <button onClick={() => { setEditingId(category.id); setEditName(category.name); }} className="p-1 hover:bg-blue-50 rounded text-blue-400 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(category.id)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </>
                    )}
                </div>
            ))}
            <div className="flex gap-2">
                <input type="text" placeholder="Category name (e.g. Haircuts, Massages)" value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={handleAdd} disabled={adding || !newName.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors flex items-center gap-2">
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                </button>
            </div>
        </div>
    );
}

// ─── Services Editor ────────────────────────────────────────────────────────────

// ─── Service Options Editor ─────────────────────────────────────────────────────

function ServiceOptionsEditor({ options, onChange }: {
    options: ServiceOption[];
    onChange: (opts: ServiceOption[]) => void;
}) {
    const [newOptName, setNewOptName] = useState('');
    const [newOptPrice, setNewOptPrice] = useState('');

    const addOption = () => {
        if (!newOptName.trim() || !newOptPrice) return;
        const opt: ServiceOption = {
            id: crypto.randomUUID(),
            name: newOptName.trim(),
            price_cents: Math.round(parseFloat(newOptPrice) * 100),
        };
        onChange([...options, opt]);
        setNewOptName('');
        setNewOptPrice('');
    };

    return (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Package className="w-3 h-3" /> Booking Options (variants)</p>
            <p className="text-[11px] text-slate-400">Add named packages with separate pricing (e.g. Single, 5-Pack). Leave empty to use the base price above.</p>
            {options.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate text-slate-700">{opt.name}</span>
                    <span className="text-green-700 font-semibold">${(opt.price_cents / 100).toFixed(2)}</span>
                    <button onClick={() => onChange(options.filter((_, j) => j !== i))} className="p-0.5 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                </div>
            ))}
            <div className="flex gap-2">
                <input type="text" placeholder="Option name (e.g. 5-Pack)" value={newOptName}
                    onChange={e => setNewOptName(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <input type="number" placeholder="Price $" value={newOptPrice} min="0" step="0.01"
                    onChange={e => setNewOptPrice(e.target.value)}
                    className="w-24 px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <button onClick={addOption} disabled={!newOptName.trim() || !newOptPrice}
                    className="px-2 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs rounded disabled:opacity-40">
                    <Plus className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

// ─── Services Editor ────────────────────────────────────────────────────────────

function ServicesEditor({ siteId, services, setServices, categories }: {
    siteId: string;
    services: Service[];
    setServices: (s: Service[]) => void;
    categories: Category[];
}) {
    const [adding, setAdding] = useState(false);
    // Track which service is being edited
    const [editingId, setEditingId] = useState<string | null>(null);
    type EditState = { name: string; desc: string; duration: number; price: string; category: string; options: ServiceOption[] };
    const [editState, setEditState] = useState<EditState | null>(null);
    const [newName, setNewName] = useState('');
    const [newDuration, setNewDuration] = useState(30);
    const [newPrice, setNewPrice] = useState('0');
    const [newDesc, setNewDesc] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [newOptions, setNewOptions] = useState<ServiceOption[]>([]);

    const startEdit = (service: Service) => {
        setEditingId(service.id);
        setEditState({
            name: service.name,
            desc: service.description || '',
            duration: service.duration_minutes,
            price: (service.price_cents / 100).toFixed(2),
            category: service.category_id || '',
            options: service.options || [],
        });
    };

    const handleSaveEdit = async (serviceId: string) => {
        if (!editState || !editState.name.trim()) return;
        const res = await fetch('/api/bookings/services', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: serviceId,
                name: editState.name.trim(),
                description: editState.desc || null,
                duration_minutes: editState.duration,
                price_cents: Math.round(parseFloat(editState.price) * 100),
                category_id: editState.category || null,
                options: editState.options.length > 0 ? editState.options : null,
            }),
        });
        const data = await res.json();
        if (data.service) setServices(services.map(s => s.id === serviceId ? data.service : s));
        setEditingId(null);
        setEditState(null);
    };

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setAdding(true);
        const res = await fetch('/api/bookings/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                siteId,
                name: newName,
                description: newDesc || null,
                duration_minutes: newDuration,
                price_cents: Math.round(parseFloat(newPrice) * 100),
                category_id: newCategory || null,
                options: newOptions.length > 0 ? newOptions : null,
            }),
        });
        const data = await res.json();
        if (data.service) {
            setServices([...services, data.service]);
            setNewName(''); setNewDuration(30); setNewPrice('0'); setNewDesc(''); setNewCategory(''); setNewOptions([]);
        }
        setAdding(false);
    };

    const handleDelete = async (serviceId: string) => {
        await fetch(`/api/bookings/services?id=${serviceId}`, { method: 'DELETE' });
        setServices(services.filter(s => s.id !== serviceId));
    };

    const handleToggle = async (service: Service) => {
        const res = await fetch('/api/bookings/services', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: service.id, is_active: !service.is_active }),
        });
        const data = await res.json();
        if (data.service) setServices(services.map(s => s.id === service.id ? data.service : s));
    };

    const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

    return (
        <div className="space-y-4">
            {services.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No services yet. Add your first service below.</p>
            )}

            {services.map(service => (
                <div key={service.id} className={`rounded-lg border ${service.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                    {/* Row header */}
                    <div className="flex items-start gap-3 p-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-slate-900 text-sm">{service.name}</h4>
                                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{service.duration_minutes} min</span>
                                {service.price_cents > 0 && (
                                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                        ${(service.price_cents / 100).toFixed(2)} {service.currency}
                                    </span>
                                )}
                                {service.options && service.options.length > 0 && (
                                    <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full flex items-center gap-1">
                                        <Package className="w-3 h-3" />{service.options.length} options
                                    </span>
                                )}
                            </div>
                            {service.description && <p className="text-xs text-slate-500 mt-1">{service.description}</p>}
                            {service.booking_categories?.name && (
                                <p className="text-[10px] uppercase font-bold text-blue-500 mt-1 tracking-wider">{service.booking_categories.name}</p>
                            )}
                        </div>
                        <button onClick={() => editingId === service.id ? (setEditingId(null), setEditState(null)) : startEdit(service)}
                            className="p-1 hover:bg-blue-50 rounded text-blue-400 hover:text-blue-600">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggle(service)} className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600">
                            {service.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => handleDelete(service.id)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Inline edit form */}
                    {editingId === service.id && editState && (
                        <div className="border-t border-blue-100 bg-blue-50 p-4 space-y-3">
                            <input type="text" placeholder="Service name" value={editState.name}
                                onChange={e => setEditState({ ...editState, name: e.target.value })}
                                className={inputCls} />
                            <input type="text" placeholder="Description (optional)" value={editState.desc}
                                onChange={e => setEditState({ ...editState, desc: e.target.value })}
                                className={inputCls} />
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Duration</label>
                                    <select value={editState.duration} onChange={e => setEditState({ ...editState, duration: parseInt(e.target.value) })} className={inputCls}>
                                        {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Base Price ($)</label>
                                    <input type="number" step="0.01" min="0" value={editState.price}
                                        onChange={e => setEditState({ ...editState, price: e.target.value })}
                                        className={inputCls} />
                                </div>
                            </div>
                            {categories.length > 0 && (
                                <select value={editState.category} onChange={e => setEditState({ ...editState, category: e.target.value })} className={inputCls}>
                                    <option value="">No Category</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                            <ServiceOptionsEditor options={editState.options} onChange={opts => setEditState({ ...editState, options: opts })} />
                            <div className="flex gap-2 pt-1">
                                <button onClick={() => handleSaveEdit(service.id)}
                                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2">
                                    <Check className="w-4 h-4" /> Save
                                </button>
                                <button onClick={() => { setEditingId(null); setEditState(null); }}
                                    className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {/* Add new service */}
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Add Service</h4>
                <input type="text" placeholder="Service name (e.g. Haircut, Consultation)" value={newName}
                    onChange={e => setNewName(e.target.value)} className={inputCls} />
                <input type="text" placeholder="Description (optional)" value={newDesc}
                    onChange={e => setNewDesc(e.target.value)} className={inputCls} />
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Duration (min)</label>
                        <select value={newDuration} onChange={e => setNewDuration(parseInt(e.target.value))} className={inputCls}>
                            {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} minutes</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Price ($)</label>
                        <input type="number" step="0.01" min="0" value={newPrice}
                            onChange={e => setNewPrice(e.target.value)} className={inputCls} />
                    </div>
                </div>
                {categories.length > 0 && (
                    <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className={inputCls}>
                        <option value="">No Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                )}
                <ServiceOptionsEditor options={newOptions} onChange={setNewOptions} />
                <button onClick={handleAdd} disabled={adding || !newName.trim()}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add Service
                </button>
            </div>
        </div>
    );
}

// ─── Hours Editor ───────────────────────────────────────────────────────────────

function HoursEditor({ siteId, availability, setAvailability }: {
    siteId: string;
    availability: AvailabilityDay[];
    setAvailability: (a: AvailabilityDay[]) => void;
}) {
    const [saving, setSaving] = useState(false);

    // Ensure all 7 days exist
    const days: AvailabilityDay[] = Array.from({ length: 7 }, (_, i) => {
        const existing = availability.find(a => a.day_of_week === i);
        return existing || { day_of_week: i, start_time: '09:00', end_time: '17:00', is_active: false };
    });

    const updateDay = (dayOfWeek: number, updates: Partial<AvailabilityDay>) => {
        const newDays = days.map(d =>
            d.day_of_week === dayOfWeek ? { ...d, ...updates } : d
        );
        setAvailability(newDays);
    };

    const handleSave = async () => {
        setSaving(true);
        await fetch('/api/bookings/availability', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteId, availability: days }),
        });
        setSaving(false);
    };

    return (
        <div className="space-y-3">
            {days.map(day => (
                <div key={day.day_of_week} className={`flex items-center gap-3 p-3 rounded-lg border ${day.is_active ? 'border-slate-200' : 'border-slate-100 bg-slate-50'}`}>
                    <label className="flex items-center gap-2 cursor-pointer min-w-[100px]">
                        <input
                            type="checkbox"
                            checked={day.is_active}
                            onChange={() => updateDay(day.day_of_week, { is_active: !day.is_active })}
                            className="rounded accent-blue-600"
                        />
                        <span className={`text-sm font-medium ${day.is_active ? 'text-slate-900' : 'text-slate-400'}`}>
                            {DAY_NAMES[day.day_of_week]}
                        </span>
                    </label>

                    {day.is_active && (
                        <div className="flex items-center gap-2 text-sm">
                            <input
                                type="time"
                                value={day.start_time}
                                onChange={e => updateDay(day.day_of_week, { start_time: e.target.value })}
                                className="px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                            <span className="text-slate-400">to</span>
                            <input
                                type="time"
                                value={day.end_time}
                                onChange={e => updateDay(day.day_of_week, { end_time: e.target.value })}
                                className="px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                        </div>
                    )}

                    {!day.is_active && (
                        <span className="text-xs text-slate-400">Closed</span>
                    )}
                </div>
            ))}

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Hours
            </button>
        </div>
    );
}

// ─── Settings Editor ────────────────────────────────────────────────────────────

function SettingsEditor({ siteId, settings, setSettings }: {
    siteId: string;
    settings: BookingSettings;
    setSettings: (s: BookingSettings) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [local, setLocal] = useState(settings);
    const [stripeConnected, setStripeConnected] = useState(false);
    const [connectingStripe, setConnectingStripe] = useState(false);

    // Check if Stripe is already connected for this site
    useEffect(() => {
        fetch(`/api/bookings/settings?siteId=${siteId}`)
            .then(r => r.json())
            .then(() => {
                // We'll check stripe via site endpoint
                fetch(`/api/stripe/connect-status?siteId=${siteId}`)
                    .then(r => r.ok ? r.json() : { connected: false })
                    .then(d => setStripeConnected(d.connected || false))
                    .catch(() => setStripeConnected(false));
            });
    }, [siteId]);

    const handleSave = async () => {
        setSaving(true);
        const res = await fetch('/api/bookings/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteId, ...local }),
        });
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
        setSaving(false);
    };

    const handleConnectStripe = async () => {
        setConnectingStripe(true);
        const returnUrl = window.location.href;
        const res = await fetch('/api/stripe/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteId, returnUrl }),
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else setConnectingStripe(false);
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Buffer Between Appointments</label>
                <select value={local.buffer_minutes} onChange={e => setLocal({ ...local, buffer_minutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                    {[0, 5, 10, 15, 30, 45, 60].map(m => (
                        <option key={m} value={m}>{m === 0 ? 'No buffer' : `${m} minutes`}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Max Advance Booking (days)</label>
                <input type="number" min="1" max="365" value={local.max_advance_days}
                    onChange={e => setLocal({ ...local, max_advance_days: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Notification Email</label>
                <input type="email" placeholder="you@business.ca" value={local.notification_email || ''}
                    onChange={e => setLocal({ ...local, notification_email: e.target.value || null })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                <p className="text-xs text-slate-400 mt-1">Where you'll receive booking notifications</p>
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Confirmation Message</label>
                <textarea value={local.confirmation_message || ''}
                    onChange={e => setLocal({ ...local, confirmation_message: e.target.value || null })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none"
                    rows={2} placeholder="Your booking has been confirmed!" />
            </div>

            {/* Payment Options */}
            <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Payment Options</label>
                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={local.payment_methods?.none !== false}
                            onChange={() => setLocal({ ...local, payment_methods: { ...local.payment_methods, none: !local.payment_methods?.none } })}
                            className="rounded accent-blue-600" />
                        <span className="text-sm text-slate-700">No payment required (pay in person)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={local.payment_methods?.etransfer || false}
                            onChange={() => setLocal({ ...local, payment_methods: { ...local.payment_methods, etransfer: !local.payment_methods?.etransfer } })}
                            className="rounded accent-blue-600" />
                        <span className="text-sm text-slate-700">Interac e-Transfer</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={local.payment_methods?.stripe || false}
                            onChange={() => setLocal({ ...local, payment_methods: { ...local.payment_methods, stripe: !local.payment_methods?.stripe } })}
                            className="rounded accent-blue-600" />
                        <span className="text-sm text-slate-700">Stripe (card payments online)</span>
                    </label>
                </div>
            </div>

            {local.payment_methods?.etransfer && (
                <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">e-Transfer Email</label>
                    <input type="email" placeholder="payments@business.ca" value={local.etransfer_email || ''}
                        onChange={e => setLocal({ ...local, etransfer_email: e.target.value || null })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
            )}

            {local.payment_methods?.stripe && (
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> Stripe Connect
                    </p>
                    {stripeConnected ? (
                        <div className="flex items-center gap-2 text-sm text-green-700">
                            <Check className="w-4 h-4" />
                            <span className="font-medium">Connected</span>
                            <span className="text-slate-500">— customers can pay by card at booking time</span>
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-slate-500 mb-2">Connect your Stripe account to accept card payments from customers.</p>
                            <button onClick={handleConnectStripe} disabled={connectingStripe}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors">
                                {connectingStripe ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                                Connect with Stripe
                            </button>
                        </>
                    )}
                </div>
            )}

            <button onClick={handleSave} disabled={saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Settings
            </button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER: Booking Flow
// ═══════════════════════════════════════════════════════════════════════════════

function BookingFlow({ siteId, palette }: { siteId: string; palette: Record<string, string> }) {
    const [step, setStep] = useState<'service' | 'option' | 'date' | 'time' | 'form' | 'confirmation'>('service');
    const [services, setServices] = useState<Service[]>([]);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedOption, setSelectedOption] = useState<ServiceOption | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
    const [loading, setLoading] = useState(true);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmation, setConfirmation] = useState<any>(null);
    const [settings, setSettings] = useState<BookingSettings | null>(null);

    // Payment method selection (shown in form step)
    const [chosenPaymentMethod, setChosenPaymentMethod] = useState<'none' | 'etransfer' | 'stripe'>('none');

    // Customer form
    const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });

    // Calendar state
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());

    // Filter + search
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';

    // Load services
    useEffect(() => {
        (async () => {
            const [svcRes, stRes] = await Promise.all([
                fetch(`/api/bookings/services?siteId=${siteId}`),
                fetch(`/api/bookings/settings?siteId=${siteId}`),
            ]);
            const svcData = await svcRes.json();
            const stData = await stRes.json();
            setServices((svcData.services || []).filter((s: Service) => s.is_active));
            setSettings(stData.settings || null);
            setLoading(false);
        })();
    }, [siteId]);

    // Default payment method when settings load
    useEffect(() => {
        if (!settings) return;
        if (settings.payment_methods?.none !== false) setChosenPaymentMethod('none');
        else if (settings.payment_methods?.etransfer) setChosenPaymentMethod('etransfer');
        else if (settings.payment_methods?.stripe) setChosenPaymentMethod('stripe');
    }, [settings]);

    // Load slots when date selected
    useEffect(() => {
        if (!selectedDate || !selectedService) return;
        (async () => {
            setSlotsLoading(true);
            const res = await fetch(`/api/bookings/slots?siteId=${siteId}&date=${selectedDate}&serviceId=${selectedService.id}`);
            const data = await res.json();
            setSlots(data.slots || []);
            setSlotsLoading(false);
        })();
    }, [selectedDate, selectedService, siteId]);

    // Effective price: selected option price or base service price
    const effectivePriceCents = selectedOption?.price_cents ?? selectedService?.price_cents ?? 0;

    const handleSubmit = async () => {
        if (!selectedService || !selectedDate || !selectedSlot) return;
        if (!form.name.trim() || !form.email.trim()) return;

        setSubmitting(true);

        // Stripe redirect flow
        if (chosenPaymentMethod === 'stripe') {
            const res = await fetch('/api/bookings/stripe-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    serviceId: selectedService.id,
                    optionId: selectedOption?.id,
                    selectedOptionName: selectedOption?.name,
                    selectedPriceCents: effectivePriceCents,
                    date: selectedDate,
                    startTime: selectedSlot.startTime,
                    customerName: form.name,
                    customerEmail: form.email,
                    customerPhone: form.phone || undefined,
                    notes: form.notes || undefined,
                }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
                return;
            }
            setSubmitting(false);
            return;
        }

        // etransfer / none flow
        const res = await fetch('/api/bookings/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                siteId,
                serviceId: selectedService.id,
                date: selectedDate,
                startTime: selectedSlot.startTime,
                customerName: form.name,
                customerEmail: form.email,
                customerPhone: form.phone || undefined,
                notes: form.notes || undefined,
                paymentMethod: chosenPaymentMethod,
            }),
        });

        const data = await res.json();
        if (res.ok) {
            setConfirmation(data);
            setStep('confirmation');
        }
        setSubmitting(false);
    };

    if (loading) {
        return (
            <section className="py-16 text-center" style={{ backgroundColor: pAccent }}>
                <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: pPrimary + '80' }} />
            </section>
        );
    }

    if (services.length === 0) {
        return (
            <section className="py-16 text-center" style={{ backgroundColor: pAccent, color: pPrimary + '80' }}>
                <Calendar className="w-10 h-10 mx-auto mb-3" />
                <p className="font-medium">Booking coming soon</p>
            </section>
        );
    }

    return (
        <section className="py-16 px-4" style={{ backgroundColor: pAccent }}>
            <div className="max-w-xl mx-auto">
                {/* Progress */}
                <div className="flex items-center justify-center gap-1 mb-8">
                    {['service', 'date', 'time', 'form'].map((s, i) => (
                        <div key={s} className="flex items-center gap-1">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'text-white' :
                                    ['service', 'date', 'time', 'form'].indexOf(step) > i ? 'bg-green-100 text-green-700' :
                                        'bg-slate-100 text-slate-400'
                                    }`}
                                style={step === s ? { backgroundColor: pSecondary } : {}}
                            >
                                {['service', 'date', 'time', 'form'].indexOf(step) > i ? <Check className="w-4 h-4" /> : i + 1}
                            </div>
                            {i < 3 && <div className={`w-6 h-0.5 ${['service', 'date', 'time', 'form'].indexOf(step) > i ? 'bg-green-200' : 'bg-slate-200'}`} />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Service Selection */}
                {step === 'service' && (() => {
                    const activeCategories = Array.from(new Set(
                        services.filter(s => s.booking_categories?.name).map(s => s.booking_categories!.name)
                    ));
                    const filtered = services.filter(s => {
                        const catMatch = !selectedCategory || s.booking_categories?.name === selectedCategory;
                        const q = searchQuery.toLowerCase();
                        const textMatch = !q || s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
                        return catMatch && textMatch;
                    });
                    return (
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 text-center">Select a Service</h2>

                            {/* Search */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search services..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Category filter — scrollable with fade edges */}
                            {activeCategories.length > 0 && (
                                <div className="relative mb-4">
                                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin scrollbar-thumb-slate-300" style={{ scrollbarWidth: 'thin' }}>
                                        <button onClick={() => setSelectedCategory(null)}
                                            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${selectedCategory === null ? 'text-white shadow-md border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                                            style={selectedCategory === null ? { backgroundColor: pPrimary } : {}}>
                                            All
                                        </button>
                                        {activeCategories.map(cat => (
                                            <button key={cat} onClick={() => setSelectedCategory(cat)}
                                                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${selectedCategory === cat ? 'text-white shadow-md border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                                                style={selectedCategory === cat ? { backgroundColor: pPrimary } : {}}>
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Right fade hint */}
                                    <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-[var(--bg)] to-transparent" style={{ '--bg': pAccent } as any} />
                                </div>
                            )}

                            <div className="space-y-3">
                                {filtered.length === 0 && (
                                    <p className="text-center text-slate-400 py-6 text-sm">No services match your search.</p>
                                )}
                                {filtered.map(service => (
                                    <button key={service.id}
                                        onClick={() => {
                                            setSelectedService(service);
                                            setSelectedOption(null);
                                            // If service has options, show option picker step
                                            if (service.options && service.options.length > 0) {
                                                setStep('option');
                                            } else {
                                                setStep('date');
                                            }
                                        }}
                                        className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-slate-400 transition-all group bg-white">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{service.name}</h3>
                                                {service.booking_categories?.name && !selectedCategory && (
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mt-1 tracking-wider">{service.booking_categories.name}</p>
                                                )}
                                                {service.description && (
                                                    <p className="text-sm text-slate-500 mt-1">{service.description}</p>
                                                )}
                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {service.duration_minutes} min
                                                    </span>
                                                    {service.options && service.options.length > 0 && (
                                                        <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full flex items-center gap-1">
                                                            <Package className="w-3 h-3" /> {service.options.length} options
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {service.price_cents > 0 && (
                                                <span className="text-lg font-bold shrink-0 ml-3" style={{ color: pSecondary }}>
                                                    {service.options && service.options.length > 0 ? `from $${Math.min(...service.options.map(o => o.price_cents)) / 100}` : `$${(service.price_cents / 100).toFixed(2)}`}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* Step 1.5: Option / Variant Picker */}
                {step === 'option' && selectedService && (
                    <div>
                        <button onClick={() => setStep('service')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Choose an Option</h2>
                        <p className="text-sm text-slate-500 mb-6 text-center">for {selectedService.name}</p>
                        <div className="space-y-3">
                            {(selectedService.options || []).map(opt => (
                                <button key={opt.id}
                                    onClick={() => { setSelectedOption(opt); setStep('date'); }}
                                    className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-slate-400 transition-all group bg-white flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{opt.name}</h3>
                                        <span className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedService.duration_minutes} min</span>
                                    </div>
                                    <span className="text-lg font-bold shrink-0 ml-3" style={{ color: pSecondary }}>
                                        ${(opt.price_cents / 100).toFixed(2)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Date Selection */}
                {step === 'date' && (
                    <div>
                        <button onClick={() => setStep(selectedService?.options?.length ? 'option' : 'service')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Choose a Date</h2>
                        <p className="text-sm text-slate-500 mb-6 text-center">for {selectedService?.name}{selectedOption ? ` — ${selectedOption.name}` : ''}</p>

                        <MiniCalendar
                            month={calMonth}
                            year={calYear}
                            selectedDate={selectedDate}
                            maxAdvanceDays={settings?.max_advance_days || 60}
                            onSelect={(date) => {
                                setSelectedDate(date);
                                setStep('time');
                            }}
                            onChangeMonth={(m, y) => { setCalMonth(m); setCalYear(y); }}
                            accentColor={pSecondary}
                        />
                    </div>
                )}

                {/* Step 3: Time Selection */}
                {step === 'time' && (
                    <div>
                        <button onClick={() => { setStep('date'); setSelectedSlot(null); }} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Pick a Time</h2>
                        <p className="text-sm text-slate-500 mb-6 text-center">
                            {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>

                        {slotsLoading ? (
                            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
                        ) : slots.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <Clock className="w-8 h-8 mx-auto mb-2" />
                                <p className="font-medium">No available times</p>
                                <p className="text-sm mt-1">Try a different date</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {slots.map(slot => (
                                    <button
                                        key={slot.startTime}
                                        onClick={() => {
                                            setSelectedSlot(slot);
                                            setStep('form');
                                        }}
                                        className="py-2.5 px-3 text-sm font-medium rounded-lg border-2 border-slate-200 hover:border-slate-400 transition-all text-slate-700 hover:text-slate-900"
                                    >
                                        {slot.display}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 4: Contact Form */}
                {step === 'form' && (
                    <div>
                        <button onClick={() => setStep('time')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Your Details</h2>

                        {/* Summary */}
                        <div className="bg-slate-50 rounded-xl p-4 mb-6 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Service</span><span className="font-medium text-slate-900">{selectedService?.name}</span></div>
                            <div className="flex justify-between mt-1"><span className="text-slate-500">Date</span><span className="font-medium text-slate-900">{selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
                            <div className="flex justify-between mt-1"><span className="text-slate-500">Time</span><span className="font-medium text-slate-900">{selectedSlot?.display}</span></div>
                            {selectedService && selectedService.price_cents > 0 && (
                                <div className="flex justify-between mt-1 pt-1 border-t border-slate-200"><span className="text-slate-500">Price</span><span className="font-bold" style={{ color: pSecondary }}>${(selectedService.price_cents / 100).toFixed(2)}</span></div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Full Name *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Smith" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Email *</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="john@email.com" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Phone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="(555) 123-4567" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Notes</label>
                                <div className="relative">
                                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={2} placeholder="Any special requests?" />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={submitting || !form.name.trim() || !form.email.trim()}
                            className="w-full mt-6 py-3 text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                            style={{ backgroundColor: pSecondary }}
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                            Confirm Booking
                        </button>
                    </div>
                )}

                {/* Step 5: Confirmation */}
                {step === 'confirmation' && confirmation && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: pSecondary + '20' }}>
                            <Check className="w-8 h-8" style={{ color: pSecondary }} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Confirmed!</h2>
                        <p className="text-slate-600 mb-6">{confirmation.confirmationMessage}</p>

                        <div className="bg-slate-50 rounded-xl p-4 text-sm text-left max-w-sm mx-auto">
                            <div className="flex justify-between"><span className="text-slate-500">Service</span><span className="font-medium text-slate-900">{confirmation.service?.name}</span></div>
                            <div className="flex justify-between mt-1"><span className="text-slate-500">Date</span><span className="font-medium text-slate-900">{selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
                            <div className="flex justify-between mt-1"><span className="text-slate-500">Time</span><span className="font-medium text-slate-900">{selectedSlot?.display}</span></div>
                            <div className="flex justify-between mt-1"><span className="text-slate-500">Ref #</span><span className="font-mono font-medium text-slate-900">{confirmation.booking?.id?.slice(0, 8).toUpperCase()}</span></div>
                        </div>

                        {/* E-Transfer instructions */}
                        {confirmation.paymentInstructions?.type === 'etransfer' && (
                            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left max-w-sm mx-auto">
                                <h3 className="font-bold text-amber-800 text-sm mb-2">💸 Payment via Interac e-Transfer</h3>
                                <p className="text-sm text-amber-700">
                                    Send <strong>${confirmation.paymentInstructions.amount} {confirmation.paymentInstructions.currency}</strong> to:
                                </p>
                                <p className="text-sm font-mono font-bold text-amber-900 my-1">{confirmation.paymentInstructions.email}</p>
                                <p className="text-xs text-amber-600">
                                    Reference: <strong>{confirmation.paymentInstructions.reference}</strong>
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

// ─── Mini Calendar ──────────────────────────────────────────────────────────────

function MiniCalendar({ month, year, selectedDate, maxAdvanceDays, onSelect, onChangeMonth, accentColor }: {
    month: number;
    year: number;
    selectedDate: string | null;
    maxAdvanceDays: number;
    onSelect: (date: string) => void;
    onChangeMonth: (m: number, y: number) => void;
    accentColor: string;
}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays);

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const prevMonth = () => {
        if (month === 0) onChangeMonth(11, year - 1);
        else onChangeMonth(month - 1, year);
    };

    const nextMonth = () => {
        if (month === 11) onChangeMonth(0, year + 1);
        else onChangeMonth(month + 1, year);
    };

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                <span className="font-bold text-slate-900">{monthName}</span>
                <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
                {DAY_SHORT.map(d => (
                    <div key={d} className="text-xs font-medium text-slate-400 py-1">{d}</div>
                ))}
                {cells.map((day, i) => {
                    if (!day) return <div key={`e-${i}`} />;

                    const dateObj = new Date(year, month, day);
                    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                    const isPast = dateObj < today;
                    const isTooFar = dateObj > maxDate;
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateObj.getTime() === today.getTime();
                    const disabled = isPast || isTooFar;

                    return (
                        <button
                            key={dateStr}
                            disabled={disabled}
                            onClick={() => onSelect(dateStr)}
                            className={`py-2 text-sm rounded-lg transition-all ${isSelected ? 'text-white font-bold shadow-md' :
                                disabled ? 'text-slate-300 cursor-not-allowed' :
                                    isToday ? 'font-bold text-slate-900 bg-slate-100 hover:bg-slate-200' :
                                        'text-slate-700 hover:bg-slate-100'
                                }`}
                            style={isSelected ? { backgroundColor: accentColor } : {}}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
