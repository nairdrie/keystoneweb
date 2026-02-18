'use client';

import Link from 'next/link';
import Header from '../components/Header';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-6xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-slate-900">
            Your Website,
            <br />
            <span className="text-red-600">
              Built in Minutes
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            No technical skills needed. Launch a professional website that turns visitors into customers. 
            Get online, look professional, grow your business—starting today.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/onboarding"
              className="px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-lg transition-all shadow-lg hover:shadow-xl group"
            >
              Create Your Website
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-lg transition-all"
            >
              See How It Works
            </Link>
          </div>

          {/* Stats Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-3xl blur-xl opacity-10" />
            <div className="relative bg-white rounded-3xl border border-slate-200 p-8 shadow-lg">
              <div className="grid grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl font-black text-red-600">5 min</div>
                  <p className="text-sm text-slate-600 mt-2 font-medium">To Launch</p>
                </div>
                <div>
                  <div className="text-4xl font-black text-red-600">$49</div>
                  <p className="text-sm text-slate-600 mt-2 font-medium">Per Month</p>
                </div>
                <div>
                  <div className="text-4xl font-black text-red-600">∞</div>
                  <p className="text-sm text-slate-600 mt-2 font-medium">Possibilities</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-5xl font-black text-slate-900 mb-4 text-center">Built for Your Success</h2>
          <p className="text-center text-slate-600 mb-16 max-w-2xl mx-auto text-lg">
            Everything you need to get online and start selling
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Lightning Fast Setup',
                description: 'Choose a template, add your info, go live. No waiting, no confusion.',
                icon: '⚡',
              },
              {
                title: 'Professional Design',
                description: 'Beautiful, modern templates that make you look like a big brand',
                icon: '✨',
              },
              {
                title: 'Mobile Ready',
                description: 'Your site looks perfect on phones, tablets, and computers',
                icon: '📱',
              },
              {
                title: 'Easy to Update',
                description: 'Change your content without learning code',
                icon: '✏️',
              },
              {
                title: 'Built for Growth',
                description: 'Scales with your business as you grow',
                icon: '📈',
              },
              {
                title: 'Affordable',
                description: 'No hidden fees, no surprises. Transparent pricing.',
                icon: '💰',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group relative bg-white rounded-2xl border border-slate-200 p-8 hover:border-red-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="relative">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-red-600">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-5xl font-black text-white mb-6">Your Website Awaits</h2>
          <p className="text-xl text-red-100 mb-12">
            Stop waiting. Get online today and start attracting customers tomorrow.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-10 py-5 rounded-full bg-white text-red-600 font-bold text-lg hover:bg-red-50 transition-all shadow-xl hover:shadow-2xl"
          >
            Start Your Free Website
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-4 sm:px-6 lg:px-8 text-center text-slate-600 text-sm bg-white">
        <p className="flex items-center justify-center gap-2">
          Proudly Canadian 🍁
        </p>
      </footer>
    </main>
  );
}
