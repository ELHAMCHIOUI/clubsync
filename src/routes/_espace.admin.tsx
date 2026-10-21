import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/admin")({
  validateSearch: (s: Record<string, unknown>): { welcome?: number } =>
    s.welcome ? { welcome: Number(s.welcome) } : {},
  head: () => ({
    meta: [
      { title: "Administration — Nabd" },
      { name: "description", content: "Réglages de la salle, formules et équipe sur Nabd." },
      { property: "og:title", content: "Administration — Nabd" },
      { property: "og:description", content: "Réglages de la salle, formules et équipe sur Nabd." },
    ],
  }),
  component: AdminPage,
});

const STEPS = ["Compléter les infos de la salle", "Créer les formules d'abonnement", "Inviter la réception", "Ajouter des récompenses fidélité"];

function AdminPage() {
  const { welcome } = Route.useSearch();
  return (
    <>
      {welcome === 1 && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary-soft p-5">
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-accent-foreground">
            <CheckCircle2 className="size-5" />Votre salle est créée. Pour démarrer :
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2 text-sm"><Circle className="size-4 text-primary" />{i + 1}. {s}</li>
            ))}
          </ol>
        </div>
      )}
      <ComingSoon to="/admin" />
    </>
  );
}
