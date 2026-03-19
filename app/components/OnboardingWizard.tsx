'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import Header from './Header';
import { Sparkles, Send } from 'lucide-react';
import SiteLimitModal from './SiteLimitModal';

type BusinessType = 'services' | 'products' | 'portfolio' | 'nonprofit' | 'other' | null;
type Category = string | null;

interface TemplatePreview {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  tags: string[];
}

interface TemplatesResponse {
  templates: TemplatePreview[];
  total: number;
  page: number;
  hasMore: boolean;
}

const BUSINESS_TYPES = [
  {
    id: 'services',
    label: 'Services',
    description: 'I sell my time and expertise',
    icon: '👔',
  },
  {
    id: 'products',
    label: 'Products',
    description: 'I sell physical or digital products',
    icon: '📦',
  },
  {
    id: 'portfolio',
    label: 'Portfolio / Branding',
    description: 'Showcase my work and personal brand',
    icon: '🎨',
  },
  {
    id: 'nonprofit',
    label: 'Association / Non-Profit',
    description: 'Serve a community or cause',
    icon: '🤝',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Something else entirely',
    icon: '✨',
  },
];

const CATEGORIES: Record<Exclude<BusinessType, null>, any[]> = {
  services: [
    { id: 'handyman', label: 'Handyman', example: 'General repairs & maintenance', icon: '🔧' },
    { id: 'plumber', label: 'Plumber', example: 'Plumbing & repairs', icon: '🚰' },
    { id: 'electrical', label: 'Electrician', example: 'Electrical services', icon: '⚡' },
    { id: 'hvac', label: 'HVAC/Heating', example: 'Heating & cooling systems', icon: '🌡️' },
    { id: 'mechanic', label: 'Mechanic', example: 'Auto repair & service', icon: '🚗' },
    { id: 'trades', label: 'Trades', example: 'Carpentry, welding, etc.', icon: '🛠️' },
    { id: 'cleaning', label: 'Cleaning', example: 'House & office cleaning', icon: '🧹' },
    { id: 'landscaping', label: 'Landscaping', example: 'Lawn & garden services', icon: '🌿' },
    { id: 'consulting', label: 'Consulting', example: 'Business consulting', icon: '💼' },
    { id: 'freelance', label: 'Freelancer', example: 'Writing, design, coding', icon: '💻' },
    { id: 'salon', label: 'Salon/Spa', example: 'Hair, nails, massage', icon: '💅' },
    { id: 'fitness', label: 'Fitness/Coaching', example: 'Training & coaching', icon: '💪' },
  ],
  products: [
    { id: 'ecommerce', label: 'E-Commerce Store', icon: '🛍️' },
    { id: 'handmade', label: 'Handmade/Crafts', icon: '🎨' },
    { id: 'digital', label: 'Digital Products', icon: '📱' },
    { id: 'dropship', label: 'Dropshipping', icon: '📮' },
    { id: 'subscription', label: 'Subscription Box', icon: '📬' },
  ],
  portfolio: [
    { id: 'photographer', label: 'Photographer', example: 'Photography portfolio & booking', icon: '📷' },
    { id: 'designer', label: 'Designer', example: 'Graphic & UI/UX design work', icon: '🖌️' },
    { id: 'artist', label: 'Artist', example: 'Fine art, illustration, murals', icon: '🎭' },
    { id: 'videographer', label: 'Videographer', example: 'Video production & film', icon: '🎬' },
    { id: 'architect', label: 'Architect / Interior', example: 'Architecture & interior design', icon: '🏛️' },
    { id: 'agency', label: 'Creative Agency', example: 'Branding, marketing, campaigns', icon: '🏢' },
  ],
  nonprofit: [
    { id: 'nonprofit', label: 'Non-Profit Org', example: 'Mission-driven organization', icon: '🌍' },
    { id: 'charity', label: 'Charity / Fundraising', example: 'Donations & fundraising campaigns', icon: '❤️' },
    { id: 'association', label: 'Association', example: 'Member-based organization', icon: '🤝' },
    { id: 'community', label: 'Community Group', example: 'Local or online community', icon: '🏘️' },
    { id: 'foundation', label: 'Foundation', example: 'Grantmaking & philanthropy', icon: '🏛️' },
    { id: 'church', label: 'Church / Religious', example: 'Faith-based organization', icon: '⛪' },
  ],
  other: [
    { id: 'restaurant', label: 'Restaurant / Food', example: 'Menu, reservations & ordering', icon: '🍽️' },
    { id: 'event', label: 'Events / Weddings', example: 'Event planning & coordination', icon: '🎉' },
    { id: 'blog', label: 'Blog / Content', example: 'Articles, news & storytelling', icon: '✍️' },
    { id: 'realestate', label: 'Real Estate', example: 'Property listings & agents', icon: '🏡' },
    { id: 'education', label: 'Education / Courses', example: 'Teaching, tutoring & e-learning', icon: '🎓' },
    { id: 'general', label: 'General / Other', example: 'Everything else', icon: '🌐' },
  ],
};

export default function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState<BusinessType>(null);
  const [category, setCategory] = useState<Category>(null);
  const [templates, setTemplates] = useState<TemplatePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalTemplates, setTotalTemplates] = useState(0);
  const [userSites, setUserSites] = useState<any[]>([]);
  const [checkingSites, setCheckingSites] = useState(true);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showSiteLimit, setShowSiteLimit] = useState(false);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);
  // Use a ref to prevent re-fetching on tab-switch (Supabase auth token refresh
  // fires onAuthStateChange which creates a new user object reference)
  const hasFetchedSitesRef = useRef(false);

  // Check for existing sites if user is authenticated
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      if (hasFetchedSitesRef.current) return;
      hasFetchedSitesRef.current = true;
      checkUserSites();
    } else {
      setCheckingSites(false);
    }
  }, [user, authLoading]);

  const checkUserSites = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('/api/user/sites', { credentials: 'include', signal: controller.signal });
      if (res.ok) {
        const { sites } = await res.json();
        setUserSites(sites);
        if (sites.length > 0) {
          setShowWelcomeBack(true);
        }
      }
    } catch (error) {
      console.error('Failed to check user sites:', error);
    } finally {
      clearTimeout(timeoutId);
      setCheckingSites(false);
    }
  };

  // Resume AI builder flow after auth redirect
  const resumeAiTriggered = useRef(false);
  useEffect(() => {
    if (resumeAiTriggered.current || authLoading || !user) return;
    const resumeAi = searchParams.get('resumeAi');
    if (resumeAi !== 'true') return;

    const savedPrompt = sessionStorage.getItem('keystoneAiOnboardingPrompt');
    if (!savedPrompt) return;

    resumeAiTriggered.current = true;
    // Restore the prompt into the input and auto-submit
    setAiPrompt(savedPrompt);
    // Remove the param from URL to prevent re-triggering
    router.replace('/onboarding');
    // Use a short delay so state settles before submitting
    setTimeout(() => {
      // Call handleAiSubmit programmatically — prompt is in sessionStorage still,
      // and we've set aiPrompt state. The submit function reads from aiPrompt.
      setAiLoading(true);
      setAiError(null);
      fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          selectedTemplateId: 'airy_general',
          businessType: 'services',
          category: 'general',
          userId: user.id,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (res.status === 403 && errData.siteLimitReached) {
              setShowSiteLimit(true);
            } else {
              setAiError('Something went wrong creating your site. Please try again.');
            }
            setAiLoading(false);
            return;
          }
          const resData = await res.json();
          const { siteId } = resData;
          if (!siteId) {
            setAiError('Something went wrong creating your site. Please try again.');
            setAiLoading(false);
            return;
          }
          // Prompt is already in sessionStorage — editor will pick it up
          router.push(`/editor?siteId=${siteId}`);
        })
        .catch(() => {
          setAiError('Something went wrong creating your site. Please try again.');
          setAiLoading(false);
        });
    }, 100);
  }, [user, authLoading, searchParams]);

  // Load from URL on mount
  useEffect(() => {
    const paramBusinessType = searchParams.get('businessType') as BusinessType;
    const paramCategory = searchParams.get('category') as Category;
    const paramPage = parseInt(searchParams.get('page') || '1');

    if (paramBusinessType && paramCategory) {
      setBusinessType(paramBusinessType);
      setCategory(paramCategory);
      setPage(paramPage);
      setStep(3);
    } else if (paramBusinessType) {
      setBusinessType(paramBusinessType);
      setStep(2);
    }
  }, [searchParams]);

  // Fetch templates when step 3 is reached
  useEffect(() => {
    if (step === 3 && businessType && category) {
      fetchTemplates();
    }
  }, [step, businessType, category, page]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/templates?businessType=${businessType}&category=${category}&page=${page}&limit=12`
      );
      const data: TemplatesResponse = await res.json();

      if (page === 1) {
        setTemplates(data.templates);
      } else {
        setTemplates(prev => [...prev, ...data.templates]);
      }

      setHasMore(data.hasMore);
      setTotalTemplates(data.total);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessType = (type: BusinessType) => {
    setBusinessType(type);
    setCategory(null);
    setStep(2);
    setPage(1);
    router.push(`/onboarding?businessType=${type}`);
  };

  const handleCategory = (cat: Category) => {
    setCategory(cat);
    setStep(3);
    setPage(1);
    router.push(`/onboarding?businessType=${businessType}&category=${cat}&page=1`);
  };

  const handleAiSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!aiPrompt.trim() || aiLoading) return;

    // If not authenticated, store prompt and redirect to signup/login first
    if (!user) {
      sessionStorage.setItem('keystoneAiOnboardingPrompt', aiPrompt.trim());
      router.push('/signup?aiOnboarding=true');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      // Create a site with the airy template (lightweight default for AI-generated sites)
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          selectedTemplateId: 'airy_general',
          businessType: 'services',
          category: 'general',
          userId: user.id,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403 && errData.siteLimitReached) {
          setShowSiteLimit(true);
        } else if (res.status === 401) {
          // Session expired — store prompt and redirect to signin
          sessionStorage.setItem('keystoneAiOnboardingPrompt', aiPrompt.trim());
          router.push('/signin?aiOnboarding=true');
        } else {
          console.error('[Onboarding] AI site creation failed', {
            status: res.status,
            statusText: res.statusText,
            url: res.url,
            error: errData?.error,
            details: errData,
            userId: user.id,
          });
          setAiError('Something went wrong creating your site. Please try again.');
        }
        setAiLoading(false);
        return;
      }

      const resData = await res.json();
      const { siteId } = resData;
      if (!siteId) {
        console.error('[Onboarding] No siteId returned from /api/sites', { response: resData, userId: user.id });
        setAiError('Something went wrong creating your site. Please try again.');
        setAiLoading(false);
        return;
      }

      // Store the AI prompt in sessionStorage so the editor can pick it up
      sessionStorage.setItem('keystoneAiOnboardingPrompt', aiPrompt.trim());

      router.push(`/editor?siteId=${siteId}`);
    } catch (error) {
      console.error('[Onboarding] Network or unexpected error creating AI site:', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      setAiError('Something went wrong creating your site. Please try again.');
      setAiLoading(false);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    try {
      // Create a new site with selected template
      // If user is authenticated, site is immediately owned by them
      // If not authenticated, userId is null and can be claimed later on first save
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          selectedTemplateId: templateId,
          businessType: (businessType as any) === 'service' ? 'services' : (businessType as any) === 'product' ? 'products' : businessType,
          category,
          userId: user?.id || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403 && errData.siteLimitReached) {
          setShowSiteLimit(true);
        } else {
          console.error('[Onboarding] Template site creation failed', {
            status: res.status,
            statusText: res.statusText,
            url: res.url,
            error: errData?.error,
            details: errData,
            templateId,
            userId: user?.id ?? 'unauthenticated',
          });
        }
        return;
      }

      const resData = await res.json();
      const { siteId } = resData;
      if (!siteId) {
        console.error('[Onboarding] No siteId returned from /api/sites for template', { response: resData, templateId, userId: user?.id ?? 'unauthenticated' });
        return;
      }

      if (user) {
        // Authenticated — go straight to editor
        router.push(`/editor?siteId=${siteId}`);
      } else {
        // Not authenticated — redirect to signup with siteId so they come back to the editor after
        router.push(`/signup?siteId=${siteId}`);
      }
    } catch (error) {
      console.error('[Onboarding] Network or unexpected error creating template site:', error instanceof Error ? { message: error.message, stack: error.stack } : error);
    }
  };

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    router.push(`/onboarding?businessType=${businessType}&category=${category}&page=${page + 1}`);
  };

  const handleBack = () => {
    if (step === 3) {
      setCategory(null);
      setStep(2);
      router.push(`/onboarding?businessType=${businessType}`);
    } else if (step === 2) {
      setBusinessType(null);
      setStep(1);
      router.push(`/onboarding`);
    }
  };

  const categories = businessType ? CATEGORIES[businessType as Exclude<BusinessType, null>] : [];

  return (
    <div className="min-h-screen bg-white">
      {showSiteLimit && <SiteLimitModal onDismiss={() => setShowSiteLimit(false)} />}

      {/* Header */}
      <Header />

      {/* Progress Section */}
      <div className="border-b border-slate-200 bg-white pt-20 pb-4">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Step {step} of 3
            </h2>
            {step > 1 && (
              <button
                onClick={handleBack}
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                ← Back
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Welcome Back Screen - Show if authenticated with existing sites */}
      {!checkingSites && showWelcomeBack && user && userSites.length > 0 && (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="mb-6">
              <p className="text-4xl mb-2">👋</p>
              <h1 className="text-3xl font-bold text-slate-900">Welcome Back!</h1>
            </div>

            <p className="text-slate-600 mb-2">
              You have <strong>{userSites.length}</strong> site{userSites.length !== 1 ? 's' : ''} in progress.
            </p>

            <div className="space-y-3 mt-8">
              <button
                onClick={() => router.push('/editor')}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
              >
                Continue Editing
              </button>

              <button
                onClick={() => {
                  setShowWelcomeBack(false);
                  setStep(1);
                  setBusinessType(null);
                  setCategory(null);
                  router.push('/onboarding');
                }}
                className="w-full px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
              >
                Create New Site
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-6">
              Or manage your sites in the editor
            </p>
          </div>
        </div>
      )}

      {/* Loading state while checking for sites */}
      {checkingSites && (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
          <div className="text-white text-center">
            <p className="mb-4">Loading...</p>
          </div>
        </div>
      )}

      {/* Regular Onboarding - only show if not showing welcome back screen */}
      {!checkingSites && !showWelcomeBack && (
        <>
          {/* Continue Editing (for all users) */}
          {user && userSites.length > 0 && (
            <div className="bg-blue-50 border-b border-blue-200">
              <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                <p className="text-sm text-blue-900">
                  Welcome back! You have {userSites.length} site{userSites.length !== 1 ? 's' : ''} in progress.
                </p>
                <button
                  onClick={() => router.push('/editor')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  Continue Editing
                </button>
              </div>
            </div>
          )}

          {/* Returning User (Not Logged In) - Sign In Prompt */}
          {!user && (
            <div className="bg-blue-50 border-b border-blue-200">
              <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                <span className="text-slate-500 font-medium">
                  Already have an account?<span className="hidden sm:inline"> Sign in to continue your work.</span>
                </span>
                <button
                  onClick={() => router.push('/signin')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  Sign In
                </button>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
            {/* Step 1: AI Builder + Business Type */}
            {step === 1 && (
              <div className="animate-fade-in">
                {/* AI Site Builder Section */}
                <div className="max-w-2xl mx-auto mb-12">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 text-sm font-bold mb-4">
                      <Sparkles className="w-4 h-4" />
                      AI-Powered
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 mb-4">
                      Describe Your Dream Website
                    </h1>
                    <p className="text-xl text-slate-600 max-w-xl mx-auto">
                      Tell our AI what kind of site you need and we'll build it for you instantly
                    </p>
                  </div>

                  <form onSubmit={handleAiSubmit} className="relative">
                    <div className="bg-white rounded-2xl border-2 border-slate-200 hover:border-violet-300 focus-within:border-violet-500 shadow-lg transition-all p-1">
                      <textarea
                        ref={aiInputRef}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value.slice(0, 500))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAiSubmit();
                          }
                        }}
                        placeholder="e.g. A modern plumbing business website with a hero section, services grid, testimonials, and contact form..."
                        rows={3}
                        className="w-full resize-none bg-transparent px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none text-base"
                      />
                      <div className="flex items-center justify-between px-3 pb-2">
                        <span className={`text-xs ${aiPrompt.length >= 500 ? 'text-red-500' : 'text-slate-400'}`}>
                          {aiPrompt.length}/500
                        </span>
                        <button
                          type="submit"
                          disabled={!aiPrompt.trim() || aiLoading}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm disabled:opacity-40 hover:brightness-110 transition-all flex items-center gap-2 shadow-md"
                        >
                          {aiLoading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Building...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Build My Site
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  {aiError && (
                    <p className="mt-3 text-sm text-red-600 text-center">{aiError}</p>
                  )}
                </div>

                {/* OR Divider */}
                <div className="flex items-center gap-4 max-w-2xl mx-auto mb-12">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">or pick a template</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Business Type Selection */}
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-black text-slate-900 mb-2">
                    What Do You Do?
                  </h2>
                  <p className="text-lg text-slate-600">
                    Tell us about your business so we can find the perfect template
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                  {BUSINESS_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => handleBusinessType(type.id as BusinessType)}
                      className="p-8 border-2 border-slate-200 rounded-lg hover:border-red-600 hover:shadow-lg transition-all text-left group"
                    >
                      <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">
                        {type.icon}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{type.label}</h3>
                      <p className="text-sm text-slate-600">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Category */}
            {step === 2 && (
              <div className="animate-fade-in">
                <h1 className="text-5xl font-black text-slate-900 mb-4 text-center">
                  Tell Us More
                </h1>
                <p className="text-xl text-slate-600 mb-16 text-center max-w-2xl mx-auto">
                  {businessType === 'portfolio' ? 'What best describes your creative work?' :
                   businessType === 'nonprofit' ? 'What kind of organization are you?' :
                   businessType === 'other' ? 'What best describes your website?' :
                   `What type of ${businessType} business are you?`}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategory(cat.id)}
                      className="p-6 border-2 border-slate-200 rounded-lg hover:border-red-600 hover:shadow-lg transition-all text-left group"
                    >
                      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                        {cat.icon}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-1">{cat.label}</h3>
                      <p className="text-xs text-slate-600">{cat.example}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Templates */}
            {step === 3 && (
              <div className="animate-fade-in">
                <h1 className="text-5xl font-black text-slate-900 mb-4 text-center">
                  Pick Your Template
                </h1>
                <p className="text-xl text-slate-600 mb-4 text-center max-w-2xl mx-auto">
                  {totalTemplates} templates available for {category}
                </p>

                {loading && templates.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                    <p className="mt-4 text-slate-600">Loading templates...</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                      {templates.map(template => (
                        <div
                          key={template.id}
                          className="border-2 border-slate-200 rounded-lg overflow-hidden hover:border-red-600 transition-all group cursor-pointer"
                        >
                          {/* Template Preview Image - vertical on mobile, horizontal on desktop */}
                          <div className="relative w-full bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden h-72 md:h-48">
                            <img
                              src={template.imageUrl}
                              alt={template.name}
                              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform"
                            />
                          </div>

                          {/* Template Info */}
                          <div className="p-4">
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{template.name}</h3>
                            <div className="flex flex-wrap gap-1 mb-4">
                              {template.tags.map(tag => {
                                const isStyle = ['Luxe', 'Vivid', 'Airy', 'Edge', 'Classic', 'Organic', 'Sleek', 'Vibrant', 'Bold', 'Elegant', 'Starter'].includes(tag);
                                return (
                                  <span
                                    key={tag}
                                    className={`text-xs px-2 py-1 rounded ${
                                      isStyle
                                        ? 'bg-red-50 text-red-700 font-semibold'
                                        : tag === 'Shop' || tag === 'Booking'
                                          ? 'bg-blue-50 text-blue-700'
                                          : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {tag}
                                  </span>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => handleSelectTemplate(template.id)}
                              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-colors"
                            >
                              Use This Template
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Load More */}
                    {hasMore && (
                      <div className="text-center">
                        <button
                          onClick={handleLoadMore}
                          disabled={loading}
                          className="px-8 py-3 border-2 border-red-600 text-red-600 hover:bg-red-50 font-bold rounded-lg disabled:opacity-50 transition-colors"
                        >
                          {loading ? 'Loading...' : 'Load More Templates'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
