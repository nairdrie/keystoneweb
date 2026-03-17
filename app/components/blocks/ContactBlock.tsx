'use client';

import React from 'react';
import EditableText from '../EditableText';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';

interface ContactBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function ContactBlock({ id, data, isEditMode, palette, updateContent }: ContactBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';

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
                    className="text-lg text-gray-500 text-center mb-16 max-w-2xl mx-auto"
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
            </div>
        </section>
    );
}
