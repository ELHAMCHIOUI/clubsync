import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { BrandMark } from "@/components/brand";
import { useOrg } from "@/lib/mock-session";
import { isAdminPath } from "@/lib/nav";
import { setActor } from "@/lib/mock-db";

export const Route = createFileRoute("/_espace")({
  component: EspaceLayout,
});

function EspaceLayout() {
  const { ready, profile, org, role, isAdmin } = useOrg();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const blocked = !isAdmin && isAdminPath(path);

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
  return <AppShell><Outlet /></AppShell>;
}
