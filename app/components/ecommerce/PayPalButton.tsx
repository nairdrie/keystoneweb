'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    paypal?: any;
  }
}

type Props = {
  clientId: string;
  currency: string;
  createOrder: () => Promise<string>;
  onApprove: (paypalOrderId: string) => Promise<void>;
  onError?: (err: any) => void;
  onCancel?: () => void;
  disabled?: boolean;
};

// Cache SDK loads per (clientId, currency) tuple so multiple mounts on the
// same page don't fight.
const sdkLoads: Record<string, Promise<void> | undefined> = {};

function loadPaypalSdk(clientId: string, currency: string) {
  const key = `${clientId}|${currency}`;
  const existing = sdkLoads[key];
  if (existing) return existing;

  const p = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'));

    // If an SDK with the same clientId/currency is already loaded, use it.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-paypal-key="${key}"]`
    );
    if (existing && window.paypal) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    const params = new URLSearchParams({
      'client-id': clientId,
      currency: currency.toUpperCase(),
      intent: 'capture',
      components: 'buttons',
      'enable-funding': 'card,venmo,paylater',
      // Suppress alternatives we don't want (credit requires additional
      // reviews and is geographic; card covers Visa/MC/Amex/Discover).
      'disable-funding': 'credit',
    });
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.dataset.paypalKey = key;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to load PayPal JS SDK'));
    document.head.appendChild(script);
  });

  sdkLoads[key] = p;
  return p;
}

export default function PayPalButton({
  clientId,
  currency,
  createOrder,
  onApprove,
  onError,
  onCancel,
  disabled,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setError('This store has not finished connecting PayPal.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await loadPaypalSdk(clientId, currency);
        if (cancelled || !containerRef.current || !window.paypal) return;

        // Clear any previous render
        containerRef.current.innerHTML = '';

        window.paypal
          .Buttons({
            style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
            createOrder: async () => {
              setWorking(true);
              try {
                return await createOrder();
              } finally {
                setWorking(false);
              }
            },
            onApprove: async (data: { orderID: string }) => {
              setWorking(true);
              try {
                await onApprove(data.orderID);
              } finally {
                setWorking(false);
              }
            },
            onError: (err: any) => {
              setWorking(false);
              const msg =
                typeof err?.message === 'string'
                  ? err.message
                  : 'Payment failed. Please try again.';
              setError(msg);
              onError?.(err);
            },
            onCancel: () => {
              setWorking(false);
              onCancel?.();
            },
          })
          .render(containerRef.current)
          .catch((err: any) => {
            console.error('PayPal render error:', err);
            setError('Unable to load PayPal checkout.');
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to initialize PayPal.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally exclude callbacks so we don't re-render the buttons on
    // every parent render; the latest closure references are captured by
    // PayPal's own callback bridge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, currency]);

  return (
    <div>
      {loading && (
        <div className="flex items-center justify-center py-4 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading PayPal…</span>
        </div>
      )}
      <div
        ref={containerRef}
        className={
          disabled || working
            ? 'pointer-events-none opacity-60'
            : ''
        }
      />
      {error && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
