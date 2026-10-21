import { Badge } from "@/components/ui/badge";
import { formatMAD } from "@/lib/format";
import type { SubStatus } from "@/lib/db";

const MAP: Record<SubStatus, { label: string; variant: "success" | "info" | "danger" | "frozen" | "muted" }> = {
  active: { label: "Actif", variant: "success" },
  upcoming: { label: "À venir", variant: "info" },
  expired: { label: "Expiré", variant: "danger" },
  frozen: { label: "Gelé", variant: "frozen" },
  cancelled: { label: "Annulé", variant: "muted" },
};
export function StatusBadge({ status }: { status: SubStatus | null }) {
  if (!status) return <Badge variant="muted">Sans abonnement</Badge>;
  const s = MAP[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
export function BalanceBadge({ cents }: { cents: number }) {
  return cents > 0 ? <Badge variant="warning">Reste {formatMAD(cents)}</Badge> : <Badge variant="success">Soldé</Badge>;
}
