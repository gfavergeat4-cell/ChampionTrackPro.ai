-- Le coach (ou admin) de l'équipe peut brancher/changer le calendrier ICS
-- depuis l'app — sans passer par le fondateur. Produit, pas service.
create or replace function set_team_ics(p_team uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role_in(p_team) not in ('coach','admin') then
    raise exception 'not allowed';
  end if;
  if p_url is not null and p_url !~ '^https?://' then
    raise exception 'invalid url';
  end if;
  update teams set ics_url = nullif(trim(p_url), '') where id = p_team;
end $$;
