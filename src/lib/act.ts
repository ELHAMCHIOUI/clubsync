import { toast } from "sonner";

/** Exécute une action, affiche un toast de succès ou le message d'erreur tel quel. Relance l'erreur. */
export async function act<T>(fn: () => Promise<T>, success?: string): Promise<T> {
  try {
    const r = await fn();
    if (success) toast.success(success);
    return r;
  } catch (e) {
    toast.error((e as Error).message);
    throw e;
  }
}
