'use client';

import { useEffect, useState } from 'react';
import { CONNECT_COUNTRIES, isConnectCountry, type ConnectCountry } from '@/lib/payments/stripe-connect-countries';

export interface StripeConnectStatus {
    loaded: boolean;
    /** An account exists (onboarding may be unfinished). */
    connected: boolean;
    /** The owner finished Stripe's onboarding form. */
    onboarded: boolean;
    country: ConnectCountry;
    setCountry: (c: ConnectCountry) => void;
}

/** Owner-only Stripe Connect status for a site, plus the country to onboard in. */
export function useStripeConnectStatus(siteId: string | null | undefined): StripeConnectStatus {
    const [loaded, setLoaded] = useState(false);
    const [connected, setConnected] = useState(false);
    const [onboarded, setOnboarded] = useState(false);
    const [country, setCountry] = useState<ConnectCountry>('CA');

    useEffect(() => {
        if (!siteId) return;
        let cancelled = false;
        fetch(`/api/stripe/connect?siteId=${encodeURIComponent(siteId)}`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                if (cancelled || !d) return;
                setConnected(!!d.connected);
                setOnboarded(!!d.onboarded);
                if (isConnectCountry(d.country)) setCountry(d.country);
            })
            .catch(() => {})
            .finally(() => !cancelled && setLoaded(true));
        return () => { cancelled = true; };
    }, [siteId]);

    return { loaded, connected, onboarded, country, setCountry };
}

/**
 * Country picker shown before Stripe onboarding. Stripe fixes an account's
 * country at creation, so this has to be chosen here, not on Stripe's form.
 */
export function StripeCountrySelect({
    value,
    onChange,
    disabled,
}: {
    value: ConnectCountry;
    onChange: (c: ConnectCountry) => void;
    disabled?: boolean;
}) {
    return (
        <label className="flex items-center gap-2 text-xs text-slate-600 mb-2">
            <span className="font-medium">Business country</span>
            <select
                value={value}
                onChange={e => onChange(e.target.value as ConnectCountry)}
                disabled={disabled}
                className="px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            >
                {CONNECT_COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                ))}
            </select>
        </label>
    );
}
