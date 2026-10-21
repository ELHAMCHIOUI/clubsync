import { useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";

/** Boîte de confirmation pour les actions destructives, avec motif ou mot à taper optionnel. */
export function Confirm({
  trigger, title, description, confirmLabel = "Confirmer", reasonLabel, typeToConfirm, onConfirm,
}: {
  trigger: ReactNode; title: string; description?: ReactNode; confirmLabel?: string;
  reasonLabel?: string; typeToConfirm?: string; onConfirm: (reason: string) => Promise<unknown> | void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = typeToConfirm ? text.trim() === typeToConfirm : reasonLabel ? text.trim().length >= 3 : true;
  return (
    <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setText(""); }}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {(reasonLabel || typeToConfirm) && (
          <div className="space-y-2">
            <Label htmlFor="confirm-text">{reasonLabel ?? `Tapez ${typeToConfirm} pour confirmer`}</Label>
            <Input id="confirm-text" value={text} onChange={(e) => setText(e.target.value)} className="h-11" autoFocus />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Retour</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ok || busy}
            className={buttonVariants({ variant: "destructive" })}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try { await onConfirm(text.trim()); setOpen(false); setText(""); } catch { /* toast déjà affiché */ } finally { setBusy(false); }
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
