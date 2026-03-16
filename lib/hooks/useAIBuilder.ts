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

interface AIBuilderCallbacks {
  onAddBlock: (type: string, data: Record<string, any>, index?: number) => void;
  onUpdateBlock: (blockId: string, updates: Record<string, any>) => void;
  onRemoveBlock: (blockId: string) => void;
  onReorderBlocks: (blockIds: string[]) => void;
  onSetSiteTitle: (title: string) => void;
  onSetFont: (target: 'heading' | 'body', font: string) => void;
  onSetCustomColors: (colors: { primary?: string; secondary?: string; accent?: string }) => void;
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
  const abortRef = useRef<AbortController | null>(null);
  const wasCancelledRef = useRef(false);

  // Fetch remaining on mount so the UI can show usage warnings before the first request
  useEffect(() => {
    fetch('/api/ai/builder', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.remaining) setRemaining(data.remaining); })
      .catch(() => {});
  }, []);

  const sendMessage = useCallback(async (prompt: string, options?: { isNewSite?: boolean }) => {
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
          siteState,
          availablePalettes,
          ...(options?.isNewSite ? { isNewSite: true } : {}),
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

      const data = await res.json();
      const operations: AIOperation[] = data.operations || [];
      const message: string = data.message || 'Done.';

      // Update remaining from successful response
      if (data.remaining) setRemaining(data.remaining);

      // If the server flagged a parse error, treat it as an error message
      if (data.parseError) {
        const errMsg: AIMessage = {
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content: message,
          isError: true,
        };
        setMessages(prev => [...prev, errMsg]);
        return;
      }

      // Apply operations
      for (const op of operations) {
        applyOperation(op, callbacks);
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

  return { messages, isLoading, sendMessage, cancel, clearMessages, showUpgradeModal, dismissUpgradeModal, authExpired, remaining };
}

function applyOperation(op: AIOperation, callbacks: AIBuilderCallbacks) {
  switch (op.op) {
    case 'addBlock':
      callbacks.onAddBlock(op.blockType, op.data || {}, op.index);
      break;
    case 'updateBlock':
      if (op.blockId && op.updates) {
        // Apply each field individually through the existing updateBlockData path
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
  }
}
