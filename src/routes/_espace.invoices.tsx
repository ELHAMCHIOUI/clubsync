import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/invoices")({
  head: () => ({
    meta: [
      { title: "Factures — Nabd" },
      { name: "description", content: "Factures de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Factures — Nabd" },
      { property: "og:description", content: "Factures de votre salle de sport sur Nabd." },
    ],
  }),
  component: () => <ComingSoon to="/invoices" />,
});
