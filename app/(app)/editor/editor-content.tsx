'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FloatingToolbar from '@/app/components/FloatingToolbar';
import SiteSwitcher from '@/app/components/SiteSwitcher';
import SignUpModal from '@/app/components/SignUpModal';
import TemplateRenderer from '@/app/components/TemplateRenderer';
import { useAuth } from '@/lib/auth/context';

interface SiteData {
  id: string;
  userId: string | null;
  selectedTemplateId: string;
  businessType: string;
  category: string;
  designData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export default function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [siteTitle, setSiteTitle] = useState('My Website');
  const [error, setError] = useState<string | null>(null);

  // Get siteId from query params
  const siteId = searchParams.get('siteId');

  // Check auth and load site
  useEffect(() => {
    if (authLoading) {
      return; // Wait for auth to finish loading
    }

    if (!user) {
      // User is not authenticated, show signin modal
      setShowSignUp(true);
      setLoading(false);
      return;
    }

    // User is authenticated
    if (siteId) {
      // Load specific site
      fetchSite(siteId);
    } else {
      // Load user's latest site
      fetchLatestSite();
    }
  }, [user, authLoading, siteId]);

  const fetchLatestSite = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/latest-site');

      if (!res.ok) {
        if (res.status === 404) {
          // User has no sites yet
          setError('You have no sites yet. Create one to get started!');
          setLoading(false);
          return;
        }
        setError('Failed to load your latest site');
        setLoading(false);
        return;
      }

      const { site: data } = await res.json();
      setSite(data);
      setSiteTitle(data.designData.title || 'My Website');
    } catch (err) {
      console.error('Failed to fetch latest site:', err);
      setError('Failed to load site');
    } finally {
      setLoading(false);
    }
  };

  const fetchSite = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sites?id=${id}`);

      if (!res.ok) {
        setError('Site not found');
        setLoading(false);
        return;
      }

      const data: SiteData = await res.json();

      // Verify ownership - only site owner can edit
      if (data.userId && data.userId !== user?.id) {
        setError('You do not have permission to edit this site');
        setLoading(false);
        return;
      }
      
      setSite(data);
      setSiteTitle(data.designData.title || 'My Website');
    } catch (err) {
      console.error('Failed to fetch site:', err);
      setError('Failed to load site');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!site?.id || !user) return;

    // User is authenticated (required to access editor)
    // Save the design with ownership
    setSaving(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: site.id,
          designData: {
            ...site?.designData,
            title: siteTitle,
          },
          userId: user.id,
        }),
      });

      if (res.ok) {
        const updatedSite = await res.json();
        setSite(updatedSite.site);
        alert('Site saved successfully!');
      } else if (res.status === 403) {
        alert('You do not have permission to edit this site.');
      } else {
        alert('Failed to save. Please try again.');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleSignUpSuccess = async () => {
    // After successful sign in, reload with latest site
    setShowSignUp(false);
    setLoading(true);
    // Give auth state time to update
    await new Promise(resolve => setTimeout(resolve, 500));
    if (siteId) {
      fetchSite(siteId);
    } else {
      fetchLatestSite();
    }
  };

  // Show signin modal if not authenticated
  if (!authLoading && !user && showSignUp) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <SignUpModal
          isOpen={showSignUp}
          onClose={() => router.push('/onboarding')}
          siteId={siteId || ''}
          onSuccess={handleSignUpSuccess}
          defaultToSignin={true}
        />
      </div>
    );
  }

  // Loading states
  if (authLoading || loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
          <p className="text-slate-600">Loading editor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <p className="text-lg font-bold text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/onboarding')}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Onboarding
          </button>
        </div>
      </div>
    );
  }

  if (!site) {
    return null;
  }

  // Full-screen editor with template preview
  return (
    <div className="w-full h-screen overflow-hidden flex flex-col bg-white">
      {/* Header with Site Info and Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {site && <SiteSwitcher currentSiteId={site.id} currentSiteTitle={siteTitle} />}
          <div>
            <h2 className="font-semibold text-slate-900">{siteTitle}</h2>
            <p className="text-xs text-slate-500">
              {site.businessType} • {site.category}
            </p>
          </div>
        </div>
      </div>

      {/* Template Renderer - Full Screen */}
      <div className="flex-1 overflow-auto pt-16">
        <TemplateRenderer
          templateId={site.selectedTemplateId}
          colors={site.designData.colors}
        />
      </div>

      {/* Floating Toolbar */}
      <FloatingToolbar
        siteTitle={siteTitle}
        onSiteTitle={setSiteTitle}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
