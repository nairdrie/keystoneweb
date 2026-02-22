'use client';

import EditableText from '@/app/components/EditableText';
import { useEditorContext } from '@/lib/editor-context';

export interface ClassicProPlumberProps {
  palette?: Record<string, string>;
  isEditMode?: boolean;
}

/**
 * Classic Pro - Professional Plumber Template
 * 
 * Features:
 * - Hero section with CTA
 * - Services grid
 * - About section
 * - Footer
 * 
 * Industry defaults:
 * - Title: "Expert Plumbing Services"
 * - Subtitle: "Fast, Reliable, Professional"
 */
export function ClassicProPlumber({
  palette = {
    primary: '#dc2626',
    secondary: '#1e40af',
    accent: '#06b6d4',
    text: '#1f2937',
    bg: '#ffffff',
  },
  isEditMode = false,
}: ClassicProPlumberProps) {
  // Use editor context to get current content and edit handlers
  const { content = {}, isEditMode: contextEditMode, updateContent } = useEditorContext() || {
    content: {},
    isEditMode: false,
    updateContent: () => {},
  };

  const actualEditMode = isEditMode || contextEditMode;

  // Plumbing-specific defaults
  const defaults = {
    heroTitle: 'Expert Plumbing Services',
    heroSubtitle: 'Fast, Reliable, Professional Solutions for Your Home',
    heroCTA: 'Get Free Quote',
    service1Title: 'Emergency Repairs',
    service1Desc: 'Available 24/7 for urgent plumbing issues',
    service2Title: 'Installation & Upgrades',
    service2Desc: 'Modern fixtures and efficient systems',
    service3Title: 'Maintenance & Prevention',
    service3Desc: 'Keep your plumbing in top condition',
    aboutTitle: 'About Our Service',
    aboutDesc: '20+ years of experience serving the community with honest, quality plumbing work.',
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: palette.bg,
        color: palette.text,
      }}
    >
      {/* Hero Section */}
      <section
        className="py-20 px-4 md:px-8 text-center"
        style={{ backgroundColor: palette.primary }}
      >
        <div className="max-w-4xl mx-auto">
          <EditableText
            as="h1"
            contentKey="heroTitle"
            content={content.heroTitle}
            defaultText={defaults.heroTitle}
            isEditMode={actualEditMode}
            onSave={(key, value) => updateContent(key, value)}
            className="text-4xl md:text-5xl font-bold mb-4 text-white"
          />
          
          <EditableText
            as="p"
            contentKey="heroSubtitle"
            content={content.heroSubtitle}
            defaultText={defaults.heroSubtitle}
            isEditMode={actualEditMode}
            onSave={(key, value) => updateContent(key, value)}
            className="text-xl text-white/90 mb-8"
          />

          <EditableText
            as="button"
            contentKey="heroCTA"
            content={content.heroCTA}
            defaultText={defaults.heroCTA}
            isEditMode={actualEditMode}
            onSave={(key, value) => updateContent(key, value)}
            className="px-8 py-3 rounded-lg font-bold text-white transition-transform hover:scale-105"
            style={{ backgroundColor: palette.secondary }}
          />
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Our Services</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Service 1 */}
            <div className="p-6 rounded-lg border-2" style={{ borderColor: palette.secondary }}>
              <EditableText
                as="h3"
                contentKey="service1Title"
                content={content.service1Title}
                defaultText={defaults.service1Title}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-xl font-bold mb-3"
              />
              <EditableText
                as="p"
                contentKey="service1Desc"
                content={content.service1Desc}
                defaultText={defaults.service1Desc}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
              />
            </div>

            {/* Service 2 */}
            <div className="p-6 rounded-lg border-2" style={{ borderColor: palette.secondary }}>
              <EditableText
                as="h3"
                contentKey="service2Title"
                content={content.service2Title}
                defaultText={defaults.service2Title}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-xl font-bold mb-3"
              />
              <EditableText
                as="p"
                contentKey="service2Desc"
                content={content.service2Desc}
                defaultText={defaults.service2Desc}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
              />
            </div>

            {/* Service 3 */}
            <div className="p-6 rounded-lg border-2" style={{ borderColor: palette.secondary }}>
              <EditableText
                as="h3"
                contentKey="service3Title"
                content={content.service3Title}
                defaultText={defaults.service3Title}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-xl font-bold mb-3"
              />
              <EditableText
                as="p"
                contentKey="service3Desc"
                content={content.service3Desc}
                defaultText={defaults.service3Desc}
                isEditMode={actualEditMode}
                onSave={(key, value) => updateContent(key, value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-4 md:px-8" style={{ backgroundColor: palette.secondary + '15' }}>
        <div className="max-w-4xl mx-auto text-center">
          <EditableText
            as="h2"
            contentKey="aboutTitle"
            content={content.aboutTitle}
            defaultText={defaults.aboutTitle}
            isEditMode={actualEditMode}
            onSave={(key, value) => updateContent(key, value)}
            className="text-3xl font-bold mb-6"
          />
          
          <EditableText
            as="p"
            contentKey="aboutDesc"
            content={content.aboutDesc}
            defaultText={defaults.aboutDesc}
            isEditMode={actualEditMode}
            onSave={(key, value) => updateContent(key, value)}
            className="text-lg"
          />
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 px-4 text-center text-white"
        style={{ backgroundColor: palette.primary }}
      >
        <p>© 2025 Your Plumbing Business. All rights reserved.</p>
      </footer>
    </div>
  );
}
