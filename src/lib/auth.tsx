import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { unregisterDevice } from "@/lib/push";

export type AppRole = "shopkeeper" | "driver" | "admin";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  activeRole: AppRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
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
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = async (s: Session | null) => {
    if (s?.user) {
      const fetchedRoles = await fetchRoles(s.user.id);
      const { data: preference } = await supabase.from("account_preferences")
        .select("active_role").eq("user_id", s.user.id).maybeSingle();
      setActiveRole(preference && fetchedRoles.includes(preference.active_role)
        ? preference.active_role : fetchedRoles.includes("shopkeeper") ? "shopkeeper" : fetchedRoles.includes("driver") ? "driver" : null);
      setSession(s);
      setUser(s.user);
      setRoles(fetchedRoles);
    } else {
      setSession(null);
      setUser(null);
      setRoles([]);
      setActiveRole(null);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void applySession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session).then(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        roles,
        activeRole,
        loading,
        refresh: async () => {
          if (session) await applySession(session);
        },
        signOut: async () => {
          await unregisterDevice();
          await supabase.auth.signOut();
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
