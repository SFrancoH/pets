-- PETS: trazabilidad de modificaciones sin impedir que el dato se sobrescriba.
-- Ejecutar después de 001-007. La bitácora guarda la versión anterior y la nueva.
begin;

alter table public.consultas_controles
  add column if not exists ultima_edicion_por uuid references public.usuarios(id) on delete set null;

create table if not exists public.auditoria_ediciones_pets (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  entidad text not null check (entidad in ('consultas_controles','mascotas','propietarios')),
  registro_id uuid not null,
  modificado_por uuid references public.usuarios(id) on delete set null,
  anterior jsonb not null,
  nuevo jsonb not null,
  fecha_edicion timestamptz not null default now()
);
create index if not exists auditoria_ediciones_busqueda_idx
  on public.auditoria_ediciones_pets (empresa_id, entidad, registro_id, fecha_edicion desc);
alter table public.auditoria_ediciones_pets enable row level security;
revoke all on public.auditoria_ediciones_pets from public, anon, authenticated;
-- Solo el servidor privilegiado puede consultar la auditoría: datos personales sensibles.

create or replace function public.auditar_edicion_pets()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid;
  v_anterior jsonb;
  v_nuevo jsonb;
begin
  if tg_table_name = 'consultas_controles' then
    v_actor := new.ultima_edicion_por;
  elsif tg_table_name = 'mascotas' then
    v_actor := new.actualizada_por;
  else
    v_actor := new.actualizado_por;
  end if;
  v_anterior := to_jsonb(old) - 'updated_at';
  v_nuevo := to_jsonb(new) - 'updated_at';
  if v_anterior is distinct from v_nuevo then
    insert into public.auditoria_ediciones_pets
      (empresa_id, entidad, registro_id, modificado_por, anterior, nuevo)
    values (new.empresa_id, tg_table_name, new.id, v_actor, to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;
drop trigger if exists auditoria_consultas_pets on public.consultas_controles;
create trigger auditoria_consultas_pets
  after update on public.consultas_controles for each row
  execute function public.auditar_edicion_pets();

drop trigger if exists auditoria_mascotas_pets on public.mascotas;
create trigger auditoria_mascotas_pets
  after update on public.mascotas for each row
  execute function public.auditar_edicion_pets();

drop trigger if exists auditoria_propietarios_pets on public.propietarios;
create trigger auditoria_propietarios_pets
  after update on public.propietarios for each row
  execute function public.auditar_edicion_pets();
commit;
