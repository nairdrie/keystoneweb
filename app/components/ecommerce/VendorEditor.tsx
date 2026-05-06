'use client';

import { useState } from 'react';
import {
    Loader2, Check, AlertCircle, Copy, Trash2, Plus, X,
    Star, Mail, CreditCard, ExternalLink, Edit2, Save, Eye, EyeOff,
} from 'lucide-react';
import CloverSetupInstructions from './CloverSetupInstructions';

export type PaymentMode = 'stripe' | 'converge' | 'clover' | 'external';

export interface Vendor {
    id: string;
    site_id: string;
    name: string;
    contact_email: string;
    payment_mode: PaymentMode;
    stripe_account_id: string | null;
    converge_merchant_id: string | null;
    converge_user_id: string | null;
    converge_pin: string | null;
    converge_demo_mode: boolean;
    clover_merchant_id: string | null;
    clover_public_key: string | null;
    clover_private_token: string | null;
    clover_webhook_secret: string | null;
    clover_sandbox_mode: boolean;
    is_default: boolean;
    cc_notification_emails: string[];
}

interface VendorEditorProps {
    vendor: Vendor;
    portalToken?: string;
    siteUrl?: string | null;
    onSave: (updates: Partial<Vendor> & { convergePin?: string; cloverPrivateToken?: string; cloverWebhookSecret?: string }) => Promise<void>;
    onDelete: () => void;
    onConnectStripe: () => void;
    onCopyPortal: () => void;
    connecting: boolean;
    copied: boolean;
}

const MODE_LABELS: Record<PaymentMode, { label: string; desc: string; color: string }> = {
    stripe: { label: 'Stripe', desc: 'Vendor has a Stripe account; funds route to them', color: 'violet' },
    converge: { label: 'Converge (Elavon)', desc: 'Vendor uses Converge; charges their merchant account', color: 'sky' },
    clover: { label: 'Clover', desc: 'Vendor uses Clover; charges their merchant account', color: 'emerald' },
    external: { label: 'External', desc: 'No on-site payment; vendor contacts customer directly', color: 'slate' },
};

export default function VendorEditor({
    vendor, portalToken, siteUrl, onSave, onDelete, onConnectStripe, onCopyPortal, connecting, copied,
}: VendorEditorProps) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showSecrets, setShowSecrets] = useState(false);
    const [draft, setDraft] = useState({
        name: vendor.name,
        contact_email: vendor.contact_email,
        payment_mode: vendor.payment_mode,
        is_default: vendor.is_default,
        cc_notification_emails: vendor.cc_notification_emails || [],
        converge_merchant_id: vendor.converge_merchant_id || '',
        converge_user_id: vendor.converge_user_id || '',
        converge_pin: '', // only set when changing
        converge_demo_mode: vendor.converge_demo_mode,
        clover_merchant_id: vendor.clover_merchant_id || '',
        clover_public_key: vendor.clover_public_key || '',
        clover_private_token: '', // only set when changing
        clover_webhook_secret: '', // only set when changing
        clover_sandbox_mode: vendor.clover_sandbox_mode,
    });
    const [newCcEmail, setNewCcEmail] = useState('');

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({
                name: draft.name,
                contact_email: draft.contact_email,
                payment_mode: draft.payment_mode,
                is_default: draft.is_default,
                cc_notification_emails: draft.cc_notification_emails,
                converge_merchant_id: draft.converge_merchant_id,
                converge_user_id: draft.converge_user_id,
                convergePin: draft.converge_pin || undefined,
                converge_demo_mode: draft.converge_demo_mode,
                clover_merchant_id: draft.clover_merchant_id,
                clover_public_key: draft.clover_public_key,
                cloverPrivateToken: draft.clover_private_token || undefined,
                cloverWebhookSecret: draft.clover_webhook_secret || undefined,
                clover_sandbox_mode: draft.clover_sandbox_mode,
            });
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const addCcEmail = () => {
        const email = newCcEmail.trim();
        if (!email || !email.includes('@')) return;
        if (draft.cc_notification_emails.includes(email)) return;
        setDraft({ ...draft, cc_notification_emails: [...draft.cc_notification_emails, email] });
        setNewCcEmail('');
    };

    const removeCcEmail = (email: string) => {
        setDraft({ ...draft, cc_notification_emails: draft.cc_notification_emails.filter((e: string) => e !== email) });
    };

    const modeInfo = MODE_LABELS[vendor.payment_mode];
    const isConfigured =
        (vendor.payment_mode === 'stripe' && vendor.stripe_account_id) ||
        (vendor.payment_mode === 'converge' && vendor.converge_merchant_id && vendor.converge_user_id && vendor.converge_pin) ||
        (vendor.payment_mode === 'clover' && vendor.clover_merchant_id && vendor.clover_private_token) ||
        (vendor.payment_mode === 'external');

    if (!editing) {
        return (
            <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800">{vendor.name}</p>
                            {vendor.is_default && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    <Star className="w-2.5 h-2.5 fill-current" /> DEFAULT
                                </span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium bg-${modeInfo.color}-50 text-${modeInfo.color}-700`}>
                                {modeInfo.label}
                            </span>
                            {!isConfigured && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                    <AlertCircle className="w-2.5 h-2.5" /> Not configured
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{vendor.contact_email}</p>
                        {vendor.cc_notification_emails?.length > 0 && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                CC: {vendor.cc_notification_emails.join(', ')}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        {vendor.payment_mode === 'stripe' && !vendor.stripe_account_id && (
                            <button
                                onClick={onConnectStripe}
                                disabled={connecting}
                                className="px-2 py-1 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                            >
                                {connecting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Connect Stripe'}
                            </button>
                        )}
                        {portalToken && (
                            <button
                                onClick={onCopyPortal}
                                className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1"
                            >
                                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copied ? 'Copied!' : 'Portal Link'}
                            </button>
                        )}
                        <button
                            onClick={() => setEditing(true)}
                            className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center gap-1"
                        >
                            <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button
                            onClick={onDelete}
                            className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded flex items-center justify-center"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="border-2 border-indigo-300 rounded-lg p-4 bg-indigo-50/30 space-y-3">
            {/* Basic info */}
            <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Name</label>
                <input
                    type="text"
                    value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
            </div>
            <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Contact Email (primary)</label>
                <input
                    type="email"
                    value={draft.contact_email}
                    onChange={e => setDraft({ ...draft, contact_email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
            </div>

            {/* CC emails */}
            <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Additional Notification Emails
                </label>
                {draft.cc_notification_emails.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                        {draft.cc_notification_emails.map(email => (
                            <span key={email} className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded px-2 py-1">
                                {email}
                                <button onClick={() => removeCcEmail(email)} className="text-slate-400 hover:text-red-500">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                <div className="flex gap-1.5">
                    <input
                        type="email"
                        placeholder="add another email..."
                        value={newCcEmail}
                        onChange={e => setNewCcEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCcEmail())}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <button onClick={addCcEmail} className="px-2 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded">
                        <Plus className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Default toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white">
                <div>
                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <Star className="w-3 h-3" /> Default Fulfiller
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Products without a specified vendor use this one</p>
                </div>
                <button
                    onClick={() => setDraft({ ...draft, is_default: !draft.is_default })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${draft.is_default ? 'bg-amber-500' : 'bg-slate-300'}`}
                >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${draft.is_default ? 'translate-x-4' : ''}`} />
                </button>
            </div>

            {/* Payment mode */}
            <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                    {(['stripe', 'converge', 'clover', 'external'] as PaymentMode[]).map(mode => {
                        const info = MODE_LABELS[mode];
                        const selected = draft.payment_mode === mode;
                        return (
                            <button
                                key={mode}
                                onClick={() => setDraft({ ...draft, payment_mode: mode })}
                                className={`px-2.5 py-2 text-xs font-medium rounded border-2 transition-colors text-left ${
                                    selected
                                        ? `border-${info.color}-500 bg-${info.color}-50 text-${info.color}-700`
                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                                }`}
                            >
                                <div className="flex items-center gap-1">
                                    {selected && <Check className="w-3 h-3" />}
                                    {info.label}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 font-normal">{info.desc}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Mode-specific credentials */}
            {draft.payment_mode === 'converge' && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-sky-800 flex items-center gap-1">
                        Converge (Elavon) Credentials
                        <button onClick={() => setShowSecrets(!showSecrets)} className="ml-auto text-sky-600 hover:text-sky-800">
                            {showSecrets ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                    </p>
                    <input
                        type="text"
                        placeholder="Merchant ID"
                        value={draft.converge_merchant_id}
                        onChange={e => setDraft({ ...draft, converge_merchant_id: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-sky-200 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    />
                    <input
                        type="text"
                        placeholder="API User ID"
                        value={draft.converge_user_id}
                        onChange={e => setDraft({ ...draft, converge_user_id: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-sky-200 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    />
                    <input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder={vendor.converge_pin ? 'PIN (leave blank to keep current)' : 'PIN'}
                        value={draft.converge_pin}
                        onChange={e => setDraft({ ...draft, converge_pin: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-sky-200 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                            type="checkbox"
                            checked={draft.converge_demo_mode}
                            onChange={e => setDraft({ ...draft, converge_demo_mode: e.target.checked })}
                            className="rounded"
                        />
                        Demo / sandbox mode
                    </label>
                    <p className="text-[10px] text-sky-700 mt-1">
                        Remember to whitelist your site domain under Settings &gt; HTTP(S) Referrers in your Converge admin.
                    </p>
                </div>
            )}

            {draft.payment_mode === 'clover' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                        Clover Credentials
                        <button onClick={() => setShowSecrets(!showSecrets)} className="ml-auto text-emerald-600 hover:text-emerald-800">
                            {showSecrets ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                    </p>
                    <input
                        type="text"
                        placeholder="Merchant ID"
                        value={draft.clover_merchant_id}
                        onChange={e => setDraft({ ...draft, clover_merchant_id: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-emerald-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <input
                        type="text"
                        placeholder="Public Key (ECOM)"
                        value={draft.clover_public_key}
                        onChange={e => setDraft({ ...draft, clover_public_key: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-emerald-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <input
                        type={showSecrets ? 'text' : 'password'}
                        placeholder={vendor.clover_private_token ? 'Private Key (ECOM) — leave blank to keep current' : 'Private Key (ECOM)'}
                        value={draft.clover_private_token}
                        onChange={e => setDraft({ ...draft, clover_private_token: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-emerald-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                            type="checkbox"
                            checked={draft.clover_sandbox_mode}
                            onChange={e => setDraft({ ...draft, clover_sandbox_mode: e.target.checked })}
                            className="rounded"
                        />
                        Sandbox mode
                    </label>
                    <CloverSetupInstructions siteUrl={siteUrl || null} />
                </div>
            )}

            {draft.payment_mode === 'external' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-600">
                        <strong>External payment:</strong> When a customer buys this vendor's products, they'll receive an email with the vendor's contact info. The vendor handles payment collection themselves.
                    </p>
                </div>
            )}

            {draft.payment_mode === 'stripe' && vendor.stripe_account_id && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-xs text-green-800">Stripe account connected</p>
                </div>
            )}

            {draft.payment_mode === 'stripe' && !vendor.stripe_account_id && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs text-amber-800 font-medium mb-1">Stripe not yet connected</p>
                        <p className="text-[11px] text-amber-700">Save this vendor, then click "Connect Stripe" to complete onboarding.</p>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                </button>
                <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
