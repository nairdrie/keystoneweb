export type MapStyle = 'plain' | 'streets' | 'light' | 'dark' | 'satellite' | 'outdoor';
type LegacyMapStyle = 'roadmap' | 'terrain' | 'hybrid';
export type MapProvider = 'google' | 'maptiler';

export type MapCoordinates = {
    lat: number;
    lng: number;
};

export type MapLocation = {
    id: string;
    label: string;
    address: string;
    description?: string;
    latitude?: number;
    longitude?: number;
};

export type ResolvedMapLocation = MapLocation & {
    coordinates: MapCoordinates;
};

export type MapSettings = {
    title: string;
    locations: MapLocation[];
    mapProvider: MapProvider;
    mapHeight: number;
    mapZoom: number;
    mapStyle: MapStyle;
    markerLabel: string;
    showDirections: boolean;
    showMapDirections: boolean;
    showCardDirections: boolean;
    showLocationCards: boolean;
    showAllPinsToggle: boolean;
    startWithAllPins: boolean;
    requireMapConsent: boolean;
};

export const DEFAULT_MAP_ADDRESS = '1600 Amphitheatre Parkway, Mountain View, CA';
export const DEFAULT_MAP_PROVIDER: MapProvider = 'google';
export const DEFAULT_MAP_HEIGHT = 384;
export const DEFAULT_MAP_ZOOM = 14;
export const DEFAULT_MAP_STYLE: MapStyle = 'plain';
export const MIN_MAP_HEIGHT = 240;
export const MAX_MAP_HEIGHT = 720;
export const MIN_MAP_ZOOM = 3;
export const MAX_MAP_ZOOM = 20;
export const DEFAULT_MAP_CENTER: MapCoordinates = { lat: 43.6532, lng: -79.3832 };

export const MAP_STYLE_OPTIONS: Array<{
    id: MapStyle;
    label: string;
    description: string;
    mapTilerId: string;
    preview: string;
}> = [
    {
        id: 'plain',
        label: 'Bright Roads',
        description: 'Bright road map with clear labels and stronger color contrast.',
        mapTilerId: 'bright-v2',
        preview: 'linear-gradient(135deg, #bfe3ff 0 26%, #e8f6d5 26% 54%, #fff6de 54% 70%, #f9fafb 70% 100%)',
    },
    {
        id: 'streets',
        label: 'Streets',
        description: 'Detailed city map for local businesses and service areas.',
        mapTilerId: 'streets-v2',
        preview: 'linear-gradient(135deg, #c7d2fe 0 24%, #dcfce7 24% 48%, #fee2e2 48% 68%, #f8fafc 68% 100%)',
    },
    {
        id: 'light',
        label: 'Clean Light',
        description: 'Balanced light map with softer contrast than the bright road style.',
        mapTilerId: 'dataviz',
        preview: 'linear-gradient(135deg, #f8fafc 0 36%, #e2e8f0 36% 62%, #bfdbfe 62% 100%)',
    },
    {
        id: 'dark',
        label: 'Dark',
        description: 'Dark grey basemap with clear roads and labels for high-contrast sections.',
        mapTilerId: 'dataviz-dark',
        preview: 'linear-gradient(135deg, #111827 0 36%, #27272a 36% 62%, #4b5563 62% 82%, #9ca3af 82% 100%)',
    },
    {
        id: 'satellite',
        label: 'Satellite',
        description: 'Aerial imagery with labels for venues, sites, and landmarks.',
        mapTilerId: 'hybrid',
        preview: 'linear-gradient(135deg, #164e63 0 28%, #365314 28% 58%, #78716c 58% 100%)',
    },
    {
        id: 'outdoor',
        label: 'Outdoor',
        description: 'Terrain, parks, trails, and landscape detail.',
        mapTilerId: 'outdoor-v2',
        preview: 'linear-gradient(135deg, #bae6fd 0 25%, #bbf7d0 25% 55%, #fde68a 55% 78%, #fef3c7 78% 100%)',
    },
];

const LEGACY_STYLE_MAP: Record<LegacyMapStyle, MapStyle> = {
    roadmap: 'plain',
    terrain: 'outdoor',
    hybrid: 'satellite',
};

export function normalizeMapSettings(data: Record<string, unknown> | undefined): MapSettings {
    const locations = normalizeMapLocations(data);
    const legacyShowDirections = data?.showDirections === true;

    return {
        title: readString(data?.title, 'Find Us'),
        locations,
        mapProvider: readMapProvider(data?.mapProvider),
        mapHeight: clampNumber(data?.mapHeight, DEFAULT_MAP_HEIGHT, MIN_MAP_HEIGHT, MAX_MAP_HEIGHT),
        mapZoom: clampNumber(data?.mapZoom, DEFAULT_MAP_ZOOM, MIN_MAP_ZOOM, MAX_MAP_ZOOM),
        mapStyle: readMapStyle(data?.mapStyle),
        markerLabel: readString(data?.markerLabel, ''),
        showDirections: legacyShowDirections,
        showMapDirections: readOptionalBoolean(data?.showMapDirections, legacyShowDirections),
        showCardDirections: readOptionalBoolean(data?.showCardDirections, legacyShowDirections),
        showLocationCards: data?.showLocationCards === true,
        showAllPinsToggle: data?.showAllPinsToggle !== false,
        startWithAllPins: data?.startWithAllPins === true,
        requireMapConsent: data?.requireMapConsent === true,
    };
}

export function normalizeMapLocations(data: Record<string, unknown> | undefined): MapLocation[] {
    if (Array.isArray(data?.locations)) {
        const normalized = data.locations
            .map((location: unknown, index: number) => normalizeMapLocation(location, index))
            .filter((location: MapLocation | null): location is MapLocation => Boolean(location));
        if (normalized.length > 0) return normalized;
    }

    return [
        {
            id: 'primary',
            label: readString(data?.markerLabel, 'Main Location'),
            address: readString(data?.address, ''),
            description: '',
        },
    ];
}

export function createMapLocation(index: number): MapLocation {
    return {
        id: `location-${Date.now()}-${index + 1}`,
        label: `Location ${index + 1}`,
        address: '',
        description: '',
    };
}

export function getMapTilerKey(): string {
    return process.env.NEXT_PUBLIC_MAPTILER_KEY || process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '';
}

export function buildMapTilerStyleUrl(mapStyle: MapStyle, key: string): string {
    const style = MAP_STYLE_OPTIONS.find((option) => option.id === mapStyle) || MAP_STYLE_OPTIONS[0];
    return `https://api.maptiler.com/maps/${style.mapTilerId}/style.json?key=${encodeURIComponent(key)}`;
}

export function buildMapTilerGeocodingUrl(query: string, key: string): string {
    const params = new URLSearchParams({
        key,
        limit: '1',
    });
    return `https://api.maptiler.com/geocoding/${encodeURIComponent(query.trim() || DEFAULT_MAP_ADDRESS)}.json?${params.toString()}`;
}

export function buildGoogleMapEmbedUrl({
    location,
    address,
    zoom,
}: {
    location?: MapLocation;
    address?: string;
    zoom?: number;
}): string {
    const params = new URLSearchParams({
        q: getGoogleLocationQuery(location, address),
        output: 'embed',
    });

    if (typeof zoom === 'number' && Number.isFinite(zoom)) {
        params.set('z', String(clampNumber(zoom, DEFAULT_MAP_ZOOM, MIN_MAP_ZOOM, MAX_MAP_ZOOM)));
    }

    return `https://www.google.com/maps?${params.toString()}`;
}

export function buildGoogleAllLocationsEmbedUrl(locations: MapLocation[], zoom?: number): string {
    const locationsWithAddresses = locations.filter((location) => location.address.trim());
    if (locationsWithAddresses.length <= 1) {
        return buildGoogleMapEmbedUrl({
            location: locationsWithAddresses[0] || locations[0],
            zoom,
        });
    }

    const encodedPath = locationsWithAddresses
        .map((location) => encodeURIComponent(getGoogleLocationQuery(location)))
        .join('/');
    const params = new URLSearchParams({ output: 'embed' });
    if (typeof zoom === 'number' && Number.isFinite(zoom)) {
        params.set('z', String(clampNumber(zoom, DEFAULT_MAP_ZOOM, MIN_MAP_ZOOM, MAX_MAP_ZOOM)));
    }

    return `https://www.google.com/maps/dir/${encodedPath}?${params.toString()}`;
}

export function buildDirectionsUrl(address: string, coordinates?: MapCoordinates): string {
    if (coordinates) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${coordinates.lat},${coordinates.lng}`)}`;
    }

    const destination = address.trim() || DEFAULT_MAP_ADDRESS;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function buildAllLocationsDirectionsUrl(
    locations: MapLocation[],
    coordinatesById: Record<string, MapCoordinates> = {},
    preferredLocationId?: string,
): string {
    const preferredLocation = locations.find((location) => location.id === preferredLocationId);
    const destination = preferredLocation || locations.find((location) => location.address.trim()) || locations[0];
    return buildDirectionsUrl(destination?.address || DEFAULT_MAP_ADDRESS, destination ? coordinatesById[destination.id] : undefined);
}

export function clampMapHeight(value: unknown): number {
    return clampNumber(value, DEFAULT_MAP_HEIGHT, MIN_MAP_HEIGHT, MAX_MAP_HEIGHT);
}

export function clampMapZoom(value: unknown): number {
    return clampNumber(value, DEFAULT_MAP_ZOOM, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
}

function normalizeMapLocation(value: unknown, index: number): MapLocation | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = value as Record<string, unknown>;
    const address = readString(source.address, '');
    const label = readString(source.label, `Location ${index + 1}`);

    return {
        id: readString(source.id, `location-${index + 1}`),
        label,
        address,
        description: readString(source.description, ''),
        latitude: readOptionalNumber(source.latitude),
        longitude: readOptionalNumber(source.longitude),
    };
}

function readMapStyle(value: unknown): MapStyle {
    if (MAP_STYLE_OPTIONS.some((option) => option.id === value)) return value as MapStyle;
    if (value === 'roadmap' || value === 'terrain' || value === 'hybrid') return LEGACY_STYLE_MAP[value];
    return DEFAULT_MAP_STYLE;
}

function readMapProvider(value: unknown): MapProvider {
    return value === 'maptiler' ? 'maptiler' : DEFAULT_MAP_PROVIDER;
}

function getGoogleLocationQuery(location?: MapLocation, fallbackAddress?: string): string {
    const address = location?.address?.trim() || fallbackAddress?.trim();
    const label = location?.label?.trim() || '';
    const hasSpecificLabel = label && label !== 'Main Location' && !/^Location \d+$/i.test(label);
    if (hasSpecificLabel && address) return `${label}, ${address}`;
    if (address) return address;
    if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
        return `${location.latitude},${location.longitude}`;
    }
    return DEFAULT_MAP_ADDRESS;
}

function readString(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}

function readOptionalBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function readOptionalNumber(value: unknown): number | undefined {
    const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : undefined;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}
