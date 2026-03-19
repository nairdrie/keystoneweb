'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import SignUpModal from '@/app/components/SignUpModal';

interface TransferDetails {
  transferId: string;
  siteId: string;
  siteName: string;
  senderEmail: string;
  senderName: string | null;
  expiresAt: string;
}

function TransferContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const token = searchParams.get('token');

  const [transfer, setTransfer] = useState<TransferDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Fetch transfer details
  useEffect(() => {
    if (!token) {
      setError('No transfer token provided.');
      setLoading(false);
      return;
    }

    const fetchTransfer = async () => {
      try {
        const res = await fetch(`/api/sites/transfer?token=${token}`);
        if (res.ok) {
          const data = await res.json();
          setTransfer(data);
        } else {
          const data = await res.json();
          setError(data.error || 'This transfer link is invalid or has expired.');
        }
      } catch {
        setError('Failed to load transfer details.');
      } finally {
        setLoading(false);
      }
    };

    fetchTransfer();
  }, [token]);

  // Once user is authenticated and transfer is loaded, show the accept modal
  // If not authenticated, show sign up
  useEffect(() => {
    if (!loading && transfer && !user && !showSignUp) {
      setShowSignUp(true);
    }
  }, [loading, transfer, user, showSignUp]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const res = await fetch('/api/sites/transfer/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = await res.json();
        setAccepted(true);
        setTimeout(() => {
          router.push(`/editor?siteId=${data.siteId}`);
        }, 1500);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to accept transfer.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setAccepting(false);
    }
  };

  const handleAuthSuccess = () => {
    setShowSignUp(false);
    // After auth, the user state will update and the accept modal will show
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading transfer details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Transfer Unavailable</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Transfer Complete!</h1>
          <p className="text-slate-600 mb-2">
            <strong>{transfer?.siteName}</strong> is now yours.
          </p>
          <p className="text-sm text-slate-500">Redirecting to the editor...</p>
        </div>
      </div>
    );
  }

  // Show accept modal when user is authenticated
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      {user && transfer && (
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Site Transfer</h1>
          <p className="text-slate-600 mb-6">
            <strong>{transfer.senderName || transfer.senderEmail}</strong> wants to transfer the site <strong>&ldquo;{transfer.siteName}&rdquo;</strong> to you.
          </p>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Site</span>
              <span className="font-semibold text-slate-900">{transfer.siteName}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">From</span>
              <span className="font-semibold text-slate-900">{transfer.senderEmail}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Expires</span>
              <span className="font-semibold text-slate-900">{new Date(transfer.expiresAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-lg transition-colors"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {accepting ? 'Accepting...' : 'Accept Transfer'}
            </button>
          </div>
        </div>
      )}

      {/* Sign Up Modal - shown when user is not authenticated */}
      {showSignUp && !user && transfer && (
        <SignUpModal
          isOpen={true}
          onClose={() => setShowSignUp(false)}
          siteId={transfer.siteId}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* Fallback: waiting for auth state after sign up */}
      {!user && !showSignUp && transfer && (
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      )}
    </div>
  );
}

export default function TransferPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TransferContent />
    </Suspense>
  );
}
