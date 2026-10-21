// Session, salle, rôle et équipe SIMULÉS dans le navigateur (aucune base reliée).
// À remplacer par Supabase (auth + organization_members + rpc) quand la base sera reliée.
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
  ice: string | null; tax_id: string | null;
  invoice_prefix: string; vat_rate: number; max_reception_discount_pct: number; anti_passback_minutes: number;
  created_at: string;
}
interface StoredUser extends Profile { password: string }
interface Membership { organization_id: string; user_id: string; role: StaffRole; created_at: string }
export interface Invitation { id: string; organization_id: string; email: string; role: StaffRole; invited_by: string; created_at: string }
export interface StaffRow { organization_id: string; user_id: string; role: StaffRole; created_at: string; full_name: string; email: string }
interface Store { users: StoredUser[]; sessionUserId: string | null; orgs: Organization[]; memberships: Membership[]; invitations: Invitation[] }

const KEY = "nabd-demo-store";
const empty: Store = { users: [], sessionUserId: null, orgs: [], memberships: [], invitations: [] };
const load = (): Store => {
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return empty; }
};
const uid = () => crypto.randomUUID();

/** Lecture brute des salles (utilisée par la carte publique simulée). */
export function readOrganizations(): Organization[] { return load().orgs; }

interface Ctx {
  ready: boolean;
  profile: Profile | null;
  org: Organization | null;
  role: StaffRole | null;
  isAdmin: boolean;
  isOwner: boolean;
  staff: StaffRow[];
  invitations: Invitation[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ session: boolean }>;
  signOut: () => void;
  createOrganization: (name: string) => Promise<string>;
  updateOrganization: (patch: Partial<Omit<Organization, "id" | "created_at">>) => Promise<void>;
  inviteStaff: (email: string, role: StaffRole) => Promise<"added" | "invited">;
  cancelInvitation: (id: string) => Promise<void>;
  removeStaff: (userId: string) => Promise<void>;
  changeStaffRole: (userId: string, role: StaffRole) => Promise<void>;
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
  const isAdmin = role === "owner" || role === "manager";

  const staff: StaffRow[] = org
    ? store.memberships.filter((m) => m.organization_id === org.id).map((m) => {
        const u = store.users.find((x) => x.id === m.user_id);
        return { ...m, full_name: u?.full_name ?? "—", email: u?.email ?? "—" };
      })
    : [];
  const invitations = org ? store.invitations.filter((i) => i.organization_id === org.id) : [];

  const requireAdmin = () => { if (!isAdmin) throw new Error("Action réservée au gérant"); };

  const value: Ctx = {
    ready, org, role, isAdmin, isOwner: role === "owner", staff, invitations,
    profile: user ? { id: user.id, full_name: user.full_name, email: user.email } : null,
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
      // Les invités sont rattachés automatiquement à l'inscription.
      const mine = s.invitations.filter((i) => i.email === e);
      commit({
        ...s, users: [...s.users, u], sessionUserId: u.id,
        memberships: [...s.memberships, ...mine.map((i) => ({ organization_id: i.organization_id, user_id: u.id, role: i.role, created_at: new Date().toISOString() }))],
        invitations: s.invitations.filter((i) => i.email !== e),
      });
      return { session: true };
    },
    signOut() { commit({ ...load(), sessionUserId: null }); },
    async createOrganization(name) {
      const s = load();
      if (!s.sessionUserId) throw new Error("Vous devez être connecté");
      if (name.trim().length < 2) throw new Error("Le nom de la salle est trop court");
      const o: Organization = {
        id: uid(), name: name.trim(), phone: null, address: null, city: null, ice: null, tax_id: null,
        invoice_prefix: "F", vat_rate: 20, max_reception_discount_pct: 10, anti_passback_minutes: 60,
        created_at: new Date().toISOString(),
      };
      commit({
        ...s, orgs: [...s.orgs, o],
        memberships: [...s.memberships, { organization_id: o.id, user_id: s.sessionUserId, role: "owner", created_at: new Date().toISOString() }],
      });
      return o.id;
    },
    async updateOrganization(patch) {
      if (role !== "owner") throw new Error("Seul le propriétaire peut modifier la salle");
      if (patch.name !== undefined && patch.name.trim().length < 2) throw new Error("Le nom de la salle est trop court");
      if (patch.invoice_prefix !== undefined && !/^[A-Za-z0-9]{1,10}$/.test(patch.invoice_prefix)) throw new Error("Le préfixe de facture ne doit contenir que des lettres et des chiffres");
      if (patch.vat_rate !== undefined && (!Number.isFinite(patch.vat_rate) || patch.vat_rate < 0 || patch.vat_rate > 100)) throw new Error("TVA invalide");
      if (patch.max_reception_discount_pct !== undefined && (!Number.isInteger(patch.max_reception_discount_pct) || patch.max_reception_discount_pct < 0 || patch.max_reception_discount_pct > 100)) throw new Error("Remise maximale invalide");
      if (patch.anti_passback_minutes !== undefined && (!Number.isInteger(patch.anti_passback_minutes) || patch.anti_passback_minutes < 0)) throw new Error("Délai anti-passback invalide");
      const s = load();
      commit({ ...s, orgs: s.orgs.map((o) => (o.id === org?.id ? { ...o, ...patch } : o)) });
    },
    async inviteStaff(email, r) {
      requireAdmin();
      if (r === "owner") throw new Error("Rôle invalide");
      if (r === "manager" && role !== "owner") throw new Error("Seul le propriétaire peut inviter un gérant");
      const e = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(e)) throw new Error("Email invalide");
      const s = load();
      const u = s.users.find((x) => x.email === e);
      if (u) {
        if (s.memberships.some((m) => m.user_id === u.id && m.organization_id === org!.id)) throw new Error("Cette personne fait déjà partie de l'équipe");
        commit({ ...s, memberships: [...s.memberships, { organization_id: org!.id, user_id: u.id, role: r, created_at: new Date().toISOString() }] });
        return "added";
      }
      if (s.invitations.some((i) => i.email === e && i.organization_id === org!.id)) throw new Error("Une invitation est déjà en attente pour cet email");
      commit({ ...s, invitations: [...s.invitations, { id: uid(), organization_id: org!.id, email: e, role: r, invited_by: user!.id, created_at: new Date().toISOString() }] });
      return "invited";
    },
    async cancelInvitation(id) {
      requireAdmin();
      const s = load();
      commit({ ...s, invitations: s.invitations.filter((i) => i.id !== id || i.organization_id !== org?.id) });
    },
    async removeStaff(userId) {
      requireAdmin();
      const s = load();
      const m = s.memberships.find((x) => x.user_id === userId && x.organization_id === org!.id);
      if (!m) throw new Error("Membre de l'équipe introuvable");
      if (m.role === "owner") throw new Error("Le propriétaire ne peut pas être retiré");
      if (m.role === "manager" && role !== "owner") throw new Error("Seul le propriétaire peut retirer un gérant");
      commit({ ...s, memberships: s.memberships.filter((x) => x !== m && !(x.user_id === userId && x.organization_id === org!.id)) });
    },
    async changeStaffRole(userId, r) {
      if (role !== "owner") throw new Error("Seul le propriétaire peut changer les rôles");
      if (r === "owner") throw new Error("Rôle invalide");
      const s = load();
      const m = s.memberships.find((x) => x.user_id === userId && x.organization_id === org!.id);
      if (m?.role === "owner") throw new Error("Le rôle du propriétaire ne peut pas changer");
      commit({ ...s, memberships: s.memberships.map((x) => (x === m ? { ...x, role: r } : x)) });
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
