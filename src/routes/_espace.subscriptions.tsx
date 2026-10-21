import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/subscriptions")({
  head: () => ({
    meta: [
      { title: "Abonnements — Nabd" },
      { name: "description", content: "Abonnements de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Abonnements — Nabd" },
      { property: "og:description", content: "Abonnements de votre salle de sport sur Nabd." },
    ],
  }),
  component: () => <ComingSoon to="/subscriptions" />,
});
