import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCard, members, useDb } from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";

export const Route = createFileRoute("/_espace/members/$id_/card")({
  head: () => ({
    meta: [
      { title: "Carte imprimable — Nabd" },
      { name: "description", content: "Carte membre imprimable au format carte bancaire." },
      { property: "og:title", content: "Carte imprimable — Nabd" },
      { property: "og:description", content: "Carte membre imprimable au format carte bancaire." },
    ],
  }),
  component: PrintCard,
});

function PrintCard() {
  useDb();
  const { id } = Route.useParams();
  const { org } = useOrg();
  const m = org ? members(org.id).find((x) => x.id === id) : undefined;
  const card = getCard(id);
  if (!m || !card || !org) return <p>Carte introuvable.</p>;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Button asChild variant="ghost"><Link to="/members/$id" params={{ id }}><ArrowLeft />Retour à la fiche</Link></Button>
        <Button onClick={() => window.print()}><Printer />Imprimer</Button>
      </div>
      <div className="mx-auto flex overflow-hidden rounded-xl border bg-card shadow-card print:shadow-none" style={{ width: "85.6mm", height: "54mm" }}>
        <div className="flex w-[48%] flex-col justify-between bg-brand p-3 text-primary-foreground">
          <p className="font-display text-sm font-bold leading-tight">{org.name}</p>
          <div>
            <p className="text-[9px] uppercase tracking-widest opacity-80">Membre</p>
            <p className="font-display text-sm font-semibold leading-tight">{m.full_name}</p>
          </div>
        </div>
        <div className="grid flex-1 place-items-center p-2"><QRCodeSVG value={card.qr_token} size={150} style={{ width: "100%", height: "auto", maxWidth: "42mm" }} /></div>
      </div>
    </div>
  );
}
