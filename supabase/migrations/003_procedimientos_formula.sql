begin;

alter table public.consultas_controles
  add column if not exists procedimientos_habilitados boolean not null default false,
  add column if not exists area_consulta text,
  add column if not exists tipos_procedimiento text[] not null default '{}'::text[],
  add column if not exists valor_total_servicio numeric(12,2),
  add column if not exists observaciones_procedimiento text,
  add column if not exists formula_descripcion text,
  add column if not exists formula_medicamentos jsonb not null default '[]'::jsonb;

alter table public.consultas_controles
  drop constraint if exists consultas_controles_area_consulta_valida,
  add constraint consultas_controles_area_consulta_valida check (
    area_consulta is null
    or area_consulta in ('Medicación', 'Hospitalización')
  ),
  drop constraint if exists consultas_controles_valor_servicio_valido,
  add constraint consultas_controles_valor_servicio_valido check (
    valor_total_servicio is null
    or valor_total_servicio >= 0
  ),
  drop constraint if exists consultas_controles_formula_medicamentos_array,
  add constraint consultas_controles_formula_medicamentos_array check (
    jsonb_typeof(formula_medicamentos) = 'array'
  );

commit;
