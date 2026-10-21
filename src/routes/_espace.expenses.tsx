import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page";
import { MonthPicker } from "@/components/shared";
import { ExpenseDialog } from "@/components/expense-dialog";
import { CategoryBars } from "@/components/category-bars";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { act } from "@/lib/act";
import { formatDay, formatMAD, METHOD_LABELS, todayLocal } from "@/lib/format";
import { accountingSummary, deleteExpense, useDb } from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";

export const Route = createFileRoute("/_espace/expenses")({
  head: () => ({
    meta: [
      { title: "Charges — Nabd" },
      { name: "description", content: "Charges de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Charges — Nabd" },
      { property: "og:description", content: "Charges de votre salle de sport sur Nabd." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  useDb(); const { org } = useOrg(); const [month, setMonth] = useState(todayLocal().slice(0, 7));
  if (!org) return null;
  const summary = accountingSummary(org.id, month);
  return <><PageHeader title="Charges" actions={<ExpenseDialog />} /><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><MonthPicker value={month} onChange={setMonth} /><p className="text-lg font-semibold">Total : {formatMAD(summary.expenses)}</p></div><div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]"><section className="min-w-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Charge</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Montant</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{summary.charges.map((e) => <TableRow key={e.id}><TableCell className="whitespace-nowrap">{formatDay(e.spent_on)}</TableCell><TableCell><p className="font-medium">{e.label}</p><p className="text-xs text-muted-foreground">{e.category}</p></TableCell><TableCell>{METHOD_LABELS[e.method]}</TableCell><TableCell className="whitespace-nowrap text-right font-semibold">{formatMAD(e.amount_cents)}</TableCell><TableCell><div className="flex"><ExpenseDialog expense={e} /><Confirm title="Supprimer cette charge ?" description={`${e.label} · ${formatMAD(e.amount_cents)}`} confirmLabel="Supprimer" trigger={<Button variant="ghost" size="icon" aria-label={`Supprimer ${e.label}`}><Trash2 /></Button>} onConfirm={() => act(() => deleteExpense(e.id), "Charge supprimée")} /></div></TableCell></TableRow>)}{summary.charges.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Aucune charge ce mois-ci.</TableCell></TableRow>}</TableBody></Table></div></section><CategoryBars rows={summary.byCategory} /></div></>;
}
