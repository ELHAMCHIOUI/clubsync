import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { act } from "@/lib/act";
import { firstName, fillTemplate, formatDateTime, formatDay, formatMAD, monthLabel, shiftMonth, todayLocal, toWhatsAppNumber } from "@/lib/format";
import { lastReminder, pickTemplate, rpcLogReminder, type SubscriptionOverview } from "@/lib/db";
import { useOrg } from "@/lib/session";

export function MonthPicker({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  const max = todayLocal().slice(0, 7);
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-card">
      <Button variant="ghost" size="icon" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Mois précédent"><ChevronLeft /></Button>
      <span className="min-w-36 text-center font-medium capitalize">{monthLabel(value)}</span>
      <Button variant="ghost" size="icon" disabled={value >= max} onClick={() => onChange(shiftMonth(value, 1))} aria-label="Mois suivant"><ChevronRight /></Button>
    </div>
  );
}

/** Relance WhatsApp : type unpaid si reste > 0, sinon expiry. Journalise puis ouvre wa.me. */
export function ReminderButton({ sub, kind, showLast }: { sub: SubscriptionOverview; kind?: "unpaid" | "expiry"; showLast?: boolean }) {
  const { org } = useOrg();
  if (!org) return null;
  const k = kind ?? (sub.balance_cents > 0 ? "unpaid" : "expiry");
  const wa = toWhatsAppNumber(sub.member_phone);
  const tpl = pickTemplate(org.id, k, sub.days_left);
  const why = !sub.member_whatsapp_opt_in ? "Le membre refuse les messages WhatsApp" : !wa ? "Numéro de téléphone invalide" : !tpl ? "Aucun modèle actif pour cette relance" : null;
  const last = showLast ? lastReminder(sub.id) : null;
  const btn = (
    <Button size="sm" variant="outline" disabled={!!why} onClick={async () => {
      const msg = fillTemplate(tpl!.template, { prenom: firstName(sub.member_name), salle: org.name, date_fin: formatDay(sub.end_date), reste: formatMAD(sub.balance_cents) });
      try {
        await act(() => rpcLogReminder(sub.id, k));
        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      } catch { /* */ }
    }}>
      <MessageCircle />{k === "unpaid" ? "Relance impayé" : "Relance échéance"}
    </Button>
  );
  return (
    <div className="flex flex-col items-start gap-0.5">
      {why ? (
        <TooltipProvider><Tooltip><TooltipTrigger asChild><span tabIndex={0}>{btn}</span></TooltipTrigger><TooltipContent>{why}</TooltipContent></Tooltip></TooltipProvider>
      ) : btn}
      {last && <span className="text-xs text-muted-foreground">Relancé le {formatDateTime(last)}</span>}
    </div>
  );
}
