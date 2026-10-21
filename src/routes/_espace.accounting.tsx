import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/accounting")({
  head: () => ({
    meta: [
      { title: "Comptabilité — Nabd" },
      { name: "description", content: "Comptabilité de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Comptabilité — Nabd" },
      { property: "og:description", content: "Comptabilité de votre salle de sport sur Nabd." },
    ],
  }),
  component: () => <ComingSoon to="/accounting" />,
});
