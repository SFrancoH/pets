import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sources(body) {
  return [body, body?.data, body?.contact, body?.customData, body?.custom_data, body?.fields].filter(Boolean);
}

function pick(body, ...keys) {
  for (const source of sources(body)) {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
    }
  }
  return "";
}

async function readBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export async function POST(request, { params }) {
  const { token } = await params;
  if (!uuidPattern.test(token || "")) {
    return NextResponse.json({ ok: false, error: "Ruta no válida" }, { status: 404 });
  }

  let body;
  try {
    body = await readBody(request);
  } catch {
    return NextResponse.json({ ok: false, error: "Contenido no válido" }, { status: 400 });
  }

  const registrationId = pick(body, "pets_registro_id", "registro_id");
  if (!uuidPattern.test(registrationId)) {
    return NextResponse.json({ ok: false, error: "Falta pets_registro_id" }, { status: 400 });
  }

  const ownerValues = {
    nombre: pick(body, "nombre", "first_name", "firstName"),
    apellido: pick(body, "apellido", "last_name", "lastName"),
    whatsapp: pick(body, "whatsapp", "phone"),
    telefono: pick(body, "telefono", "telefono_alterno"),
    correo_electronico: pick(body, "correo_electronico", "email"),
    ciudad: pick(body, "ciudad", "city"),
    direccion: pick(body, "direccion", "address"),
    tipo_documento: pick(body, "tipo_de_documento", "tipo_documento"),
    numero_documento: pick(body, "numero_de_documento", "número_de_documento", "numero_documento"),
    notificacion_email: pick(body, "notificacion_email"),
    notificacion_whatsapp: pick(body, "notificacion_whatsapp")
  };
  const owner = Object.fromEntries(
    Object.entries(ownerValues).filter(([, value]) => value !== "")
  );
  const contactId = pick(body, "contact_id", "contactId");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("confirmar_registro_contacto_mascota", {
    p_webhook_token: token,
    p_registro_id: registrationId,
    p_propietario: owner,
    p_contacto_externo_id: contactId || null
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
  }
  return NextResponse.json(data, { status: 200 });
}
