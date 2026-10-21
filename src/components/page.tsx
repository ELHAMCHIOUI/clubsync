import { Hammer } from "lucide-react";
import type { ReactNode } from "react";
import { NAV_ITEMS } from "@/lib/nav";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function ComingSoon({ to }: { to: string }) {
  const item = NAV_ITEMS.find((i) => i.to === to)!;
  return (
    <>
      <PageHeader title={item.title} />
      <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-16 text-center shadow-card">
        <div className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <item.icon className="size-7" />
        </div>
        <p className="mt-4 font-display text-lg font-semibold">Cette page arrive en phase {item.phase}</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Hammer className="size-4" />En cours de construction</p>
      </div>
    </>
  );
}
