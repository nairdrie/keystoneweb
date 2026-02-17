'use client';

import Link from 'next/link';
import KeystoneLogo from '../components/KeystoneLogo';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-gradient-to-b from-slate-950/80 to-slate-950/0 backdrop-blur-xl border-b border-white/5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <KeystoneLogo />
          <div className="flex gap-6">
            <Link href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#templates" className="text-sm text-slate-400 hover:text-white transition-colors">
              Templates
            </Link>
            <Link href="/templates" className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-blue-500/50">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Gradient blur background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl opacity-30" />
            <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-30" />
          </div>

          <h1 className="text-7xl md:text-8xl font-black tracking-tighter mb-6 leading-tight">
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              Your Website,
            </span>
            <br />
            <span className="text-white">Built in Minutes</span>
          </h1>

          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            No technical skills needed. Launch a professional website that turns visitors into customers. 
            Get online, look professional, grow your business—starting today.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/templates"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-xl hover:shadow-blue-500/50 group"
            >
              Create Your Website
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white font-semibold hover:bg-white/20 transition-all"
            >
              See How It Works
            </Link>
          </div>

          {/* Floating card with glass effect */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="relative bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 p-8 shadow-2xl">
              <div className="grid grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl font-black bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">5 min</div>
                  <p className="text-sm text-slate-400 mt-2">To Launch</p>
                </div>
                <div>
                  <div className="text-4xl font-black bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">$49</div>
                  <p className="text-sm text-slate-400 mt-2">Per Month</p>
                </div>
                <div>
                  <div className="text-4xl font-black bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">∞</div>
                  <p className="text-sm text-slate-400 mt-2">Possibilities</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-5xl font-black text-white mb-4 text-center">Built for Your Success</h2>
          <p className="text-center text-slate-400 mb-16 max-w-2xl mx-auto">
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
                className="group relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity blur" />
                <div className="relative">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-5xl font-black text-white mb-6">Your Website Awaits</h2>
          <p className="text-xl text-slate-400 mb-12">
            Stop waiting. Get online today and start attracting customers tomorrow.
          </p>
          <Link
            href="/templates"
            className="inline-block px-10 py-5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-2xl hover:shadow-blue-500/50"
          >
            Start Your Free Website
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
        <p>© 2026 Keystone. Built with Next.js and TypeScript.</p>
      </footer>
    </main>
  );
}
