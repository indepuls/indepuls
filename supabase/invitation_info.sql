-- ============================================================
-- Indépuls, Multi-associés : vérification d'une invitation AVANT l'inscription
-- À exécuter dans l'éditeur SQL du dashboard Supabase, après relecture.
-- À lancer APRÈS multi_associes.sql (la table comptes_membres doit exister).
--
-- Pourquoi : la table comptes_membres n'est lisible que par une personne connectée. Or la
-- personne invitée n'a pas encore de compte quand elle ouvre le lien. Sans cette fonction,
-- l'écran d'inscription ne peut ni vérifier que le jeton existe, ni connaître l'email invité,
-- ni le prénom de la personne qui invite.
--
-- Ce que la fonction renvoie, et à qui : uniquement pour un jeton exact (un UUID secret, envoyé
-- par email à la personne invitée) : l'email invité, le statut de l'invitation et le prénom de
-- la personne qui invite. Rien d'autre, jamais de liste, jamais de recherche. Quelqu'un qui n'a
-- pas le jeton ne peut rien obtenir (un UUID ne se devine pas).
--
-- security definer : la fonction s'exécute avec les droits de son propriétaire pour pouvoir lire
-- comptes_membres et user_data malgré les règles de sécurité, sans ouvrir ces tables à personne.
-- Strictement additif : aucune table ni règle existante n'est modifiée.
-- ============================================================

create or replace function public.invitation_info(p_token uuid)
returns table (invited_email text, statut text, inviter_nom text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    cm.invited_email,
    cm.statut,
    (
      select (ud.data::jsonb) -> 'params' ->> 'nom'
      from public.user_data ud
      where ud.user_id = cm.compte_owner_id
        and ud.app_type = 'indepuls'
      limit 1
    ) as inviter_nom
  from public.comptes_membres cm
  where cm.token = p_token
  limit 1;
$$;

-- Par défaut Postgres autorise tout le monde à exécuter une nouvelle fonction : on retire ce
-- droit puis on le redonne explicitement, aux visiteurs non connectés (anon) et connectés.
revoke all on function public.invitation_info(uuid) from public;
grant execute on function public.invitation_info(uuid) to anon, authenticated;
