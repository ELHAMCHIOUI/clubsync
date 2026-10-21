import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/page";
import { NewSubscriptionSection } from "@/components/member/sections";
import { ReminderButton } from "@/components/shared";
import { BalanceBadge, StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDay, formatMAD } from "@/lib/format";
import { memberOverview, subscriptionOverview, useDb, type SubStatus } from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_espace/subscriptions")({
  head: () => ({
    meta: [
      { title: "Abonnements — Nabd" },
      { name: "description", content: "Abonnements actifs, à venir, gelés et expirés de la salle." },
      { property: "og:title", content: "Abonnements — Nabd" },
      { property: "og:description", content: "Abonnements actifs, à venir, gelés et expirés de la salle." },
    ],
  }),
  component: SubscriptionsPage,
});

const TABS: { id: SubStatus | "all"; label: string }[] = [
  { id: "active", label: "Actifs" }, { id: "upcoming", label: "À venir" }, { id: "frozen", label: "Gelés" },
  { id: "expired", label: "Expirés" }, { id: "cancelled", label: "Annulés" }, { id: "all", label: "Tous" },
];

function SubscriptionsPage() {
  useDb();
  const { org } = useOrg();
  const [tab, setTab] = useState<SubStatus | "all">("active");
  const all = org ? subscriptionOverview(org.id).sort((a, b) => a.end_date.localeCompare(b.end_date)) : [];
  const rows = tab === "all" ? all : all.filter((s) => s.status === tab);
  return (
    <>
      <PageHeader title="Abonnements" actions={<NewSubscriptionDialog />} />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const n = t.id === "all" ? all.length : all.filter((s) => s.status === t.id).length;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-medium", tab === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
              {t.label} <span className="ml-1 opacity-75">{n}</span>
            </button>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground shadow-card">Aucun abonnement dans cette catégorie.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead><TableHead>Formule</TableHead><TableHead>Période</TableHead><TableHead>Statut</TableHead>
                <TableHead className="text-right">Dû</TableHead><TableHead>Paiement</TableHead><TableHead>Relance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} className="h-14">
                  <TableCell className="font-medium"><Link to="/members/$id" params={{ id: s.member_id }} className="hover:text-primary hover:underline">{s.member_name}</Link></TableCell>
                  <TableCell>{s.plan_name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDay(s.start_date)} → {formatDay(s.end_date)}
                    {s.status === "active" && s.days_left <= 7 && <span className="ml-2 font-semibold text-warning">J-{s.days_left}</span>}
                  </TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-right">{formatMAD(s.amount_due_cents)}</TableCell>
                  <TableCell>{s.status !== "cancelled" && <BalanceBadge cents={s.balance_cents} />}</TableCell>
                  <TableCell>{s.status !== "cancelled" && !s.member_archived && <ReminderButton sub={s} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function NewSubscriptionDialog() {
  const { org } = useOrg();
  const [memberId, setMemberId] = useState("");
  const list = org ? memberOverview(org.id).filter((m) => !m.archived_at).sort((a, b) => a.full_name.localeCompare(b.full_name)) : [];
  const m = list.find((x) => x.id === memberId);
  return (
    <Dialog onOpenChange={(o) => { if (!o) setMemberId(""); }}>
      <DialogTrigger asChild><Button><CalendarPlus />Nouvel abonnement</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nouvel abonnement</DialogTitle></DialogHeader>
        <Select value={memberId} onValueChange={setMemberId}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Choisir le membre…" /></SelectTrigger>
          <SelectContent>{list.map((x) => <SelectItem key={x.id} value={x.id}>{x.full_name}</SelectItem>)}</SelectContent>
        </Select>
        {m && <NewSubscriptionSection key={m.id} member={m} />}
      </DialogContent>
    </Dialog>
  );
}
