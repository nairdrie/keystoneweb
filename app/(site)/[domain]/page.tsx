import { getSiteData, getPageContent } from '@/lib/data';

interface ClientPageProps {
  params: {
    domain: string;
  };
}

/**
 * Render section based on type
 */
function renderSection(section: any, theme: any, index: number) {
  const sectionKey = `section-${index}`;

  switch (section.type) {
    case 'hero':
      return (
        <section
          key={sectionKey}
          className="py-20 px-4"
          style={{ backgroundColor: theme.backgroundColor }}
        >
          <div className="mx-auto max-w-4xl text-center">
            <h2
              className="text-5xl font-bold mb-4"
              style={{ color: theme.primaryColor }}
            >
              {section.title}
            </h2>
            <p
              className="text-xl"
              style={{ color: theme.accentColor }}
            >
              {section.content}
            </p>
          </div>
        </section>
      );

    case 'features':
      return (
        <section
          key={sectionKey}
          className="py-16 px-4"
          style={{
            backgroundColor: theme.backgroundColor,
            borderTop: `1px solid ${theme.accentColor}`,
          }}
        >
          <div className="mx-auto max-w-6xl">
            <h2
              className="text-3xl font-bold mb-12 text-center"
              style={{ color: theme.primaryColor }}
            >
              {section.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {section.items?.map((item: any, idx: number) => (
                <div
                  key={`feature-${idx}`}
                  className="p-6 rounded-lg border"
                  style={{
                    backgroundColor: `${theme.accentColor}15`,
                    borderColor: theme.accentColor,
                  }}
                >
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={{ color: theme.primaryColor }}
                  >
                    {item.title}
                  </h3>
                  <p style={{ color: theme.accentColor }}>
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case 'contact':
      return (
        <section
          key={sectionKey}
          className="py-16 px-4"
          style={{
            backgroundColor: theme.backgroundColor,
            borderTop: `1px solid ${theme.accentColor}`,
          }}
        >
          <div className="mx-auto max-w-4xl text-center">
            <h2
              className="text-3xl font-bold mb-6"
              style={{ color: theme.primaryColor }}
            >
              {section.title}
            </h2>
            <p
              className="text-lg"
              style={{ color: theme.accentColor }}
            >
              {section.content}
            </p>
          </div>
        </section>
      );

    case 'about':
      return (
        <section
          key={sectionKey}
          className="py-16 px-4"
          style={{
            backgroundColor: theme.backgroundColor,
            borderTop: `1px solid ${theme.accentColor}`,
          }}
        >
          <div className="mx-auto max-w-4xl">
            <h2
              className="text-3xl font-bold mb-6"
              style={{ color: theme.primaryColor }}
            >
              {section.title}
            </h2>
            <p
              className="text-lg leading-relaxed"
              style={{ color: theme.accentColor }}
            >
              {section.content}
            </p>
          </div>
        </section>
      );

    default:
      return null;
  }
}

export default async function ClientPage({ params }: ClientPageProps) {
  const site = await getSiteData(params.domain);
  const pageContent = await getPageContent(params.domain, '');

  if (!site || !pageContent) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p>Sorry, we couldn't find the content you're looking for.</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      {pageContent.sections.map((section, index) =>
        renderSection(section, site.theme, index)
      )}
    </main>
  );
}
