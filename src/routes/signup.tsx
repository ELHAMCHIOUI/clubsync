import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrg } from "@/lib/session";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Créer un compte — Nabd" },
      { name: "description", content: "Créez votre compte Nabd et configurez votre salle de sport." },
      { property: "og:title", content: "Créer un compte — Nabd" },
      { property: "og:description", content: "Créez votre compte Nabd et configurez votre salle de sport." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { ready, profile, signUp } = useOrg();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  useEffect(() => { if (ready && profile) navigate({ to: "/", replace: true }); }, [ready, profile, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { session } = await signUp(fullName, email, password);
      if (!session) setNeedsConfirm(true);
      else toast.success("Compte créé");
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }

  if (needsConfirm) {
    return (
      <AuthShell title="Vérifiez vos emails">
        <div className="flex gap-3 rounded-lg bg-primary-soft p-4 text-sm text-accent-foreground">
          <MailCheck className="size-5 shrink-0" />
          Compte créé : ouvrez l'email de confirmation puis connectez-vous.
        </div>
        <Button asChild variant="outline" className="mt-6 w-full"><Link to="/login">Aller à la connexion</Link></Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Créer un compte" subtitle="Propriétaire, gérant ou réception.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nom complet</Label>
          <Input id="name" required autoComplete="name" className="h-11" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" type="password" required minLength={8} autoComplete="new-password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}Créer mon compte
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Déjà un compte ? <Link to="/login" className="font-medium text-primary hover:underline">Se connecter</Link>
      </p>
    </AuthShell>
  );
}
