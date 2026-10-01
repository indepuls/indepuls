-- ============================================================
-- Indépuls, Multi-associés, palier A (invitation)
-- À exécuter dans l'éditeur SQL du dashboard Supabase, après relecture.
--
-- Contexte : voir CLAUDE.md (entrée 2026-10-01) et project_indepuls_multi_associes.
-- Ce script est STRICTEMENT additif : il crée une nouvelle table isolée et ajoute des
-- règles de sécurité supplémentaires sur user_data, sans jamais toucher ni supprimer les
-- règles existantes. Si une règle "propriétaire seul" existe déjà sur user_data (standard
-- Supabase, quasi certainement le cas ici), elle continue de s'appliquer exactement comme
-- avant pour tout le monde : ce script ne fait qu'ajouter un cas supplémentaire (membre actif).
--
-- Important : ce script ne câble PAS encore l'accès réel aux données partagées. Il permet
-- seulement d'inviter, d'accepter, et de révoquer un accès (la ligne comptes_membres). La
-- lecture/écriture effective de user_data par un membre (la 2e règle tout en bas) est donc
-- écrite mais n'a d'effet concret que le jour où l'application charge réellement les données
-- du compte propriétaire pour un membre actif, ce qui n'est pas encore fait côté app.
-- ============================================================

-- ── TABLE comptes_membres ────────────────────────────────────
create table if not exists public.comptes_membres (
  id               uuid primary key default gen_random_uuid(),
  compte_owner_id  uuid not null references auth.users(id) on delete cascade,
  membre_id        uuid references auth.users(id) on delete cascade, -- null tant que l'invitation n'est pas acceptée
  invited_email    text not null,
  token            uuid not null default gen_random_uuid(),
  statut           text not null default 'invite' check (statut in ('invite', 'actif', 'revoque')),
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  unique (compte_owner_id, invited_email)
);

alter table public.comptes_membres enable row level security;

-- Le propriétaire du compte peut créer, voir et gérer ses propres invitations.
create policy "comptes_membres_owner_all" on public.comptes_membres
  for all
  using (auth.uid() = compte_owner_id)
  with check (auth.uid() = compte_owner_id);

-- La personne invitée peut voir la ligne qui la concerne (pour l'accepter), identifiée
-- strictement par la correspondance d'email avec son compte authentifié, jamais par le simple
-- fait de connaître le token. C'est cette règle, combinée à la vérification applicative, qui
-- protège réellement contre un lien transféré à la mauvaise personne.
create policy "comptes_membres_invitee_select" on public.comptes_membres
  for select
  using (lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- La personne invitée peut accepter (passer son propre membre_id + statut actif), uniquement
-- sur une ligne où son email correspond et qui n'est pas déjà révoquée.
create policy "comptes_membres_invitee_accept" on public.comptes_membres
  for update
  using (lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')) and statut = 'invite')
  with check (membre_id = auth.uid() and statut = 'actif');

-- ── RÈGLE SUPPLÉMENTAIRE SUR user_data ───────────────────────
-- Additive uniquement : un membre actif peut désormais aussi lire/écrire la ligne de données
-- du compte qui l'a invité, en plus de la règle "propriétaire seul" déjà en place (non touchée
-- par ce script, continue de fonctionner à l'identique pour tout le monde).
create policy "user_data_membre_actif" on public.user_data
  for all
  using (
    exists (
      select 1 from public.comptes_membres cm
      where cm.compte_owner_id = user_data.user_id
        and cm.membre_id = auth.uid()
        and cm.statut = 'actif'
    )
  )
  with check (
    exists (
      select 1 from public.comptes_membres cm
      where cm.compte_owner_id = user_data.user_id
        and cm.membre_id = auth.uid()
        and cm.statut = 'actif'
    )
  );
