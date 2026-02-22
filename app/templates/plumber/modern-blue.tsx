'use client';

import EditableText from '@/app/components/EditableText';
import { useEditorContext } from '@/lib/editor-context';

export interface ModernBluePlumberProps {
  palette?: Record<string, string>;
  isEditMode?: boolean;
}

/**
 * Modern Blue - Modern Plumber Template
 * 
 * Features:
 * - Sleek hero with gradient
 * - Feature cards with icons
 * - Contact section
 * - Testimonials area
 * 
 * Industry defaults:
 * - Title: "Plumbing Solutions for Modern Homes"
 * - Feature-rich layout
 */
export function ModernBluePlumber({
  palette = {
    primary: '#1e40af',
    secondary: '#0ea5e9',
    accent: '#f59e0b',
    text: '#0f172a',
    bg: '#f8fafc',
  },
  isEditMode = false,
}: ModernBluePlumberProps) {
  const { content = {}, isEditMode: contextEditMode, updateContent } = useEditorContext() || {
    content: {},
    isEditMode: false,
    updateContent: () => {},
  };

  const actualEditMode = isEditMode || contextEditMode;

  const defaults = {
    heroTitle: 'Plumbing Solutions for Modern Homes',
    heroSubtitle: 'Professional service. Modern technology. Your peace of mind.',
    heroCTA: 'Schedule Service',
    feature1Icon: '🔧',
    feature1Title: 'Expert Diagnosis',
    feature1Desc: 'Advanced tools to identify issues quickly',
    feature2Icon: '⚡',
    feature2Title: 'Fast Service',
    feature2Desc: 'Same-day emergency response available',
    feature3Icon: '✓',
    feature3Title: 'Guaranteed Work',
    feature3Desc: '100% satisfaction guarantee on all services',
    contactTitle: 'Ready to Fix Your Plumbing?',
    contactCTA: 'Contact Us Today',
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: palette.bg, color: palette.text }}
    >
      {/* Hero Section with Gradient */}
      <section
        className="py-24 px-4 md:px-8 text-white relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 100%)`,
        }}
      >
        <div className="max-w-5xl mx-auto relative z-10">
          <EditableText
            as="h1"
            contentKey="heroTitle"
            content={content.heroTitle}
            defaultText={defaults.heroTitle}
            isEditMode={actualEditMode}
            onSave={(key, value) => updateContent(key, value)}
            className="text-5xl md:text-6xl font-bold mb-6 leading-tight"
          />

          <EditableText
            as="p"
            contentKey="heroSubtitle"
            content={content.heroSubtitle}
            defaultText={defaults.heroSubtitle}
            isEditMode={actualEditMode}
            onSave={(key, value) => updateContent(key, value)}
            className="text-xl md:text-2xl mb-8 opacity-95"
          />

          <EditableText
            as="button"
            contentKey="heroCTA"
            content={content.heroCTA}
            defaultText={defaults.heroCTA}
            isEditMode={actualEditMode}
            onSave={(key, value) => updateContent(key, value)}
            className="px-8 py-4 rounded-lg font-bold text-lg transition-all hover:scale-105"
            style={{
              backgroundColor: palette.accent,
              color: palette.text,
            }}
          />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Why Choose Us</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">
                {content.feature1Icon || defaults.feature1Icon}
              </div>
              <EditableText
                as="h3"
                contentKey="feature1Title"
                content={content.feature1Title}
                defaultText={defaults.feature1Title}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-2xl font-bold mb-3"
              />
              <EditableText
                as="p"
                contentKey="feature1Desc"
                content={content.feature1Desc}
                defaultText={defaults.feature1Desc}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-gray-600"
              />
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">
                {content.feature2Icon || defaults.feature2Icon}
              </div>
              <EditableText
                as="h3"
                contentKey="feature2Title"
                content={content.feature2Title}
                defaultText={defaults.feature2Title}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-2xl font-bold mb-3"
              />
              <EditableText
                as="p"
                contentKey="feature2Desc"
                content={content.feature2Desc}
                defaultText={defaults.feature2Desc}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-gray-600"
              />
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">
                {content.feature3Icon || defaults.feature3Icon}
              </div>
              <EditableText
                as="h3"
                contentKey="feature3Title"
                content={content.feature3Title}
                defaultText={defaults.feature3Title}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-2xl font-bold mb-3"
              />
              <EditableText
                as="p"
                contentKey="feature3Desc"
                content={content.feature3Desc}
                defaultText={defaults.feature3Desc}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-gray-600"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        className="py-20 px-4 md:px-8 text-white text-center"
        style={{ backgroundColor: palette.primary }}
      >
        <div className="max-w-3xl mx-auto">
          <EditableText
            as="h2"
            contentKey="contactTitle"
            content={content.contactTitle}
            defaultText={defaults.contactTitle}
            isEditMode={actualEditMode}
            onSave={(key, value) => updateContent(key, value)}
            className="text-4xl font-bold mb-8"
          />

          <EditableText
            as="button"
            contentKey="contactCTA"
            content={content.contactCTA}
            defaultText={defaults.contactCTA}
            isEditMode={actualEditMode}
            onSave={(key, value) => updateContent(key, value)}
            className="px-10 py-4 rounded-lg font-bold text-lg transition-all hover:scale-105"
            style={{
              backgroundColor: palette.accent,
              color: palette.text,
            }}
          />
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 px-4 text-center"
        style={{
          backgroundColor: palette.primary,
          color: 'white',
        }}
      >
        <p>© 2025 Expert Plumbing Services. Licensed & Insured.</p>
      </footer>
    </div>
  );
}
