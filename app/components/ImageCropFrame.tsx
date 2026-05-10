'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { ImageSettings } from './ImageEditorModal';

type ImageCropFrameProps = {
    imageUrl: string;
    alt: string;
    settings: ImageSettings;
    onChange: (settings: ImageSettings) => void;
    onCommit?: (settings: ImageSettings) => void;
    frameClassName?: string;
    imageClassName?: string;
    frameStyle?: React.CSSProperties;
    showZoomControl?: boolean;
    interactive?: boolean;
    onFrameSizeChange?: (size: Size) => void;
    children?: React.ReactNode;
};

type DragState = {
    pointerId: number;
    startX: number;
    startY: number;
    left: number;
    top: number;
    geometry: CropGeometry;
};

type Size = { width: number; height: number };
type CropGeometry = {
    frameWidth: number;
    frameHeight: number;
    imageWidth: number;
    imageHeight: number;
    left: number;
    top: number;
};

export default function ImageCropFrame({
    imageUrl,
    alt,
    settings,
    onChange,
    onCommit,
    frameClassName = '',
    imageClassName = '',
    frameStyle,
    showZoomControl = true,
    interactive = true,
    onFrameSizeChange,
    children,
}: ImageCropFrameProps) {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const settingsRef = useRef(settings);
    const [frameSize, setFrameSize] = useState<Size>({ width: 0, height: 0 });
    const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 });

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    const position = parseObjectPosition(settings.objectPosition);
    const scale = clampScale(settings.objectScale);
    const cropFrameTitle = interactive
        ? showZoomControl
            ? 'Drag to reposition. Use the slider to zoom.'
            : 'Drag to reposition.'
        : undefined;
    const geometry = useMemo(
        () => getCropGeometry(frameSize, naturalSize, settings.objectFit || 'cover', scale, position),
        [frameSize, naturalSize, settings.objectFit, scale, position],
    );

    useEffect(() => {
        const element = frameRef.current;
        if (!element) return;

        const updateFrameSize = () => {
            const rect = element.getBoundingClientRect();
            const nextSize = { width: rect.width, height: rect.height };
            setFrameSize(nextSize);
            if (nextSize.width > 0 && nextSize.height > 0) {
                onFrameSizeChange?.(nextSize);
            }
        };

        updateFrameSize();
        const observer = new ResizeObserver(updateFrameSize);
        observer.observe(element);
        return () => observer.disconnect();
    }, [onFrameSizeChange]);

    const updateSettings = useCallback((patch: Partial<ImageSettings>) => {
        const next = { ...settingsRef.current, ...patch };
        settingsRef.current = next;
        onChange(next);
        return next;
    }, [onChange]);

    const commitSettings = useCallback(() => {
        onCommit?.(settingsRef.current);
    }, [onCommit]);

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!interactive) return;
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest('[data-image-crop-control]')) return;

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            left: geometry.left,
            top: geometry.top,
            geometry,
        };
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        event.preventDefault();
        event.stopPropagation();
        const nextLeft = drag.left + (event.clientX - drag.startX);
        const nextTop = drag.top + (event.clientY - drag.startY);
        const nextX = leftToPosition(nextLeft, drag.geometry.frameWidth, drag.geometry.imageWidth);
        const nextY = leftToPosition(nextTop, drag.geometry.frameHeight, drag.geometry.imageHeight);
        updateSettings({ objectPosition: formatObjectPosition(nextX, nextY) });
    };

    const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        dragRef.current = null;
        commitSettings();
    };

    return (
        <div className="group/image-crop-frame relative h-full w-full">
            <div
                ref={frameRef}
                className={`group/image-crop relative overflow-hidden ${frameClassName}`}
                style={{ ...frameStyle, touchAction: 'none' }}
                title={cropFrameTitle}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
            >
                <img
                    src={imageUrl}
                    alt={alt}
                    draggable={false}
                    className={`absolute max-w-none select-none ${imageClassName}`}
                    onLoad={(event) => {
                        const image = event.currentTarget;
                        setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
                    }}
                    style={{
                        width: geometry.imageWidth || '100%',
                        height: geometry.imageHeight || '100%',
                        left: geometry.left,
                        top: geometry.top,
                    }}
                />
                {children}
            </div>

            {interactive && showZoomControl && (
                <div
                    data-image-crop-control
                    className="absolute bottom-3 left-1/2 z-30 flex w-[min(18rem,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-2 rounded-full border border-white/40 bg-slate-950/75 px-3 py-2 text-white opacity-0 shadow-lg backdrop-blur transition-opacity group-hover/image-crop-frame:opacity-100 group-focus-within/image-crop-frame:opacity-100 [@media(hover:none)]:opacity-100"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <ZoomOut className="h-4 w-4 shrink-0" />
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.05}
                        value={scale}
                        aria-label="Image zoom"
                        title="Image zoom"
                        onChange={(event) => updateSettings({ objectScale: clampScale(Number(event.target.value)) })}
                        onPointerUp={commitSettings}
                        onBlur={commitSettings}
                        className="min-w-0 flex-1 accent-white"
                    />
                    <ZoomIn className="h-4 w-4 shrink-0" />
                </div>
            )}
        </div>
    );
}

function parseObjectPosition(value: unknown): { x: number; y: number } {
    if (typeof value !== 'string' || !value.trim()) return { x: 50, y: 50 };
    const tokens = value.trim().toLowerCase().split(/\s+/);
    let x: number | undefined;
    let y: number | undefined;

    for (const token of tokens) {
        if (token.endsWith('%')) {
            const numeric = Number(token.slice(0, -1));
            if (!Number.isFinite(numeric)) continue;
            if (x === undefined) x = numeric;
            else if (y === undefined) y = numeric;
            continue;
        }
        if (token === 'left') x = 0;
        else if (token === 'right') x = 100;
        else if (token === 'top') y = 0;
        else if (token === 'bottom') y = 100;
        else if (token === 'center') {
            if (x === undefined) x = 50;
            else if (y === undefined) y = 50;
        }
    }

    return {
        x: clampPercent(x ?? 50),
        y: clampPercent(y ?? 50),
    };
}

function formatObjectPosition(x: number, y: number): string {
    return `${roundPercent(x)}% ${roundPercent(y)}%`;
}

function getCropGeometry(
    frame: Size,
    natural: Size,
    fit: ImageSettings['objectFit'],
    scale: number,
    position: { x: number; y: number },
): CropGeometry {
    const frameWidth = frame.width || 1;
    const frameHeight = frame.height || 1;
    const naturalWidth = natural.width || frameWidth;
    const naturalHeight = natural.height || frameHeight;
    const imageRatio = naturalWidth / Math.max(naturalHeight, 1);
    const frameRatio = frameWidth / Math.max(frameHeight, 1);

    let baseWidth = frameWidth;
    let baseHeight = frameHeight;

    if (fit === 'fill') {
        baseWidth = frameWidth;
        baseHeight = frameHeight;
    } else if (fit === 'contain') {
        if (frameRatio > imageRatio) {
            baseHeight = frameHeight;
            baseWidth = baseHeight * imageRatio;
        } else {
            baseWidth = frameWidth;
            baseHeight = baseWidth / imageRatio;
        }
    } else if (frameRatio > imageRatio) {
        baseWidth = frameWidth;
        baseHeight = baseWidth / imageRatio;
    } else {
        baseHeight = frameHeight;
        baseWidth = baseHeight * imageRatio;
    }

    const imageWidth = baseWidth * scale;
    const imageHeight = baseHeight * scale;

    return {
        frameWidth,
        frameHeight,
        imageWidth,
        imageHeight,
        left: positionToOffset(position.x, frameWidth, imageWidth),
        top: positionToOffset(position.y, frameHeight, imageHeight),
    };
}

function positionToOffset(position: number, frameSize: number, imageSize: number): number {
    return ((frameSize - imageSize) * clampPercent(position)) / 100;
}

function leftToPosition(offset: number, frameSize: number, imageSize: number): number {
    const range = frameSize - imageSize;
    if (Math.abs(range) < 0.5) return 50;
    return clampPercent((offset / range) * 100);
}

function roundPercent(value: number): number {
    return Math.round(value * 10) / 10;
}

function clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 50;
    return Math.max(0, Math.min(100, value));
}

function clampScale(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.max(1, Math.min(3, Math.round(numeric * 100) / 100));
}
