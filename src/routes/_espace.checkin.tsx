import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/checkin")({
  head: () => ({
    meta: [
      { title: "Accueil — Nabd" },
      { name: "description", content: "Accueil de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Accueil — Nabd" },
      { property: "og:description", content: "Accueil de votre salle de sport sur Nabd." },
    ],
  }),
  component: () => <ComingSoon to="/checkin" />,
});
