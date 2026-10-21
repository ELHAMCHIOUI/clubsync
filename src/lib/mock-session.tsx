// Phase 1 (front uniquement) : session, salle et rôle SIMULÉS dans le navigateur.
// À remplacer par Supabase (auth + organization_members + rpc create_organization) quand la base sera reliée.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type StaffRole = "owner" | "manager" | "receptionist";
export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Propriétaire",
  manager: "Gérant",
  receptionist: "Réception",
};

export interface Profile { id: string; full_name: string; email: string }
export interface Organization {
  id: string; name: string; phone: string | null; address: string | null; city: string | null;
  invoice_prefix: string; vat_rate: number; max_reception_discount_pct: number; anti_passback_minutes: number;
}
interface StoredUser extends Profile { password: string }
interface Membership { organization_id: string; user_id: string; role: StaffRole; created_at: string }
interface Store { users: StoredUser[]; sessionUserId: string | null; orgs: Organization[]; memberships: Membership[] }

const KEY = "nabd-demo-store";
const empty: Store = { users: [], sessionUserId: null, orgs: [], memberships: [] };
const load = (): Store => {
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return empty; }
};
const uid = () => crypto.randomUUID();

interface Ctx {
  ready: boolean;
  profile: Profile | null;
  org: Organization | null;
  role: StaffRole | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ session: boolean }>;
  signOut: () => void;
  createOrganization: (name: string) => Promise<string>;
  setDemoRole: (role: StaffRole) => void;
}
const OrgContext = createContext<Ctx | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => { setStore(load()); setReady(true); }, []);
  const commit = useCallback((next: Store) => { localStorage.setItem(KEY, JSON.stringify(next)); setStore(next); }, []);

  const user = store.users.find((u) => u.id === store.sessionUserId) ?? null;
  const membership = user
    ? store.memberships.filter((m) => m.user_id === user.id).sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
    : undefined;
  const org = membership ? store.orgs.find((o) => o.id === membership.organization_id) ?? null : null;
  const role = membership?.role ?? null;

  const value: Ctx = {
    ready,
    profile: user ? { id: user.id, full_name: user.full_name, email: user.email } : null,
    org,
    role,
    isAdmin: role === "owner" || role === "manager",
    async signIn(email, password) {
      const s = load();
      const u = s.users.find((x) => x.email === email.trim().toLowerCase());
      if (!u || u.password !== password) throw new Error("Email ou mot de passe incorrect");
      commit({ ...s, sessionUserId: u.id });
    },
    async signUp(fullName, email, password) {
      const s = load();
      const e = email.trim().toLowerCase();
      if (password.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères");
      if (s.users.some((x) => x.email === e)) throw new Error("Un compte existe déjà avec cet email");
      const u: StoredUser = { id: uid(), email: e, full_name: fullName.trim(), password };
      commit({ ...s, users: [...s.users, u], sessionUserId: u.id });
      return { session: true };
    },
    signOut() { commit({ ...load(), sessionUserId: null }); },
    async createOrganization(name) {
      const s = load();
      if (!s.sessionUserId) throw new Error("Vous devez être connecté");
      if (name.trim().length < 2) throw new Error("Le nom de la salle est trop court");
      const o: Organization = {
        id: uid(), name: name.trim(), phone: null, address: null, city: null,
        invoice_prefix: "F", vat_rate: 20, max_reception_discount_pct: 10, anti_passback_minutes: 60,
      };
      commit({
        ...s, orgs: [...s.orgs, o],
        memberships: [...s.memberships, { organization_id: o.id, user_id: s.sessionUserId, role: "owner", created_at: new Date().toISOString() }],
      });
      return o.id;
    },
    setDemoRole(r) {
      const s = load();
      if (!membership) return;
      commit({
        ...s,
        memberships: s.memberships.map((m) =>
          m.user_id === membership.user_id && m.organization_id === membership.organization_id ? { ...m, role: r } : m),
      });
    },
  };
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const c = useContext(OrgContext);
  if (!c) throw new Error("useOrg doit être utilisé dans OrgProvider");
  return c;
}
