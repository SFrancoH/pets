"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth";
import {
  booleanValue,
  fetchAll,
  insertInChunks,
  pick,
  readFirstWorksheet,
  textValue
} from "@/lib/excel-import";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function importOwners(formData) {
  const actor = await requireProfile(["super_admin"]);
  const companyId = String(formData.get("empresa_id") || "");
  const file = formData.get("archivo");
  if (!uuidPattern.test(companyId)) redirect("/propietarios?error=empresa");

  try {
    const sourceRows = await readFirstWorksheet(file);
    const admin = getSupabaseAdmin();
    const { data: company } = await admin.from("empresas").select("id").eq("id", companyId).eq("activa", true).maybeSingle();
    if (!company) redirect("/propietarios?error=empresa");

    const existing = await fetchAll((from, to) =>
      admin.from("propietarios").select("numero_documento, email").eq("empresa_id", companyId).range(from, to)
    );
    const usedDocuments = new Set(existing.map((row) => String(row.numero_documento || "").trim().toLowerCase()).filter(Boolean));
    const rows = [];
    const relationships = [];

    for (const source of sourceRows) {
      const nombre = textValue(pick(source, ["nombre", "nombre propietario", "nombre del propietario"]));
      if (!nombre) continue;
      const document = textValue(pick(source, ["numero_documento", "numero de documento"]));
      const documentKey = document?.toLowerCase();
      if (documentKey && usedDocuments.has(documentKey)) continue;
      if (documentKey) usedDocuments.add(documentKey);
      const email = textValue(pick(source, ["email", "correo", "correo electronico"]));
      const carnets = String(pick(source, ["numeros_carnet", "numeros de carnet", "numero carnet", "carnets"]) || "")
        .split(/[,;|]/).map((value) => value.trim()).filter(Boolean);

      rows.push({
        empresa_id: companyId,
        nombre,
        ciudad: textValue(pick(source, ["ciudad"])),
        direccion: textValue(pick(source, ["direccion"])),
        telefono: textValue(pick(source, ["telefono", "celular"])),
        whatsapp: textValue(pick(source, ["whatsapp"])),
        email,
        tipo_documento: textValue(pick(source, ["tipo_documento", "tipo de documento"])),
        numero_documento: document,
        estado: textValue(pick(source, ["estado"])) || "Activo",
        notificaciones_whatsapp: booleanValue(pick(source, ["notificaciones_whatsapp", "notificacion de whatsapp"])),
        tags: String(pick(source, ["tags", "tag"]) || "").split(/[,;|]/).map((value) => value.trim()).filter(Boolean),
        creado_por: actor.id,
        actualizado_por: actor.id
      });
      relationships.push({ documentKey, emailKey: email?.toLowerCase(), carnets });
    }

    if (!rows.length) redirect("/propietarios?error=sin_filas");
    await insertInChunks("propietarios", rows, admin);

    const [owners, pets] = await Promise.all([
      fetchAll((from, to) => admin.from("propietarios").select("id, numero_documento, email").eq("empresa_id", companyId).range(from, to)),
      fetchAll((from, to) => admin.from("mascotas").select("id, numero_carnet").eq("empresa_id", companyId).range(from, to))
    ]);
    const ownersByDocument = new Map(owners.map((owner) => [String(owner.numero_documento || "").toLowerCase(), owner.id]).filter(([key]) => key));
    const ownersByEmail = new Map(owners.map((owner) => [String(owner.email || "").toLowerCase(), owner.id]).filter(([key]) => key));
    const petsByCarnet = new Map(pets.map((pet) => [String(pet.numero_carnet || "").toLowerCase(), pet.id]).filter(([key]) => key));
    const links = [];
    for (const relation of relationships) {
      const ownerId = ownersByDocument.get(relation.documentKey) || ownersByEmail.get(relation.emailKey);
      if (!ownerId) continue;
      relation.carnets.forEach((carnet) => {
        const petId = petsByCarnet.get(carnet.toLowerCase());
        if (petId) links.push({ empresa_id: companyId, propietario_id: ownerId, mascota_id: petId, creado_por: actor.id });
      });
    }
    if (links.length) {
      const { error } = await admin.from("propietarios_mascotas").upsert(links, { onConflict: "propietario_id,mascota_id", ignoreDuplicates: true });
      if (error) throw error;
    }

    revalidatePath("/propietarios");
    revalidatePath("/mascotas");
    redirect("/propietarios?ok=importado");
  } catch (error) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect("/propietarios?error=archivo");
  }
}
