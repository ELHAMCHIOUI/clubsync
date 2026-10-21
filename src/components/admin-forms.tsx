import { useState } from "react";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { act } from "@/lib/act";
import { formatMAD, parseMAD } from "@/lib/format";
import { plans, reminderTemplates, savePlan, saveReminderTemplate, setPlanActive, type Plan, type ReminderTemplate } from "@/lib/mock-db";
import { useOrg, ROLE_LABELS, type Organization, type StaffRole } from "@/lib/mock-session";

export function GymSettings({ org }: { org: Organization }) {
  const { isOwner, updateOrganization } = useOrg();
  const [form, setForm] = useState(org);
  const fields = [ ["name", "Nom de la salle"], ["phone", "Téléphone"], ["address", "Adresse"], ["city", "Ville"], ["ice", "ICE"], ["tax_id", "Identifiant fiscal"], ["invoice_prefix", "Préfixe des factures"] ] as const;
  return <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); const { id, created_at, ...patch } = form; void act(() => updateOrganization(patch), "Réglages enregistrés").catch(() => {}); }}>
    <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <div key={key} className="space-y-1"><Label htmlFor={`gym-${key}`}>{label}</Label><Input id={`gym-${key}`} disabled={!isOwner} value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>)}
    {([ ["vat_rate", "TVA (%)", 100], ["max_reception_discount_pct", "Remise maximale réception (%)", 100], ["anti_passback_minutes", "Anti-passback (minutes)", undefined] ] as const).map(([key, label, max]) => <div key={key} className="space-y-1"><Label htmlFor={`gym-${key}`}>{label}</Label><Input id={`gym-${key}`} type="number" min={0} max={max} step={key === "vat_rate" ? "0.01" : "1"} disabled={!isOwner} value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} /></div>)}</div>
    {isOwner && <Button type="submit"><Save />Enregistrer la salle</Button>}
  </form>;
}

export function PlanSettings({ orgId }: { orgId: string }) {
  const list = plans(orgId);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({ name: "", months: "1", price: "" });
  const edit = (p: Plan) => { setEditing(p); setForm({ name: p.name, months: String(p.duration_months), price: String(p.price_cents / 100) }); };
  return <div className="space-y-5"><ul className="divide-y">{list.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-3 py-4"><div className="min-w-0 flex-1"><p className="font-medium">{p.name}</p><p className="text-sm text-muted-foreground">{p.duration_months} mois · {formatMAD(p.price_cents)}</p></div><Switch aria-label={`Activer ${p.name}`} checked={p.is_active} onCheckedChange={(v) => act(() => setPlanActive(p.id, v), v ? "Formule réactivée" : "Formule désactivée").catch(() => {})} /><Button variant="ghost" size="icon" aria-label={`Modifier ${p.name}`} onClick={() => edit(p)}><Pencil /></Button></li>)}</ul>
    <form className="border-t pt-5" onSubmit={async (e) => { e.preventDefault(); const cents = parseMAD(form.price); try { await act(() => savePlan(editing?.id ?? null, { name: form.name, duration_months: Number(form.months), price_cents: cents ?? -1 }), "Formule enregistrée"); setEditing(null); setForm({ name: "", months: "1", price: "" }); } catch {} }}>
      <h3 className="mb-3 font-semibold">{editing ? "Modifier la formule" : "Nouvelle formule"}</h3><div className="grid gap-3 sm:grid-cols-3"><div><Label htmlFor="plan-name">Nom</Label><Input id="plan-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div><Label htmlFor="plan-months">Durée (mois)</Label><Input id="plan-months" type="number" min={1} max={36} value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} required /></div><div><Label htmlFor="plan-price">Prix (MAD)</Label><Input id="plan-price" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div></div><div className="mt-4 flex gap-2"><Button type="submit">{editing ? <Save /> : <Plus />}{editing ? "Enregistrer la formule" : "Ajouter la formule"}</Button>{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm({ name: "", months: "1", price: "" }); }}>Annuler</Button>}</div>
    </form></div>;
}

export function TeamSettings() {
  const { staff, invitations, profile, isOwner, inviteStaff, removeStaff, cancelInvitation, changeStaffRole } = useOrg();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("receptionist");
  return <div className="space-y-6"><ul className="divide-y">{staff.map((s) => <li key={s.user_id} className="flex flex-wrap items-center gap-3 py-4"><div className="min-w-0 flex-1"><p className="font-medium break-words">{s.full_name}{s.user_id === profile?.id && " (vous)"}</p><p className="break-all text-sm text-muted-foreground">{s.email}</p></div>{isOwner && s.role !== "owner" ? <Select value={s.role} onValueChange={(v) => act(() => changeStaffRole(s.user_id, v as StaffRole), "Rôle modifié").catch(() => {})}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manager">Gérant</SelectItem><SelectItem value="receptionist">Réception</SelectItem></SelectContent></Select> : <span className="text-sm text-muted-foreground">{ROLE_LABELS[s.role]}</span>}{s.role !== "owner" && (isOwner || s.role === "receptionist") && <Confirm title="Retirer de l’équipe ?" description={s.full_name} trigger={<Button variant="ghost" size="icon" aria-label={`Retirer ${s.full_name}`}><Trash2 /></Button>} onConfirm={() => act(() => removeStaff(s.user_id), "Accès retiré")} />}</li>)}</ul>
    {invitations.length > 0 && <div><h3 className="font-semibold">Invitations en attente</h3><ul className="divide-y">{invitations.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-3 py-3"><span className="min-w-0 flex-1 break-all text-sm">{i.email} · {ROLE_LABELS[i.role]}</span><Confirm title="Annuler l’invitation ?" trigger={<Button variant="ghost" size="icon" aria-label={`Annuler l’invitation de ${i.email}`}><Trash2 /></Button>} onConfirm={() => act(() => cancelInvitation(i.id), "Invitation annulée")} /></li>)}</ul></div>}
    <form className="flex flex-wrap items-end gap-3 border-t pt-5" onSubmit={async (e) => { e.preventDefault(); try { const result = await act(() => inviteStaff(email, role)); const { toast } = await import("sonner"); toast.success(result === "added" ? "Personne ajoutée à l’équipe" : "Invitation simulée enregistrée"); setEmail(""); } catch {} }}><div className="min-w-48 flex-1"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><Select value={role} onValueChange={(v) => setRole(v as StaffRole)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{isOwner && <SelectItem value="manager">Gérant</SelectItem>}<SelectItem value="receptionist">Réception</SelectItem></SelectContent></Select><Button type="submit"><Plus />Inviter</Button></form>
  </div>;
}

function TemplateForm({ template }: { template: ReminderTemplate }) {
  const [form, setForm] = useState(template);
  return <form className="space-y-3 border-b py-5 last:border-0" onSubmit={(e) => { e.preventDefault(); void act(() => saveReminderTemplate(template.id, form), "Modèle enregistré").catch(() => {}); }}><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{template.kind === "unpaid" ? "Reste à payer" : template.offset_days > 0 ? "Après expiration" : "Avant expiration"}</h3><Switch aria-label="Modèle actif" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div><Label htmlFor={`template-${template.id}`}>Message WhatsApp</Label><Textarea id={`template-${template.id}`} rows={4} value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} /><Button variant="outline" type="submit"><Save />Enregistrer le modèle</Button></form>;
}
export function ReminderSettings({ orgId }: { orgId: string }) { return <div>{reminderTemplates(orgId).map((t) => <TemplateForm key={JSON.stringify(t)} template={t} />)}</div>; }