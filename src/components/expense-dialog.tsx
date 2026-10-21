import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MethodSelect } from "@/components/member/sections";
import { act } from "@/lib/act";
import { parseMAD, todayLocal } from "@/lib/format";
import { EXPENSE_CATEGORIES, saveExpense, type Expense, type PaymentMethod } from "@/lib/mock-db";

export function ExpenseDialog({ expense }: { expense?: Expense }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const initial = () => ({ category: expense?.category ?? "Loyer", label: expense?.label ?? "", amount: expense ? String(expense.amount_cents / 100) : "", day: expense?.spent_on ?? todayLocal(), method: expense?.method ?? "cash" as PaymentMethod });
  const [form, setForm] = useState(initial);
  return <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(initial()); }}><DialogTrigger asChild>{expense ? <Button variant="ghost" size="icon" aria-label={`Modifier ${expense.label}`}><Pencil /></Button> : <Button><Plus />Ajouter une charge</Button>}</DialogTrigger><DialogContent><DialogHeader><DialogTitle>{expense ? "Modifier la charge" : "Ajouter une charge"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await act(() => saveExpense(expense?.id ?? null, { category: form.category, label: form.label, amount_cents: parseMAD(form.amount) ?? -1, spent_on: form.day, method: form.method }), "Charge enregistrée"); setOpen(false); } catch {} finally { setBusy(false); } }}>
    <div><Label>Catégorie</Label><Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
    <div><Label htmlFor="expense-label">Libellé</Label><Input id="expense-label" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
    <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="expense-amount">Montant (MAD)</Label><Input id="expense-amount" inputMode="decimal" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div><div><Label htmlFor="expense-date">Date</Label><Input id="expense-date" type="date" required value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} /></div></div>
    <div><Label>Mode de paiement</Label><MethodSelect value={form.method} onChange={(v) => setForm({ ...form, method: v })} /></div><Button className="w-full" disabled={busy} type="submit">Enregistrer la charge</Button>
  </form></DialogContent></Dialog>;
}