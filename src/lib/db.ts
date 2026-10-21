// =====================================================================
// Données RÉELLES (Supabase). Même API que mock-db.ts : les pages appellent
// des fonctions synchrones (lecture) et des fonctions async (écriture).
//
// Fonctionnement : les données de la salle sont chargées en mémoire depuis les
// vues et tables Supabase (RLS = uniquement la salle de l'utilisateur), puis
// rechargées après chaque écriture, toutes les 60 s et au retour sur l'onglet.
// Les règles métier (rôles, plafonds, points, anti-retour…) sont dans les
// fonctions SQL appelées par supabase.rpc : ce fichier ne fait que les appeler.
// =====================================================================
import { useSyncExternalStore } from "react";
import { friendlyError, supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { todayLocal } from "./format";
import type { StaffRole } from "./session";

export type SubState = "active" | "frozen" | "cancelled";
export type SubStatus = "active" | "upcoming" | "expired" | "frozen" | "cancelled";
export type PaymentMethod = "cash" | "transfer" | "card" | "cheque";
export type LoyaltyKind =
  | "welcome"
  | "visit"
  | "subscription"
  | "renewal"
  | "referral"
  | "redemption"
  | "adjustment"
  | "expiration";

export interface Member {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  whatsapp_opt_in: boolean;
  photo_path: string | null;
  referred_by: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
}
export interface MemberCard {
  member_id: string;
  organization_id: string;
  qr_token: string;
  link_token: string;
  issued_at: string;
  regenerated_at: string | null;
}
export interface Plan {
  id: string;
  organization_id: string;
  name: string;
  duration_months: number;
  price_cents: number;
  is_active: boolean;
  created_at: string;
}
export interface Subscription {
  id: string;
  organization_id: string;
  member_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  state: SubState;
  frozen_from: string | null;
  amount_due_cents: number;
  discount_cents: number;
  created_at: string;
}
export interface Payment {
  id: string;
  organization_id: string;
  subscription_id: string;
  member_id: string;
  amount_cents: number;
  method: PaymentMethod;
  paid_at: string;
  reference: string | null;
  note: string | null;
  received_by: string | null;
  received_by_name: string | null;
  voided_at: string | null;
  void_reason: string | null;
}
export interface Attendance {
  id: string;
  organization_id: string;
  member_id: string;
  result: "accepted" | "refused";
  reason: string | null;
  method: "qr" | "manual";
  created_at: string;
  scanned_by_name: string | null;
}
export interface LedgerRow {
  id: string;
  organization_id: string;
  member_id: string;
  kind: LoyaltyKind;
  points: number;
  note: string | null;
  created_at: string;
}
export interface LoyaltySettings {
  organization_id: string;
  enabled: boolean;
  points_per_visit: number;
  welcome_points: number;
  points_per_month: number;
  renewal_bonus: number;
  referral_points: number;
  expiry_months: number;
}
export type RewardType = "guest_pass" | "discount" | "free_days" | "goodie" | "partner" | "other";
export interface Reward {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  reward_type: RewardType;
  points_cost: number;
  is_active: boolean;
  created_at: string;
}
export interface Redemption {
  id: string;
  organization_id: string;
  member_id: string;
  reward_id: string;
  reward_name: string;
  points_cost: number;
  note: string | null;
  given_by: string | null;
  created_at: string;
}
export interface CashClosing {
  id: string;
  organization_id: string;
  day: string;
  expected_cents: number;
  counted_cents: number;
  difference_cents: number;
  note: string | null;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_at: string;
  validated_by: string | null;
  validated_at: string | null;
}
export interface Expense {
  id: string;
  organization_id: string;
  category: string;
  label: string;
  amount_cents: number;
  method: PaymentMethod;
  spent_on: string;
  created_by: string | null;
  created_at: string;
}
export interface Invoice {
  id: string;
  organization_id: string;
  member_id: string;
  subscription_id: string;
  number: number;
  issued_on: string;
  total_cents: number;
  vat_rate: number;
  created_by: string | null;
  created_at: string;
}
export type ReminderKind = "expiry" | "unpaid";
export interface ReminderTemplate {
  id: string;
  organization_id: string;
  kind: ReminderKind;
  offset_days: number;
  template: string;
  is_active: boolean;
}
export interface ReminderLog {
  id: string;
  organization_id: string;
  member_id: string;
  subscription_id: string;
  kind: ReminderKind;
  sent_by: string | null;
  sent_at: string;
}

export interface SubscriptionOverview extends Subscription {
  member_name: string;
  member_phone: string | null;
  member_whatsapp_opt_in: boolean;
  member_archived: boolean;
  plan_name: string;
  plan_duration_months: number;
  paid_cents: number;
  balance_cents: number;
  status: SubStatus;
  days_left: number;
}
export interface MemberOverview extends Member {
  subscription_id: string | null;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  subscription_status: SubStatus | null;
  days_left: number | null;
  balance_cents: number;
  points: number;
  last_visit_at: string | null;
}
export interface AttendanceOverview extends Attendance {
  member_name: string;
  created_local: string;
  created_on: string;
}
export interface PaymentOverview extends Payment {
  member_name: string;
  plan_name: string;
  paid_local: string;
  paid_on: string;
}

// ---------------------------------------------------------------------
// Cache en mémoire
// ---------------------------------------------------------------------
interface Data {
  members: Member[];
  memberOv: MemberOverview[];
  cards: MemberCard[];
  plans: Plan[];
  subs: SubscriptionOverview[];
  payments: PaymentOverview[];
  attendance: AttendanceOverview[];
  ledger: LedgerRow[];
  loyalty: LoyaltySettings | null;
  rewards: Reward[];
  redemptions: Redemption[];
  invoices: Invoice[];
  templates: ReminderTemplate[];
  reminderLogs: ReminderLog[];
  cashClosings: CashClosing[];
  expenses: Expense[];
}
const blank = (): Data => ({
  members: [],
  memberOv: [],
  cards: [],
  plans: [],
  subs: [],
  payments: [],
  attendance: [],
  ledger: [],
  loyalty: null,
  rewards: [],
  redemptions: [],
  invoices: [],
  templates: [],
  reminderLogs: [],
  cashClosings: [],
  expenses: [],
});

let cache: Data = blank();
let version = 0;
let loaded = false;
let loadError: string | null = null;
const listeners = new Set<() => void>();
const photoUrls = new Map<string, { url: string; expires: number }>();

function notify() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Re-rendu des pages quand les données changent (même API que la base simulée). */
export function useDb(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}
/** true quand le premier chargement de la salle est terminé. */
export function useDbReady(): { loaded: boolean; error: string | null } {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return { loaded, error: loadError };
}

// ---------- Acteur courant ----------
interface Actor {
  userId: string;
  name: string;
  role: StaffRole;
  orgId: string;
  antiPassbackMinutes: number;
}
let actor: Actor | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export function setActor(a: Actor | null) {
  const changed =
    !a || !actor || a.orgId !== actor.orgId || a.userId !== actor.userId || a.role !== actor.role;
  actor = a;
  if (!changed) return;
  cache = blank();
  loaded = false;
  loadError = null;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (!a || typeof window === "undefined") return;
  void refresh();
  timer = setInterval(() => void refresh(), 60_000);
  window.addEventListener("focus", onFocus);
}
function onFocus() {
  if (actor) void refresh();
}
function me(): Actor {
  if (!actor) throw new Error("Vous devez être connecté");
  return actor;
}
const isAdmin = () => me().role !== "receptionist";
const requireAdmin = () => {
  if (!isAdmin()) throw new Error("Action réservée au gérant");
};

// ---------- Chargement ----------
const nn = (v: string | null | undefined) => (v ? v : null);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const dayOf = (n: number) => todayLocal(new Date(Date.now() - n * 86_400_000));

type Res<T> = { data: T[] | null; error: { message: string } | null };
/** Lit toutes les lignes (Supabase renvoie 1000 lignes max par requête). */
async function all<T>(
  query: (from: number, to: number) => PromiseLike<Res<T>>,
  max = 20_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw friendlyError(error);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

let inflight: Promise<void> | null = null;
let queued = false;

/** Recharge toutes les données de la salle. Les appels simultanés sont regroupés. */
export async function refresh(): Promise<void> {
  if (inflight) {
    queued = true;
    return inflight;
  }
  inflight = (async () => {
    try {
      do {
        queued = false;
        await load();
      } while (queued);
      loaded = true;
      loadError = null;
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
      console.error("Chargement des données :", e);
      loaded = true;
    } finally {
      inflight = null;
      notify();
    }
  })();
  return inflight;
}

async function load() {
  const a = actor;
  if (!a) return;
  const org = a.orgId;
  const admin = a.role !== "receptionist";
  const since13m = dayOf(400);

  const [
    staff,
    members,
    memberOv,
    cards,
    plans,
    subs,
    payments,
    attendance,
    ledger,
    loyalty,
    rewards,
    redemptions,
    invoices,
    templates,
    reminderLogs,
    cashClosings,
    expenses,
  ] = await Promise.all([
    all((f, t) =>
      supabase
        .from("staff_overview")
        .select("user_id, full_name, email")
        .eq("organization_id", org)
        .range(f, t),
    ),
    all((f, t) =>
      supabase
        .from("members")
        .select("*")
        .eq("organization_id", org)
        .order("full_name")
        .range(f, t),
    ),
    all((f, t) =>
      supabase
        .from("member_overview")
        .select("*")
        .eq("organization_id", org)
        .order("full_name")
        .range(f, t),
    ),
    all((f, t) => supabase.from("member_cards").select("*").eq("organization_id", org).range(f, t)),
    all((f, t) =>
      supabase
        .from("plans")
        .select("*")
        .eq("organization_id", org)
        .order("duration_months")
        .range(f, t),
    ),
    all((f, t) =>
      supabase
        .from("subscription_overview")
        .select("*")
        .eq("organization_id", org)
        .order("start_date", { ascending: false })
        .range(f, t),
    ),
    all((f, t) =>
      supabase
        .from("payment_overview")
        .select("*")
        .eq("organization_id", org)
        .gte("paid_on", since13m)
        .order("paid_at", { ascending: false })
        .range(f, t),
    ),
    all((f, t) =>
      supabase
        .from("attendance_overview")
        .select("*")
        .eq("organization_id", org)
        .gte("created_on", dayOf(90))
        .order("created_at", { ascending: false })
        .range(f, t),
    ),
    all((f, t) =>
      supabase
        .from("loyalty_ledger")
        .select("id, organization_id, member_id, kind, points, note, created_at")
        .eq("organization_id", org)
        .gte("created_at", daysAgo(400))
        .order("created_at", { ascending: false })
        .range(f, t),
    ),
    supabase.from("loyalty_settings").select("*").eq("organization_id", org).maybeSingle(),
    all((f, t) =>
      supabase
        .from("rewards")
        .select("*")
        .eq("organization_id", org)
        .order("points_cost")
        .range(f, t),
    ),
    all(
      (f, t) =>
        supabase
          .from("redemptions")
          .select("*")
          .eq("organization_id", org)
          .order("created_at", { ascending: false })
          .range(f, t),
      2000,
    ),
    all((f, t) =>
      supabase
        .from("invoices")
        .select("*")
        .eq("organization_id", org)
        .order("created_at", { ascending: false })
        .range(f, t),
    ),
    all((f, t) =>
      supabase.from("reminder_templates").select("*").eq("organization_id", org).range(f, t),
    ),
    all((f, t) =>
      supabase
        .from("reminder_logs")
        .select("*")
        .eq("organization_id", org)
        .gte("sent_at", daysAgo(90))
        .range(f, t),
    ),
    supabase
      .from("cash_closings")
      .select("*")
      .eq("organization_id", org)
      .order("day", { ascending: false })
      .limit(60),
    admin
      ? all((f, t) =>
          supabase
            .from("expenses")
            .select("*")
            .eq("organization_id", org)
            .gte("spent_on", since13m)
            .order("spent_on", { ascending: false })
            .range(f, t),
        )
      : Promise.resolve([]),
  ]);
  if (loyalty.error) throw friendlyError(loyalty.error);
  if (cashClosings.error) throw friendlyError(cashClosings.error);

  const staffName = new Map(staff.map((s) => [s.user_id!, s.full_name || s.email || "—"]));

  // Photos privées : URL signées (1 h), renouvelées avant expiration
  const paths = members
    .map((m) => m.photo_path)
    .filter((p): p is string => !!p && !p.startsWith("data:"));
  const missing = paths.filter((p) => (photoUrls.get(p)?.expires ?? 0) < Date.now() + 5 * 60_000);
  if (missing.length) {
    const { data } = await supabase.storage.from("member-photos").createSignedUrls(missing, 3600);
    for (const s of data ?? [])
      if (s.path && s.signedUrl)
        photoUrls.set(s.path, { url: s.signedUrl, expires: Date.now() + 3600_000 });
  }
  const photo = (p: string | null) => (p ? (photoUrls.get(p)?.url ?? null) : null);

  cache = {
    members: members.map((m) => ({
      id: m.id,
      organization_id: m.organization_id,
      full_name: m.full_name,
      phone: nn(m.phone),
      email: nn(m.email),
      notes: nn(m.notes),
      whatsapp_opt_in: m.whatsapp_opt_in,
      photo_path: photo(m.photo_path),
      referred_by: m.referred_by,
      archived_at: m.archived_at,
      created_by: m.created_by,
      created_at: m.created_at,
    })),
    memberOv: memberOv.map((m) => ({
      id: m.id!,
      organization_id: m.organization_id!,
      full_name: m.full_name ?? "",
      phone: nn(m.phone),
      email: nn(m.email),
      notes: nn(m.notes),
      whatsapp_opt_in: m.whatsapp_opt_in ?? false,
      photo_path: photo(m.photo_path),
      referred_by: m.referred_by,
      archived_at: m.archived_at,
      created_by: null,
      created_at: m.created_at!,
      subscription_id: m.subscription_id,
      plan_name: m.plan_name,
      start_date: m.start_date,
      end_date: m.end_date,
      subscription_status: (m.subscription_status as SubStatus | null) ?? null,
      days_left: m.days_left,
      balance_cents: m.balance_cents ?? 0,
      points: m.points ?? 0,
      last_visit_at: m.last_visit_at,
    })),
    cards: cards.map((c) => ({ ...c })),
    plans: plans.map((p) => ({ ...p })),
    subs: subs.map((s) => ({
      id: s.id!,
      organization_id: s.organization_id!,
      member_id: s.member_id!,
      plan_id: s.plan_id!,
      start_date: s.start_date!,
      end_date: s.end_date!,
      state: s.state as SubState,
      frozen_from: s.frozen_from,
      amount_due_cents: s.amount_due_cents ?? 0,
      discount_cents: s.discount_cents ?? 0,
      created_at: s.created_at!,
      member_name: s.member_name ?? "—",
      member_phone: nn(s.member_phone),
      member_whatsapp_opt_in: s.member_whatsapp_opt_in ?? false,
      member_archived: s.member_archived ?? false,
      plan_name: s.plan_name ?? "—",
      plan_duration_months: s.plan_duration_months ?? 0,
      paid_cents: s.paid_cents ?? 0,
      balance_cents: Math.max(0, s.balance_cents ?? 0),
      status: (s.status ?? "active") as SubStatus,
      days_left: s.days_left ?? 0,
    })),
    payments: payments.map((p) => ({
      id: p.id!,
      organization_id: p.organization_id!,
      subscription_id: p.subscription_id!,
      member_id: p.member_id!,
      amount_cents: p.amount_cents ?? 0,
      method: p.method as PaymentMethod,
      paid_at: p.paid_at!,
      reference: nn(p.reference),
      note: nn(p.note),
      received_by: p.received_by,
      received_by_name:
        p.received_by_name ?? (p.received_by ? (staffName.get(p.received_by) ?? null) : null),
      voided_at: p.voided_at,
      void_reason: p.void_reason,
      member_name: p.member_name ?? "—",
      plan_name: p.plan_name ?? "—",
      paid_local: p.paid_at!,
      paid_on: p.paid_on!,
    })),
    attendance: attendance.map((x) => ({
      id: String(x.id),
      organization_id: x.organization_id!,
      member_id: x.member_id!,
      result: x.result as "accepted" | "refused",
      reason: nn(x.reason),
      method: x.method as "qr" | "manual",
      created_at: x.created_at!,
      scanned_by_name: x.scanned_by_name,
      member_name: x.member_name ?? "—",
      created_local: x.created_at!,
      created_on: x.created_on!,
    })),
    ledger: ledger.map((l) => ({ ...l, id: String(l.id), note: nn(l.note) })),
    loyalty: loyalty.data ? { ...loyalty.data } : null,
    rewards: rewards.map((r) => ({ ...r, description: nn(r.description) })),
    redemptions: redemptions.map((r) => ({ ...r, note: nn(r.note) })),
    invoices: invoices.map((i) => ({ ...i, vat_rate: Number(i.vat_rate) })),
    templates: templates.map((t) => ({ ...t })),
    reminderLogs: reminderLogs.map((r) => ({
      ...r,
      id: String(r.id),
      subscription_id: r.subscription_id ?? "",
    })),
    cashClosings: (cashClosings.data ?? []).map((c) => ({
      ...c,
      difference_cents: c.difference_cents ?? c.counted_cents - c.expected_cents,
      note: nn(c.note),
      closed_by_name: c.closed_by ? (staffName.get(c.closed_by) ?? null) : null,
    })),
    expenses: expenses.map((e) => ({ ...e })),
  };

  // Abonnement « en cours » d'un membre : actif d'abord, puis gelé, à venir, expiré (comme l'interface Lovable)
  const rank: Record<SubStatus, number> = {
    active: 0,
    frozen: 1,
    upcoming: 2,
    expired: 3,
    cancelled: 4,
  };
  const byMember = new Map<string, SubscriptionOverview[]>();
  for (const s of cache.subs) byMember.set(s.member_id, [...(byMember.get(s.member_id) ?? []), s]);
  cache.memberOv = cache.memberOv.map((m) => {
    const cur = (byMember.get(m.id) ?? [])
      .filter((s) => s.status !== "cancelled")
      .sort(
        (a, b) => rank[a.status] - rank[b.status] || b.start_date.localeCompare(a.start_date),
      )[0];
    return cur
      ? {
          ...m,
          subscription_id: cur.id,
          plan_name: cur.plan_name,
          start_date: cur.start_date,
          end_date: cur.end_date,
          subscription_status: cur.status,
          days_left: cur.days_left,
        }
      : {
          ...m,
          subscription_id: null,
          plan_name: null,
          start_date: null,
          end_date: null,
          subscription_status: null,
          days_left: null,
        };
  });
}

/** Exécute une écriture puis recharge les données. */
async function write<T>(
  fn: () => PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await fn();
  if (error) throw friendlyError(error);
  await refresh();
  return data;
}

// ---------------------------------------------------------------------
// Lectures (synchrones, depuis le cache)
// ---------------------------------------------------------------------
export function subStatus(s: Subscription, today = todayLocal()): SubStatus {
  if (s.state === "cancelled") return "cancelled";
  if (s.state === "frozen") return "frozen";
  if (today < s.start_date) return "upcoming";
  if (today > s.end_date) return "expired";
  return "active";
}
export function subscriptionOverview(_orgId: string): SubscriptionOverview[] {
  return cache.subs;
}
export function memberOverview(_orgId: string): MemberOverview[] {
  return cache.memberOv;
}
export function memberPoints(memberId: string) {
  return cache.memberOv.find((m) => m.id === memberId)?.points ?? 0;
}
export function attendanceOverview(_orgId: string): AttendanceOverview[] {
  return cache.attendance;
}
export function getCard(memberId: string) {
  return cache.cards.find((c) => c.member_id === memberId) ?? null;
}
export function loyaltySettings(_orgId: string) {
  return cache.loyalty;
}
export function plans(_orgId: string) {
  return cache.plans;
}
export function rewards(_orgId: string) {
  return cache.rewards;
}
export function members(_orgId: string) {
  return cache.members;
}
export function memberLedger(memberId: string) {
  return cache.ledger.filter((l) => l.member_id === memberId);
}
export function paymentOverview(_orgId: string): PaymentOverview[] {
  return cache.payments;
}
export function invoices(_orgId: string) {
  return cache.invoices;
}
export function reminderTemplates(_orgId: string) {
  return cache.templates;
}
export function lastReminder(subId: string) {
  return (
    cache.reminderLogs
      .filter((r) => r.subscription_id === subId)
      .map((r) => r.sent_at)
      .sort()
      .pop() ?? null
  );
}
export function pickTemplate(orgId: string, kind: ReminderKind, daysLeft: number) {
  const t = reminderTemplates(orgId).filter((x) => x.kind === kind && x.is_active);
  if (kind === "unpaid") return t[0] ?? null;
  return (
    (daysLeft < 0 ? t.find((x) => x.offset_days > 0) : t.find((x) => x.offset_days <= 0)) ?? null
  );
}
export function expenses(_orgId: string) {
  return cache.expenses;
}
export function cashClosings(_orgId: string) {
  return cache.cashClosings;
}
export function redemptions(_orgId: string) {
  const names = new Map(cache.members.map((m) => [m.id, m.full_name]));
  return cache.redemptions.map((r) => ({ ...r, member_name: names.get(r.member_id) ?? "—" }));
}
export function ledgerOverview(_orgId: string) {
  const names = new Map(cache.members.map((m) => [m.id, m.full_name]));
  return cache.ledger.map((l) => ({ ...l, member_name: names.get(l.member_id) ?? "—" }));
}
/** Plus de codes de démonstration : la base est réelle. */
export function demoCodes(_orgId: string): { code: string; name: string }[] {
  return [];
}

export function revenueByMonth(orgId: string) {
  const out = new Map<string, Record<PaymentMethod, number>>();
  for (const p of paymentOverview(orgId)) {
    if (p.voided_at) continue;
    const k = p.paid_on.slice(0, 7);
    const row = out.get(k) ?? { cash: 0, card: 0, transfer: 0, cheque: 0 };
    row[p.method] += p.amount_cents;
    out.set(k, row);
  }
  return out;
}
export function monthTotals(orgId: string, ym: string) {
  const rev = paymentOverview(orgId).filter((p) => !p.voided_at && p.paid_on.startsWith(ym));
  const exp = expenses(orgId).filter((e) => e.spent_on.startsWith(ym));
  return {
    revenue: rev.reduce((a, p) => a + p.amount_cents, 0),
    expenses: exp.reduce((a, e) => a + e.amount_cents, 0),
  };
}
export const EXPENSE_CATEGORIES = [
  "Loyer",
  "Salaires",
  "Électricité",
  "Eau",
  "Internet & téléphone",
  "Matériel",
  "Entretien & ménage",
  "Marketing",
  "Impôts & taxes",
  "Autre",
] as const;
export function accountingSummary(orgId: string, ym: string) {
  // Réception : la base ne renvoie aucune charge (RLS) et la page est réservée au gérant ;
  // on renvoie un résumé vide plutôt qu'une erreur pendant la redirection.
  if (!actor || actor.role === "receptionist") {
    return {
      revenue: 0,
      expenses: 0,
      net: 0,
      billed: 0,
      byMethod: [] as { method: PaymentMethod; revenue: number; expenses: number }[],
      byCategory: [] as { category: string; total: number }[],
      payments: [] as PaymentOverview[],
      charges: [] as Expense[],
    };
  }
  const payments = paymentOverview(orgId).filter((p) => !p.voided_at && p.paid_on.startsWith(ym));
  const charges = expenses(orgId).filter((e) => e.spent_on.startsWith(ym));
  const byMethod = (["cash", "card", "transfer", "cheque"] as PaymentMethod[]).map((method) => ({
    method,
    revenue: payments.filter((p) => p.method === method).reduce((s, p) => s + p.amount_cents, 0),
    expenses: charges.filter((e) => e.method === method).reduce((s, e) => s + e.amount_cents, 0),
  }));
  const byCategory = EXPENSE_CATEGORIES.map((category) => ({
    category,
    total: charges.filter((e) => e.category === category).reduce((s, e) => s + e.amount_cents, 0),
  })).filter((e) => e.total > 0);
  const revenue = payments.reduce((s, p) => s + p.amount_cents, 0);
  const totalExpenses = charges.reduce((s, e) => s + e.amount_cents, 0);
  const billed = invoices(orgId)
    .filter((i) => i.issued_on.startsWith(ym))
    .reduce((s, i) => s + i.total_cents, 0);
  return {
    revenue,
    expenses: totalExpenses,
    net: revenue - totalExpenses,
    billed,
    byMethod,
    byCategory,
    payments,
    charges,
  };
}

// ---------------------------------------------------------------------
// Entrées (check-in)
// ---------------------------------------------------------------------
export interface CheckInResult {
  result: "accepted" | "refused";
  reason: string | null;
  points_earned: number;
  member: {
    id: string;
    full_name: string;
    phone: string | null;
    photo_path: string | null;
    plan_name: string | null;
    end_date: string | null;
    status: SubStatus | null;
    days_left: number | null;
    balance_cents: number;
    points: number;
  } | null;
}
interface RawCheckIn {
  result: "accepted" | "refused";
  reason: string;
  points_earned: number;
  member: {
    id: string;
    full_name: string;
    phone: string;
    photo_path: string | null;
    plan_name: string | null;
    end_date: string | null;
    status: SubStatus | null;
    days_left: number | null;
    balance_cents: number;
    points: number;
  } | null;
}
async function toCheckIn(raw: RawCheckIn): Promise<CheckInResult> {
  let photoUrl: string | null = null;
  if (raw.member?.photo_path) {
    const { data } = await supabase.storage
      .from("member-photos")
      .createSignedUrl(raw.member.photo_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }
  void refresh();
  return {
    result: raw.result,
    reason: nn(raw.reason),
    points_earned: raw.points_earned ?? 0,
    member: raw.member
      ? { ...raw.member, phone: nn(raw.member.phone), photo_path: photoUrl }
      : null,
  };
}
export async function rpcCheckIn(orgId: string, qrToken: string): Promise<CheckInResult> {
  const code = qrToken.trim();
  if (!code) throw new Error("Code vide");
  const { data, error } = await supabase.rpc("check_in", { p_org: orgId, p_qr_token: code });
  if (error) throw friendlyError(error);
  return toCheckIn(data as unknown as RawCheckIn);
}
export async function rpcManualCheckIn(memberId: string, reason: string): Promise<CheckInResult> {
  if (reason.trim().length < 3) throw new Error("Le motif de l'entrée manuelle est obligatoire");
  const { data, error } = await supabase.rpc("manual_check_in", {
    p_member: memberId,
    p_reason: reason.trim(),
  });
  if (error) throw friendlyError(error);
  return toCheckIn(data as unknown as RawCheckIn);
}

// ---------------------------------------------------------------------
// Membres et carte
// ---------------------------------------------------------------------
async function uploadPhoto(memberId: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${me().orgId}/${memberId}.jpg`;
  const { error } = await supabase.storage
    .from("member-photos")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "60" });
  if (error) throw friendlyError(error);
  photoUrls.delete(path);
  return path;
}

export async function insertMember(input: {
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  whatsapp_opt_in: boolean;
  referred_by: string | null;
}) {
  const a = me();
  if (input.full_name.trim().length < 2) throw new Error("Le nom complet est obligatoire");
  const row = await write(() =>
    supabase
      .from("members")
      .insert({
        organization_id: a.orgId,
        full_name: input.full_name.trim(),
        phone: input.phone ?? "",
        email: input.email ?? "",
        notes: input.notes ?? "",
        whatsapp_opt_in: input.whatsapp_opt_in,
        referred_by: input.referred_by,
        created_by: a.userId,
      })
      .select("*")
      .single(),
  );
  if (!row) throw new Error("Membre non créé");
  return { ...row, phone: nn(row.phone), email: nn(row.email), notes: nn(row.notes) } as Member;
}
export async function updateMember(
  id: string,
  patch: Partial<
    Pick<
      Member,
      | "full_name"
      | "phone"
      | "email"
      | "notes"
      | "whatsapp_opt_in"
      | "photo_path"
      | "archived_at"
      | "referred_by"
    >
  >,
) {
  if (patch.full_name !== undefined && patch.full_name.trim().length < 2)
    throw new Error("Le nom complet est obligatoire");
  const row: Database["public"]["Tables"]["members"]["Update"] = {};
  if (patch.full_name !== undefined) row.full_name = patch.full_name.trim();
  if (patch.phone !== undefined) row.phone = patch.phone ?? "";
  if (patch.email !== undefined) row.email = patch.email ?? "";
  if (patch.notes !== undefined) row.notes = patch.notes ?? "";
  if (patch.whatsapp_opt_in !== undefined) row.whatsapp_opt_in = patch.whatsapp_opt_in;
  if (patch.archived_at !== undefined) row.archived_at = patch.archived_at;
  if (patch.referred_by !== undefined) row.referred_by = patch.referred_by;
  if (patch.photo_path !== undefined && !patch.photo_path?.startsWith("http")) {
    // Photo prise à la réception (data URL) → envoyée dans Storage ; on enregistre le chemin, pas l'image
    row.photo_path =
      patch.photo_path && patch.photo_path.startsWith("data:")
        ? await uploadPhoto(id, patch.photo_path)
        : patch.photo_path;
  }
  const data = await write(() => supabase.from("members").update(row).eq("id", id).select("id"));
  if (!data?.length) throw new Error("Membre introuvable");
}
export async function deleteMember(id: string) {
  if (me().role !== "owner") throw new Error("Seul le propriétaire peut supprimer un membre");
  const { data, error } = await supabase.from("members").delete().eq("id", id).select("id");
  if (error) {
    if (/foreign key/i.test(error.message))
      throw new Error("Ce membre a des abonnements : archivez-le");
    throw friendlyError(error);
  }
  if (!data?.length) throw new Error("Seul le propriétaire peut supprimer un membre");
  await refresh();
}
export async function rpcRegenerateCard(memberId: string) {
  requireAdmin();
  await write(() => supabase.rpc("regenerate_card", { p_member: memberId }));
}

// ---------------------------------------------------------------------
// Abonnements, paiements, factures, relances
// ---------------------------------------------------------------------
export async function rpcCreateSubscription(
  i: {
    member: string;
    plan: string;
    start: string;
    discountCents: number;
    firstPaymentCents: number;
    method: PaymentMethod;
    reference: string | null;
  },
  _maxReceptionDiscountPct?: number,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.start)) throw new Error("Date de début invalide");
  return write(() =>
    supabase.rpc("create_subscription", {
      p_member: i.member,
      p_plan: i.plan,
      p_start: i.start,
      p_discount_cents: i.discountCents,
      p_first_payment_cents: i.firstPaymentCents,
      p_method: i.method,
      p_reference: i.reference ?? "",
    }),
  );
}
export async function rpcSetSubscriptionState(
  subId: string,
  action: "freeze" | "unfreeze" | "cancel",
) {
  await write(() => supabase.rpc("set_subscription_state", { p_sub: subId, p_action: action }));
}
export async function rpcUpdateSubscription(
  subId: string,
  start: string,
  end: string,
  amountDueCents: number,
) {
  requireAdmin();
  await write(() =>
    supabase.rpc("update_subscription", {
      p_sub: subId,
      p_start: start,
      p_end: end,
      p_amount_due_cents: amountDueCents,
    }),
  );
}
export async function rpcRecordPayment(
  subId: string,
  cents: number,
  method: PaymentMethod,
  reference: string | null,
  note: string | null,
) {
  if (cents <= 0) throw new Error("Le montant doit être supérieur à zéro");
  return write(() =>
    supabase.rpc("record_payment", {
      p_sub: subId,
      p_amount_cents: cents,
      p_method: method,
      p_reference: reference ?? "",
      p_note: note ?? "",
    }),
  );
}
export async function rpcVoidPayment(paymentId: string, reason: string) {
  requireAdmin();
  if (reason.trim().length < 3) throw new Error("Le motif d'annulation est obligatoire");
  await write(() =>
    supabase.rpc("void_payment", { p_payment: paymentId, p_reason: reason.trim() }),
  );
}
/** Le taux de TVA est repris de la salle par la base (paramètre conservé pour compatibilité). */
export async function rpcCreateInvoice(subId: string, _vatRate?: number): Promise<string> {
  const id = await write(() => supabase.rpc("create_invoice", { p_sub: subId }));
  if (!id) throw new Error("Facture non créée");
  return id;
}
export async function rpcLogReminder(subId: string, kind: ReminderKind) {
  await write(() => supabase.rpc("log_reminder", { p_sub: subId, p_kind: kind }));
}

// ---------------------------------------------------------------------
// Carte publique (sans connexion)
// ---------------------------------------------------------------------
export interface PublicCard {
  gym_name: string;
  gym_phone: string | null;
  member_name: string;
  qr_token: string;
  plan_name: string | null;
  end_date: string | null;
  status: SubStatus | null;
  points: number;
  loyalty_enabled: boolean;
  rewards: { name: string; description: string | null; points_cost: number }[];
}
export async function rpcGetPublicCard(
  linkToken: string,
  _orgLookup?: unknown,
): Promise<PublicCard | null> {
  const { data, error } = await supabase.rpc("get_public_card", { p_link_token: linkToken });
  if (error) throw friendlyError(error);
  if (!data) return null;
  const c = data as unknown as PublicCard;
  return {
    ...c,
    gym_phone: nn(c.gym_phone),
    rewards: (c.rewards ?? []).map((r) => ({ ...r, description: nn(r.description) })),
  };
}

// ---------------------------------------------------------------------
// Fidélité
// ---------------------------------------------------------------------
export async function rpcRedeemReward(memberId: string, rewardId: string, note: string | null) {
  return write(() =>
    supabase.rpc("redeem_reward", { p_member: memberId, p_reward: rewardId, p_note: note ?? "" }),
  );
}
export async function rpcAdjustPoints(memberId: string, points: number, note: string) {
  requireAdmin();
  if (!Number.isInteger(points) || points === 0) throw new Error("Nombre de points invalide");
  if (note.trim().length < 3) throw new Error("Le motif est obligatoire");
  await write(() =>
    supabase.rpc("adjust_points", { p_member: memberId, p_points: points, p_note: note.trim() }),
  );
}
export async function updateLoyaltySettings(
  orgId: string,
  patch: Partial<Omit<LoyaltySettings, "organization_id">>,
) {
  requireAdmin();
  for (const [k, v] of Object.entries(patch))
    if (typeof v === "number" && (!Number.isInteger(v) || v < 0))
      throw new Error(`Valeur invalide pour ${k}`);
  const data = await write(() =>
    supabase
      .from("loyalty_settings")
      .update(patch)
      .eq("organization_id", orgId)
      .select("organization_id"),
  );
  if (!data?.length) throw new Error("Action réservée au gérant");
}
export async function insertReward(r: {
  name: string;
  description: string | null;
  reward_type: RewardType;
  points_cost: number;
}) {
  requireAdmin();
  if (r.name.trim().length < 2) throw new Error("Le nom de la récompense est obligatoire");
  if (!Number.isInteger(r.points_cost) || r.points_cost <= 0)
    throw new Error("Le coût en points doit être supérieur à zéro");
  await write(() =>
    supabase.from("rewards").insert({
      organization_id: me().orgId,
      name: r.name.trim(),
      description: r.description ?? "",
      reward_type: r.reward_type,
      points_cost: r.points_cost,
    }),
  );
}
export async function setRewardActive(id: string, active: boolean) {
  requireAdmin();
  await write(() => supabase.from("rewards").update({ is_active: active }).eq("id", id));
}

// ---------------------------------------------------------------------
// Caisse
// ---------------------------------------------------------------------
export async function rpcCashExpected(orgId: string, day: string) {
  requireAdmin();
  const { data, error } = await supabase.rpc("cash_expected", { p_org: orgId, p_day: day });
  if (error) throw friendlyError(error);
  return data as number;
}
export async function rpcCloseCash(
  orgId: string,
  day: string,
  countedCents: number,
  note: string | null,
) {
  if (!Number.isInteger(countedCents) || countedCents < 0)
    throw new Error("Montant compté invalide");
  const res = await write(() =>
    supabase.rpc("close_cash", {
      p_org: orgId,
      p_day: day,
      p_counted_cents: countedCents,
      p_note: note ?? "",
    }),
  );
  return res as unknown as {
    expected_cents: number;
    counted_cents: number;
    difference_cents: number;
  };
}
export async function rpcValidateCashClosing(id: string) {
  requireAdmin();
  await write(() => supabase.rpc("validate_cash_closing", { p_id: id }));
}

// ---------------------------------------------------------------------
// Administration et charges
// ---------------------------------------------------------------------
export async function savePlan(
  id: string | null,
  input: Pick<Plan, "name" | "duration_months" | "price_cents">,
) {
  requireAdmin();
  if (input.name.trim().length < 2) throw new Error("Le nom de la formule est obligatoire");
  if (
    !Number.isInteger(input.duration_months) ||
    input.duration_months < 1 ||
    input.duration_months > 36
  )
    throw new Error("La durée doit être comprise entre 1 et 36 mois");
  if (!Number.isSafeInteger(input.price_cents) || input.price_cents < 0)
    throw new Error("Prix invalide");
  const values = { ...input, name: input.name.trim() };
  const data = await write(() =>
    id
      ? supabase.from("plans").update(values).eq("id", id).select("id")
      : supabase
          .from("plans")
          .insert({ ...values, organization_id: me().orgId })
          .select("id"),
  );
  if (!data?.length) throw new Error("Action réservée au gérant");
}
export async function setPlanActive(id: string, active: boolean) {
  requireAdmin();
  await write(() => supabase.from("plans").update({ is_active: active }).eq("id", id));
}
export async function saveReminderTemplate(
  id: string,
  patch: Pick<ReminderTemplate, "template" | "offset_days" | "is_active">,
) {
  requireAdmin();
  if (patch.template.trim().length < 10) throw new Error("Le message est trop court");
  if (!Number.isInteger(patch.offset_days)) throw new Error("Délai invalide");
  const data = await write(() =>
    supabase.from("reminder_templates").update(patch).eq("id", id).select("id"),
  );
  if (!data?.length) throw new Error("Action réservée au gérant");
}
export type ExpenseInput = Pick<
  Expense,
  "category" | "label" | "amount_cents" | "method" | "spent_on"
>;
export async function saveExpense(id: string | null, input: ExpenseInput) {
  requireAdmin();
  if (!EXPENSE_CATEGORIES.some((c) => c === input.category)) throw new Error("Catégorie invalide");
  if (input.label.trim().length < 2) throw new Error("Le libellé est obligatoire");
  if (!Number.isSafeInteger(input.amount_cents) || input.amount_cents <= 0)
    throw new Error("Le montant doit être supérieur à zéro");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.spent_on)) throw new Error("Date invalide");
  const values = { ...input, label: input.label.trim() };
  await write(() =>
    id
      ? supabase.from("expenses").update(values).eq("id", id)
      : supabase
          .from("expenses")
          .insert({ ...values, organization_id: me().orgId, created_by: me().userId }),
  );
}
export async function deleteExpense(id: string) {
  requireAdmin();
  await write(() => supabase.from("expenses").delete().eq("id", id));
}
