'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import Header from './Header';

type BusinessType = 'services' | 'products' | 'both' | null;
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
    id: 'both',
    label: 'Both',
    description: 'I do services AND sell products',
    icon: '🎯',
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
  both: [
    { id: 'agency', label: 'Agency', icon: '🏢' },
    { id: 'studio', label: 'Creative Studio', icon: '🎭' },
    { id: 'retail', label: 'Retail + Services', icon: '🏪' },
  ],
};

export default function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState<BusinessType>(null);
  const [category, setCategory] = useState<Category>(null);
  const [templates, setTemplates] = useState<TemplatePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalTemplates, setTotalTemplates] = useState(0);

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

  const handleSelectTemplate = async (templateId: string) => {
    try {
      // Create a new site with selected template
      // If user is authenticated, site is immediately owned by them
      // If not authenticated, userId is null and can be claimed later on first save
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedTemplateId: templateId,
          businessType,
          category,
          userId: user?.id || null, // Include userId if authenticated
        }),
      });
      
      const { siteId } = await res.json();
      router.push(`/editor?siteId=${siteId}`);
    } catch (error) {
      console.error('Failed to create site:', error);
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

      {/* Continue Editing (for all users) */}
      {user && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <p className="text-sm text-blue-900">
              Welcome back! You have unsaved designs waiting.
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
            <p className="text-sm text-blue-900">
              Already have an account? Sign in to continue your work.
            </p>
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
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
        {/* Step 1: Business Type */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="text-5xl font-black text-slate-900 mb-4 text-center">
              What Do You Do?
            </h1>
            <p className="text-xl text-slate-600 mb-16 text-center max-w-2xl mx-auto">
              Tell us about your business so we can find the perfect template
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              What type of {businessType} business are you?
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
                      {/* Template Preview Image */}
                      <div className="relative w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                        <img
                          src={template.imageUrl}
                          alt={template.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>

                      {/* Template Info */}
                      <div className="p-4">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">{template.name}</h3>
                        <div className="flex flex-wrap gap-1 mb-4">
                          {template.tags.map(tag => (
                            <span
                              key={tag}
                              className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded"
                            >
                              {tag}
                            </span>
                          ))}
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
    </div>
  );
}
