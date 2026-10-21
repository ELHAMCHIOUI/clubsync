import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { PageHeader } from "@/components/page";
import { NewMemberDialog } from "@/components/member/new-member-dialog";
import { BalanceBadge, StatusBadge } from "@/components/status";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatDay } from "@/lib/format";
import { memberOverview, useDb } from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_espace/members/")({
  head: () => ({
    meta: [
      { title: "Membres — Nabd" },
      { name: "description", content: "Liste des membres de la salle, abonnements et impayés." },
      { property: "og:title", content: "Membres — Nabd" },
      { property: "og:description", content: "Liste des membres de la salle, abonnements et impayés." },
    ],
  }),
  component: MembersPage,
});

const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "active", label: "Actifs" },
  { id: "expired", label: "Expirés / sans abonnement" },
  { id: "unpaid", label: "Avec impayé" },
  { id: "archived", label: "Archivés" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

function MembersPage() {
  useDb();
  const { org } = useOrg();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const all = org ? memberOverview(org.id) : [];

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return all
      .filter((m) => (filter === "archived" ? !!m.archived_at : !m.archived_at))
      .filter((m) => {
        if (filter === "active") return m.subscription_status === "active" || m.subscription_status === "upcoming";
        if (filter === "expired") return !m.subscription_status || m.subscription_status === "expired" || m.subscription_status === "cancelled";
        if (filter === "unpaid") return m.balance_cents > 0;
        return true;
      })
      .filter((m) => !s || m.full_name.toLowerCase().includes(s) || (digits.length >= 2 && (m.phone ?? "").replace(/\D/g, "").includes(digits)))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [all, q, filter]);

  return (
    <>
      <PageHeader title="Membres" description={`${all.filter((m) => !m.archived_at).length} membres inscrits`} actions={<NewMemberDialog />} />
      <div className="mb-4 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou téléphone…" className="h-11 pl-9" aria-label="Rechercher" />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-medium", filter === f.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-14 text-center shadow-card">
          <Users className="size-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">{all.length === 0 ? "Aucun membre. Inscrivez le premier" : "Aucun membre ne correspond"}</p>
          {all.length === 0 && <div className="mt-4"><NewMemberDialog /></div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                <TableHead>Formule</TableHead>
                <TableHead className="hidden lg:table-cell">Fin</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="hidden md:table-cell text-right">Points</TableHead>
                <TableHead className="hidden xl:table-cell">Dernière visite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id} className="h-14">
                  <TableCell className="font-medium">
                    <Link to="/members/$id" params={{ id: m.id }} className="hover:text-primary hover:underline">{m.full_name}</Link>
                    <div className="text-xs text-muted-foreground md:hidden">{m.phone}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{m.phone ?? "—"}</TableCell>
                  <TableCell>{m.plan_name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{formatDay(m.end_date)}</TableCell>
                  <TableCell><StatusBadge status={m.subscription_status} /></TableCell>
                  <TableCell>{m.subscription_id ? <BalanceBadge cents={m.balance_cents} /> : "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-right">{m.points}</TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground">{formatDateTime(m.last_visit_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
