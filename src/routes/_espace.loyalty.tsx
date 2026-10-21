import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Gift, Info, Plus } from "lucide-react";
import { PageHeader } from "@/components/page";
import { Section } from "@/components/member/sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { act } from "@/lib/act";
import { formatDateTime } from "@/lib/format";
import {
  insertReward, ledgerOverview, loyaltySettings, redemptions, rewards, setRewardActive, updateLoyaltySettings, useDb,
  type LoyaltySettings, type RewardType,
} from "@/lib/db";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_espace/loyalty")({
  head: () => ({
    meta: [
      { title: "Fidélité — Nabd" },
      { name: "description", content: "Règles de points, récompenses et échanges des membres." },
      { property: "og:title", content: "Fidélité — Nabd" },
      { property: "og:description", content: "Règles de points, récompenses et échanges des membres." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoyaltyPage,
});

const TYPES: Record<RewardType, string> = {
  guest_pass: "Pass invité", discount: "Remise sur renouvellement", free_days: "Jours offerts", goodie: "Goodie", partner: "Offre partenaire", other: "Autre",
};
const RULES: { key: keyof Omit<LoyaltySettings, "organization_id" | "enabled">; label: string }[] = [
  { key: "points_per_visit", label: "Points par visite (1×/jour)" },
  { key: "welcome_points", label: "Points de bienvenue (1er abonnement)" },
  { key: "points_per_month", label: "Points par mois d'abonnement" },
  { key: "renewal_bonus", label: "Bonus renouvellement avant la fin" },
  { key: "referral_points", label: "Points au parrain" },
  { key: "expiry_months", label: "Expiration après inactivité (mois)" },
];

function LoyaltyPage() {
  useDb();
  const { org, isAdmin } = useOrg();
  if (!org) return null;
  const ls = loyaltySettings(org.id);
  const list = rewards(org.id);
  const reds = redemptions(org.id).slice(0, 20);
  const ledger = ledgerOverview(org.id).slice(0, 30);
  return (
    <>
      <PageHeader title="Fidélité" />
      <p className="mb-6 flex items-center gap-2 rounded-lg bg-primary-soft p-3 text-sm text-accent-foreground"><Info className="size-4" />Les échanges de récompenses se font depuis la fiche du membre.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        {ls && <RulesForm key={JSON.stringify(ls)} ls={ls} editable={isAdmin} />}
        <Section title="Récompenses" icon={<Gift className="size-5 text-primary" />}>
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.id} className={cn("flex items-center gap-3 rounded-lg border p-3", !r.is_active && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.name} <span className="text-xs text-muted-foreground">· {TYPES[r.reward_type]}</span></p>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                </div>
                <span className="text-sm font-semibold">{r.points_cost} pts</span>
                {!r.is_active && <Badge variant="muted">Désactivée</Badge>}
                {isAdmin && <Button size="sm" variant="ghost" onClick={() => act(() => setRewardActive(r.id, !r.is_active), r.is_active ? "Récompense désactivée" : "Récompense réactivée").catch(() => {})}>{r.is_active ? "Désactiver" : "Réactiver"}</Button>}
              </li>
            ))}
          </ul>
          {isAdmin && <NewReward />}
        </Section>
        <Section title="Derniers échanges">
          {reds.length === 0 ? <p className="text-sm text-muted-foreground">Aucun échange pour l'instant.</p> : (
            <ul className="divide-y text-sm">{reds.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="w-28 text-muted-foreground">{formatDateTime(r.created_at)}</span>
                <Link to="/members/$id" params={{ id: r.member_id }} className="flex-1 font-medium hover:underline">{r.member_name}</Link>
                <span>{r.reward_name}</span><span className="font-semibold text-destructive">-{r.points_cost}</span>
              </li>))}
            </ul>
          )}
        </Section>
        <Section title="Derniers mouvements">
          <ul className="max-h-96 divide-y overflow-y-auto text-sm">{ledger.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <span className="w-28 text-muted-foreground">{formatDateTime(l.created_at)}</span>
              <span className="flex-1 truncate">{l.member_name}</span>
              <span className={cn("font-semibold", l.points > 0 ? "text-primary" : "text-destructive")}>{l.points > 0 ? "+" : ""}{l.points}</span>
            </li>))}
          </ul>
        </Section>
      </div>
    </>
  );
}

function RulesForm({ ls, editable }: { ls: LoyaltySettings; editable: boolean }) {
  const [f, setF] = useState(ls);
  return (
    <Section title="Règles" actions={<label className="flex items-center gap-2 text-sm">Programme actif<Switch checked={f.enabled} disabled={!editable} onCheckedChange={(c) => setF({ ...f, enabled: c })} /></label>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {RULES.map((r) => (
          <div key={r.key} className="space-y-1">
            <Label className="text-xs">{r.label}</Label>
            <Input type="number" min={0} className="h-11" disabled={!editable} value={f[r.key]} onChange={(e) => setF({ ...f, [r.key]: Number(e.target.value) })} />
          </div>
        ))}
      </div>
      {editable && <Button className="mt-4 w-full" onClick={() => act(() => updateLoyaltySettings(ls.organization_id, f), "Règles enregistrées").catch(() => {})}>Enregistrer</Button>}
    </Section>
  );
}

function NewReward() {
  const [f, setF] = useState({ name: "", description: "", reward_type: "goodie" as RewardType, points_cost: "" });
  return (
    <div className="mt-4 grid gap-2 rounded-lg bg-muted p-3 sm:grid-cols-2">
      <Input placeholder="Nom" className="h-11 bg-card" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Nom de la récompense" />
      <Input placeholder="Coût en points" inputMode="numeric" className="h-11 bg-card" value={f.points_cost} onChange={(e) => setF({ ...f, points_cost: e.target.value })} aria-label="Coût en points" />
      <Select value={f.reward_type} onValueChange={(v) => setF({ ...f, reward_type: v as RewardType })}>
        <SelectTrigger className="h-11 bg-card"><SelectValue /></SelectTrigger>
        <SelectContent>{(Object.keys(TYPES) as RewardType[]).map((k) => <SelectItem key={k} value={k}>{TYPES[k]}</SelectItem>)}</SelectContent>
      </Select>
      <Input placeholder="Description" className="h-11 bg-card" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} aria-label="Description" />
      <Button className="sm:col-span-2" onClick={async () => {
        try {
          await act(() => insertReward({ name: f.name, description: f.description.trim() || null, reward_type: f.reward_type, points_cost: Number(f.points_cost) }), "Récompense ajoutée");
          setF({ name: "", description: "", reward_type: "goodie", points_cost: "" });
        } catch { /* */ }
      }}><Plus />Ajouter</Button>
    </div>
  );
}
