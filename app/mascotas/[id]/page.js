import Link from "next/link";
import { notFound } from "next/navigation";

import DashboardHeader from "@/components/dashboard-header";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatDate, requireOperationalProfile } from "@/lib/operational";

const clinicalModules = [
  "Historia del paciente",
  "Consulta y control",
  "Fórmula y remisión",
  "Procedimientos",
  "Vacunación",
  "Desparasitación",
  "Estética",
  "Guardería",
  "Seguimiento",
  "Consentimientos"
];

export default async function PetDetailPage({ params }) {
  const profile = await requireOperationalProfile();
  const { id } = await params;
  const admin = getSupabaseAdmin();
  let query = admin
    .from("mascotas")
    .select(`*, empresas(nombre), propietarios_mascotas(propietarios(id, nombre, telefono, whatsapp, email, numero_documento))`)
    .eq("id", id);
  if (profile.rol !== "super_admin") query = query.eq("empresa_id", profile.empresa_id);
  const { data: pet } = await query.maybeSingle();
  if (!pet) notFound();

  const owners = (pet.propietarios_mascotas || []).map((relation) => relation.propietarios).filter(Boolean);
  const details = [
    ["Número de carnet", pet.numero_carnet],
    ["Especie", pet.especie],
    ["Raza", pet.raza],
    ["Sexo", pet.sexo],
    ["Peso", pet.peso_kg !== null ? `${pet.peso_kg} kg` : null],
    ["Fecha de nacimiento", formatDate(pet.fecha_nacimiento)],
    ["Color", pet.color],
    ["Temperamento", pet.temperamento],
    ["Estado reproductivo", pet.estado_reproductivo],
    ["Número de partos", pet.numero_partos],
    ["Estado", pet.estado],
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
            <p className="description">{pet.empresas?.nombre || ""}</p>
          </div>
          <span className={pet.fecha_fallecimiento ? "badgeInactive" : "badgeActive"}>
            {pet.fecha_fallecimiento ? "Fallecido" : pet.estado || "Activo"}
          </span>
        </div>

        <nav className="clinicalModules" aria-label="Módulos clínicos">
          {clinicalModules.map((module, index) => (
            <button className={index === 0 ? "active" : ""} type="button" key={module}>{module}</button>
          ))}
        </nav>

        <section className="recordSection">
          <p className="eyebrow">Información general</p>
          <h2>Detalles de la mascota</h2>
          <dl className="detailGrid">
            {details.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === "" ? "—" : value}</dd></div>
            ))}
          </dl>
        </section>

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
