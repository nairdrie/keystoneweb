'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Trash2, Square } from 'lucide-react';
import { AIMessage, UsageRemaining } from '@/lib/hooks/useAIBuilder';

const WARN_THRESHOLD = 3; // show remaining badge when this many or fewer left

interface AIBuilderPanelProps {
  messages: AIMessage[];
  isLoading: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
  onClear: () => void;
  isPro: boolean;
  isBasic?: boolean;
  isFree?: boolean;
  remaining?: UsageRemaining | null;
  showUpgradeModal?: boolean;
  onDismissUpgradeModal?: () => void;
}

/** Returns the most urgent low-quota warning string, or null if not close to any limit. */
function getRemainingWarning(remaining: UsageRemaining | null | undefined, isFree: boolean): string | null {
  if (!remaining) return null;

  if (isFree) {
    if (remaining.total !== undefined && remaining.total <= WARN_THRESHOLD) {
      return remaining.total === 0
        ? 'No free prompts left'
        : `${remaining.total} free prompt${remaining.total === 1 ? '' : 's'} left`;
    }
    return null;
  }

  // Show the most pressing (lowest) limit
  const candidates: Array<{ value: number; label: string }> = [];
  if (remaining.day   !== undefined) candidates.push({ value: remaining.day,   label: 'today' });
  if (remaining.week  !== undefined) candidates.push({ value: remaining.week,  label: 'this week' });
  if (remaining.month !== undefined) candidates.push({ value: remaining.month, label: 'this month' });

  const urgent = candidates
    .filter(c => c.value <= WARN_THRESHOLD)
    .sort((a, b) => a.value - b.value)[0];

  if (!urgent) return null;
  return urgent.value === 0
    ? `No prompts left ${urgent.label}`
    : `${urgent.value} prompt${urgent.value === 1 ? '' : 's'} left ${urgent.label}`;
}

const QUICK_PROMPTS = [
  'Build me a full homepage for a plumbing business',
  'Add a testimonials section with 3 reviews',
  'Add a FAQ section with common questions',
  'Add a services grid with 6 services',
  'Change the color scheme to something modern and dark',
];

export default function AIBuilderPanel({ messages, isLoading, onSend, onCancel, onClear, isPro, isBasic = false, isFree = false, remaining, showUpgradeModal = false, onDismissUpgradeModal }: AIBuilderPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isPro && !isBasic && !isFree) {
    return (
      <div className="p-4 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-800">AI Website Builder</p>
        <p className="text-xs text-slate-500">
          Describe the website you want and AI will build it for you using the available blocks and styling options.
        </p>
        <a
          href="/pricing"
          className="inline-block px-4 py-2 text-xs font-bold text-white rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:brightness-110 transition-all"
        >
          Subscribe to Get Started
        </a>
      </div>
    );
  }

  return (
    <>
      {/* Upgrade Modal - shown when free or basic plan limit is reached */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            {isFree ? (
              <>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Free Limit Reached</h2>
                <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                  You've used all <strong>4 free AI Builder prompts</strong>. Subscribe to a plan to keep building with AI.
                </p>
              </>
            ) : isBasic ? (
              <>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Limit Reached</h2>
                <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                  You've hit your Basic plan limit (10/day · 20/week · 30/month). Upgrade to Pro for 30 per day, 50 per week, and 100 per month.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Limit Reached</h2>
                <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                  You've reached your Pro plan limit for this period. Your quota resets daily, weekly, and monthly.
                </p>
              </>
            )}
            <a
              href="/pricing"
              className="block w-full py-3 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:brightness-110 transition-all shadow-lg mb-3"
            >
              {isFree ? 'Subscribe to Continue' : 'Upgrade to Pro'}
            </a>
            <button
              onClick={onDismissUpgradeModal}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full max-h-[400px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-4 space-y-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Tell me what you want and I&apos;ll build it. I can add sections, change colors, update text, and more.
              </p>
              <div className="space-y-1.5">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => onSend(prompt)}
                    className="w-full text-left px-3 py-2 text-[11px] text-slate-600 bg-slate-50 hover:bg-violet-50 hover:text-violet-700 rounded-lg border border-slate-100 hover:border-violet-200 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-relaxed ${msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-br-sm'
                  : msg.isError
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                    : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}
              >
                {msg.content}
                {msg.operations && msg.operations.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-200/50">
                    <span className="text-[10px] text-slate-500 font-medium">
                      {msg.operations.length} change{msg.operations.length !== 1 ? 's' : ''} applied
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-500 px-3 py-2 rounded-xl rounded-bl-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[12px]">Building...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Remaining prompts warning */}
        {(() => {
          const warning = getRemainingWarning(remaining, isFree);
          if (!warning) return null;
          const isOut = warning.startsWith('No');
          return (
            <div className={`shrink-0 mx-3 mb-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 ${
              isOut
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <span className="shrink-0">{isOut ? '⛔' : '⚠️'}</span>
              {warning}
            </div>
          );
        })()}

        {/* Input */}
        <div className="shrink-0 px-3 pb-3 pt-2 border-t border-slate-100">
          {messages.length > 0 && (
            <button
              onClick={onClear}
              className="w-full flex items-center justify-center gap-1 py-1 mb-2 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear chat
            </button>
          )}
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 1000))}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want..."
              maxLength={1000}
              rows={1}
              className="w-full resize-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-[12px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all"
            />
            {input.length > 800 && (
              <span className={`absolute left-3 bottom-[-10] text-[10px] ${input.length >= 1000 ? 'text-red-500' : 'text-slate-400'}`}>
                {input.length}/1000
              </span>
            )}
            {isLoading ? (
              <button
                type="button"
                onClick={onCancel}
                className="absolute right-2 bottom-3 p-1.5 rounded-lg text-white transition-colors hover:brightness-110"
                style={{ backgroundColor: 'var(--brand-primary)' }}
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="absolute right-2 bottom-3 p-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-30 hover:bg-violet-700 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
