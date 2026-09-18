begin;

create table if not exists public.consultas_controles (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  mascota_id uuid not null,
  fecha_registro timestamptz not null default now(),
  tipo_servicio text not null check (tipo_servicio in ('Consulta', 'Control')),
  motivo_cita text,
  medico_veterinario_id uuid references public.usuarios(id) on delete set null,
  medico_veterinario_nombre text not null,
  anamnesis text,
  tipo_alimento text check (
    tipo_alimento is null
    or tipo_alimento in ('Concentrado', 'Dieta BARF', 'Enlatado', 'Otro')
  ),
  tipo_alimento_otro text,
  racion text,
  orina text,
  heces text check (
    heces is null
    or heces in ('Normal', 'Blando', 'Pastoso', 'Líquido', 'Otro')
  ),
  heces_otro text,
  frecuencia_cardiaca integer check (frecuencia_cardiaca is null or frecuencia_cardiaca >= 0),
  frecuencia_respiratoria integer check (frecuencia_respiratoria is null or frecuencia_respiratoria >= 0),
  temperatura_c numeric(4,1) check (temperatura_c is null or temperatura_c between 20 and 50),
  tllc_segundos numeric(4,1) check (tllc_segundos is null or tllc_segundos >= 0),
  pulso text,
  peso_actual_kg numeric(7,2) check (peso_actual_kg is null or peso_actual_kg >= 0),
  actitud text,
  condicion_corporal text,
  revision_sistemas jsonb not null default '{}'::jsonb
    check (jsonb_typeof(revision_sistemas) = 'object'),
  comentarios_observaciones text,
  lista_problemas text,
  diagnostico_diferencial text,
  diagnostico_presuntivo text,
  examenes_laboratorio text,
  imagenes_diagnosticas text,
  procedimientos text,
  diagnostico_definitivo text,
  tratamiento text,
  pronostico text,
  notas text,
  habilitar_observacion boolean not null default false,
  registrada_por uuid references public.usuarios(id) on delete set null,
  medico_registra_nombre text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, mascota_id)
    references public.mascotas (empresa_id, id) on delete cascade
);

create index if not exists consultas_controles_empresa_idx
  on public.consultas_controles (empresa_id);

create index if not exists consultas_controles_mascota_fecha_idx
  on public.consultas_controles (mascota_id, fecha_registro desc);

drop trigger if exists consultas_controles_updated_at on public.consultas_controles;
create trigger consultas_controles_updated_at
before update on public.consultas_controles
for each row execute function public.actualizar_updated_at();

alter table public.consultas_controles enable row level security;

drop policy if exists consultas_controles_lectura_por_empresa on public.consultas_controles;
create policy consultas_controles_lectura_por_empresa
on public.consultas_controles
for select
to authenticated
using (
  private.es_super_admin()
  or empresa_id = private.usuario_actual_empresa_id()
);

drop policy if exists consultas_controles_creacion_por_empresa on public.consultas_controles;
create policy consultas_controles_creacion_por_empresa
on public.consultas_controles
for insert
to authenticated
with check (
  private.es_super_admin()
  or (
    private.usuario_actual_rol() in ('empresa_admin', 'veterinario')
    and empresa_id = private.usuario_actual_empresa_id()
  )
);

drop policy if exists consultas_controles_edicion_por_empresa on public.consultas_controles;
create policy consultas_controles_edicion_por_empresa
on public.consultas_controles
for update
to authenticated
using (
  private.es_super_admin()
  or (
    private.usuario_actual_rol() in ('empresa_admin', 'veterinario')
    and empresa_id = private.usuario_actual_empresa_id()
  )
)
with check (
  private.es_super_admin()
  or (
    private.usuario_actual_rol() in ('empresa_admin', 'veterinario')
    and empresa_id = private.usuario_actual_empresa_id()
  )
);

drop policy if exists consultas_controles_eliminacion_por_empresa on public.consultas_controles;
create policy consultas_controles_eliminacion_por_empresa
on public.consultas_controles
for delete
to authenticated
using (
  private.es_super_admin()
  or (
    private.usuario_actual_rol() in ('empresa_admin', 'veterinario')
    and empresa_id = private.usuario_actual_empresa_id()
  )
);

revoke all on public.consultas_controles from anon;
grant select, insert, update, delete on public.consultas_controles to authenticated;

commit;
