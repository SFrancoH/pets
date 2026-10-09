-- PETS: índice cronológico unificado, preparado para otros módulos de atención.
-- Ejecutar DESPUÉS de 001-006, antes de desplegar historial unificado.
-- Los detalles clínicos permanecen en consultas_controles; aquí solo se indexan eventos.
begin;

create table if not exists public.eventos_mascota (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  mascota_id uuid not null,
  modulo text not null check (modulo in (
    'Consulta y control','Fórmula y remisión','Procedimientos','Vacunación',
    'Desparasitación','Estética','Guardería','Seguimiento','Consentimientos'
  )),
  consulta_id uuid,
  resumen text,
  fecha_registro timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (empresa_id, mascota_id) references public.mascotas (empresa_id, id) on delete cascade,
  foreign key (empresa_id, consulta_id) references public.consultas_controles (empresa_id, id) on delete cascade
);
create index if not exists eventos_mascota_cronologia_idx
  on public.eventos_mascota (empresa_id, mascota_id, fecha_registro desc, id desc);
create unique index if not exists eventos_mascota_consulta_modulo_uniq
  on public.eventos_mascota (consulta_id, modulo) where consulta_id is not null;

alter table public.eventos_mascota enable row level security;
revoke all on public.eventos_mascota from public, anon, authenticated;
grant select on public.eventos_mascota to authenticated;
drop policy if exists eventos_mascota_lectura_empresa on public.eventos_mascota;
create policy eventos_mascota_lectura_empresa on public.eventos_mascota
for select to authenticated using (
  private.es_super_admin() or empresa_id = private.usuario_actual_empresa_id()
);

create or replace function public.sincronizar_eventos_consulta()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.eventos_mascota where consulta_id = old.id;
    return old;
  end if;
  delete from public.eventos_mascota where consulta_id = new.id;
  insert into public.eventos_mascota
    (empresa_id, mascota_id, modulo, consulta_id, resumen, fecha_registro)
  values (new.empresa_id,new.mascota_id,'Consulta y control',new.id,
          new.tipo_servicio || coalesce(' — ' || nullif(new.motivo_cita,''),''),
          new.fecha_registro);
  if new.procedimientos_habilitados then
    insert into public.eventos_mascota
      (empresa_id, mascota_id, modulo, consulta_id, resumen, fecha_registro)
    values (new.empresa_id,new.mascota_id,'Procedimientos',new.id,
            array_to_string(new.tipos_procedimiento,', '),new.fecha_registro);
  end if;
  if new.formula_descripcion is not null
     or (new.formula_medicamentos is not null and new.formula_medicamentos <> '[]'::jsonb) then
    insert into public.eventos_mascota
      (empresa_id, mascota_id, modulo, consulta_id, resumen, fecha_registro)
    values (new.empresa_id,new.mascota_id,'Fórmula y remisión',new.id,
            coalesce(new.formula_descripcion, 'Fórmula farmacológica'),new.fecha_registro);
  end if;
  return new;
end;
$$;

drop trigger if exists consultas_generar_eventos on public.consultas_controles;
create trigger consultas_generar_eventos
after insert or update or delete on public.consultas_controles
for each row execute function public.sincronizar_eventos_consulta();

-- Backfill: recopila consultas anteriores (el disparador rige los cambios futuros).
insert into public.eventos_mascota (empresa_id, mascota_id, modulo, consulta_id, resumen, fecha_registro)
select c.empresa_id,c.mascota_id,'Consulta y control',c.id,
       c.tipo_servicio || coalesce(' — ' || nullif(c.motivo_cita,''),''),c.fecha_registro
from public.consultas_controles c
on conflict (consulta_id, modulo) where consulta_id is not null do nothing;

insert into public.eventos_mascota (empresa_id, mascota_id, modulo, consulta_id, resumen, fecha_registro)
select c.empresa_id,c.mascota_id,'Procedimientos',c.id,
       array_to_string(c.tipos_procedimiento,', '),c.fecha_registro
from public.consultas_controles c where c.procedimientos_habilitados
on conflict (consulta_id, modulo) where consulta_id is not null do nothing;

insert into public.eventos_mascota (empresa_id, mascota_id, modulo, consulta_id, resumen, fecha_registro)
select c.empresa_id,c.mascota_id,'Fórmula y remisión',c.id,
       coalesce(c.formula_descripcion, 'Fórmula farmacológica'),c.fecha_registro
from public.consultas_controles c
where c.formula_descripcion is not null
  or (c.formula_medicamentos is not null and c.formula_medicamentos <> '[]'::jsonb)
on conflict (consulta_id, modulo) where consulta_id is not null do nothing;

-- Resumen: devolver un único evento (el más reciente) de cada uno de los nueve módulos.
create or replace function public.ultimos_eventos_mascota_pets(
  p_empresa_id uuid, p_mascota_id uuid
) returns setof public.eventos_mascota
language sql stable security definer set search_path = ''
as $
  select distinct on (e.modulo) e.*
  from public.eventos_mascota e
  where e.empresa_id = p_empresa_id and e.mascota_id = p_mascota_id
  order by e.modulo, e.fecha_registro desc, e.id desc
$;
revoke all on function public.ultimos_eventos_mascota_pets(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ultimos_eventos_mascota_pets(uuid, uuid) to service_role;

commit;
