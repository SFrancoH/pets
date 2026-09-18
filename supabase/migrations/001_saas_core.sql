begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.rol_usuario as enum (
    'super_admin',
    'empresa_admin',
    'veterinario'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) between 2 and 120),
  activa boolean not null default true,
  creada_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 2 and 120),
  email text not null,
  rol public.rol_usuario not null,
  activo boolean not null default true,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usuarios_alcance_empresa check (
    (rol = 'super_admin' and empresa_id is null)
    or
    (rol <> 'super_admin' and empresa_id is not null)
  )
);

create unique index if not exists usuarios_email_unico
  on public.usuarios (lower(email));

create unique index if not exists un_solo_super_admin
  on public.usuarios ((rol))
  where rol = 'super_admin';

create table if not exists public.mascotas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 120),
  especie text,
  raza text,
  sexo text,
  fecha_nacimiento date,
  color text,
  peso_kg numeric(7,2) check (peso_kg is null or peso_kg >= 0),
  temperamento text,
  numero_carnet text,
  estado_reproductivo text,
  numero_partos integer check (numero_partos is null or numero_partos >= 0),
  fecha_fallecimiento date,
  motivo_fallecimiento text,
  comentarios_fallecimiento text,
  estado text not null default 'Activo',
  creada_por uuid references auth.users(id) on delete set null,
  actualizada_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mascotas_fechas_validas check (
    fecha_fallecimiento is null
    or fecha_nacimiento is null
    or fecha_fallecimiento >= fecha_nacimiento
  ),
  unique (empresa_id, id)
);

create table if not exists public.propietarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 2 and 120),
  ciudad text,
  direccion text,
  telefono text,
  whatsapp text,
  email text,
  tipo_documento text,
  numero_documento text,
  estado text not null default 'Activo',
  notificaciones_whatsapp boolean not null default false,
  tags text[] not null default '{}',
  creado_por uuid references auth.users(id) on delete set null,
  actualizado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, id)
);

create table if not exists public.propietarios_mascotas (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  propietario_id uuid not null,
  mascota_id uuid not null,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (propietario_id, mascota_id),
  foreign key (empresa_id, propietario_id)
    references public.propietarios (empresa_id, id) on delete cascade,
  foreign key (empresa_id, mascota_id)
    references public.mascotas (empresa_id, id) on delete cascade
);

create index if not exists usuarios_empresa_idx on public.usuarios (empresa_id);
create index if not exists mascotas_empresa_idx on public.mascotas (empresa_id);
create index if not exists mascotas_nombre_idx on public.mascotas (empresa_id, nombre);
create unique index if not exists mascotas_carnet_unico_por_empresa
  on public.mascotas (empresa_id, lower(numero_carnet))
  where numero_carnet is not null and btrim(numero_carnet) <> '';
create index if not exists propietarios_empresa_idx on public.propietarios (empresa_id);
create index if not exists propietarios_nombre_idx
  on public.propietarios (empresa_id, nombre);
create unique index if not exists propietarios_documento_unico_por_empresa
  on public.propietarios (empresa_id, lower(numero_documento))
  where numero_documento is not null and btrim(numero_documento) <> '';
create index if not exists propietarios_mascotas_empresa_idx
  on public.propietarios_mascotas (empresa_id);
create index if not exists propietarios_mascotas_mascota_idx
  on public.propietarios_mascotas (mascota_id);

create or replace function public.actualizar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists empresas_updated_at on public.empresas;
create trigger empresas_updated_at
before update on public.empresas
for each row execute function public.actualizar_updated_at();

drop trigger if exists usuarios_updated_at on public.usuarios;
create trigger usuarios_updated_at
before update on public.usuarios
for each row execute function public.actualizar_updated_at();

drop trigger if exists mascotas_updated_at on public.mascotas;
create trigger mascotas_updated_at
before update on public.mascotas
for each row execute function public.actualizar_updated_at();

drop trigger if exists propietarios_updated_at on public.propietarios;
create trigger propietarios_updated_at
before update on public.propietarios
for each row execute function public.actualizar_updated_at();

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.usuario_actual_rol()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select u.rol
  from public.usuarios u
  where u.id = auth.uid()
    and u.activo = true;
$$;

create or replace function private.usuario_actual_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.empresa_id
  from public.usuarios u
  where u.id = auth.uid()
    and u.activo = true;
$$;

create or replace function private.es_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.usuario_actual_rol() = 'super_admin', false);
$$;

revoke all on function private.usuario_actual_rol() from public;
revoke all on function private.usuario_actual_empresa_id() from public;
revoke all on function private.es_super_admin() from public;
grant execute on function private.usuario_actual_rol() to authenticated;
grant execute on function private.usuario_actual_empresa_id() to authenticated;
grant execute on function private.es_super_admin() to authenticated;

alter table public.empresas enable row level security;
alter table public.usuarios enable row level security;
alter table public.mascotas enable row level security;
alter table public.propietarios enable row level security;
alter table public.propietarios_mascotas enable row level security;

drop policy if exists empresas_lectura_por_alcance on public.empresas;
create policy empresas_lectura_por_alcance
on public.empresas
for select
to authenticated
using (
  private.es_super_admin()
  or id = private.usuario_actual_empresa_id()
);

drop policy if exists usuarios_lectura_por_alcance on public.usuarios;
create policy usuarios_lectura_por_alcance
on public.usuarios
for select
to authenticated
using (
  private.es_super_admin()
  or id = auth.uid()
  or (
    private.usuario_actual_rol() = 'empresa_admin'
    and empresa_id = private.usuario_actual_empresa_id()
  )
);

drop policy if exists mascotas_lectura_por_empresa on public.mascotas;
create policy mascotas_lectura_por_empresa
on public.mascotas
for select
to authenticated
using (
  private.es_super_admin()
  or empresa_id = private.usuario_actual_empresa_id()
);

drop policy if exists mascotas_creacion_por_empresa on public.mascotas;
create policy mascotas_creacion_por_empresa
on public.mascotas
for insert
to authenticated
with check (
  private.es_super_admin()
  or (
    private.usuario_actual_rol() in ('empresa_admin', 'veterinario')
    and empresa_id = private.usuario_actual_empresa_id()
  )
);

drop policy if exists mascotas_edicion_por_empresa on public.mascotas;
create policy mascotas_edicion_por_empresa
on public.mascotas
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

drop policy if exists mascotas_eliminacion_por_empresa on public.mascotas;
create policy mascotas_eliminacion_por_empresa
on public.mascotas
for delete
to authenticated
using (
  private.es_super_admin()
  or (
    private.usuario_actual_rol() in ('empresa_admin', 'veterinario')
    and empresa_id = private.usuario_actual_empresa_id()
  )
);

drop policy if exists propietarios_lectura_por_empresa on public.propietarios;
create policy propietarios_lectura_por_empresa
on public.propietarios
for select
to authenticated
using (
  private.es_super_admin()
  or empresa_id = private.usuario_actual_empresa_id()
);

drop policy if exists propietarios_creacion_por_empresa on public.propietarios;
create policy propietarios_creacion_por_empresa
on public.propietarios
for insert
to authenticated
with check (
  private.es_super_admin()
  or (
    private.usuario_actual_rol() in ('empresa_admin', 'veterinario')
    and empresa_id = private.usuario_actual_empresa_id()
  )
);

drop policy if exists propietarios_edicion_por_empresa on public.propietarios;
create policy propietarios_edicion_por_empresa
on public.propietarios
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

drop policy if exists propietarios_eliminacion_por_empresa on public.propietarios;
create policy propietarios_eliminacion_por_empresa
on public.propietarios
for delete
to authenticated
using (
  private.es_super_admin()
  or (
    private.usuario_actual_rol() in ('empresa_admin', 'veterinario')
    and empresa_id = private.usuario_actual_empresa_id()
  )
);

drop policy if exists propietarios_mascotas_lectura on public.propietarios_mascotas;
create policy propietarios_mascotas_lectura
on public.propietarios_mascotas
for select
to authenticated
using (
  private.es_super_admin()
  or empresa_id = private.usuario_actual_empresa_id()
);

drop policy if exists propietarios_mascotas_creacion on public.propietarios_mascotas;
create policy propietarios_mascotas_creacion
on public.propietarios_mascotas
for insert
to authenticated
with check (
  private.es_super_admin()
  or (
    private.usuario_actual_rol() in ('empresa_admin', 'veterinario')
    and empresa_id = private.usuario_actual_empresa_id()
  )
);

drop policy if exists propietarios_mascotas_eliminacion on public.propietarios_mascotas;
create policy propietarios_mascotas_eliminacion
on public.propietarios_mascotas
for delete
to authenticated
using (
  private.es_super_admin()
  or (
    private.usuario_actual_rol() in ('empresa_admin', 'veterinario')
    and empresa_id = private.usuario_actual_empresa_id()
  )
);

revoke all on public.empresas from anon;
revoke all on public.usuarios from anon;
revoke all on public.mascotas from anon;
revoke all on public.propietarios from anon;
revoke all on public.propietarios_mascotas from anon;

grant select on public.empresas to authenticated;
grant select on public.usuarios to authenticated;
grant select, insert, update, delete on public.mascotas to authenticated;
grant select, insert, update, delete on public.propietarios to authenticated;
grant select, insert, delete on public.propietarios_mascotas to authenticated;

commit;
