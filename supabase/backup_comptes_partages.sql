-- Sauvegardes automatiques : 200 versions pour un compte partagé, 20 pour les autres.
-- DÉJÀ EXÉCUTÉ dans le SQL Editor Supabase le 2026-10-03 (ce fichier en garde la trace).
-- Remplace uniquement la fonction appelée par le trigger trg_backup_user_data (inchangé).
-- Contexte : incident du 2026-10-02, une rafale d'écritures épuise 20 versions en quelques secondes.
CREATE OR REPLACE FUNCTION public.backup_user_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_garder int := 20;
begin
  insert into public.user_data_backups (user_id, app_type, data, backed_up_at)
  values (old.user_id, old.app_type, old.data, now());

  if exists (
    select 1 from public.comptes_membres
    where compte_owner_id = old.user_id and statut <> 'revoque'
  ) then
    v_garder := 200;
  end if;

  delete from public.user_data_backups
  where id in (
    select id from public.user_data_backups
    where user_id = old.user_id and app_type = old.app_type
    order by backed_up_at desc
    offset v_garder
  );

  return new;
end;
$function$;
