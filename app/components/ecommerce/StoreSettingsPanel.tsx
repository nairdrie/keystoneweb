'use client';

import { useState, useEffect } from 'react';
import {
    Settings, CreditCard, Mail, Loader2, Check, ExternalLink,
    AlertCircle, ChevronDown, ChevronRight, DollarSign, Link2,
    Download, Package, X
} from 'lucide-react';

interface EcommerceSettings {
    site_id: string;
    payment_methods: { etransfer?: boolean; stripe?: boolean };
    etransfer_email: string | null;
    notification_email: string | null;
}

interface StoreSettingsPanelProps {
    siteId: string;
}

export default function StoreSettingsPanel({ siteId }: StoreSettingsPanelProps) {
    const [settings, setSettings] = useState<EcommerceSettings>({
        site_id: siteId,
        payment_methods: { etransfer: false, stripe: false },
        etransfer_email: null,
        notification_email: null,
    });
    const [stripeConnected, setStripeConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [connectingStripe, setConnectingStripe] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Stripe product sync state
    const [stripeProducts, setStripeProducts] = useState<any[]>([]);
    const [showSyncPrompt, setShowSyncPrompt] = useState(false);
    const [selectedSyncProducts, setSelectedSyncProducts] = useState<Set<string>>(new Set());
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number } | null>(null);
    const [checkingProducts, setCheckingProducts] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/products/settings?siteId=${siteId}`);
                const data = await res.json();
                if (data.settings) {
                    setSettings(data.settings);
                }
                setStripeConnected(data.stripeConnected || false);
            } catch (err) {
                console.error('Failed to load ecommerce settings:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [siteId]);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const res = await fetch('/api/products/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    payment_methods: settings.payment_methods,
                    etransfer_email: settings.etransfer_email,
                    notification_email: settings.notification_email,
                }),
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (err) {
            console.error('Failed to save settings:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleConnectStripe = async () => {
        setConnectingStripe(true);
        try {
            const res = await fetch('/api/stripe/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    returnUrl: window.location.href,
                }),
            });
            const data = await res.json();
            if (data.url) {
                window.open(data.url, '_blank');
            }
        } catch (err) {
            console.error('Failed to initiate Stripe Connect:', err);
        } finally {
            setConnectingStripe(false);
        }
    };

    const checkStripeProducts = async () => {
        setCheckingProducts(true);
        setSyncResult(null);
        try {
            const res = await fetch(`/api/stripe/connect-products?siteId=${siteId}`);
            const data = await res.json();
            if (data.products && data.products.length > 0) {
                setStripeProducts(data.products);
                setSelectedSyncProducts(new Set(data.products.map((p: any) => p.stripe_product_id)));
                setShowSyncPrompt(true);
            } else {
                setStripeProducts([]);
                setShowSyncPrompt(false);
            }
        } catch (err) {
            console.error('Failed to check Stripe products:', err);
        } finally {
            setCheckingProducts(false);
        }
    };

    const handleSyncProducts = async () => {
        const toSync = stripeProducts.filter(p => selectedSyncProducts.has(p.stripe_product_id));
        if (toSync.length === 0) return;

        setSyncing(true);
        try {
            const res = await fetch('/api/stripe/connect-products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, products: toSync }),
            });
            const data = await res.json();
            setSyncResult({ imported: data.imported, skipped: data.skipped });
            setShowSyncPrompt(false);
        } catch (err) {
            console.error('Failed to sync Stripe products:', err);
        } finally {
            setSyncing(false);
        }
    };

    const toggleSyncProduct = (productId: string) => {
        setSelectedSyncProducts(prev => {
            const next = new Set(prev);
            if (next.has(productId)) next.delete(productId);
            else next.add(productId);
            return next;
        });
    };

    // Auto-check for Stripe products when connection is detected
    useEffect(() => {
        if (stripeConnected && !loading) {
            checkStripeProducts();
        }
    }, [stripeConnected, loading]);

    if (loading) {
        return (
            <div className="py-4 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
            </div>
        );
    }

    const pm = settings.payment_methods || {};
    const hasAnyPayment = pm.etransfer || pm.stripe;

    return (
        <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Settings className="w-4 h-4 text-slate-500" />
                    Payment & Store Settings
                </span>
                {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {expanded && (
                <div className="p-5 space-y-5 border-t border-slate-200">
                    {/* Payment Methods */}
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-2 flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4 text-slate-500" />
                            Accepted Payment Methods
                        </label>
                        <div className="space-y-2.5">
                            <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={pm.etransfer || false}
                                    onChange={() => setSettings({
                                        ...settings,
                                        payment_methods: { ...pm, etransfer: !pm.etransfer }
                                    })}
                                    className="rounded accent-blue-600 w-4 h-4"
                                />
                                <div>
                                    <span className="text-sm text-slate-700 font-medium">Interac e-Transfer</span>
                                    <p className="text-xs text-slate-400">Customers send payment to your email via Interac</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={pm.stripe || false}
                                    onChange={() => setSettings({
                                        ...settings,
                                        payment_methods: { ...pm, stripe: !pm.stripe }
                                    })}
                                    className="rounded accent-blue-600 w-4 h-4"
                                />
                                <div>
                                    <span className="text-sm text-slate-700 font-medium">Credit / Debit Card (Stripe)</span>
                                    <p className="text-xs text-slate-400">Accept Visa, Mastercard, Amex via Stripe</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* E-Transfer Email */}
                    {pm.etransfer && (
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                                <DollarSign className="w-4 h-4 text-amber-600" />
                                e-Transfer Email
                            </label>
                            <input
                                type="email"
                                placeholder="payments@yourbusiness.ca"
                                value={settings.etransfer_email || ''}
                                onChange={e => setSettings({ ...settings, etransfer_email: e.target.value || null })}
                                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <p className="text-xs text-slate-400 mt-1">Customers will be told to send e-Transfers to this email</p>
                            {pm.etransfer && !settings.etransfer_email && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Required when e-Transfer is enabled
                                </p>
                            )}
                        </div>
                    )}

                    {/* Stripe Connect */}
                    {pm.stripe && (
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                                <Link2 className="w-4 h-4 text-violet-600" />
                                Stripe Account
                            </label>
                            {stripeConnected ? (
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                                    <Check className="w-4 h-4 text-green-600" />
                                    <span className="text-sm text-green-700 font-medium">Stripe account connected</span>
                                    <button
                                        onClick={handleConnectStripe}
                                        className="ml-auto text-xs text-green-600 hover:text-green-800 underline"
                                    >
                                        Manage
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <button
                                        onClick={handleConnectStripe}
                                        disabled={connectingStripe}
                                        className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {connectingStripe ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <ExternalLink className="w-4 h-4" />
                                        )}
                                        Connect Stripe Account
                                    </button>
                                    <p className="text-xs text-slate-400 mt-1.5">
                                        You'll be redirected to Stripe to connect or create an account. Funds go directly to your account.
                                    </p>
                                </div>
                            )}
                            {pm.stripe && !stripeConnected && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Connect Stripe to accept card payments
                                </p>
                            )}

                            {/* Stripe Product Sync Prompt */}
                            {stripeConnected && showSyncPrompt && stripeProducts.length > 0 && (
                                <div className="mt-3 border border-blue-200 bg-blue-50 rounded-lg p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-blue-600" />
                                            <span className="text-sm font-semibold text-blue-800">
                                                Found {stripeProducts.length} product{stripeProducts.length !== 1 ? 's' : ''} in your Stripe account
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => setShowSyncPrompt(false)}
                                            className="text-blue-400 hover:text-blue-600"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-blue-600 mb-3">
                                        Select which products to import into your store. They'll be added as drafts so you can review before publishing.
                                    </p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                                        {stripeProducts.map(product => (
                                            <label
                                                key={product.stripe_product_id}
                                                className="flex items-center gap-2.5 p-2 rounded-md bg-white border border-blue-100 cursor-pointer hover:border-blue-300 transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSyncProducts.has(product.stripe_product_id)}
                                                    onChange={() => toggleSyncProduct(product.stripe_product_id)}
                                                    className="rounded accent-blue-600 w-4 h-4"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-sm text-slate-700 font-medium block truncate">
                                                        {product.name}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {product.currency} ${(product.price_cents / 100).toFixed(2)}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSyncProducts}
                                            disabled={syncing || selectedSyncProducts.size === 0}
                                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            {syncing ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4" />
                                            )}
                                            Import {selectedSyncProducts.size} Product{selectedSyncProducts.size !== 1 ? 's' : ''}
                                        </button>
                                        <button
                                            onClick={() => setShowSyncPrompt(false)}
                                            className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
                                        >
                                            Skip
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Sync Result */}
                            {syncResult && (
                                <div className="mt-3 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-700 flex items-center gap-2">
                                        <Check className="w-4 h-4 text-green-600" />
                                        Imported {syncResult.imported} product{syncResult.imported !== 1 ? 's' : ''} as drafts
                                        {syncResult.skipped > 0 && (
                                            <span className="text-green-500">
                                                ({syncResult.skipped} skipped — already exist)
                                            </span>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* Manual check button when connected but prompt dismissed */}
                            {stripeConnected && !showSyncPrompt && !syncResult && (
                                <button
                                    onClick={checkStripeProducts}
                                    disabled={checkingProducts}
                                    className="mt-2 text-xs text-violet-600 hover:text-violet-800 underline flex items-center gap-1"
                                >
                                    {checkingProducts ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Download className="w-3 h-3" />
                                    )}
                                    Import products from Stripe
                                </button>
                            )}
                        </div>
                    )}

                    {/* Notification Email */}
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                            <Mail className="w-4 h-4 text-blue-600" />
                            Order Notification Email
                        </label>
                        <input
                            type="email"
                            placeholder="you@yourbusiness.ca"
                            value={settings.notification_email || ''}
                            onChange={e => setSettings({ ...settings, notification_email: e.target.value || null })}
                            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <p className="text-xs text-slate-400 mt-1">Get notified when new orders come in</p>
                    </div>

                    {/* Save */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saved ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <Settings className="w-4 h-4" />
                        )}
                        {saved ? 'Saved!' : 'Save Settings'}
                    </button>
                </div>
            )}
        </div>
    );
}
