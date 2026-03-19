'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Hammer, CalendarClock, ShieldCheck, MapPin, Users, PhoneCall } from 'lucide-react';
import Header from '../../../components/Header';


export default function TradesIndustryPage() {
    return (
        <main className="min-h-screen bg-slate-50">
            <Header />

            {/* Hero Section */}
            <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-white">
                

                <div className="mx-auto max-w-4xl text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-700 font-bold text-sm mb-6 border border-amber-200 shadow-sm"
                    >
                        <Hammer className="w-4 h-4" />
                        Built for Plumbers, Electricians & Contractors
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight text-slate-900"
                    >
                        More Leads,
                        <br />
                        <span className="text-amber-600">
                            Less Downtime.
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                        className="text-lg md:text-xl text-slate-700 mb-12 max-w-2xl mx-auto leading-relaxed"
                    >
                        Your trade business needs a website that works as hard as you do. Build a professional, mobile-friendly site that books more jobs and establishes unbeatable local trust.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                        className="flex justify-center"
                    >
                        <Link
                            href="/onboarding"
                            className="px-8 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 block sm:inline-block"
                        >
                            Get Booked Now
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-4xl font-black text-slate-900 mb-4">Tools of the Trade</h2>
                        <p className="text-slate-600 max-w-2xl mx-auto text-lg">
                            Everything the modern contractor needs to look professional online.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                title: 'One-Tap Calling',
                                description: 'Mobile-first design ensures clients can call you in an emergency with a single tap.',
                                icon: <PhoneCall className="w-8 h-8 text-red-500" />,
                            },
                            {
                                title: 'Review Showcases',
                                description: 'Display your best 5-star Google and Yelp reviews to instantly build trust with homeowners.',
                                icon: <ShieldCheck className="w-8 h-8 text-blue-500" />,
                            },
                            {
                                title: 'Local SEO Maps',
                                description: 'Integrated maps and local keywords help you dominate search results in your service area.',
                                icon: <MapPin className="w-8 h-8 text-emerald-600" />,
                            },
                            {
                                title: 'Quote Requests',
                                description: 'Easy-to-use forms so customers can submit photos and request estimates 24/7.',
                                icon: <CalendarClock className="w-8 h-8 text-amber-500" />,
                            },
                            {
                                title: 'Project Galleries',
                                description: 'Show off your before-and-after photos with beautiful image carousels.',
                                icon: <Users className="w-8 h-8 text-indigo-500" />,
                            },
                            {
                                title: 'Service Menus',
                                description: 'Clearly outline your specializations, pricing, and emergency availability.',
                                icon: <Hammer className="w-8 h-8 text-slate-800" />,
                            },
                        ].map((feature, i) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 hover:border-amber-400 transition-colors"
                            >
                                <div className="mb-6">{feature.icon}</div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

        </main>
    );
}
