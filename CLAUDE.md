# CLAUDE.md — Nabd (clubsync)

Interface Lovable (TanStack Start + React + Tailwind + shadcn) branchée sur Supabase.
Lire aussi `AGENTS.md` (règles Lovable : ne jamais réécrire l'historique git poussé ; `main` se synchronise avec Lovable).

## Répartition
- **Lovable** : écrans (`src/routes`, `src/components`).
- **Claude Code** : backend → `supabase/migrations`, `supabase/tests`, futures `supabase/functions`,
  et la couche de données `src/lib/db.ts`, `src/lib/session.tsx`, `src/integrations/supabase/`.

## Règles backend
- Toute évolution du schéma = NOUVEAU fichier daté dans `supabase/migrations` (ne jamais modifier une migration exécutée),
  test ajouté dans `supabase/tests/10_roles_test.sql`, puis régénérer `src/integrations/supabase/types.ts`
  (`npx supabase gen types typescript --project-id hkudrngdjuuasgrtkxnd > src/integrations/supabase/types.ts`).
- Écritures sensibles uniquement via les fonctions SQL (`supabase.rpc`) : abonnements, paiements, factures, entrées,
  points, caisse, carte, équipe. Rôles : owner / manager / receptionist, vérifiés dans la base (`require_role`).
- Montants en centimes MAD ; « aujourd'hui » = Africa/Casablanca ; erreurs SQL en français.
- `src/lib/db.ts` garde la même API que `mock-db.ts` (les pages n'en connaissent pas d'autre). Champs texte vides en
  base (`''`) ↔ `null` côté interface.
- Secrets (Google Wallet, WhatsApp Cloud API) : uniquement dans des Edge Functions (`supabase/functions`), jamais dans `src/`.
  Jamais de clé service_role côté navigateur.

## Commandes
`bun install` · `bun run dev` · `bun run build` · `bun run test` · tests SQL : `bash supabase/tests/run.sh` (PostgreSQL local).

## Prochaines étapes
1. Edge Function « Ajouter à Google Wallet » (même `member_cards.qr_token`).
2. Relances WhatsApp automatiques (cron + WhatsApp Cloud API), historique déjà dans `reminder_logs`.
3. Remplacer le chargement complet de la salle par des requêtes ciblées (React Query) si une salle dépasse ~2 000 membres.
