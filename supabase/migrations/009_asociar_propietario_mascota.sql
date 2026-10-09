-- PETS 009: asociación atómica de un propietario con una mascota.
-- Ejecutar después de la migración 006. No crea tablas.
begin;

create or replace function public.asociar_propietario_mascota_pets(
  p_mascota_id uuid,
  p_actor_id uuid,
  p_propietario jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $pets_asociar$
declare
  v_empresa_id uuid;
  v_nombre text;
  v_doc text;
  v_wa text;
  v_tel text;
  v_sede text;
  v_match_ids uuid[];
  v_owner_id uuid;
  v_existing_doc text;
  v_inserted integer;
  v_new boolean := false;
begin
  if p_mascota_id is null or p_actor_id is null
    or jsonb_typeof(p_propietario) is distinct from 'object' then
    raise exception 'Datos requeridos ausentes' using errcode = '22023';
  end if;
  select m.empresa_id into v_empresa_id
  from public.mascotas m
  join public.empresas e on e.id = m.empresa_id and e.activa
  where m.id = p_mascota_id;
  if v_empresa_id is null then
    raise exception 'Mascota no encontrada' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.usuarios u
    where u.id = p_actor_id and u.activo
      and (u.rol = 'super_admin'::public.rol_usuario or u.empresa_id = v_empresa_id)
  ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  v_nombre := btrim(concat_ws(' ',
    nullif(btrim(p_propietario->>'nombre'), ''),
    nullif(btrim(p_propietario->>'apellido'), '')
  ));
  v_doc := lower(nullif(btrim(p_propietario->>'numero_documento'), ''));
  v_wa := regexp_replace(coalesce(p_propietario->>'whatsapp', ''), '[^0-9]', '', 'g');
  v_tel := regexp_replace(coalesce(p_propietario->>'telefono', ''), '[^0-9]', '', 'g');
  v_sede := nullif(btrim(p_propietario->>'fuente'), '');
  if length(v_nombre) < 2 or v_doc is null or length(v_wa) < 7
    or nullif(btrim(p_propietario->>'tipo_documento'), '') is null
    or nullif(btrim(p_propietario->>'correo_electronico'), '') is null
    or position('@' in coalesce(p_propietario->>'correo_electronico', '')) < 2
    or v_sede not in ('SEDE NORTE', 'SEDE SUR') or v_sede is null
    or coalesce(p_propietario->>'notificacion_email', '') not in ('Si','No')
    or coalesce(p_propietario->>'notificacion_whatsapp', '') not in ('Si','No')
  then
    raise exception 'Datos del propietario inválidos' using errcode = '22023';
  end if;
  if length(v_tel) < 7 then v_tel := ''; end if;

  -- Serializar altas simultáneas en la misma empresa para este flujo.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text, 0)
  );

  select array(
    select p.id from public.propietarios p
    where p.empresa_id = v_empresa_id and (
      lower(btrim(coalesce(p.numero_documento,''))) = v_doc
      or (
        length(regexp_replace(coalesce(p.whatsapp, ''), '[^0-9]', '', 'g')) >= 7
        and regexp_replace(p.whatsapp, '[^0-9]', '', 'g') in (v_wa, v_tel)
      )
      or (
        length(regexp_replace(coalesce(p.telefono, ''), '[^0-9]', '', 'g')) >= 7
        and regexp_replace(p.telefono, '[^0-9]', '', 'g') in (v_wa, v_tel)
      )
    )
    order by p.id limit 3
  ) into v_match_ids;

  if cardinality(v_match_ids) > 1 then
    raise exception 'Documento y teléfono coinciden con distintos propietarios'
      using errcode = 'P0001';
  end if;
  if cardinality(v_match_ids) = 1 then
    v_owner_id := v_match_ids[1];
    select lower(nullif(btrim(numero_documento), ''))
      into v_existing_doc from public.propietarios where id = v_owner_id;
    if v_existing_doc is not null and v_existing_doc <> v_doc then
      raise exception 'Teléfono asociado a un documento distinto'
        using errcode = 'P0001';
    end if;
  else
    insert into public.propietarios (
      empresa_id, nombre, ciudad, direccion, telefono, whatsapp, email,
      tipo_documento, numero_documento, estado, notificaciones_whatsapp,
      notificaciones_email, tags, fuente, creado_por, actualizado_por
    ) values (
      v_empresa_id, v_nombre,
      nullif(btrim(p_propietario->>'ciudad'), ''),
      nullif(btrim(p_propietario->>'direccion'), ''),
      nullif(btrim(p_propietario->>'telefono'), ''),
      nullif(btrim(p_propietario->>'whatsapp'), ''),
      lower(nullif(btrim(p_propietario->>'correo_electronico'), '')),
      nullif(btrim(p_propietario->>'tipo_documento'), ''),
      nullif(btrim(p_propietario->>'numero_documento'), ''),
      'Activo',
      p_propietario->>'notificacion_whatsapp' = 'Si',
      p_propietario->>'notificacion_email' = 'Si',
      '{}'::text[], v_sede, p_actor_id, p_actor_id
    ) returning id into v_owner_id;
    v_new := true;
  end if;

  insert into public.propietarios_mascotas (
    empresa_id, propietario_id, mascota_id, creado_por
  ) values (
    v_empresa_id, v_owner_id, p_mascota_id, p_actor_id
  ) on conflict (propietario_id, mascota_id) do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'success', true,
    'propietario_id', v_owner_id,
    'mascota_id', p_mascota_id,
    'resultado', case
      when v_inserted = 0 then 'ya_asociado'
      when v_new then 'creado_y_asociado'
      else 'existente_asociado'
    end
  );
end;
$pets_asociar$;

revoke all on function public.asociar_propietario_mascota_pets(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.asociar_propietario_mascota_pets(uuid,uuid,jsonb)
  to service_role;

commit;
