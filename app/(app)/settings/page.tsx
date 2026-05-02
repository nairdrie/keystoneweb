'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import KeystoneLogo from '@/app/components/KeystoneLogo';
import { ArrowLeft, CreditCard, ExternalLink, Loader2, User, History, Globe, Link2, AlertCircle, CheckCircle2, Lock, Puzzle, Zap, Receipt, Download, FileText } from 'lucide-react';

interface SubscriptionData {
    subscription_status: string;
    subscription_plan: string;
    subscription_started_at: string;
    updated_at: string;
}

interface UserAddon {
    id: string;
    addon_type: string;
    quantity: number;
    status: 'approved' | 'active';
    monthly_price: number;
    yearly_price: number;
    activated_at: string | null;
    notes: string | null;
}

const ADDON_LABELS: Record<string, string> = {
    extra_sites: 'Extra Published Sites',
    extra_domains: 'Extra Custom Domains',
    extra_storage: 'Extra Storage (5 GB)',
    extra_ai: 'Extra AI Prompts',
    white_label: 'White-Label Branding',
    extra_inbox_email: 'Extra Inbox Email',
};

interface OwnedDomain {
    id: string;
    domain: string;
    site_id: string | null;
    site_name: string | null;
    status: string;
    is_free_with_pro: boolean;
    amount_cents: number;
    expires_at: string | null;
    auto_renew: boolean;
    cancelled_at: string | null;
    created_at: string;
}

interface Transaction {
    id: string;
    transaction_type: string;
    description: string | null;
    amount_cents: number;
    currency: string;
    status: 'succeeded' | 'failed' | 'refunded' | 'pending';
    invoice_url: string | null;
    invoice_pdf: string | null;
    period_start: string | null;
    period_end: string | null;
    created_at: string;
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
    subscription: 'Subscription',
    subscription_created: 'Subscription',
    subscription_payment: 'Subscription',
    subscription_status_change: 'Subscription',
    domain_purchase: 'Domain Purchase',
    domain_transfer: 'Domain Transfer',
    ecommerce_order: 'E-commerce Order',
    one_time_payment: 'Payment',
    addon: 'Add-on',
};

const STATUS_STYLES: Record<string, string> = {
    succeeded: 'bg-green-100 text-green-800 border-green-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    refunded: 'bg-slate-100 text-slate-800 border-slate-200',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
};

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [avatarErrored, setAvatarErrored] = useState(false);
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [loadingSub, setLoadingSub] = useState(true);
    const [generatingPortal, setGeneratingPortal] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Add-ons state
    const [addons, setAddons] = useState<UserAddon[]>([]);
    const [loadingAddons, setLoadingAddons] = useState(true);
    const [activatingAddon, setActivatingAddon] = useState<string | null>(null);

    // Domain state
    const [domains, setDomains] = useState<OwnedDomain[]>([]);
    const [loadingDomains, setLoadingDomains] = useState(true);

    // Billing history state
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/signin');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            const fetchSubscription = async () => {
                try {
                    const res = await fetch('/api/user/subscription');
                    if (res.ok) {
                        const data = await res.json();
                        setSubscription(data.subscription);
                    }
                } catch (err) {
                    console.error('Failed to fetch subscription:', err);
                } finally {
                    setLoadingSub(false);
                }
            };

            fetchSubscription();
        }
    }, [user]);

    // Fetch add-ons
    useEffect(() => {
        if (user) {
            const fetchAddons = async () => {
                try {
                    const res = await fetch('/api/user/addons');
                    if (res.ok) {
                        const data = await res.json();
                        setAddons(data.addons || []);
                    }
                } catch (err) {
                    console.error('Failed to fetch add-ons:', err);
                } finally {
                    setLoadingAddons(false);
                }
            };
            fetchAddons();
        }
    }, [user]);

    // Fetch owned domains
    useEffect(() => {
        if (user) {
            const fetchDomains = async () => {
                try {
                    const res = await fetch('/api/domains/owned', { credentials: 'include' });
                    if (res.ok) {
                        const data = await res.json();
                        setDomains(data.domains || []);
                    }
                } catch (err) {
                    console.error('Failed to fetch domains:', err);
                } finally {
                    setLoadingDomains(false);
                }
            };

            fetchDomains();
        }
    }, [user]);

    // Fetch billing history
    useEffect(() => {
        if (user) {
            const fetchTransactions = async () => {
                try {
                    const res = await fetch('/api/user/billing-history');
                    if (res.ok) {
                        const data = await res.json();
                        setTransactions(data.transactions || []);
                    }
                } catch (err) {
                    console.error('Failed to fetch billing history:', err);
                } finally {
                    setLoadingTransactions(false);
                }
            };
            fetchTransactions();
        }
    }, [user]);

    const handleActivateAddon = async (addonId: string) => {
        setActivatingAddon(addonId);
        try {
            const res = await fetch('/api/stripe/addons/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addonId }),
            });
            if (res.ok) {
                // Refresh addons list
                const addonsRes = await fetch('/api/user/addons');
                if (addonsRes.ok) {
                    const data = await addonsRes.json();
                    setAddons(data.addons || []);
                }
            } else {
                const err = await res.json();
                setError(err.error || 'Failed to activate add-on');
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setActivatingAddon(null);
        }
    };

    const handleManageBilling = async () => {
        setGeneratingPortal(true);
        setError(null);
        try {
            const res = await fetch('/api/stripe/portal', {
                method: 'POST',
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate billing portal link');
            }

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err: any) {
            console.error('Portal Error:', err);
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setGeneratingPortal(false);
        }
    };

    if (authLoading || (user && loadingSub)) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    const completedDomains = domains.filter((d) => d.status === 'completed');
    const allocatedDomains = completedDomains.filter((d) => d.site_id);
    const unallocatedDomains = completedDomains.filter((d) => !d.site_id);
    const isPro = subscription?.subscription_status === 'active' &&
        subscription?.subscription_plan?.toLowerCase().includes('pro');

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-full transition-colors flex items-center justify-center"
                            title="Go Back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <KeystoneLogo href="/" size="lg" showText={false} />
                    </div>
                    <div className="text-sm font-semibold text-slate-600">
                        Account Settings
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-10">
                <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

                <div className="grid md:grid-cols-3 gap-8">

                    {/* User Profile Card */}
                    <div className="md:col-span-1 border border-slate-200 bg-white rounded-2xl shadow-sm p-6 mb-6 md:mb-0 h-fit">
                        <div className="w-16 h-16 bg-red-100 text-red-700 rounded-full flex items-center justify-center mb-4 mx-auto md:mx-0 overflow-hidden">
                            {user.user_metadata?.avatar_url && !avatarErrored ? (
                                <img
                                    src={user.user_metadata.avatar_url}
                                    alt={user.user_metadata?.full_name || user.user_metadata?.name || user.email || ''}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                    onError={() => setAvatarErrored(true)}
                                />
                            ) : (
                                <User className="w-8 h-8" />
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-center md:text-left">{user.email?.split('@')[0]}</h2>
                        <p className="text-slate-500 text-sm mb-6 text-center md:text-left">{user.email}</p>

                        <div className="h-px bg-slate-100 mb-6 w-full" />

                        <button
                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
                            onClick={async () => {
                                await fetch('/api/auth/signout', { method: 'POST' });
                                window.location.href = '/';
                            }}
                        >
                            Log Out
                        </button>
                    </div>

                    {/* Subscription / Billing / Domains */}
                    <div className="md:col-span-2 space-y-6">

                        {/* Active Subscription Block */}
                        <div className="border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                                        <CreditCard className="w-5 h-5 text-red-500" />
                                        Current Subscription
                                    </h2>
                                    <p className="text-sm text-slate-500">Manage your Keystoneweb site plan and billing information.</p>
                                </div>

                                {subscription?.subscription_status === 'active' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                        Active
                                    </span>
                                )}
                                {subscription?.subscription_status === 'past_due' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                        Past Due
                                    </span>
                                )}
                                {subscription?.subscription_status === 'canceled' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                        Canceled
                                    </span>
                                )}
                            </div>

                            <div className="p-6 bg-slate-50/50">
                                {subscription && subscription.subscription_status && subscription.subscription_status !== 'inactive' ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Plan</p>
                                                <p className="font-semibold text-lg text-slate-900">{subscription.subscription_plan}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Started As Of</p>
                                                <p className="font-medium text-slate-700">{subscription.subscription_started_at ? new Date(subscription.subscription_started_at).toLocaleDateString() : '—'}</p>
                                            </div>
                                        </div>

                                        {error && (
                                            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                                                {error}
                                            </div>
                                        )}

                                        <button
                                            onClick={handleManageBilling}
                                            disabled={generatingPortal}
                                            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white text-sm font-bold rounded-xl shadow-md transition-all"
                                        >
                                            {generatingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                            {generatingPortal ? 'Opening Portal...' : 'Manage Billing & Subscription'}
                                        </button>
                                        <p className="text-[11px] text-slate-500">
                                            Clicking this button will safely redirect you to our Stripe Customer Portal where you can securely update your payment method, download invoices, or cancel/upgrade your plan.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <History className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <h3 className="text-slate-900 font-semibold mb-1">No Active Subscription</h3>
                                        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
                                            You do not currently have a paid Keystoneweb subscription attached to this account.
                                        </p>
                                        <button
                                            onClick={() => router.push('/')}
                                            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg transition-colors"
                                        >
                                            Go to Dashboard
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════ */}
                        {/* Plan Add-Ons Block                              */}
                        {/* ═══════════════════════════════════════════════ */}
                        {!loadingAddons && addons.length > 0 && (
                        <div className="border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                                    <Puzzle className="w-5 h-5 text-red-500" />
                                    Plan Add-Ons
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Custom add-ons applied to your Pro plan.
                                </p>
                            </div>

                            <div className="p-6 bg-slate-50/50">
                                {addons.some(a => a.status === 'approved') && (
                                    <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                        <p className="text-sm text-amber-800 font-medium">
                                            You have approved add-ons ready to activate!
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {addons.map((addon) => {
                                        const label = ADDON_LABELS[addon.addon_type] || addon.addon_type;
                                        const totalMonthly = addon.monthly_price * addon.quantity;
                                        return (
                                            <div
                                                key={addon.id}
                                                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded-xl gap-3 ${
                                                    addon.status === 'approved' ? 'border-amber-300' : 'border-slate-200'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                        addon.status === 'active' ? 'bg-green-100' : 'bg-amber-100'
                                                    }`}>
                                                        {addon.status === 'active' ? (
                                                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                        ) : (
                                                            <Zap className="w-4 h-4 text-amber-600" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900">
                                                            {addon.quantity > 1 ? `${addon.quantity}× ` : ''}{label}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-sm text-slate-500">
                                                                ${totalMonthly.toFixed(2)}/mo
                                                            </span>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                addon.status === 'active'
                                                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                            }`}>
                                                                {addon.status === 'active' ? 'Active' : 'Pending Activation'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {addon.status === 'approved' && (
                                                    <button
                                                        onClick={() => handleActivateAddon(addon.id)}
                                                        disabled={activatingAddon === addon.id}
                                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white text-sm font-bold rounded-lg shadow transition-all flex-shrink-0"
                                                    >
                                                        {activatingAddon === addon.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : null}
                                                        {activatingAddon === addon.id ? 'Activating...' : 'Accept & Pay'}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Total summary */}
                                <div className="mt-4 pt-3 border-t border-slate-100">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Add-on total</span>
                                        <span className="font-semibold text-slate-900">
                                            ${addons.filter(a => a.status === 'active').reduce((sum, a) => sum + a.monthly_price * a.quantity, 0).toFixed(2)}/mo
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* ═══════════════════════════════════════════════ */}
                        {/* Domains Management Block                       */}
                        {/* ═══════════════════════════════════════════════ */}
                        <div className="border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                                    <Globe className="w-5 h-5 text-red-500" />
                                    Your Domains
                                </h2>
                                <p className="text-sm text-slate-500">
                                    View and manage domains you own. Domains persist even if you delete a site.
                                </p>
                            </div>

                            <div className="p-6 bg-slate-50/50">
                                {loadingDomains ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                    </div>
                                ) : completedDomains.length === 0 ? (
                                    <div className="text-center py-6">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Globe className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <h3 className="text-slate-900 font-semibold mb-1">No Domains Yet</h3>
                                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                            You haven&apos;t registered any domains yet. Domains can be purchased when publishing a site.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {completedDomains.map((domain) => {
                                            const isParked = !isPro;
                                            return (
                                            <div
                                                key={domain.id}
                                                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded-xl gap-3 ${isParked ? 'border-slate-300 opacity-80' : 'border-slate-200'}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isParked ? 'bg-slate-100' : domain.site_id ? 'bg-green-100' : 'bg-amber-100'}`}>
                                                        {isParked ? (
                                                            <Lock className="w-4 h-4 text-slate-400" />
                                                        ) : domain.site_id ? (
                                                            <Link2 className="w-4 h-4 text-green-600" />
                                                        ) : (
                                                            <AlertCircle className="w-4 h-4 text-amber-600" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className={`font-mono font-semibold ${isParked ? 'text-slate-400' : 'text-slate-900'}`}>{domain.domain}</p>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                            {isParked ? (
                                                                <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                                    <Lock className="w-3 h-3" />
                                                                    Parked — Requires Pro
                                                                </span>
                                                            ) : domain.site_id ? (
                                                                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    Linked to {domain.site_name || 'a site'}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    Not assigned to a site
                                                                </span>
                                                            )}
                                                            {domain.is_free_with_pro ? (
                                                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                                    Included with Pro
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                                    Purchased (${(domain.amount_cents / 100).toFixed(2)})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                    {isParked ? (
                                                        <>
                                                            {domain.expires_at && (
                                                                <p className="text-xs text-slate-400">
                                                                    Expires: {new Date(domain.expires_at).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                            <button
                                                                onClick={() => router.push('/pricing')}
                                                                className="text-xs font-semibold px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                                            >
                                                                Upgrade to Activate
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {domain.expires_at && (
                                                                <p className="text-xs text-slate-500">
                                                                    {domain.auto_renew ? 'Renews' : 'Expires'}: {new Date(domain.expires_at).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                            {!domain.expires_at && (
                                                                <p className="text-xs text-slate-500">
                                                                    Registered: {new Date(domain.created_at).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                            {domain.auto_renew && !domain.cancelled_at && (
                                                                <span className="inline-flex items-center text-[10px] text-green-600 font-medium">
                                                                    Auto-renew on
                                                                </span>
                                                            )}
                                                            {domain.cancelled_at && (
                                                                <span className="inline-flex items-center text-[10px] text-red-600 font-medium">
                                                                    Cancelled
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            );
                                        })}

                                        {/* Summary */}
                                        <div className="pt-3 border-t border-slate-100">
                                            <div className="flex items-center justify-between text-xs text-slate-500">
                                                <span>{completedDomains.length} domain{completedDomains.length !== 1 ? 's' : ''} total</span>
                                                <span>
                                                    {allocatedDomains.length} linked, {unallocatedDomains.length} unassigned
                                                </span>
                                            </div>
                                            {unallocatedDomains.length > 0 && (
                                                <p className="text-xs text-amber-600 mt-2">
                                                    You have {unallocatedDomains.length} unassigned domain{unallocatedDomains.length !== 1 ? 's' : ''}. You can assign {unallocatedDomains.length === 1 ? 'it' : 'them'} to a site when publishing.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════ */}
                        {/* Billing History Block                           */}
                        {/* ═══════════════════════════════════════════════ */}
                        <div className="border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                                    <Receipt className="w-5 h-5 text-red-500" />
                                    Billing History
                                </h2>
                                <p className="text-sm text-slate-500">
                                    View your past payments, invoices, and transactions.
                                </p>
                            </div>

                            <div className="p-6 bg-slate-50/50">
                                {loadingTransactions ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                    </div>
                                ) : transactions.length === 0 ? (
                                    <div className="text-center py-6">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Receipt className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <h3 className="text-slate-900 font-semibold mb-1">No Transactions Yet</h3>
                                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                            Your billing history will appear here once you make a payment.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {transactions.map((tx) => (
                                            <div
                                                key={tx.id}
                                                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl gap-3"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                        tx.status === 'succeeded' ? 'bg-green-100' :
                                                        tx.status === 'refunded' ? 'bg-slate-100' :
                                                        tx.status === 'failed' ? 'bg-red-100' : 'bg-amber-100'
                                                    }`}>
                                                        {tx.status === 'succeeded' ? (
                                                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                        ) : tx.status === 'refunded' ? (
                                                            <History className="w-4 h-4 text-slate-500" />
                                                        ) : tx.status === 'failed' ? (
                                                            <AlertCircle className="w-4 h-4 text-red-600" />
                                                        ) : (
                                                            <Loader2 className="w-4 h-4 text-amber-600" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900">
                                                            {tx.description || TRANSACTION_TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                                {TRANSACTION_TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                                                            </span>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[tx.status] || STATUS_STYLES.pending}`}>
                                                                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                                                            </span>
                                                            {tx.period_start && tx.period_end && (
                                                                <span className="text-xs text-slate-400">
                                                                    {new Date(tx.period_start).toLocaleDateString()} &ndash; {new Date(tx.period_end).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                    <p className={`font-semibold tabular-nums ${tx.status === 'refunded' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                                        ${(tx.amount_cents / 100).toFixed(2)} {tx.currency.toUpperCase()}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {new Date(tx.created_at).toLocaleDateString()}
                                                    </p>
                                                    {(tx.invoice_url || tx.invoice_pdf) && (
                                                        <div className="flex items-center gap-2">
                                                            {tx.invoice_url && (
                                                                <a
                                                                    href={tx.invoice_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                                                                >
                                                                    <FileText className="w-3 h-3" />
                                                                    Invoice
                                                                </a>
                                                            )}
                                                            {tx.invoice_pdf && (
                                                                <a
                                                                    href={tx.invoice_pdf}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                                                                >
                                                                    <Download className="w-3 h-3" />
                                                                    PDF
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

            </main>
        </div>
    );
}
