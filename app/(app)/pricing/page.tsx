'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Check } from 'lucide-react';
import Header from '../../components/Header';
import AnimatedGridPattern from '../../components/AnimatedGridPattern';

export default function PricingPage() {
    return (
        <main className="min-h-screen bg-white relative overflow-hidden">
            <Header />
            <AnimatedGridPattern />

            {/* Decorative Blur */}
            <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-100 rounded-full blur-[100px] opacity-50 -z-10" />

            <section className="pt-40 pb-20 px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-4xl text-center mb-16">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight"
                    >
                        Simple, Transparent <span className="text-red-600">Pricing</span>.
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-xl text-slate-600 max-w-2xl mx-auto"
                    >
                        Start building your dream website today. Upgrade only when you need dedicated expert support.
                    </motion.p>
                </div>

                <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">

                    {/* Basic Plan */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl relative"
                    >
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Basic Plan</h3>
                        <p className="text-slate-500 mb-6">Perfect for small businesses getting started.</p>
                        <div className="mb-8">
                            <span className="text-5xl font-black text-slate-900">$29</span>
                            <span className="text-slate-500 font-medium">/month</span>
                        </div>

                        <ul className="space-y-4 mb-8">
                            {[
                                'Unlimited Site Pages',
                                'Access to all Premium Templates',
                                'Drag-and-Drop Visual Editor',
                                'Custom Domain Hosting',
                                'Standard Email Support',
                            ].map((feature) => (
                                <li key={feature} className="flex items-center gap-3 text-slate-700">
                                    <Check className="w-5 h-5 text-red-500 shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Link
                            href="/onboarding"
                            className="block w-full py-4 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-center transition-colors"
                        >
                            Start Free Trial
                        </Link>
                    </motion.div>

                    {/* Pro Plan */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative"
                    >
                        {/* Badge */}
                        <div className="absolute top-0 right-8 -translate-y-1/2 bg-red-600 outline outline-4 outline-white text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                            Most Popular
                        </div>

                        <h3 className="text-2xl font-bold text-white mb-2">Pro Plan</h3>
                        <p className="text-slate-400 mb-6">For growing brands that need round-the-clock priority backing.</p>
                        <div className="mb-8">
                            <span className="text-5xl font-black text-white">$99</span>
                            <span className="text-slate-400 font-medium">/month</span>
                        </div>

                        <ul className="space-y-4 mb-8">
                            {[
                                'Everything in Basic',
                                '24/7 Priority Phone & Email Support',
                                'Dedicated Account Manager',
                                'Advanced SEO Tools',
                                'Custom CSS Injection',
                            ].map((feature) => (
                                <li key={feature} className="flex items-center gap-3 text-slate-300">
                                    <Check className="w-5 h-5 text-red-500 shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Link
                            href="/onboarding"
                            className="block w-full py-4 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-center transition-colors shadow-lg hover:shadow-red-600/25"
                        >
                            Get Pro
                        </Link>
                    </motion.div>

                </div>
            </section>
        </main>
    );
}
