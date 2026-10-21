import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page";
import { MonthPicker } from "@/components/shared";
import { CategoryBars } from "@/components/category-bars";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { journalCSV, type JournalEntry } from "@/lib/accounting";
import { formatDay, formatMAD, METHOD_LABELS, todayLocal } from "@/lib/format";
import { accountingSummary, useDb } from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_espace/accounting")({
  head: () => ({
    meta: [
      { title: "Comptabilité — Nabd" },
      { name: "description", content: "Comptabilité de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Comptabilité — Nabd" },
      { property: "og:description", content: "Comptabilité de votre salle de sport sur Nabd." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountingPage,
});

function AccountingPage() {
  useDb(); const { org } = useOrg(); const [month, setMonth] = useState(todayLocal().slice(0, 7));
  if (!org) return null;
  const s = accountingSummary(org.id, month);
  const journal: JournalEntry[] = [
    ...s.payments.map((p) => ({ id: p.id, day: p.paid_on, label: p.member_name + " · " + p.plan_name, category: "Abonnement", method: METHOD_LABELS[p.method], income: p.amount_cents, expense: 0 })),
    ...s.charges.map((e) => ({ id: e.id, day: e.spent_on, label: e.label, category: e.category, method: METHOD_LABELS[e.method], income: 0, expense: e.amount_cents })),
  ].sort((a, b) => a.day.localeCompare(b.day) || a.label.localeCompare(b.label));
  const download = () => { const url = URL.createObjectURL(new Blob([journalCSV(journal)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `journal-${month}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <><PageHeader title="Comptabilité" actions={<Button variant="outline" onClick={download}><Download />Exporter CSV</Button>} /><div className="mb-6"><MonthPicker value={month} onChange={setMonth} /></div>
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{([{ label: "Recettes", value: s.revenue, color: "text-primary" }, { label: "Charges", value: s.expenses, color: "text-destructive" }, { label: "Résultat", value: s.net, color: s.net < 0 ? "text-destructive" : "text-primary" }, { label: "Facturé", value: s.billed, color: "text-info" }]).map((v) => <div key={v.label} className="min-w-0 rounded-lg border bg-card p-4 shadow-card"><p className="mb-2 text-sm text-muted-foreground">{v.label}</p><p className={cn("break-words font-display text-xl font-semibold", v.color)}>{formatMAD(v.value)}</p></div>)}</div>
    <div className="mb-8 grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]"><section className="min-w-0"><h2 className="mb-4 text-lg font-semibold">Trésorerie par mode</h2><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Mode</TableHead><TableHead className="text-right">Entrées</TableHead><TableHead className="text-right">Sorties</TableHead><TableHead className="text-right">Solde</TableHead></TableRow></TableHeader><TableBody>{s.byMethod.map((m) => <TableRow key={m.method}><TableCell>{METHOD_LABELS[m.method]}</TableCell><TableCell className="whitespace-nowrap text-right">{formatMAD(m.revenue)}</TableCell><TableCell className="whitespace-nowrap text-right">{formatMAD(m.expenses)}</TableCell><TableCell className={cn("whitespace-nowrap text-right font-semibold", m.revenue < m.expenses ? "text-destructive" : "text-primary")}>{formatMAD(m.revenue - m.expenses)}</TableCell></TableRow>)}</TableBody></Table></div></section><CategoryBars rows={s.byCategory} /></div>
    <section className="min-w-0"><h2 className="mb-4 text-lg font-semibold">Journal du mois</h2><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Libellé</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Recettes</TableHead><TableHead className="text-right">Charges</TableHead></TableRow></TableHeader><TableBody>{journal.map((r) => <TableRow key={r.id}><TableCell className="whitespace-nowrap">{formatDay(r.day)}</TableCell><TableCell><p className="font-medium">{r.label}</p><p className="text-xs text-muted-foreground">{r.category}</p></TableCell><TableCell>{r.method}</TableCell><TableCell className="whitespace-nowrap text-right text-primary">{r.income ? formatMAD(r.income) : "—"}</TableCell><TableCell className="whitespace-nowrap text-right text-destructive">{r.expense ? formatMAD(r.expense) : "—"}</TableCell></TableRow>)}{journal.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Aucun mouvement ce mois-ci.</TableCell></TableRow>}<TableRow className="font-semibold"><TableCell colSpan={3}>Total</TableCell><TableCell className="whitespace-nowrap text-right">{formatMAD(s.revenue)}</TableCell><TableCell className="whitespace-nowrap text-right">{formatMAD(s.expenses)}</TableCell></TableRow></TableBody></Table></div></section>
  </>;
}
