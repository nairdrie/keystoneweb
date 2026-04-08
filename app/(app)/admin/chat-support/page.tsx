'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageCircle, Save, Loader2, Settings, ToggleLeft, ToggleRight,
  Sparkles, Send, User, X, Bot, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useAdminContext } from '../admin-context';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatSettings {
  agent_name: string;
  welcome_message: string;
  contact_email: string;
  accent_color: string;
  position: 'bottom-right' | 'bottom-left';
  enabled: boolean;
  allow_general: boolean;
  allow_booking: boolean;
  allow_ecommerce: boolean;
  allow_faq: boolean;
}

interface TestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_SETTINGS: ChatSettings = {
  agent_name: 'Archie',
  welcome_message: 'Hi there! I\'m here to help. Ask me anything about our business.',
  contact_email: '',
  accent_color: '',
  position: 'bottom-right',
  enabled: true,
  allow_general: true,
  allow_booking: false,
  allow_ecommerce: false,
  allow_faq: true,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function ChatSupportAdminPage() {
  const { siteId, siteBlockTypes, palette, isProUser } = useAdminContext();

  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Test chat
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [testInput, setTestInput] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const testEndRef = useRef<HTMLDivElement>(null);

  const hasChatBlock = siteBlockTypes.has('chatSupport');

  // Load settings
  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/chat-support/settings?siteId=${siteId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setSettings({
            agent_name: data.agent_name || DEFAULT_SETTINGS.agent_name,
            welcome_message: data.welcome_message || DEFAULT_SETTINGS.welcome_message,
            contact_email: data.contact_email || '',
            accent_color: data.accent_color || '',
            position: data.position || 'bottom-right',
            enabled: data.enabled ?? true,
            allow_general: data.allow_general ?? true,
            allow_booking: data.allow_booking ?? false,
            allow_ecommerce: data.allow_ecommerce ?? false,
            allow_faq: data.allow_faq ?? true,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId]);

  // Auto-scroll test chat
  useEffect(() => {
    testEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [testMessages, testLoading]);

  const updateField = useCallback(<K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaved(false);
  }, []);

  const saveSettings = useCallback(async () => {
    if (!siteId || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/chat-support/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, ...settings }),
      });
      if (res.ok) {
        setDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }, [siteId, settings, saving]);

  const sendTestMessage = useCallback(async () => {
    const trimmed = testInput.trim();
    if (!trimmed || testLoading || !siteId) return;

    const userMsg: TestMessage = { id: `tu-${Date.now()}`, role: 'user', content: trimmed };
    setTestMessages(prev => [...prev, userMsg]);
    setTestInput('');
    setTestLoading(true);

    try {
      const res = await fetch('/api/chat-support/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          sessionId: 'admin-test',
          message: trimmed,
          history: testMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setTestMessages(prev => [...prev, {
        id: `ta-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'No response.',
      }]);
    } catch {
      setTestMessages(prev => [...prev, {
        id: `te-${Date.now()}`,
        role: 'assistant',
        content: 'Error sending test message.',
      }]);
    } finally {
      setTestLoading(false);
    }
  }, [testInput, testLoading, siteId, testMessages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!hasChatBlock) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">No Chat Support Block</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Add an <strong>AI Chat Support</strong> block to any page in the editor to enable the floating chat widget on your published site.
        </p>
      </div>
    );
  }

  const accentColor = settings.accent_color || palette.primary || '#6366f1';

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            AI Chat Support
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure the AI-powered chat widget that appears on your published site.
          </p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving || !dirty}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: dirty ? accentColor : '#94a3b8' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Enable/Disable */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Chat Widget</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enable or disable the floating chat widget on your published site.
            </p>
          </div>
          <button
            onClick={() => updateField('enabled', !settings.enabled)}
            className="transition-colors"
          >
            {settings.enabled ? (
              <ToggleRight className="w-10 h-6 text-emerald-500" />
            ) : (
              <ToggleLeft className="w-10 h-6 text-slate-300" />
            )}
          </button>
        </div>
      </div>

      {/* Agent Settings */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <Bot className="w-4 h-4" />
          Agent Settings
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Agent Name</label>
            <input
              type="text"
              value={settings.agent_name}
              onChange={e => updateField('agent_name', e.target.value)}
              placeholder="Archie"
              maxLength={30}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contact Email (fallback)</label>
            <input
              type="email"
              value={settings.contact_email}
              onChange={e => updateField('contact_email', e.target.value)}
              placeholder="support@yourbiz.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-[11px] text-slate-400 mt-1">Shown to visitors after rate limit is reached</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Welcome Message</label>
          <textarea
            value={settings.welcome_message}
            onChange={e => updateField('welcome_message', e.target.value)}
            placeholder="Hi there! I'm here to help."
            maxLength={300}
            rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.accent_color || palette.primary || '#6366f1'}
                onChange={e => updateField('accent_color', e.target.value)}
                className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer"
              />
              <input
                type="text"
                value={settings.accent_color}
                onChange={e => updateField('accent_color', e.target.value)}
                placeholder={palette.primary || '#6366f1'}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Position</label>
            <select
              value={settings.position}
              onChange={e => updateField('position', e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>
        </div>
      </div>

      {/* Question Categories */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <Settings className="w-4 h-4" />
          Allowed Question Types
        </h3>
        <p className="text-xs text-slate-500">
          Choose which types of questions {settings.agent_name || 'the agent'} can answer. Disabled categories will be politely redirected.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {([
            { key: 'allow_general' as const, label: 'General Site Info', desc: 'Page content, about, contact, etc.' },
            { key: 'allow_faq' as const, label: 'FAQ Answers', desc: 'Answers from your FAQ block' },
            { key: 'allow_booking' as const, label: 'Booking & Services', desc: 'Service info, pricing, availability' },
            { key: 'allow_ecommerce' as const, label: 'Products & Ecommerce', desc: 'Product details, pricing, stock' },
          ]).map(cat => (
            <label
              key={cat.key}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                settings[cat.key]
                  ? 'border-blue-200 bg-blue-50/50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={settings[cat.key]}
                onChange={e => updateField(cat.key, e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">{cat.label}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">{cat.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Test Chat */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Test Chat
          </h3>
          {testMessages.length > 0 && (
            <button
              onClick={() => setTestMessages([])}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="h-[320px] overflow-y-auto py-3 space-y-1 bg-slate-50/50">
          {testMessages.length === 0 && (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
              Send a test message to see how {settings.agent_name || 'the agent'} responds
            </div>
          )}
          {testMessages.map(msg => (
            <div key={msg.id} className={`flex items-start gap-2.5 px-4 py-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'assistant' ? (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: accentColor }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-slate-800 text-white rounded-tr-sm'
                    : 'bg-white text-slate-700 rounded-tl-sm border border-slate-200'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {testLoading && (
            <div className="flex items-start gap-2.5 px-4 py-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 border border-slate-200">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={testEndRef} />
        </div>

        <form
          onSubmit={e => { e.preventDefault(); sendTestMessage(); }}
          className="flex items-center gap-2 px-4 py-3 border-t border-slate-100"
        >
          <input
            type="text"
            value={testInput}
            onChange={e => setTestInput(e.target.value)}
            placeholder={`Test a question for ${settings.agent_name || 'the agent'}...`}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={testLoading}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!testInput.trim() || testLoading}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: accentColor }}
          >
            {testLoading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </form>
      </div>

      {/* Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-500 space-y-1">
          <p>
            <strong>Rate limiting:</strong> Public visitors are limited to {4} messages/minute and {15} messages/hour.
            After {5} messages, the agent will suggest contacting your email.
            AI calls are capped at {8}/hour per visitor to protect your token budget.
          </p>
          <p>
            <strong>Context:</strong> {settings.agent_name || 'The agent'} reads all your published page content to answer questions.
            Enable booking or ecommerce categories above to let it also query your services and products.
          </p>
        </div>
      </div>
    </div>
  );
}
