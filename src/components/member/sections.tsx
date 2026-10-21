import { Link } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Camera, Copy, ExternalLink, Gift, Loader2, MessageCircle, Pencil, Printer, RefreshCw, Snowflake, Sun, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Confirm } from "@/components/confirm";
import { BalanceBadge, StatusBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { act } from "@/lib/act";
import {
  firstName, formatDateTime, formatDay, formatMAD, METHOD_LABELS, parseMAD, todayLocal, toWhatsAppNumber,
} from "@/lib/format";
import {
  attendanceOverview, getCard, memberLedger, members, paymentOverview, plans, rewards, rpcAdjustPoints, rpcCreateSubscription,
  rpcManualCheckIn, rpcRecordPayment, rpcRedeemReward, rpcRegenerateCard, rpcSetSubscriptionState, rpcUpdateSubscription,
  subscriptionOverview, updateMember, type LoyaltyKind, type MemberOverview, type PaymentMethod,
} from "@/lib/db";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

export function Section({ title, icon, actions, children, className }: { title: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">{icon}{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">{children}</p>;

export function MethodSelect({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PaymentMethod)}>
      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
      <SelectContent>
        {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((k) => <SelectItem key={k} value={k}>{METHOD_LABELS[k]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ---------- Carte membre ----------
export function CardSection({ member }: { member: MemberOverview }) {
  const { org, isAdmin } = useOrg();
  const card = getCard(member.id);
  if (!card || !org) return null;
  const link = `${window.location.origin}/c/${card.link_token}`;
  const wa = toWhatsAppNumber(member.phone);
  const msg = `Bonjour ${firstName(member.full_name)}, voici votre carte ${org.name} : ${link}. Présentez le QR à l'accueil à chaque visite. Ce lien est personnel.`;
  return (
    <Section title="Carte membre">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="rounded-xl border bg-card p-3"><QRCodeSVG value={link} size={168} /></div>
        <div className="flex-1 space-y-3">
          <p className="text-sm text-muted-foreground">Le membre scanne ce code avec l'appareil photo de son téléphone pour ouvrir sa carte.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild={!!wa} disabled={!wa} title={wa ? undefined : "Numéro de téléphone invalide"}>
              {wa ? <a href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle />Envoyer par WhatsApp</a> : <span><MessageCircle />Envoyer par WhatsApp</span>}
            </Button>
            <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(link); toast.success("Lien copié"); }}><Copy />Copier le lien</Button>
            <Button variant="outline" asChild><Link to="/members/$id/card" params={{ id: member.id }}><Printer />Carte imprimable</Link></Button>
            <Button variant="outline" asChild><a href={link} target="_blank" rel="noreferrer"><ExternalLink />Voir la carte</a></Button>
          </div>
          <p className="text-xs text-muted-foreground">Émise le {formatDateTime(card.issued_at)}{card.regenerated_at && ` · régénérée le ${formatDateTime(card.regenerated_at)}`}</p>
          {isAdmin && (
            <Confirm
              title="Générer un nouveau QR ?"
              description="L'ancien QR et l'ancien lien ne fonctionneront plus."
              confirmLabel="Générer"
              onConfirm={() => act(() => rpcRegenerateCard(member.id)).then(() => toast.success("L'ancien QR ne fonctionne plus : renvoyez le lien au membre"))}
              trigger={<Button variant="ghost" size="sm" className="text-destructive"><RefreshCw />Téléphone perdu ou QR partagé ? Générer un nouveau QR</Button>}
            />
          )}
        </div>
      </div>
    </Section>
  );
}

// ---------- Photo ----------
async function resizeToJpeg(file: File, max = 600): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
export function PhotoSection({ member }: { member: MemberOverview }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Section title="Photo">
      <div className="flex flex-col items-center gap-3">
        {member.photo_path
          ? <img src={member.photo_path} alt={member.full_name} className="size-48 rounded-xl object-cover" />
          : <div className="grid size-48 place-items-center rounded-xl bg-muted text-sm text-muted-foreground">Pas encore de photo</div>}
        <input ref={ref} type="file" accept="image/*" capture="user" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          setBusy(true);
          try { const url = await resizeToJpeg(f); await act(() => updateMember(member.id, { photo_path: url }), "Photo enregistrée"); }
          catch { /* toast */ } finally { setBusy(false); }
        }} />
        <Button className="w-full" variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Camera />}{member.photo_path ? "Reprendre la photo" : "Prendre la photo"}
        </Button>
      </div>
    </Section>
  );
}

// ---------- Abonnements ----------
export function SubscriptionsSection({ memberId }: { memberId: string }) {
  const { org, isAdmin } = useOrg();
  if (!org) return null;
  const subs = subscriptionOverview(org.id).filter((s) => s.member_id === memberId).sort((a, b) => b.start_date.localeCompare(a.start_date));
  return (
    <Section title="Abonnements">
      {subs.length === 0 ? <Empty>Aucun abonnement. Créez-en un ci-dessous.</Empty> : (
        <ul className="divide-y">
          {subs.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.plan_name}{s.discount_cents > 0 && <span className="ml-2 text-xs text-muted-foreground">remise {formatMAD(s.discount_cents)}</span>}</p>
                <p className="text-sm text-muted-foreground">{formatDay(s.start_date)} → {formatDay(s.end_date)} · dû {formatMAD(s.amount_due_cents)}</p>
              </div>
              <StatusBadge status={s.status} />
              {s.status !== "cancelled" && <BalanceBadge cents={s.balance_cents} />}
              <div className="flex gap-1">
                {s.status === "active" && <Button size="sm" variant="outline" onClick={() => act(() => rpcSetSubscriptionState(s.id, "freeze"), "Abonnement gelé").catch(() => {})}><Snowflake />Geler</Button>}
                {s.status === "frozen" && <Button size="sm" variant="outline" onClick={() => act(() => rpcSetSubscriptionState(s.id, "unfreeze"), "Abonnement dégelé : la fin est prolongée").catch(() => {})}><Sun />Dégeler</Button>}
                {isAdmin && s.status !== "cancelled" && <CorrectDialog sub={s} />}
                {isAdmin && s.status !== "cancelled" && (
                  <Confirm title="Annuler cet abonnement ?" description="Le membre ne pourra plus entrer avec cet abonnement." confirmLabel="Annuler l'abonnement"
                    onConfirm={() => act(() => rpcSetSubscriptionState(s.id, "cancel"), "Abonnement annulé")}
                    trigger={<Button size="sm" variant="ghost" className="text-destructive"><XCircle />Annuler</Button>} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
function CorrectDialog({ sub }: { sub: { id: string; start_date: string; end_date: string; amount_due_cents: number } }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(sub.start_date);
  const [end, setEnd] = useState(sub.end_date);
  const [due, setDue] = useState(String(sub.amount_due_cents / 100).replace(".", ","));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><Pencil />Corriger</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Corriger l'abonnement</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Début</Label><Input type="date" className="h-11" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="space-y-2"><Label>Fin</Label><Input type="date" className="h-11" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Montant dû (MAD)</Label><Input inputMode="decimal" className="h-11" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <Button onClick={async () => {
          const c = parseMAD(due);
          if (c === null) { toast.error("Montant invalide"); return; }
          try { await act(() => rpcUpdateSubscription(sub.id, start, end, c), "Abonnement corrigé"); setOpen(false); } catch { /* */ }
        }}>Enregistrer</Button>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Encaisser ----------
export function PaymentSection({ memberId }: { memberId?: string }) {
  const { org } = useOrg();
  const open = org ? subscriptionOverview(org.id).filter((s) => (!memberId || s.member_id === memberId) && s.status !== "cancelled" && s.balance_cents > 0) : [];
  const [subId, setSubId] = useState<string>("");
  const cur = open.find((s) => s.id === subId) ?? open[0];
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (open.length === 0) return memberId ? null : <Section title="Encaisser"><Empty>Aucun abonnement avec un reste à payer.</Empty></Section>;
  const shown = amount || String(cur!.balance_cents / 100).replace(".", ",");
  return (
    <Section title="Encaisser">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Abonnement</Label>
          <Select value={cur!.id} onValueChange={(v) => { setSubId(v); setAmount(""); }}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{open.map((s) => <SelectItem key={s.id} value={s.id}>{!memberId && `${s.member_name} · `}{s.plan_name} — reste {formatMAD(s.balance_cents)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Montant (MAD)</Label><Input inputMode="decimal" className="h-11" value={shown} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="space-y-2"><Label>Mode</Label><MethodSelect value={method} onChange={setMethod} /></div>
        <div className="space-y-2"><Label>Référence</Label><Input className="h-11" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        <div className="space-y-2"><Label>Note</Label><Input className="h-11" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <Button className="mt-4 w-full" disabled={busy} onClick={async () => {
        const c = parseMAD(shown);
        if (c === null) { toast.error("Montant invalide"); return; }
        setBusy(true);
        try { await act(() => rpcRecordPayment(cur!.id, c, method, reference.trim() || null, note.trim() || null), `Paiement de ${formatMAD(c)} enregistré`); setAmount(""); setReference(""); setNote(""); }
        catch { /* */ } finally { setBusy(false); }
      }}>{busy && <Loader2 className="animate-spin" />}Encaisser</Button>
    </Section>
  );
}

// ---------- Nouvel abonnement ----------
export function NewSubscriptionSection({ member }: { member: MemberOverview }) {
  const { org, role } = useOrg();
  const active = org ? plans(org.id).filter((p) => p.is_active) : [];
  const [planId, setPlanId] = useState("");
  const [start, setStart] = useState(todayLocal());
  const [discount, setDiscount] = useState("");
  const [first, setFirst] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  if (!org || member.archived_at) return null;
  const plan = active.find((p) => p.id === planId) ?? active[0];
  const title = member.subscription_id ? "Renouveler / nouvel abonnement" : "Créer l'abonnement";
  if (!plan) return <Section title={title}><Empty>Le gérant doit créer les formules dans Administration.</Empty></Section>;
  const discCents = discount ? parseMAD(discount) : 0;
  const due = plan.price_cents - (discCents ?? 0);
  return (
    <Section title={title}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Formule</Label>
          <Select value={plan.id} onValueChange={setPlanId}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{active.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {formatMAD(p.price_cents)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Date de début</Label><Input type="date" className="h-11" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="space-y-2">
          <Label>Remise (MAD)</Label>
          <Input inputMode="decimal" className="h-11" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          {role === "receptionist" && <p className="text-xs text-muted-foreground">Maximum {org.max_reception_discount_pct} % du prix</p>}
        </div>
        <div className="space-y-2"><Label>Premier paiement (MAD)</Label><Input inputMode="decimal" className="h-11" placeholder={String(due / 100).replace(".", ",")} value={first} onChange={(e) => setFirst(e.target.value)} /></div>
        <div className="space-y-2"><Label>Mode</Label><MethodSelect value={method} onChange={setMethod} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Référence</Label><Input className="h-11" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
      </div>
      <p className="mt-3 text-sm">Montant dû : <strong>{formatMAD(Math.max(0, due))}</strong></p>
      <Button className="mt-3 w-full" disabled={busy} onClick={async () => {
        const firstCents = first ? parseMAD(first) : due;
        if (discCents === null || firstCents === null) { toast.error("Montant invalide"); return; }
        setBusy(true);
        try {
          await act(() => rpcCreateSubscription({ member: member.id, plan: plan.id, start, discountCents: discCents, firstPaymentCents: firstCents, method, reference: reference.trim() || null }, org.max_reception_discount_pct), "Abonnement créé");
          setDiscount(""); setFirst(""); setReference("");
        } catch { /* */ } finally { setBusy(false); }
      }}>{busy && <Loader2 className="animate-spin" />}Créer et encaisser</Button>
    </Section>
  );
}

// ---------- Fidélité ----------
const KIND_LABELS: Record<LoyaltyKind, string> = {
  welcome: "Bienvenue", visit: "Visite", subscription: "Abonnement", renewal: "Renouvellement anticipé", referral: "Parrainage",
  redemption: "Récompense échangée", adjustment: "Ajustement", expiration: "Expiration",
};
export function LoyaltySection({ member }: { member: MemberOverview }) {
  const { org, isAdmin } = useOrg();
  const [adj, setAdj] = useState("");
  const [adjNote, setAdjNote] = useState("");
  if (!org) return null;
  const list = rewards(org.id).filter((r) => r.is_active).sort((a, b) => a.points_cost - b.points_cost);
  const ledger = memberLedger(member.id);
  return (
    <Section title="Fidélité" icon={<Gift className="size-5 text-primary" />} actions={<span className="font-display text-xl font-bold text-primary">Solde : {member.points} points</span>}>
      <div className="space-y-2">
        {list.length === 0 && <Empty>Aucune récompense active.</Empty>}
        {list.map((r) => {
          const can = member.points >= r.points_cost;
          return (
            <div key={r.id} className={cn("flex items-center gap-3 rounded-lg border p-3", !can && "opacity-60")}>
              <div className="min-w-0 flex-1"><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.description}</p></div>
              <span className="text-sm font-semibold">{r.points_cost} pts</span>
              <Confirm title={`Échanger « ${r.name} » ?`} description={`${r.points_cost} points seront retirés du solde.`} confirmLabel="Échanger"
                onConfirm={() => act(() => rpcRedeemReward(member.id, r.id, null), "Récompense échangée")}
                trigger={<Button size="sm" disabled={!can}>Échanger</Button>} />
            </div>
          );
        })}
      </div>
      {isAdmin && (
        <div className="mt-4 grid gap-2 rounded-lg bg-muted p-3 sm:grid-cols-[110px_1fr_auto]">
          <Input inputMode="numeric" placeholder="+50 / -20" className="h-11 bg-card" value={adj} onChange={(e) => setAdj(e.target.value)} aria-label="Points" />
          <Input placeholder="Motif" className="h-11 bg-card" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} aria-label="Motif" />
          <Button variant="outline" onClick={async () => {
            try { await act(() => rpcAdjustPoints(member.id, Number(adj), adjNote), "Points ajustés"); setAdj(""); setAdjNote(""); } catch { /* */ }
          }}>Ajuster les points</Button>
        </div>
      )}
      <ul className="mt-4 max-h-64 divide-y overflow-y-auto text-sm">
        {ledger.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-2">
            <span className="w-28 shrink-0 text-muted-foreground">{formatDateTime(l.created_at)}</span>
            <span className="min-w-0 flex-1 truncate">{KIND_LABELS[l.kind]}{l.note && <span className="text-muted-foreground"> · {l.note}</span>}</span>
            <span className={cn("font-semibold", l.points > 0 ? "text-primary" : "text-destructive")}>{l.points > 0 ? "+" : ""}{l.points}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---------- Historique paiements / visites ----------
export function PaymentsHistory({ memberId }: { memberId: string }) {
  const { org } = useOrg();
  const rows = org ? paymentOverview(org.id).filter((p) => p.member_id === memberId) : [];
  return (
    <Section title="Historique des paiements">
      {rows.length === 0 ? <Empty>Aucun paiement.</Empty> : (
        <ul className="divide-y text-sm">
          {rows.map((p) => (
            <li key={p.id} className={cn("flex flex-wrap items-center gap-3 py-2", p.voided_at && "text-muted-foreground line-through")}>
              <span className="w-28">{formatDateTime(p.paid_local)}</span>
              <span>{METHOD_LABELS[p.method]}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.reference}</span>
              {p.voided_at && <Badge variant="muted" className="no-underline">Annulé</Badge>}
              <span className="font-semibold">{formatMAD(p.amount_cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
export function ManualEntryAndVisits({ member }: { member: MemberOverview }) {
  const { org } = useOrg();
  const [reason, setReason] = useState("");
  const visits = org ? attendanceOverview(org.id).filter((a) => a.member_id === member.id).slice(0, 15) : [];
  return (
    <Section title="Visites">
      <div className="flex gap-2">
        <Input placeholder="Motif de l'entrée manuelle" className="h-11" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motif" />
        <Button variant="outline" onClick={async () => {
          try {
            const r = await act(() => rpcManualCheckIn(member.id, reason));
            if (r.result === "accepted") toast.success("Entrée autorisée"); else toast.error(`Entrée refusée : ${r.reason}`);
            setReason("");
          } catch { /* */ }
        }}>Entrée manuelle</Button>
      </div>
      {visits.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aucune visite.</p> : (
        <ul className="mt-3 divide-y text-sm">
          {visits.map((v) => (
            <li key={v.id} className="flex items-center gap-2 py-2">
              <span className="flex-1">{formatDateTime(v.created_local)}</span>
              {v.method === "manual" && <span className="text-xs text-muted-foreground">Manuelle</span>}
              <Badge variant={v.result === "accepted" ? "success" : "danger"}>{v.result === "accepted" ? "Acceptée" : "Refusée"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------- Fiche / parrainage / archivage ----------
export function MemberForm({ member }: { member: MemberOverview }) {
  const [f, setF] = useState({ full_name: member.full_name, phone: member.phone ?? "", email: member.email ?? "", notes: member.notes ?? "", whatsapp_opt_in: member.whatsapp_opt_in });
  return (
    <Section title="Fiche">
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        await act(() => updateMember(member.id, { full_name: f.full_name, phone: f.phone.trim() || null, email: f.email.trim() || null, notes: f.notes.trim() || null, whatsapp_opt_in: f.whatsapp_opt_in }), "Fiche enregistrée").catch(() => {});
      }}>
        <div className="space-y-1"><Label>Nom complet</Label><Input className="h-11" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="space-y-1"><Label>Téléphone</Label><Input type="tel" className="h-11" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div className="space-y-1"><Label>Email</Label><Input type="email" className="h-11" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="space-y-1"><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><Checkbox checked={f.whatsapp_opt_in} onCheckedChange={(c) => setF({ ...f, whatsapp_opt_in: c === true })} />Accepte les messages WhatsApp</label>
        <Button type="submit" variant="outline" className="w-full">Enregistrer</Button>
      </form>
    </Section>
  );
}
export function ReferralSection({ member }: { member: MemberOverview }) {
  const { org } = useOrg();
  if (!org) return null;
  const all = members(org.id);
  const parent = all.find((m) => m.id === member.referred_by);
  const kids = all.filter((m) => m.referred_by === member.id);
  return (
    <Section title="Parrainage">
      <p className="text-sm">Parrain : {parent ? <Link to="/members/$id" params={{ id: parent.id }} className="font-medium text-primary hover:underline">{parent.full_name}</Link> : <span className="text-muted-foreground">aucun</span>}</p>
      <p className="mt-2 text-sm">Filleuls :</p>
      {kids.length === 0 ? <p className="text-sm text-muted-foreground">aucun</p> : (
        <ul className="mt-1 space-y-1 text-sm">{kids.map((k) => <li key={k.id}><Link to="/members/$id" params={{ id: k.id }} className="text-primary hover:underline">{k.full_name}</Link></li>)}</ul>
      )}
    </Section>
  );
}
