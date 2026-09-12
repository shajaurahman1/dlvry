import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "shopkeeper" | "driver" | "admin";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  /** True when signed in anonymously because login is temporarily bypassed. */
  bypassed: boolean;
  /** Set when the automatic anonymous sign-in (used to bypass login) failed. */
  bypassError: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  retryBypass: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as AppRole);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [bypassError, setBypassError] = useState(false);

  const applySession = async (s: Session | null) => {
    if (s?.user) {
      const fetchedRoles = await fetchRoles(s.user.id);
      setSession(s);
      setUser(s.user);
      setRoles(fetchedRoles);
    } else {
      setSession(null);
      setUser(null);
      setRoles([]);
    }
  };

  // Login is temporarily bypassed: every real feature still relies on
  // Supabase RLS policies that require an authenticated auth.uid(), so when
  // there's no existing session we sign the device in anonymously instead of
  // showing any login screen. This creates no new profile data on its own —
  // existing users/rows are untouched — and a real sign-in (once auth comes
  // back) simply replaces this session.
  const bootstrapBypass = async () => {
    setBypassError(false);
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("[auth] anonymous bypass sign-in failed", error);
      setBypassError(true);
      await applySession(null);
      return;
    }
    await applySession(data.session);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void applySession(s);
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await applySession(data.session);
      } else {
        await bootstrapBypass();
      }
      setLoading(false);
    })();
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        roles,
        loading,
        bypassed: Boolean(session?.user.is_anonymous),
        bypassError,
        refresh: async () => {
          if (user) setRoles(await fetchRoles(user.id));
        },
        signOut: async () => {
          await supabase.auth.signOut();
        },
        retryBypass: async () => {
          setLoading(true);
          await bootstrapBypass();
          setLoading(false);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
