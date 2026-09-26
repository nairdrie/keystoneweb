'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Workspace } from '@/lib/shop/types';
import { api, errorText } from './api';
import { useToast } from './ui';
import IntakeModal, { type IntakePrefill } from './IntakeModal';
import AuthorizationModal from './AuthorizationModal';
import CustomerDrawer from './CustomerDrawer';

interface AuthRequest { jobId: string; estimateId?: string | null; onDone?: () => void }

interface ShopContextValue {
  siteId: string;
  /** Where the Shop screens live (the admin tab by default). */
  basePath: string;
  ws: Workspace | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  patchWs: (fn: (ws: Workspace) => Workspace) => void;
  toast: (text: string, tone?: 'warn') => void;
  href: (path: string, query?: Record<string, string>) => string;
  openIntake: (prefill?: IntakePrefill) => void;
  openAuth: (req: AuthRequest) => void;
  openCustomer: (customerId: string) => void;
  /** Bumped whenever something changes, so open job files reload. */
  version: number;
  bump: () => void;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside ShopProvider');
  return ctx;
}

export function ShopProvider({ siteId, basePath = '/admin/shop', children }: { siteId: string; basePath?: string; children: ReactNode }) {
  const toast = useToast();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [intake, setIntake] = useState<IntakePrefill | null>(null);
  const [auth, setAuth] = useState<AuthRequest | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const inflight = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++inflight.current;
    try {
      const data = await api<Workspace>(siteId, '/workspace');
      if (ticket === inflight.current) { setWs(data); setError(null); }
    } catch (err) {
      if (ticket === inflight.current) setError(errorText(err));
    } finally {
      if (ticket === inflight.current) setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { refresh(); }, [refresh]);
  // Keep the board fresh when the tab regains focus (techs update it from the bay).
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    const timer = setInterval(onFocus, 60_000);
    return () => { document.removeEventListener('visibilitychange', onFocus); clearInterval(timer); };
  }, [refresh]);

  const bump = useCallback(() => { setVersion(v => v + 1); refresh(); }, [refresh]);

  const value = useMemo<ShopContextValue>(() => ({
    siteId,
    basePath,
    ws,
    loading,
    error,
    refresh,
    patchWs: fn => setWs(cur => (cur ? fn(cur) : cur)),
    toast,
    href: (path, query) => {
      const params = new URLSearchParams({ siteId, ...(query || {}) });
      return `${basePath}${path}?${params.toString()}`;
    },
    openIntake: prefill => setIntake(prefill || {}),
    openAuth: req => setAuth(req),
    openCustomer: id => setCustomerId(id),
    version,
    bump,
  }), [siteId, basePath, ws, loading, error, refresh, toast, version, bump]);

  return (
    <ShopContext.Provider value={value}>
      {children}
      {intake && <IntakeModal prefill={intake} onClose={() => setIntake(null)} />}
      {auth && <AuthorizationModal jobId={auth.jobId} estimateId={auth.estimateId ?? null} onClose={() => setAuth(null)} onDone={() => { setAuth(null); auth.onDone?.(); bump(); }} />}
      {customerId && <CustomerDrawer customerId={customerId} onClose={() => setCustomerId(null)} />}
    </ShopContext.Provider>
  );
}
