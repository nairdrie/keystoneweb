'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft, Plus, Settings, ArrowUp, ArrowDown, Trash2, PanelBottomClose, PanelBottomOpen } from 'lucide-react';

type WalkthroughPlacement = 'top' | 'right' | 'bottom' | 'left' | 'auto' | 'center';

export interface WalkthroughStep {
  target?: string | string[];
  title: string;
  description: string;
  placement: WalkthroughPlacement;
  autoMinimizeOnObstruction?: boolean;
  animateFinishToTarget?: boolean;
  requiresPanel?: boolean;
  sectionKeys?: string[];
  spotlightPadding?: number;
  spotlightRadiusOffset?: number;
  interactionHint?: string;
  controlPreviews?: Array<{
    icon: 'plus' | 'settings' | 'up' | 'down' | 'trash';
    label: string;
  }>;
}

interface WalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore?: () => void;
  steps: WalkthroughStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  title: string;
  isNextDisabled?: boolean;
  nextButtonLabel?: string;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

interface MinimizedState {
  step: number;
  reason: 'manual' | 'obstruction';
  obstructionSelector?: string;
}

interface FinishAnimationState {
  translateX: number;
  translateY: number;
  scale: number;
}

const VIEWPORT_PADDING = 16;
const TOOLTIP_GAP = 18;
const SPOTLIGHT_PADDING = 14;
const SPOTLIGHT_EDGE_MARGIN = 2;
const OBSTRUCTION_SELECTORS = [
  '[data-tour="font-picker-modal"]',
  '[data-tour="block-settings-modal"]',
  '[data-tour="add-block-menu"]',
  '[data-tour="page-selector-menu"]',
];

function getPreviewIcon(icon: 'plus' | 'settings' | 'up' | 'down' | 'trash') {
  switch (icon) {
    case 'plus':
      return <Plus className="h-3.5 w-3.5" />;
    case 'settings':
      return <Settings className="h-3.5 w-3.5" />;
    case 'up':
      return <ArrowUp className="h-3.5 w-3.5" />;
    case 'down':
      return <ArrowDown className="h-3.5 w-3.5" />;
    case 'trash':
      return <Trash2 className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

export default function WalkthroughModal({
  isOpen,
  onClose,
  onRestore,
  steps,
  currentStep,
  onNext,
  onPrev,
  title,
  isNextDisabled = false,
  nextButtonLabel,
}: WalkthroughModalProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [minimizedState, setMinimizedState] = useState<MinimizedState | null>(null);
  const [finishAnimationState, setFinishAnimationState] = useState<FinishAnimationState | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      setMinimizedState(null);
      setFinishAnimationState(null);
      onClose();
    }
    if (e.key === 'ArrowRight' && currentStep < steps.length - 1) onNext();
    if (e.key === 'ArrowLeft' && currentStep > 0) onPrev();
  }, [isOpen, currentStep, steps.length, onClose, onNext, onPrev]);

  const current = steps[currentStep];
  const isMinimized = minimizedState?.step === currentStep;

  const resolveTarget = useCallback((target?: string | string[]) => {
    if (!target) return null;

    const selectors = Array.isArray(target) ? target : [target];
    for (const selector of selectors) {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) return element;
    }

    return null;
  }, []);

  const updateLayout = useCallback(() => {
    if (!isOpen || !current) return;

    if (current.placement === 'center' || !current.target) {
      setSpotlightRect(null);
      const tooltipRect = tooltipRef.current?.getBoundingClientRect();
      const tooltipWidth = tooltipRect?.width ?? Math.min(360, window.innerWidth - VIEWPORT_PADDING * 2);
      const tooltipHeight = tooltipRect?.height ?? 240;
      setTooltipPosition({
        top: Math.max(VIEWPORT_PADDING, window.innerHeight / 2 - tooltipHeight / 2),
        left: Math.max(VIEWPORT_PADDING, window.innerWidth / 2 - tooltipWidth / 2),
      });
      return;
    }

    const target = resolveTarget(current.target);
    if (!target) {
      setSpotlightRect(null);
      setTooltipPosition({
        top: window.innerHeight / 2 - 120,
        left: Math.max(VIEWPORT_PADDING, window.innerWidth / 2 - 180),
      });
      return;
    }

    target.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });

    const rect = target.getBoundingClientRect();
    const computedStyles = window.getComputedStyle(target);
    const radius = Number.parseFloat(computedStyles.borderRadius || '0') || 20;
    const spotlightPadding = current.spotlightPadding ?? SPOTLIGHT_PADDING;
    const spotlightRadiusOffset = current.spotlightRadiusOffset ?? 12;

    // Keep the spotlight centered on the target even when the target is close
    // to a viewport edge. We do that by shrinking padding symmetrically per axis
    // instead of padding first and then clamping the whole rectangle afterward.
    const horizontalPadding = Math.max(
      0,
      Math.min(
        spotlightPadding,
        rect.left - SPOTLIGHT_EDGE_MARGIN,
        window.innerWidth - rect.right - SPOTLIGHT_EDGE_MARGIN
      )
    );

    const verticalPadding = Math.max(
      0,
      Math.min(
        spotlightPadding,
        rect.top - SPOTLIGHT_EDGE_MARGIN,
        window.innerHeight - rect.bottom - SPOTLIGHT_EDGE_MARGIN
      )
    );

    const clampedTop = Math.max(SPOTLIGHT_EDGE_MARGIN, rect.top - verticalPadding);
    const clampedLeft = Math.max(SPOTLIGHT_EDGE_MARGIN, rect.left - horizontalPadding);
    const clampedRight = Math.min(window.innerWidth - SPOTLIGHT_EDGE_MARGIN, rect.right + horizontalPadding);
    const clampedBottom = Math.min(window.innerHeight - SPOTLIGHT_EDGE_MARGIN, rect.bottom + verticalPadding);

    const nextSpotlightRect: SpotlightRect = {
      top: clampedTop,
      left: clampedLeft,
      width: Math.max(0, clampedRight - clampedLeft),
      height: Math.max(0, clampedBottom - clampedTop),
      radius: radius + spotlightRadiusOffset,
    };

    setSpotlightRect(nextSpotlightRect);

    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    const tooltipWidth = tooltipRect?.width ?? Math.min(360, window.innerWidth - VIEWPORT_PADDING * 2);
    const tooltipHeight = tooltipRect?.height ?? 240;
    const horizontalCenter = rect.left + rect.width / 2 - tooltipWidth / 2;
    const verticalCenter = rect.top + rect.height / 2 - tooltipHeight / 2;

    const clampLeft = (value: number) =>
      Math.min(
        window.innerWidth - tooltipWidth - VIEWPORT_PADDING,
        Math.max(VIEWPORT_PADDING, value)
      );
    const clampTop = (value: number) =>
      Math.min(
        window.innerHeight - tooltipHeight - VIEWPORT_PADDING,
        Math.max(VIEWPORT_PADDING, value)
      );

    const placements: WalkthroughPlacement[] = current.placement === 'auto'
      ? ['right', 'bottom', 'left', 'top']
      : [current.placement, 'right', 'bottom', 'left', 'top'].filter(
          (placement, index, list) => list.indexOf(placement) === index
        ) as WalkthroughPlacement[];

    const candidates = placements.map((placement) => {
      switch (placement) {
        case 'top':
          return {
            placement,
            top: rect.top - tooltipHeight - TOOLTIP_GAP,
            left: horizontalCenter,
            fits:
              rect.top - tooltipHeight - TOOLTIP_GAP >= VIEWPORT_PADDING,
          };
        case 'right':
          return {
            placement,
            top: verticalCenter,
            left: rect.right + TOOLTIP_GAP,
            fits:
              rect.right + TOOLTIP_GAP + tooltipWidth <= window.innerWidth - VIEWPORT_PADDING,
          };
        case 'bottom':
          return {
            placement,
            top: rect.bottom + TOOLTIP_GAP,
            left: horizontalCenter,
            fits:
              rect.bottom + TOOLTIP_GAP + tooltipHeight <= window.innerHeight - VIEWPORT_PADDING,
          };
        case 'left':
          return {
            placement,
            top: verticalCenter,
            left: rect.left - tooltipWidth - TOOLTIP_GAP,
            fits:
              rect.left - tooltipWidth - TOOLTIP_GAP >= VIEWPORT_PADDING,
          };
        default:
          return {
            placement: 'bottom' as WalkthroughPlacement,
            top: rect.bottom + TOOLTIP_GAP,
            left: horizontalCenter,
            fits: true,
          };
      }
    });

    const bestCandidate = candidates.find((candidate) => candidate.fits) ?? candidates[0];

    setTooltipPosition({
      top: clampTop(bestCandidate.top),
      left: clampLeft(bestCandidate.left),
    });
  }, [current, isOpen, resolveTarget]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    return () => {
      previousActiveElementRef.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const interval = window.setInterval(updateLayout, 150);
    const handleViewportChange = () => updateLayout();

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    window.requestAnimationFrame(() => {
      updateLayout();
      window.requestAnimationFrame(updateLayout);
    });

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, currentStep, updateLayout]);

  useEffect(() => {
    if (!isOpen || current?.autoMinimizeOnObstruction === false) return;

    const getOverlappingObstructionSelector = () => {
      const tooltipRect = tooltipRef.current?.getBoundingClientRect();
      if (!tooltipRect) return null;

      for (const selector of OBSTRUCTION_SELECTORS) {
        const popup = document.querySelector<HTMLElement>(selector);
        if (!popup) continue;
        const popupRect = popup.getBoundingClientRect();
        const overlaps =
          tooltipRect.left < popupRect.right &&
          tooltipRect.right > popupRect.left &&
          tooltipRect.top < popupRect.bottom &&
          tooltipRect.bottom > popupRect.top;

        if (overlaps) return selector;
      }

      return null;
    };

    const interval = window.setInterval(() => {
      if (minimizedState?.step === currentStep && minimizedState.reason === 'obstruction') {
        const activeObstruction = minimizedState.obstructionSelector
          ? document.querySelector<HTMLElement>(minimizedState.obstructionSelector)
          : null;

        if (!activeObstruction) {
          setMinimizedState(null);
        }
        return;
      }

      if (isMinimized) return;

      const overlappingSelector = getOverlappingObstructionSelector();
      if (overlappingSelector) {
        setMinimizedState({
          step: currentStep,
          reason: 'obstruction',
          obstructionSelector: overlappingSelector,
        });
      }
    }, 150);

    return () => window.clearInterval(interval);
  }, [current, currentStep, isMinimized, isOpen, minimizedState]);

  useEffect(() => {
    if (!isOpen) return;

    primaryActionRef.current?.focus();
  }, [isOpen, currentStep, isMinimized]);

  const isLast = currentStep === steps.length - 1;

  const handleFinish = useCallback(() => {
    if (!current?.animateFinishToTarget || !tooltipRef.current) {
      setMinimizedState(null);
      setFinishAnimationState(null);
      onClose();
      return;
    }

    const target = resolveTarget(current.target);
    if (!target) {
      setMinimizedState(null);
      setFinishAnimationState(null);
      onClose();
      return;
    }

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const tooltipCenterX = tooltipRect.left + tooltipRect.width / 2;
    const tooltipCenterY = tooltipRect.top + tooltipRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    setFinishAnimationState({
      translateX: targetCenterX - tooltipCenterX,
      translateY: targetCenterY - tooltipCenterY,
      scale: 0.18,
    });

    window.setTimeout(() => {
      setMinimizedState(null);
      setFinishAnimationState(null);
      onClose();
    }, 320);
  }, [current, onClose, resolveTarget]);

  const spotlightStyle = useMemo(() => {
    if (!spotlightRect) return undefined;

    return {
      top: spotlightRect.top,
      left: spotlightRect.left,
      width: spotlightRect.width,
      height: spotlightRect.height,
      borderRadius: `${spotlightRect.radius}px`,
      boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.58)',
    };
  }, [spotlightRect]);

  if (!isOpen || typeof document === 'undefined') return null;

  const step = steps[currentStep];

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[99999]">
      {spotlightRect ? (
        <>
          <div
            className="pointer-events-auto fixed left-0 top-0 bg-[rgba(15,23,42,0.58)] backdrop-blur-[1px]"
            style={{ width: '100%', height: spotlightRect.top }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto fixed left-0 bg-[rgba(15,23,42,0.58)] backdrop-blur-[1px]"
            style={{
              top: spotlightRect.top,
              width: spotlightRect.left,
              height: spotlightRect.height,
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto fixed bg-[rgba(15,23,42,0.58)] backdrop-blur-[1px]"
            style={{
              top: spotlightRect.top,
              left: spotlightRect.left + spotlightRect.width,
              right: 0,
              height: spotlightRect.height,
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto fixed left-0 bg-[rgba(15,23,42,0.58)] backdrop-blur-[1px]"
            style={{
              top: spotlightRect.top + spotlightRect.height,
              width: '100%',
              bottom: 0,
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-[rgba(15,23,42,0.58)] backdrop-blur-[1px]" aria-hidden="true" />
      )}
      {spotlightStyle && (
        <div
          className="pointer-events-none fixed transition-all duration-300 ease-out"
          style={spotlightStyle}
        >
          <div className="absolute inset-0 rounded-[inherit] border border-white/85 shadow-[0_0_0_1px_rgba(255,255,255,0.45),0_18px_40px_rgba(15,23,42,0.3)]" />
        </div>
      )}

      {isMinimized ? (
        <div className="pointer-events-auto fixed bottom-5 right-5" onClick={(event) => event.stopPropagation()}>
          <button
            onClick={() => {
              onRestore?.();
              setMinimizedState(null);
              setFinishAnimationState(null);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/96 px-4 py-2 text-sm font-semibold text-slate-700 shadow-xl backdrop-blur transition-colors hover:bg-white"
          >
            <PanelBottomOpen className="h-4 w-4 text-slate-500" />
            Return to tutorial
          </button>
        </div>
      ) : (
        <div
          ref={tooltipRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="pointer-events-auto fixed w-[min(22rem,calc(100vw-2rem))] transition-[top,left] duration-300 ease-out"
          style={{
            ...tooltipPosition,
            transform: finishAnimationState
              ? `translate(${finishAnimationState.translateX}px, ${finishAnimationState.translateY}px) scale(${finishAnimationState.scale})`
              : undefined,
            opacity: finishAnimationState ? 0 : 1,
            transition: finishAnimationState
              ? 'top 300ms ease-out, left 300ms ease-out, transform 320ms ease-in, opacity 320ms ease-in'
              : undefined,
            transformOrigin: 'center center',
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/96 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{title}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimizedState({ step: currentStep, reason: 'manual' })}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Minimize walkthrough"
                >
                  <PanelBottomClose className="h-4 w-4" />
                </button>
                  <button
                    onClick={() => {
                      setMinimizedState(null);
                      setFinishAnimationState(null);
                      onClose();
                    }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close walkthrough"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-4 py-4">
              <h2 className="text-base font-black text-slate-900">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
              {step.controlPreviews && step.controlPreviews.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {step.controlPreviews.map((control) => (
                    <div
                      key={`${control.icon}-${control.label}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm">
                        {getPreviewIcon(control.icon)}
                      </span>
                      <span>{control.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {step.interactionHint && (
                <p className="mt-3 text-xs font-medium text-slate-400">
                  {step.interactionHint}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <button
                onClick={() => {
                  setMinimizedState(null);
                  setFinishAnimationState(null);
                  onClose();
                }}
                className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
              >
                Skip
              </button>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={onPrev}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                )}
                <button
                  ref={primaryActionRef}
                  onClick={isLast ? handleFinish : onNext}
                  disabled={!isLast && isNextDisabled}
                  className="flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isLast ? 'Finish' : (nextButtonLabel || 'Next')}
                  {!isLast && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-center gap-1.5">
            {steps.map((_, index) => (
              <span
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep ? 'w-5 bg-white/90' : 'w-2 bg-white/45'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
