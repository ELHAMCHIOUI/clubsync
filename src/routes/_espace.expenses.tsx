import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/expenses")({
  head: () => ({
    meta: [
      { title: "Charges — Nabd" },
      { name: "description", content: "Charges de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Charges — Nabd" },
      { property: "og:description", content: "Charges de votre salle de sport sur Nabd." },
    ],
  }),
  component: () => <ComingSoon to="/expenses" />,
});
