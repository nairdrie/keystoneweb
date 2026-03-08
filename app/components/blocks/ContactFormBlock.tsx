'use client';

import { useState } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import { Send, Loader2, Settings, MessageSquare, Mail, User, Phone } from 'lucide-react';

interface ContactFormBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function ContactFormBlock({ id, data, isEditMode, palette, updateContent }: ContactFormBlockProps) {
    const context = useEditorContext();
    const siteId = context?.siteId;

    const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const title = data.title || 'Get in Touch';
    const description = data.description || 'We\'d love to hear from you. Please fill out the form below.';
    const successMessage = data.successMessage || 'Thank you for your message! We will get back to you shortly.';
    const submitText = data.submitText || 'Send Message';

    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#3b82f6';
    const pAccent = palette.accent || '#e5e7eb';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditMode) return; // Prevent submission in the editor
        if (!siteId) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    ...form
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to send message');
            }

            setSuccess(true);
            setForm({ name: '', email: '', phone: '', message: '' });
        } catch (err: any) {
            console.error('Contact form error:', err);
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (isEditMode) {
        return (
            <section className="relative group py-16 px-4" style={{ backgroundColor: '#ffffff' }}>
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded-lg shadow border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-2">
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-500">Contact Form Settings</span>
                    </div>

                    <div className="text-center space-y-4">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => updateContent('title', e.target.value)}
                            className="w-full text-center text-3xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors"
                            style={{ color: pPrimary }}
                            placeholder="Contact Form Title"
                        />
                        <textarea
                            value={description}
                            onChange={(e) => updateContent('description', e.target.value)}
                            className="w-full text-center text-lg bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                            style={{ color: '#4b5563' }}
                            placeholder="Description text"
                            rows={2}
                        />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 opacity-60 pointer-events-none">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <input type="text" disabled className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl" placeholder="John Doe" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <input type="email" disabled className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl" placeholder="john@example.com" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Phone Number (Optional)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <Phone className="h-5 w-5" />
                                </div>
                                <input type="tel" disabled className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl" placeholder="(555) 123-4567" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Message</label>
                            <div className="relative">
                                <div className="absolute top-3 left-3 pointer-events-none text-slate-400">
                                    <MessageSquare className="h-5 w-5" />
                                </div>
                                <textarea disabled className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl resize-none" rows={4} placeholder="How can we help you?" />
                            </div>
                        </div>

                        <button disabled className="w-full py-4 text-white font-semibold rounded-xl" style={{ backgroundColor: pSecondary }}>
                            <div className="flex items-center justify-center gap-2">
                                <Send className="w-5 h-5" />
                                {submitText}
                            </div>
                        </button>
                    </div>

                    <div className="border border-blue-100 bg-blue-50 p-4 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                            <Settings className="w-4 h-4" /> Message Customization
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Submit Button Text</label>
                            <input
                                type="text"
                                value={submitText}
                                onChange={(e) => updateContent('submitText', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                                placeholder="Send Message"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">Success Message</label>
                            <input
                                type="text"
                                value={successMessage}
                                onChange={(e) => updateContent('successMessage', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                                placeholder="Thank you for your message!"
                            />
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-20 px-4" style={{ backgroundColor: '#ffffff' }}>
            <div className="max-w-3xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h2 className="text-4xl md:text-5xl font-bold" style={{ color: pPrimary }}>
                        {title}
                    </h2>
                    <p className="text-lg md:text-xl max-w-2xl mx-auto" style={{ color: '#4b5563' }}>
                        {description}
                    </p>
                </div>

                {success ? (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Send className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-green-800">Message Sent!</h3>
                        <p className="text-green-700">{successMessage}</p>
                        <button
                            onClick={() => setSuccess(false)}
                            className="mt-6 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Send Another Message
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-white shadow-xl shadow-slate-200/50 border border-slate-100 rounded-2xl p-6 md:p-10 space-y-6">

                        {error && (
                            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                                        placeholder="john@example.com"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">Phone Number (Optional)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <Phone className="h-5 w-5" />
                                </div>
                                <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
                                    placeholder="(555) 123-4567"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">Message</label>
                            <div className="relative">
                                <div className="absolute top-3 left-3 pointer-events-none text-slate-400">
                                    <MessageSquare className="h-5 w-5" />
                                </div>
                                <textarea
                                    required
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all resize-none"
                                    rows={5}
                                    placeholder="How can we help you?"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
                            style={{ backgroundColor: pSecondary }}
                        >
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Send className="w-5 h-5" />
                                    {submitText}
                                </div>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </section>
    );
}
