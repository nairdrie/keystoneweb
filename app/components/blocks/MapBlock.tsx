'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import EditableText from '@/app/components/EditableText';
import type { BlockData } from '@/lib/editor-context';
import {
    DEFAULT_MAP_ADDRESS,
    DEFAULT_MAP_CENTER,
    DEFAULT_MAP_STYLE,
    buildAllLocationsDirectionsUrl,
    buildDirectionsUrl,
    buildGoogleAllLocationsEmbedUrl,
    buildGoogleMapEmbedUrl,
    buildMapTilerGeocodingUrl,
    buildMapTilerStyleUrl,
    getMapTilerKey,
    normalizeMapSettings,
    type MapCoordinates,
    type MapLocation,
    type ResolvedMapLocation,
} from './map/map-config';

interface MapBlockProps {
    id: string;
    data?: Record<string, unknown>;
    block?: BlockData;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: unknown) => void;
}

type MapLibreModule = typeof import('maplibre-gl');

export default function MapBlock({ data, block, isEditMode, palette, updateContent }: MapBlockProps) {
    const blockData = useMemo<Record<string, unknown>>(
        () => data || block?.data || {},
        [data, block?.data],
    );
    const settings = useMemo(() => normalizeMapSettings(blockData), [blockData]);
    const [selectedLocationId, setSelectedLocationId] = useState(settings.locations[0]?.id || '');
    const [showAllLocations, setShowAllLocations] = useState(settings.startWithAllPins);
    const [mapLoaded, setMapLoaded] = useState(!settings.requireMapConsent);
    const [resolvedLocations, setResolvedLocations] = useState<ResolvedMapLocation[]>([]);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [mapError, setMapError] = useState('');
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const markersRef = useRef<MapLibreMarker[]>([]);
    const styleUrlRef = useRef('');

    const primaryColor = palette.primary || '#0f172a';
    const accentColor = palette.accent || '#f8fafc';
    const mapTilerKey = getMapTilerKey();
    const isMapTilerProvider = settings.mapProvider === 'maptiler';
    const selectedLocation = settings.locations.find((location) => location.id === selectedLocationId) || settings.locations[0];
    const selectedAddress = selectedLocation?.address || '';
    const locationsWithAddresses = useMemo(
        () => settings.locations.filter((location) => location.address.trim()),
        [settings.locations],
    );
    const geocodingLocations = useMemo(() => (
        locationsWithAddresses.length > 0
            ? locationsWithAddresses
            : [{
                ...(selectedLocation || settings.locations[0] || { id: 'primary', label: 'Main Location', address: '' }),
                address: DEFAULT_MAP_ADDRESS,
            }]
    ), [locationsWithAddresses, selectedLocation, settings.locations]);
    const canShowAllLocations = locationsWithAddresses.length > 1;
    const isAllLocationsView = isMapTilerProvider && canShowAllLocations && showAllLocations;
    const mapZoom = blockData.mapZoom === undefined ? undefined : settings.mapZoom;
    const mapStyle = blockData.mapStyle === undefined ? DEFAULT_MAP_STYLE : settings.mapStyle;
    const coordinatesById = useMemo(() => resolvedLocations.reduce<Record<string, MapCoordinates>>((map, location) => {
        map[location.id] = location.coordinates;
        return map;
    }, {}), [resolvedLocations]);
    const selectedResolvedLocation = resolvedLocations.find((location) => location.id === selectedLocation?.id) || resolvedLocations[0];
    const visibleResolvedLocations = useMemo(() => {
        if (isAllLocationsView) {
            const addressIds = new Set(locationsWithAddresses.map((location) => location.id));
            return resolvedLocations.filter((location) => addressIds.has(location.id));
        }
        return selectedResolvedLocation ? [selectedResolvedLocation] : resolvedLocations.slice(0, 1);
    }, [isAllLocationsView, locationsWithAddresses, resolvedLocations, selectedResolvedLocation]);
    const markerLabel = isAllLocationsView
        ? `${locationsWithAddresses.length} locations`
        : settings.markerLabel || selectedLocation?.label || '';
    const showLocationCards = settings.showLocationCards && settings.locations.length > 0;
    const showMapModeToggle = isMapTilerProvider && settings.showAllPinsToggle && canShowAllLocations;
    const directionsTargetLocation = selectedLocation?.address.trim() ? selectedLocation : locationsWithAddresses[0];
    const directionsUrl = isAllLocationsView
        ? buildAllLocationsDirectionsUrl(locationsWithAddresses, coordinatesById, directionsTargetLocation?.id)
        : buildDirectionsUrl(selectedAddress, selectedResolvedLocation?.coordinates);
    const mapStyleUrl = isMapTilerProvider && mapTilerKey ? buildMapTilerStyleUrl(mapStyle, mapTilerKey) : '';
    const googleMapUrl = isAllLocationsView
        ? buildGoogleAllLocationsEmbedUrl(locationsWithAddresses, mapZoom)
        : buildGoogleMapEmbedUrl({
            location: selectedLocation,
            address: selectedAddress || DEFAULT_MAP_ADDRESS,
            zoom: mapZoom,
        });
    const showInlineLocationSummary = (
        isMapTilerProvider
        && !isAllLocationsView
        && Boolean(selectedLocation)
    );
    const showMarkerLabelPill = Boolean(
        isMapTilerProvider
        && markerLabel
        && (isAllLocationsView || !showInlineLocationSummary)
    );

    useEffect(() => {
        if (settings.locations.some((location) => location.id === selectedLocationId)) return;
        setSelectedLocationId(settings.locations[0]?.id || '');
    }, [selectedLocationId, settings.locations]);

    useEffect(() => {
        setShowAllLocations(isMapTilerProvider && canShowAllLocations && settings.startWithAllPins);
    }, [canShowAllLocations, isMapTilerProvider, settings.startWithAllPins]);

    useEffect(() => {
        setMapLoaded(!settings.requireMapConsent);
    }, [settings.mapProvider, settings.requireMapConsent]);

    useEffect(() => {
        if (isMapTilerProvider && mapLoaded && mapTilerKey) return;
        resetMap(mapRef, markersRef, styleUrlRef);
    }, [isMapTilerProvider, mapLoaded, mapTilerKey]);

    useEffect(() => {
        if (!isMapTilerProvider || !mapLoaded || !mapTilerKey) {
            setResolvedLocations([]);
            setIsGeocoding(false);
            setMapError('');
            return;
        }

        let cancelled = false;
        setIsGeocoding(true);
        setMapError('');

        Promise.all(geocodingLocations.map((location) => geocodeLocation(location, mapTilerKey)))
            .then((locations) => {
                if (cancelled) return;
                const resolved = locations.filter((location): location is ResolvedMapLocation => Boolean(location));
                setResolvedLocations(resolved);
                setMapError(resolved.length > 0 ? '' : 'We could not find that location.');
            })
            .catch(() => {
                if (cancelled) return;
                setResolvedLocations([]);
                setMapError('MapTiler could not load this location.');
            })
            .finally(() => {
                if (!cancelled) setIsGeocoding(false);
            });

        return () => {
            cancelled = true;
        };
    }, [geocodingLocations, isMapTilerProvider, mapLoaded, mapTilerKey]);

    useEffect(() => {
        if (!isMapTilerProvider || !mapLoaded || !mapStyleUrl || !mapContainerRef.current) return;
        let cancelled = false;

        import('maplibre-gl')
            .then((maplibregl) => {
                if (cancelled || !mapContainerRef.current) return;

                const center = visibleResolvedLocations[0]?.coordinates || DEFAULT_MAP_CENTER;
                const map = mapRef.current || new maplibregl.Map({
                    container: mapContainerRef.current,
                    style: mapStyleUrl,
                    center: [center.lng, center.lat],
                    zoom: mapZoom || settings.mapZoom,
                    attributionControl: { compact: true },
                });

                if (!mapRef.current) {
                    mapRef.current = map;
                    styleUrlRef.current = mapStyleUrl;
                    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
                    requestAnimationFrame(() => map.resize());
                } else if (styleUrlRef.current !== mapStyleUrl) {
                    map.setStyle(mapStyleUrl);
                    styleUrlRef.current = mapStyleUrl;
                    requestAnimationFrame(() => map.resize());
                }

                if (isEditMode) {
                    disableMapInteractions(map);
                } else {
                    enableMapInteractions(map);
                }

                if (mapStyle === 'dark') {
                    applyDarkGreyMapStyle(map);
                }

                syncMapMarkers(maplibregl, map, markersRef, visibleResolvedLocations, {
                    isAllLocationsView,
                    primaryColor,
                    showDirections: settings.showMapDirections,
                    zoom: mapZoom || settings.mapZoom,
                });
            })
            .catch(() => setMapError('MapLibre could not load this map.'));

        return () => {
            cancelled = true;
        };
    }, [
        isAllLocationsView,
        isEditMode,
        isMapTilerProvider,
        mapLoaded,
        mapStyle,
        mapStyleUrl,
        mapZoom,
        primaryColor,
        settings.showMapDirections,
        settings.mapZoom,
        visibleResolvedLocations,
    ]);

    useEffect(() => () => {
        resetMap(mapRef, markersRef, styleUrlRef);
    }, []);

    return (
        <section className="py-16 bg-slate-50">
            <div className="max-w-6xl mx-auto px-4 flex flex-col items-center">
                <EditableText
                    as="h2"
                    contentKey="title"
                    styleData={blockData['title__styles'] as string | Record<string, unknown> | undefined}
                    content={settings.title}
                    defaultValue="Find Us"
                    isEditMode={isEditMode}
                    onSave={(key, val) => updateContent(key, val)}
                    className="text-3xl font-bold mb-8 text-center"
                />

                <div
                    className="w-full rounded-xl overflow-hidden shadow-lg border border-slate-200 relative group bg-white"
                    style={{ height: settings.mapHeight }}
                >
                    {showMarkerLabelPill && (
                        <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
                            <MapPin className="h-4 w-4" style={{ color: primaryColor }} />
                            <span className="truncate">{markerLabel}</span>
                        </div>
                    )}

                    {(settings.showMapDirections || showMapModeToggle) && (
                        <div className="absolute right-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-col items-end gap-2">
                            {settings.showMapDirections && (
                                <a
                                    href={directionsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-md transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <Navigation className="h-4 w-4" />
                                    Directions
                                </a>
                            )}

                            {showMapModeToggle && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllLocations((current) => !current)}
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-md transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <MapPin className="h-4 w-4" />
                                    {isAllLocationsView ? 'Selected pin' : 'All pins'}
                                </button>
                            )}
                        </div>
                    )}

                    {showInlineLocationSummary && selectedLocation && (
                        <LocationSummaryOverlay
                            location={selectedLocation}
                            compact={showLocationCards}
                        />
                    )}

                    {settings.requireMapConsent && !mapLoaded ? (
                        <MapPlaceholder
                            accentColor={accentColor}
                            primaryColor={primaryColor}
                            title={isMapTilerProvider ? 'Load map' : 'Load Google Map'}
                            message={isMapTilerProvider
                                ? 'This map is rendered with MapLibre and MapTiler and may load third-party map tiles.'
                                : 'This map is provided by Google and may load third-party content.'
                            }
                            actionLabel="Show Map"
                            onAction={() => setMapLoaded(true)}
                        />
                    ) : !isMapTilerProvider ? (
                        <iframe
                            title={settings.title || markerLabel || 'Map'}
                            src={googleMapUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen={false}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            className={`h-full w-full ${isEditMode ? 'pointer-events-none' : ''}`}
                        />
                    ) : !mapTilerKey ? (
                        <MapPlaceholder
                            accentColor={accentColor}
                            primaryColor={primaryColor}
                            title="MapTiler key needed"
                            message="Set NEXT_PUBLIC_MAPTILER_KEY to render MapLibre maps."
                        />
                    ) : (
                        <>
                            <div
                                ref={mapContainerRef}
                                role="img"
                                aria-label={settings.title || markerLabel || 'Map'}
                                className={`h-full w-full ${isEditMode ? 'pointer-events-none' : ''}`}
                            />
                            {(isGeocoding || mapError) && (
                                <div className="absolute inset-x-4 bottom-4 z-10 mx-auto max-w-md rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-center text-sm text-slate-600 shadow-md">
                                    {isGeocoding ? 'Finding location...' : mapError}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {showLocationCards && (
                    <div className="mt-5 grid w-full gap-3 md:grid-cols-2">
                        {settings.locations.map((location) => (
                            <LocationCard
                                key={location.id}
                                location={location}
                                active={location.id === selectedLocation?.id}
                                showDirections={settings.showCardDirections}
                                directionsHref={buildDirectionsUrl(location.address, coordinatesById[location.id])}
                                onSelect={() => {
                                    setSelectedLocationId(location.id);
                                    setShowAllLocations(false);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

async function geocodeLocation(location: MapLocation, key: string): Promise<ResolvedMapLocation | null> {
    if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
        return {
            ...location,
            coordinates: {
                lat: location.latitude as number,
                lng: location.longitude as number,
            },
        };
    }

    const response = await fetch(buildMapTilerGeocodingUrl(location.address || DEFAULT_MAP_ADDRESS, key));
    if (!response.ok) throw new Error('Geocoding failed');

    const payload = await response.json() as { features?: Array<{ center?: [number, number] }> };
    const center = payload.features?.[0]?.center;
    if (!Array.isArray(center) || center.length < 2) return null;

    const [lng, lat] = center;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

    return {
        ...location,
        coordinates: { lat, lng },
    };
}

function syncMapMarkers(
    maplibregl: MapLibreModule,
    map: MapLibreMap,
    markersRef: MutableRefObject<MapLibreMarker[]>,
    locations: ResolvedMapLocation[],
    options: {
        isAllLocationsView: boolean;
        primaryColor: string;
        showDirections: boolean;
        zoom: number;
    },
) {
    const draw = () => {
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

        locations.forEach((location, index) => {
            const markerElement = document.createElement('div');
            markerElement.className = 'ks-map-marker';
            markerElement.style.backgroundColor = options.primaryColor;
            const markerNumber = document.createElement('span');
            markerNumber.textContent = String(index + 1);
            markerElement.append(markerNumber);
            markerElement.setAttribute('aria-label', location.label || 'Map marker');
            markerElement.setAttribute('role', 'img');

            const popupNode = document.createElement('div');
            const popupTitle = document.createElement('p');
            popupTitle.className = 'font-bold text-slate-900';
            popupTitle.textContent = location.label || 'Location';
            const popupAddress = document.createElement('p');
            popupAddress.className = 'mt-1 text-sm text-slate-600';
            popupAddress.textContent = location.address || DEFAULT_MAP_ADDRESS;
            popupNode.append(popupTitle, popupAddress);
            if (location.description) {
                const popupDescription = document.createElement('p');
                popupDescription.className = 'mt-2 text-xs text-slate-500';
                popupDescription.textContent = location.description;
                popupNode.append(popupDescription);
            }
            if (options.showDirections) {
                const popupDirections = document.createElement('a');
                popupDirections.href = buildDirectionsUrl(location.address, location.coordinates);
                popupDirections.target = '_blank';
                popupDirections.rel = 'noopener noreferrer';
                popupDirections.className = 'mt-3 inline-flex text-sm font-bold text-blue-600';
                popupDirections.textContent = 'Get directions';
                popupNode.append(popupDirections);
            }

            const popup = new maplibregl.Popup({ offset: 24 }).setDOMContent(popupNode);
            const marker = new maplibregl.Marker({ element: markerElement, anchor: 'bottom' })
                .setLngLat([location.coordinates.lng, location.coordinates.lat])
                .setPopup(popup)
                .addTo(map);

            markersRef.current.push(marker);
        });

        if (locations.length > 1 || options.isAllLocationsView) {
            const bounds = new maplibregl.LngLatBounds();
            locations.forEach((location) => bounds.extend([location.coordinates.lng, location.coordinates.lat]));
            map.fitBounds(bounds, { padding: 72, maxZoom: Math.min(options.zoom, 15), duration: 500 });
            return;
        }

        const location = locations[0];
        if (location) {
            map.flyTo({
                center: [location.coordinates.lng, location.coordinates.lat],
                zoom: options.zoom,
                duration: 500,
            });
        }
    };

    let didDraw = false;
    const scheduleDraw = () => {
        if (didDraw) return;
        didDraw = true;
        requestAnimationFrame(draw);
    };

    if (map.isStyleLoaded()) {
        scheduleDraw();
    } else {
        map.once('style.load', scheduleDraw);
        map.once('load', scheduleDraw);
    }
}

function applyDarkGreyMapStyle(map: MapLibreMap) {
    const apply = () => {
        if (!map.isStyleLoaded()) return;

        const layers = map.getStyle().layers || [];
        layers.forEach((layer) => {
            const layerId = layer.id;
            const layerName = layerId.toLowerCase();

            try {
                if (layer.type === 'background') {
                    map.setPaintProperty(layerId, 'background-color', '#15181d');
                    return;
                }

                if (layer.type === 'fill') {
                    const color = layerName.includes('water')
                        ? '#20242b'
                        : layerName.includes('park') || layerName.includes('wood') || layerName.includes('forest')
                            ? '#20241f'
                            : '#1b1f24';
                    map.setPaintProperty(layerId, 'fill-color', color);
                    map.setPaintProperty(layerId, 'fill-opacity', 0.92);
                    return;
                }

                if (layer.type === 'line') {
                    const color = layerName.includes('road') || layerName.includes('street') || layerName.includes('transport')
                        ? '#565f6b'
                        : layerName.includes('water')
                            ? '#303846'
                            : '#3f4650';
                    map.setPaintProperty(layerId, 'line-color', color);
                    return;
                }

                if (layer.type === 'symbol') {
                    map.setPaintProperty(layerId, 'text-color', '#d1d5db');
                    map.setPaintProperty(layerId, 'text-halo-color', '#15181d');
                    map.setPaintProperty(layerId, 'text-halo-width', 1);
                    map.setPaintProperty(layerId, 'icon-opacity', 0.82);
                }
            } catch {
                // Some MapTiler layers do not support every paint property; skip those safely.
            }
        });
    };

    if (map.isStyleLoaded()) {
        apply();
    } else {
        map.once('style.load', apply);
    }
}

function disableMapInteractions(map: MapLibreMap) {
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
}

function enableMapInteractions(map: MapLibreMap) {
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.dragRotate.enable();
    map.keyboard.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
}

function resetMap(
    mapRef: MutableRefObject<MapLibreMap | null>,
    markersRef: MutableRefObject<MapLibreMarker[]>,
    styleUrlRef: MutableRefObject<string>,
) {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    mapRef.current?.remove();
    mapRef.current = null;
    styleUrlRef.current = '';
}

function MapPlaceholder({
    accentColor,
    primaryColor,
    title,
    message,
    actionLabel,
    onAction,
}: {
    accentColor: string;
    primaryColor: string;
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    return (
        <div
            className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center"
            style={{ backgroundColor: accentColor }}
        >
            <div className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm">
                <MapPin className="h-7 w-7" style={{ color: primaryColor }} />
            </div>
            <div>
                <p className="text-base font-bold text-slate-800">{title}</p>
                <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
            </div>
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}

function LocationSummaryOverlay({
    location,
    compact,
}: {
    location: MapLocation;
    compact: boolean;
}) {
    if (compact) {
        return (
            <div className="absolute left-4 top-4 z-10 flex max-w-[min(18rem,calc(100%-2rem))] items-center rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-left shadow-lg">
                <p className="truncate text-sm font-bold leading-none text-slate-900">{location.label || 'Location'}</p>
            </div>
        );
    }

    return (
        <div className="absolute left-4 top-4 z-10 max-w-[min(18.5rem,calc(100%-2rem))] rounded-xl border border-slate-200 bg-white/95 p-2.5 text-left shadow-lg">
            <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-snug text-slate-900">{location.label || 'Location'}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">{location.address || DEFAULT_MAP_ADDRESS}</p>
                {location.description && (
                    <p className="mt-1 line-clamp-1 text-xs leading-snug text-slate-500">{location.description}</p>
                )}
            </div>
        </div>
    );
}

function LocationCard({
    location,
    active,
    showDirections,
    directionsHref,
    onSelect,
}: {
    location: MapLocation;
    active: boolean;
    showDirections: boolean;
    directionsHref: string;
    onSelect: () => void;
}) {
    return (
        <div
            className={`rounded-xl border bg-white p-4 text-left shadow-sm transition-colors ${
                active ? 'border-blue-500 ring-1 ring-blue-200' : 'border-slate-200'
            }`}
        >
            <button
                type="button"
                onClick={onSelect}
                className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <span className="block text-sm font-bold text-slate-900">{location.label || 'Location'}</span>
                <span className="mt-1 block text-sm text-slate-600">{location.address || DEFAULT_MAP_ADDRESS}</span>
                {location.description && (
                    <span className="mt-2 block text-xs leading-relaxed text-slate-500">{location.description}</span>
                )}
            </button>
            {showDirections && (
                <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Get directions
                    <ExternalLink className="h-3.5 w-3.5" />
                </a>
            )}
        </div>
    );
}
