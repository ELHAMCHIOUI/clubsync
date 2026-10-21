import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Gift, Smartphone } from "lucide-react";
import { StatusBadge } from "@/components/status";
import { formatDay } from "@/lib/format";
import { rpcGetPublicCard, type PublicCard } from "@/lib/mock-db";
import { readOrganizations } from "@/lib/mock-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/c/$token")({
  head: () => ({
    meta: [
      { title: "Ma carte de membre — Nabd" },
      { name: "description", content: "Votre carte de membre : présentez le QR à l'accueil." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Ma carte de membre — Nabd" },
      { property: "og:description", content: "Votre carte de membre : présentez le QR à l'accueil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicCardPage,
});

function PublicCardPage() {
  const { token } = Route.useParams();
  const [card, setCard] = useState<PublicCard | null | undefined>(undefined);
  useEffect(() => {
    void rpcGetPublicCard(token, (id) => readOrganizations().find((o) => o.id === id)).then(setCard);
  }, [token]);

  return (
    <div className="min-h-screen bg-brand px-4 py-8">
      <div className="mx-auto max-w-sm">
        {card === undefined ? (
          <div className="h-[30rem] animate-pulse rounded-2xl bg-card/30" />
        ) : card === null ? (
          <div className="rounded-2xl bg-card p-8 text-center shadow-card">
            <p className="font-display text-lg font-semibold">Carte introuvable</p>
            <p className="mt-2 text-sm text-muted-foreground">Demandez à l'accueil de vous renvoyer votre carte.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-card p-6 text-center shadow-card">
              <p className="text-sm font-medium text-primary">{card.gym_name}</p>
              <h1 className="mt-1 text-2xl font-semibold">{card.member_name}</h1>
              <div className="mx-auto mt-5 w-fit rounded-xl border p-3"><QRCodeSVG value={card.qr_token} size={240} /></div>
              <p className="mt-3 text-sm text-muted-foreground">Présentez ce code à l'accueil</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Abonnement</p>
                  <p className="font-medium">{card.plan_name ?? "—"}</p>
                  <div className="mt-1"><StatusBadge status={card.status} /></div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Fin</p>
                  <p className="font-medium">{formatDay(card.end_date)}</p>
                </div>
              </div>
              {card.loyalty_enabled && (
                <div className="mt-3 rounded-lg bg-primary-soft p-4">
                  <p className="text-xs text-accent-foreground">Mes points</p>
                  <p className="font-display text-4xl font-bold text-primary">{card.points}</p>
                </div>
              )}
            </div>
            {card.loyalty_enabled && card.rewards.length > 0 && (
              <div className="rounded-2xl bg-card p-5 shadow-card">
                <p className="flex items-center gap-2 font-semibold"><Gift className="size-5 text-primary" />Récompenses</p>
                <ul className="mt-3 space-y-2">
                  {card.rewards.map((r) => (
                    <li key={r.name} className={cn("flex items-center justify-between rounded-lg border p-3 text-sm", card.points < r.points_cost && "opacity-50")}>
                      <span><span className="font-medium">{r.name}</span>{r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}</span>
                      <span className="font-semibold">{r.points_cost} pts</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-2xl bg-card/90 p-5 text-sm shadow-card">
              <p className="flex items-center gap-2 font-semibold"><Smartphone className="size-5 text-primary" />Ajouter à l'écran d'accueil</p>
              <p className="mt-2 text-muted-foreground"><strong>iPhone :</strong> Partager → Sur l'écran d'accueil</p>
              <p className="text-muted-foreground"><strong>Android :</strong> ⋮ → Ajouter à l'écran d'accueil</p>
              {card.gym_phone && <p className="mt-2 text-muted-foreground">Accueil : {card.gym_phone}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
