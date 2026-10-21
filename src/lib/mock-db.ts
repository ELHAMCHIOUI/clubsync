// Base SIMULÉE (localStorage) qui reproduit les tables, vues et fonctions rpc de la vraie base.
// Les pages n'utilisent que les fonctions exportées ici : à remplacer par supabase.from(...)/rpc(...).
import { useSyncExternalStore } from "react";
import { addDays, addMonths, diffDays, todayLocal } from "./format";
import type { StaffRole } from "./mock-session";

export type SubState = "active" | "frozen" | "cancelled";
export type SubStatus = "active" | "upcoming" | "expired" | "frozen" | "cancelled";
export type PaymentMethod = "cash" | "transfer" | "card" | "cheque";
export type LoyaltyKind = "welcome" | "visit" | "subscription" | "renewal" | "referral" | "redemption" | "adjustment" | "expiration";

export interface Member {
  id: string; organization_id: string; full_name: string; phone: string | null; email: string | null; notes: string | null;
  whatsapp_opt_in: boolean; photo_path: string | null; referred_by: string | null; archived_at: string | null;
  created_by: string | null; created_at: string;
}
export interface MemberCard { member_id: string; organization_id: string; qr_token: string; link_token: string; issued_at: string; regenerated_at: string | null }
export interface Plan { id: string; organization_id: string; name: string; duration_months: number; price_cents: number; is_active: boolean; created_at: string }
export interface Subscription {
  id: string; organization_id: string; member_id: string; plan_id: string; start_date: string; end_date: string;
  state: SubState; frozen_from: string | null; amount_due_cents: number; discount_cents: number; created_at: string;
}
export interface Payment {
  id: string; organization_id: string; subscription_id: string; member_id: string; amount_cents: number; method: PaymentMethod;
  paid_at: string; reference: string | null; note: string | null; received_by: string | null; received_by_name: string | null;
  voided_at: string | null; void_reason: string | null;
}
export interface Attendance {
  id: string; organization_id: string; member_id: string; result: "accepted" | "refused"; reason: string | null;
  method: "qr" | "manual"; created_at: string; scanned_by_name: string | null;
}
export interface LedgerRow { id: string; organization_id: string; member_id: string; kind: LoyaltyKind; points: number; note: string | null; created_at: string }
export interface LoyaltySettings {
  organization_id: string; enabled: boolean; points_per_visit: number; welcome_points: number; points_per_month: number;
  renewal_bonus: number; referral_points: number; expiry_months: number;
}

export type RewardType = "guest_pass" | "discount" | "free_days" | "goodie" | "partner" | "other";
export interface Reward { id: string; organization_id: string; name: string; description: string | null; reward_type: RewardType; points_cost: number; is_active: boolean; created_at: string }
export interface Redemption { id: string; organization_id: string; member_id: string; reward_id: string; reward_name: string; points_cost: number; note: string | null; given_by: string | null; created_at: string }

interface Data {
  seeded: string[]; members: Member[]; cards: MemberCard[]; plans: Plan[]; subscriptions: Subscription[];
  payments: Payment[]; attendance: Attendance[]; ledger: LedgerRow[]; loyalty: LoyaltySettings[];
  rewards: Reward[]; redemptions: Redemption[];
  invoices: Invoice[]; invoiceSeq: Record<string, number>; templates: ReminderTemplate[]; reminderLogs: ReminderLog[];
  cashClosings: CashClosing[]; expenses: Expense[];
}
export interface CashClosing { id: string; organization_id: string; day: string; expected_cents: number; counted_cents: number; difference_cents: number; note: string | null; closed_by: string | null; closed_by_name: string | null; closed_at: string; validated_by: string | null; validated_at: string | null }
export interface Expense { id: string; organization_id: string; category: string; label: string; amount_cents: number; method: PaymentMethod; spent_on: string; created_by: string | null; created_at: string }
export interface Invoice { id: string; organization_id: string; member_id: string; subscription_id: string; number: number; issued_on: string; total_cents: number; vat_rate: number; created_by: string | null; created_at: string }
export type ReminderKind = "expiry" | "unpaid";
export interface ReminderTemplate { id: string; organization_id: string; kind: ReminderKind; offset_days: number; template: string; is_active: boolean }
export interface ReminderLog { id: string; organization_id: string; member_id: string; subscription_id: string; kind: ReminderKind; sent_by: string | null; sent_at: string }
const KEY = "nabd-demo-db";
const blank = (): Data => ({ seeded: [], members: [], cards: [], plans: [], subscriptions: [], payments: [], attendance: [], ledger: [], loyalty: [], rewards: [], redemptions: [], invoices: [], invoiceSeq: {}, templates: [], reminderLogs: [], cashClosings: [], expenses: [] });

let cache: Data | null = null;
let version = 0;
const listeners = new Set<() => void>();
function data(): Data {
  if (!cache) {
    try { cache = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { cache = blank(); }
  }
  return cache!;
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(cache));
  version++;
  listeners.forEach((l) => l());
}
export function useDb(): number {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version, () => 0);
}

// ---------- Acteur courant (équivalent de la session côté base) ----------
interface Actor { userId: string; name: string; role: StaffRole; orgId: string; antiPassbackMinutes: number }
let actor: Actor | null = null;
export function setActor(a: Actor | null) { actor = a; if (a) seed(a.orgId); }
function me(): Actor { if (!actor) throw new Error("Vous devez être connecté"); return actor; }
const isAdmin = () => me().role !== "receptionist";

const uid = () => crypto.randomUUID();
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
const nowIso = () => new Date().toISOString();
const localDayOf = (iso: string) => todayLocal(new Date(iso));

// ---------- Vues ----------
export function subStatus(s: Subscription, today = todayLocal()): SubStatus {
  if (s.state === "cancelled") return "cancelled";
  if (s.state === "frozen") return "frozen";
  if (today < s.start_date) return "upcoming";
  if (today > s.end_date) return "expired";
  return "active";
}
export interface SubscriptionOverview extends Subscription {
  member_name: string; member_phone: string | null; member_whatsapp_opt_in: boolean; member_archived: boolean;
  plan_name: string; plan_duration_months: number; paid_cents: number; balance_cents: number; status: SubStatus; days_left: number;
}
export function subscriptionOverview(orgId: string): SubscriptionOverview[] {
  const d = data(); const today = todayLocal();
  return d.subscriptions.filter((s) => s.organization_id === orgId).map((s) => {
    const m = d.members.find((x) => x.id === s.member_id);
    const p = d.plans.find((x) => x.id === s.plan_id);
    const paid = d.payments.filter((x) => x.subscription_id === s.id && !x.voided_at).reduce((a, x) => a + x.amount_cents, 0);
    return {
      ...s, member_name: m?.full_name ?? "—", member_phone: m?.phone ?? null, member_whatsapp_opt_in: m?.whatsapp_opt_in ?? false,
      member_archived: !!m?.archived_at, plan_name: p?.name ?? "—", plan_duration_months: p?.duration_months ?? 0,
      paid_cents: paid, balance_cents: Math.max(0, s.amount_due_cents - paid), status: subStatus(s, today), days_left: diffDays(s.end_date, today),
    };
  });
}
export interface MemberOverview extends Member {
  subscription_id: string | null; plan_name: string | null; start_date: string | null; end_date: string | null;
  subscription_status: SubStatus | null; days_left: number | null; balance_cents: number; points: number; last_visit_at: string | null;
}
const STATUS_RANK: Record<SubStatus, number> = { active: 0, frozen: 1, upcoming: 2, expired: 3, cancelled: 4 };
export function memberOverview(orgId: string): MemberOverview[] {
  const d = data();
  const subs = subscriptionOverview(orgId);
  return d.members.filter((m) => m.organization_id === orgId).map((m) => {
    const mine = subs.filter((s) => s.member_id === m.id)
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.start_date.localeCompare(a.start_date));
    const cur = mine[0];
    const lastVisit = d.attendance.filter((a) => a.member_id === m.id && a.result === "accepted").map((a) => a.created_at).sort().pop() ?? null;
    return {
      ...m, subscription_id: cur?.id ?? null, plan_name: cur?.plan_name ?? null, start_date: cur?.start_date ?? null,
      end_date: cur?.end_date ?? null, subscription_status: cur?.status ?? null, days_left: cur?.days_left ?? null,
      balance_cents: mine.filter((s) => s.status !== "cancelled").reduce((a, s) => a + s.balance_cents, 0),
      points: memberPoints(m.id), last_visit_at: lastVisit,
    };
  });
}
export function memberPoints(memberId: string) {
  return data().ledger.filter((l) => l.member_id === memberId).reduce((a, l) => a + l.points, 0);
}
export interface AttendanceOverview extends Attendance { member_name: string; created_local: string; created_on: string }
export function attendanceOverview(orgId: string): AttendanceOverview[] {
  const d = data();
  return d.attendance.filter((a) => a.organization_id === orgId).map((a) => ({
    ...a, member_name: d.members.find((m) => m.id === a.member_id)?.full_name ?? "—",
    created_local: a.created_at, created_on: localDayOf(a.created_at),
  })).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function getCard(memberId: string) { return data().cards.find((c) => c.member_id === memberId) ?? null; }
export function loyaltySettings(orgId: string) { return data().loyalty.find((l) => l.organization_id === orgId) ?? null; }

// ---------- Fonctions (équivalents rpc) ----------
export interface CheckInResult {
  result: "accepted" | "refused"; reason: string | null; points_earned: number;
  member: { id: string; full_name: string; phone: string | null; photo_path: string | null; plan_name: string | null;
    end_date: string | null; status: SubStatus | null; days_left: number | null; balance_cents: number; points: number } | null;
}

function evaluate(memberId: string, method: "qr" | "manual", reason: string | null): CheckInResult {
  const a = me(); const d = data();
  const mo = memberOverview(a.orgId).find((m) => m.id === memberId)!;
  let refused: string | null = null;
  if (mo.archived_at) refused = "Membre archivé";
  else if (!mo.subscription_status) refused = "Aucun abonnement";
  else if (mo.subscription_status === "frozen") refused = "Abonnement gelé";
  else if (mo.subscription_status === "cancelled") refused = "Abonnement annulé";
  else if (mo.subscription_status === "upcoming") refused = `Abonnement pas encore commencé (début le ${mo.start_date!.split("-").reverse().join("/")})`;
  else if (mo.subscription_status === "expired") refused = `Abonnement expiré le ${mo.end_date!.split("-").reverse().join("/")}`;
  else if (method === "qr" && a.antiPassbackMinutes > 0) {
    const last = d.attendance.filter((x) => x.member_id === memberId && x.result === "accepted").map((x) => x.created_at).sort().pop();
    if (last) {
      const mins = Math.floor((Date.now() - Date.parse(last)) / 60000);
      if (mins < a.antiPassbackMinutes) refused = `Déjà entré il y a ${mins} min`;
    }
  }
  const att: Attendance = {
    id: uid(), organization_id: a.orgId, member_id: memberId, result: refused ? "refused" : "accepted",
    reason: refused ?? reason, method, created_at: nowIso(), scanned_by_name: a.name,
  };
  d.attendance.push(att);
  let earned = 0;
  const ls = loyaltySettings(a.orgId);
  if (!refused && ls?.enabled && ls.points_per_visit > 0) {
    const today = todayLocal();
    const already = d.ledger.some((l) => l.member_id === memberId && l.kind === "visit" && localDayOf(l.created_at) === today);
    if (!already) {
      earned = ls.points_per_visit;
      d.ledger.push({ id: uid(), organization_id: a.orgId, member_id: memberId, kind: "visit", points: earned, note: null, created_at: nowIso() });
    }
  }
  save();
  return {
    result: att.result, reason: att.reason, points_earned: earned,
    member: {
      id: mo.id, full_name: mo.full_name, phone: mo.phone, photo_path: mo.photo_path, plan_name: mo.plan_name,
      end_date: mo.end_date, status: mo.subscription_status, days_left: mo.days_left, balance_cents: mo.balance_cents,
      points: memberPoints(mo.id),
    },
  };
}

export async function rpcCheckIn(orgId: string, qrToken: string): Promise<CheckInResult> {
  const code = qrToken.trim();
  if (!code) throw new Error("Code vide");
  const card = data().cards.find((c) => c.organization_id === orgId && c.qr_token === code);
  if (!card) return { result: "refused", reason: "QR inconnu ou remplacé", points_earned: 0, member: null };
  return evaluate(card.member_id, "qr", null);
}
export async function rpcManualCheckIn(memberId: string, reason: string): Promise<CheckInResult> {
  if (reason.trim().length < 3) throw new Error("Le motif de l'entrée manuelle est obligatoire");
  const m = data().members.find((x) => x.id === memberId && x.organization_id === me().orgId);
  if (!m) throw new Error("Membre introuvable");
  return evaluate(memberId, "manual", `Manuelle : ${reason.trim()}`);
}

// ---------- Données de démonstration ----------
function seedRewards(orgId: string) {
  const d = data();
  if (d.rewards.some((r) => r.organization_id === orgId)) return;
  const list: [string, string, RewardType, number][] = [
    ["Pass invité", "Une séance gratuite pour un ami", "guest_pass", 100],
    ["Bouteille Nabd", "Gourde de la salle", "goodie", 200],
    ["7 jours offerts", "Ajoutés au prochain abonnement", "free_days", 400],
  ];
  d.rewards.push(...list.map(([name, description, reward_type, points_cost]) => ({ id: uid(), organization_id: orgId, name, description, reward_type, points_cost, is_active: true, created_at: nowIso() })));
  save();
}

function seed(orgId: string) {
  const d = data();
  seedRewards(orgId);
  seedTemplates(orgId);
  seedExpenses(orgId);
  if (d.seeded.includes(orgId)) return;
  const today = todayLocal();
  const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  d.loyalty.push({ organization_id: orgId, enabled: true, points_per_visit: 10, welcome_points: 50, points_per_month: 20, renewal_bonus: 30, referral_points: 100, expiry_months: 12 });
  const plans: Plan[] = [
    { name: "Mensuel", duration_months: 1, price_cents: 30000 },
    { name: "Trimestriel", duration_months: 3, price_cents: 80000 },
    { name: "Annuel", duration_months: 12, price_cents: 280000 },
  ].map((p) => ({ ...p, id: uid(), organization_id: orgId, is_active: true, created_at: nowIso() }));
  d.plans.push(...plans);
  const people: { name: string; phone: string; plan: number; startOffset: number; paid: number; state?: SubState }[] = [
    { name: "Youssef El Amrani", phone: "06 12 34 56 78", plan: 0, startOffset: -10, paid: 30000 },
    { name: "Salma Bennani", phone: "06 61 22 33 44", plan: 1, startOffset: -40, paid: 50000 },
    { name: "Hamza Tazi", phone: "07 70 11 22 33", plan: 0, startOffset: -26, paid: 30000 },
    { name: "Imane Chraibi", phone: "06 55 44 33 22", plan: 0, startOffset: -45, paid: 30000 },
    { name: "Omar Fassi", phone: "06 98 76 54 32", plan: 2, startOffset: -100, paid: 280000, state: "frozen" },
    { name: "Nadia Alaoui", phone: "06 11 99 88 77", plan: 0, startOffset: 3, paid: 0 },
  ];
  people.forEach((p, i) => {
    const m: Member = {
      id: uid(), organization_id: orgId, full_name: p.name, phone: p.phone, email: null, notes: null, whatsapp_opt_in: true,
      photo_path: null, referred_by: null, archived_at: null, created_by: null, created_at: ago(120 - i),
    };
    d.members.push(m);
    d.cards.push({ member_id: m.id, organization_id: orgId, qr_token: `DEMO-${i + 1}-${token()}`, link_token: token() + token(), issued_at: m.created_at, regenerated_at: null });
    const plan = plans[p.plan]!;
    const start = addDays(today, p.startOffset);
    const s: Subscription = {
      id: uid(), organization_id: orgId, member_id: m.id, plan_id: plan.id, start_date: start,
      end_date: addDays(addMonths(start, plan.duration_months), -1), state: p.state ?? "active",
      frozen_from: p.state === "frozen" ? addDays(today, -5) : null, amount_due_cents: plan.price_cents, discount_cents: 0, created_at: m.created_at,
    };
    d.subscriptions.push(s);
    if (p.paid) d.payments.push({
      id: uid(), organization_id: orgId, subscription_id: s.id, member_id: m.id, amount_cents: p.paid, method: i % 3 === 1 ? "card" : "cash",
      paid_at: start > today ? nowIso() : start + "T10:00:00.000Z", reference: null, note: null, received_by: null, received_by_name: "Démo", voided_at: null, void_reason: null,
    });
    d.ledger.push({ id: uid(), organization_id: orgId, member_id: m.id, kind: "welcome", points: 50, note: null, created_at: m.created_at });
    if (i < 3) d.attendance.push({ id: uid(), organization_id: orgId, member_id: m.id, result: "accepted", reason: null, method: "qr", created_at: ago(1 + i), scanned_by_name: "Démo" });
  });
  d.seeded.push(orgId);
  save();
}

/** Liste des codes QR de démonstration (aide au test sans lecteur). */
export function demoCodes(orgId: string) {
  const d = data();
  return d.cards.filter((c) => c.organization_id === orgId).map((c) => ({
    code: c.qr_token, name: d.members.find((m) => m.id === c.member_id)?.full_name ?? "—",
  }));
}

// ---------- Phase 3 : membres, abonnements, paiements, fidélité ----------
const requireAdmin = () => { if (!isAdmin()) throw new Error("Action réservée au gérant"); };
const own = <T extends { organization_id: string }>(rows: T[]) => rows.filter((r) => r.organization_id === me().orgId);

export function plans(orgId: string) { return data().plans.filter((p) => p.organization_id === orgId); }
export function rewards(orgId: string) { return data().rewards.filter((r) => r.organization_id === orgId); }
export function members(orgId: string) { return data().members.filter((m) => m.organization_id === orgId); }
export function memberLedger(memberId: string) {
  return data().ledger.filter((l) => l.member_id === memberId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export interface PaymentOverview extends Payment { member_name: string; plan_name: string; paid_local: string; paid_on: string }
export function paymentOverview(orgId: string): PaymentOverview[] {
  const d = data();
  return d.payments.filter((p) => p.organization_id === orgId).map((p) => {
    const s = d.subscriptions.find((x) => x.id === p.subscription_id);
    return {
      ...p, member_name: d.members.find((m) => m.id === p.member_id)?.full_name ?? "—",
      plan_name: d.plans.find((x) => x.id === s?.plan_id)?.name ?? "—", paid_local: p.paid_at, paid_on: localDayOf(p.paid_at),
    };
  }).sort((a, b) => b.paid_at.localeCompare(a.paid_at));
}

export async function insertMember(input: { full_name: string; phone: string | null; email: string | null; notes: string | null; whatsapp_opt_in: boolean; referred_by: string | null }) {
  const a = me();
  if (input.full_name.trim().length < 2) throw new Error("Le nom complet est obligatoire");
  const m: Member = { ...input, full_name: input.full_name.trim(), id: uid(), organization_id: a.orgId, photo_path: null, archived_at: null, created_by: a.userId, created_at: nowIso() };
  const d = data();
  d.members.push(m);
  d.cards.push({ member_id: m.id, organization_id: a.orgId, qr_token: token(), link_token: token() + token(), issued_at: nowIso(), regenerated_at: null });
  save();
  return m;
}
export async function updateMember(id: string, patch: Partial<Pick<Member, "full_name" | "phone" | "email" | "notes" | "whatsapp_opt_in" | "photo_path" | "archived_at" | "referred_by">>) {
  const m = own(data().members).find((x) => x.id === id);
  if (!m) throw new Error("Membre introuvable");
  if (patch.full_name !== undefined && patch.full_name.trim().length < 2) throw new Error("Le nom complet est obligatoire");
  Object.assign(m, patch);
  save();
}
export async function deleteMember(id: string) {
  if (me().role !== "owner") throw new Error("Seul le propriétaire peut supprimer un membre");
  const d = data();
  if (d.subscriptions.some((s) => s.member_id === id)) throw new Error("Ce membre a des abonnements : archivez-le");
  d.members = d.members.filter((m) => m.id !== id);
  d.cards = d.cards.filter((c) => c.member_id !== id);
  d.attendance = d.attendance.filter((x) => x.member_id !== id);
  d.ledger = d.ledger.filter((x) => x.member_id !== id);
  save();
}
export async function rpcRegenerateCard(memberId: string) {
  requireAdmin();
  const c = data().cards.find((x) => x.member_id === memberId);
  if (!c) throw new Error("Carte introuvable");
  c.qr_token = token(); c.link_token = token() + token(); c.regenerated_at = nowIso();
  save();
}

function addLedger(memberId: string, kind: LoyaltyKind, points: number, note: string | null) {
  if (!points) return;
  data().ledger.push({ id: uid(), organization_id: me().orgId, member_id: memberId, kind, points, note, created_at: nowIso() });
}
function pushPayment(sub: Subscription, cents: number, method: PaymentMethod, reference: string | null, note: string | null) {
  const a = me();
  const p: Payment = {
    id: uid(), organization_id: a.orgId, subscription_id: sub.id, member_id: sub.member_id, amount_cents: cents, method,
    paid_at: nowIso(), reference: reference || null, note: note || null, received_by: a.userId, received_by_name: a.name, voided_at: null, void_reason: null,
  };
  data().payments.push(p);
  return p.id;
}

export async function rpcCreateSubscription(i: { member: string; plan: string; start: string; discountCents: number; firstPaymentCents: number; method: PaymentMethod; reference: string | null }, maxReceptionDiscountPct: number) {
  const a = me(); const d = data();
  const m = own(d.members).find((x) => x.id === i.member);
  if (!m) throw new Error("Membre introuvable");
  if (m.archived_at) throw new Error("Ce membre est archivé : réactivez-le d'abord");
  const p = own(d.plans).find((x) => x.id === i.plan && x.is_active);
  if (!p) throw new Error("Formule introuvable ou désactivée");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.start)) throw new Error("Date de début invalide");
  if (i.discountCents < 0 || i.discountCents > p.price_cents) throw new Error("Remise invalide");
  if (a.role === "receptionist" && i.discountCents > Math.round((p.price_cents * maxReceptionDiscountPct) / 100))
    throw new Error(`La remise dépasse le maximum autorisé pour la réception (${maxReceptionDiscountPct} %)`);
  const due = p.price_cents - i.discountCents;
  if (i.firstPaymentCents < 0 || i.firstPaymentCents > due) throw new Error("Le premier paiement dépasse le montant dû");
  const previous = d.subscriptions.filter((s) => s.member_id === m.id && s.state !== "cancelled");
  const today = todayLocal();
  const renewing = previous.some((s) => subStatus(s, today) === "active" && s.end_date >= addDays(i.start, -1));
  const s: Subscription = {
    id: uid(), organization_id: a.orgId, member_id: m.id, plan_id: p.id, start_date: i.start,
    end_date: addDays(addMonths(i.start, p.duration_months), -1), state: "active", frozen_from: null,
    amount_due_cents: due, discount_cents: i.discountCents, created_at: nowIso(),
  };
  d.subscriptions.push(s);
  if (i.firstPaymentCents > 0) pushPayment(s, i.firstPaymentCents, i.method, i.reference, null);
  const ls = loyaltySettings(a.orgId);
  if (ls?.enabled) {
    if (previous.length === 0) {
      addLedger(m.id, "welcome", ls.welcome_points, null);
      if (m.referred_by) addLedger(m.referred_by, "referral", ls.referral_points, `Parrainage de ${m.full_name}`);
    }
    addLedger(m.id, "subscription", ls.points_per_month * p.duration_months, p.name);
    if (renewing) addLedger(m.id, "renewal", ls.renewal_bonus, null);
  }
  save();
  return s.id;
}
export async function rpcSetSubscriptionState(subId: string, action: "freeze" | "unfreeze" | "cancel") {
  const s = own(data().subscriptions).find((x) => x.id === subId);
  if (!s) throw new Error("Abonnement introuvable");
  const today = todayLocal();
  if (action === "cancel") {
    requireAdmin();
    if (s.state === "cancelled") throw new Error("Abonnement déjà annulé");
    s.state = "cancelled";
  } else if (action === "freeze") {
    if (subStatus(s, today) !== "active") throw new Error("Seul un abonnement actif peut être gelé");
    s.state = "frozen"; s.frozen_from = today;
  } else {
    if (s.state !== "frozen" || !s.frozen_from) throw new Error("Cet abonnement n'est pas gelé");
    s.end_date = addDays(s.end_date, Math.max(0, diffDays(today, s.frozen_from)));
    s.state = "active"; s.frozen_from = null;
  }
  save();
}
export async function rpcUpdateSubscription(subId: string, start: string, end: string, amountDueCents: number) {
  requireAdmin();
  const s = own(data().subscriptions).find((x) => x.id === subId);
  if (!s) throw new Error("Abonnement introuvable");
  if (end < start) throw new Error("La date de fin doit être après la date de début");
  if (amountDueCents < 0) throw new Error("Montant invalide");
  Object.assign(s, { start_date: start, end_date: end, amount_due_cents: amountDueCents });
  save();
}
export async function rpcRecordPayment(subId: string, cents: number, method: PaymentMethod, reference: string | null, note: string | null) {
  const so = subscriptionOverview(me().orgId).find((x) => x.id === subId);
  if (!so) throw new Error("Abonnement introuvable");
  if (so.state === "cancelled") throw new Error("Abonnement annulé : encaissement impossible");
  if (cents <= 0) throw new Error("Le montant doit être supérieur à zéro");
  if (cents > so.balance_cents) throw new Error("Le montant dépasse le reste à payer");
  const id = pushPayment(data().subscriptions.find((x) => x.id === subId)!, cents, method, reference, note);
  save();
  return id;
}
export async function rpcRedeemReward(memberId: string, rewardId: string, note: string | null) {
  const a = me(); const d = data();
  const r = own(d.rewards).find((x) => x.id === rewardId && x.is_active);
  if (!r) throw new Error("Récompense introuvable ou désactivée");
  if (memberPoints(memberId) < r.points_cost) throw new Error("Points insuffisants pour cette récompense");
  const red: Redemption = { id: uid(), organization_id: a.orgId, member_id: memberId, reward_id: r.id, reward_name: r.name, points_cost: r.points_cost, note, given_by: a.userId, created_at: nowIso() };
  d.redemptions.push(red);
  addLedger(memberId, "redemption", -r.points_cost, r.name);
  save();
  return red.id;
}
export async function rpcAdjustPoints(memberId: string, points: number, note: string) {
  requireAdmin();
  if (!Number.isInteger(points) || points === 0) throw new Error("Nombre de points invalide");
  if (note.trim().length < 3) throw new Error("Le motif est obligatoire");
  if (memberPoints(memberId) + points < 0) throw new Error("Le solde de points ne peut pas devenir négatif");
  addLedger(memberId, "adjustment", points, note.trim());
  save();
}

export interface PublicCard {
  gym_name: string; gym_phone: string | null; member_name: string; qr_token: string; plan_name: string | null;
  end_date: string | null; status: SubStatus | null; points: number; loyalty_enabled: boolean;
  rewards: { name: string; description: string | null; points_cost: number }[];
}
/** Équivalent de get_public_card : accessible sans connexion. */
export async function rpcGetPublicCard(linkToken: string, orgLookup: (id: string) => { name: string; phone: string | null } | undefined): Promise<PublicCard | null> {
  const d = data();
  const c = d.cards.find((x) => x.link_token === linkToken);
  if (!c) return null;
  const m = memberOverview(c.organization_id).find((x) => x.id === c.member_id);
  if (!m || m.archived_at) return null;
  const o = orgLookup(c.organization_id);
  return {
    gym_name: o?.name ?? "Salle", gym_phone: o?.phone ?? null, member_name: m.full_name, qr_token: c.qr_token,
    plan_name: m.plan_name, end_date: m.end_date, status: m.subscription_status, points: m.points,
    loyalty_enabled: loyaltySettings(c.organization_id)?.enabled ?? false,
    rewards: d.rewards.filter((r) => r.organization_id === c.organization_id && r.is_active).map((r) => ({ name: r.name, description: r.description, points_cost: r.points_cost })),
  };
}

// ---------- Phase 4 : paiements, factures, relances ----------
function seedTemplates(orgId: string) {
  const d = data();
  if (d.templates.some((t) => t.organization_id === orgId)) return;
  const list: [ReminderKind, number, string][] = [
    ["expiry", -3, "Bonjour {{prenom}}, votre abonnement chez {{salle}} se termine le {{date_fin}}. Pensez à le renouveler à l'accueil !"],
    ["expiry", 3, "Bonjour {{prenom}}, votre abonnement chez {{salle}} a expiré le {{date_fin}}. On vous attend pour le renouveler !"],
    ["unpaid", 0, "Bonjour {{prenom}}, il reste {{reste}} à régler pour votre abonnement chez {{salle}}. Merci de passer à l'accueil."],
  ];
  d.templates.push(...list.map(([kind, offset_days, template]) => ({ id: uid(), organization_id: orgId, kind, offset_days, template, is_active: true })));
  save();
}
export function reminderTemplates(orgId: string) { return data().templates.filter((t) => t.organization_id === orgId); }
export function lastReminder(subId: string) {
  return data().reminderLogs.filter((r) => r.subscription_id === subId).map((r) => r.sent_at).sort().pop() ?? null;
}
export function pickTemplate(orgId: string, kind: ReminderKind, daysLeft: number) {
  const t = reminderTemplates(orgId).filter((x) => x.kind === kind && x.is_active);
  if (kind === "unpaid") return t[0] ?? null;
  return (daysLeft < 0 ? t.find((x) => x.offset_days > 0) : t.find((x) => x.offset_days <= 0)) ?? null;
}
export async function rpcLogReminder(subId: string, kind: ReminderKind) {
  const s = own(data().subscriptions).find((x) => x.id === subId);
  if (!s) throw new Error("Abonnement introuvable");
  data().reminderLogs.push({ id: uid(), organization_id: s.organization_id, member_id: s.member_id, subscription_id: s.id, kind, sent_by: me().userId, sent_at: nowIso() });
  save();
}
export async function rpcVoidPayment(paymentId: string, reason: string) {
  requireAdmin();
  if (reason.trim().length < 3) throw new Error("Le motif d'annulation est obligatoire");
  const p = own(data().payments).find((x) => x.id === paymentId);
  if (!p) throw new Error("Paiement introuvable");
  if (p.voided_at) throw new Error("Ce paiement est déjà annulé");
  p.voided_at = nowIso(); p.void_reason = reason.trim();
  save();
}
export function invoices(orgId: string) { return data().invoices.filter((i) => i.organization_id === orgId).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
export async function rpcCreateInvoice(subId: string, vatRate: number) {
  const a = me(); const d = data();
  const s = own(d.subscriptions).find((x) => x.id === subId);
  if (!s) throw new Error("Abonnement introuvable");
  if (s.state === "cancelled") throw new Error("Impossible de facturer un abonnement annulé");
  if (d.invoices.some((i) => i.subscription_id === subId)) throw new Error("Cet abonnement a déjà une facture");
  const n = (d.invoiceSeq[a.orgId] ?? 0) + 1;
  d.invoiceSeq[a.orgId] = n;
  const inv: Invoice = { id: uid(), organization_id: a.orgId, member_id: s.member_id, subscription_id: s.id, number: n, issued_on: todayLocal(), total_cents: s.amount_due_cents, vat_rate: vatRate, created_by: a.userId, created_at: nowIso() };
  d.invoices.push(inv);
  save();
  return inv.id;
}

// ---------- Phase 5 : tableau de bord, fidélité, caisse ----------
export const EXPENSE_CATEGORIES = ["Loyer", "Salaires", "Électricité", "Eau", "Internet & téléphone", "Matériel", "Entretien & ménage", "Marketing", "Impôts & taxes", "Autre"] as const;

function seedExpenses(orgId: string) {
  const d = data();
  if (d.expenses.some((e) => e.organization_id === orgId)) return;
  const today = todayLocal();
  for (let i = 0; i < 6; i++) {
    const day = addMonths(today.slice(0, 7) + "-05", -i);
    const add = (category: string, label: string, cents: number, method: PaymentMethod) =>
      d.expenses.push({ id: uid(), organization_id: orgId, category, label, amount_cents: cents, method, spent_on: day, created_by: null, created_at: nowIso() });
    add("Loyer", "Loyer du local", 150000, "transfer");
    add("Salaires", "Coach et réception", 100000, "transfer");
    add("Électricité", "Facture ONEE", 30000 + i * 2000, "cash");
  }
  save();
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
export function expenses(orgId: string) { return data().expenses.filter((e) => e.organization_id === orgId).sort((a, b) => b.spent_on.localeCompare(a.spent_on)); }
export function monthTotals(orgId: string, ym: string) {
  const rev = paymentOverview(orgId).filter((p) => !p.voided_at && p.paid_on.startsWith(ym));
  const exp = expenses(orgId).filter((e) => e.spent_on.startsWith(ym));
  return { revenue: rev.reduce((a, p) => a + p.amount_cents, 0), expenses: exp.reduce((a, e) => a + e.amount_cents, 0) };
}

export function redemptions(orgId: string) {
  const d = data();
  return d.redemptions.filter((r) => r.organization_id === orgId).sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r) => ({ ...r, member_name: d.members.find((m) => m.id === r.member_id)?.full_name ?? "—" }));
}
export function ledgerOverview(orgId: string) {
  const d = data();
  return d.ledger.filter((l) => l.organization_id === orgId).sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((l) => ({ ...l, member_name: d.members.find((m) => m.id === l.member_id)?.full_name ?? "—" }));
}
export async function updateLoyaltySettings(orgId: string, patch: Partial<Omit<LoyaltySettings, "organization_id">>) {
  requireAdmin();
  for (const [k, v] of Object.entries(patch)) if (typeof v === "number" && (!Number.isInteger(v) || v < 0)) throw new Error(`Valeur invalide pour ${k}`);
  const ls = data().loyalty.find((l) => l.organization_id === orgId);
  if (!ls) throw new Error("Réglages introuvables");
  Object.assign(ls, patch);
  save();
}
export async function insertReward(r: { name: string; description: string | null; reward_type: RewardType; points_cost: number }) {
  requireAdmin();
  if (r.name.trim().length < 2) throw new Error("Le nom de la récompense est obligatoire");
  if (!Number.isInteger(r.points_cost) || r.points_cost <= 0) throw new Error("Le coût en points doit être supérieur à zéro");
  data().rewards.push({ ...r, name: r.name.trim(), id: uid(), organization_id: me().orgId, is_active: true, created_at: nowIso() });
  save();
}
export async function setRewardActive(id: string, active: boolean) {
  requireAdmin();
  const r = own(data().rewards).find((x) => x.id === id);
  if (!r) throw new Error("Récompense introuvable");
  r.is_active = active; save();
}

export function cashClosings(orgId: string) { return data().cashClosings.filter((c) => c.organization_id === orgId).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 60); }
function expectedCash(orgId: string, day: string) {
  return paymentOverview(orgId).filter((p) => !p.voided_at && p.method === "cash" && p.paid_on === day).reduce((a, p) => a + p.amount_cents, 0);
}
export async function rpcCashExpected(orgId: string, day: string) { requireAdmin(); return expectedCash(orgId, day); }
export async function rpcCloseCash(orgId: string, day: string, countedCents: number, note: string | null) {
  const a = me();
  if (day > todayLocal()) throw new Error("Impossible de clôturer un jour futur");
  if (!Number.isInteger(countedCents) || countedCents < 0) throw new Error("Montant compté invalide");
  const d = data();
  if (d.cashClosings.some((c) => c.organization_id === orgId && c.day === day)) throw new Error("Cette journée est déjà clôturée");
  const expected = expectedCash(orgId, day);
  d.cashClosings.push({ id: uid(), organization_id: orgId, day, expected_cents: expected, counted_cents: countedCents, difference_cents: countedCents - expected, note, closed_by: a.userId, closed_by_name: a.name, closed_at: nowIso(), validated_by: null, validated_at: null });
  save();
  return { expected_cents: expected, counted_cents: countedCents, difference_cents: countedCents - expected };
}
export async function rpcValidateCashClosing(id: string) {
  requireAdmin();
  const c = own(data().cashClosings).find((x) => x.id === id);
  if (!c) throw new Error("Clôture introuvable");
  c.validated_by = me().userId; c.validated_at = nowIso(); save();
}
