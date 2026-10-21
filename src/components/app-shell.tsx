import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NAV_ITEMS } from "@/lib/nav";
import { ROLE_LABELS, useOrg, type StaffRole } from "@/lib/mock-session";
import { cn } from "@/lib/utils";

function DemoRoleSwitch() {
  const { role, setDemoRole } = useOrg();
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Démo : rôle</p>
      <Select value={role ?? undefined} onValueChange={(v) => setDemoRole(v as StaffRole)}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
            <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { org, profile, role, isAdmin, signOut } = useOrg();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);
  const active = (to: string) => path === to || path.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <BrandMark />
          <div className="min-w-0">
            <p className="truncate font-display font-semibold">{org?.name}</p>
            <p className="text-xs text-muted-foreground">Nabd</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((i) => (
            <Link key={i.to} to={i.to}
              className={cn("flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                active(i.to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <i.icon className="size-5" />{i.title}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 border-t p-4">
          <DemoRoleSwitch />
          <div>
            <p className="truncate text-sm font-medium">{profile?.full_name}</p>
            <p className="text-xs text-muted-foreground">{role && ROLE_LABELS[role]}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={signOut}><LogOut />Se déconnecter</Button>
        </div>
      </aside>

      {/* Tablet / mobile header */}
      <header className="sticky top-0 z-20 border-b bg-card lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <BrandMark className="size-9 text-lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display font-semibold">{org?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.full_name} · {role && ROLE_LABELS[role]}</p>
          </div>
          <div className="w-36"><DemoRoleSwitch /></div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Se déconnecter"><LogOut /></Button>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
          {items.map((i) => (
            <Link key={i.to} to={i.to}
              className={cn("flex h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium",
                active(i.to) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              <i.icon className="size-4" />{i.title}
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
