'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Crown, Layers, Loader2, Map as MapIcon, Plus, Search, Trash2 } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from '../BlockSettingsPanel';
import {
    InspectorSection,
    InspectorToggle,
    useInspectorSectionState,
} from '../panel-shared';
import { LayoutTab } from '../layout/LayoutTab';
import type { BlockPanelProps } from '../block-panel-registry';
import {
    areSectionSettingsEqual,
    normalizeSectionSettings,
    type SectionSettings,
} from '@/lib/builder/layout-settings';
import {
    MAP_STYLE_OPTIONS,
    MAX_MAP_HEIGHT,
    MAX_MAP_ZOOM,
    MIN_MAP_HEIGHT,
    MIN_MAP_ZOOM,
    clampMapHeight,
    clampMapZoom,
    createMapLocation,
    normalizeMapSettings,
} from './map-config';
import type { MapLocation, MapProvider, MapSettings, MapStyle } from './map-config';

type MapDraft = MapSettings & {
    address: string;
    sectionSettings: SectionSettings;
    __customCss: string;
};

type PlaceSearchResult = {
    placeId: string;
    name: string;
    formattedAddress: string;
    latitude: number | null;
    longitude: number | null;
};

const SECTION_IDS = ['provider', 'content', 'locations', 'map-settings', 'display', 'universal-layout', 'advanced'];
const MAP_DRAFT_UPDATE_EVENT = 'ks:map-draft-update';

export default function MapSettingsPanel({
    blockId,
    blockType = 'map',
    blockData,
    isProUser,
    customCss,
    onClose,
    onDraftBlockDataChange,
}: BlockPanelProps) {
    const context = useEditorContext();
    const initialDraft = useMemo(
        () => buildInitialDraft(blockData || {}, customCss),
        [blockData, customCss],
    );
    const [draft, setDraft] = useState<MapDraft>(initialDraft);
    const sectionState = useInspectorSectionState(SECTION_IDS, true);

    const updateDraft = (updates: Partial<MapDraft>) => {
        setDraft((current) => ({ ...current, ...updates }));
    };

    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        onDraftBlockDataChange({
            ...(blockData || {}),
            ...serializeMapDraft(draft),
        });
    }, [blockData, draft, onDraftBlockDataChange]);

    useEffect(() => {
        const handleCanvasDraftUpdate = (event: Event) => {
            const detail = (event as CustomEvent<{ blockId?: string; key?: string; value?: unknown }>).detail;
            if (!detail || detail.blockId !== blockId || !detail.key) return;
            const key = detail.key;
            if (!isMapDraftKey(key)) return;

            setDraft((current) => {
                if (key === 'locations' && Array.isArray(detail.value)) {
                    const locations = normalizeMapSettings({ locations: detail.value }).locations;
                    return { ...current, locations, address: locations[0]?.address || current.address };
                }
                if (key === 'address' && typeof detail.value === 'string') {
                    return { ...current, address: detail.value };
                }
                if (key === 'showDirections' && typeof detail.value === 'boolean') {
                    return {
                        ...current,
                        showDirections: detail.value,
                        showMapDirections: detail.value,
                        showCardDirections: detail.value,
                    };
                }
                return { ...current, [key]: detail.value } as MapDraft;
            });
        };

        window.addEventListener(MAP_DRAFT_UPDATE_EVENT, handleCanvasDraftUpdate);
        return () => window.removeEventListener(MAP_DRAFT_UPDATE_EVENT, handleCanvasDraftUpdate);
    }, [blockId]);

    const hasUnsavedChanges = useMemo(
        () => JSON.stringify(draft) !== JSON.stringify(initialDraft),
        [draft, initialDraft],
    );

    const updateSectionSettings = (sectionSettings: SectionSettings) => {
        updateDraft({ sectionSettings });
    };

    const updateLocation = (index: number, updates: Partial<MapLocation>) => {
        const locations = draft.locations.map((location, currentIndex) => (
            currentIndex === index ? { ...location, ...updates } : location
        ));
        updateDraft({
            locations,
            ...(index === 0 && updates.address !== undefined ? { address: updates.address } : {}),
        });
    };

    const addLocation = () => {
        const locations = [...draft.locations, createMapLocation(draft.locations.length)];
        updateDraft({
            locations,
            showLocationCards: locations.length > 1 ? true : draft.showLocationCards,
        });
    };

    const removeLocation = (index: number) => {
        if (draft.locations.length <= 1) return;
        const locations = draft.locations.filter((_, currentIndex) => currentIndex !== index);
        updateDraft({ locations, address: locations[0]?.address || '' });
    };

    const handleSave = () => {
        if (!hasUnsavedChanges) {
            onClose();
            return;
        }
        const updates = serializeMapDraft(draft);
        if (areSectionSettingsEqual(draft.sectionSettings, initialDraft.sectionSettings)) {
            delete updates.sectionSettings;
        }
        if (draft.__customCss === initialDraft.__customCss) {
            delete updates.__customCss;
        }
        if (Object.keys(updates).length > 0 && context?.updateBlockDataBatch) {
            context.updateBlockDataBatch(blockId, updates);
        }
        onClose();
    };

    const handleReset = () => {
        setDraft(initialDraft);
        sectionState.reset();
    };

    return (
        <BlockSettingsPanel
            isOpen
            title="Map Settings"
            subtitle="Configure map provider, locations, visitor controls, and custom CSS."
            blockId={blockId}
            blockType={blockType}
            hasUnsavedChanges={hasUnsavedChanges}
            onClose={onClose}
            onSave={handleSave}
            onReset={handleReset}
            allCollapsed={sectionState.allCollapsed}
            onToggleAllCollapsed={() => sectionState.setAll(!sectionState.allCollapsed)}
            tourId="map-settings-panel"
        >
            <InspectorSection
                id="provider"
                title="Map Provider"
                isCollapsed={sectionState.isCollapsed('provider')}
                onToggle={() => sectionState.toggle('provider')}
            >
                <MapProviderControl
                    value={draft.mapProvider}
                    onChange={(mapProvider) => updateDraft({ mapProvider })}
                />
            </InspectorSection>

            <InspectorSection
                id="content"
                title="Content"
                isCollapsed={sectionState.isCollapsed('content')}
                onToggle={() => sectionState.toggle('content')}
            >
                <TextField
                    label="Title"
                    value={draft.title}
                    placeholder="Find Us"
                    onChange={(title) => updateDraft({ title })}
                />
            </InspectorSection>

            <InspectorSection
                id="locations"
                title="Locations"
                isCollapsed={sectionState.isCollapsed('locations')}
                onToggle={() => sectionState.toggle('locations')}
            >
                <div className="space-y-3">
                    {draft.locations.map((location, index) => (
                        <LocationEditor
                            key={location.id}
                            location={location}
                            index={index}
                            canDelete={draft.locations.length > 1}
                            onChange={(updates) => updateLocation(index, updates)}
                            onDelete={() => removeLocation(index)}
                        />
                    ))}
                    <button
                        type="button"
                        onClick={addLocation}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 px-3 py-2 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <Plus className="h-4 w-4" />
                        Add Location
                    </button>
                </div>
            </InspectorSection>

            <InspectorSection
                id="map-settings"
                title="Map"
                isCollapsed={sectionState.isCollapsed('map-settings')}
                onToggle={() => sectionState.toggle('map-settings')}
            >
                <div className="space-y-5">
                    <NumberSlider
                        label="Map height"
                        value={draft.mapHeight}
                        min={MIN_MAP_HEIGHT}
                        max={MAX_MAP_HEIGHT}
                        suffix="px"
                        onChange={(mapHeight) => updateDraft({ mapHeight: clampMapHeight(mapHeight) })}
                    />
                    <NumberSlider
                        label="Zoom"
                        value={draft.mapZoom}
                        min={MIN_MAP_ZOOM}
                        max={MAX_MAP_ZOOM}
                        onChange={(mapZoom) => updateDraft({ mapZoom: clampMapZoom(mapZoom) })}
                    />
                    {draft.mapProvider === 'maptiler' && (
                        <MapStyleControl
                            value={draft.mapStyle}
                            onChange={(mapStyle) => updateDraft({ mapStyle })}
                        />
                    )}
                </div>
            </InspectorSection>

            <InspectorSection
                id="display"
                title="Display"
                isCollapsed={sectionState.isCollapsed('display')}
                onToggle={() => sectionState.toggle('display')}
            >
                <div className="space-y-3">
                    <InspectorToggle
                        label="Show directions button on map"
                        description="Shows the main Google Maps directions button over the map."
                        checked={draft.showMapDirections}
                        onChange={() => updateDraft({ showMapDirections: !draft.showMapDirections })}
                    />
                    <InspectorToggle
                        label="Show location cards"
                        description="Lets visitors switch between saved locations."
                        checked={draft.showLocationCards}
                        onChange={() => updateDraft({ showLocationCards: !draft.showLocationCards })}
                    />
                    {draft.showLocationCards && (
                        <InspectorToggle
                            label="Show directions on location cards"
                            description="Adds Get directions links to each location card."
                            checked={draft.showCardDirections}
                            onChange={() => updateDraft({ showCardDirections: !draft.showCardDirections })}
                        />
                    )}
                    {draft.mapProvider === 'maptiler' && draft.locations.length > 1 && (
                        <>
                            <InspectorToggle
                                label="Show all pins toggle"
                                description="Lets visitors switch between the selected pin and all saved locations."
                                checked={draft.showAllPinsToggle}
                                onChange={() => updateDraft({ showAllPinsToggle: !draft.showAllPinsToggle })}
                            />
                            {draft.showAllPinsToggle && (
                                <InspectorToggle
                                    label="Start with all pins"
                                    description="Zoom out to show all saved locations when the map first loads."
                                    checked={draft.startWithAllPins}
                                    onChange={() => updateDraft({ startWithAllPins: !draft.startWithAllPins })}
                                />
                            )}
                        </>
                    )}
                    <InspectorToggle
                        label="Require consent before loading map"
                        description={`Shows a placeholder until visitors choose to load the ${draft.mapProvider === 'maptiler' ? 'MapTiler' : 'Google'} map.`}
                        checked={draft.requireMapConsent}
                        onChange={() => updateDraft({ requireMapConsent: !draft.requireMapConsent })}
                    />
                </div>
            </InspectorSection>

            <InspectorSection
                id="universal-layout"
                title="Layout"
                isCollapsed={sectionState.isCollapsed('universal-layout')}
                onToggle={() => sectionState.toggle('universal-layout')}
            >
                <LayoutTab
                    blockId={blockId}
                    blockType={blockType}
                    value={draft.sectionSettings}
                    onChange={updateSectionSettings}
                />
            </InspectorSection>

            <InspectorSection
                id="advanced"
                title="Advanced"
                isCollapsed={sectionState.isCollapsed('advanced')}
                onToggle={() => sectionState.toggle('advanced')}
            >
                {isProUser ? (
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-map-css`}>
                            Custom CSS
                        </label>
                        <textarea
                            id={`${blockId}-map-css`}
                            value={draft.__customCss}
                            onChange={(event) => updateDraft({ __customCss: event.target.value })}
                            placeholder={`/* Scoped to this Map block */\n.map-card {\n  border-radius: 0.75rem;\n}`}
                            className="mt-2 min-h-40 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-green-400 outline-none selection:bg-green-900 focus:ring-2 focus:ring-blue-500"
                            spellCheck={false}
                        />
                    </div>
                ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                        <div className="flex items-center gap-2 font-bold">
                            <Crown className="h-4 w-4" />
                            Custom CSS is a Pro feature
                        </div>
                    </div>
                )}
            </InspectorSection>
        </BlockSettingsPanel>
    );
}

function LocationEditor({
    location,
    index,
    canDelete,
    onChange,
    onDelete,
}: {
    location: MapLocation;
    index: number;
    canDelete: boolean;
    onChange: (updates: Partial<MapLocation>) => void;
    onDelete: () => void;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Location {index + 1}</p>
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={!canDelete}
                    className="rounded-md border border-slate-200 p-1.5 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Delete location"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
            <div className="space-y-3">
                <TextField
                    label="Label"
                    value={location.label}
                    placeholder="Main Location"
                    onChange={(label) => onChange({ label })}
                />
                <TextField
                    label="Address"
                    value={location.address}
                    placeholder="1600 Amphitheatre Parkway, Mountain View, CA"
                    onChange={(address) => onChange({ address, latitude: undefined, longitude: undefined })}
                    renderInput={(inputProps) => (
                        <PlaceSearchField
                            {...inputProps}
                            onSelect={(place) => {
                                const shouldUpdateLabel = isGeneratedLocationLabel(location.label, index);
                                onChange({
                                    address: place.formattedAddress,
                                    ...(hasPlaceCoordinates(place) ? {
                                        latitude: place.latitude,
                                        longitude: place.longitude,
                                    } : {}),
                                    ...(shouldUpdateLabel ? { label: place.name || `Location ${index + 1}` } : {}),
                                });
                            }}
                        />
                    )}
                />
                <TextAreaField
                    label="Description"
                    value={location.description || ''}
                    placeholder="Parking, suite number, entrance notes, or service area details."
                    onChange={(description) => onChange({ description })}
                />
            </div>
        </div>
    );
}

function NumberSlider({
    label,
    value,
    min,
    max,
    suffix,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    suffix?: string;
    onChange: (value: number) => void;
}) {
    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
                <span className="text-xs font-bold text-slate-500">{value}{suffix || ''}</span>
            </div>
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={value}
                    onChange={(event) => onChange(parseInt(event.target.value, 10))}
                    className="h-2 min-w-0 flex-1 cursor-pointer accent-blue-600"
                />
                <input
                    type="number"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(event) => onChange(parseInt(event.target.value, 10))}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
    );
}

function MapProviderControl({
    value,
    onChange,
}: {
    value: MapProvider;
    onChange: (value: MapProvider) => void;
}) {
    const options: Array<{
        id: MapProvider;
        label: string;
        description: string;
        icon: typeof MapIcon;
    }> = [
        {
            id: 'google',
            label: 'Google Maps',
            description: 'Classic Google embed. Best default for familiar map cards and behavior.',
            icon: MapIcon,
        },
        {
            id: 'maptiler',
            label: 'MapTiler Styles',
            description: 'Lightweight MapLibre map with custom color/style choices.',
            icon: Layers,
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-2">
            {options.map((option) => {
                const Icon = option.icon;
                const active = value === option.id;
                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => onChange(option.id)}
                        aria-pressed={active}
                        className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            active
                                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-current shadow-sm">
                            <Icon className="h-4 w-4" />
                        </span>
                        <span>
                            <span className="block text-sm font-bold">{option.label}</span>
                            <span className="mt-1 block text-[11px] leading-snug text-slate-500">{option.description}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function MapStyleControl({
    value,
    onChange,
}: {
    value: MapStyle;
    onChange: (value: MapStyle) => void;
}) {
    return (
        <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Map style</p>
            <div className="grid grid-cols-2 gap-2">
                {MAP_STYLE_OPTIONS.map((option) => {
                    const active = value === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onChange(option.id)}
                            aria-pressed={active}
                            className={`rounded-xl border px-3 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                active
                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <span
                                aria-hidden="true"
                                className="mb-2 block h-8 rounded-lg border border-white/60 shadow-inner"
                                style={{ background: option.preview }}
                            />
                            <span className="block text-sm font-bold">{option.label}</span>
                            <span className="mt-1 block text-[11px] leading-snug text-slate-500">{option.description}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function TextField({
    label,
    value,
    placeholder,
    onChange,
    renderInput,
}: {
    label: string;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
    renderInput?: (props: {
        value: string;
        placeholder?: string;
        onChange: (value: string) => void;
    }) => ReactNode;
}) {
    return (
        <div className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
            {renderInput ? renderInput({ value, placeholder, onChange }) : (
                <input
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
            )}
        </div>
    );
}

function PlaceSearchField({
    value,
    placeholder,
    onChange,
    onSelect,
}: {
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
    onSelect: (place: PlaceSearchResult) => void;
}) {
    const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmedAddress, setConfirmedAddress] = useState(value);
    const query = value.trim();
    const shouldSearch = isOpen && query.length >= 3 && query !== confirmedAddress;

    useEffect(() => {
        if (!shouldSearch) {
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setIsLoading(true);
            setError('');
            fetch(`/api/seo/places?query=${encodeURIComponent(query)}`, {
                credentials: 'include',
                signal: controller.signal,
            })
                .then(async (response) => {
                    if (!response.ok) throw new Error('Place search unavailable');
                    return response.json();
                })
                .then((payload: { places?: PlaceSearchResult[] }) => {
                    setSuggestions((payload.places || []).filter((place) => Boolean(place.formattedAddress)));
                })
                .catch((searchError) => {
                    if ((searchError as Error).name === 'AbortError') return;
                    setSuggestions([]);
                    setError('Place search is unavailable. You can still type the address manually.');
                })
                .finally(() => {
                    if (!controller.signal.aborted) setIsLoading(false);
                });
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query, shouldSearch]);

    const handleSelect = (place: PlaceSearchResult) => {
        setConfirmedAddress(place.formattedAddress);
        setSuggestions([]);
        setIsOpen(false);
        onSelect(place);
    };

    return (
        <div
            className="relative"
            onBlur={() => {
                window.setTimeout(() => setIsOpen(false), 120);
            }}
        >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
                type="text"
                value={value}
                onFocus={() => setIsOpen(true)}
                onChange={(event) => {
                    setConfirmedAddress('');
                    setError('');
                    if (event.target.value.trim().length < 3) {
                        setSuggestions([]);
                        setIsLoading(false);
                    }
                    setIsOpen(true);
                    onChange(event.target.value);
                }}
                placeholder={placeholder || 'Search for an address or place...'}
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isLoading && (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
            {isOpen && (suggestions.length > 0 || error) && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    {suggestions.map((place) => (
                        <button
                            key={place.placeId}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSelect(place)}
                            className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                        >
                            <span>
                                <span className="block text-sm font-bold text-slate-800">{place.name || 'Location'}</span>
                                <span className="mt-0.5 block text-xs leading-snug text-slate-500">{place.formattedAddress}</span>
                            </span>
                            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-white px-2 py-1 text-[11px] font-bold text-blue-600">
                                <Check className="h-3 w-3" />
                                Use
                            </span>
                        </button>
                    ))}
                    {error && (
                        <p className="px-3 py-2 text-xs leading-relaxed text-amber-700">{error}</p>
                    )}
                </div>
            )}
        </div>
    );
}

function isGeneratedLocationLabel(label: string, index: number): boolean {
    const normalized = label.trim();
    return !normalized || normalized === 'Main Location' || normalized === `Location ${index + 1}`;
}

function hasPlaceCoordinates(place: PlaceSearchResult): place is PlaceSearchResult & { latitude: number; longitude: number } {
    return Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
}

function TextAreaField({
    label,
    value,
    placeholder,
    onChange,
}: {
    label: string;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                rows={3}
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
        </label>
    );
}

function buildInitialDraft(blockData: Record<string, unknown>, customCss: string): MapDraft {
    const settings = normalizeMapSettings(blockData);
    return {
        ...settings,
        address: settings.locations[0]?.address || '',
        sectionSettings: normalizeSectionSettings(blockData.sectionSettings),
        __customCss: customCss,
    };
}

function serializeMapDraft(draft: MapDraft): Record<string, unknown> {
    const locations = draft.locations.length > 0 ? draft.locations : [createMapLocation(0)];
    return {
        title: draft.title,
        address: locations[0]?.address || draft.address || '',
        locations,
        mapProvider: draft.mapProvider,
        mapHeight: draft.mapHeight,
        mapZoom: draft.mapZoom,
        mapStyle: draft.mapStyle,
        markerLabel: draft.markerLabel,
        showDirections: draft.showMapDirections || draft.showCardDirections,
        showMapDirections: draft.showMapDirections,
        showCardDirections: draft.showCardDirections,
        showLocationCards: draft.showLocationCards,
        showAllPinsToggle: draft.showAllPinsToggle,
        startWithAllPins: draft.startWithAllPins,
        requireMapConsent: draft.requireMapConsent,
        sectionSettings: draft.sectionSettings,
        __customCss: draft.__customCss,
    };
}

function isMapDraftKey(key: string): boolean {
    return [
        'title',
        'address',
        'locations',
        'mapProvider',
        'mapHeight',
        'mapZoom',
        'mapStyle',
        'markerLabel',
        'showDirections',
        'showMapDirections',
        'showCardDirections',
        'showLocationCards',
        'showAllPinsToggle',
        'startWithAllPins',
        'requireMapConsent',
    ].includes(key);
}
