import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDay, formatMAD, invoiceNumber, METHOD_LABELS, totalHT } from "@/lib/format";
import { invoices, members, paymentOverview, subscriptionOverview, useDb } from "@/lib/db";
import { useOrg } from "@/lib/session";

export const Route = createFileRoute("/_espace/invoices/$id")({
  head: () => ({
    meta: [
      { title: "Facture — Nabd" },
      { name: "description", content: "Facture imprimable au format A4." },
      { property: "og:title", content: "Facture — Nabd" },
      { property: "og:description", content: "Facture imprimable au format A4." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvoicePage,
});

function InvoicePage() {
  useDb();
  const { id } = Route.useParams();
  const { org } = useOrg();
  if (!org) return null;
  const inv = invoices(org.id).find((i) => i.id === id);
  const sub = inv && subscriptionOverview(org.id).find((s) => s.id === inv.subscription_id);
  const mem = inv && members(org.id).find((m) => m.id === inv.member_id);
  if (!inv || !sub || !mem) return <p>Facture introuvable.</p>;
  const ht = totalHT(inv.total_cents, inv.vat_rate);
  const pays = paymentOverview(org.id).filter((p) => p.subscription_id === sub.id && !p.voided_at);
  const paid = pays.reduce((a, p) => a + p.amount_cents, 0);
  const rest = Math.max(0, inv.total_cents - paid);

  return (
    <div>
      <div className="mb-6 flex gap-3 print:hidden">
        <Button asChild variant="ghost"><Link to="/invoices"><ArrowLeft />Factures</Link></Button>
        <Button onClick={() => window.print()}><Printer />Imprimer</Button>
      </div>
      <article className="mx-auto max-w-[210mm] space-y-8 rounded-xl border bg-card p-10 shadow-card print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap justify-between gap-6">
          <div className="text-sm">
            <p className="font-display text-xl font-bold text-primary">{org.name}</p>
            {org.address && <p>{org.address}</p>}
            {org.city && <p>{org.city}</p>}
            {org.phone && <p>Tél. : {org.phone}</p>}
            {org.ice && <p>ICE : {org.ice}</p>}
            {org.tax_id && <p>IF : {org.tax_id}</p>}
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-bold tracking-wide">FACTURE</h1>
            <p className="font-medium">{invoiceNumber(org.invoice_prefix, inv.issued_on, inv.number)}</p>
            <p className="text-sm text-muted-foreground">Date : {formatDay(inv.issued_on)}</p>
          </div>
        </header>
        <div className="rounded-lg bg-muted p-4 text-sm">
          <p className="text-xs uppercase text-muted-foreground">Facturé à</p>
          <p className="font-semibold">{mem.full_name}</p>
          {mem.phone && <p>{mem.phone}</p>}
          {mem.email && <p>{mem.email}</p>}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="py-2">Désignation</th><th className="py-2 text-right">Montant TTC</th></tr></thead>
          <tbody><tr className="border-b"><td className="py-3">Abonnement {sub.plan_name} du {formatDay(sub.start_date)} au {formatDay(sub.end_date)}</td><td className="py-3 text-right">{formatMAD(inv.total_cents)}</td></tr></tbody>
        </table>
        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span>Total HT</span><span>{formatMAD(ht)}</span></div>
          <div className="flex justify-between"><span>TVA {inv.vat_rate} %</span><span>{formatMAD(inv.total_cents - ht)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total TTC</span><span>{formatMAD(inv.total_cents)}</span></div>
          {inv.vat_rate === 0 && <p className="text-xs text-muted-foreground">TVA non applicable</p>}
        </div>
        <div className="text-sm">
          <p className="font-semibold">Règlements reçus</p>
          {pays.length === 0 ? <p className="text-muted-foreground">Aucun</p> : (
            <ul>{pays.map((p) => <li key={p.id}>{formatDay(p.paid_on)} — {METHOD_LABELS[p.method]}{p.reference && ` (${p.reference})`} — {formatMAD(p.amount_cents)}</li>)}</ul>
          )}
          <p className="mt-4 text-lg font-bold">{rest === 0 ? <span className="text-primary">Facture acquittée</span> : <span className="text-warning">Reste à payer : {formatMAD(rest)}</span>}</p>
        </div>
      </article>
    </div>
  );
}
