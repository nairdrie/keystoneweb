'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';

type Status = {
    kind: 'order' | 'booking';
    id: string;
    paymentStatus: 'unpaid' | 'pending' | 'paid' | 'failed' | string;
    totalCents: number;
    customerEmail: string;
};

type View =
    | { type: 'verifying' }
    | { type: 'paid'; status: Status }
    | { type: 'failed'; reason: string }
    | { type: 'cancelled' }
    | { type: 'timeout'; status?: Status }
    | { type: 'not_found' };

const POLL_MS = 1500;
const TIMEOUT_MS = 45_000;

export default function CloverReturn() {
    const searchParams = useSearchParams();
    const ick = searchParams.get('ick');
    const intent = searchParams.get('status');
    const [view, setView] = useState<View>({ type: 'verifying' });

    useEffect(() => {
        // Cover URL routes: /return?status=cancelled / failed without polling
        if (intent === 'cancelled') {
            setView({ type: 'cancelled' });
            return;
        }

        if (!ick) {
            // No session id and no explicit status — treat as cancelled (buyer abandoned)
            setView(intent === 'failed' ? { type: 'failed', reason: 'Payment failed' } : { type: 'cancelled' });
            return;
        }

        let cancelled = false;
        const start = Date.now();

        const poll = async () => {
            try {
                const res = await fetch(`/api/clover/status?ick=${encodeURIComponent(ick)}`);
                if (res.status === 404) {
                    if (Date.now() - start > 5_000) {
                        if (!cancelled) setView({ type: 'not_found' });
                        return;
                    }
                } else if (res.ok) {
                    const data: Status = await res.json();
                    if (cancelled) return;

                    if (data.paymentStatus === 'paid') {
                        // Tell every CartProvider on the site to clear its stored cart
                        // the next time it mounts. We don't know the siteId here, so we
                        // mark all known cart_* keys for clearing.
                        try {
                            for (let i = 0; i < localStorage.length; i++) {
                                const key = localStorage.key(i);
                                if (key && key.startsWith('cart_') && !key.startsWith('cart_clear_')) {
                                    const siteId = key.slice('cart_'.length);
                                    localStorage.setItem(`cart_clear_${siteId}`, '1');
                                }
                            }
                        } catch { }
                        setView({ type: 'paid', status: data });
                        return;
                    }
                    if (data.paymentStatus === 'failed') {
                        setView({ type: 'failed', reason: 'Payment was declined' });
                        return;
                    }
                    // still unpaid/pending → keep polling unless explicit failure intent
                    if (intent === 'failed' && Date.now() - start > 5_000) {
                        setView({ type: 'failed', reason: 'Payment failed' });
                        return;
                    }
                    if (Date.now() - start > TIMEOUT_MS) {
                        setView({ type: 'timeout', status: data });
                        return;
                    }
                }
            } catch {
                // ignore transient errors, keep polling until timeout
                if (Date.now() - start > TIMEOUT_MS) {
                    if (!cancelled) setView({ type: 'timeout' });
                    return;
                }
            }

            if (!cancelled) setTimeout(poll, POLL_MS);
        };

        poll();
        return () => { cancelled = true; };
    }, [ick, intent]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
                {view.type === 'verifying' && <Verifying />}
                {view.type === 'paid' && <Paid status={view.status} />}
                {view.type === 'failed' && <Failed reason={view.reason} />}
                {view.type === 'cancelled' && <Cancelled />}
                {view.type === 'timeout' && <Timeout orderId={view.status?.id} />}
                {view.type === 'not_found' && <NotFound />}
            </div>
        </div>
    );
}

function Verifying() {
    return (
        <div className="text-center">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-1">Verifying your payment</h1>
            <p className="text-sm text-slate-500">This usually takes just a few seconds…</p>
        </div>
    );
}

function Paid({ status }: { status: Status }) {
    const dollars = (status.totalCents / 100).toFixed(2);
    return (
        <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Payment received</h1>
            <p className="text-sm text-slate-600 mb-4">
                {status.kind === 'booking' ? 'Your booking is confirmed.' : 'Your order is confirmed.'}
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left text-sm space-y-1 mb-5">
                <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono text-slate-900">{status.id.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-semibold text-slate-900">${dollars}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="text-slate-900 truncate ml-2">{status.customerEmail}</span></div>
            </div>
            <p className="text-xs text-slate-400 mb-4">A confirmation email has been sent to {status.customerEmail}.</p>
            <a href="/" className="inline-block px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg">
                Continue
            </a>
        </div>
    );
}

function Failed({ reason }: { reason: string }) {
    return (
        <div className="text-center">
            <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-1">Payment failed</h1>
            <p className="text-sm text-slate-600 mb-5">{reason}. No charge was made — you can try again.</p>
            <a href="/" className="inline-block px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg">
                Back to store
            </a>
        </div>
    );
}

function Cancelled() {
    return (
        <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-1">Checkout cancelled</h1>
            <p className="text-sm text-slate-600 mb-5">No payment was taken. Your cart is still waiting for you.</p>
            <a href="/" className="inline-block px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg">
                Back to store
            </a>
        </div>
    );
}

function Timeout({ orderId }: { orderId?: string }) {
    return (
        <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-1">Still processing</h1>
            <p className="text-sm text-slate-600 mb-5">
                Your payment is taking longer than usual to confirm. If you were charged, you'll receive a confirmation
                email shortly{orderId ? ` (reference ${orderId.slice(0, 8)})` : ''}. You can safely close this page.
            </p>
            <a href="/" className="inline-block px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg">
                Back to store
            </a>
        </div>
    );
}

function NotFound() {
    return (
        <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-1">No checkout to show</h1>
            <p className="text-sm text-slate-600 mb-5">We couldn't find a matching checkout session.</p>
            <a href="/" className="inline-block px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg">
                Back to store
            </a>
        </div>
    );
}
