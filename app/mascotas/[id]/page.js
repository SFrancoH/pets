import Link from "next/link";
import { notFound } from "next/navigation";

import ConsultationControlPanel from "@/components/consultation-control-panel";
import DashboardHeader from "@/components/dashboard-header";
import PetEditForm from "@/components/pet-edit-form";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatDate, requireOperationalProfile } from "@/lib/operational";

export default async function PetDetailPage({ params, searchParams }) {
  const profile = await requireOperationalProfile();
  const { id } = await params;
  const queryParams = await searchParams;
  const admin = getSupabaseAdmin();
  let query = admin
    .from("mascotas")
    .select(`*, empresas(nombre), propietarios_mascotas(propietarios(id, nombre, telefono, whatsapp, email, numero_documento))`)
    .eq("id", id);
  if (profile.rol !== "super_admin") query = query.eq("empresa_id", profile.empresa_id);
  const { data: pet } = await query.maybeSingle();
  if (!pet) notFound();

  const historyOpen = queryParams?.historial === "1";
  const historyPage = Math.max(1, Number.parseInt(queryParams?.pagina || "1", 10) || 1);
  const datePattern = /^\\d{4}-\\d{2}-\\d{2}$/;
  const historyFrom = datePattern.test(queryParams?.desde || "") ? queryParams.desde : "";
  const historyTo = datePattern.test(queryParams?.hasta || "") ? queryParams.hasta : "";
  let historyQuery = admin.from("consultas_controles")
    .select("*", { count: "exact" }).eq("empresa_id", pet.empresa_id).eq("mascota_id", pet.id);
  if (historyOpen && historyFrom) historyQuery = historyQuery.gte("fecha_registro", `${historyFrom}T00:00:00-05:00`);
  if (historyOpen && historyTo) historyQuery = historyQuery.lte("fecha_registro", `${historyTo}T23:59:59.999-05:00`);
  const limit = historyOpen ? 50 : 1;
  const offset = historyOpen ? (historyPage - 1) * limit : 0;
  const [veterinariansResult, consultationsResult, procedureSchemaResult, latestResult, latestProcedureResult, latestFormulaResult] = await Promise.all([
    admin.from("usuarios").select("id, nombre, rol, empresa_id")
      .eq("empresa_id", pet.empresa_id).eq("rol", "veterinario")
      .eq("activo", true).order("nombre"),
    historyQuery.order("fecha_registro", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + limit - 1),
    admin.from("consultas_controles").select("procedimientos_habilitados").limit(1),
    admin.from("consultas_controles").select("*").eq("empresa_id", pet.empresa_id)
      .eq("mascota_id", pet.id).order("fecha_registro", { ascending: false }).limit(1),
    admin.from("consultas_controles").select("*").eq("empresa_id", pet.empresa_id)
      .eq("mascota_id", pet.id).eq("procedimientos_habilitados", true)
      .order("fecha_registro", { ascending: false }).limit(1),
    admin.from("consultas_controles").select("*").eq("empresa_id", pet.empresa_id)
      .eq("mascota_id", pet.id).contains("tipos_procedimiento", ["Tratamiento farmacológico en casa"])
      .order("fecha_registro", { ascending: false }).limit(1)
  ]);
  const veterinarians = [...(veterinariansResult.data || [])];
  if (profile.rol === "super_admin" && !veterinarians.some((vet) => vet.id === profile.id)) {
    veterinarians.unshift({
      id: profile.id,
      nombre: profile.nombre,
      rol: profile.rol,
      empresa_id: null
    });
  }
  const historyAvailable = !consultationsResult.error;
  const consultations = consultationsResult.data || [];
  const owners = (pet.propietarios_mascotas || []).map((relation) => relation.propietarios).filter(Boolean);
  const details = [
    ["Número de carnet", pet.numero_carnet],
    ["Especie", pet.especie],
    ["Raza", pet.raza],
    ["Sexo", pet.sexo],
    ["Peso", pet.peso_kg !== null ? `${pet.peso_kg} kg` : null],
    ["Tamaño", pet.tamano],
    ["Fecha de nacimiento", formatDate(pet.fecha_nacimiento)],
    ["Color", pet.color],
    ["Temperamento", pet.temperamento],
    ["Estado reproductivo", pet.estado_reproductivo],
    ["Número de partos", pet.numero_partos],
    ["Estado", pet.estado],
    ["SEDE", pet.fuente],
    ["Fecha de fallecimiento", formatDate(pet.fecha_fallecimiento)],
    ["Motivo de fallecimiento", pet.motivo_fallecimiento],
    ["Comentarios del fallecimiento", pet.comentarios_fallecimiento]
  ];

  return (
    <main className="dashboardShell">
      <DashboardHeader profile={profile} context={profile.rol === "super_admin" ? "Superadministrador" : "Operación"} active="mascotas" />
      <section className="dashboardContent wideContent">
        <Link className="backLink" href="/mascotas">← Volver a mascotas</Link>
        <div className="recordHeading">
          <div>
            <p className="eyebrow">Ficha de mascota</p>
            <h1>{pet.nombre}</h1>
            <p className="description">SEDE: {pet.fuente || "Sin sede registrada"}</p>
          </div>
          <span className={pet.fecha_fallecimiento ? "badgeInactive" : "badgeActive"}>
            {pet.estado || (pet.fecha_fallecimiento ? "Fallecido" : "Activo")}
          </span>
        </div>

        <ConsultationControlPanel
          pet={{
            id: pet.id,
            nombre: pet.nombre,
            numero_carnet: pet.numero_carnet,
            especie: pet.especie,
            raza: pet.raza,
            sexo: pet.sexo,
            fecha_nacimiento_formateada: formatDate(pet.fecha_nacimiento),
            estado_reproductivo: pet.estado_reproductivo,
            color: pet.color,
            peso_kg: pet.peso_kg,
            propietarios: owners.map((owner) => owner.nombre)
          }}
          veterinarians={veterinarians}
          actor={{ id: profile.id, nombre: profile.nombre, rol: profile.rol }}
          consultations={consultations}
          latestConsultation={latestResult.data?.[0] || null}
          latestProcedure={latestProcedureResult.data?.[0] || null}
          latestFormula={latestFormulaResult.data?.[0] || null}
          historyOpen={historyOpen}
          historyPage={historyPage}
          historyTotal={consultationsResult.count || 0}
          historyFrom={historyFrom}
          historyTo={historyTo}
          historyAvailable={historyAvailable}
          procedureSchemaReady={!procedureSchemaResult.error}
          recordedAt={new Date().toISOString()}
          initialModule={queryParams?.modulo === "consulta-control" ? "consulta-control" : "historia"}
          initialView={queryParams?.vista === "nueva" ? "new" : "history"}
          success={queryParams?.ok || ""}
          error={queryParams?.error || ""}
        />

        <section className="recordSection">
          <p className="eyebrow">Información general</p>
          <h2>Detalles de la mascota</h2>
          <dl className="detailGrid">
            {details.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === "" ? "—" : value}</dd></div>
            ))}
          </dl>
        </section>

        <PetEditForm pet={pet} editing={queryParams?.editar === "1"} error={queryParams?.error_perfil === "1"} success={queryParams?.perfil_actualizado === "1"} />

        <section className="recordSection">
          <p className="eyebrow">Relaciones</p>
          <h2>Propietarios asociados</h2>
          <div className="associationGrid">
            {owners.length ? owners.map((owner) => (
              <Link className="associationCard" href={`/propietarios/${owner.id}`} key={owner.id}>
                <strong>{owner.nombre}</strong>
                <span>{owner.whatsapp || owner.telefono || "Sin teléfono"}</span>
                <small>{owner.email || owner.numero_documento || "Ver propietario"}</small>
              </Link>
            )) : <div className="emptyState"><h2>Sin propietarios asociados</h2><p>Esta mascota todavía no tiene propietarios vinculados.</p></div>}
          </div>
        </section>
      </section>
    </main>
  );
}
