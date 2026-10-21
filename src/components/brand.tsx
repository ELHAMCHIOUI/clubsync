import { cn } from "@/lib/utils";
import { useOrg } from "@/lib/session";
import { useApplyTheme, useTheme } from "@/lib/theme";

export function BrandMark({ className }: { className?: string }) {
  const { org } = useOrg();
  const { logo } = useTheme(org?.id);
  useApplyTheme(org?.id);
  if (logo) {
    return <img src={logo} alt={org?.name ?? "Logo"} className={cn("size-10 rounded-xl bg-card object-contain shadow-card", className)} />;
  }
  return (
    <div className={cn("grid size-10 place-items-center rounded-xl bg-brand font-display text-xl font-bold text-primary-foreground shadow-card", className)}>
      {org?.name?.[0]?.toUpperCase() ?? "N"}
    </div>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-2xl font-semibold">Nabd</span>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
