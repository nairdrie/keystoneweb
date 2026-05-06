'use client';

import { useEffect, useRef, useState } from 'react';
import { CreditCard, Loader2, AlertCircle } from 'lucide-react';

interface CloverIframeProps {
    publicKey: string;
    merchantId: string;
    sandboxMode: boolean;
    amountCents: number;
    currency?: string;
    /** Provide orderId for ecommerce orders */
    orderId?: string;
    /** Provide bookingId for booking payments */
    bookingId?: string;
    onSuccess: () => void;
    onError: (message: string) => void;
    palette?: Record<string, string>;
}

const ELEMENT_STYLE = {
    body: { fontFamily: 'inherit', fontSize: '14px' },
    input: { fontSize: '14px', color: '#1e293b' },
};

export default function CloverIframe({
    publicKey,
    merchantId,
    sandboxMode,
    amountCents,
    currency = 'USD',
    orderId,
    bookingId,
    onSuccess,
    onError,
    palette = {},
}: CloverIframeProps) {
    const [sdkReady, setSdkReady] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [charging, setCharging] = useState(false);
    const [cardError, setCardError] = useState<string | null>(null);
    const cloverRef = useRef<any>(null);
    const initAttempted = useRef(false);

    const pSecondary = palette.secondary || '#2563eb';
    const amountLabel = `$${(amountCents / 100).toFixed(2)}`;

    // Load the Clover.js SDK once
    useEffect(() => {
        if ((window as any).Clover) {
            setSdkReady(true);
            return;
        }
        const existing = document.querySelector('script[src*="checkout.clover.com/sdk"]');
        if (existing) {
            existing.addEventListener('load', () => setSdkReady(true));
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.clover.com/sdk.js';
        script.async = true;
        script.onload = () => setSdkReady(true);
        script.onerror = () => onError('Failed to load payment form. Please refresh and try again.');
        document.head.appendChild(script);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Mount Clover elements once the SDK is ready and DOM containers exist
    useEffect(() => {
        if (!sdkReady || initAttempted.current) return;
        initAttempted.current = true;

        try {
            const clover = new (window as any).Clover(publicKey, {
                merchantId,
                locale: 'en-US',
                sandbox: sandboxMode,
            });
            cloverRef.current = clover;
            const elements = clover.elements();

            const cardNumber = elements.create('CARD_NUMBER', ELEMENT_STYLE);
            const cardDate = elements.create('CARD_DATE', ELEMENT_STYLE);
            const cardCvv = elements.create('CARD_CVV', ELEMENT_STYLE);
            const cardPostalCode = elements.create('CARD_POSTAL_CODE', ELEMENT_STYLE);

            cardNumber.mount('#clover-card-number');
            cardDate.mount('#clover-card-date');
            cardCvv.mount('#clover-card-cvv');
            cardPostalCode.mount('#clover-card-postal');

            // Listen for inline validation errors from any card field
            [cardNumber, cardDate, cardCvv, cardPostalCode].forEach(el => {
                el.addEventListener('change', (ev: any) => {
                    setCardError(ev?.error?.message || null);
                });
            });

            // Google Pay button
            const paymentRequestButton = elements.create('PAYMENT_REQUEST_BUTTON', {
                paymentReqData: {
                    total: { label: 'Order Total', amount: amountCents },
                    options: { button: { buttonType: 'short' } },
                },
            });
            paymentRequestButton.mount('#clover-payment-request');

            paymentRequestButton.addEventListener('paymentMethod', async (tokenData: any) => {
                if (!tokenData?.token) return;
                await chargeToken(tokenData.token);
            });

            setInitialized(true);
        } catch (err: any) {
            onError(err?.message || 'Failed to initialize payment form.');
        }
    }, [sdkReady]); // eslint-disable-line react-hooks/exhaustive-deps

    const chargeToken = async (token: string) => {
        setCharging(true);
        setCardError(null);
        try {
            const res = await fetch('/api/clover/charge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, orderId, bookingId }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setCardError(data.error || 'Payment failed. Please try again.');
                setCharging(false);
                return;
            }
            onSuccess();
        } catch (err: any) {
            setCardError(err?.message || 'An unexpected error occurred.');
            setCharging(false);
        }
    };

    const handleCardSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();
        if (!cloverRef.current || charging || !initialized) return;
        setCharging(true);
        setCardError(null);

        try {
            const result = await cloverRef.current.createToken();
            const errors = result?.errors || {};
            if (Object.keys(errors).length > 0) {
                const first = Object.values(errors)[0] as any;
                setCardError(first?.message || 'Please check your card details.');
                setCharging(false);
                return;
            }
            if (!result?.token) {
                setCardError('Could not tokenize card. Please try again.');
                setCharging(false);
                return;
            }
            await chargeToken(result.token);
        } catch (err: any) {
            setCardError(err?.message || 'Card processing error.');
            setCharging(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Loading skeleton shown until SDK initializes */}
            {!initialized && (
                <div className="flex items-center justify-center py-6 gap-2 text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading payment form…
                </div>
            )}

            <div className={initialized ? 'block' : 'invisible h-0 overflow-hidden'}>
                {/* Google Pay button */}
                <div id="clover-payment-request" className="min-h-[44px]" />

                {/* Divider */}
                <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400">or pay with card</span>
                    <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Card form */}
                <form onSubmit={handleCardSubmit} className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Card Number</label>
                        <div
                            id="clover-card-number"
                            className="border border-slate-300 rounded-lg px-3 py-2.5 min-h-[42px] bg-white"
                        />
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-xs font-medium text-slate-600 block mb-1">Expiry</label>
                            <div
                                id="clover-card-date"
                                className="border border-slate-300 rounded-lg px-3 py-2.5 min-h-[42px] bg-white"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-medium text-slate-600 block mb-1">CVV</label>
                            <div
                                id="clover-card-cvv"
                                className="border border-slate-300 rounded-lg px-3 py-2.5 min-h-[42px] bg-white"
                            />
                        </div>
                    </div>

                    <div className="w-40">
                        <label className="text-xs font-medium text-slate-600 block mb-1">Postal / ZIP</label>
                        <div
                            id="clover-card-postal"
                            className="border border-slate-300 rounded-lg px-3 py-2.5 min-h-[42px] bg-white"
                        />
                    </div>

                    {cardError && (
                        <div className="flex items-start gap-1.5 text-red-600 text-xs">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            {cardError}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={charging}
                        className="w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: pSecondary }}
                    >
                        {charging ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <CreditCard className="w-5 h-5" />
                        )}
                        Pay {amountLabel}
                    </button>
                </form>
            </div>
        </div>
    );
}
