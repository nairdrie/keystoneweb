'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Settings, CreditCard, Loader2, Check, ExternalLink,
    AlertCircle, DollarSign, Link2,
} from 'lucide-react';
import CloverSetupInstructions from '@/app/components/ecommerce/CloverSetupInstructions';
import PayPalSetupInstructions from '@/app/components/ecommerce/PayPalSetupInstructions';
import { useAdminContext } from '@/app/(app)/admin/admin-context';

type PaymentMethodKey = 'none' | 'etransfer' | 'stripe' | 'paypal' | 'converge' | 'clover';

interface PaymentMethodsState {
    none?: boolean;
    etransfer?: boolean;
    stripe?: boolean;
    paypal?: boolean;
    converge?: boolean;
    clover?: boolean;
}

interface BookingPaymentSettings {
    payment_methods: PaymentMethodsState;
    etransfer_email: string | null;
    tax_enabled: boolean;
    tax_rate_bps: number;
    tax_label: string | null;
}

interface BookingPaymentsPanelProps {
    siteId: string;
}

function serialize(
    settings: BookingPaymentSettings,
    converge: { merchant_id: string; user_id: string; pin: string; demo_mode: boolean },
    clover: { merchant_id: string; public_key: string; private_token: string; webhook_secret: string; sandbox_mode: boolean },
    paypal: { client_id: string; secret: string; sandbox_mode: boolean },
): string {
    const pm = settings.payment_methods || {};
    return JSON.stringify({
        pm: {
            none: !!pm.none,
            etransfer: !!pm.etransfer,
            stripe: !!pm.stripe,
            paypal: !!pm.paypal,
            converge: !!pm.converge,
            clover: !!pm.clover,
        },
        etransfer_email: settings.etransfer_email ?? null,
        tax_enabled: !!settings.tax_enabled,
        tax_rate_bps: settings.tax_rate_bps || 0,
        tax_label: settings.tax_label ?? null,
        converge,
        clover,
        paypal,
    });
}

export default function BookingPaymentsPanel({ siteId }: BookingPaymentsPanelProps) {
    const [settings, setSettings] = useState<BookingPaymentSettings>({
        payment_methods: { none: true },
        etransfer_email: null,
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
    const [paypalCreds, setPaypalCreds] = useState({ client_id: '', secret: '', sandbox_mode: false });
    const [siteUrl, setSiteUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [connectingStripe, setConnectingStripe] = useState(false);

    const { setHasUnsavedChanges } = useAdminContext();
    const baselineRef = useRef<string>('');
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                // Ensure booking_settings row exists, then load it. The booking
                // settings endpoint also reports which processor credentials are
                // present on the parent site row.
                const settingsRes = await fetch(`/api/bookings/settings?siteId=${siteId}`);
                let settingsData = await settingsRes.json();
                if (!settingsData.settings) {
                    await fetch('/api/bookings/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ siteId }),
                    });
                    const retry = await fetch(`/api/bookings/settings?siteId=${siteId}`);
                    settingsData = await retry.json();
                }

                const loaded: BookingPaymentSettings = {
                    payment_methods: settingsData.settings?.payment_methods || { none: true },
                    etransfer_email: settingsData.settings?.etransfer_email ?? null,
                    tax_enabled: !!settingsData.settings?.tax_enabled,
                    tax_rate_bps: settingsData.settings?.tax_rate_bps || 0,
                    tax_label: settingsData.settings?.tax_label ?? null,
                };
                setSettings(loaded);
                setStripeConnected(!!settingsData.stripeConnected);
                setPaypalConnected(!!settingsData.paypalConnected);
                setConvergeConnected(!!settingsData.convergeConnected);
                setCloverConnected(!!settingsData.cloverConnected);

                // Site-level processor credentials are shared with ecommerce —
                // editing them here updates the same fields on the sites row.
                let loadedConverge = { merchant_id: '', user_id: '', pin: '', demo_mode: false };
                let loadedClover = { merchant_id: '', public_key: '', private_token: '', webhook_secret: '', sandbox_mode: false };
                let loadedPaypal = { client_id: '', secret: '', sandbox_mode: false };
                try {
                    const procRes = await fetch(`/api/site-payment?siteId=${siteId}`);
                    if (procRes.ok) {
                        const procData = await procRes.json();
                        if (procData.converge) { loadedConverge = procData.converge; setConvergeCreds(procData.converge); }
                        if (procData.clover) { loadedClover = procData.clover; setCloverCreds(procData.clover); }
                        if (procData.paypal) { loadedPaypal = procData.paypal; setPaypalCreds(procData.paypal); }
                        if (procData.siteUrl) setSiteUrl(procData.siteUrl);
                    }
                } catch {}

                baselineRef.current = serialize(loaded, loadedConverge, loadedClover, loadedPaypal);
            } catch (err) {
                console.error('Failed to load booking payment settings:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [siteId]);

    useEffect(() => {
        if (loading) return;
        const d = serialize(settings, convergeCreds, cloverCreds, paypalCreds) !== baselineRef.current;
        setDirty(d);
        setHasUnsavedChanges(d);
    }, [loading, settings, convergeCreds, cloverCreds, paypalCreds, setHasUnsavedChanges]);

    useEffect(() => {
        return () => setHasUnsavedChanges(false);
    }, [setHasUnsavedChanges]);

    const selectPaymentMethod = (key: PaymentMethodKey) => {
        setSettings({
            ...settings,
            payment_methods: {
                none: key === 'none',
                etransfer: key === 'etransfer',
                stripe: key === 'stripe',
                paypal: key === 'paypal',
                converge: key === 'converge',
                clover: key === 'clover',
            },
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await Promise.all([
                fetch('/api/bookings/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        siteId,
                        payment_methods: {
                            none: !!settings.payment_methods?.none,
                            etransfer: !!settings.payment_methods?.etransfer,
                            stripe: !!settings.payment_methods?.stripe,
                            paypal: !!settings.payment_methods?.paypal,
                            converge: !!settings.payment_methods?.converge,
                            clover: !!settings.payment_methods?.clover,
                        },
                        etransfer_email: settings.etransfer_email,
                        tax_enabled: settings.tax_enabled,
                        tax_rate_bps: settings.tax_rate_bps || 0,
                        tax_label: settings.tax_label || null,
                    }),
                }),
                fetch('/api/site-payment', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ siteId, processor: 'paypal', ...paypalCreds }),
                }),
                fetch('/api/site-payment', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ siteId, processor: 'converge', ...convergeCreds }),
                }),
                fetch('/api/site-payment', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ siteId, processor: 'clover', ...cloverCreds }),
                }),
            ]);

            setPaypalConnected(!!(paypalCreds.client_id && paypalCreds.secret));
            setConvergeConnected(!!(convergeCreds.merchant_id && convergeCreds.user_id && convergeCreds.pin));
            setCloverConnected(!!(cloverCreds.merchant_id && cloverCreds.public_key && cloverCreds.private_token));

            baselineRef.current = serialize(settings, convergeCreds, cloverCreds, paypalCreds);
            setDirty(false);
            setHasUnsavedChanges(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save booking payment settings:', err);
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
                body: JSON.stringify({ siteId, returnUrl: window.location.href }),
            });
            const data = await res.json();
            if (data.url) window.open(data.url, '_blank');
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

    return (
        <div className="overflow-hidden">
            <div className="p-5 space-y-5">
                {/* Payment Methods */}
                <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-slate-500" />
                        Accepted Payment Method
                    </label>
                    <div className="space-y-2.5">
                        {([
                            { key: 'none', title: 'No payment required', desc: 'Customers book without paying — collect payment in person' },
                            { key: 'etransfer', title: 'Interac (e-Transfer)', desc: 'Customers send payment to your email via Interac' },
                            { key: 'stripe', title: 'Stripe (credit / debit card)', desc: 'Accept Visa, Mastercard, Amex via Stripe' },
                            { key: 'paypal', title: 'PayPal (PayPal & cards)', desc: 'PayPal wallet + debit/credit card as guest — funds settle to your PayPal account' },
                            { key: 'converge', title: 'Converge / Elavon (credit / debit card)', desc: 'Accept cards via your Elavon Converge merchant account — secure Lightbox overlay' },
                            { key: 'clover', title: 'Clover (credit / debit card)', desc: 'Accept cards via your Clover merchant account — hosted checkout page' },
                        ] as { key: PaymentMethodKey; title: string; desc: string }[]).map(opt => (
                            <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer group">
                                <input
                                    type="radio"
                                    name="bookingPaymentMethod"
                                    checked={!!pm[opt.key]}
                                    onChange={() => selectPaymentMethod(opt.key)}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <div>
                                    <span className="text-sm text-slate-700 font-medium">{opt.title}</span>
                                    <p className="text-xs text-slate-400">{opt.desc}</p>
                                </div>
                            </label>
                        ))}
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
                        {!settings.etransfer_email && (
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
                        {!stripeConnected && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Connect Stripe to accept card payments
                            </p>
                        )}
                    </div>
                )}

                {/* PayPal Credentials */}
                {pm.paypal && (
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                            <Link2 className="w-4 h-4 text-indigo-600" />
                            PayPal Credentials
                        </label>
                        {paypalConnected && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg mb-2">
                                <Check className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-700 font-medium">PayPal configured</span>
                            </div>
                        )}
                        <div className="space-y-2">
                            <input type="text" placeholder="Client ID" value={paypalCreds.client_id}
                                onChange={e => setPaypalCreds({ ...paypalCreds, client_id: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <input type="password" placeholder="Secret" value={paypalCreds.secret}
                                onChange={e => setPaypalCreds({ ...paypalCreds, secret: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <label className="flex items-center gap-2 text-sm text-slate-600">
                                <input type="checkbox" checked={paypalCreds.sandbox_mode}
                                    onChange={e => setPaypalCreds({ ...paypalCreds, sandbox_mode: e.target.checked })}
                                    className="rounded accent-blue-600 w-4 h-4" />
                                Sandbox mode
                            </label>
                        </div>
                        <div className="mt-2.5">
                            <PayPalSetupInstructions />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2">
                            PayPal credentials are shared site-wide — saving here also enables PayPal for store orders, and vice-versa.
                        </p>
                        {!paypalConnected && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Enter your PayPal credentials and save to accept PayPal and card payments
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
                            <input type="text" placeholder="Public Key (ECOM)" value={cloverCreds.public_key}
                                onChange={e => setCloverCreds({ ...cloverCreds, public_key: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <input type="password" placeholder="Private Key (ECOM)" value={cloverCreds.private_token}
                                onChange={e => setCloverCreds({ ...cloverCreds, private_token: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <label className="flex items-center gap-2 text-sm text-slate-600">
                                <input type="checkbox" checked={cloverCreds.sandbox_mode}
                                    onChange={e => setCloverCreds({ ...cloverCreds, sandbox_mode: e.target.checked })}
                                    className="rounded accent-blue-600 w-4 h-4" />
                                Sandbox mode
                            </label>
                        </div>
                        <div className="mt-2.5">
                            <CloverSetupInstructions siteUrl={siteUrl} />
                        </div>
                    </div>
                )}

                {/* Tax Collection */}
                {(pm.stripe || pm.etransfer || pm.paypal || pm.converge || pm.clover) && (
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-2 flex items-center gap-1.5">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            Tax Collection
                        </label>
                        {pm.stripe && stripeConnected && (
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
                        )}
                        {pm.stripe && stripeConnected && settings.tax_enabled && (
                            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Make sure tax registrations are configured in your Stripe Dashboard
                            </p>
                        )}

                        <div className={pm.stripe && stripeConnected ? 'mt-4 pt-4 border-t border-slate-200' : ''}>
                            <p className="text-sm font-semibold text-slate-800 mb-1">Flat-rate tax</p>
                            <p className="text-xs text-slate-500 mb-3">
                                Charge a fixed tax percentage on every booking (applies to e-Transfer bookings
                                {settings.tax_enabled ? ', and to Stripe bookings only if Stripe automatic tax is off' : ', and to Stripe bookings'}).
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

                {/* Save */}
                <button
                    onClick={handleSave}
                    disabled={saving || (!dirty && !saved)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
        </div>
    );
}
