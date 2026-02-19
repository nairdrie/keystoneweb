'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FloatingToolbar from '@/app/components/FloatingToolbar';
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
      // User is not authenticated, redirect to onboarding
      router.push('/onboarding');
      return;
    }

    if (!siteId) {
      setError('No site ID provided');
      setLoading(false);
      return;
    }

    fetchSite();
  }, [user, authLoading, siteId, router]);

  const fetchSite = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sites?id=${siteId}`);

      if (!res.ok) {
        setError('Site not found');
        setLoading(false);
        return;
      }

      const data: SiteData = await res.json();

      // Verify ownership
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
    if (!siteId || !user) return;

    setSaving(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
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
    <div className="w-full h-screen overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Template Preview */}
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-full overflow-auto">
          {/* Hero Section Preview */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-12 sm:p-16 text-white text-center">
            <h1 className="text-4xl sm:text-5xl font-black mb-4">{siteTitle}</h1>
            <p className="text-lg sm:text-xl opacity-90">
              {site.designData.description || 'Your professional website starts here'}
            </p>
            <button className="mt-6 px-8 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-slate-100 transition-colors">
              Get Started
            </button>
          </div>

          {/* Content Section */}
          <div className="p-8 sm:p-12">
            {/* Meta Info */}
            <div className="mb-8 pb-8 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-600 mb-4">Site Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Business Type</p>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {site.businessType}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Category</p>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {site.category}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Template</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {site.selectedTemplateId}
                  </p>
                </div>
              </div>
            </div>

            {/* Features Preview */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Features Coming Soon</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-100 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900">Color Customization</p>
                  <p className="text-xs text-slate-600 mt-1">Open settings to choose your palette</p>
                </div>
                <div className="p-4 bg-slate-100 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900">Font Selection</p>
                  <p className="text-xs text-slate-600 mt-1">Coming in next update</p>
                </div>
                <div className="p-4 bg-slate-100 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900">Section Editor</p>
                  <p className="text-xs text-slate-600 mt-1">Drag & drop sections</p>
                </div>
                <div className="p-4 bg-slate-100 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900">Image Gallery</p>
                  <p className="text-xs text-slate-600 mt-1">Add your own images</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-8 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                Open the settings panel (bottom right) to customize your site
              </p>
            </div>
          </div>
        </div>
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
