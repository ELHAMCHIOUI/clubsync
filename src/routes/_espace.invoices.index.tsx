import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FilePlus2, FileText } from "lucide-react";
import { PageHeader } from "@/components/page";
import { BalanceBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { act } from "@/lib/act";
import { formatDay, formatMAD, invoiceNumber } from "@/lib/format";
import { invoices, rpcCreateInvoice, subscriptionOverview, useDb } from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";

export const Route = createFileRoute("/_espace/invoices/")({
  head: () => ({
    meta: [
      { title: "Factures — Nabd" },
      { name: "description", content: "Factures émises pour les abonnements de la salle." },
      { property: "og:title", content: "Factures — Nabd" },
      { property: "og:description", content: "Factures émises pour les abonnements de la salle." },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  useDb();
  const { org } = useOrg();
  if (!org) return null;
  const subs = subscriptionOverview(org.id);
  const list = invoices(org.id);
  return (
    <>
      <PageHeader title="Factures" actions={<IssueDialog />} />
      {list.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border bg-card p-12 text-center shadow-card">
          <FileText className="size-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Aucune facture. Émettez la première depuis un abonnement.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Date</TableHead><TableHead>Membre</TableHead><TableHead>Formule</TableHead><TableHead className="text-right">Total TTC</TableHead><TableHead>Règlement</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((i) => {
                const s = subs.find((x) => x.id === i.subscription_id);
                return (
                  <TableRow key={i.id} className="h-14">
                    <TableCell className="font-medium"><Link to="/invoices/$id" params={{ id: i.id }} className="text-primary hover:underline">{invoiceNumber(org.invoice_prefix, i.issued_on, i.number)}</Link></TableCell>
                    <TableCell>{formatDay(i.issued_on)}</TableCell>
                    <TableCell>{s?.member_name}</TableCell>
                    <TableCell>{s?.plan_name}</TableCell>
                    <TableCell className="text-right">{formatMAD(i.total_cents)}</TableCell>
                    <TableCell>{s && <BalanceBadge cents={s.balance_cents} />}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function IssueDialog() {
  const { org } = useOrg();
  const navigate = useNavigate();
  const [subId, setSubId] = useState("");
  if (!org) return null;
  const billed = new Set(invoices(org.id).map((i) => i.subscription_id));
  const options = subscriptionOverview(org.id).filter((s) => s.status !== "cancelled" && !billed.has(s.id));
  return (
    <Dialog>
      <DialogTrigger asChild><Button><FilePlus2 />Émettre une facture</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Émettre une facture</DialogTitle></DialogHeader>
        {options.length === 0 ? <p className="text-sm text-muted-foreground">Tous les abonnements sont déjà facturés.</p> : (
          <>
            <Select value={subId} onValueChange={setSubId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Choisir l'abonnement…" /></SelectTrigger>
              <SelectContent>{options.map((s) => <SelectItem key={s.id} value={s.id}>{s.member_name} · {s.plan_name} · {formatDay(s.start_date)}</SelectItem>)}</SelectContent>
            </Select>
            <Button disabled={!subId} onClick={async () => {
              try { const id = await act(() => rpcCreateInvoice(subId, org.vat_rate), "Facture émise"); navigate({ to: "/invoices/$id", params: { id } }); } catch { /* */ }
            }}>Émettre</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
