import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrg } from "@/lib/mock-session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Nabd" },
      { name: "description", content: "Connectez-vous à Nabd pour gérer votre salle de sport." },
      { property: "og:title", content: "Connexion — Nabd" },
      { property: "og:description", content: "Connectez-vous à Nabd pour gérer votre salle de sport." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { ready, profile, signIn } = useOrg();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ready && profile) navigate({ to: "/", replace: true }); }, [ready, profile, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await signIn(email, password); toast.success("Connexion réussie"); }
    catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <AuthShell title="Connexion" subtitle="Accédez à l'espace de votre salle.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" type="password" autoComplete="current-password" required className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}Se connecter
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ? <Link to="/signup" className="font-medium text-primary hover:underline">Créer un compte</Link>
      </p>
    </AuthShell>
  );
}
