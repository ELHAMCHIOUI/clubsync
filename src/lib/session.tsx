// Session, salle, rôle et équipe : version RÉELLE (Supabase Auth + tables organization_members,
// organizations, staff_overview, staff_invitations + fonctions SQL). Même API que mock-session.tsx :
// les pages utilisent useOrg() sans changement.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { friendlyError, supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StaffRole = "owner" | "manager" | "receptionist";
export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Propriétaire",
  manager: "Gérant",
  receptionist: "Réception",
};

export interface Profile {
  id: string;
  full_name: string;
  email: string;
}
export interface Organization {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  ice: string | null;
  tax_id: string | null;
  invoice_prefix: string;
  vat_rate: number;
  max_reception_discount_pct: number;
  anti_passback_minutes: number;
  created_at: string;
}
export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: StaffRole;
  invited_by: string;
  created_at: string;
}
export interface StaffRow {
  organization_id: string;
  user_id: string;
  role: StaffRole;
  created_at: string;
  full_name: string;
  email: string;
}

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
}
const OrgContext = createContext<Ctx | null>(null);

const blankToNull = (v: string | null | undefined) => (v ? v : null);

interface State {
  profile: Profile | null;
  org: Organization | null;
  role: StaffRole | null;
  staff: StaffRow[];
  invitations: Invitation[];
}
const EMPTY: State = { profile: null, org: null, role: null, staff: [], invitations: [] };

async function loadState(userId: string, email: string): Promise<State> {
  const [{ data: profileRow }, { data: membership, error: mError }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("id", userId).maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);
  if (mError) throw friendlyError(mError);
  const profile: Profile = {
    id: userId,
    full_name: profileRow?.full_name || email,
    email: profileRow?.email || email,
  };
  if (!membership) return { ...EMPTY, profile };

  const role = membership.role as StaffRole;
  const isAdmin = role === "owner" || role === "manager";
  const [{ data: o, error: oError }, { data: staffRows }, invitationsResult] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", membership.organization_id).single(),
    supabase
      .from("staff_overview")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .order("created_at"),
    isAdmin
      ? supabase
          .from("staff_invitations")
          .select("*")
          .eq("organization_id", membership.organization_id)
          .order("created_at")
      : Promise.resolve({ data: [] as never[] }),
  ]);
  if (oError || !o) throw friendlyError(oError);

  return {
    profile,
    role,
    org: {
      id: o.id,
      name: o.name,
      phone: blankToNull(o.phone),
      address: blankToNull(o.address),
      city: blankToNull(o.city),
      ice: blankToNull(o.ice),
      tax_id: blankToNull(o.tax_id),
      invoice_prefix: o.invoice_prefix,
      vat_rate: Number(o.vat_rate),
      max_reception_discount_pct: Number(o.max_reception_discount_pct),
      anti_passback_minutes: o.anti_passback_minutes,
      created_at: o.created_at,
    },
    staff: (staffRows ?? []).map((s) => ({
      organization_id: s.organization_id!,
      user_id: s.user_id!,
      role: s.role as StaffRole,
      created_at: s.created_at!,
      full_name: s.full_name || s.email || "—",
      email: s.email ?? "—",
    })),
    invitations: (invitationsResult.data ?? []).map((i) => ({
      id: i.id,
      organization_id: i.organization_id,
      email: i.email,
      role: i.role as StaffRole,
      invited_by: i.invited_by ?? "",
      created_at: i.created_at,
    })),
  };
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [ready, setReady] = useState(false);
  const userRef = useRef<{ id: string; email: string } | null>(null);

  const reload = useCallback(async () => {
    const u = userRef.current;
    if (!u) {
      setState(EMPTY);
      return;
    }
    setState(await loadState(u.id, u.email));
  }, []);

  useEffect(() => {
    let alive = true;
    const apply = async (user: { id: string; email?: string | null } | null) => {
      userRef.current = user ? { id: user.id, email: user.email ?? "" } : null;
      try {
        if (user) {
          const s = await loadState(user.id, user.email ?? "");
          if (alive) setState(s);
        } else if (alive) setState(EMPTY);
      } catch (e) {
        console.error(e);
        if (alive) setState(EMPTY);
      } finally {
        if (alive) setReady(true);
      }
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Évite de recharger à chaque rafraîchissement de jeton
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      // Appel différé : ne pas appeler Supabase directement dans ce callback
      setTimeout(() => void apply(session?.user ?? null), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { profile, org, role } = state;
  const isAdmin = role === "owner" || role === "manager";

  const value: Ctx = {
    ready,
    profile,
    org,
    role,
    isAdmin,
    isOwner: role === "owner",
    staff: state.staff,
    invitations: state.invitations,

    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw friendlyError(error);
    },
    async signUp(fullName, email, password) {
      if (password.length < 8)
        throw new Error("Le mot de passe doit contenir au moins 8 caractères");
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options:
          typeof window !== "undefined"
            ? {
                data: { full_name: fullName.trim() },
                emailRedirectTo: `${window.location.origin}/login`,
              }
            : { data: { full_name: fullName.trim() } },
      });
      if (error) throw friendlyError(error);
      return { session: !!data.session };
    },
    signOut() {
      void supabase.auth.signOut();
    },

    async createOrganization(name) {
      if (name.trim().length < 2) throw new Error("Le nom de la salle est trop court");
      const { data, error } = await supabase.rpc("create_organization", { p_name: name.trim() });
      if (error) throw friendlyError(error);
      await reload();
      return data as string;
    },
    async updateOrganization(patch) {
      if (!org) throw new Error("Aucune salle");
      if (role !== "owner") throw new Error("Seul le propriétaire peut modifier la salle");
      if (patch.name !== undefined && patch.name.trim().length < 2)
        throw new Error("Le nom de la salle est trop court");
      if (patch.invoice_prefix !== undefined && !/^[A-Za-z0-9]{1,10}$/.test(patch.invoice_prefix))
        throw new Error("Le préfixe de facture ne doit contenir que des lettres et des chiffres");
      const row: Database["public"]["Tables"]["organizations"]["Update"] = {};
      if (patch.name !== undefined) row.name = patch.name.trim();
      if (patch.phone !== undefined) row.phone = patch.phone ?? "";
      if (patch.address !== undefined) row.address = patch.address ?? "";
      if (patch.city !== undefined) row.city = patch.city ?? "";
      if (patch.ice !== undefined) row.ice = patch.ice ?? "";
      if (patch.tax_id !== undefined) row.tax_id = patch.tax_id ?? "";
      if (patch.invoice_prefix !== undefined) row.invoice_prefix = patch.invoice_prefix;
      if (patch.vat_rate !== undefined) row.vat_rate = patch.vat_rate;
      if (patch.max_reception_discount_pct !== undefined)
        row.max_reception_discount_pct = patch.max_reception_discount_pct;
      if (patch.anti_passback_minutes !== undefined)
        row.anti_passback_minutes = patch.anti_passback_minutes;
      const { data, error } = await supabase
        .from("organizations")
        .update(row)
        .eq("id", org.id)
        .select("id");
      if (error) throw friendlyError(error);
      if (!data?.length) throw new Error("Seul le propriétaire peut modifier la salle");
      await reload();
    },
    async inviteStaff(email, r) {
      if (!org) throw new Error("Aucune salle");
      const { data, error } = await supabase.rpc("invite_staff", {
        p_org: org.id,
        p_email: email.trim().toLowerCase(),
        p_role: r,
      });
      if (error) throw friendlyError(error);
      await reload();
      return data as "added" | "invited";
    },
    async cancelInvitation(id) {
      const { error } = await supabase.from("staff_invitations").delete().eq("id", id);
      if (error) throw friendlyError(error);
      await reload();
    },
    async removeStaff(userId) {
      if (!org) throw new Error("Aucune salle");
      const { error } = await supabase.rpc("remove_staff", { p_org: org.id, p_user: userId });
      if (error) throw friendlyError(error);
      await reload();
    },
    async changeStaffRole(userId, r) {
      if (!org) throw new Error("Aucune salle");
      const { error } = await supabase.rpc("change_staff_role", {
        p_org: org.id,
        p_user: userId,
        p_role: r,
      });
      if (error) throw friendlyError(error);
      await reload();
    },
  };
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const c = useContext(OrgContext);
  if (!c) throw new Error("useOrg doit être utilisé dans OrgProvider");
  return c;
}
