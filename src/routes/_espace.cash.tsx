import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/cash")({
  head: () => ({
    meta: [
      { title: "Caisse — Nabd" },
      { name: "description", content: "Caisse de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Caisse — Nabd" },
      { property: "og:description", content: "Caisse de votre salle de sport sur Nabd." },
    ],
  }),
  component: () => <ComingSoon to="/cash" />,
});
