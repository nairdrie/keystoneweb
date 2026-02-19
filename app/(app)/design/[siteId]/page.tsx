'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/app/components/Header';
import SignUpModal from '@/app/components/SignUpModal';
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

export default function DesignPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [siteTitle, setSiteTitle] = useState('My Website');
  const [siteDescription, setSiteDescription] = useState('');

  useEffect(() => {
    fetchSite();
  }, [siteId]);

  const fetchSite = async () => {
    try {
      const res = await fetch(`/api/sites?id=${siteId}`);
      if (!res.ok) {
        router.push('/onboarding');
        return;
      }
      const data = await res.json();
      setSite(data);
      setSiteTitle(data.designData.title || 'My Website');
      setSiteDescription(data.designData.description || '');
    } catch (error) {
      console.error('Failed to fetch site:', error);
      router.push('/onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDesign = async () => {
    // If user is not authenticated, show sign up modal
    if (!user) {
      setShowSignUp(true);
      return;
    }

    // User is authenticated, save the design
    setSaving(true);
    try {
      const designData = {
        title: siteTitle,
        description: siteDescription,
        // More fields can be added as customization expands
      };

      const res = await fetch('/api/sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          designData,
          userId: user.id,
        }),
      });

      if (res.ok) {
        // Design saved successfully
        const updatedSite = await res.json();
        setSite(updatedSite.site);
        
        // Show success message
        alert('Design saved successfully!');
      } else {
        alert('Failed to save design. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save design:', error);
      alert('An error occurred while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignUpSuccess = () => {
    // After successful sign up, save the design
    setShowSignUp(false);
    handleSaveDesign();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
          <p className="text-slate-600">Loading your design...</p>
        </div>
      </div>
    );
  }

  if (!site) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Design Editor */}
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Preview (Left) */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-12 text-white text-center">
                  <h1 className="text-4xl font-black mb-2">{siteTitle}</h1>
                  <p className="text-lg opacity-90">{siteDescription}</p>
                </div>

                <div className="p-8">
                  <div className="space-y-4 text-slate-600">
                    <p>Template: <span className="font-semibold">{site.selectedTemplateId}</span></p>
                    <p>Category: <span className="font-semibold">{site.category}</span></p>
                    <p>Business Type: <span className="font-semibold">{site.businessType}</span></p>
                  </div>

                  <div className="mt-12 border-t pt-8">
                    <p className="text-sm text-slate-500 mb-4">More customization options coming soon...</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-100 rounded-lg text-center">
                        <p className="text-xs text-slate-600 mb-2">Colors</p>
                        <div className="flex gap-2 justify-center">
                          <div className="w-6 h-6 bg-blue-500 rounded"></div>
                          <div className="w-6 h-6 bg-blue-600 rounded"></div>
                          <div className="w-6 h-6 bg-blue-700 rounded"></div>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-100 rounded-lg text-center">
                        <p className="text-xs text-slate-600 mb-2">Fonts</p>
                        <p className="text-sm font-semibold">Sans-serif</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customization Panel (Right) */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-lg p-6 sticky top-32">
                <h2 className="text-2xl font-bold mb-6">Customize</h2>

                {user && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700">
                      ✓ Signed in as <span className="font-semibold">{user.email}</span>
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Site Title */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Website Title
                    </label>
                    <input
                      type="text"
                      value={siteTitle}
                      onChange={e => setSiteTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                      placeholder="My Website"
                    />
                  </div>

                  {/* Site Description */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Tagline
                    </label>
                    <textarea
                      value={siteDescription}
                      onChange={e => setSiteDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                      placeholder="A catchy description of your business"
                      rows={3}
                    />
                  </div>

                  {/* More Options Coming */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>Coming soon:</strong> Colors, fonts, images, sections, and more
                    </p>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveDesign}
                    disabled={saving}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold rounded-lg transition-colors mt-6"
                  >
                    {saving ? 'Saving...' : 'Save Design'}
                  </button>

                  {/* Info */}
                  <p className="text-xs text-slate-600 text-center">
                    {user ? 'Your changes are automatically associated with your account.' : 'You\'ll be asked to create an account when you save.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign Up Modal */}
      <SignUpModal 
        isOpen={showSignUp} 
        onClose={() => setShowSignUp(false)} 
        siteId={siteId}
        onSuccess={handleSignUpSuccess}
      />
    </div>
  );
}
