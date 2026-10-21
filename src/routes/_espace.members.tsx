import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/page";

export const Route = createFileRoute("/_espace/members")({
  head: () => ({
    meta: [
      { title: "Membres — Nabd" },
      { name: "description", content: "Membres de votre salle de sport sur Nabd." },
      { property: "og:title", content: "Membres — Nabd" },
      { property: "og:description", content: "Membres de votre salle de sport sur Nabd." },
    ],
  }),
  component: () => <ComingSoon to="/members" />,
});
