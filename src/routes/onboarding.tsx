import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserRound } from "lucide-react";
import { AuthShell } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrg } from "@/lib/session";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Créer votre salle — Nabd" },
      { name: "description", content: "Donnez un nom à votre salle pour commencer avec Nabd." },
      { property: "og:title", content: "Créer votre salle — Nabd" },
      { property: "og:description", content: "Donnez un nom à votre salle pour commencer avec Nabd." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { ready, profile, org, createOrganization, signOut } = useOrg();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!profile) navigate({ to: "/login", replace: true });
    else if (org) navigate({ to: "/checkin", replace: true });
  }, [ready, profile, org, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createOrganization(name);
      toast.success("Salle créée");
      navigate({ to: "/admin", search: { welcome: 1 } });
    } catch (err) { toast.error((err as Error).message); setBusy(false); }
  }

  return (
    <AuthShell title="Créez votre salle" subtitle={profile ? `Bienvenue ${profile.full_name.split(" ")[0]} !` : undefined}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org">Nom de la salle</Label>
          <Input id="org" required placeholder="Ex. Atlas Fitness Casablanca" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}Créer la salle
        </Button>
      </form>
      <div className="mt-6 flex gap-3 rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
        <UserRound className="size-5 shrink-0 text-primary" />
        <p>
          Vous êtes à la réception ? Demandez au gérant de vous inviter avec l'email{" "}
          <strong className="text-foreground">{profile?.email}</strong> puis reconnectez-vous.
        </p>
      </div>
      <Button variant="ghost" className="mt-3 w-full" onClick={signOut}>Se déconnecter</Button>
    </AuthShell>
  );
}
