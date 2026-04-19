'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

declare global {
    interface Window {
        PayWithConverge?: {
            open: (paymentData: any, callback: any) => void;
        };
    }
}

interface ConvergeLightboxProps {
    token: string;
    demoMode: boolean;
    onApproval: (response: any) => void;
    onDeclined: (response: any) => void;
    onError: (error: any) => void;
    onCancelled: () => void;
    autoOpen?: boolean;
}

/**
 * Loads the Converge PayWithConverge.js library and opens the Lightbox with the given token.
 * The Lightbox is a modal overlay served by Elavon; card data never touches our server.
 */
export default function ConvergeLightbox({
    token, demoMode, onApproval, onDeclined, onError, onCancelled, autoOpen = true,
}: ConvergeLightboxProps) {
    const openedRef = useRef(false);
    const scriptSrc = demoMode
        ? 'https://api.demo.convergepay.com/hosted-payments/PayWithConverge.js'
        : 'https://api.convergepay.com/hosted-payments/PayWithConverge.js';

    const open = () => {
        if (openedRef.current) return;
        if (!window.PayWithConverge) {
            onError('Converge library not loaded');
            return;
        }
        openedRef.current = true;
        window.PayWithConverge.open(
            { ssl_txn_auth_token: token },
            {
                onApproval: (r: any) => { openedRef.current = false; onApproval(r); },
                onDeclined: (r: any) => { openedRef.current = false; onDeclined(r); },
                onError: (e: any) => { openedRef.current = false; onError(e); },
                onCancelled: () => { openedRef.current = false; onCancelled(); },
            }
        );
    };

    useEffect(() => {
        if (autoOpen && token && window.PayWithConverge) {
            open();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, autoOpen]);

    return (
        <Script
            src={scriptSrc}
            strategy="afterInteractive"
            onLoad={() => { if (autoOpen && token) open(); }}
        />
    );
}
