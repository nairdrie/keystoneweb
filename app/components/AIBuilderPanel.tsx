'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Trash2, X, Square } from 'lucide-react';
import { AIMessage } from '@/lib/hooks/useAIBuilder';

interface AIBuilderPanelProps {
  messages: AIMessage[];
  isLoading: boolean;
  onSend: (message: string) => void;
  onCancel: () => void;
  onClear: () => void;
  isPro: boolean;
}

const QUICK_PROMPTS = [
  'Build me a full homepage for a plumbing business',
  'Add a testimonials section with 3 reviews',
  'Add a FAQ section with common questions',
  'Add a services grid with 6 services',
  'Change the color scheme to something modern and dark',
];

export default function AIBuilderPanel({ messages, isLoading, onSend, onCancel, onClear, isPro }: AIBuilderPanelProps) {
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

  if (!isPro) {
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
          Upgrade to Pro
        </a>
      </div>
    );
  }

  return (
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
              className={`max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-relaxed ${
                msg.role === 'user'
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
              <button onClick={onCancel} className="ml-1 p-0.5 hover:bg-slate-200 rounded" title="Cancel">
                <Square className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want..."
            rows={1}
            className="w-full resize-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-[12px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-30 hover:bg-violet-700 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
