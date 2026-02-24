'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ShoppingBag, CreditCard, Box, Truck, BarChart3, Globe } from 'lucide-react';
import Header from '../../../components/Header';
import AnimatedGridPattern from '../../../components/AnimatedGridPattern';

export default function EcommerceIndustryPage() {
    return (
        <main className="min-h-screen bg-white">
            <Header />

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
                <AnimatedGridPattern />

                <div className="mx-auto max-w-4xl text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 text-red-600 font-bold text-sm mb-6 border border-red-100 shadow-sm"
                    >
                        <ShoppingBag className="w-4 h-4" />
                        Designed for Retail Brands
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-slate-900"
                    >
                        Open Your Store to the
                        <br />
                        <span className="text-red-600">
                            Entire World
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                        className="text-lg md:text-xl text-slate-700 mb-12 max-w-2xl mx-auto leading-relaxed"
                    >
                        Launch a stunning digital storefront in minutes. Sell products, manage inventory, and process payments securely without writing a single line of code.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                        className="flex justify-center"
                    >
                        <Link
                            href="/onboarding"
                            className="px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                        >
                            Start Selling Today
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
                <div className="mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-4xl font-black text-slate-900 mb-4">Everything You Need to Scale</h2>
                        <p className="text-slate-600 max-w-2xl mx-auto text-lg">
                            Our e-commerce templates are engineered for high-conversion and seamless customer experiences.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                title: 'Secure Checkouts',
                                description: 'Bank-level security for all transactions. Accept credit cards easily.',
                                icon: <CreditCard className="w-8 h-8 text-blue-500" />,
                            },
                            {
                                title: 'Beautiful Catalogs',
                                description: 'Showcase your products with gorgeous imagery and layout options.',
                                icon: <Box className="w-8 h-8 text-purple-500" />,
                            },
                            {
                                title: 'Global Reach',
                                description: 'Sell to anyone, anywhere. Reach international audiences effortlessly.',
                                icon: <Globe className="w-8 h-8 text-emerald-500" />,
                            },
                            {
                                title: 'Fulfillment Ready',
                                description: 'Easily track orders, managing shipments, and send notifications.',
                                icon: <Truck className="w-8 h-8 text-amber-500" />,
                            },
                            {
                                title: 'Sales Analytics',
                                description: 'Monitor your growth with built-in traffic and conversion reports.',
                                icon: <BarChart3 className="w-8 h-8 text-indigo-500" />,
                            },
                            {
                                title: 'Conversion Optimized',
                                description: 'Templates tested rigorously to ensure maximum sales velocity.',
                                icon: <ShoppingBag className="w-8 h-8 text-red-500" />,
                            },
                        ].map((feature, i) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="bg-slate-50 rounded-3xl p-8 hover:bg-white hover:shadow-xl hover:border-red-200 border border-transparent transition-all duration-300"
                            >
                                <div className="mb-6 bg-white w-14 h-14 rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">{feature.icon}</div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t-8 border-red-600 text-center">
                <h2 className="text-4xl font-black text-white mb-6">Ready to launch your empire?</h2>
                <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
                    Choose a template and turn your passion into profits in minutes.
                </p>
                <Link
                    href="/onboarding"
                    className="inline-block px-10 py-5 rounded-full bg-red-600 text-white font-bold text-lg hover:bg-red-700 transition-all shadow-2xl hover:shadow-red-500/50"
                >
                    Build Your Store
                </Link>
            </section>
        </main>
    );
}
