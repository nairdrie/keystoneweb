'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, ChevronRight, Save, Eye, EyeOff, RotateCcw } from 'lucide-react';

interface EmailOverrides {
    subject?: string;
    heading?: string;
    subheading?: string;
    footerText?: string;
}

interface EmailConfig {
    key: string;
    label: string;
    description: string;
    defaultSubject: string;
    defaultHeading: string;
    defaultSubheading: string;
    defaultFooter: string;
}

const BOOKING_EMAILS: EmailConfig[] = [
    {
        key: 'booking_confirmed',
        label: 'Booking Confirmed',
        description: 'Sent to customers when they book an appointment (stripe, free, or pay-at-door).',
        defaultSubject: 'Booking Confirmed — [service name]',
        defaultHeading: 'Booking Confirmed',
        defaultSubheading: 'We look forward to seeing you!',
        defaultFooter: 'Powered by Keystone Web Design',
    },
    {
        key: 'booking_payment_confirmed',
        label: 'Payment Received',
        description: 'Sent when you mark an e-transfer booking as paid and confirmed.',
        defaultSubject: 'Booking Confirmed — [service name]',
        defaultHeading: 'Payment Received — Booking Confirmed',
        defaultSubheading: '',
        defaultFooter: 'Powered by Keystone Web Design',
    },
    {
        key: 'booking_cancelled',
        label: 'Booking Cancelled',
        description: 'Sent to customers when a booking is cancelled (by them or by you).',
        defaultSubject: 'Booking Cancelled — [service name]',
        defaultHeading: 'Booking Cancelled',
        defaultSubheading: 'Your appointment has been cancelled.',
        defaultFooter: 'Powered by Keystone Web Design',
    },
];

interface Props {
    siteId: string;
    logoUrl?: string;
}

export default function BookingAutomatedEmailsPanel({ siteId, logoUrl }: Props) {
    const [customizations, setCustomizations] = useState<Record<string, EmailOverrides>>({});
    const [selected, setSelected] = useState<string>(BOOKING_EMAILS[0].key);
    const [draft, setDraft] = useState<EmailOverrides>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/ecommerce/email-customizations?siteId=${siteId}`)
            .then(r => r.json())
            .then(data => {
                const map: Record<string, EmailOverrides> = {};
                for (const row of data.customizations || []) {
                    map[row.email_key] = row.overrides || {};
                }
                setCustomizations(map);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [siteId]);

    useEffect(() => {
        setDraft(customizations[selected] || {});
        setShowPreview(false);
    }, [selected, customizations]);

    const config = BOOKING_EMAILS.find(e => e.key === selected)!;

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/ecommerce/email-customizations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, emailKey: selected, overrides: draft }),
            });
            if (res.ok) {
                setCustomizations(prev => ({ ...prev, [selected]: draft }));
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch {}
        setSaving(false);
    }, [siteId, selected, draft]);

    const handleReset = () => {
        setDraft({});
    };

    const isModified = JSON.stringify(draft) !== JSON.stringify(customizations[selected] || {});
    const hasAnyOverride = Object.values(draft).some(v => v && v.trim() !== '');

    const previewHtml = buildPreviewHtml(config, draft, logoUrl);

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
                <div className="text-sm text-slate-500">Loading email settings…</div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Automated Emails</h3>
            </div>

            <div className="flex divide-x divide-slate-200" style={{ minHeight: 440 }}>
                {/* Sidebar */}
                <div className="w-52 shrink-0 bg-slate-50 py-2">
                    {BOOKING_EMAILS.map(email => {
                        const hasOverrides = Object.values(customizations[email.key] || {}).some(v => v && v.trim() !== '');
                        return (
                            <button
                                key={email.key}
                                onClick={() => setSelected(email.key)}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                                    selected === email.key
                                        ? 'bg-white text-slate-900 font-semibold border-r-2 border-slate-900'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                                }`}
                            >
                                <span className="truncate">{email.label}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    {hasOverrides && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Customized" />
                                    )}
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Editor */}
                <div className="flex-1 flex flex-col">
                    <div className="px-5 pt-5 pb-4 flex-1">
                        <div className="mb-4">
                            <h4 className="text-sm font-bold text-slate-900">{config.label}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
                        </div>

                        <div className="space-y-4">
                            <Field
                                label="Subject Line"
                                placeholder={config.defaultSubject}
                                value={draft.subject || ''}
                                onChange={v => setDraft(d => ({ ...d, subject: v }))}
                                hint="Leave blank to use the default."
                            />
                            <Field
                                label="Heading"
                                placeholder={config.defaultHeading}
                                value={draft.heading || ''}
                                onChange={v => setDraft(d => ({ ...d, heading: v }))}
                            />
                            <Field
                                label="Subheading"
                                placeholder={config.defaultSubheading}
                                value={draft.subheading || ''}
                                onChange={v => setDraft(d => ({ ...d, subheading: v }))}
                            />
                            <Field
                                label="Footer Text"
                                placeholder={config.defaultFooter}
                                value={draft.footerText || ''}
                                onChange={v => setDraft(d => ({ ...d, footerText: v }))}
                                hint='Replaces "Powered by Keystone Web Design" at the bottom.'
                            />
                        </div>

                        {!logoUrl && (
                            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                                No logo uploaded for this site. Upload a logo in the site designer to show your brand in email headers.
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-3">
                        <button
                            onClick={() => setShowPreview(v => !v)}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                        >
                            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {showPreview ? 'Hide preview' : 'Show preview'}
                        </button>

                        <div className="flex items-center gap-2">
                            {hasAnyOverride && (
                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    Reset to defaults
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving || !isModified}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                    saved
                                        ? 'bg-green-600 text-white'
                                        : isModified
                                        ? 'bg-slate-900 text-white hover:bg-slate-700'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                <Save className="w-3.5 h-3.5" />
                                {saved ? 'Saved!' : saving ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </div>

                    {/* Preview */}
                    {showPreview && (
                        <div className="border-t border-slate-200">
                            <div className="px-5 py-2 bg-slate-50 text-xs text-slate-500 font-medium">Email preview</div>
                            <div className="overflow-auto max-h-96">
                                <iframe
                                    srcDoc={previewHtml}
                                    className="w-full border-0"
                                    style={{ height: 400 }}
                                    title="Email preview"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Field({
    label,
    placeholder,
    value,
    onChange,
    hint,
}: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    hint?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white placeholder:text-slate-300"
            />
            {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
    );
}

function buildPreviewHtml(config: EmailConfig, overrides: EmailOverrides, logoUrl?: string): string {
    const heading = overrides.heading || config.defaultHeading;
    const subheading = overrides.subheading || config.defaultSubheading;
    const footer = overrides.footerText || config.defaultFooter;

    const iconHtml = logoUrl
        ? `<img src="${logoUrl}" alt="" style="max-height:64px;max-width:200px;object-fit:contain;display:block;margin:0 auto;" />`
        : `<div style="width:48px;height:48px;background:#dcfce7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:24px;">✅</div>`;

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:16px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="padding:24px 24px 16px;text-align:center;">
      ${iconHtml}
      <h1 style="margin:12px 0 4px;font-size:20px;color:#111827;">${escapeHtml(heading)}</h1>
      ${subheading ? `<p style="margin:0;color:#6b7280;font-size:14px;">${escapeHtml(subheading)}</p>` : ''}
    </div>
    <div style="padding:0 24px 16px;">
      <div style="background:#f9fafb;border-radius:8px;padding:16px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#6b7280;">Service</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;">Sample Service</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;">Wednesday, June 18, 2025</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;">10:00 AM</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Duration</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;">60 min</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Ref #</td><td style="padding:6px 0;text-align:right;font-weight:600;font-family:monospace;color:#111827;">A1B2C3D4</td></tr>
        </table>
      </div>
      <p style="margin-top:4px;font-size:12px;color:#9ca3af;text-align:center;">${escapeHtml(footer)}</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
