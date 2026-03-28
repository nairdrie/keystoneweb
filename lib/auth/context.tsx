'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/db/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  session: null,
  loading: false,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signInWithApple: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

/**
 * Clear all Supabase auth cookies directly from the browser.
 * This is a last-resort fallback for when signOut({ scope: 'local' }) alone
 * doesn't stop the auto-refresh loop (e.g. the client is stuck retrying 429s).
 * Cookies set by @supabase/ssr's createBrowserClient are NOT httpOnly, so
 * document.cookie can clear them.
 */
function clearSupabaseAuthCookies() {
  if (typeof document === 'undefined') return;
  const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/([^.]+)\./
  )?.[1];
  if (!projectId) return;

  const prefix = `sb-${projectId}-auth-token`;
  const domains = [window.location.hostname, '.keystoneweb.ca', ''];

  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name.startsWith(prefix)) {
      // Delete cookie for every plausible domain/path combination
      domains.forEach((domain) => {
        const domainPart = domain ? `; domain=${domain}` : '';
        document.cookie = `${name}=; Max-Age=0; path=/${domainPart}`;
      });
    }
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Flag to prevent onAuthStateChange from reacting to our own signOut calls
    // during stale-session cleanup (signOut fires SIGNED_OUT which would recurse).
    let isCleaningUp = false;

    const getInitialSession = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!initialSession) {
          // No local session — nothing to validate.
          return;
        }

        // A local session exists (cookie present). Validate it against the
        // server to catch deleted/revoked accounts BEFORE the auto-refresh
        // loop burns through the rate limit.
        const { data: { user: validUser }, error: userError } =
          await supabase.auth.getUser();

        if (userError || !validUser) {
          // Session cookie is stale (deleted user, revoked token, etc.).
          // Nuke it to stop the refresh-token spam.
          console.warn(
            '[Auth] Stale session detected, clearing:',
            userError?.message
          );
          isCleaningUp = true;
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          clearSupabaseAuthCookies();
          isCleaningUp = false;
          setSession(null);
          setUser(null);
          return;
        }

        setSession(initialSession);
        setUser(validUser);
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setLoading(false);
      }
    };

    // Safety timeout: if getSession() hangs (e.g. stale token refresh on mobile),
    // ensure loading resolves so the UI is never stuck indefinitely.
    const safetyTimer = setTimeout(() => setLoading(false), 8000);
    getInitialSession().finally(() => clearTimeout(safetyTimer));

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip events triggered by our own cleanup to avoid recursion
      if (isCleaningUp) return;

      setSession(session);
      setUser(session?.user ?? null);

      // When a token refresh fails (e.g. user was deleted, token revoked),
      // Supabase fires SIGNED_OUT but may leave the stale cookie in place.
      // Clear cookies directly to stop the auto-refresh loop.
      if (event === 'SIGNED_OUT' && !session) {
        clearSupabaseAuthCookies();
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/complete-profile`,
        },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithApple = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/complete-profile`,
        },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signInWithApple, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
