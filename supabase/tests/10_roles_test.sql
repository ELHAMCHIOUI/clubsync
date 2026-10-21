-- Tests des règles métier et des droits par rôle (PostgreSQL local + 00_supabase_stub.sql).
-- Lancement : voir supabase/tests/README.md. S'arrête à la première erreur.
\set ON_ERROR_STOP 1
\set QUIET 1

create schema if not exists test;
grant usage on schema test to anon, authenticated;

-- Vérifie une condition
create or replace function test.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ÉCHEC : %', label; end if;
  raise notice 'ok - %', label;
end $$;

-- Vérifie qu'une requête échoue (et que le message contient un extrait attendu)
create or replace function test.fails(q text, expected text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if position(lower(expected) in lower(sqlerrm)) = 0 then
      raise exception 'ÉCHEC : % (message inattendu : %)', label, sqlerrm;
    end if;
    raise notice 'ok - % (refusé : %)', label, sqlerrm;
    return;
  end;
  raise exception 'ÉCHEC : % (aurait dû être refusé)', label;
end $$;
grant execute on all functions in schema test to anon, authenticated;

-- Utilisateurs
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.ma',   '{"full_name":"Propriétaire"}'),
  ('00000000-0000-0000-0000-00000000000b', 'manager@test.ma', '{"full_name":"Gérant"}'),
  ('00000000-0000-0000-0000-00000000000d', 'other@test.ma',   '{"full_name":"Autre salle"}');

\set owner     '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}'
\set manager   '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}'
\set reception '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}'
\set other     '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}'

-- ===================== Propriétaire : création de la salle =====================
set role authenticated;
select set_config('request.jwt.claims', :'owner', false);
select public.create_organization('Atlas Fitness') as org \gset
select test.ok((select count(*) = 3 from public.reminder_templates where organization_id = :'org'), 'modèles de relance créés');
select test.ok((select count(*) = 1 from public.loyalty_settings where organization_id = :'org'), 'réglages fidélité créés');
select test.ok((select count(*) = 0 from public.members), 'aucune donnée de démo');

-- Invitations
select test.ok(public.invite_staff(:'org', 'Reception@Test.ma', 'receptionist') = 'invited', 'invitation réception (compte inexistant)');
select test.ok(public.invite_staff(:'org', 'manager@test.ma', 'manager') = 'added', 'gérant existant ajouté directement');
select test.fails(format('select public.invite_staff(%L, %L, %L)', :'org', 'x@test.ma', 'owner'), 'propriétaire', 'pas de second propriétaire');
reset role;

-- La réceptionniste crée son compte : rattachement automatique
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'reception@test.ma');
select test.ok((select role = 'receptionist' from public.organization_members
                where user_id = '00000000-0000-0000-0000-00000000000c'), 'réception rattachée à l''inscription');

-- Autre salle
set role authenticated;
select set_config('request.jwt.claims', :'other', false);
select public.create_organization('Autre Gym') as other_org \gset

-- ===================== Gérant =====================
select set_config('request.jwt.claims', :'manager', false);
select test.fails(format('select public.invite_staff(%L, %L, %L)', :'org', 'm2@test.ma', 'manager'), 'propriétaire', 'gérant ne peut pas inviter un gérant');
select test.ok(public.invite_staff(:'org', 'rec2@test.ma', 'receptionist') = 'invited', 'gérant invite une réceptionniste');
select test.fails(format('select public.change_staff_role(%L, %L, %L)', :'org', '00000000-0000-0000-0000-00000000000c', 'manager'), 'propriétaire', 'gérant ne change pas les rôles');
update public.organizations set name = 'Piraté' where id = :'org';
select test.ok((select name = 'Atlas Fitness' from public.organizations where id = :'org'), 'gérant ne modifie pas les infos légales de la salle');

insert into public.plans (organization_id, name, duration_months, price_cents)
values (:'org', 'Mensuel', 1, 30000) returning id as plan_1m \gset
insert into public.plans (organization_id, name, duration_months, price_cents)
values (:'org', 'Trimestriel', 3, 80000) returning id as plan_3m \gset
insert into public.expenses (organization_id, category, label, amount_cents, method)
values (:'org', 'Électricité', 'Facture', 20000, 'cash');

-- ===================== Réception =====================
select set_config('request.jwt.claims', :'reception', false);
select test.fails(format('insert into public.plans (organization_id, name, duration_months, price_cents) values (%L, %L, 1, 100)', :'org', 'Promo'),
                  'row-level security', 'réception ne crée pas de formule');
select test.fails(format('insert into public.expenses (organization_id, category, amount_cents) values (%L, %L, 100)', :'org', 'Autre'),
                  'row-level security', 'réception ne saisit pas de charge');
select test.ok((select count(*) = 0 from public.expenses), 'réception ne voit pas les charges');
select test.ok((select count(*) = 0 from public.audit_log), 'réception ne voit pas l''audit');

insert into public.members (organization_id, full_name, phone) values (:'org', 'Youssef Amrani', '0612345678')
returning id as m1 \gset
select test.ok((select count(*) = 1 from public.member_cards where member_id = :'m1'), 'carte QR créée automatiquement');
select qr_token as qr1, link_token as link1 from public.member_cards where member_id = :'m1' \gset

-- Remise : plafond 10 % pour la réception
select test.fails(format('select public.create_subscription(%L, %L, public.local_today(), 6100, 0, %L, %L)', :'m1', :'plan_1m', 'cash', ''),
                  'remise trop élevée', 'remise au-delà du plafond refusée');
select public.create_subscription(:'m1', :'plan_1m', public.local_today(), 3000, 10000, 'cash', '') as sub1 \gset
select test.ok((select amount_due_cents = 27000 and balance_cents = 17000 and status = 'active'
                from public.subscription_overview where id = :'sub1'), 'abonnement : remise 10 %, 1er paiement 100 MAD');
select test.ok((select points = 50 + 20 from public.member_overview where id = :'m1'), 'points : bienvenue 50 + mensuel 20');

-- Paiements
select test.fails(format('select public.record_payment(%L, 20000, %L)', :'sub1', 'cash'), 'dépasse le reste', 'paiement au-delà du reste refusé');
select public.record_payment(:'sub1', 7000, 'card', 'TPE-1', '') as pay2 \gset
select test.fails(format('insert into public.payments (organization_id, subscription_id, member_id, amount_cents, method) values (%L,%L,%L,100,%L)', :'org', :'sub1', :'m1', 'cash'),
                  'row-level security', 'insertion directe de paiement interdite');
update public.subscriptions set amount_due_cents = 1 where id = :'sub1';
select test.ok((select amount_due_cents = 27000 from public.subscriptions where id = :'sub1'), 'modification directe d''abonnement ignorée');
select test.fails(format('select public.update_subscription(%L, public.local_today(), public.local_today(), 1)', :'sub1'), 'réservée au gérant', 'réception ne corrige pas le montant');
select test.fails(format('select public.void_payment(%L, %L)', :'pay2', 'erreur'), 'réservée au gérant', 'réception n''annule pas un paiement');
select test.fails(format('select public.set_subscription_state(%L, %L)', :'sub1', 'cancel'), 'réservée au gérant', 'réception n''annule pas un abonnement');

-- Factures
select public.create_invoice(:'sub1') as inv1 \gset
select test.ok((select number = 1 from public.invoices where id = :'inv1'), 'facture n°1');
select test.fails(format('select public.create_invoice(%L)', :'sub1'), 'déjà une facture', 'pas de double facture');

-- Entrées
select test.ok((select (public.check_in(:'org', :'qr1') ->> 'result') = 'accepted'), 'scan QR accepté');
select test.ok((select points = 80 from public.member_overview where id = :'m1'), 'points de visite +10');
select test.ok((select (public.check_in(:'org', :'qr1') ->> 'reason') like 'Déjà entré%'), 'anti-retour : 2e scan refusé');
select test.ok((select (public.check_in(:'org', 'NBinconnu') ->> 'reason') = 'QR inconnu ou désactivé'), 'QR inconnu refusé');
select test.ok((select count(*) = 1 from public.loyalty_ledger where member_id = :'m1' and kind = 'visit'), 'une seule visite comptée');

-- Gel
select public.set_subscription_state(:'sub1', 'freeze');
select test.ok((select (public.manual_check_in(:'m1', 'téléphone oublié') ->> 'reason') = 'Abonnement gelé'), 'entrée refusée si gelé');
select public.set_subscription_state(:'sub1', 'unfreeze');

-- Parrainage
insert into public.members (organization_id, full_name, phone, referred_by)
values (:'org', 'Sara Bennani', '0698765432', :'m1') returning id as m2 \gset
select public.create_subscription(:'m2', :'plan_3m', public.local_today(), 0, 0, 'cash', '') as sub2 \gset
select test.ok((select points = 80 + 300 from public.member_overview where id = :'m1'), 'parrain : +300 points');
select test.ok((select points = 50 + 60 from public.member_overview where id = :'m2'), 'filleule : bienvenue + 3 mois × 20');

-- Renouvellement avant la fin : bonus
select public.create_subscription(:'m1', :'plan_1m', (public.local_today() + 31), 0, 0, 'cash', '') as sub1b \gset
select test.ok((select points = 380 + 20 + 100 from public.member_overview where id = :'m1'), 'renouvellement anticipé : +20 +100');

-- Récompenses
select test.fails(format('insert into public.rewards (organization_id, name, points_cost) values (%L, %L, 10)', :'org', 'Gourde'),
                  'row-level security', 'réception ne crée pas de récompense');
reset role;
set role authenticated;
select set_config('request.jwt.claims', :'manager', false);
insert into public.rewards (organization_id, name, reward_type, points_cost) values (:'org', 'Pass invité', 'guest_pass', 200)
returning id as rw1 \gset
insert into public.rewards (organization_id, name, reward_type, points_cost) values (:'org', 'Mois offert', 'free_days', 5000)
returning id as rw2 \gset
select set_config('request.jwt.claims', :'reception', false);
select public.redeem_reward(:'m1', :'rw1', '') as red1 \gset
select test.ok((select points = 300 from public.member_overview where id = :'m1'), 'échange : -200 points');
select test.fails(format('select public.redeem_reward(%L, %L, %L)', :'m1', :'rw2', ''), 'points insuffisants', 'échange refusé si solde insuffisant');
select test.fails(format('select public.adjust_points(%L, 50, %L)', :'m1', 'geste commercial'), 'réservée au gérant', 'réception n''ajuste pas les points');

-- Caisse : espèces du jour = 100 MAD encaissés - 200 MAD de charge espèces = -100 MAD
select test.ok((select (public.close_cash(:'org', public.local_today(), 0, '') ->> 'expected_cents')::int = -10000), 'caisse attendue = espèces - charges espèces');
select test.ok((select sum(total_cents) = 17000 from public.revenue_by_month where organization_id = :'org'), 'totaux mensuels des encaissements');
select test.ok((select count(*) = 0 from public.expenses_by_month), 'réception : pas de totaux de charges');
select id as closing from public.cash_closings where organization_id = :'org' \gset
select test.fails(format('select public.validate_cash_closing(%L)', :'closing'), 'réservée au gérant', 'réception ne valide pas la caisse');

-- Carte
select test.fails(format('select public.regenerate_card(%L)', :'m1'), 'réservée au gérant', 'réception ne régénère pas le QR');
delete from public.members where id = :'m2';
select test.ok((select count(*) = 1 from public.members where id = :'m2'), 'réception ne supprime pas un membre');

-- Photo (Storage)
insert into storage.objects (bucket_id, name) values ('member-photos', :'org' || '/' || :'m1' || '.jpg');
select test.ok(true, 'réception enregistre une photo dans le dossier de sa salle');

-- ===================== Gérant : actions réservées =====================
select set_config('request.jwt.claims', :'manager', false);
select public.void_payment(:'pay2', 'Erreur de saisie');
select test.ok((select balance_cents = 17000 from public.subscription_overview where id = :'sub1'), 'paiement annulé : reste recalculé');
select public.validate_cash_closing(:'closing');
select public.adjust_points(:'m1', 50, 'Geste commercial');
select test.ok((select points = 350 from public.member_overview where id = :'m1'), 'ajustement +50');
select public.regenerate_card(:'m1');
select test.ok((select (public.check_in(:'org', :'qr1') ->> 'reason') = 'QR inconnu ou désactivé'), 'ancien QR désactivé après régénération');
select test.ok((select count(*) > 0 from public.audit_log where entity = 'payments'), 'gérant voit l''audit');
select test.fails(format('select public.remove_staff(%L, %L)', :'org', '00000000-0000-0000-0000-00000000000a'), 'propriétaire', 'propriétaire jamais retiré');

-- Réception : clôture validée non modifiable
select set_config('request.jwt.claims', :'reception', false);
select test.fails(format('select public.close_cash(%L, public.local_today(), 500, %L)', :'org', ''), 'déjà validée', 'clôture validée verrouillée');

-- ===================== Autre salle : isolation =====================
select set_config('request.jwt.claims', :'other', false);
select test.ok((select count(*) = 0 from public.members), 'autre salle : aucun membre visible');
select test.ok((select count(*) = 0 from public.payment_overview), 'autre salle : aucun paiement visible');
select test.fails(format('select public.check_in(%L, %L)', :'org', 'x'), 'accès refusé', 'autre salle : scan refusé');
select test.fails(format('select public.create_subscription(%L, %L, public.local_today())', :'m1', :'plan_1m'), 'accès refusé', 'autre salle : pas d''abonnement');
select test.fails(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'member-photos', :'org' || '/x.jpg'),
                  'row-level security', 'autre salle : pas d''accès aux photos');

-- ===================== Visiteur anonyme : carte publique =====================
reset role;
select link_token as link1 from public.member_cards where member_id = :'m1' \gset
set role anon;
select set_config('request.jwt.claims', '', false);
select test.ok((select count(*) = 0 from public.members), 'anonyme : aucune donnée');
select test.ok((select (public.get_public_card(:'link1') ->> 'member_name') = 'Youssef Amrani'), 'carte publique via le lien');
select test.ok((select (public.get_public_card(:'link1') ->> 'points')::int = 350), 'carte publique : solde de points');
select test.ok((select public.get_public_card('00000000000000000000000000000000') is null), 'lien inconnu : rien');
select test.fails('select public.check_in(gen_random_uuid(), ''x'')', 'permission denied', 'anonyme : pas de scan');

-- ===================== Propriétaire =====================
reset role;
set role authenticated;
select set_config('request.jwt.claims', :'owner', false);
select public.change_staff_role(:'org', '00000000-0000-0000-0000-00000000000c', 'manager');
select test.ok((select role = 'manager' from public.organization_members where user_id = '00000000-0000-0000-0000-00000000000c'), 'propriétaire change un rôle');
update public.organizations set ice = '001234567000089' where id = :'org';
select test.ok((select ice = '001234567000089' from public.organizations where id = :'org'), 'propriétaire modifie les infos légales');

-- ===================== Expiration des points après inactivité =====================
reset role;
update public.loyalty_ledger set created_at = now() - interval '13 months' where member_id = :'m2';
set role authenticated;
select set_config('request.jwt.claims', :'manager', false);
select test.ok((select points = 0 from public.member_overview where id = :'m2'), 'points inactifs depuis 12 mois : solde 0');
select public.adjust_points(:'m2', 10, 'Retour du membre');
select test.ok((select points = 10 from public.member_overview where id = :'m2'), 'nouveaux points sans réactiver les anciens');

reset role;
\echo 'Tous les tests sont passés.'
