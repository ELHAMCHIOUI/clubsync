import {
  ScanLine, LayoutDashboard, Users, CalendarCheck, Wallet, FileText, Gift, Landmark,
  Receipt, Calculator, Settings, Palette, type LucideIcon,
} from "lucide-react";

export interface NavItem { title: string; to: string; icon: LucideIcon; adminOnly?: boolean; phase: number }

export const NAV_ITEMS: NavItem[] = [
  { title: "Accueil (scan)", to: "/checkin", icon: ScanLine, phase: 2 },
  { title: "Tableau de bord", to: "/dashboard", icon: LayoutDashboard, phase: 5 },
  { title: "Membres", to: "/members", icon: Users, phase: 3 },
  { title: "Abonnements", to: "/subscriptions", icon: CalendarCheck, phase: 4 },
  { title: "Paiements", to: "/payments", icon: Wallet, phase: 4 },
  { title: "Factures", to: "/invoices", icon: FileText, phase: 4 },
  { title: "Fidélité", to: "/loyalty", icon: Gift, phase: 5 },
  { title: "Caisse", to: "/cash", icon: Landmark, phase: 5 },
  { title: "Charges", to: "/expenses", icon: Receipt, adminOnly: true, phase: 6 },
  { title: "Comptabilité", to: "/accounting", icon: Calculator, adminOnly: true, phase: 6 },
  { title: "Administration", to: "/admin", icon: Settings, adminOnly: true, phase: 6 },
  { title: "Thème", to: "/theme", icon: Palette, adminOnly: true, phase: 6 },
];

export const ADMIN_PATHS = NAV_ITEMS.filter((i) => i.adminOnly).map((i) => i.to);
export const isAdminPath = (path: string) => ADMIN_PATHS.some((p) => path === p || path.startsWith(p + "/"));
