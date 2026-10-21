import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page";
import { GymSettings, PlanSettings, TeamSettings, ReminderSettings } from "@/components/admin-forms";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/lib/mock-session";
import { plans, rewards, useDb } from "@/lib/mock-db";

export const Route = createFileRoute("/_espace/admin")({
  validateSearch: (s: Record<string, unknown>): { welcome?: number } =>
    s["welcome"] ? { welcome: Number(s["welcome"]) } : {},
  head: () => ({
    meta: [
      { title: "Administration — Nabd" },
      { name: "description", content: "Réglages de la salle, formules et équipe sur Nabd." },
      { property: "og:title", content: "Administration — Nabd" },
      { property: "og:description", content: "Réglages de la salle, formules et équipe sur Nabd." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  useDb();
  const { org, staff, invitations } = useOrg();
  const { welcome } = Route.useSearch();
  if (!org) return null;
  const steps = [
    { title: "Infos de la salle", done: !!(org.phone && org.address && org.city) },
    { title: "Formules d’abonnement", done: plans(org.id).some((p) => p.is_active) },
    { title: "Équipe de réception", done: staff.some((s) => s.role === "receptionist") || invitations.some((i) => i.role === "receptionist") },
    { title: "Récompenses fidélité", done: rewards(org.id).some((r) => r.is_active) },
  ];
  return (
    <>
      {welcome === 1 && (
        <div className="mb-6 border-l-4 border-primary bg-primary-soft p-5">
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-accent-foreground">
            <CheckCircle2 className="size-5" />Votre salle est créée. Pour démarrer :
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.title} className="flex items-center gap-2 text-sm"><CheckCircle2 className={s.done ? "size-4 text-primary" : "size-4 text-muted-foreground"} />{i + 1}. {s.title}</li>
            ))}
          </ol>
        </div>
      )}
      <PageHeader title="Administration" actions={<Link to="/loyalty" className="text-sm font-medium text-primary hover:underline">Récompenses fidélité →</Link>} />
      <Tabs defaultValue="gym">
        <div className="mb-6 overflow-x-auto"><TabsList className="h-11"><TabsTrigger value="gym">Salle</TabsTrigger><TabsTrigger value="plans">Formules</TabsTrigger><TabsTrigger value="team">Équipe</TabsTrigger><TabsTrigger value="reminders">Relances WhatsApp</TabsTrigger></TabsList></div>
        <TabsContent value="gym"><GymSettings key={JSON.stringify(org)} org={org} /></TabsContent>
        <TabsContent value="plans"><PlanSettings orgId={org.id} /></TabsContent>
        <TabsContent value="team"><TeamSettings /></TabsContent>
        <TabsContent value="reminders"><ReminderSettings orgId={org.id} /></TabsContent>
      </Tabs>
    </>
  );
}
