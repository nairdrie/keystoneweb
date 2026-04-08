'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { MapPin } from 'lucide-react';

interface AddressFields {
    line1: string;
    city: string;
    region: string;   // province/state code (e.g. "ON", "CA")
    postal: string;
    country: string;  // ISO 3166-1 alpha-2 (e.g. "CA", "US")
}

interface AddressAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onPlaceSelected: (fields: AddressFields) => void;
    placeholder?: string;
    className?: string;
}

declare global {
    interface Window {
        google: any;
        __googleMapsLoaded?: boolean;
        __googleMapsCallbacks?: Array<() => void>;
    }
}

function loadGoogleMapsScript(): Promise<void> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return Promise.reject('No API key');

    if (window.__googleMapsLoaded && window.google?.maps?.places) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        if (!window.__googleMapsCallbacks) {
            window.__googleMapsCallbacks = [];
        }
        window.__googleMapsCallbacks.push(() => resolve());

        // If script is already loading, just register the callback
        if (document.querySelector('script[src*="maps.googleapis.com"]')) return;

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            window.__googleMapsLoaded = true;
            window.__googleMapsCallbacks?.forEach(cb => cb());
            window.__googleMapsCallbacks = [];
        };
        script.onerror = () => reject('Failed to load Google Maps');
        document.head.appendChild(script);
    });
}

function parsePlace(place: any): AddressFields {
    const components = place.address_components || [];
    const get = (type: string) => components.find((c: any) => c.types.includes(type));

    const streetNumber = get('street_number')?.long_name || '';
    const route = get('route')?.long_name || '';
    const line1 = `${streetNumber} ${route}`.trim();

    return {
        line1: line1 || place.formatted_address || '',
        city: get('locality')?.long_name || get('sublocality_level_1')?.long_name || get('administrative_area_level_2')?.long_name || '',
        region: get('administrative_area_level_1')?.short_name || '',
        postal: get('postal_code')?.long_name || '',
        country: get('country')?.short_name || '',
    };
}

export default function AddressAutocomplete({ value, onChange, onPlaceSelected, placeholder, className }: AddressAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<any>(null);
    const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

    const handlePlaceChanged = useCallback(() => {
        if (!autocompleteRef.current) return;
        const place = autocompleteRef.current.getPlace();
        if (!place?.address_components) return;

        const fields = parsePlace(place);
        onPlaceSelected(fields);
    }, [onPlaceSelected]);

    useEffect(() => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            setApiAvailable(false);
            return;
        }

        loadGoogleMapsScript()
            .then(() => {
                if (!inputRef.current || autocompleteRef.current) return;

                autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                    types: ['address'],
                    fields: ['address_components', 'formatted_address'],
                });

                autocompleteRef.current.addListener('place_changed', handlePlaceChanged);
                setApiAvailable(true);
            })
            .catch(() => {
                setApiAvailable(false);
            });

        return () => {
            if (autocompleteRef.current) {
                window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
                autocompleteRef.current = null;
            }
        };
    }, [handlePlaceChanged]);

    return (
        <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder || (apiAvailable !== false ? 'Start typing your address...' : 'Street address')}
                className={className || 'w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'}
            />
        </div>
    );
}
