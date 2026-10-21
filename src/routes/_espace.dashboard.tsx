import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Nabd" },
      { name: "description", content: "Tableau de bord de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Tableau de bord — Nabd" },
      { property: "og:description", content: "Tableau de bord de votre salle de sport sur Nabd." },
    ],
  }),
  component: () => <ComingSoon to="/dashboard" />,
});
