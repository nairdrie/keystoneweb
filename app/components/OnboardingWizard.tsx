'use client';

import { useState } from 'react';
import Link from 'next/link';
import KeystoneLogo from './KeystoneLogo';

type BusinessType = 'services' | 'products' | 'both' | null;
type Category = string | null;

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

const CATEGORIES: Record<BusinessType, any[]> = {
  services: [
    { id: 'handyman', label: 'Handyman', icon: '🔧' },
    { id: 'plumber', label: 'Plumber', icon: '🚰' },
    { id: 'electrical', label: 'Electrician', icon: '⚡' },
    { id: 'hvac', label: 'HVAC/Heating', icon: '🌡️' },
    { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
    { id: 'landscaping', label: 'Landscaping', icon: '🌿' },
    { id: 'consulting', label: 'Consulting', icon: '💼' },
    { id: 'freelance', label: 'Freelancer', icon: '💻' },
    { id: 'salon', label: 'Salon/Spa', icon: '💅' },
    { id: 'fitness', label: 'Fitness/Coaching', icon: '💪' },
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
  null: [],
};

const TEMPLATES = {
  handyman: [
    { id: 'modern-service', name: 'Modern Service', description: 'Clean, professional look' },
    { id: 'gallery-service', name: 'Gallery Service', description: 'Showcase your work' },
    { id: 'booking-service', name: 'Booking Service', description: 'Built-in scheduling' },
  ],
  plumber: [
    { id: 'emergency-service', name: 'Emergency Response', description: '24/7 availability' },
    { id: 'service-pro', name: 'Service Pro', description: 'Professional & trustworthy' },
  ],
  electrical: [
    { id: 'industrial-service', name: 'Industrial Service', description: 'Professional grade' },
    { id: 'modern-service', name: 'Modern Service', description: 'Clean, modern design' },
  ],
  ecommerce: [
    { id: 'shop-modern', name: 'Modern Shop', description: 'Sleek online store' },
    { id: 'shop-premium', name: 'Premium Shop', description: 'Luxury brand feel' },
  ],
  default: [
    { id: 'template-1', name: 'Professional', description: 'Timeless & trustworthy' },
    { id: 'template-2', name: 'Creative', description: 'Modern & eye-catching' },
    { id: 'template-3', name: 'Minimal', description: 'Clean & simple' },
  ],
};

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState<BusinessType>(null);
  const [category, setCategory] = useState<Category>(null);

  const handleBusinessType = (type: BusinessType) => {
    setBusinessType(type);
    setCategory(null);
    setStep(2);
  };

  const handleCategory = (cat: Category) => {
    setCategory(cat);
    setStep(3);
  };

  const handleBack = () => {
    if (step === 3) {
      setCategory(null);
      setStep(2);
    } else if (step === 2) {
      setBusinessType(null);
      setStep(1);
    }
  };

  const categories = businessType ? CATEGORIES[businessType] : [];
  const templates = category
    ? TEMPLATES[category as keyof typeof TEMPLATES] || TEMPLATES.default
    : TEMPLATES.default;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black">
      {/* Header */}
      <div className="border-b border-white/5 bg-gradient-to-b from-slate-950/80 to-slate-950/0 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-8">
            <KeystoneLogo />
            <div className="text-sm text-slate-400">
              Step {step} of 3
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-cyan-500 transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20">
        {/* Step 1: Business Type */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="text-5xl font-black text-white mb-4 text-center">
              What Do You Do?
            </h1>
            <p className="text-xl text-slate-400 mb-16 text-center max-w-2xl mx-auto">
              Tell us about your business so we can find the perfect template
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {BUSINESS_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleBusinessType(type.id as BusinessType)}
                  className="group relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 hover:bg-white/10 hover:border-blue-500/50 transition-all duration-300 text-left"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity" />
                  <div className="relative">
                    <div className="text-5xl mb-4">{type.icon}</div>
                    <h3 className="text-2xl font-bold text-white mb-2">{type.label}</h3>
                    <p className="text-slate-400">{type.description}</p>
                    <div className="mt-6 text-blue-400 font-semibold group-hover:translate-x-1 transition-transform">
                      Choose →
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Category */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h1 className="text-5xl font-black text-white mb-4 text-center">
              What's Your Specialty?
            </h1>
            <p className="text-xl text-slate-400 mb-16 text-center max-w-2xl mx-auto">
              Pick the one that matches your business
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategory(cat.id)}
                  className="group relative bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6 hover:bg-white/10 hover:border-blue-500/50 transition-all duration-300 text-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity" />
                  <div className="relative">
                    <div className="text-4xl mb-3">{cat.icon}</div>
                    <h3 className="text-sm font-bold text-white">{cat.label}</h3>
                    <div className="mt-3 text-blue-400 text-xs font-semibold group-hover:scale-110 transition-transform">
                      Select
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Back Button */}
            <div className="flex justify-center mt-12">
              <button
                onClick={handleBack}
                className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Template Selection */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h1 className="text-5xl font-black text-white mb-4 text-center">
              Pick Your Template
            </h1>
            <p className="text-xl text-slate-400 mb-16 text-center max-w-2xl mx-auto">
              Choose a starting point for your website
            </p>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="group relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 hover:bg-white/10 hover:border-blue-500/50 transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity" />
                  <div className="relative">
                    {/* Template Preview */}
                    <div className="w-full h-40 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg mb-6 flex items-center justify-center border border-white/10 group-hover:border-blue-500/30 transition-colors">
                      <div className="text-6xl">
                        {template.id === 'modern-service' && '✨'}
                        {template.id === 'gallery-service' && '🖼️'}
                        {template.id === 'booking-service' && '📅'}
                        {template.id === 'emergency-service' && '🚨'}
                        {template.id === 'service-pro' && '⭐'}
                        {template.id === 'industrial-service' && '🏗️'}
                        {template.id === 'shop-modern' && '🛍️'}
                        {template.id === 'shop-premium' && '💎'}
                        {template.id === 'template-1' && '📊'}
                        {template.id === 'template-2' && '🎨'}
                        {template.id === 'template-3' && '⚪'}
                      </div>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">{template.name}</h3>
                    <p className="text-slate-400 mb-6">{template.description}</p>

                    <Link
                      href={`/setup/${template.id}`}
                      className="inline-block w-full px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-center hover:from-blue-600 hover:to-blue-700 transition-all group-hover:shadow-lg group-hover:shadow-blue-500/50"
                    >
                      Use This Template
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Back Button */}
            <div className="flex justify-center">
              <button
                onClick={handleBack}
                className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
