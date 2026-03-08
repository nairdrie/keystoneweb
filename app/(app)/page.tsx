'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, Layout, Smartphone, PenTool, TrendingUp, CircleDollarSign, Infinity } from 'lucide-react';
import Header from '../components/Header';
import mapleLeaf from '../../assets/maple-leaf.png';
import AnimatedGridPattern from '../components/AnimatedGridPattern';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <AnimatedGridPattern />

        <div className="mx-auto max-w-4xl text-center relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-6xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-black"
          >
            Your Website,
            <br />
            <span className="text-red-600">
              Built in Minutes
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="text-lg md:text-xl text-slate-900 mb-12 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            No technical skills needed. Launch a professional website that turns visitors into customers.
            Get online, look professional, grow your business—starting today.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
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
          </motion.div>

          {/* Stats Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-3xl blur-xl opacity-10" />
            <div className="relative bg-white rounded-3xl border border-slate-200 p-8 shadow-lg">
              <div className="grid grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl font-black text-red-600">5 min</div>
                  <p className="text-sm text-slate-900 mt-2 font-bold">To Launch</p>
                </div>
                <div>
                  <div className="text-4xl font-black text-red-600">$15</div>
                  <p className="text-sm text-slate-900 mt-2 font-bold">Per Month</p>
                </div>
                <div>
                  <div className="text-4xl font-black text-red-600 flex justify-center"><Infinity className="w-10 h-10" /></div>
                  <p className="text-sm text-slate-900 mt-2 font-bold">Possibilities</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl font-black text-black mb-4 text-center">Built for Your Success</h2>
            <p className="text-center text-slate-900 mb-16 max-w-2xl mx-auto text-lg font-medium">
              Everything you need to get online and start selling
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Lightning Fast Setup',
                description: 'Choose a template, add your info, go live. No waiting, no confusion.',
                icon: <Zap className="w-8 h-8 text-red-500" />,
              },
              {
                title: 'Professional Design',
                description: 'Beautiful, modern templates that make you look like a big brand',
                icon: <Layout className="w-8 h-8 text-blue-500" />,
              },
              {
                title: 'Mobile Ready',
                description: 'Your site looks perfect on phones, tablets, and computers',
                icon: <Smartphone className="w-8 h-8 text-emerald-500" />,
              },
              {
                title: 'Easy to Update',
                description: 'Change your content without learning code',
                icon: <PenTool className="w-8 h-8 text-amber-500" />,
              },
              {
                title: 'Built for Growth',
                description: 'Scales with your business as you grow',
                icon: <TrendingUp className="w-8 h-8 text-purple-500" />,
              },
              {
                title: 'Affordable',
                description: 'No hidden fees, no surprises. Transparent pricing.',
                icon: <CircleDollarSign className="w-8 h-8 text-green-600" />,
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative bg-white rounded-2xl border border-slate-200 p-8 hover:border-red-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="relative">
                  <div className="mb-6 bg-slate-50 w-14 h-14 rounded-xl flex items-center justify-center border border-slate-100 group-hover:scale-110 transition-transform">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-700">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-red-600 relative overflow-hidden">
        {/* Decorative background shapes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500 rounded-full blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-700 rounded-full blur-3xl opacity-50 -translate-x-1/2 translate-y-1/2" />

        <div className="mx-auto max-w-4xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl font-black text-white mb-6">Your Website Awaits</h2>
            <p className="text-xl text-red-100 mb-12">
              Stop waiting. Get online today and start attracting customers tomorrow.
            </p>
            <Link
              href="/onboarding"
              className="inline-block px-10 py-5 rounded-full bg-white text-red-600 font-bold text-lg hover:bg-red-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              Start Your Free Website
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-4 sm:px-6 lg:px-8 text-center text-slate-700 text-sm bg-white">
        <p className="flex items-center justify-center gap-2">
          Proudly Canadian <Image src={mapleLeaf} alt="Maple Leaf" className="w-5 h-5 object-contain" />
        </p>
      </footer>
    </main>
  );
}
