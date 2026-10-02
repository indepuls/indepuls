-- ============================================================
-- EN ATTENTE, NE PAS EXÉCUTER TANT QUE L'ÉCRITURE PAR LES MEMBRES N'EST PAS TRANCHÉE.
-- Si les membres doivent pouvoir MODIFIER le compte partagé (besoin de Florence : missions et
-- frais communs), ce script casserait cette possibilité, la règle "user_data_membre_actif" en
-- "for all" étant justement ce qui l'autoriserait. À n'utiliser que si l'on reste en lecture seule.
-- ============================================================
-- Indépuls, Multi-associés : lecture seule imposée côté base
-- À exécuter dans l'éditeur SQL du dashboard Supabase, après relecture.
-- À lancer APRÈS multi_associes.sql.
--
-- Pourquoi : multi_associes.sql avait créé la règle "user_data_membre_actif" avec "for all", donc
-- un membre actif pouvait LIRE ET ÉCRIRE la ligne de données du propriétaire, alors que
-- l'application n'a besoin que de la lire (consultation en lecture seule). L'appli ne s'en
-- servait pas, mais la base le permettait : un appel direct à l'API avec la session du membre
-- aurait pu modifier ou effacer les données du propriétaire.
--
-- Ce que fait ce script : remplace cette règle par une règle de LECTURE uniquement. Le droit
-- d'écriture du membre disparaît, rien d'autre ne change. Les règles existantes du propriétaire
-- (select_own, insert_own, update_own, delete_own) ne sont pas touchées.
-- ============================================================

drop policy if exists "user_data_membre_actif" on public.user_data;

create policy "user_data_membre_actif_lecture" on public.user_data
  for select
  using (
    exists (
      select 1 from public.comptes_membres cm
      where cm.compte_owner_id = user_data.user_id
        and cm.membre_id = auth.uid()
        and cm.statut = 'actif'
    )
  );
