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
