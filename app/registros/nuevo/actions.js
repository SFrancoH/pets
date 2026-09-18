"use server";

import { redirect } from "next/navigation";

import { requireOperationalProfile } from "@/lib/operational";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(formData, key, max = 240) {
  return String(formData.get(key) || "").trim().slice(0, max);
}

function optionalNumber(formData, key) {
  const value = text(formData, key, 30);
  return value === "" ? null : value;
}

function fail(code) {
  redirect(`/registros/nuevo?error=${encodeURIComponent(code)}`);
}

export async function createPendingPetRegistration(formData) {
  const profile = await requireOperationalProfile();
  const requestedCompanyId = text(formData, "empresa_id", 40);
  const companyId = profile.rol === "super_admin" ? requestedCompanyId : profile.empresa_id;

  if (!uuidPattern.test(companyId || "")) fail("empresa");

  const owner = {
    nombre: text(formData, "nombre", 80),
    apellido: text(formData, "apellido", 80),
    whatsapp: text(formData, "whatsapp", 40),
    telefono: text(formData, "telefono", 40),
    correo_electronico: text(formData, "correo_electronico", 160).toLowerCase(),
    ciudad: text(formData, "ciudad", 100),
    direccion: text(formData, "direccion", 220),
    tipo_documento: text(formData, "tipo_documento", 80),
    numero_documento: text(formData, "numero_documento", 80),
    notificacion_email: text(formData, "notificacion_email", 10),
    notificacion_whatsapp: text(formData, "notificacion_whatsapp", 10)
  };
  const pet = {
    nombre: text(formData, "mascota_nombre", 120),
    especie: text(formData, "especie", 80),
    raza: text(formData, "raza", 120),
    sexo: text(formData, "sexo", 40),
    fecha_nacimiento: text(formData, "fecha_nacimiento", 10),
    color: text(formData, "color", 80),
    peso_kg: optionalNumber(formData, "peso_kg"),
    temperamento: text(formData, "temperamento", 120),
    estado_reproductivo: text(formData, "estado_reproductivo", 100),
    numero_partos: optionalNumber(formData, "numero_partos")
  };
  const carnet = text(formData, "numero_carnet", 40);

  if (owner.nombre.length < 2 || !owner.whatsapp || !owner.correo_electronico.includes("@")) {
    fail("propietario");
  }
  if (!pet.nombre || !pet.especie || !carnet) fail("mascota");
  if (!/^\d{14}$/.test(carnet)) fail("carnet");
  if (!owner.tipo_documento || !owner.numero_documento) fail("documento");
  if (!["Si", "No"].includes(owner.notificacion_email) || !["Si", "No"].includes(owner.notificacion_whatsapp)) {
    fail("notificaciones");
  }

  const admin = getSupabaseAdmin();
  const [{ data: integration }, { data: existingPet }, { data: pending }] = await Promise.all([
    admin
      .from("integraciones_contacto")
      .select("empresa_id")
      .eq("empresa_id", companyId)
      .eq("activa", true)
      .maybeSingle(),
    admin
      .from("mascotas")
      .select("id")
      .eq("empresa_id", companyId)
      .ilike("numero_carnet", carnet)
      .maybeSingle(),
    admin
      .from("registros_mascotas_pendientes")
      .select("id")
      .eq("empresa_id", companyId)
      .eq("estado", "pendiente")
      .ilike("numero_carnet", carnet)
      .maybeSingle()
  ]);

  if (!integration) fail("integracion");
  if (existingPet || pending) fail("carnet_repetido");

  const { data: registration, error } = await admin
    .from("registros_mascotas_pendientes")
    .insert({
      empresa_id: companyId,
      creado_por: profile.id,
      propietario: owner,
      mascota: pet,
      numero_carnet: carnet
    })
    .select("id")
    .single();

  if (error || !registration) fail("guardar");
  redirect(`/registros/${registration.id}/confirmar`);
}
