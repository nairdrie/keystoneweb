'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';

interface DomainCheckResult {
  available: boolean;
  subdomain: string;
  fullDomain: string;
  message: string;
}

function DomainSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const siteId = searchParams.get('siteId');
  const sessionId = searchParams.get('session_id');

  const [subdomain, setSubdomain] = useState('');
  const [domainCheck, setDomainCheck] = useState<DomainCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');

  // Verify session and user
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/signin');
      return;
    }

    if (!siteId || !sessionId) {
      setError('Invalid session. Missing siteId or sessionId.');
      return;
    }
  }, [user, authLoading, siteId, sessionId, router]);

  // Check domain availability triggered by debounced effect
  const checkDomainAvailability = async (domainToCheck: string) => {
    setChecking(true);
    setError(null);

    try {
      const baseDomain = process.env.NEXT_PUBLIC_PUBLISHED_DOMAIN_BASE || 'kswd.ca';
      const res = await fetch(`/api/domains/check-availability?subdomain=${domainToCheck}&baseDomain=${baseDomain}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to check domain availability');
      }

      const result: DomainCheckResult = await res.json();
      setDomainCheck(result);

      if (!result.available) {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to check domain availability');
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  // Debounce effect for realtime checking
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = subdomain.trim();
      if (trimmed.length >= 3) {
        checkDomainAvailability(trimmed);
      } else if (trimmed.length > 0) {
        setError('Website address must be at least 3 characters');
        setDomainCheck(null);
      } else {
        setError(null);
        setDomainCheck(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [subdomain]);

  // Publish site with selected domain
  const handlePublish = async () => {
    if (!domainCheck || !domainCheck.available) {
      setError('Please select an available domain');
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const res = await fetch('/api/sites/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId,
          publishedDomain: domainCheck.fullDomain,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to publish site');
      }

      const result = await res.json();
      setSuccess(true);
      setPublishedUrl(result.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish site');
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Site Published! 🎉</h1>
          </div>

          <p className="text-slate-600 mb-6">
            Your site is now live on the web.
          </p>

          <div className="bg-slate-100 rounded-lg p-4 mb-6">
            <p className="text-xs text-slate-600 mb-2">Your live URL:</p>
            <p className="text-lg font-mono font-bold text-slate-900 break-all">
              {publishedUrl || `https://[subdomain].${process.env.NEXT_PUBLIC_PUBLISHED_DOMAIN_BASE || 'kswd.ca'}`}
            </p>
          </div>

          <div className="space-y-3">
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
            >
              Visit Your Live Site
            </a>
            <a
              href="/editor"
              className="block w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
            >
              Back to Editor
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Domain selection form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Choose Your Site Address</h1>
        <p className="text-slate-600 mb-6">
          Select a unique web address for your live site.
        </p>

        <div className="space-y-4">
          {/* Website Address Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Website Address
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={subdomain}
                onChange={(e) => {
                  setSubdomain(e.target.value.toLowerCase());
                  // Domain check will be handled automatically by the debounce effect
                }}
                placeholder="e.g., myawesome-site"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-transparent"
              />
              <span className="text-slate-600 font-semibold text-lg">.{process.env.NEXT_PUBLIC_PUBLISHED_DOMAIN_BASE || 'kswd.ca'}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              3-63 characters, alphanumeric & hyphens.
              {checking && <span className="ml-2 text-blue-600 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking...</span>}
            </p>
          </div>

          {/* Availability Status */}
          {domainCheck && (
            <div
              className={`p-4 rounded-lg border-2 flex items-start gap-3 ${domainCheck.available
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
                }`}
            >
              {domainCheck.available ? (
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-mono font-semibold text-sm text-slate-900">
                  {domainCheck.fullDomain}
                </p>
                <p
                  className={`text-sm mt-1 ${domainCheck.available ? 'text-green-700' : 'text-red-700'
                    }`}
                >
                  {domainCheck.message}
                </p>
              </div>
            </div>
          )}

          {/* Publish Button */}
          <button
            onClick={handlePublish}
            disabled={
              publishing || !domainCheck || !domainCheck.available || !siteId
            }
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
            {publishing ? 'Publishing...' : 'Publish Site'}
          </button>

          <button
            onClick={() => router.push('/editor')}
            className="w-full py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DomainSelectPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <DomainSelectContent />
    </Suspense>
  );
}
