# Tests de la base

Ces fichiers servent à tester les migrations **sur un PostgreSQL local**, sans Supabase. Ne les exécutez pas sur
votre projet Supabase.

- `00_supabase_stub.sql` : simule ce que Supabase fournit (rôles `anon` / `authenticated`, `auth.users`,
  `auth.uid()`, Storage).
- `10_roles_test.sql` : scénario complet propriétaire / gérant / réception / autre salle / visiteur anonyme :
  invitations, plafond de remise, paiements, factures, scan QR et anti-retour, gel, parrainage, renouvellement,
  récompenses, caisse, régénération du QR, isolation entre salles, expiration des points.
- `run.sh` : crée une base `nabd_test`, applique le stub + les migrations, lance le scénario.
- `gen_types.py` : génère `src/lib/database.types.ts` depuis la base locale (alternative à `npm run db:types`).

```bash
# PostgreSQL 15+ installé localement
bash supabase/tests/run.sh
# ou avec un autre utilisateur :
PSQL="psql -U postgres -h localhost" bash supabase/tests/run.sh
```

Le script affiche une ligne `ok - …` par vérification et se termine par « Tous les tests sont passés. »
