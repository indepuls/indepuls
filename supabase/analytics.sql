-- ============================================================
-- Indépuls — Analytics produit
-- À exécuter dans l'éditeur SQL du dashboard Supabase
-- ============================================================

-- ── TABLE PROFILES ──────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  created_at      timestamptz default now(),
  last_login_at   timestamptz,

  -- Module utilisé + métier sélectionné dans les paramètres
  activity_type   text,   -- 'freelance' | 'artisan' | 'Coach' | 'Photographe' | …

  -- Statut juridique issu de DATA.params.statut
  legal_status    text,   -- 'micro-bic' | 'micro-prestation' | 'ei' | 'sasu' | 'autre'

  -- Thème actif
  theme           text,   -- 'obm' | 'atlantique' | 'sepia' | 'dark'

  -- Abonnement
  trial_start     timestamptz,
  trial_end       timestamptz,
  plan            text default 'free'  -- 'free' | 'trial' | 'premium'
);

alter table public.profiles enable row level security;

create policy "profiles: accès à son propre profil"
  on public.profiles for all
  using (auth.uid() = id);

-- ── TABLE USAGE_EVENTS ──────────────────────────────────────
create table if not exists public.usage_events (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  event_name   text not null,
  event_data   jsonb,
  created_at   timestamptz default now()
);

alter table public.usage_events enable row level security;

-- Les utilisateurs ne peuvent qu'insérer leurs propres événements
create policy "usage_events: insert ses propres événements"
  on public.usage_events for insert
  with check (auth.uid() = user_id);

-- Lecture réservée au service_role (tableau de bord admin futur)
-- Pour requêtes analytics, utiliser la clé service_role côté serveur.

-- Index pour performance des requêtes analytics
create index if not exists idx_usage_events_user_id    on public.usage_events(user_id);
create index if not exists idx_usage_events_event_name on public.usage_events(event_name);
create index if not exists idx_usage_events_created_at on public.usage_events(created_at desc);

-- ── REQUÊTES ANALYTICS DE RÉFÉRENCE ─────────────────────────
-- (À copier dans le futur tableau de bord admin)

-- Nombre d'inscriptions par semaine
-- select date_trunc('week', created_at) as semaine, count(*) from profiles group by 1 order by 1 desc;

-- Répartition des thèmes
-- select theme, count(*) from profiles where theme is not null group by 1 order by 2 desc;

-- Répartition des modules
-- select activity_type, count(*) from profiles group by 1 order by 2 desc;

-- Répartition des statuts juridiques
-- select legal_status, count(*) from profiles group by 1 order by 2 desc;

-- Fonctionnalités les plus utilisées (30 derniers jours)
-- select event_name, count(*) from usage_events
-- where created_at > now() - interval '30 days'
-- group by 1 order by 2 desc;

-- Utilisateurs actifs (connectés au moins 1 fois dans les 30 jours)
-- select count(distinct user_id) from usage_events
-- where event_name = 'login' and created_at > now() - interval '30 days';

-- Taux de conversion essai → abonnement
-- select
--   count(*) filter (where event_name = 'trial_started') as trials,
--   count(*) filter (where event_name = 'subscription_started') as conversions
-- from usage_events;
