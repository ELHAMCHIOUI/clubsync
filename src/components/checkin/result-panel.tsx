import { Link } from "@tanstack/react-router";
import { CheckCircle2, ScanLine, UserX, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/status";
import { formatDay, formatMAD } from "@/lib/format";
import type { CheckInResult } from "@/lib/mock-db";
import { cn } from "@/lib/utils";

export function ResultPanel({ result }: { result: CheckInResult | null }) {
  if (!result) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card p-8 text-center">
        <ScanLine className="size-12 text-muted-foreground" />
        <p className="mt-3 font-display text-lg font-semibold">En attente d'un scan</p>
        <p className="text-sm text-muted-foreground">Le résultat s'affichera ici en grand.</p>
      </div>
    );
  }
  const ok = result.result === "accepted";
  const m = result.member;
  return (
    <div className={cn("overflow-hidden rounded-xl border-4 bg-card shadow-card animate-in fade-in zoom-in-95", ok ? "border-success" : "border-destructive")}>
      <div className={cn("flex items-center gap-3 px-5 py-4", ok ? "bg-success text-primary-foreground" : "bg-destructive text-destructive-foreground")}>
        {ok ? <CheckCircle2 className="size-9" /> : <XCircle className="size-9" />}
        <div>
          <p className="font-display text-2xl font-bold">{ok ? "Entrée autorisée" : "Entrée refusée"}</p>
          {result.reason && <p className="text-sm opacity-90">{result.reason}</p>}
        </div>
      </div>
      {m ? (
        <div className="flex flex-col gap-5 p-5 sm:flex-row">
          {m.photo_path ? (
            <img src={m.photo_path} alt={m.full_name} className="size-44 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex size-44 shrink-0 flex-col items-center justify-center gap-2 rounded-xl bg-warning/12 p-3 text-center text-sm font-medium text-warning">
              <UserX className="size-10" />Pas de photo : vérifiez l'identité
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <Link to="/members/$id" params={{ id: m.id }} className="block font-display text-2xl font-semibold hover:underline">{m.full_name}</Link>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={m.status} />
              <span className="text-muted-foreground">{m.plan_name ?? "Aucune formule"}</span>
              {m.end_date && <span className="text-muted-foreground">· fin le {formatDay(m.end_date)}</span>}
            </div>
            {m.balance_cents > 0 && (
              <p className="rounded-lg bg-warning/12 px-3 py-2 font-semibold text-warning">Reste à payer : {formatMAD(m.balance_cents)}</p>
            )}
            <p className="text-sm">
              {result.points_earned > 0 && <span className="font-semibold text-primary">+{result.points_earned} pts · </span>}
              Solde : <span className="font-semibold">{m.points} pts</span>
            </p>
          </div>
        </div>
      ) : (
        <p className="p-5 text-muted-foreground">Ce code ne correspond à aucun membre de la salle.</p>
      )}
    </div>
  );
}
