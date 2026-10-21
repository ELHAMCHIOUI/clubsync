import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrg } from "@/lib/session";
import { DEFAULT_THEME, THEME_PRESETS, isHexColor, saveTheme, useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_espace/theme")({
  head: () => ({
    meta: [
      { title: "Thème — Nabd" },
      { name: "description", content: "Personnalisez la couleur et le logo de votre salle sur Nabd." },
      { property: "og:title", content: "Thème — Nabd" },
      { property: "og:description", content: "Personnalisez la couleur et le logo de votre salle sur Nabd." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThemePage,
});

function ThemePage() {
  const { org } = useOrg();
  const theme = useTheme(org?.id);
  const [hex, setHex] = useState(theme.color);
  if (!org) return null;

  const apply = (patch: Partial<typeof theme>) => {
    try { saveTheme(org.id, { ...theme, ...patch }); toast.success("Thème mis à jour"); }
    catch (e) { toast.error((e as Error).message); }
  };

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choisissez une image."); return; }
    if (file.size > 500_000) { toast.error("Image trop lourde (500 Ko max)."); return; }
    const reader = new FileReader();
    reader.onload = () => apply({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <>
      <PageHeader title="Thème" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Couleur principale</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {THEME_PRESETS.map((c) => (
              <button key={c} type="button" aria-label={`Couleur ${c}`} onClick={() => { setHex(c); apply({ color: c }); }}
                className="grid size-10 place-items-center rounded-full border-2 border-card ring-2 ring-border transition hover:scale-105"
                style={{ backgroundColor: c }}>
                {theme.color.toLowerCase() === c && <Check className="size-5 text-primary-foreground" />}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hex">Couleur personnalisée</Label>
              <div className="flex gap-2">
                <input type="color" value={isHexColor(hex) ? hex : theme.color} onChange={(e) => setHex(e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border bg-card" />
                <Input id="hex" value={hex} onChange={(e) => setHex(e.target.value)} className="w-32 font-mono" />
              </div>
            </div>
            <Button onClick={() => apply({ color: hex })}>Appliquer</Button>
          </div>
          <Button variant="ghost" className="mt-4" onClick={() => { setHex(DEFAULT_THEME.color); apply({ color: DEFAULT_THEME.color }); }}>Revenir à la couleur Nabd</Button>
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Logo de la salle</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="grid size-20 place-items-center overflow-hidden rounded-xl border bg-muted">
              {theme.logo ? <img src={theme.logo} alt="Logo" className="size-full object-contain" /> : <span className="font-display text-3xl font-bold text-muted-foreground">{org.name[0]?.toUpperCase()}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline">
                <label className="cursor-pointer"><ImagePlus />Choisir une image<input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} /></label>
              </Button>
              {theme.logo && <Button variant="ghost" onClick={() => apply({ logo: null })}><Trash2 />Retirer le logo</Button>}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">PNG, JPG ou SVG, 500 Ko max. Carré recommandé.</p>

          <h3 className="mt-8 text-sm font-medium text-muted-foreground">Aperçu</h3>
          <div className="mt-2 flex items-center gap-3 rounded-lg border p-4">
            <Button>Bouton principal</Button>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-sm text-accent-foreground">Actif</span>
            <span className="text-sm font-medium text-primary">Lien</span>
          </div>
        </section>
      </div>
    </>
  );
}
