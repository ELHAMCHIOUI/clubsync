import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { act } from "@/lib/act";
import { insertMember, members } from "@/lib/mock-db";
import { useOrg } from "@/lib/mock-session";

export function NewMemberDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { org } = useOrg();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", phone: "", email: "", notes: "", referred_by: "none", whatsapp_opt_in: true });
  const [busy, setBusy] = useState(false);
  const list = org ? members(org.id).filter((m) => !m.archived_at).sort((a, b) => a.full_name.localeCompare(b.full_name)) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const m = await act(() => insertMember({
        full_name: f.full_name, phone: f.phone.trim() || null, email: f.email.trim() || null, notes: f.notes.trim() || null,
        whatsapp_opt_in: f.whatsapp_opt_in, referred_by: f.referred_by === "none" ? null : f.referred_by,
      }), "Membre inscrit");
      setOpen(false);
      setF({ full_name: "", phone: "", email: "", notes: "", referred_by: "none", whatsapp_opt_in: true });
      navigate({ to: "/members/$id", params: { id: m.id }, search: { new: 1 } });
    } catch { /* valeurs conservées */ } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><UserPlus />Inscrire un membre</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Inscrire un membre</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nm-name">Nom complet *</Label>
            <Input id="nm-name" required className="h-11" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nm-phone">Téléphone WhatsApp</Label>
              <Input id="nm-phone" type="tel" placeholder="06 12 34 56 78" className="h-11" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nm-email">Email</Label>
              <Input id="nm-email" type="email" className="h-11" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Parrainé par</Label>
            <Select value={f.referred_by} onValueChange={(v) => setF({ ...f, referred_by: v })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Personne</SelectItem>
                {list.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nm-notes">Notes</Label>
            <Textarea id="nm-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox checked={f.whatsapp_opt_in} onCheckedChange={(c) => setF({ ...f, whatsapp_opt_in: c === true })} />
            Accepte les messages WhatsApp
          </label>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Inscrire</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
