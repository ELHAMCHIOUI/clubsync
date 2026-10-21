import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useOrg } from "@/lib/mock-session";
import { BrandMark } from "@/components/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nabd — Gestion de salle de sport" },
      { name: "description", content: "Gérez l'accueil, les membres et la caisse de votre salle avec Nabd." },
      { property: "og:title", content: "Nabd — Gestion de salle de sport" },
      { property: "og:description", content: "Gérez l'accueil, les membres et la caisse de votre salle avec Nabd." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { ready, profile, org } = useOrg();
  const navigate = useNavigate();
  useEffect(() => {
    if (!ready) return;
    navigate({ to: !profile ? "/login" : !org ? "/onboarding" : "/checkin", replace: true });
  }, [ready, profile, org, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center"><BrandMark className="animate-pulse" /></div>
  );
}
