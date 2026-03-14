'use client';

import { useState, useCallback, useRef } from 'react';
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
  const abortRef = useRef<AbortController | null>(null);
  const wasCancelledRef = useRef(false);

  const sendMessage = useCallback(async (prompt: string) => {
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
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));

        // Basic plan daily limit reached — show upgrade modal
        if (res.status === 429 && errData.upgradeRequired) {
          setShowUpgradeModal(true);
          // Remove the user message since it wasn't processed
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

  return { messages, isLoading, sendMessage, cancel, clearMessages, showUpgradeModal, dismissUpgradeModal };
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
