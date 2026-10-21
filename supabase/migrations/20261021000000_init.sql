-- =====================================================================
-- Nabd — gestion de salles de sport (Maroc) — migration initiale Supabase
--
-- Espace gérant / réception. Contenu :
--   salles, équipe (propriétaire / gérant / réception) et invitations,
--   membres + carte QR personnelle, formules, abonnements, paiements en
--   tranches, factures, charges, clôture de caisse, entrées (check-in),
--   fidélité (points, récompenses, parrainage), relances WhatsApp, audit.
--
-- Principes :
--   * montants en centimes MAD (integer) : 30000 = 300,00 MAD
--   * organization_id sur chaque table métier + RLS (multi-salles)
--   * lectures : RLS ; écritures sensibles : UNIQUEMENT via des fonctions
--     (RPC) qui vérifient le rôle. Next.js et Lovable appellent les mêmes
--     fonctions : les règles sont dans la base, pas dans l'interface.
--   * un paiement, une facture ou un mouvement de points ne se supprime
--     jamais ; on annule ou on passe une écriture inverse.
--   * « aujourd'hui » = date à Casablanca (fonction local_today()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.staff_role          as enum ('owner', 'manager', 'receptionist');
create type public.subscription_state  as enum ('active', 'frozen', 'cancelled');
create type public.payment_method      as enum ('cash', 'transfer', 'card', 'cheque');
create type public.reminder_kind       as enum ('expiry', 'unpaid');
create type public.checkin_result      as enum ('accepted', 'refused');
create type public.checkin_method      as enum ('qr', 'manual');
create type public.loyalty_kind        as enum ('welcome', 'visit', 'subscription', 'renewal', 'referral',
                                                'redemption', 'adjustment', 'expiration');
create type public.reward_type         as enum ('guest_pass', 'discount', 'free_days', 'goodie', 'partner', 'other');

-- ---------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------
create or replace function public.local_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Africa/Casablanca')::date;
$$;

-- Jeton aléatoire (128 bits) sans extension : 32 caractères hexadécimaux.
create or replace function public.random_token()
returns text language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

-- ---------------------------------------------------------------------
-- Salles (une salle = un tenant)
-- ---------------------------------------------------------------------
create table public.organizations (
  id                         uuid primary key default gen_random_uuid(),
  name                       text not null check (length(trim(name)) >= 2),
  phone                      text not null default '',
  address                    text not null default '',
  city                       text not null default '',
  ice                        text not null default '',          -- identifiant commun de l'entreprise
  tax_id                     text not null default '',          -- identifiant fiscal (IF)
  vat_rate                   numeric(5,2) not null default 0 check (vat_rate between 0 and 100),
  invoice_prefix             text not null default 'F' check (invoice_prefix ~ '^[A-Za-z0-9]{1,10}$'),
  invoice_seq                integer not null default 0,        -- compteur de factures (trigger)
  max_reception_discount_pct numeric(5,2) not null default 10 check (max_reception_discount_pct between 0 and 100),
  anti_passback_minutes      integer not null default 120 check (anti_passback_minutes between 0 and 1440),
  created_at                 timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Profils du staff (1-1 avec auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  email      text not null default '',
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            public.staff_role not null default 'receptionist',
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

-- Invitations : la personne crée son compte avec cet email et rejoint la salle automatiquement.
create table public.staff_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null check (email = lower(trim(email)) and email like '%@%'),
  role            public.staff_role not null check (role <> 'owner'),
  invited_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, email)
);
create index staff_invitations_email_idx on public.staff_invitations (email);

-- ---------------------------------------------------------------------
-- Membres (adhérents) : fiches sans compte
-- ---------------------------------------------------------------------
create table public.members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name       text not null check (length(trim(full_name)) >= 2),
  phone           text not null default '',          -- format conseillé : 06 12 34 56 78 ou +212...
  email           text not null default '',
  notes           text not null default '',
  whatsapp_opt_in boolean not null default true,
  photo_path      text,                              -- Storage : member-photos/{organization_id}/{member_id}.jpg
  referred_by     uuid,                              -- parrain (membre de la même salle)
  archived_at     timestamptz,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (id, organization_id),
  check (referred_by is null or referred_by <> id),
  foreign key (referred_by, organization_id) references public.members (id, organization_id) on delete set null (referred_by)
);
create index members_org_name_idx  on public.members (organization_id, full_name);
create index members_org_phone_idx on public.members (organization_id, phone);

-- Carte membre : un QR fixe par membre (jamais l'identifiant du membre) et un lien
-- personnel pour afficher / installer la carte. Régénérer = nouveaux jetons.
create table public.member_cards (
  member_id       uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  qr_token        text not null unique default ('NB' || public.random_token()),
  link_token      text not null unique default public.random_token(),
  issued_at       timestamptz not null default now(),
  regenerated_at  timestamptz,
  foreign key (member_id, organization_id) references public.members (id, organization_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Formules, abonnements, paiements, factures
-- ---------------------------------------------------------------------
create table public.plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(trim(name)) >= 2),
  duration_months integer not null check (duration_months between 1 and 36),
  price_cents     integer not null check (price_cents >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (id, organization_id)
);
create index plans_org_idx on public.plans (organization_id);

create table public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  member_id        uuid not null,
  plan_id          uuid not null,
  start_date       date not null,
  end_date         date not null,
  amount_due_cents integer not null check (amount_due_cents >= 0),
  discount_cents   integer not null default 0 check (discount_cents >= 0),
  state            public.subscription_state not null default 'active',
  frozen_from      date,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (id, organization_id),
  check (end_date >= start_date),
  foreign key (member_id, organization_id) references public.members (id, organization_id) on delete restrict,
  foreign key (plan_id,   organization_id) references public.plans   (id, organization_id) on delete restrict
);
create index subscriptions_org_end_idx on public.subscriptions (organization_id, end_date);
create index subscriptions_member_idx  on public.subscriptions (member_id);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid not null,
  member_id       uuid not null,
  amount_cents    integer not null check (amount_cents > 0),
  method          public.payment_method not null,
  paid_at         timestamptz not null default now(),
  reference       text not null default '',
  note            text not null default '',
  received_by     uuid references public.profiles (id) on delete set null,
  voided_at       timestamptz,
  voided_by       uuid references public.profiles (id) on delete set null,
  void_reason     text,
  created_at      timestamptz not null default now(),
  check (voided_at is null or void_reason is not null),
  foreign key (subscription_id, organization_id) references public.subscriptions (id, organization_id) on delete restrict,
  foreign key (member_id,       organization_id) references public.members       (id, organization_id) on delete restrict
);
create index payments_org_paid_idx     on public.payments (organization_id, paid_at desc);
create index payments_subscription_idx on public.payments (subscription_id);

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id       uuid not null,
  subscription_id uuid not null unique,
  number          integer not null,
  issued_on       date not null default public.local_today(),
  total_cents     integer not null check (total_cents >= 0),
  vat_rate        numeric(5,2) not null default 0,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, number),
  foreign key (subscription_id, organization_id) references public.subscriptions (id, organization_id) on delete restrict,
  foreign key (member_id,       organization_id) references public.members       (id, organization_id) on delete restrict
);
create index invoices_org_issued_idx on public.invoices (organization_id, issued_on desc);

-- ---------------------------------------------------------------------
-- Charges et clôture de caisse
-- ---------------------------------------------------------------------
create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category        text not null,
  label           text not null default '',
  amount_cents    integer not null check (amount_cents > 0),
  method          public.payment_method not null default 'cash',
  spent_on        date not null default public.local_today(),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index expenses_org_spent_idx on public.expenses (organization_id, spent_on desc);

-- Clôture « à l'aveugle » : la réception compte la caisse, le système calcule l'écart,
-- le gérant valide.
create table public.cash_closings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  day             date not null,
  expected_cents  integer not null,              -- espèces encaissées - charges payées en espèces
  counted_cents   integer not null check (counted_cents >= 0),
  difference_cents integer generated always as (counted_cents - expected_cents) stored,
  note            text not null default '',
  closed_by       uuid references public.profiles (id) on delete set null,
  closed_at       timestamptz not null default now(),
  validated_by    uuid references public.profiles (id) on delete set null,
  validated_at    timestamptz,
  unique (organization_id, day)
);

-- ---------------------------------------------------------------------
-- Entrées (check-in)
-- ---------------------------------------------------------------------
create table public.attendance_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id       uuid not null,
  result          public.checkin_result not null,
  reason          text not null default '',
  method          public.checkin_method not null,
  scanned_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  foreign key (member_id, organization_id) references public.members (id, organization_id) on delete cascade
);
create index attendance_org_created_idx on public.attendance_logs (organization_id, created_at desc);
create index attendance_member_idx      on public.attendance_logs (member_id, created_at desc);

-- ---------------------------------------------------------------------
-- Fidélité
-- ---------------------------------------------------------------------
create table public.loyalty_settings (
  organization_id     uuid primary key references public.organizations (id) on delete cascade,
  enabled             boolean not null default true,
  points_per_visit    integer not null default 10  check (points_per_visit >= 0),   -- 1 fois par jour max
  welcome_points      integer not null default 50  check (welcome_points >= 0),     -- 1er abonnement
  points_per_month    integer not null default 20  check (points_per_month >= 0),   -- × durée de la formule
  renewal_bonus       integer not null default 100 check (renewal_bonus >= 0),      -- renouvelé avant la fin
  referral_points     integer not null default 300 check (referral_points >= 0),    -- au parrain
  expiry_months       integer not null default 12  check (expiry_months between 1 and 60) -- après inactivité
);

-- Historique des points : on n'y modifie jamais rien, le solde est la somme.
create table public.loyalty_ledger (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id       uuid not null,
  kind            public.loyalty_kind not null,
  points          integer not null check (points <> 0),
  note            text not null default '',
  subscription_id uuid,
  attendance_id   bigint,
  redemption_id   uuid,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  foreign key (member_id, organization_id) references public.members (id, organization_id) on delete cascade
);
create index loyalty_ledger_member_idx on public.loyalty_ledger (member_id, created_at desc);
create index loyalty_ledger_org_idx    on public.loyalty_ledger (organization_id, created_at desc);

create table public.rewards (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(trim(name)) >= 2),
  description     text not null default '',
  reward_type     public.reward_type not null default 'other',
  points_cost     integer not null check (points_cost > 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.redemptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id       uuid not null,
  reward_id       uuid not null,
  reward_name     text not null,               -- copie au moment de l'échange
  points_cost     integer not null check (points_cost > 0),
  note            text not null default '',
  given_by        uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  foreign key (member_id, organization_id) references public.members (id, organization_id) on delete cascade,
  foreign key (reward_id, organization_id) references public.rewards (id, organization_id) on delete restrict
);
create index redemptions_org_idx on public.redemptions (organization_id, created_at desc);

-- ---------------------------------------------------------------------
-- Relances WhatsApp
-- ---------------------------------------------------------------------
create table public.reminder_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind            public.reminder_kind not null,
  offset_days     integer not null,             -- -7 = J-7 (avant l'échéance), 3 = J+3 (après)
  template        text not null check (length(template) >= 10),
  is_active       boolean not null default true,
  unique (organization_id, kind, offset_days)
);

-- Historique : chaque clic « Relancer » est enregistré avant l'ouverture de WhatsApp.
create table public.reminder_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id       uuid not null,
  subscription_id uuid,
  kind            public.reminder_kind not null,
  sent_by         uuid references public.profiles (id) on delete set null,
  sent_at         timestamptz not null default now(),
  foreign key (member_id, organization_id) references public.members (id, organization_id) on delete cascade
);
create index reminder_logs_member_idx on public.reminder_logs (member_id, sent_at desc);

-- ---------------------------------------------------------------------
-- Journal d'audit
-- ---------------------------------------------------------------------
create table public.audit_log (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id        uuid,
  action          text not null,
  entity          text not null,
  entity_id       text,
  data            jsonb,
  created_at      timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (organization_id, created_at desc);

-- =====================================================================
-- Rôles : fonctions d'aide (security definer : lisent organization_members
-- sans déclencher sa propre RLS)
-- =====================================================================
create or replace function public.org_role(p_org uuid)
returns public.staff_role language sql stable security definer set search_path = '' as $$
  select role from public.organization_members
  where organization_id = p_org and user_id = (select auth.uid());
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.org_role(p_org) is not null;
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.org_role(p_org) in ('owner', 'manager'), false);
$$;

create or replace function public.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.org_role(p_org) = 'owner', false);
$$;

-- Lève une erreur si l'utilisateur n'a pas le niveau demandé : 'staff' | 'admin' | 'owner'.
create or replace function public.require_role(p_org uuid, p_level text)
returns public.staff_role language plpgsql stable security definer set search_path = '' as $$
declare
  v_role public.staff_role := public.org_role(p_org);
begin
  if (select auth.uid()) is null then
    raise exception 'Non connecté';
  end if;
  if v_role is null then
    raise exception 'Accès refusé : vous ne faites pas partie de cette salle';
  end if;
  if p_level = 'admin' and v_role not in ('owner', 'manager') then
    raise exception 'Action réservée au gérant';
  end if;
  if p_level = 'owner' and v_role <> 'owner' then
    raise exception 'Action réservée au propriétaire';
  end if;
  return v_role;
end;
$$;

-- =====================================================================
-- Triggers
-- =====================================================================

-- Nouveau compte : profil + rattachement aux salles qui l'ont invité.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), lower(coalesce(new.email, '')));

  insert into public.organization_members (organization_id, user_id, role)
  select organization_id, new.id, role
  from public.staff_invitations
  where email = lower(coalesce(new.email, ''))
  on conflict do nothing;

  delete from public.staff_invitations where email = lower(coalesce(new.email, ''));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Chaque nouveau membre reçoit sa carte (QR fixe + lien personnel).
create or replace function public.create_member_card()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.member_cards (member_id, organization_id) values (new.id, new.organization_id);
  return new;
end;
$$;
create trigger members_create_card
  after insert on public.members
  for each row execute function public.create_member_card();

-- Numéro de facture continu par salle (verrou sur la ligne organizations).
create or replace function public.assign_invoice_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.organizations set invoice_seq = invoice_seq + 1
  where id = new.organization_id
  returning invoice_seq into new.number;
  return new;
end;
$$;
create trigger invoices_assign_number
  before insert on public.invoices
  for each row execute function public.assign_invoice_number();

-- Audit générique.
create or replace function public.log_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  -- Suppression en cascade d'une salle : rien à journaliser
  if not exists (select 1 from public.organizations where id = (v_row ->> 'organization_id')::uuid) then
    return coalesce(new, old);
  end if;
  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, data)
  values ((v_row ->> 'organization_id')::uuid, (select auth.uid()), tg_op, tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'member_id', v_row ->> 'user_id'), v_row);
  return coalesce(new, old);
end;
$$;
create trigger payments_audit       after insert or update           on public.payments             for each row execute function public.log_audit();
create trigger subscriptions_audit  after insert or update or delete on public.subscriptions        for each row execute function public.log_audit();
create trigger expenses_audit       after insert or update or delete on public.expenses             for each row execute function public.log_audit();
create trigger cash_closings_audit  after insert or update           on public.cash_closings        for each row execute function public.log_audit();
create trigger member_cards_audit   after update                     on public.member_cards         for each row execute function public.log_audit();
create trigger staff_audit          after insert or update or delete on public.organization_members for each row execute function public.log_audit();
create trigger loyalty_audit        after insert                     on public.loyalty_ledger       for each row
  when (new.kind = 'adjustment') execute function public.log_audit();
create trigger members_delete_audit after delete                     on public.members              for each row execute function public.log_audit();

-- =====================================================================
-- Vues (security_invoker : appliquent la RLS de l'utilisateur)
-- Les colonnes *_local sont à l'heure de Casablanca (affichage).
-- =====================================================================
create or replace view public.subscription_overview
with (security_invoker = true) as
select
  s.id,
  s.organization_id,
  s.member_id,
  m.full_name                                     as member_name,
  m.phone                                         as member_phone,
  m.whatsapp_opt_in                               as member_whatsapp_opt_in,
  m.archived_at is not null                       as member_archived,
  s.plan_id,
  pl.name                                         as plan_name,
  pl.duration_months                              as plan_duration_months,
  s.start_date,
  s.end_date,
  s.state,
  s.frozen_from,
  s.amount_due_cents,
  s.discount_cents,
  coalesce(p.paid_cents, 0)                       as paid_cents,
  s.amount_due_cents - coalesce(p.paid_cents, 0)  as balance_cents,
  case
    when s.state = 'cancelled' then 'cancelled'
    when s.state = 'frozen'    then 'frozen'
    when s.end_date   < public.local_today() then 'expired'
    when s.start_date > public.local_today() then 'upcoming'
    else 'active'
  end                                             as status,
  s.end_date - public.local_today()               as days_left,
  s.created_at
from public.subscriptions s
join public.members m  on m.id  = s.member_id
join public.plans   pl on pl.id = s.plan_id
left join lateral (
  select sum(amount_cents)::integer as paid_cents
  from public.payments
  where subscription_id = s.id and voided_at is null
) p on true;

-- Solde de points : remis à 0 après `expiry_months` sans aucun mouvement.
create or replace view public.member_points
with (security_invoker = true) as
select
  l.member_id,
  l.organization_id,
  case
    when max(l.created_at) < now() - make_interval(months => coalesce(ls.expiry_months, 12)) then 0
    else sum(l.points)::integer
  end                 as balance,
  max(l.created_at)   as last_activity
from public.loyalty_ledger l
left join public.loyalty_settings ls on ls.organization_id = l.organization_id
group by l.member_id, l.organization_id, ls.expiry_months;

-- Un membre + son abonnement de référence (le plus récent non annulé) + soldes.
create or replace view public.member_overview
with (security_invoker = true) as
select
  m.id,
  m.organization_id,
  m.full_name,
  m.phone,
  m.email,
  m.notes,
  m.whatsapp_opt_in,
  m.photo_path,
  m.referred_by,
  m.archived_at,
  m.created_at,
  (m.created_at at time zone 'Africa/Casablanca')::date as created_on,
  latest.id            as subscription_id,
  latest.plan_name,
  latest.start_date,
  latest.end_date,
  latest.status        as subscription_status,
  latest.days_left,
  coalesce(unpaid.balance_cents, 0)     as balance_cents,
  coalesce(pts.balance, 0)              as points,
  last_visit.created_at                 as last_visit_at
from public.members m
left join lateral (
  select so.* from public.subscription_overview so
  where so.member_id = m.id and so.state <> 'cancelled'
  order by so.start_date desc, so.created_at desc
  limit 1
) latest on true
left join lateral (
  select sum(so.balance_cents)::integer as balance_cents
  from public.subscription_overview so
  where so.member_id = m.id and so.state <> 'cancelled' and so.balance_cents > 0
) unpaid on true
left join public.member_points pts on pts.member_id = m.id
left join lateral (
  select a.created_at from public.attendance_logs a
  where a.member_id = m.id and a.result = 'accepted'
  order by a.created_at desc limit 1
) last_visit on true;

create or replace view public.payment_overview
with (security_invoker = true) as
select
  p.id,
  p.organization_id,
  p.subscription_id,
  p.member_id,
  m.full_name                                        as member_name,
  pl.name                                            as plan_name,
  p.amount_cents,
  p.method,
  p.paid_at,
  (p.paid_at at time zone 'Africa/Casablanca')       as paid_local,
  (p.paid_at at time zone 'Africa/Casablanca')::date as paid_on,
  p.reference,
  p.note,
  p.received_by,
  pr.full_name                                       as received_by_name,
  p.voided_at,
  p.void_reason
from public.payments p
join public.members m        on m.id = p.member_id
join public.subscriptions s  on s.id = p.subscription_id
join public.plans pl         on pl.id = s.plan_id
left join public.profiles pr on pr.id = p.received_by;

create or replace view public.attendance_overview
with (security_invoker = true) as
select
  a.id,
  a.organization_id,
  a.member_id,
  m.full_name                                        as member_name,
  a.result,
  a.reason,
  a.method,
  a.created_at,
  (a.created_at at time zone 'Africa/Casablanca')    as created_local,
  (a.created_at at time zone 'Africa/Casablanca')::date as created_on,
  pr.full_name                                       as scanned_by_name
from public.attendance_logs a
join public.members m        on m.id = a.member_id
left join public.profiles pr on pr.id = a.scanned_by;

create or replace view public.staff_overview
with (security_invoker = true) as
select om.organization_id, om.user_id, om.role, om.created_at, p.full_name, p.email
from public.organization_members om
join public.profiles p on p.id = om.user_id;

-- Totaux mensuels (évitent de charger toutes les lignes ; Supabase limite les réponses à 1000 lignes)
create or replace view public.revenue_by_month
with (security_invoker = true) as
select organization_id,
       to_char((paid_at at time zone 'Africa/Casablanca')::date, 'YYYY-MM') as month,
       method,
       sum(amount_cents)::integer as total_cents,
       count(*)::integer          as payment_count
from public.payments
where voided_at is null
group by 1, 2, 3;

create or replace view public.expenses_by_month
with (security_invoker = true) as
select organization_id,
       to_char(spent_on, 'YYYY-MM') as month,
       category,
       method,
       sum(amount_cents)::integer as total_cents
from public.expenses
group by 1, 2, 3, 4;

-- =====================================================================
-- Fidélité : fonctions internes
-- =====================================================================
create or replace function public.points_balance(p_member uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select balance from public.member_points where member_id = p_member), 0);
$$;

-- Ajoute (ou retire) des points. Expire d'abord le solde si le membre est inactif depuis trop longtemps.
create or replace function public.award_points(
  p_org uuid, p_member uuid, p_kind public.loyalty_kind, p_points integer, p_note text default '',
  p_subscription uuid default null, p_attendance bigint default null, p_redemption uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_expiry   integer;
  v_last     timestamptz;
  v_raw      integer;
begin
  if p_points = 0 then return; end if;
  select coalesce(expiry_months, 12) into v_expiry from public.loyalty_settings where organization_id = p_org;
  select max(created_at), coalesce(sum(points), 0) into v_last, v_raw
  from public.loyalty_ledger where member_id = p_member;
  if v_last is not null and v_raw > 0 and v_last < now() - make_interval(months => coalesce(v_expiry, 12)) then
    insert into public.loyalty_ledger (organization_id, member_id, kind, points, note)
    values (p_org, p_member, 'expiration', -v_raw, 'Points expirés après inactivité');
  end if;
  insert into public.loyalty_ledger (organization_id, member_id, kind, points, note,
                                     subscription_id, attendance_id, redemption_id, created_by)
  values (p_org, p_member, p_kind, p_points, coalesce(p_note, ''),
          p_subscription, p_attendance, p_redemption, (select auth.uid()));
end;
$$;

-- =====================================================================
-- RPC : salle et équipe
-- =====================================================================

-- Onboarding : crée la salle, rattache l'utilisateur comme propriétaire, et crée les
-- réglages par défaut (modèles de relance, fidélité). Aucune donnée de test.
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'Non connecté'; end if;
  insert into public.organizations (name) values (trim(p_name)) returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, (select auth.uid()), 'owner');
  insert into public.loyalty_settings (organization_id) values (v_org);
  insert into public.reminder_templates (organization_id, kind, offset_days, template) values
    (v_org, 'expiry', -7, 'Bonjour {{prenom}}, votre abonnement chez {{salle}} se termine le {{date_fin}}. Pensez à le renouveler à l''accueil pour continuer vos séances. À bientôt !'),
    (v_org, 'expiry',  3, 'Bonjour {{prenom}}, votre abonnement chez {{salle}} a pris fin le {{date_fin}}. On vous attend pour le renouveler et reprendre l''entraînement !'),
    (v_org, 'unpaid',  3, 'Bonjour {{prenom}}, il reste {{reste}} à régler sur votre abonnement chez {{salle}}. Vous pouvez régler à l''accueil (espèces, carte ou virement). Merci !');
  return v_org;
end;
$$;

-- Invite un membre de l'équipe. Gérant : réceptionnistes ; propriétaire : gérants aussi.
-- Si le compte existe déjà, il est rattaché tout de suite ; sinon à son inscription.
create or replace function public.invite_staff(p_org uuid, p_email text, p_role public.staff_role)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_user  uuid;
begin
  if p_role = 'owner' then raise exception 'Il ne peut y avoir qu''un propriétaire'; end if;
  perform public.require_role(p_org, case when p_role = 'manager' then 'owner' else 'admin' end);
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email invalide'; end if;

  select id into v_user from public.profiles where email = v_email;
  if v_user is not null then
    if exists (select 1 from public.organization_members where organization_id = p_org and user_id = v_user) then
      raise exception 'Cette personne fait déjà partie de l''équipe';
    end if;
    insert into public.organization_members (organization_id, user_id, role) values (p_org, v_user, p_role);
    return 'added';
  end if;

  insert into public.staff_invitations (organization_id, email, role, invited_by)
  values (p_org, v_email, p_role, (select auth.uid()))
  on conflict (organization_id, email) do update set role = excluded.role, invited_by = excluded.invited_by;
  return 'invited';
end;
$$;

create or replace function public.remove_staff(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_target public.staff_role;
begin
  select role into v_target from public.organization_members where organization_id = p_org and user_id = p_user;
  if v_target is null then raise exception 'Membre de l''équipe introuvable'; end if;
  if v_target = 'owner' then raise exception 'Le propriétaire ne peut pas être retiré'; end if;
  perform public.require_role(p_org, case when v_target = 'manager' then 'owner' else 'admin' end);
  delete from public.organization_members where organization_id = p_org and user_id = p_user;
end;
$$;

create or replace function public.change_staff_role(p_org uuid, p_user uuid, p_role public.staff_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_role(p_org, 'owner');
  if p_role = 'owner' then raise exception 'Le transfert de propriété n''est pas disponible'; end if;
  if p_user = (select auth.uid()) then raise exception 'Vous ne pouvez pas changer votre propre rôle'; end if;
  update public.organization_members set role = p_role where organization_id = p_org and user_id = p_user;
  if not found then raise exception 'Membre de l''équipe introuvable'; end if;
end;
$$;

-- =====================================================================
-- RPC : abonnements, paiements, factures
-- =====================================================================
create or replace function public.create_subscription(
  p_member uuid, p_plan uuid, p_start date,
  p_discount_cents integer default 0, p_first_payment_cents integer default 0,
  p_method public.payment_method default 'cash', p_reference text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_member   public.members;
  v_plan     public.plans;
  v_org      public.organizations;
  v_settings public.loyalty_settings;
  v_role     public.staff_role;
  v_due      integer;
  v_max      integer;
  v_sub      uuid;
  v_previous integer;
  v_renewal  boolean;
begin
  select * into v_member from public.members where id = p_member;
  if not found then raise exception 'Membre introuvable'; end if;
  v_role := public.require_role(v_member.organization_id, 'staff');
  if v_member.archived_at is not null then raise exception 'Ce membre est archivé'; end if;

  select * into v_plan from public.plans
  where id = p_plan and organization_id = v_member.organization_id and is_active;
  if not found then raise exception 'Formule introuvable ou inactive'; end if;
  select * into v_org from public.organizations where id = v_member.organization_id;

  p_discount_cents      := coalesce(p_discount_cents, 0);
  p_first_payment_cents := coalesce(p_first_payment_cents, 0);
  if p_start is null then raise exception 'Date de début requise'; end if;
  if p_discount_cents < 0 or p_discount_cents > v_plan.price_cents then
    raise exception 'Remise invalide';
  end if;
  if v_role = 'receptionist' then
    v_max := floor(v_plan.price_cents * v_org.max_reception_discount_pct / 100);
    if p_discount_cents > v_max then
      raise exception 'Remise trop élevée : la réception peut accorder au maximum % %%',
        rtrim(rtrim(v_org.max_reception_discount_pct::text, '0'), '.');
    end if;
  end if;
  v_due := v_plan.price_cents - p_discount_cents;
  if p_first_payment_cents < 0 or p_first_payment_cents > v_due then
    raise exception 'Le premier paiement dépasse le montant dû';
  end if;

  -- Contexte fidélité, avant l'insertion
  select count(*) into v_previous from public.subscriptions
  where member_id = p_member and state <> 'cancelled';
  v_renewal := exists (
    select 1 from public.subscriptions
    where member_id = p_member and state = 'active'
      and end_date >= public.local_today() and start_date <= public.local_today());

  insert into public.subscriptions (organization_id, member_id, plan_id, start_date, end_date,
                                    amount_due_cents, discount_cents, created_by)
  values (v_member.organization_id, p_member, p_plan, p_start,
          (p_start + make_interval(months => v_plan.duration_months) - interval '1 day')::date,
          v_due, p_discount_cents, (select auth.uid()))
  returning id into v_sub;

  if p_first_payment_cents > 0 then
    insert into public.payments (organization_id, subscription_id, member_id, amount_cents, method,
                                 reference, received_by)
    values (v_member.organization_id, v_sub, p_member, p_first_payment_cents, p_method,
            coalesce(p_reference, ''), (select auth.uid()));
  end if;

  -- Points de fidélité
  select * into v_settings from public.loyalty_settings where organization_id = v_member.organization_id;
  if found and v_settings.enabled then
    if v_previous = 0 then
      perform public.award_points(v_member.organization_id, p_member, 'welcome', v_settings.welcome_points,
                                  'Bienvenue', v_sub);
      if v_member.referred_by is not null then
        perform public.award_points(v_member.organization_id, v_member.referred_by, 'referral',
                                    v_settings.referral_points, 'Parrainage : ' || v_member.full_name, v_sub);
      end if;
    end if;
    perform public.award_points(v_member.organization_id, p_member, 'subscription',
                                v_settings.points_per_month * v_plan.duration_months,
                                'Abonnement ' || v_plan.name, v_sub);
    if v_renewal then
      perform public.award_points(v_member.organization_id, p_member, 'renewal', v_settings.renewal_bonus,
                                  'Renouvelé avant la fin', v_sub);
    end if;
  end if;

  return v_sub;
end;
$$;

-- Correction d'un abonnement (montant, dates) : gérant uniquement.
create or replace function public.update_subscription(p_sub uuid, p_start date, p_end date, p_amount_due_cents integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.subscriptions;
  v_paid integer;
begin
  select * into v_sub from public.subscriptions where id = p_sub;
  if not found then raise exception 'Abonnement introuvable'; end if;
  perform public.require_role(v_sub.organization_id, 'admin');
  if p_end < p_start then raise exception 'La date de fin est avant la date de début'; end if;
  select coalesce(sum(amount_cents), 0) into v_paid from public.payments where subscription_id = p_sub and voided_at is null;
  if p_amount_due_cents < v_paid then raise exception 'Le montant dû ne peut pas être inférieur au montant déjà payé'; end if;
  update public.subscriptions
  set start_date = p_start, end_date = p_end, amount_due_cents = p_amount_due_cents
  where id = p_sub;
end;
$$;

-- p_action : 'freeze' | 'unfreeze' (réception) | 'cancel' (gérant). Le dégel prolonge la fin.
create or replace function public.set_subscription_state(p_sub uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.subscriptions;
  v_today date := public.local_today();
begin
  select * into v_sub from public.subscriptions where id = p_sub;
  if not found then raise exception 'Abonnement introuvable'; end if;

  if p_action = 'freeze' then
    perform public.require_role(v_sub.organization_id, 'staff');
    if v_sub.state <> 'active' then raise exception 'Seul un abonnement actif peut être gelé'; end if;
    update public.subscriptions set state = 'frozen', frozen_from = v_today where id = p_sub;
  elsif p_action = 'unfreeze' then
    perform public.require_role(v_sub.organization_id, 'staff');
    if v_sub.state <> 'frozen' then raise exception 'Cet abonnement n''est pas gelé'; end if;
    update public.subscriptions
    set state = 'active',
        end_date = end_date + greatest(0, v_today - coalesce(frozen_from, v_today)),
        frozen_from = null
    where id = p_sub;
  elsif p_action = 'cancel' then
    perform public.require_role(v_sub.organization_id, 'admin');
    if v_sub.state = 'cancelled' then raise exception 'Déjà annulé'; end if;
    update public.subscriptions set state = 'cancelled' where id = p_sub;
  else
    raise exception 'Action inconnue';
  end if;
end;
$$;

create or replace function public.record_payment(
  p_sub uuid, p_amount_cents integer, p_method public.payment_method,
  p_reference text default '', p_note text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_sub     public.subscriptions;
  v_balance integer;
  v_id      uuid;
begin
  select * into v_sub from public.subscriptions where id = p_sub;
  if not found then raise exception 'Abonnement introuvable'; end if;
  perform public.require_role(v_sub.organization_id, 'staff');
  if v_sub.state = 'cancelled' then raise exception 'Cet abonnement est annulé'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Montant invalide'; end if;

  -- Verrou : deux encaissements simultanés ne peuvent pas dépasser le reste à payer
  perform 1 from public.subscriptions where id = p_sub for update;
  select v_sub.amount_due_cents - coalesce(sum(amount_cents), 0) into v_balance
  from public.payments where subscription_id = p_sub and voided_at is null;
  if p_amount_cents > v_balance then
    raise exception 'Le montant dépasse le reste à payer (% MAD)', to_char(v_balance / 100.0, 'FM999999990.00');
  end if;

  insert into public.payments (organization_id, subscription_id, member_id, amount_cents, method,
                               reference, note, received_by)
  values (v_sub.organization_id, p_sub, v_sub.member_id, p_amount_cents, p_method,
          coalesce(p_reference, ''), coalesce(p_note, ''), (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.void_payment(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
begin
  select * into v_pay from public.payments where id = p_payment;
  if not found then raise exception 'Paiement introuvable'; end if;
  perform public.require_role(v_pay.organization_id, 'admin');
  if v_pay.voided_at is not null then raise exception 'Paiement déjà annulé'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Indiquez un motif'; end if;
  update public.payments
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = trim(p_reason)
  where id = p_payment;
end;
$$;

create or replace function public.create_invoice(p_sub uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.subscriptions;
  v_vat numeric;
  v_id  uuid;
begin
  select * into v_sub from public.subscriptions where id = p_sub;
  if not found then raise exception 'Abonnement introuvable'; end if;
  perform public.require_role(v_sub.organization_id, 'staff');
  if v_sub.state = 'cancelled' then raise exception 'Abonnement annulé'; end if;
  if exists (select 1 from public.invoices where subscription_id = p_sub) then
    raise exception 'Cet abonnement a déjà une facture';
  end if;
  select vat_rate into v_vat from public.organizations where id = v_sub.organization_id;
  insert into public.invoices (organization_id, member_id, subscription_id, number, total_cents, vat_rate, created_by)
  values (v_sub.organization_id, v_sub.member_id, p_sub, 0, v_sub.amount_due_cents, v_vat, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- =====================================================================
-- RPC : entrées (check-in) et carte
-- =====================================================================

-- Résultat commun : informations affichées sur la tablette après un scan.
create or replace function public.checkin_payload(p_member uuid, p_result public.checkin_result, p_reason text, p_points integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'result', p_result,
    'reason', p_reason,
    'points_earned', p_points,
    'member', jsonb_build_object(
      'id', mo.id, 'full_name', mo.full_name, 'phone', mo.phone, 'photo_path', mo.photo_path,
      'plan_name', mo.plan_name, 'end_date', mo.end_date, 'status', mo.subscription_status,
      'days_left', mo.days_left, 'balance_cents', mo.balance_cents, 'points', public.points_balance(mo.id)))
  from public.member_overview mo where mo.id = p_member;
$$;

create or replace function public.do_checkin(p_member uuid, p_method public.checkin_method, p_manual_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_member   public.members;
  v_org      public.organizations;
  v_settings public.loyalty_settings;
  v_status   text;
  v_last     timestamptz;
  v_result   public.checkin_result := 'accepted';
  v_reason   text := '';
  v_log      bigint;
  v_points   integer := 0;
begin
  select * into v_member from public.members where id = p_member;
  select * into v_org from public.organizations where id = v_member.organization_id;

  select status into v_status from public.subscription_overview
  where member_id = p_member and status in ('active', 'frozen')
  order by (status = 'active') desc, end_date desc limit 1;

  select max(created_at) into v_last from public.attendance_logs
  where member_id = p_member and result = 'accepted';

  if v_member.archived_at is not null then
    v_result := 'refused'; v_reason := 'Membre archivé';
  elsif v_status is null then
    v_result := 'refused'; v_reason := 'Aucun abonnement en cours';
  elsif v_status = 'frozen' then
    v_result := 'refused'; v_reason := 'Abonnement gelé';
  elsif v_org.anti_passback_minutes > 0 and v_last is not null
        and v_last > now() - make_interval(mins => v_org.anti_passback_minutes) then
    v_result := 'refused';
    v_reason := 'Déjà entré il y a ' || greatest(1, floor(extract(epoch from now() - v_last) / 60))::int || ' min';
  end if;

  if p_method = 'manual' and v_result = 'accepted' then
    v_reason := 'Entrée manuelle : ' || coalesce(nullif(trim(p_manual_reason), ''), 'sans motif');
  end if;

  insert into public.attendance_logs (organization_id, member_id, result, reason, method, scanned_by)
  values (v_member.organization_id, p_member, v_result, v_reason, p_method, (select auth.uid()))
  returning id into v_log;

  -- Points de visite : une seule fois par jour
  if v_result = 'accepted' then
    select * into v_settings from public.loyalty_settings where organization_id = v_member.organization_id;
    if found and v_settings.enabled and v_settings.points_per_visit > 0 and not exists (
      select 1 from public.loyalty_ledger
      where member_id = p_member and kind = 'visit'
        and (created_at at time zone 'Africa/Casablanca')::date = public.local_today()) then
      v_points := v_settings.points_per_visit;
      perform public.award_points(v_member.organization_id, p_member, 'visit', v_points, 'Visite', null, v_log);
    end if;
  end if;

  return public.checkin_payload(p_member, v_result, v_reason, v_points);
end;
$$;

-- Scan du QR à la réception.
create or replace function public.check_in(p_org uuid, p_qr_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
begin
  perform public.require_role(p_org, 'staff');
  select member_id into v_member from public.member_cards
  where organization_id = p_org and qr_token = trim(p_qr_token);
  if v_member is null then
    return jsonb_build_object('result', 'refused', 'reason', 'QR inconnu ou désactivé', 'points_earned', 0, 'member', null);
  end if;
  return public.do_checkin(v_member, 'qr', null);
end;
$$;

-- Entrée manuelle (téléphone oublié) : enregistrée avec un motif.
create or replace function public.manual_check_in(p_member uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.members where id = p_member;
  if v_org is null then raise exception 'Membre introuvable'; end if;
  perform public.require_role(v_org, 'staff');
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Indiquez un motif'; end if;
  return public.do_checkin(p_member, 'manual', p_reason);
end;
$$;

-- Nouveau QR + nouveau lien (téléphone perdu, abus) : gérant uniquement.
create or replace function public.regenerate_card(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.member_cards where member_id = p_member;
  if v_org is null then raise exception 'Carte introuvable'; end if;
  perform public.require_role(v_org, 'admin');
  update public.member_cards
  set qr_token = 'NB' || public.random_token(), link_token = public.random_token(), regenerated_at = now()
  where member_id = p_member;
end;
$$;

-- Carte publique (sans connexion), via le lien personnel envoyé au membre.
create or replace function public.get_public_card(p_link_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'gym_name', o.name,
    'gym_phone', o.phone,
    'member_name', m.full_name,
    'qr_token', c.qr_token,
    'plan_name', so.plan_name,
    'end_date', so.end_date,
    'status', so.status,
    'points', public.points_balance(m.id),
    'loyalty_enabled', coalesce(ls.enabled, false),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'description', r.description, 'points_cost', r.points_cost)
                       order by r.points_cost)
      from public.rewards r where r.organization_id = o.id and r.is_active), '[]'::jsonb))
  from public.member_cards c
  join public.members m        on m.id = c.member_id
  join public.organizations o  on o.id = c.organization_id
  left join public.loyalty_settings ls on ls.organization_id = o.id
  left join lateral (
    select s.plan_name, s.end_date, s.status from public.subscription_overview s
    where s.member_id = m.id and s.state <> 'cancelled'
    order by s.start_date desc limit 1
  ) so on true
  where c.link_token = p_link_token and m.archived_at is null
    and length(p_link_token) = 32;
$$;

-- =====================================================================
-- RPC : fidélité
-- =====================================================================
create or replace function public.redeem_reward(p_member uuid, p_reward uuid, p_note text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_member  public.members;
  v_reward  public.rewards;
  v_balance integer;
  v_id      uuid;
begin
  select * into v_member from public.members where id = p_member;
  if not found then raise exception 'Membre introuvable'; end if;
  perform public.require_role(v_member.organization_id, 'staff');
  select * into v_reward from public.rewards
  where id = p_reward and organization_id = v_member.organization_id and is_active;
  if not found then raise exception 'Récompense introuvable ou inactive'; end if;

  perform 1 from public.members where id = p_member for update;   -- évite deux échanges simultanés
  v_balance := public.points_balance(p_member);
  if v_balance < v_reward.points_cost then
    raise exception 'Points insuffisants : % / %', v_balance, v_reward.points_cost;
  end if;

  insert into public.redemptions (organization_id, member_id, reward_id, reward_name, points_cost, note, given_by)
  values (v_member.organization_id, p_member, p_reward, v_reward.name, v_reward.points_cost,
          coalesce(p_note, ''), (select auth.uid()))
  returning id into v_id;
  perform public.award_points(v_member.organization_id, p_member, 'redemption', -v_reward.points_cost,
                              v_reward.name, null, null, v_id);
  return v_id;
end;
$$;

-- Ajustement manuel (+ ou -) : gérant uniquement, motif obligatoire, tracé dans l'audit.
create or replace function public.adjust_points(p_member uuid, p_points integer, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.members where id = p_member;
  if v_org is null then raise exception 'Membre introuvable'; end if;
  perform public.require_role(v_org, 'admin');
  if coalesce(p_points, 0) = 0 then raise exception 'Nombre de points invalide'; end if;
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Indiquez un motif'; end if;
  if public.points_balance(p_member) + p_points < 0 then raise exception 'Le solde ne peut pas devenir négatif'; end if;
  perform public.award_points(v_org, p_member, 'adjustment', p_points, trim(p_note));
end;
$$;

-- =====================================================================
-- RPC : caisse
-- =====================================================================
create or replace function public.cash_expected(p_org uuid, p_day date)
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_role(p_org, 'staff');
  return coalesce((
    select sum(amount_cents) from public.payments
    where organization_id = p_org and method = 'cash' and voided_at is null
      and (paid_at at time zone 'Africa/Casablanca')::date = p_day), 0)
   - coalesce((
    select sum(amount_cents) from public.expenses
    where organization_id = p_org and method = 'cash' and spent_on = p_day), 0);
end;
$$;

-- La réception déclare le montant compté. Tant que ce n'est pas validé, elle peut corriger.
create or replace function public.close_cash(p_org uuid, p_day date, p_counted_cents integer, p_note text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_expected integer;
  v_row      public.cash_closings;
begin
  perform public.require_role(p_org, 'staff');
  if p_day > public.local_today() then raise exception 'Impossible de clôturer un jour futur'; end if;
  if p_counted_cents is null or p_counted_cents < 0 then raise exception 'Montant compté invalide'; end if;
  if exists (select 1 from public.cash_closings where organization_id = p_org and day = p_day and validated_at is not null) then
    raise exception 'Cette journée est déjà validée par le gérant';
  end if;
  v_expected := public.cash_expected(p_org, p_day);
  insert into public.cash_closings (organization_id, day, expected_cents, counted_cents, note, closed_by)
  values (p_org, p_day, v_expected, p_counted_cents, coalesce(p_note, ''), (select auth.uid()))
  on conflict (organization_id, day) do update
    set expected_cents = excluded.expected_cents, counted_cents = excluded.counted_cents,
        note = excluded.note, closed_by = excluded.closed_by, closed_at = now()
  returning * into v_row;
  return jsonb_build_object('expected_cents', v_row.expected_cents, 'counted_cents', v_row.counted_cents,
                            'difference_cents', v_row.difference_cents);
end;
$$;

create or replace function public.validate_cash_closing(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.cash_closings where id = p_id;
  if v_org is null then raise exception 'Clôture introuvable'; end if;
  perform public.require_role(v_org, 'admin');
  update public.cash_closings set validated_by = (select auth.uid()), validated_at = now()
  where id = p_id and validated_at is null;
end;
$$;

-- =====================================================================
-- RPC : relances
-- =====================================================================
create or replace function public.log_reminder(p_sub uuid, p_kind public.reminder_kind)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub from public.subscriptions where id = p_sub;
  if not found then raise exception 'Abonnement introuvable'; end if;
  perform public.require_role(v_sub.organization_id, 'staff');
  insert into public.reminder_logs (organization_id, member_id, subscription_id, kind, sent_by)
  values (v_sub.organization_id, v_sub.member_id, p_sub, p_kind, (select auth.uid()));
end;
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.organization_members enable row level security;
alter table public.staff_invitations    enable row level security;
alter table public.members              enable row level security;
alter table public.member_cards         enable row level security;
alter table public.plans                enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.payments             enable row level security;
alter table public.invoices             enable row level security;
alter table public.expenses             enable row level security;
alter table public.cash_closings        enable row level security;
alter table public.attendance_logs      enable row level security;
alter table public.loyalty_settings     enable row level security;
alter table public.loyalty_ledger       enable row level security;
alter table public.rewards              enable row level security;
alter table public.redemptions          enable row level security;
alter table public.reminder_templates   enable row level security;
alter table public.reminder_logs        enable row level security;
alter table public.audit_log            enable row level security;

-- Salle : visible par l'équipe ; infos légales et réglages modifiables par le propriétaire.
create policy org_select on public.organizations for select to authenticated using (public.is_org_member(id));
create policy org_update on public.organizations for update to authenticated
  using (public.is_org_owner(id)) with check (public.is_org_owner(id));

-- Profils : le sien et ceux des collègues.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or exists (
    select 1 from public.organization_members om
    where om.user_id = profiles.id and public.is_org_member(om.organization_id)));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Équipe : lecture par l'équipe ; écritures via invite_staff / remove_staff / change_staff_role.
create policy om_select on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id));

create policy invitations_select on public.staff_invitations for select to authenticated
  using (public.is_org_admin(organization_id));
create policy invitations_delete on public.staff_invitations for delete to authenticated
  using (public.is_org_admin(organization_id));

-- Membres : saisis par toute l'équipe ; suppression définitive par le propriétaire.
create policy members_select on public.members for select to authenticated using (public.is_org_member(organization_id));
create policy members_insert on public.members for insert to authenticated with check (public.is_org_member(organization_id));
create policy members_update on public.members for update to authenticated
  using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy members_delete on public.members for delete to authenticated using (public.is_org_owner(organization_id));

create policy cards_select on public.member_cards for select to authenticated using (public.is_org_member(organization_id));

-- Formules, modèles, récompenses : lecture par l'équipe, gestion par le gérant.
create policy plans_select on public.plans for select to authenticated using (public.is_org_member(organization_id));
create policy plans_write  on public.plans for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy templates_select on public.reminder_templates for select to authenticated using (public.is_org_member(organization_id));
create policy templates_write  on public.reminder_templates for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy rewards_select on public.rewards for select to authenticated using (public.is_org_member(organization_id));
create policy rewards_insert on public.rewards for insert to authenticated with check (public.is_org_admin(organization_id));
create policy rewards_update on public.rewards for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy loyalty_settings_select on public.loyalty_settings for select to authenticated using (public.is_org_member(organization_id));
create policy loyalty_settings_update on public.loyalty_settings for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

-- Abonnements, paiements, factures, entrées, points, échanges, relances, clôtures :
-- lecture par l'équipe, écritures uniquement via les fonctions ci-dessus.
create policy subscriptions_select on public.subscriptions   for select to authenticated using (public.is_org_member(organization_id));
create policy payments_select      on public.payments        for select to authenticated using (public.is_org_member(organization_id));
create policy invoices_select      on public.invoices        for select to authenticated using (public.is_org_member(organization_id));
create policy attendance_select    on public.attendance_logs for select to authenticated using (public.is_org_member(organization_id));
create policy ledger_select        on public.loyalty_ledger  for select to authenticated using (public.is_org_member(organization_id));
create policy redemptions_select   on public.redemptions     for select to authenticated using (public.is_org_member(organization_id));
create policy reminder_logs_select on public.reminder_logs   for select to authenticated using (public.is_org_member(organization_id));
create policy cash_select          on public.cash_closings   for select to authenticated using (public.is_org_member(organization_id));

-- Charges et audit : gérant / propriétaire.
create policy expenses_all on public.expenses for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy audit_select on public.audit_log for select to authenticated using (public.is_org_admin(organization_id));

-- =====================================================================
-- Droits d'exécution des fonctions
-- =====================================================================
-- Fonctions internes : jamais appelables depuis l'API.
revoke execute on function public.handle_new_user()                 from public, anon, authenticated;
revoke execute on function public.create_member_card()              from public, anon, authenticated;
revoke execute on function public.assign_invoice_number()           from public, anon, authenticated;
revoke execute on function public.log_audit()                       from public, anon, authenticated;
revoke execute on function public.award_points(uuid, uuid, public.loyalty_kind, integer, text, uuid, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.do_checkin(uuid, public.checkin_method, text) from public, anon, authenticated;
revoke execute on function public.checkin_payload(uuid, public.checkin_result, text, integer) from public, anon, authenticated;
revoke execute on function public.points_balance(uuid)             from public, anon, authenticated;

-- RPC du staff : réservées aux utilisateurs connectés (le rôle est vérifié à l'intérieur).
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_organization(text)',
    'public.invite_staff(uuid, text, public.staff_role)',
    'public.remove_staff(uuid, uuid)',
    'public.change_staff_role(uuid, uuid, public.staff_role)',
    'public.create_subscription(uuid, uuid, date, integer, integer, public.payment_method, text)',
    'public.update_subscription(uuid, date, date, integer)',
    'public.set_subscription_state(uuid, text)',
    'public.record_payment(uuid, integer, public.payment_method, text, text)',
    'public.void_payment(uuid, text)',
    'public.create_invoice(uuid)',
    'public.check_in(uuid, text)',
    'public.manual_check_in(uuid, text)',
    'public.regenerate_card(uuid)',
    'public.redeem_reward(uuid, uuid, text)',
    'public.adjust_points(uuid, integer, text)',
    'public.cash_expected(uuid, date)',
    'public.close_cash(uuid, date, integer, text)',
    'public.validate_cash_closing(uuid)',
    'public.log_reminder(uuid, public.reminder_kind)',
    'public.require_role(uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Carte publique : seule fonction ouverte aux visiteurs non connectés.
grant execute on function public.get_public_card(text) to anon, authenticated;
