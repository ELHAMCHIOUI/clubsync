import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, CalendarClock, DoorOpen, ScanLine, UserPlus, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page";
import { NewMemberDialog } from "@/components/member/new-member-dialog";
import { ReminderButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { formatDay, formatMAD, localTime, METHOD_LABELS, monthLabel, shiftMonth, todayLocal } from "@/lib/format";
import {
  attendanceOverview, memberOverview, monthTotals, paymentOverview, subscriptionOverview, useDb, type PaymentMethod,
} from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_espace/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Nabd" },
      { name: "description", content: "Membres actifs, entrées, encaissements et impayés du jour." },
      { property: "og:title", content: "Tableau de bord — Nabd" },
      { property: "og:description", content: "Membres actifs, entrées, encaissements et impayés du jour." },
    ],
  }),
  component: Dashboard,
});

function Stat({ label, value, icon, tone }: { label: string; value: ReactNode; icon: ReactNode; tone?: "warning" | "success" | "danger" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between text-sm text-muted-foreground">{label}{icon}</div>
      <p className={cn("mt-2 font-display text-2xl font-bold", tone === "warning" && "text-warning", tone === "success" && "text-primary", tone === "danger" && "text-destructive")}>{value}</p>
    </div>
  );
}
function Panel({ title, children, empty }: { title: string; children: ReactNode; empty: boolean }) {
  return (
    <section className="rounded-xl border bg-card shadow-card">
      <h2 className="border-b px-5 py-3 text-lg font-semibold">{title}</h2>
      {empty ? <p className="p-5 text-sm text-muted-foreground">Rien à signaler.</p> : <ul className="max-h-80 divide-y overflow-y-auto">{children}</ul>}
    </section>
  );
}

function Dashboard() {
  useDb();
  const { org, isAdmin } = useOrg();
  if (!org) return null;
  const today = todayLocal();
  const month = today.slice(0, 7);
  const mems = memberOverview(org.id).filter((m) => !m.archived_at);
  const subs = subscriptionOverview(org.id).filter((s) => !s.member_archived);
  const pays = paymentOverview(org.id).filter((p) => !p.voided_at);
  const todayPays = pays.filter((p) => p.paid_on === today);
  const unpaid = subs.filter((s) => s.balance_cents > 0 && s.state !== "cancelled");
  const renew = mems.filter((m) => m.subscription_status === "active" && m.days_left !== null && m.days_left >= 0 && m.days_left <= 7);
  const expired = mems.filter((m) => m.subscription_status === "expired" && (m.days_left ?? -999) >= -30);
  const entries = attendanceOverview(org.id).filter((a) => a.created_on === today && a.result === "accepted").length;
  const subOf = (id: string | null) => subs.find((s) => s.id === id);

  return (
    <>
      <PageHeader title="Tableau de bord" description={`Aujourd'hui, ${formatDay(today)}`} actions={
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/checkin"><ScanLine />Scanner une entrée</Link></Button>
          <NewMemberDialog trigger={<Button><UserPlus />Nouveau membre</Button>} />
        </div>
      } />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Membres actifs" value={mems.filter((m) => m.subscription_status === "active").length} icon={<Users className="size-4" />} />
        <Stat label="Entrées aujourd'hui" value={entries} icon={<DoorOpen className="size-4" />} />
        <Stat label="Encaissé aujourd'hui" value={formatMAD(todayPays.reduce((a, p) => a + p.amount_cents, 0))} icon={<Wallet className="size-4" />} tone="success" />
        <Stat label="Reste à encaisser" value={formatMAD(unpaid.reduce((a, s) => a + s.balance_cents, 0))} icon={<AlertCircle className="size-4" />} tone="warning" />
      </div>

      {isAdmin && <AdminBlock orgId={org.id} month={month} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="À renouveler (7 jours)" empty={renew.length === 0}>
          {renew.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Link to="/members/$id" params={{ id: m.id }} className="flex-1 font-medium hover:underline">{m.full_name}</Link>
              <span className="text-sm font-semibold text-warning"><CalendarClock className="mr-1 inline size-4" />J-{m.days_left}</span>
              {subOf(m.subscription_id) && <ReminderButton sub={subOf(m.subscription_id)!} kind="expiry" />}
            </li>
          ))}
        </Panel>
        <Panel title="Expirés depuis moins de 30 jours" empty={expired.length === 0}>
          {expired.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Link to="/members/$id" params={{ id: m.id }} className="flex-1 font-medium hover:underline">{m.full_name}</Link>
              <span className="text-sm text-destructive">fin le {formatDay(m.end_date)}</span>
              {subOf(m.subscription_id) && <ReminderButton sub={subOf(m.subscription_id)!} kind="expiry" />}
            </li>
          ))}
        </Panel>
        <Panel title="Impayés" empty={unpaid.length === 0}>
          {unpaid.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex-1">
                <Link to="/members/$id" params={{ id: s.member_id }} className="font-medium hover:underline">{s.member_name}</Link>
                <p className="text-xs text-muted-foreground">{s.plan_name}</p>
              </div>
              <span className="font-semibold text-warning">{formatMAD(s.balance_cents)}</span>
              <ReminderButton sub={s} kind="unpaid" showLast />
            </li>
          ))}
        </Panel>
        <Panel title="Encaissements du jour" empty={todayPays.length === 0}>
          {todayPays.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span className="w-12 text-muted-foreground">{localTime(p.paid_local)}</span>
              <span className="flex-1 font-medium">{p.member_name}</span>
              <span className="text-muted-foreground">{METHOD_LABELS[p.method]}</span>
              <span className="font-semibold">{formatMAD(p.amount_cents)}</span>
            </li>
          ))}
        </Panel>
      </div>
    </>
  );
}

function AdminBlock({ orgId, month }: { orgId: string; month: string }) {
  const cur = monthTotals(orgId, month);
  const result = cur.revenue - cur.expenses;
  const chart = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((ym) => {
    const t = monthTotals(orgId, ym);
    return { mois: monthLabel(ym).slice(0, 4) + ".", Encaissé: t.revenue / 100, Charges: t.expenses / 100 };
  });
  const pays = paymentOverview(orgId).filter((p) => !p.voided_at && p.paid_on.startsWith(month));
  const byMethod = (Object.keys(METHOD_LABELS) as PaymentMethod[]).map((k) => ({ k, v: pays.filter((p) => p.method === k).reduce((a, p) => a + p.amount_cents, 0) }));
  const max = Math.max(1, ...byMethod.map((x) => x.v));
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-xl border bg-card p-5 shadow-card">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div><p className="text-sm text-muted-foreground">Encaissé du mois</p><p className="font-display text-xl font-bold">{formatMAD(cur.revenue)}</p></div>
          <div><p className="text-sm text-muted-foreground">Charges du mois</p><p className="font-display text-xl font-bold">{formatMAD(cur.expenses)}</p></div>
          <div><p className="text-sm text-muted-foreground">Résultat</p><p className={cn("font-display text-xl font-bold", result >= 0 ? "text-primary" : "text-destructive")}>{formatMAD(result)}</p></div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mois" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={60} />
              <Tooltip formatter={(v: number) => formatMAD(v * 100)} />
              <Legend />
              <Bar dataKey="Encaissé" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Charges" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="mb-4 text-lg font-semibold">Répartition par mode (mois)</h2>
        <ul className="space-y-3">
          {byMethod.map(({ k, v }) => (
            <li key={k}>
              <div className="flex justify-between text-sm"><span>{METHOD_LABELS[k]}</span><span className="font-semibold">{formatMAD(v)}</span></div>
              <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
