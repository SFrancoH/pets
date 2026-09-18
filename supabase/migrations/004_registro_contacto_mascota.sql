begin;

alter table public.propietarios
  add column if not exists notificaciones_email boolean not null default false,
  add column if not exists crm_contacto_id text;

create unique index if not exists propietarios_crm_contacto_unico_por_empresa
  on public.propietarios (empresa_id, crm_contacto_id)
  where crm_contacto_id is not null and btrim(crm_contacto_id) <> '';

create table if not exists public.integraciones_contacto (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  formulario_url text not null check (formulario_url ~ '^https://'),
  webhook_token uuid not null default gen_random_uuid() unique,
  activa boolean not null default true,
  creada_por uuid references auth.users(id) on delete set null,
  actualizada_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registros_mascotas_pendientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  creado_por uuid references auth.users(id) on delete set null,
  propietario jsonb not null,
  mascota jsonb not null,
  numero_carnet text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'completado', 'error', 'cancelado')),
  propietario_id uuid references public.propietarios(id) on delete set null,
  mascota_id uuid references public.mascotas(id) on delete set null,
  contacto_externo_id text,
  ultimo_error text,
  expira_at timestamptz not null default (now() + interval '24 hours'),
  procesado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registros_pendientes_empresa_idx
  on public.registros_mascotas_pendientes (empresa_id, created_at desc);

create unique index if not exists registros_carnet_activo_unico
  on public.registros_mascotas_pendientes (empresa_id, lower(numero_carnet))
  where estado = 'pendiente';

drop trigger if exists integraciones_contacto_updated_at on public.integraciones_contacto;
create trigger integraciones_contacto_updated_at
before update on public.integraciones_contacto
for each row execute function public.actualizar_updated_at();

drop trigger if exists registros_mascotas_pendientes_updated_at on public.registros_mascotas_pendientes;
create trigger registros_mascotas_pendientes_updated_at
before update on public.registros_mascotas_pendientes
for each row execute function public.actualizar_updated_at();

alter table public.integraciones_contacto enable row level security;
alter table public.registros_mascotas_pendientes enable row level security;

revoke all on public.integraciones_contacto from public, anon, authenticated;
revoke all on public.registros_mascotas_pendientes from public, anon, authenticated;

create or replace function public.confirmar_registro_contacto_mascota(
  p_webhook_token uuid,
  p_registro_id uuid,
  p_propietario jsonb,
  p_contacto_externo_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
  v_registro public.registros_mascotas_pendientes%rowtype;
  v_propietario jsonb;
  v_mascota jsonb;
  v_propietario_id uuid;
  v_mascota_id uuid;
  v_nombre text;
  v_notificacion_email boolean;
  v_notificacion_whatsapp boolean;
begin
  select i.empresa_id
    into v_empresa_id
  from public.integraciones_contacto i
  where i.webhook_token = p_webhook_token
    and i.activa = true;

  if v_empresa_id is null then
    raise exception 'Integración no válida';
  end if;

  select r.*
    into v_registro
  from public.registros_mascotas_pendientes r
  where r.id = p_registro_id
    and r.empresa_id = v_empresa_id
  for update;

  if v_registro.id is null then
    raise exception 'Registro pendiente no encontrado';
  end if;

  if v_registro.estado = 'completado' then
    return jsonb_build_object(
      'ok', true,
      'ya_procesado', true,
      'propietario_id', v_registro.propietario_id,
      'mascota_id', v_registro.mascota_id
    );
  end if;

  if v_registro.estado <> 'pendiente' or v_registro.expira_at < now() then
    raise exception 'El registro ya no se puede confirmar';
  end if;

  v_propietario := v_registro.propietario || coalesce(p_propietario, '{}'::jsonb);
  v_mascota := v_registro.mascota;
  v_nombre := btrim(concat_ws(' ', nullif(v_propietario->>'nombre', ''), nullif(v_propietario->>'apellido', '')));

  if char_length(v_nombre) < 2 then
    raise exception 'El nombre del propietario no es válido';
  end if;

  v_notificacion_email := lower(coalesce(v_propietario->>'notificacion_email', 'false'))
    in ('true', 'si', 'sí', '1', 'yes');
  v_notificacion_whatsapp := lower(coalesce(v_propietario->>'notificacion_whatsapp', 'false'))
    in ('true', 'si', 'sí', '1', 'yes');

  if nullif(btrim(coalesce(p_contacto_externo_id, '')), '') is not null then
    select p.id into v_propietario_id
    from public.propietarios p
    where p.empresa_id = v_empresa_id
      and p.crm_contacto_id = btrim(p_contacto_externo_id)
    limit 1;
  end if;

  if v_propietario_id is null and nullif(btrim(coalesce(v_propietario->>'numero_documento', '')), '') is not null then
    select p.id into v_propietario_id
    from public.propietarios p
    where p.empresa_id = v_empresa_id
      and lower(p.numero_documento) = lower(btrim(v_propietario->>'numero_documento'))
    limit 1;
  end if;

  if v_propietario_id is null and nullif(btrim(coalesce(v_propietario->>'correo_electronico', '')), '') is not null then
    select p.id into v_propietario_id
    from public.propietarios p
    where p.empresa_id = v_empresa_id
      and lower(p.email) = lower(btrim(v_propietario->>'correo_electronico'))
    limit 1;
  end if;

  if v_propietario_id is null and nullif(btrim(coalesce(v_propietario->>'whatsapp', '')), '') is not null then
    select p.id into v_propietario_id
    from public.propietarios p
    where p.empresa_id = v_empresa_id
      and p.whatsapp = btrim(v_propietario->>'whatsapp')
    limit 1;
  end if;

  if v_propietario_id is null then
    insert into public.propietarios (
      empresa_id, nombre, ciudad, direccion, telefono, whatsapp, email,
      tipo_documento, numero_documento, estado, notificaciones_email,
      notificaciones_whatsapp, tags, crm_contacto_id, creado_por, actualizado_por
    ) values (
      v_empresa_id,
      v_nombre,
      nullif(btrim(v_propietario->>'ciudad'), ''),
      nullif(btrim(v_propietario->>'direccion'), ''),
      nullif(btrim(v_propietario->>'telefono'), ''),
      nullif(btrim(v_propietario->>'whatsapp'), ''),
      nullif(lower(btrim(v_propietario->>'correo_electronico')), ''),
      nullif(btrim(v_propietario->>'tipo_documento'), ''),
      nullif(btrim(v_propietario->>'numero_documento'), ''),
      'Activo',
      v_notificacion_email,
      v_notificacion_whatsapp,
      array['Propietario']::text[],
      nullif(btrim(coalesce(p_contacto_externo_id, '')), ''),
      v_registro.creado_por,
      v_registro.creado_por
    ) returning id into v_propietario_id;
  else
    update public.propietarios
    set nombre = v_nombre,
        ciudad = nullif(btrim(v_propietario->>'ciudad'), ''),
        direccion = nullif(btrim(v_propietario->>'direccion'), ''),
        telefono = nullif(btrim(v_propietario->>'telefono'), ''),
        whatsapp = nullif(btrim(v_propietario->>'whatsapp'), ''),
        email = nullif(lower(btrim(v_propietario->>'correo_electronico')), ''),
        tipo_documento = nullif(btrim(v_propietario->>'tipo_documento'), ''),
        numero_documento = nullif(btrim(v_propietario->>'numero_documento'), ''),
        notificaciones_email = v_notificacion_email,
        notificaciones_whatsapp = v_notificacion_whatsapp,
        crm_contacto_id = coalesce(nullif(btrim(coalesce(p_contacto_externo_id, '')), ''), crm_contacto_id),
        tags = case when 'Propietario' = any(tags) then tags else array_append(tags, 'Propietario') end,
        actualizado_por = v_registro.creado_por
    where id = v_propietario_id;
  end if;

  if exists (
    select 1 from public.mascotas m
    where m.empresa_id = v_empresa_id
      and lower(m.numero_carnet) = lower(v_registro.numero_carnet)
  ) then
    raise exception 'El número de carnet ya existe';
  end if;

  insert into public.mascotas (
    empresa_id, nombre, especie, raza, sexo, fecha_nacimiento, color, peso_kg,
    temperamento, numero_carnet, estado_reproductivo, numero_partos, estado,
    creada_por, actualizada_por
  ) values (
    v_empresa_id,
    btrim(v_mascota->>'nombre'),
    nullif(btrim(v_mascota->>'especie'), ''),
    nullif(btrim(v_mascota->>'raza'), ''),
    nullif(btrim(v_mascota->>'sexo'), ''),
    nullif(v_mascota->>'fecha_nacimiento', '')::date,
    nullif(btrim(v_mascota->>'color'), ''),
    nullif(v_mascota->>'peso_kg', '')::numeric,
    nullif(btrim(v_mascota->>'temperamento'), ''),
    v_registro.numero_carnet,
    nullif(btrim(v_mascota->>'estado_reproductivo'), ''),
    nullif(v_mascota->>'numero_partos', '')::integer,
    'Activo',
    v_registro.creado_por,
    v_registro.creado_por
  ) returning id into v_mascota_id;

  insert into public.propietarios_mascotas (
    empresa_id, propietario_id, mascota_id, creado_por
  ) values (
    v_empresa_id, v_propietario_id, v_mascota_id, v_registro.creado_por
  ) on conflict do nothing;

  update public.registros_mascotas_pendientes
  set estado = 'completado',
      propietario_id = v_propietario_id,
      mascota_id = v_mascota_id,
      contacto_externo_id = nullif(btrim(coalesce(p_contacto_externo_id, '')), ''),
      procesado_at = now(),
      ultimo_error = null
  where id = v_registro.id;

  return jsonb_build_object(
    'ok', true,
    'ya_procesado', false,
    'propietario_id', v_propietario_id,
    'mascota_id', v_mascota_id
  );
end;
$$;

revoke all on function public.confirmar_registro_contacto_mascota(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.confirmar_registro_contacto_mascota(uuid, uuid, jsonb, text)
  to service_role;

commit;
