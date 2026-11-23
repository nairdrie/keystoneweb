/**
 * Countries a Keystone owner can open a Stripe Connect (Express) account in.
 * Stripe fixes an account's country when it is created, and its hosted
 * onboarding cannot change it, so we must pass the right one up front.
 * Kept free of server imports so client components can use it.
 */
export const CONNECT_COUNTRIES = [
    { code: 'CA', label: 'Canada' },
    { code: 'US', label: 'United States' },
] as const;

export type ConnectCountry = (typeof CONNECT_COUNTRIES)[number]['code'];

export const DEFAULT_CONNECT_COUNTRY: ConnectCountry = 'CA';

export function isConnectCountry(value: unknown): value is ConnectCountry {
    return typeof value === 'string' && CONNECT_COUNTRIES.some(c => c.code === value);
}
