import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/payments")({
  head: () => ({
    meta: [
      { title: "Paiements — Nabd" },
      { name: "description", content: "Paiements de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Paiements — Nabd" },
      { property: "og:description", content: "Paiements de votre salle de sport sur Nabd." },
    ],
  }),
  component: () => <ComingSoon to="/payments" />,
});
