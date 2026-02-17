'use client';

import { useState } from 'react';
import React from 'react';
import Link from 'next/link';

interface SetupPageProps {
  params: Promise<{
    template: string;
  }>;
}

export default function SetupPage(props: SetupPageProps) {
  const [siteName, setSiteName] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState('');

  // Handle async params in client component
  React.useEffect(() => {
    props.params.then(({ template: t }) => setTemplate(t));
  }, [props.params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate API call to create site
    console.log('Creating site:', { template, siteName, domain });
    
    // In a real app, you'd call an API here
    setTimeout(() => {
      setLoading(false);
      alert(`Site created! Visit: http://${domain}.local:3000`);
    }, 1000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <div className="mb-8">
          <Link
            href="/templates"
            className="text-blue-400 hover:text-blue-300 text-sm font-semibold"
          >
            ← Back to Templates
          </Link>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Setup Your {template.charAt(0).toUpperCase() + template.slice(1)} Site
          </h1>
          <p className="text-slate-400 mb-6">
            Fill in your site details below
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="siteName" className="block text-sm font-medium text-slate-300 mb-2">
                Site Name
              </label>
              <input
                type="text"
                id="siteName"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="My Awesome Business"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-slate-300 mb-2">
                Domain
              </label>
              <div className="flex">
                <input
                  type="text"
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.toLowerCase())}
                  placeholder="my-business"
                  className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-l text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  required
                />
                <span className="px-4 py-2 bg-slate-600 border border-slate-600 border-l-0 rounded-r text-slate-300">
                  .local
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                You can use your custom domain later
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-2 px-4 rounded transition-colors"
            >
              {loading ? 'Creating...' : 'Create Site'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
