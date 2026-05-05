'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { BlockData } from '@/lib/editor-context';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  operations?: AIOperation[];
  isError?: boolean;
}

export interface AIOperation {
  op: string;
  [key: string]: any;
}

// Shared with AIBuilderPanel — do NOT import from server-only rate-limit.ts
export interface UsageRemaining {
  total?: number; // free plan only
  day?: number;
  week?: number;
  month?: number;
}

interface SiteState {
  title: string;
  blocks: BlockData[];
  palette: string;
  headingFont?: string;
  bodyFont?: string;
}

export interface AICreatePagesPayload {
  slug: string;
  title: string;
  displayName: string;
  isVisibleInNav: boolean;
  blocks: any[];
}

interface AIBuilderCallbacks {
  onAddBlock: (type: string, data: Record<string, any>, index?: number) => void;
  onUpdateBlock: (blockId: string, updates: Record<string, any>) => void;
  onRemoveBlock: (blockId: string) => void;
  onReorderBlocks: (blockIds: string[]) => void;
  onSetSiteTitle: (title: string) => void;
  onSetFont: (target: 'heading' | 'body', font: string) => void;
  onSetCustomColors: (colors: { primary?: string; secondary?: string; accent?: string }) => void;
  onSetTemplate: (templateId: string) => void;
  onReplaceBlocks: (blocks: any[]) => void;
  onSetHeaderConfig: (config: Record<string, any>) => void;
  onCreatePages: (pages: AICreatePagesPayload[]) => void | Promise<void>;
  onSeedSampleData: (samples: Record<string, any>) => void | Promise<void>;
}

export function useAIBuilder(
  getSiteState: () => SiteState,
  availablePalettes: string[],
  callbacks: AIBuilderCallbacks,
) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const [remaining, setRemaining] = useState<UsageRemaining | null>(null);
  // Live progress message from the orchestrator's NDJSON stream during a
  // multi-pass new-site build. Null whenever no streamed build is running.
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wasCancelledRef = useRef(false);

  // Fetch remaining on mount so the UI can show usage warnings before the first request
  useEffect(() => {
    fetch('/api/ai/builder', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.remaining) setRemaining(data.remaining); })
      .catch(() => {});
  }, []);

  const sendMessage = useCallback(async (prompt: string, options?: { isNewSite?: boolean; wizardData?: unknown }) => {
    if (!prompt.trim() || isLoading) return;

    wasCancelledRef.current = false;

    const userMsg: AIMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: prompt.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      abortRef.current = new AbortController();

      const siteState = getSiteState();

      const res = await fetch('/api/ai/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortRef.current.signal,
        body: JSON.stringify({
          prompt: prompt.trim(),
          history: messages.map(m => ({ role: m.role, content: m.content })),
          siteState,
          availablePalettes,
          ...(options?.isNewSite ? { isNewSite: true } : {}),
          ...(options?.wizardData ? { wizardData: options.wizardData } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));

        // Update remaining even on rate-limit responses so the UI stays accurate
        if (errData.remaining) setRemaining(errData.remaining);

        // Limit reached — show upgrade modal
        if (res.status === 429 && errData.upgradeRequired) {
          setShowUpgradeModal(true);
          setMessages(prev => prev.filter(m => m.id !== userMsg.id));
          return;
        }

        // Session expired — signal to redirect to login
        if (res.status === 401) {
          setAuthExpired(true);
          setMessages(prev => prev.filter(m => m.id !== userMsg.id));
          return;
        }

        // Show server message for auth/rate-limit errors, generic fallback for everything else
        const friendlyError = (res.status === 403 || res.status === 429)
          ? (errData.error || 'Sorry, something went wrong. Please try again in a moment.')
          : 'Sorry, something went wrong. Please try again in a moment.';
        const errMsg: AIMessage = {
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content: friendlyError,
          isError: true,
        };
        setMessages(prev => [...prev, errMsg]);
        return;
      }

      // Two response shapes:
      //  - Plain JSON (incremental edits): { operations, message, remaining? }
      //  - NDJSON stream (orchestrated new-site builds): one JSON object per
      //    line; each "progress" line drives the loader subtitle, and the
      //    final "result" line carries the full operations payload.
      const contentType = res.headers.get('content-type') || '';
      const isStream = contentType.includes('application/x-ndjson');

      let operations: AIOperation[] = [];
      let message = 'Done.';
      let parseError = false;

      if (isStream && res.body) {
        setProgressMessage('Planning your site…');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let sawResult = false;
        let streamDone = false;
        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) { streamDone = true; break; }
          buf += decoder.decode(value, { stream: true });
          let nlIdx;
          while ((nlIdx = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, nlIdx).trim();
            buf = buf.slice(nlIdx + 1);
            if (!line) continue;
            try {
              const evt = JSON.parse(line);
              if (evt?.type === 'progress' && typeof evt.message === 'string') {
                setProgressMessage(evt.message);
              } else if (evt?.type === 'result') {
                operations = Array.isArray(evt.operations) ? evt.operations : [];
                message = typeof evt.message === 'string' ? evt.message : 'Done.';
                if (evt.remaining) setRemaining(evt.remaining);
                if (evt.parseError) parseError = true;
                sawResult = true;
              } else if (evt?.type === 'error') {
                parseError = true;
                if (typeof evt.message === 'string') message = evt.message;
              }
            } catch { /* ignore malformed line */ }
          }
        }
        setProgressMessage(null);
        if (!sawResult) parseError = true;
      } else {
        const data = await res.json();
        operations = data.operations || [];
        message = data.message || 'Done.';
        if (data.remaining) setRemaining(data.remaining);
        if (data.parseError) parseError = true;
      }

      if (parseError) {
        const errMsg: AIMessage = {
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content: message || 'Sorry, I had trouble processing that request. Please try again.',
          isError: true,
        };
        setMessages(prev => [...prev, errMsg]);
        return;
      }

      // Apply operations sequentially. createPages is async (it hits the
      // server) so we await it — page creation must finish before we resolve
      // pageSlug button references in any blocks added by replaceBlocks.
      for (const op of operations) {
        await applyOperation(op, callbacks);
      }

      const assistantMsg: AIMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: message,
        operations: operations.length > 0 ? operations : undefined,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled — tell server to refund the rate limit usage
        fetch('/api/ai/builder/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }).catch(() => {});

        // Remove the user message since it wasn't completed
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        return;
      }
      const errMsg: AIMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again in a moment.',
        isError: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      setProgressMessage(null);
      abortRef.current = null;
    }
  }, [isLoading, getSiteState, availablePalettes, callbacks]);

  const cancel = useCallback(() => {
    wasCancelledRef.current = true;
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const dismissUpgradeModal = useCallback(() => {
    setShowUpgradeModal(false);
  }, []);

  return { messages, isLoading, sendMessage, cancel, clearMessages, showUpgradeModal, dismissUpgradeModal, authExpired, remaining, progressMessage };
}

async function applyOperation(op: AIOperation, callbacks: AIBuilderCallbacks): Promise<void> {
  switch (op.op) {
    case 'setTemplate':
      if (op.templateId) {
        callbacks.onSetTemplate(op.templateId);
      }
      break;
    case 'replaceBlocks':
      if (Array.isArray(op.blocks)) {
        callbacks.onReplaceBlocks(op.blocks);
      }
      break;
    case 'createPages':
      if (Array.isArray(op.pages)) {
        await callbacks.onCreatePages(op.pages);
      }
      break;
    case 'seedSampleData':
      if (op.samples && typeof op.samples === 'object') {
        await callbacks.onSeedSampleData(op.samples);
      }
      break;
    case 'addBlock':
      callbacks.onAddBlock(op.blockType, op.data || {}, op.index);
      break;
    case 'updateBlock':
      if (op.blockId && op.updates) {
        callbacks.onUpdateBlock(op.blockId, op.updates);
      }
      break;
    case 'removeBlock':
      if (op.blockId) {
        callbacks.onRemoveBlock(op.blockId);
      }
      break;
    case 'reorderBlocks':
      if (Array.isArray(op.blockIds)) {
        callbacks.onReorderBlocks(op.blockIds);
      }
      break;
    case 'setSiteTitle':
      if (op.title) {
        callbacks.onSetSiteTitle(op.title);
      }
      break;
    case 'setFont':
      if (op.target && op.font) {
        callbacks.onSetFont(op.target, op.font);
      }
      break;
    case 'setCustomColors':
      callbacks.onSetCustomColors({
        primary: op.primary,
        secondary: op.secondary,
        accent: op.accent,
      });
      break;
    case 'setHeaderConfig':
      if (op.config && typeof op.config === 'object') {
        callbacks.onSetHeaderConfig(op.config);
      }
      break;
  }
}
