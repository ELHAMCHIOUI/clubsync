import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { BrandMark } from "@/components/brand";
import { useOrg } from "@/lib/session";
import { isAdminPath } from "@/lib/nav";
import { setActor, useDbReady } from "@/lib/db";

export const Route = createFileRoute("/_espace")({
  component: EspaceLayout,
});

function EspaceLayout() {
  const { ready, profile, org, role, isAdmin } = useOrg();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const blocked = !isAdmin && isAdminPath(path);
  const db = useDbReady();

  useEffect(() => {
    if (!ready) return;
    if (!profile) navigate({ to: "/login", replace: true });
    else if (!org) navigate({ to: "/onboarding", replace: true });
    else if (blocked) navigate({ to: "/dashboard", replace: true });
  }, [ready, profile, org, blocked, navigate]);

  if (!ready || !profile || !org || blocked) {
    return <div className="flex min-h-screen items-center justify-center"><BrandMark className="animate-pulse" /></div>;
  }
  setActor({ userId: profile.id, name: profile.full_name, role: role!, orgId: org.id, antiPassbackMinutes: org.anti_passback_minutes });
  // Premier chargement des données de la salle depuis Supabase
  if (!db.loaded) {
    return <div className="flex min-h-screen items-center justify-center"><BrandMark className="animate-pulse" /></div>;
  }
  return (
    <AppShell>
      {db.error && (
        <div className="mx-4 mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive lg:mx-8">
          Données non chargées : {db.error}
        </div>
      )}
      <Outlet />
    </AppShell>
  );
}
