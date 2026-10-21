export const TZ = "Africa/Casablanca";

const mad = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" });
export const formatMAD = (cents: number) => mad.format(cents / 100);

/** « 300 » ou « 300,50 » → centimes ; null si invalide. */
export function parseMAD(input: string): number | null {
  const v = Number(input.replace(/\s/g, "").replace(",", "."));
  if (!input.trim() || !Number.isFinite(v) || v < 0) return null;
  return Math.round(v * 100);
}

/** Date du jour à Casablanca, au format AAAA-MM-JJ. */
export function todayLocal(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function localTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
/** AAAA-MM-JJ → JJ/MM/AAAA */
export function formatDay(day: string | null | undefined): string {
  if (!day) return "—";
  const [y, m, d] = day.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}
export function addDays(day: string, n: number): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function addMonths(day: string, n: number): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000);
}

export const METHOD_LABELS = { cash: "Espèces", card: "Carte (TPE)", transfer: "Virement", cheque: "Chèque" } as const;

/** « 06 12 34 56 78 » → 212612345678 ; null si invalide. */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "212" + d.slice(1);
  return /^212[5-7]\d{8}$/.test(d) ? d : null;
}
export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;

export function invoiceNumber(prefix: string, issuedOn: string, n: number) {
  return `${prefix}-${issuedOn.slice(0, 4)}-${String(n).padStart(4, "0")}`;
}
/** Total HT = round(TTC / (1 + tva/100)) */
export function totalHT(ttcCents: number, vatRate: number) { return Math.round(ttcCents / (1 + vatRate / 100)); }
export function fillTemplate(t: string, v: { prenom: string; salle: string; date_fin: string; reste: string }) {
  return t.replace(/\{\{(prenom|salle|date_fin|reste)\}\}/g, (_, k: keyof typeof v) => v[k]);
}
export const monthLabel = (ym: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(ym + "-15T12:00:00Z"));
export const shiftMonth = (ym: string, n: number) => addMonths(ym + "-01", n).slice(0, 7);
