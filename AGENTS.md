<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
## Base de données : Supabase (réelle)
- L'interface est branchée sur Supabase. Les pages appellent uniquement `src/lib/db.ts` (données) et `src/lib/session.tsx`
  (`useOrg()` : compte, salle, rôle, équipe). Ne pas appeler Supabase directement depuis les pages.
- `src/lib/db.ts` charge les données de la salle en mémoire (vues et tables Supabase, RLS = salle de l'utilisateur),
  expose des lectures synchrones + `useDb()`, et toutes les écritures sensibles passent par `supabase.rpc(...)`.
  Les données sont rechargées après chaque écriture, toutes les 60 s et au retour sur l'onglet.
- Client : `src/integrations/supabase/client.ts` (URL + clé publishable, publiques par conception). Types : `types.ts`.
- Schéma, fonctions SQL, RLS et tests : `supabase/migrations` et `supabase/tests` — gérés par Claude Code.
  **Ne pas créer ni modifier de migration depuis Lovable, ne pas activer Lovable Cloud.**
- Photos des membres : bucket privé `member-photos` (Storage), affichées via URL signées.
- `src/lib/mock-db.ts` et `src/lib/mock-session.tsx` ne servent plus qu'aux tests unitaires existants.

