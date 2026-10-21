import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/loyalty")({
  head: () => ({
    meta: [
      { title: "Fidélité — Nabd" },
      { name: "description", content: "Fidélité de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Fidélité — Nabd" },
      { property: "og:description", content: "Fidélité de votre salle de sport sur Nabd." },
    ],
  }),
  component: () => <ComingSoon to="/loyalty" />,
});
