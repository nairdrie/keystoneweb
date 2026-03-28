'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

export interface WalkthroughStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface WalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: WalkthroughStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  title: string;
}

export default function WalkthroughModal({
  isOpen,
  onClose,
  steps,
  currentStep,
  onNext,
  onPrev,
  title,
}: WalkthroughModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && currentStep < steps.length - 1) onNext();
    if (e.key === 'ArrowLeft' && currentStep > 0) onPrev();
  }, [isOpen, currentStep, steps.length, onClose, onNext, onPrev]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close walkthrough"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step content */}
        <div className="px-6 py-8 flex flex-col items-center text-center gap-4 min-h-[220px]">
          <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-700 text-2xl shrink-0">
            {step.icon}
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 mb-1.5">{step.title}</h2>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{step.description}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`rounded-full transition-all ${
                  i === currentStep
                    ? 'w-4 h-2 bg-slate-800'
                    : 'w-2 h-2 bg-slate-200'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={onPrev}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={onClose}
                className="flex items-center gap-1 px-4 py-1.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Got it
              </button>
            ) : (
              <button
                onClick={onNext}
                className="flex items-center gap-1 px-4 py-1.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
