'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';

// ─── Animated Checkmark ─────────────────────────────────────────────────────

function AnimatedCheckmark() {
  return (
    <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
      <svg className="w-24 h-24" viewBox="0 0 96 96" fill="none">
        {/* Circle */}
        <circle
          cx="48"
          cy="48"
          r="44"
          stroke="#22c55e"
          strokeWidth="4"
          fill="none"
          style={{
            strokeDasharray: 276.5,
            strokeDashoffset: 276.5,
            animation: 'kswd-draw-circle 0.6s ease-out forwards',
          }}
        />
        {/* Checkmark */}
        <path
          d="M28 50 L42 64 L68 34"
          stroke="#22c55e"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{
            strokeDasharray: 80,
            strokeDashoffset: 80,
            animation: 'kswd-draw-check 0.4s ease-out 0.5s forwards',
          }}
        />
      </svg>
    </div>
  );
}

// ─── Page Content ───────────────────────────────────────────────────────────

function PlanActivatedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const siteId = searchParams.get('siteId');

  // Inject keyframe styles once
  useEffect(() => {
    const id = 'kswd-plan-activated-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes kswd-draw-circle {
        to { stroke-dashoffset: 0; }
      }
      @keyframes kswd-draw-check {
        to { stroke-dashoffset: 0; }
      }
      @keyframes kswd-fade-in-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        style={{ animation: 'kswd-fade-in-up 0.5s ease-out' }}
      >
        <AnimatedCheckmark />

        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          Your plan is now active!
        </h1>

        <p className="text-slate-600 mb-8">
          You&apos;re all set. Let&apos;s get your site live on the web.
        </p>

        <div className="space-y-3">
          <button
            onClick={() =>
              router.push(
                siteId
                  ? `/publish/domain-select?siteId=${siteId}`
                  : '/publish/domain-select'
              )
            }
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Next Step: Set Up Your Domain
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() =>
              router.push(siteId ? `/editor?siteId=${siteId}` : '/editor')
            }
            className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
          >
            Back to Editor
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page Export ─────────────────────────────────────────────────────────────

export default function PlanActivatedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <PlanActivatedContent />
    </Suspense>
  );
}
