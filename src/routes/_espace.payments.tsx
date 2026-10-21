import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Confirm } from "@/components/confirm";
import { PageHeader } from "@/components/page";
import { PaymentSection } from "@/components/member/sections";
import { MonthPicker } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { act } from "@/lib/act";
import { formatDateTime, formatMAD, METHOD_LABELS, todayLocal } from "@/lib/format";
import { paymentOverview, rpcVoidPayment, useDb, type PaymentMethod } from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_espace/payments")({
  head: () => ({
    meta: [
      { title: "Paiements — Nabd" },
      { name: "description", content: "Encaissements du mois, par mode de paiement." },
      { property: "og:title", content: "Paiements — Nabd" },
      { property: "og:description", content: "Encaissements du mois, par mode de paiement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  useDb();
  const { org, isAdmin } = useOrg();
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const rows = org ? paymentOverview(org.id).filter((p) => p.paid_on.startsWith(month)) : [];
  const valid = rows.filter((p) => !p.voided_at);
  const total = valid.reduce((a, p) => a + p.amount_cents, 0);
  const byMethod = (Object.keys(METHOD_LABELS) as PaymentMethod[]).map((k) => ({ k, v: valid.filter((p) => p.method === k).reduce((a, p) => a + p.amount_cents, 0) }));

  return (
    <>
      <PageHeader title="Paiements" actions={<MonthPicker value={month} onChange={setMonth} />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {isAdmin && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="col-span-2 rounded-xl border bg-card p-4 shadow-card md:col-span-1">
                <p className="text-sm text-muted-foreground">Total du mois</p>
                <p className="font-display text-2xl font-bold text-primary">{formatMAD(total)}</p>
              </div>
              {byMethod.map(({ k, v }) => (
                <div key={k} className="rounded-xl border bg-card p-4 shadow-card">
                  <p className="text-sm text-muted-foreground">{METHOD_LABELS[k]}</p>
                  <p className="font-display text-lg font-semibold">{formatMAD(v)}</p>
                </div>
              ))}
            </div>
          )}
          {rows.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground shadow-card">Aucun paiement ce mois-ci.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Membre</TableHead><TableHead>Formule</TableHead><TableHead>Mode</TableHead>
                    <TableHead>Référence</TableHead><TableHead>Reçu par</TableHead><TableHead className="text-right">Montant</TableHead>{isAdmin && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id} className={cn("h-14", p.voided_at && "text-muted-foreground")}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(p.paid_local)}</TableCell>
                      <TableCell className="font-medium"><Link to="/members/$id" params={{ id: p.member_id }} className="hover:underline">{p.member_name}</Link></TableCell>
                      <TableCell>{p.plan_name}</TableCell>
                      <TableCell>{METHOD_LABELS[p.method]}</TableCell>
                      <TableCell>{p.reference ?? "—"}</TableCell>
                      <TableCell>{p.received_by_name ?? "—"}</TableCell>
                      <TableCell className={cn("text-right font-semibold", p.voided_at && "line-through")}>{formatMAD(p.amount_cents)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {p.voided_at ? <Badge variant="muted" title={p.void_reason ?? ""}>Annulé</Badge> : (
                            <Confirm title="Annuler ce paiement ?" description="Le paiement restera visible, barré. Il ne sera plus compté." reasonLabel="Motif (obligatoire)" confirmLabel="Annuler le paiement"
                              onConfirm={(r) => act(() => rpcVoidPayment(p.id, r), "Paiement annulé")}
                              trigger={<Button size="sm" variant="ghost" className="text-destructive">Annuler…</Button>} />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <div><PaymentSection /></div>
      </div>
    </>
  );
}
