'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import KeystoneLogo from '@/app/components/KeystoneLogo';
import { ArrowLeft, CreditCard, ExternalLink, Loader2, User, History } from 'lucide-react';

interface SubscriptionData {
    subscription_status: string;
    subscription_plan: string;
    subscription_started_at: string;
    updated_at: string;
}

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [loadingSub, setLoadingSub] = useState(true);
    const [generatingPortal, setGeneratingPortal] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

                    {/* Subscription / Billing Area */}
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
                                {subscription ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Plan</p>
                                                <p className="font-semibold text-lg text-slate-900">{subscription.subscription_plan}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Started As Of</p>
                                                <p className="font-medium text-slate-700">{new Date(subscription.subscription_started_at).toLocaleDateString()}</p>
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

                    </div>
                </div>

            </main>
        </div>
    );
}
