import Link from "next/link";

import DashboardHeader from "@/components/dashboard-header";
import Pagination from "@/components/pagination";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  applyCompanyScope,
  requireOperationalProfile,
  sanitizeSearch
} from "@/lib/operational";
import { importOwners } from "./actions";

const allowedLimits = [10, 25, 50, 100];
const allowedSorts = new Set(["nombre", "ciudad", "numero_documento", "estado"]);

function getPets(owner) {
  return (owner.propietarios_mascotas || []).map((relation) => relation.mascotas).filter(Boolean);
}

export default async function OwnersPage({ searchParams }) {
  const profile = await requireOperationalProfile();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params?.page || "1", 10) || 1);
  const requestedLimit = Number.parseInt(params?.limit || "10", 10);
  const limit = allowedLimits.includes(requestedLimit) ? requestedLimit : 10;
  const q = sanitizeSearch(params?.q);
  const sort = allowedSorts.has(params?.sort) ? params.sort : "nombre";
  const dir = params?.dir === "desc" ? "desc" : "asc";
  const offset = (page - 1) * limit;
  const admin = getSupabaseAdmin();

  let query = admin
    .from("propietarios")
    .select(
      `id, empresa_id, nombre, ciudad, direccion, telefono, whatsapp, email,
       tipo_documento, numero_documento, estado, notificaciones_whatsapp, tags,
       empresas(nombre),
       propietarios_mascotas(mascotas(id, nombre, numero_carnet))`,
      { count: "exact" }
    );
  query = applyCompanyScope(query, profile);
  if (q) {
    query = query.or(`nombre.ilike.%${q}%,numero_documento.ilike.%${q}%,telefono.ilike.%${q}%,whatsapp.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: owners = [], count = 0 } = await query
    .order(sort, { ascending: dir === "asc", nullsFirst: false })
    .range(offset, offset + limit - 1);
  const companies = profile.rol === "super_admin"
    ? (await admin.from("empresas").select("id, nombre").eq("activa", true).order("nombre")).data || []
    : [];
  const totalPages = Math.max(1, Math.ceil((count || 0) / limit));

  return (
    <main className="dashboardShell">
      <DashboardHeader profile={profile} context={profile.rol === "super_admin" ? "Superadministrador" : "Operación"} active="propietarios" />
      <section className="dashboardContent wideContent">
        <div className="listTitleRow">
          <div>
            <p className="eyebrow">Gestión operativa</p>
            <h1>Propietarios</h1>
            <p className="description">Consulta propietarios y sus mascotas asociadas.</p>
          </div>
          <div className="listActions">
            <Link className="actionLink" href="/api/export/propietarios">Descargar Excel</Link>
            {profile.rol === "super_admin" ? (
              <details className="uploadPanel">
                <summary>Subir Excel</summary>
                <form action={importOwners} className="uploadForm">
                  <label>Empresa
                    <select name="empresa_id" required defaultValue="">
                      <option value="" disabled>Selecciona una empresa</option>
                      {companies.map((company) => <option key={company.id} value={company.id}>{company.nombre}</option>)}
                    </select>
                  </label>
                  <label>Archivo .xlsx<input name="archivo" type="file" accept=".xlsx" required /></label>
                  <button type="submit">Importar propietarios</button>
                  <small>“Números de carnet” puede contener varios valores separados por coma.</small>
                </form>
              </details>
            ) : null}
          </div>
        </div>

        {params?.ok === "importado" ? <div className="successAlert">Archivo importado correctamente.</div> : null}
        {params?.error ? <div className="formAlert">No fue posible importar el archivo. Revisa el formato y vuelve a intentarlo.</div> : null}

        <div className="tableToolbar">
          <form className="rowsForm">
            <label>Mostrar<select name="limit" defaultValue={String(limit)}>{allowedLimits.map((value) => <option key={value} value={value}>{value}</option>)}</select> registros por página</label>
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <button className="buttonSecondary" type="submit">Aplicar</button>
          </form>
          <form className="searchForm">
            <label>Buscar:<input name="q" defaultValue={q} /></label>
            <input type="hidden" name="limit" value={limit} />
            <button type="submit">Buscar</button>
          </form>
        </div>

        <div className="dataTableWrap">
          <table className="dataTable">
            <thead><tr>
              <th>Nombre</th><th>Documento</th><th>Ciudad</th><th>Teléfono</th><th>WhatsApp</th><th>Email</th><th>Mascotas / carnets</th>
              {profile.rol === "super_admin" ? <th>Empresa</th> : null}<th>Estado</th><th>Acciones</th>
            </tr></thead>
            <tbody>
              {owners.length ? owners.map((owner) => {
                const pets = getPets(owner);
                return <tr key={owner.id}>
                  <td><Link href={`/propietarios/${owner.id}`}>{owner.nombre}</Link></td>
                  <td>{[owner.tipo_documento, owner.numero_documento].filter(Boolean).join(" ") || "—"}</td>
                  <td>{owner.ciudad || "—"}</td><td>{owner.telefono || "—"}</td><td>{owner.whatsapp || "—"}</td><td>{owner.email || "—"}</td>
                  <td>{pets.length ? pets.map((pet, index) => <span key={pet.id}>{index ? ", " : ""}<Link href={`/mascotas/${pet.id}`}>{pet.nombre} ({pet.numero_carnet || "sin carnet"})</Link></span>) : "Sin mascotas"}</td>
                  {profile.rol === "super_admin" ? <td>{owner.empresas?.nombre || "—"}</td> : null}
                  <td>{owner.estado || "Activo"}</td>
                  <td><Link className="tableAction" href={`/propietarios/${owner.id}`}>Ver ficha</Link></td>
                </tr>;
              }) : <tr><td className="tableEmpty" colSpan={profile.rol === "super_admin" ? 10 : 9}>No hay propietarios para mostrar.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="tableFooter"><span>{count || 0} propietarios</span></div>
        <Pagination basePath="/propietarios" page={Math.min(page, totalPages)} totalPages={totalPages} query={{ q, limit, sort, dir }} />
      </section>
    </main>
  );
}
