import Link from 'next/link';

const TEMPLATES = [
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Perfect for restaurants, cafes, and food businesses',
    icon: '🍽️',
  },
  {
    id: 'barber',
    name: 'Barber Shop',
    description: 'For hair salons, barber shops, and beauty services',
    icon: '✂️',
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Showcase your work as a freelancer or creative professional',
    icon: '🎨',
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    description: 'Start selling online with a professional storefront',
    icon: '🛍️',
  },
  {
    id: 'service',
    name: 'Service Business',
    description: 'Perfect for plumbers, electricians, and service providers',
    icon: '🔧',
  },
  {
    id: 'blog',
    name: 'Blog',
    description: 'Share your thoughts with a clean, modern blog template',
    icon: '📝',
  },
];

export default function TemplatesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Choose Your Template</h1>
          <p className="text-xl text-slate-400">
            Select a professional template and start building your website
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEMPLATES.map((template) => (
            <div
              key={template.id}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 transition-all cursor-pointer group"
            >
              <div className="text-4xl mb-4">{template.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {template.name}
              </h3>
              <p className="text-slate-400 mb-4">{template.description}</p>
              <Link
                href={`/setup/${template.id}`}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors group-hover:shadow-lg"
              >
                Use Template →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
