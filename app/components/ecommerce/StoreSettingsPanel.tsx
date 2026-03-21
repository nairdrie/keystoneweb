'use client';

import { useState, useEffect } from 'react';
import {
    Settings, CreditCard, Mail, Loader2, Check, ExternalLink,
    AlertCircle, ChevronDown, ChevronRight, DollarSign, Link2
} from 'lucide-react';

interface EcommerceSettings {
    site_id: string;
    payment_methods: { none?: boolean; etransfer?: boolean; stripe?: boolean };
    etransfer_email: string | null;
    notification_email: string | null;
}

interface StoreSettingsPanelProps {
    siteId: string;
}

export default function StoreSettingsPanel({ siteId }: StoreSettingsPanelProps) {
    const [settings, setSettings] = useState<EcommerceSettings>({
        site_id: siteId,
        payment_methods: { none: true, etransfer: false, stripe: false },
        etransfer_email: null,
        notification_email: null,
    });
    const [stripeConnected, setStripeConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [connectingStripe, setConnectingStripe] = useState(false);
    const [expanded, setExpanded] = useState(false);

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
                                    checked={pm.none !== false}
                                    onChange={() => setSettings({
                                        ...settings,
                                        payment_methods: { ...pm, none: pm.none === false ? true : false }
                                    })}
                                    className="rounded accent-blue-600 w-4 h-4"
                                />
                                <div>
                                    <span className="text-sm text-slate-700 font-medium">No payment required</span>
                                    <p className="text-xs text-slate-400">Orders placed without payment (pay in person, COD, etc.)</p>
                                </div>
                            </label>

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
