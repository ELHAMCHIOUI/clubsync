// Client Supabase (navigateur). L'URL et la clé « publishable » sont PUBLIQUES par conception :
// la sécurité repose sur la RLS et les fonctions SQL de la base (supabase/migrations).
// Ne jamais mettre ici la clé service_role / secrète.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL =
  import.meta.env["VITE_SUPABASE_URL"] || "https://hkudrngdjuuasgrtkxnd.supabase.co";
const SUPABASE_KEY =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_-6NbeDHTx6DBtcx3__3_8w_KSR0XIlH";

const isBrowser = typeof window !== "undefined";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    storage: isBrowser ? window.localStorage : undefined,
  },
});

/** Traduit les erreurs Supabase / Postgres en messages lisibles (les fonctions SQL répondent déjà en français). */
export function friendlyError(error: { message?: string } | null | undefined): Error {
  const message = error?.message ?? "Erreur inattendue";
  if (/fetch failed|Failed to fetch|NetworkError|ENOTFOUND/i.test(message))
    return new Error(
      "Impossible de joindre la base de données. Vérifiez votre connexion internet.",
    );
  if (/row-level security|permission denied/i.test(message))
    return new Error("Action non autorisée pour votre rôle");
  if (/violates foreign key/i.test(message))
    return new Error("Impossible : cet élément est utilisé ailleurs (archivez-le plutôt)");
  if (/duplicate key/i.test(message)) return new Error("Cet élément existe déjà");
  if (/check constraint/i.test(message)) return new Error("Valeur invalide");
  if (/invalid login credentials/i.test(message))
    return new Error("Email ou mot de passe incorrect");
  if (/email not confirmed/i.test(message))
    return new Error("Email non confirmé : cliquez sur le lien reçu par email");
  if (/already registered|already exists/i.test(message))
    return new Error("Un compte existe déjà avec cet email");
  if (/rate limit/i.test(message))
    return new Error("Trop de tentatives, réessayez dans quelques minutes");
  return new Error(message);
}
