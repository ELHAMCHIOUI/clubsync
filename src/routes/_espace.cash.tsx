import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Landmark, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page";
import { Section } from "@/components/member/sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { act } from "@/lib/act";
import { formatDay, formatMAD, parseMAD, todayLocal } from "@/lib/format";
import { cashClosings, rpcCashExpected, rpcCloseCash, rpcValidateCashClosing, useDb } from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_espace/cash")({
  head: () => ({
    meta: [
      { title: "Caisse — Nabd" },
      { name: "description", content: "Clôture de caisse quotidienne et historique des écarts." },
      { property: "og:title", content: "Caisse — Nabd" },
      { property: "og:description", content: "Clôture de caisse quotidienne et historique des écarts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CashPage,
});

const diffText = (c: number) => (c === 0 ? "0,00 MAD" : `${c > 0 ? "+" : "-"}${formatMAD(Math.abs(c))}`);

function CashPage() {
  const v = useDb();
  const { org, isAdmin } = useOrg();
  const [day, setDay] = useState(todayLocal());
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [expected, setExpected] = useState<number | null>(null);

  useEffect(() => {
    if (!org || !isAdmin) return;
    void rpcCashExpected(org.id, todayLocal()).then(setExpected).catch(() => {});
  }, [org, isAdmin, v]);
  if (!org) return null;
  const rows = cashClosings(org.id);

  async function close() {
    const c = parseMAD(counted);
    if (c === null) { toast.error("Montant compté invalide"); return; }
    setBusy(true);
    try {
      const r = await act(() => rpcCloseCash(org!.id, day, c, note.trim() || null));
      if (r.difference_cents === 0) toast.success("Caisse clôturée : aucun écart");
      else toast.warning(`Écart : ${diffText(r.difference_cents)}, le gérant va vérifier`);
      setCounted(""); setNote("");
    } catch { /* */ } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Caisse" description="Comptez les espèces du tiroir puis clôturez la journée." />
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="space-y-6">
          <Section title="Clôturer la journée" icon={<Landmark className="size-5 text-primary" />}>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Jour</Label><Input type="date" max={todayLocal()} className="h-11" value={day} onChange={(e) => setDay(e.target.value)} /></div>
              <div className="space-y-1"><Label>Espèces comptées (MAD)</Label><Input inputMode="decimal" className="h-14 text-lg" placeholder="0" value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
              <div className="space-y-1"><Label>Note</Label><Input className="h-11" value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <Button className="w-full" size="lg" onClick={close} disabled={busy || !counted.trim()}>{busy && <Loader2 className="animate-spin" />}Clôturer</Button>
            </div>
          </Section>
          {isAdmin && (
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <p className="text-sm text-muted-foreground">Attendu aujourd'hui (espèces)</p>
              <p className="font-display text-2xl font-bold">{expected === null ? "…" : formatMAD(expected)}</p>
            </div>
          )}
        </div>
        <Section title="Historique" className="min-w-0">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune clôture pour l'instant.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Jour</TableHead><TableHead className="text-right">Compté</TableHead>{isAdmin && <TableHead className="text-right">Attendu</TableHead>}<TableHead className="text-right">Écart</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id} className="h-14">
                      <TableCell>{formatDay(c.day)}<div className="text-xs text-muted-foreground">{c.closed_by_name}{c.note && ` · ${c.note}`}</div></TableCell>
                      <TableCell className="text-right">{formatMAD(c.counted_cents)}</TableCell>
                      {isAdmin && <TableCell className="text-right">{formatMAD(c.expected_cents)}</TableCell>}
                      <TableCell className={cn("text-right font-semibold", c.difference_cents === 0 ? "text-primary" : c.difference_cents > 0 ? "text-warning" : "text-destructive")}>{diffText(c.difference_cents)}</TableCell>
                      <TableCell>
                        {c.validated_at ? <Badge variant="success"><CheckCircle2 className="mr-1 size-3" />Validée</Badge>
                          : isAdmin ? <Button size="sm" variant="outline" onClick={() => act(() => rpcValidateCashClosing(c.id), "Clôture validée").catch(() => {})}>Valider</Button>
                          : <Badge variant="warning">À valider</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
