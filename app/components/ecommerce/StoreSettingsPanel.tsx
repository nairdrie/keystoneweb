'use client';

import { useState, useEffect } from 'react';
import {
    Settings, CreditCard, Mail, Loader2, Check, ExternalLink,
    AlertCircle, ChevronDown, ChevronRight, DollarSign, Link2,
    Download, Package, X, Plus, Trash2, Users, Copy
} from 'lucide-react';
import VendorEditor, { Vendor, PaymentMode } from './VendorEditor';

interface EcommerceSettings {
    site_id: string;
    payment_methods: { etransfer?: boolean; stripe?: boolean; paypal?: boolean; converge?: boolean; clover?: boolean };
    etransfer_email: string | null;
    notification_email: string | null;
    tax_enabled: boolean;
    tax_rate_bps: number;
    tax_label: string | null;
}

interface StoreSettingsPanelProps {
    siteId: string;
}

export default function StoreSettingsPanel({ siteId }: StoreSettingsPanelProps) {
    const [settings, setSettings] = useState<EcommerceSettings>({
        site_id: siteId,
        payment_methods: { etransfer: false, stripe: false, paypal: false, converge: false, clover: false },
        etransfer_email: null,
        notification_email: null,
        tax_enabled: false,
        tax_rate_bps: 0,
        tax_label: null,
    });
    const [stripeConnected, setStripeConnected] = useState(false);
    const [paypalConnected, setPaypalConnected] = useState(false);
    const [convergeConnected, setConvergeConnected] = useState(false);
    const [cloverConnected, setCloverConnected] = useState(false);
    const [convergeCreds, setConvergeCreds] = useState({ merchant_id: '', user_id: '', pin: '', demo_mode: false });
    const [cloverCreds, setCloverCreds] = useState({ merchant_id: '', public_key: '', private_token: '', webhook_secret: '', sandbox_mode: false });
    const [savingProcessor, setSavingProcessor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [connectingStripe, setConnectingStripe] = useState(false);
    const [connectingPaypal, setConnectingPaypal] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Stripe product sync state
    const [stripeProducts, setStripeProducts] = useState<any[]>([]);
    const [showSyncPrompt, setShowSyncPrompt] = useState(false);
    const [selectedSyncProducts, setSelectedSyncProducts] = useState<Set<string>>(new Set());
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number } | null>(null);
    const [checkingProducts, setCheckingProducts] = useState(false);

    // Vendor management state
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vendorsLoading, setVendorsLoading] = useState(false);
    const [showAddVendor, setShowAddVendor] = useState(false);
    const [newVendorName, setNewVendorName] = useState('');
    const [newVendorEmail, setNewVendorEmail] = useState('');
    const [newVendorPaymentMode, setNewVendorPaymentMode] = useState<PaymentMode>('external');
    const [newVendorIsDefault, setNewVendorIsDefault] = useState(false);
    const [savingVendor, setSavingVendor] = useState(false);
    const [vendorPortalTokens, setVendorPortalTokens] = useState<Record<string, string>>({});
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const [connectingVendorStripe, setConnectingVendorStripe] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [settingsRes, vendorsRes] = await Promise.all([
                    fetch(`/api/products/settings?siteId=${siteId}`),
                    fetch(`/api/vendors?siteId=${siteId}`),
                ]);
                const settingsData = await settingsRes.json();
                if (settingsData.settings) {
                    setSettings(settingsData.settings);
                }
                setStripeConnected(settingsData.stripeConnected || false);
                setPaypalConnected(settingsData.paypalConnected || false);
                setConvergeConnected(settingsData.convergeConnected || false);
                setCloverConnected(settingsData.cloverConnected || false);

                const vendorsData = await vendorsRes.json();
                setVendors(vendorsData.vendors || []);

                // Load site-level processor credentials
                try {
                    const procRes = await fetch(`/api/site-payment?siteId=${siteId}`);
                    if (procRes.ok) {
                        const procData = await procRes.json();
                        if (procData.converge) setConvergeCreds(procData.converge);
                        if (procData.clover) setCloverCreds(procData.clover);
                    }
                } catch {};
            } catch (err) {
                console.error('Failed to load ecommerce settings:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [siteId]);

    const loadVendors = async () => {
        const res = await fetch(`/api/vendors?siteId=${siteId}`);
        const data = await res.json();
        setVendors(data.vendors || []);
    };

    const handleAddVendor = async () => {
        if (!newVendorName.trim() || !newVendorEmail.trim()) return;
        setSavingVendor(true);
        try {
            const res = await fetch('/api/vendors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    name: newVendorName,
                    contactEmail: newVendorEmail,
                    paymentMode: newVendorPaymentMode,
                    isDefault: newVendorIsDefault,
                }),
            });
            const data = await res.json();
            if (data.vendor) {
                await loadVendors();
                if (data.portalToken) {
                    setVendorPortalTokens(prev => ({ ...prev, [data.vendor.id]: data.portalToken }));
                }
                setNewVendorName('');
                setNewVendorEmail('');
                setNewVendorPaymentMode('external');
                setNewVendorIsDefault(false);
                setShowAddVendor(false);
            }
        } catch (err) {
            console.error('Failed to add vendor:', err);
        } finally {
            setSavingVendor(false);
        }
    };

    const handleUpdateVendor = async (vendorId: string, updates: any) => {
        const payload: any = { id: vendorId };
        // Map camelCase/snake_case to the API format
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.contact_email !== undefined) payload.contactEmail = updates.contact_email;
        if (updates.payment_mode !== undefined) payload.paymentMode = updates.payment_mode;
        if (updates.is_default !== undefined) payload.isDefault = updates.is_default;
        if (updates.cc_notification_emails !== undefined) payload.ccNotificationEmails = updates.cc_notification_emails;
        if (updates.converge_merchant_id !== undefined) payload.convergeMerchantId = updates.converge_merchant_id;
        if (updates.converge_user_id !== undefined) payload.convergeUserId = updates.converge_user_id;
        if (updates.convergePin !== undefined) payload.convergePin = updates.convergePin;
        if (updates.converge_demo_mode !== undefined) payload.convergeDemoMode = updates.converge_demo_mode;
        if (updates.clover_merchant_id !== undefined) payload.cloverMerchantId = updates.clover_merchant_id;
        if (updates.clover_public_key !== undefined) payload.cloverPublicKey = updates.clover_public_key;
        if (updates.cloverPrivateToken !== undefined) payload.cloverPrivateToken = updates.cloverPrivateToken;
        if (updates.cloverWebhookSecret !== undefined) payload.cloverWebhookSecret = updates.cloverWebhookSecret;
        if (updates.clover_sandbox_mode !== undefined) payload.cloverSandboxMode = updates.clover_sandbox_mode;

        await fetch('/api/vendors', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        await loadVendors();
    };

    const handleDeleteVendor = async (vendorId: string) => {
        try {
            await fetch(`/api/vendors?id=${vendorId}`, { method: 'DELETE' });
            setVendors(vendors.filter(v => v.id !== vendorId));
        } catch (err) {
            console.error('Failed to delete vendor:', err);
        }
    };

    const handleConnectVendorStripe = async (vendorId: string) => {
        setConnectingVendorStripe(vendorId);
        try {
            const res = await fetch('/api/vendors/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vendorId,
                    returnUrl: window.location.href,
                }),
            });
            const data = await res.json();
            if (data.url) {
                window.open(data.url, '_blank');
            }
        } catch (err) {
            console.error('Failed to initiate vendor Stripe Connect:', err);
        } finally {
            setConnectingVendorStripe(null);
        }
    };

    const copyPortalLink = async (vendorId: string) => {
        const token = vendorPortalTokens[vendorId];
        if (!token) return;
        const url = `${window.location.origin}/vendor-portal?token=${token}`;
        await navigator.clipboard.writeText(url);
        setCopiedToken(vendorId);
        setTimeout(() => setCopiedToken(null), 2000);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const res = await fetch('/api/products/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    payment_methods: {
                        etransfer: !!settings.payment_methods?.etransfer,
                        stripe: !!settings.payment_methods?.stripe,
                        paypal: !!settings.payment_methods?.paypal,
                        converge: !!settings.payment_methods?.converge,
                        clover: !!settings.payment_methods?.clover,
                    },
                    etransfer_email: settings.etransfer_email,
                    notification_email: settings.notification_email,
                    tax_enabled: settings.tax_enabled,
                    tax_rate_bps: settings.tax_rate_bps || 0,
                    tax_label: settings.tax_label || null,
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

    const handleConnectPaypal = async () => {
        setConnectingPaypal(true);
        try {
            const res = await fetch('/api/paypal/connect', {
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
            console.error('Failed to initiate PayPal Connect:', err);
        } finally {
            setConnectingPaypal(false);
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
    const hasAnyPayment = pm.etransfer || pm.stripe || pm.paypal || pm.converge || pm.clover;

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

                            <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={pm.paypal || false}
                                    onChange={() => setSettings({
                                        ...settings,
                                        payment_methods: { ...pm, paypal: !pm.paypal }
                                    })}
                                    className="rounded accent-blue-600 w-4 h-4"
                                />
                                <div>
                                    <span className="text-sm text-slate-700 font-medium">PayPal & Cards (PayPal)</span>
                                    <p className="text-xs text-slate-400">PayPal wallet + debit/credit card as guest — funds settle to your PayPal account</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={pm.converge || false}
                                    onChange={() => setSettings({
                                        ...settings,
                                        payment_methods: { ...pm, converge: !pm.converge }
                                    })}
                                    className="rounded accent-blue-600 w-4 h-4"
                                />
                                <div>
                                    <span className="text-sm text-slate-700 font-medium">Credit / Debit Card (Converge / Elavon)</span>
                                    <p className="text-xs text-slate-400">Accept cards via your Elavon Converge merchant account — secure Lightbox overlay</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={pm.clover || false}
                                    onChange={() => setSettings({
                                        ...settings,
                                        payment_methods: { ...pm, clover: !pm.clover }
                                    })}
                                    className="rounded accent-blue-600 w-4 h-4"
                                />
                                <div>
                                    <span className="text-sm text-slate-700 font-medium">Credit / Debit Card (Clover)</span>
                                    <p className="text-xs text-slate-400">Accept cards via your Clover merchant account — hosted checkout page</p>
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

                    {/* PayPal Connect */}
                    {pm.paypal && (
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                                <Link2 className="w-4 h-4 text-indigo-600" />
                                PayPal Account
                            </label>
                            {paypalConnected ? (
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                                    <Check className="w-4 h-4 text-green-600" />
                                    <span className="text-sm text-green-700 font-medium">PayPal account connected</span>
                                    <button
                                        onClick={handleConnectPaypal}
                                        className="ml-auto text-xs text-green-600 hover:text-green-800 underline"
                                    >
                                        Manage
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <button
                                        onClick={handleConnectPaypal}
                                        disabled={connectingPaypal}
                                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {connectingPaypal ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <ExternalLink className="w-4 h-4" />
                                        )}
                                        Connect PayPal Account
                                    </button>
                                    <p className="text-xs text-slate-400 mt-1.5">
                                        You'll be redirected to PayPal to connect or create a business account. Funds go directly to your PayPal account.
                                    </p>
                                </div>
                            )}
                            {pm.paypal && !paypalConnected && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Connect PayPal to accept PayPal and card payments
                                </p>
                            )}
                        </div>
                    )}

                    {/* Converge (Elavon) Credentials */}
                    {pm.converge && (
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4 text-emerald-600" />
                                Converge (Elavon) Credentials
                            </label>
                            {convergeConnected && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg mb-2">
                                    <Check className="w-4 h-4 text-green-600" />
                                    <span className="text-sm text-green-700 font-medium">Converge configured</span>
                                </div>
                            )}
                            <div className="space-y-2">
                                <input type="text" placeholder="Merchant ID" value={convergeCreds.merchant_id}
                                    onChange={e => setConvergeCreds({ ...convergeCreds, merchant_id: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <input type="text" placeholder="User ID" value={convergeCreds.user_id}
                                    onChange={e => setConvergeCreds({ ...convergeCreds, user_id: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <input type="password" placeholder="PIN" value={convergeCreds.pin}
                                    onChange={e => setConvergeCreds({ ...convergeCreds, pin: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <label className="flex items-center gap-2 text-sm text-slate-600">
                                    <input type="checkbox" checked={convergeCreds.demo_mode}
                                        onChange={e => setConvergeCreds({ ...convergeCreds, demo_mode: e.target.checked })}
                                        className="rounded accent-blue-600 w-4 h-4" />
                                    Demo / sandbox mode
                                </label>
                                <button
                                    onClick={async () => {
                                        setSavingProcessor('converge');
                                        try {
                                            const res = await fetch('/api/site-payment', {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ siteId, processor: 'converge', ...convergeCreds }),
                                            });
                                            if (res.ok) setConvergeConnected(!!(convergeCreds.merchant_id && convergeCreds.user_id && convergeCreds.pin && convergeCreds.pin !== '••••••••'));
                                        } catch {}
                                        setSavingProcessor(null);
                                    }}
                                    disabled={savingProcessor === 'converge'}
                                    className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                                >
                                    {savingProcessor === 'converge' ? 'Saving...' : 'Save Converge Credentials'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5">
                                Find these in your Converge Virtual Terminal under Settings &gt; API Credentials.
                            </p>
                        </div>
                    )}

                    {/* Clover Credentials */}
                    {pm.clover && (
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4 text-green-600" />
                                Clover Credentials
                            </label>
                            {cloverConnected && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg mb-2">
                                    <Check className="w-4 h-4 text-green-600" />
                                    <span className="text-sm text-green-700 font-medium">Clover configured</span>
                                </div>
                            )}
                            <div className="space-y-2">
                                <input type="text" placeholder="Merchant ID" value={cloverCreds.merchant_id}
                                    onChange={e => setCloverCreds({ ...cloverCreds, merchant_id: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <input type="password" placeholder="Private API Token" value={cloverCreds.private_token}
                                    onChange={e => setCloverCreds({ ...cloverCreds, private_token: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <input type="password" placeholder="Webhook Secret (optional)" value={cloverCreds.webhook_secret}
                                    onChange={e => setCloverCreds({ ...cloverCreds, webhook_secret: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <label className="flex items-center gap-2 text-sm text-slate-600">
                                    <input type="checkbox" checked={cloverCreds.sandbox_mode}
                                        onChange={e => setCloverCreds({ ...cloverCreds, sandbox_mode: e.target.checked })}
                                        className="rounded accent-blue-600 w-4 h-4" />
                                    Sandbox mode
                                </label>
                                <button
                                    onClick={async () => {
                                        setSavingProcessor('clover');
                                        try {
                                            const res = await fetch('/api/site-payment', {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ siteId, processor: 'clover', ...cloverCreds }),
                                            });
                                            if (res.ok) setCloverConnected(!!(cloverCreds.merchant_id && cloverCreds.private_token && cloverCreds.private_token !== '••••••••'));
                                        } catch {}
                                        setSavingProcessor(null);
                                    }}
                                    disabled={savingProcessor === 'clover'}
                                    className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                                >
                                    {savingProcessor === 'clover' ? 'Saving...' : 'Save Clover Credentials'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5">
                                Find these in your Clover Dashboard under Setup &gt; API Tokens.
                            </p>
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

                    {/* Tax Collection */}
                    {pm.stripe && stripeConnected && (
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-2 flex items-center gap-1.5">
                                <DollarSign className="w-4 h-4 text-green-600" />
                                Tax Collection
                            </label>
                            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                                <div>
                                    <span className="text-sm text-slate-700 font-medium">Collect tax automatically</span>
                                    <p className="text-xs text-slate-400 mt-0.5">Stripe will calculate and add tax at checkout based on your customer's location</p>
                                </div>
                                <button
                                    onClick={() => setSettings({ ...settings, tax_enabled: !settings.tax_enabled })}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-3 ${settings.tax_enabled ? 'bg-green-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.tax_enabled ? 'translate-x-5' : ''}`} />
                                </button>
                            </div>
                            {settings.tax_enabled && (
                                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Make sure tax registrations are configured in your Stripe Dashboard
                                </p>
                            )}

                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <p className="text-sm font-semibold text-slate-800 mb-1">Flat-rate tax</p>
                                <p className="text-xs text-slate-500 mb-3">
                                    Charge a fixed tax percentage on every order (applies to e-transfer checkouts
                                    {settings.tax_enabled ? ', and to Stripe checkouts only if Stripe automatic tax is off' : ', and to Stripe checkouts'}).
                                </p>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Rate (%)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={settings.tax_rate_bps ? (settings.tax_rate_bps / 100).toString() : ''}
                                            onChange={e => {
                                                const pct = parseFloat(e.target.value);
                                                const bps = isNaN(pct) ? 0 : Math.round(pct * 100);
                                                setSettings({ ...settings, tax_rate_bps: Math.max(0, Math.min(10000, bps)) });
                                            }}
                                            placeholder="0"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Label</label>
                                        <input
                                            type="text"
                                            value={settings.tax_label || ''}
                                            onChange={e => setSettings({ ...settings, tax_label: e.target.value || null })}
                                            placeholder="HST, GST+PST..."
                                            maxLength={20}
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Vendors / Suppliers */}
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-2 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-indigo-600" />
                            Vendors / Fulfillment Sources
                        </label>
                        <p className="text-xs text-slate-400 mb-3">
                            Vendors fulfill products on your behalf. Each vendor can process payment through Stripe, Converge, Clover, or handle it externally. Mark one as "default" to use for any product without a specific vendor.
                        </p>

                        {/* Existing vendors */}
                        {vendors.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {vendors.map(vendor => (
                                    <VendorEditor
                                        key={vendor.id}
                                        vendor={vendor}
                                        portalToken={vendorPortalTokens[vendor.id]}
                                        connecting={connectingVendorStripe === vendor.id}
                                        copied={copiedToken === vendor.id}
                                        onSave={async (updates) => handleUpdateVendor(vendor.id, updates)}
                                        onDelete={() => handleDeleteVendor(vendor.id)}
                                        onConnectStripe={() => handleConnectVendorStripe(vendor.id)}
                                        onCopyPortal={() => copyPortalLink(vendor.id)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Add vendor form */}
                        {showAddVendor ? (
                            <div className="border border-indigo-200 bg-indigo-50/30 rounded-lg p-3 space-y-2">
                                <input
                                    type="text"
                                    placeholder="Vendor name (e.g. Robbie's Medical Supply)"
                                    value={newVendorName}
                                    onChange={e => setNewVendorName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                />
                                <input
                                    type="email"
                                    placeholder="Primary contact email"
                                    value={newVendorEmail}
                                    onChange={e => setNewVendorEmail(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                />
                                <div>
                                    <label className="text-xs font-medium text-slate-600 block mb-1">Payment Mode</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {(['external', 'stripe', 'converge', 'clover'] as PaymentMode[]).map(mode => {
                                            const labels: Record<PaymentMode, { title: string; desc: string }> = {
                                                external: { title: 'External', desc: 'Vendor handles payment' },
                                                stripe:   { title: 'Stripe', desc: "Vendor's Stripe account" },
                                                converge: { title: 'Converge', desc: "Vendor's Elavon account" },
                                                clover:   { title: 'Clover', desc: "Vendor's Clover account" },
                                            };
                                            const info = labels[mode];
                                            const selected = newVendorPaymentMode === mode;
                                            return (
                                                <button
                                                    key={mode}
                                                    onClick={() => setNewVendorPaymentMode(mode)}
                                                    className={`px-3 py-2 text-xs font-medium rounded-lg border-2 transition-colors text-left ${
                                                        selected
                                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                                                    }`}
                                                >
                                                    {info.title}
                                                    <p className="text-[10px] text-slate-400 mt-0.5 font-normal">{info.desc}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-xs text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={newVendorIsDefault}
                                        onChange={e => setNewVendorIsDefault(e.target.checked)}
                                        className="rounded"
                                    />
                                    Set as default fulfiller (used for products without a specific vendor)
                                </label>
                                <p className="text-[11px] text-slate-500 italic">
                                    After saving, click "Edit" on the vendor to add payment credentials, CC emails, etc.
                                </p>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={handleAddVendor}
                                        disabled={savingVendor || !newVendorName.trim() || !newVendorEmail.trim()}
                                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                        {savingVendor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                        Add Vendor
                                    </button>
                                    <button
                                        onClick={() => setShowAddVendor(false)}
                                        className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAddVendor(true)}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add vendor
                            </button>
                        )}
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
