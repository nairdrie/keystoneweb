'use client';

import React, { useState } from 'react';
import EditableText from '../EditableText';
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter, Linkedin, Youtube, X } from 'lucide-react';

interface ContactBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

const SOCIAL_LINKS = [
    { key: 'facebookUrl', icon: Facebook, label: 'Facebook' },
    { key: 'instagramUrl', icon: Instagram, label: 'Instagram' },
    { key: 'twitterUrl', icon: Twitter, label: 'Twitter / X' },
    { key: 'linkedinUrl', icon: Linkedin, label: 'LinkedIn' },
    { key: 'youtubeUrl', icon: Youtube, label: 'YouTube' },
    { key: 'xUrl', icon: X, label: 'X (new)' },
] as const;

export default function ContactBlock({ id, data, isEditMode, palette, updateContent }: ContactBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';

    const [editingSocial, setEditingSocial] = useState<string | null>(null);
    const [socialDraft, setSocialDraft] = useState('');

    const contactItems = [
        { icon: Phone, key: 'phone', defaultValue: '(555) 123-4567', label: 'Phone' },
        { icon: Mail, key: 'email', defaultValue: 'hello@yourbusiness.ca', label: 'Email' },
        { icon: MapPin, key: 'address', defaultValue: '123 Main Street, Suite 100, Your City, ST 12345', label: 'Address' },
        { icon: Clock, key: 'hours', defaultValue: 'Mon–Fri: 8am–6pm | Sat: 9am–2pm', label: 'Hours' },
    ];

    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || pAccent }}>
            <div className="max-w-5xl mx-auto px-4">
                <EditableText
                    as="h2"
                    contentKey="title"
                    content={data.title}
                    defaultValue="Get In Touch"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold text-center mb-4"
                    style={{ color: pPrimary }}
                />
                <EditableText
                    as="p"
                    contentKey="subtitle"
                    content={data.subtitle}
                    defaultValue="We'd love to hear from you. Reach out anytime."
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-center mb-16 max-w-2xl mx-auto"
                    style={{ color: pPrimary + 'b3' }}
                />

                <div className="grid md:grid-cols-2 gap-6">
                    {contactItems.map((ci) => {
                        const Icon = ci.icon;
                        return (
                            <div
                                key={ci.key}
                                className="flex items-start gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div
                                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: pSecondary + '15', color: pSecondary }}
                                >
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">{ci.label}</p>
                                    <EditableText
                                        as="p"
                                        contentKey={ci.key}
                                        content={data[ci.key]}
                                        defaultValue={ci.defaultValue}
                                        isEditMode={isEditMode}
                                        onSave={(key, value) => updateContent(key, value)}
                                        className="text-gray-800 font-medium"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Social links */}
                {(() => {
                    const activeSocials = SOCIAL_LINKS.filter(s => data[s.key]);
                    if (!isEditMode && activeSocials.length === 0) return null;
                    return (
                        <div className="mt-10 flex flex-col items-center gap-4">
                            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: pPrimary + '80' }}>
                                Follow Us
                            </p>
                            <div className="flex items-center gap-3 flex-wrap justify-center">
                                {SOCIAL_LINKS.map(({ key, icon: Icon, label }) => {
                                    const url = data[key] as string | undefined;
                                    if (!isEditMode && !url) return null;

                                    if (isEditMode && editingSocial === key) {
                                        return (
                                            <form
                                                key={key}
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    updateContent(key, socialDraft.trim() || null);
                                                    setEditingSocial(null);
                                                }}
                                                className="flex items-center gap-1"
                                            >
                                                <input
                                                    autoFocus
                                                    type="url"
                                                    value={socialDraft}
                                                    onChange={e => setSocialDraft(e.target.value)}
                                                    placeholder={`https://...`}
                                                    className="text-xs border border-slate-300 rounded-lg px-2 py-1 w-44 outline-none focus:border-slate-500"
                                                />
                                                <button type="submit" className="text-xs font-semibold px-2 py-1 rounded-lg bg-slate-800 text-white">Save</button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        updateContent(key, null);
                                                        setEditingSocial(null);
                                                    }}
                                                    className="text-xs font-semibold px-2 py-1 rounded-lg bg-red-100 text-red-600"
                                                >
                                                    Remove
                                                </button>
                                            </form>
                                        );
                                    }

                                    const sharedClassName = `w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                        isEditMode
                                            ? url
                                                ? 'ring-2 ring-offset-1 cursor-pointer hover:scale-110'
                                                : 'opacity-30 hover:opacity-60 cursor-pointer hover:scale-110'
                                            : 'hover:scale-110 hover:opacity-80'
                                    }`;
                                    const sharedStyle = { backgroundColor: pSecondary + '15', color: pSecondary };

                                    if (!isEditMode && url) {
                                        return (
                                            <a
                                                key={key}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={label}
                                                className={sharedClassName}
                                                style={sharedStyle}
                                            >
                                                <Icon className="w-4 h-4" />
                                            </a>
                                        );
                                    }

                                    return (
                                        <button
                                            key={key}
                                            title={label}
                                            onClick={() => {
                                                setEditingSocial(key);
                                                setSocialDraft(url || '');
                                            }}
                                            className={sharedClassName}
                                            style={sharedStyle}
                                        >
                                            <Icon className="w-4 h-4" />
                                        </button>
                                    );
                                })}
                            </div>
                            {isEditMode && (
                                <p className="text-[11px] text-slate-400">Click an icon to add or edit its URL</p>
                            )}
                        </div>
                    );
                })()}
            </div>
        </section>
    );
}
