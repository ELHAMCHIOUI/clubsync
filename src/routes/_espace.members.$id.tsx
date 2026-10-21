import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ArrowLeft, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { Confirm } from "@/components/confirm";
import {
  CardSection, LoyaltySection, ManualEntryAndVisits, MemberForm, NewSubscriptionSection, PaymentSection, PaymentsHistory,
  PhotoSection, ReferralSection, Section, SubscriptionsSection,
} from "@/components/member/sections";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { act } from "@/lib/act";
import { formatDateTime } from "@/lib/format";
import { attendanceOverview, deleteMember, memberOverview, updateMember, useDb } from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_espace/members/$id")({
  validateSearch: (s: Record<string, unknown>): { new?: number } => (s["new"] ? { new: Number(s["new"]) } : {}),
  head: () => ({
    meta: [
      { title: "Fiche membre — Nabd" },
      { name: "description", content: "Abonnements, paiements, carte et fidélité du membre." },
      { property: "og:title", content: "Fiche membre — Nabd" },
      { property: "og:description", content: "Abonnements, paiements, carte et fidélité du membre." },
    ],
  }),
  component: MemberPage,
});

function MemberPage() {
  useDb();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { org, isOwner } = useOrg();
  const navigate = useNavigate();
  const m = org ? memberOverview(org.id).find((x) => x.id === id) : undefined;

  if (!m || !org) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center shadow-card">
        <p className="font-semibold">Membre introuvable</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/members">Retour aux membres</Link></Button>
      </div>
    );
  }
  const visited = attendanceOverview(org.id).some((a) => a.member_id === m.id && a.result === "accepted");
  const steps = [
    { label: "Prendre la photo", done: !!m.photo_path },
    { label: "Créer l'abonnement et encaisser", done: !!m.subscription_id },
    { label: "Le membre scanne « Ma carte » avec son téléphone", done: false },
    { label: "Premier scan à l'accueil (points de bienvenue)", done: visited },
  ];

  return (
    <div className="space-y-6">
      <Link to="/members" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Membres</Link>
      <header className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-card">
        {m.photo_path
          ? <img src={m.photo_path} alt="" className="size-20 rounded-full object-cover" />
          : <div className="grid size-20 place-items-center rounded-full bg-primary-soft font-display text-2xl font-bold text-primary">{m.full_name.slice(0, 1)}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{m.full_name}</h1>
            <StatusBadge status={m.subscription_status} />
            {m.archived_at && <span className="text-sm text-muted-foreground">(archivé)</span>}
          </div>
          <p className="text-sm text-muted-foreground">{m.phone ?? "Pas de téléphone"} · inscrit le {formatDateTime(m.created_at)} · dernière visite : {formatDateTime(m.last_visit_at)}</p>
        </div>
      </header>

      {search.new === 1 && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft p-5">
          <p className="font-display text-lg font-semibold text-accent-foreground">Pour terminer l'inscription</p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.label} className={cn("flex items-center gap-2 text-sm", s.done && "text-primary")}>
                {s.done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5 text-muted-foreground" />}{i + 1}. {s.label}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <CardSection member={m} />
          <SubscriptionsSection memberId={m.id} />
          <PaymentSection memberId={m.id} />
          <NewSubscriptionSection member={m} />
          <LoyaltySection member={m} />
          <PaymentsHistory memberId={m.id} />
        </div>
        <div className="min-w-0 space-y-6">
          <PhotoSection member={m} />
          <ManualEntryAndVisits member={m} />
          <MemberForm key={m.id} member={m} />
          <ReferralSection member={m} />
          <Section title="Statut du membre">
            <div className="space-y-2">
              {m.archived_at ? (
                <Button variant="outline" className="w-full" onClick={() => act(() => updateMember(m.id, { archived_at: null }), "Membre réactivé").catch(() => {})}><ArchiveRestore />Réactiver</Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => act(() => updateMember(m.id, { archived_at: new Date().toISOString() }), "Membre archivé").catch(() => {})}><Archive />Archiver</Button>
              )}
              {isOwner && (
                <Confirm title="Supprimer définitivement ?" description="Cette action est irréversible." typeToConfirm="SUPPRIMER" confirmLabel="Supprimer"
                  onConfirm={async () => { await act(() => deleteMember(m.id), "Membre supprimé"); navigate({ to: "/members" }); }}
                  trigger={<Button variant="ghost" className="w-full text-destructive"><Trash2 />Supprimer définitivement</Button>} />
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
