'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import { MessageCircle, X, Send, Bot, User, Loader2, Settings, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSettings {
  agent_name: string;
  welcome_message: string;
  accent_color: string | null;
  position: 'bottom-right' | 'bottom-left';
  enabled: boolean;
}

interface ChatSupportBlockProps {
  id: string;
  data: Record<string, any>;
  isEditMode: boolean;
  palette: Record<string, string>;
}

// ─── Edit-mode placeholder ──────────────────────────────────────────────────

function EditPlaceholder({ palette }: { palette: Record<string, string> }) {
  return (
    <div className="w-full py-12 px-6">
      <div className="max-w-lg mx-auto bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: palette.primary || '#6366f1' }}
        >
          <MessageCircle className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">AI Chat Support</h3>
        <p className="text-sm text-slate-500 mb-4">
          A floating chat widget will appear on the bottom-right of your published site.
          Visitors can ask questions and get AI-powered answers from your support agent.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <Settings className="w-3.5 h-3.5" />
          <span>Configure in Admin → Chat Support</span>
        </div>
      </div>
    </div>
  );
}

// ─── Typing indicator ───────────────────────────────────────────────────────

function TypingIndicator({ agentName, accentColor }: { agentName: string; accentColor: string }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: accentColor }}
      >
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ─── Chat widget (rendered via portal on published sites) ───────────────────

function ChatWidget({ siteId, palette }: { siteId: string; palette: Record<string, string> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2) + Date.now().toString(36));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accentColor = settings?.accent_color || palette.primary || '#6366f1';
  const agentName = settings?.agent_name || 'Archie';
  const position = settings?.position || 'bottom-right';

  // Fetch settings on mount
  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/chat-support/settings?siteId=${siteId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setSettings(data);
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, [siteId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Add welcome message when first opened
  useEffect(() => {
    if (isOpen && messages.length === 0 && settings) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: settings.welcome_message || `Hi there! I'm ${agentName}. How can I help you today?`,
        timestamp: Date.now(),
      }]);
    }
  }, [isOpen, settings, agentName, messages.length]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat-support/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          sessionId,
          message: trimmed,
          history: messages.filter(m => m.id !== 'welcome').map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Sorry, I had trouble processing that. Please try again.',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again in a moment.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, siteId, sessionId]);

  // Don't render until settings loaded; hide if disabled
  if (!settingsLoaded) return null;
  if (settings && !settings.enabled) return null;

  const positionClasses = position === 'bottom-left' ? 'left-4 sm:left-6' : 'right-4 sm:right-6';
  const panelPositionClasses = position === 'bottom-left'
    ? 'left-4 sm:left-6 right-4 sm:right-auto'
    : 'right-4 sm:right-6 left-4 sm:left-auto';

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 sm:bottom-6 z-[9999] w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center group"
          style={{
            backgroundColor: accentColor,
            [position === 'bottom-left' ? 'left' : 'right']: '16px',
          }}
          aria-label="Open chat support"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          {/* Pulse ring */}
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ backgroundColor: accentColor }}
          />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className={`fixed bottom-4 sm:bottom-6 ${panelPositionClasses} z-[9999] w-auto sm:w-[380px] max-h-[min(70vh,560px)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300`}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">{agentName}</h4>
                <p className="text-[11px] text-white/70">AI Support Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto py-3 min-h-0 space-y-1">
            {messages.map(msg => (
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
                      : 'bg-slate-100 text-slate-700 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && <TypingIndicator agentName={agentName} accentColor={accentColor} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 border-t border-slate-100 px-3 py-2.5">
            <form
              onSubmit={e => { e.preventDefault(); sendMessage(); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={`Ask ${agentName} a question...`}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': accentColor } as any}
                disabled={isLoading}
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: accentColor }}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Block Component ───────────────────────────────────────────────────

export default function ChatSupportBlock({ id, data, isEditMode, palette }: ChatSupportBlockProps) {
  const context = useEditorContext();
  const siteId = context?.siteId || '';
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Set up portal target for the floating widget (only in public/view mode)
  useEffect(() => {
    if (isEditMode) return;
    setPortalTarget(document.body);
  }, [isEditMode]);

  if (isEditMode) {
    return <EditPlaceholder palette={palette} />;
  }

  // In public mode, render the floating widget via portal (so it's outside the page flow)
  if (!portalTarget || !siteId) return null;

  return createPortal(
    <ChatWidget siteId={siteId} palette={palette} />,
    portalTarget,
  );
}
