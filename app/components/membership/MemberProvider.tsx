'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface MemberData {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  status: string;
  packageId: string | null;
  package: {
    id: string;
    name: string;
    price_cents: number;
    currency: string;
    billing_interval: string;
    features: string[];
  } | null;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  customFields: Record<string, any>;
  marketingOptIn: boolean;
  signedUpAt: string;
}

interface MemberContextType {
  member: MemberData | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const MemberContext = createContext<MemberContextType | null>(null);

export function useMember() {
  return useContext(MemberContext);
}

export function MemberProvider({ children, siteId }: { children: ReactNode; siteId: string }) {
  const [member, setMember] = useState<MemberData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMember = useCallback(async () => {
    try {
      const res = await fetch('/api/membership/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMember(data.member || null);
      } else {
        setMember(null);
      }
    } catch {
      setMember(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/membership/signout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors — cookie will be cleared regardless
    }
    setMember(null);
    window.location.href = '/';
  }, []);

  return (
    <MemberContext.Provider value={{ member, isLoading, signOut, refresh: fetchMember }}>
      {children}
    </MemberContext.Provider>
  );
}
