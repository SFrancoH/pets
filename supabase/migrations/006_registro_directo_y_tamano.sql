-- PETS: alta atómica sin formulario externo. Ejecutar en SQL Editor antes de desplegar.
-- Preserva las tablas antiguas de integraciones para registros históricos.
begin;
alter table public.mascotas add column if not exists tamano text;
alter table public.mascotas drop constraint if exists mascotas_tamano_valido;
alter table public.mascotas add constraint mascotas_tamano_valido check
  (tamano is null or tamano in ('Pequeño','Mediano','Grande','Otro'));
alter table public.propietarios add column if not exists fuente text;
alter table public.mascotas add column if not exists fuente text;
alter table public.propietarios add column if not exists notificaciones_email boolean not null default false;

create or replace function public.registrar_propietario_mascota_pets(
  p_empresa_id uuid, p_actor_id uuid, p_propietario jsonb, p_mascota jsonb, p_carnet text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_propietario_id uuid;
  v_mascota_id uuid;
  v_nombre text;
  v_documento text;
  v_sede text;
  v_id_actor uuid;
begin
  -- RPC de uso exclusivo de las acciones servidor que ya verificaron sesión/empresa.
  select u.id into v_id_actor from public.usuarios u where u.id = p_actor_id and u.activo = true
    and (u.rol = 'super_admin' or u.empresa_id = p_empresa_id);
  if v_id_actor is null then raise exception 'Usuario sin permiso'; end if;
  if not exists (select 1 from public.empresas where id = p_empresa_id and activa) then
    raise exception 'Empresa no válida';
  end if;
  v_sede := nullif(btrim(p_propietario->>'fuente'), '');
  if v_sede not in ('SEDE NORTE','SEDE SUR') or v_sede is null
    or v_sede is distinct from nullif(btrim(p_mascota->>'fuente'), '') then
    raise exception 'Sede no válida';
  end if;
  v_nombre := btrim(concat_ws(' ',nullif(btrim(p_propietario->>'nombre'),''),nullif(btrim(p_propietario->>'apellido'),'')));
  v_documento := nullif(btrim(p_propietario->>'numero_documento'),'');
  if length(v_nombre) < 2 or v_documento is null or p_carnet !~ '^[0-9]{14}$'
    or nullif(btrim(p_mascota->>'nombre'),'') is null then
    raise exception 'Datos básicos incompletos';
  end if;
  if exists (select 1 from public.mascotas where empresa_id=p_empresa_id and lower(numero_carnet)=lower(p_carnet)) then
    raise exception 'Carnet duplicado';
  end if;
  select id into v_propietario_id from public.propietarios
  where empresa_id=p_empresa_id and lower(numero_documento)=lower(v_documento)
  for update;
  if v_propietario_id is null then
    insert into public.propietarios (
      empresa_id, nombre, ciudad, direccion, telefono, whatsapp, email,
      tipo_documento, numero_documento, fuente, notificaciones_email,
      notificaciones_whatsapp, estado, tags, creado_por, actualizado_por
    ) values (
      p_empresa_id,v_nombre,nullif(p_propietario->>'ciudad',''),nullif(p_propietario->>'direccion',''),
      nullif(p_propietario->>'telefono',''),nullif(p_propietario->>'whatsapp',''),
      nullif(lower(p_propietario->>'correo_electronico'),''),
      nullif(p_propietario->>'tipo_documento',''),v_documento,v_sede,
      p_propietario->>'notificacion_email' = 'Si',p_propietario->>'notificacion_whatsapp' = 'Si',
      'Activo',array['Propietario']::text[],p_actor_id,p_actor_id
    ) returning id into v_propietario_id;
  else
    -- No sobrescribir automáticamente los datos de un propietario existente al vincular otra mascota.
    -- Su modificación debe ser explícita mediante Editar propietario.
    null;
  end if;

  insert into public.mascotas (
    empresa_id,nombre,especie,raza,sexo,fecha_nacimiento,color,peso_kg,
    temperamento,numero_carnet,estado_reproductivo,numero_partos,tamano,
    fuente,estado,creada_por,actualizada_por
  ) values (
    p_empresa_id,btrim(p_mascota->>'nombre'),nullif(p_mascota->>'especie',''),
    nullif(p_mascota->>'raza',''),nullif(p_mascota->>'sexo',''),
    nullif(p_mascota->>'fecha_nacimiento','')::date,nullif(p_mascota->>'color',''),
    nullif(p_mascota->>'peso_kg','')::numeric,nullif(p_mascota->>'temperamento',''),
    p_carnet,nullif(p_mascota->>'estado_reproductivo',''),
    nullif(p_mascota->>'numero_partos','')::integer,
    nullif(p_mascota->>'tamano',''),v_sede,
    case when p_mascota->>'estado' in ('Activo','Inactivo','Fallecido') then p_mascota->>'estado' else 'Activo' end,
    p_actor_id,p_actor_id
  ) returning id into v_mascota_id;
  insert into public.propietarios_mascotas (empresa_id,propietario_id,mascota_id,creado_por)
  values (p_empresa_id,v_propietario_id,v_mascota_id,p_actor_id);
  return jsonb_build_object('ok',true,'propietario_id',v_propietario_id,'mascota_id',v_mascota_id);
end;
$$;
revoke all on function public.registrar_propietario_mascota_pets(uuid,uuid,jsonb,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.registrar_propietario_mascota_pets(uuid,uuid,jsonb,jsonb,text) to service_role;
commit;
