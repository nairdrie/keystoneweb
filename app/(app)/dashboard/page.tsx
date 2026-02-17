import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700 bg-slate-800/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">CMS Platform</h1>
            <div className="flex gap-4">
              <Link
                href="/templates"
                className="text-slate-300 hover:text-white transition-colors"
              >
                Templates
              </Link>
              <Link
                href="/sites"
                className="text-slate-300 hover:text-white transition-colors"
              >
                My Sites
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-white mb-4">
            Create Your Website in Minutes
          </h2>
          <p className="text-xl text-slate-400 mb-8">
            Choose a template, customize your content, and get a custom domain.
          </p>
          <Link
            href="/templates"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          {[
            {
              title: 'Choose Template',
              description: 'Select from professionally designed templates for any industry',
            },
            {
              title: 'Customize Content',
              description: 'Fill in your business information, photos, and text easily',
            },
            {
              title: 'Get Custom Domain',
              description: 'Connect your own domain or use a platform subdomain',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-slate-800 p-6 rounded-lg border border-slate-700"
            >
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
