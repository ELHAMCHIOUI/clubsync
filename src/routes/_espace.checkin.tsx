import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Hand, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/page";
import { CameraScanner } from "@/components/checkin/camera-scanner";
import { ResultPanel } from "@/components/checkin/result-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { localTime, todayLocal } from "@/lib/format";
import {
  attendanceOverview, memberOverview, rpcCheckIn, rpcManualCheckIn, useDb, type CheckInResult,
} from "@/lib/db";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_espace/checkin")({
  head: () => ({
    meta: [
      { title: "Accueil (scan) — Nabd" },
      { name: "description", content: "Scannez les cartes des membres à l'entrée de la salle." },
      { property: "og:title", content: "Accueil (scan) — Nabd" },
      { property: "og:description", content: "Scannez les cartes des membres à l'entrée de la salle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckinPage,
});

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 1200 : 300;
    o.type = ok ? "sine" : "square";
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.18 : 0.45));
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
    o.onended = () => ctx.close();
  } catch { /* son indisponible */ }
}

function CheckinPage() {
  useDb();
  const { org } = useOrg();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const show = (r: CheckInResult) => { setResult(r); beep(r.result === "accepted"); };

  async function scan(raw: string) {
    const c = raw.trim();
    if (!c || !org) return;
    setBusy(true);
    try { show(await rpcCheckIn(org.id, c)); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); setCode(""); inputRef.current?.focus(); }
  }

  return (
    <>
      <PageHeader title="Accueil" description="Scannez la carte du membre : le résultat s'affiche immédiatement." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5 shadow-card">
            <form onSubmit={(e) => { e.preventDefault(); void scan(code); }} className="flex gap-2">
              <Input
                ref={inputRef} autoFocus value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="Scannez un QR…" aria-label="Code QR" className="h-14 text-lg" autoComplete="off"
              />
              <Button type="submit" size="lg" className="h-14" disabled={busy || !code.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : "Valider"}
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">Les lecteurs QR USB / Bluetooth remplissent ce champ et valident automatiquement.</p>
            <div className="mt-4">
              {camera ? (
                <CameraScanner onCode={(c) => void scan(c)} onClose={() => { setCamera(false); inputRef.current?.focus(); }} />
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setCamera(true)}><Camera />Scanner avec la caméra</Button>
              )}
            </div>
          </section>
          <ManualEntry onResult={show} />
        </div>
        <div className="space-y-6">
          <ResultPanel result={result} />
          {org && <TodayList orgId={org.id} />}
        </div>
      </div>
    </>
  );
}

function ManualEntry({ onResult }: { onResult: (r: CheckInResult) => void }) {
  const { org } = useOrg();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("Téléphone oublié");
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!org || s.length < 2) return [];
    const digits = s.replace(/\D/g, "");
    return memberOverview(org.id)
      .filter((m) => !m.archived_at && (m.full_name.toLowerCase().includes(s) || (digits.length >= 2 && (m.phone ?? "").replace(/\D/g, "").includes(digits))))
      .slice(0, 6);
  }, [q, org]);

  async function submit() {
    if (!selected) return;
    setBusy(true);
    try { onResult(await rpcManualCheckIn(selected.id, reason)); setSelected(null); setQ(""); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Hand className="size-5 text-primary" />Entrée manuelle</h2>
      <p className="text-sm text-muted-foreground">Le membre a oublié son téléphone ? Retrouvez-le par nom ou téléphone.</p>
      {!selected ? (
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou téléphone…" className="h-11 pl-9" aria-label="Rechercher un membre" />
          </div>
          {q.trim().length >= 2 && (
            <ul className="mt-2 divide-y rounded-lg border">
              {matches.length === 0 && <li className="p-3 text-sm text-muted-foreground">Aucun membre trouvé.</li>}
              {matches.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => setSelected({ id: m.id, name: m.full_name })} className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left hover:bg-muted">
                    <span className="font-medium">{m.full_name}</span>
                    <span className="text-sm text-muted-foreground">{m.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
            <span className="font-medium">{selected.name}</span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Changer</Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Motif (obligatoire)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11" />
          </div>
          <Button className="w-full" onClick={submit} disabled={busy || reason.trim().length < 3}>
            {busy && <Loader2 className="animate-spin" />}Enregistrer l'entrée
          </Button>
        </div>
      )}
    </section>
  );
}

function TodayList({ orgId }: { orgId: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const today = todayLocal();
  const rows = attendanceOverview(orgId).filter((a) => a.created_on === today);
  const accepted = rows.filter((r) => r.result === "accepted").length;
  return (
    <section className="rounded-xl border bg-card shadow-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="text-lg font-semibold">Entrées du jour</h2>
        <span className="text-sm text-muted-foreground">{accepted} acceptée{accepted > 1 ? "s" : ""} · {rows.length - accepted} refusée{rows.length - accepted > 1 ? "s" : ""}</span>
      </div>
      {!mounted ? (
        <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Aucune entrée aujourd'hui. Le premier scan apparaîtra ici.</p>
      ) : (
        <ul className="max-h-96 divide-y overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="w-12 shrink-0 font-medium text-muted-foreground">{localTime(r.created_local)}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{r.member_name}</span>
              <span className={cn("hidden max-w-56 truncate text-muted-foreground sm:block")}>
                {r.method === "manual" ? r.reason : r.result === "refused" ? r.reason : ""}
              </span>
              <Badge variant={r.result === "accepted" ? "success" : "danger"}>{r.result === "accepted" ? "Acceptée" : "Refusée"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
