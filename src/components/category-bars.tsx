import { formatMAD } from "@/lib/format";
import { Progress } from "@/components/ui/progress";

export function CategoryBars({ rows }: { rows: { category: string; total: number }[] }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  return <section className="min-w-0"><h2 className="mb-5 text-lg font-semibold">Charges par catégorie</h2>{rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune charge ce mois-ci.</p> : <ul className="space-y-5">{rows.map((r) => <li key={r.category}><div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span>{r.category}</span><span className="font-semibold">{formatMAD(r.total)}</span></div><Progress value={total ? r.total / total * 100 : 0} className="h-2" /></li>)}</ul>}</section>;
}