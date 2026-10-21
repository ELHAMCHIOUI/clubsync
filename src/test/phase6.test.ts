import { beforeEach, describe, expect, it, vi } from "vitest";
import { journalCSV } from "@/lib/accounting";
import { todayLocal } from "@/lib/format";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });
async function db(role: "owner" | "manager" | "receptionist" = "owner") {
  const api = await import("@/lib/mock-db");
  api.setActor({ userId: "user", name: "Test", role, orgId: "gym", antiPassbackMinutes: 60 });
  return api;
}
describe("formules", () => {
  it("accepte les bornes 1 et 36 mois", async () => {
    const api = await db();
    await api.savePlan(null, { name: "Un mois", duration_months: 1, price_cents: 30000 });
    await api.savePlan(null, { name: "Trois ans", duration_months: 36, price_cents: 900000 });
    expect(api.plans("gym").find((p) => p.name === "Trois ans")?.duration_months).toBe(36);
    expect(api.plans("gym").find((p) => p.name === "Un mois")?.duration_months).toBe(1);
  });
  it("refuse les durées hors de 1–36 mois", async () => {
    const api = await db();
    for (const duration_months of [0, 37, 1.5]) await expect(api.savePlan(null, { name: "Test", duration_months, price_cents: 30000 })).rejects.toThrow();
  });
  it("désactive et réactive une formule sans la supprimer", async () => {
    const api = await db(); const plan = api.plans("gym")[0]; if (!plan) throw new Error("Missing plan");
    await api.setPlanActive(plan.id, false); expect(api.plans("gym").find((p) => p.id === plan.id)?.is_active).toBe(false);
    await api.setPlanActive(plan.id, true); expect(api.plans("gym").find((p) => p.id === plan.id)?.is_active).toBe(true);
  });
});
describe("charges et accès", () => {
  it("permet au gérant d’ajouter et supprimer une charge de 300,50 MAD", async () => {
    const api = await db("manager");
    await api.saveExpense(null, { category: "Matériel", label: "Tapis", amount_cents: 30050, spent_on: todayLocal(), method: "cash" });
    const row = api.expenses("gym").find((e) => e.label === "Tapis"); if (!row) throw new Error("Missing expense");
    expect(row.amount_cents).toBe(30050); await api.deleteExpense(row.id); expect(api.expenses("gym").some((e) => e.id === row.id)).toBe(false);
  });
  it("refuse les opérations d’administration à la réception", async () => {
    const api = await db("receptionist");
    await expect(api.savePlan(null, { name: "Test", duration_months: 1, price_cents: 30000 })).rejects.toThrow("Action réservée au gérant");
    await expect(api.saveExpense(null, { category: "Loyer", label: "Loyer", amount_cents: 10000, spent_on: todayLocal(), method: "cash" })).rejects.toThrow("Action réservée au gérant");
    expect(() => api.accountingSummary("gym", "2026-10")).toThrow("Action réservée au gérant");
  });
  it("refuse une charge d’une autre salle", async () => {
    const api = await db(); await expect(api.deleteExpense("other-gym-expense")).rejects.toThrow("Charge introuvable");
    expect(() => api.accountingSummary("other", "2026-10")).toThrow("Salle inaccessible");
  });
});
describe("comptabilité", () => {
  it("exclut les paiements annulés et calcule facturé, résultat et solde par mode", async () => {
    localStorage.setItem("nabd-demo-db", JSON.stringify({ seeded: ["gym"], expenses: [{ id: "e", organization_id: "gym", spent_on: "2026-10-03", amount_cents: 10000, category: "Loyer", label: "Loyer", method: "cash" }], payments: [{ id: "p", organization_id: "gym", paid_at: "2026-10-02T12:00:00Z", amount_cents: 30000, method: "cash", voided_at: null }, { id: "void", organization_id: "gym", paid_at: "2026-10-02T12:00:00Z", amount_cents: 99900, method: "cash", voided_at: "2026-10-03T12:00:00Z" }, { id: "prior", organization_id: "gym", paid_at: "2026-09-02T12:00:00Z", amount_cents: 70000, method: "card", voided_at: null }], invoices: [{ organization_id: "gym", issued_on: "2026-10-04", total_cents: 45000 }, { organization_id: "gym", issued_on: "2026-09-04", total_cents: 99000 }] }));
    const api = await db(); const s = api.accountingSummary("gym", "2026-10");
    expect(s.revenue).toBe(30000); expect(s.expenses).toBe(10000); expect(s.net).toBe(20000); expect(s.billed).toBe(45000);
    expect(s.byMethod.find((m) => m.method === "cash")).toEqual({ method: "cash", revenue: 30000, expenses: 10000 });
    expect(s.byCategory).toEqual([{ category: "Loyer", total: 10000 }]);
  });
  it("exporte un CSV avec BOM, point-virgule, virgule décimale et totaux", () => {
    const csv = journalCSV([{ id: "1", day: "2026-10-21", label: "Tapis", category: "Matériel", method: "Espèces", income: 30050, expense: 10000 }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff); expect(csv).toContain(';300,50;100,00'); expect(csv).toContain(';TOTAL;;;300,50;100,00'); expect(csv).toContain(';RÉSULTAT;;;200,50;');
  });
  it("neutralise les formules des cellules de tableur", () => {
    const csv = journalCSV([{ id: "1", day: "2026-10-21", label: '=HYPERLINK("bad")', category: "Autre", method: "Espèces", income: 0, expense: 100 }]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  });
});