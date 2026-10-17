import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { unregisterDevice } from "@/lib/push";
import { getMe } from "@/lib/profile.functions";

export type AppRole = "shopkeeper" | "driver" | "admin";

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Record<string, unknown> | null;
  roles: AppRole[];
  activeRole: AppRole | null;
  shop: Record<string, unknown> | null;
  driver: Record<string, unknown> | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRoleState] = useState<AppRole | null>(null);
  const [shop, setShop] = useState<Record<string, unknown> | null>(null);
  const [driver, setDriver] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = async (s: Session | null) => {
    if (s?.user) {
      setSession(s);
      setUser(s.user);
      try {
        const me = await getMe();
        setProfile((me.profile as Record<string, unknown> | null) ?? null);
        setRoles(me.roles as AppRole[]);
        setActiveRoleState((me.activeRole as AppRole | null) ?? null);
        setShop((me.shop as Record<string, unknown> | null) ?? null);
        setDriver((me.driver as Record<string, unknown> | null) ?? null);
      } catch (err) {
        console.error("[auth] failed to load profile", err);
      }
    } else {
      setSession(null);
      setUser(null);
      setProfile(null);
      setRoles([]);
      setActiveRoleState(null);
      setShop(null);
      setDriver(null);
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
        profile,
        roles,
        activeRole,
        shop,
        driver,
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
