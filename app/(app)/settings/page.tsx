'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import KeystoneLogo from '@/app/components/KeystoneLogo';
import { ArrowLeft, CreditCard, ExternalLink, Loader2, User, History, Globe, Link2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SubscriptionData {
    subscription_status: string;
    subscription_plan: string;
    subscription_started_at: string;
    updated_at: string;
}

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

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [loadingSub, setLoadingSub] = useState(true);
    const [generatingPortal, setGeneratingPortal] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Domain state
    const [domains, setDomains] = useState<OwnedDomain[]>([]);
    const [loadingDomains, setLoadingDomains] = useState(true);

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
                        <div className="w-16 h-16 bg-red-100 text-red-700 rounded-full flex items-center justify-center mb-4 mx-auto md:mx-0">
                            <User className="w-8 h-8" />
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
                                        {completedDomains.map((domain) => (
                                            <div
                                                key={domain.id}
                                                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl gap-3"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${domain.site_id ? 'bg-green-100' : 'bg-amber-100'}`}>
                                                        {domain.site_id ? (
                                                            <Link2 className="w-4 h-4 text-green-600" />
                                                        ) : (
                                                            <AlertCircle className="w-4 h-4 text-amber-600" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-mono font-semibold text-slate-900">{domain.domain}</p>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                            {domain.site_id ? (
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

                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
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
                                                </div>
                                            </div>
                                        ))}

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

                    </div>
                </div>

            </main>
        </div>
    );
}
