import Link from "next/link";
import { notFound } from "next/navigation";

import { logout } from "@/app/actions";
import { requireProfile } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createCompanyAdmin,
  resetCompanyUserPassword,
  setCompanyUserStatus
} from "./actions";

const successMessages = {
  usuario_creado: "Administrador creado correctamente.",
  password: "La contraseña fue reemplazada.",
  estado: "El estado del usuario fue actualizado."
};

export default async function CompanyDetailPage({ params, searchParams }) {
  const profile = await requireProfile(["super_admin"]);
  const { id } = await params;
  const query = await searchParams;
  const admin = getSupabaseAdmin();

  const [{ data: company }, { data: users = [] }, { count: petCount }, { count: ownerCount }] =
    await Promise.all([
      admin.from("empresas").select("id, nombre, activa").eq("id", id).maybeSingle(),
      admin
        .from("usuarios")
        .select("id, nombre, email, rol, activo, created_at")
        .eq("empresa_id", id)
        .order("created_at"),
      admin.from("mascotas").select("id", { count: "exact", head: true }).eq("empresa_id", id),
      admin.from("propietarios").select("id", { count: "exact", head: true }).eq("empresa_id", id)
    ]);

  if (!company) notFound();

  return (
    <main className="dashboardShell">
      <header className="dashboardHeader">
        <div>
          <div className="brand">PETS</div>
          <p>Superadministrador</p>
        </div>
        <div className="userMenu">
          <span>{profile.nombre}</span>
          <form action={logout}>
            <button className="buttonSecondary">Cerrar sesión</button>
          </form>
        </div>
      </header>

      <section className="dashboardContent">
        <Link className="backLink" href="/super-admin">← Volver a empresas</Link>
        <p className="eyebrow">Detalle de empresa</p>
        <h1>{company.nombre}</h1>

        {query?.ok && successMessages[query.ok] ? (
          <div className="successAlert topAlert">{successMessages[query.ok]}</div>
        ) : null}
        {query?.error ? (
          <div className="formAlert topAlert">
            No fue posible completar la operación. Revisa los datos; el correo podría estar registrado.
          </div>
        ) : null}

        <div className="statsGrid compactStats">
          <article className="statCard"><span>Usuarios</span><strong>{users.length}</strong></article>
          <article className="statCard"><span>Mascotas</span><strong>{petCount || 0}</strong></article>
          <article className="statCard"><span>Propietarios</span><strong>{ownerCount || 0}</strong></article>
        </div>

        <section className="managementSection">
          <div>
            <p className="eyebrow">Nuevo acceso</p>
            <h2>Crear administrador de empresa</h2>
          </div>
          <form action={createCompanyAdmin} className="managementForm">
            <input type="hidden" name="empresa_id" value={company.id} />
            <label>Nombre completo<input name="nombre" minLength={2} maxLength={120} required /></label>
            <label>Correo electrónico<input name="email" type="email" required /></label>
            <label>Contraseña definitiva<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
            <button type="submit">Crear administrador</button>
          </form>
        </section>

        <section className="managementSection">
          <div>
            <p className="eyebrow">Control de acceso</p>
            <h2>Usuarios de la empresa</h2>
          </div>

          <div className="userList">
            {users.length ? users.map((user) => (
              <article className="userRow" key={user.id}>
                <div className="userIdentity">
                  <strong>{user.nombre}</strong>
                  <span>{user.email}</span>
                  <small>{user.rol === "empresa_admin" ? "Administrador" : "Veterinario"}</small>
                </div>
                <div className="userActions">
                  <span className={user.activo ? "badgeActive" : "badgeInactive"}>
                    {user.activo ? "Activo" : "Inactivo"}
                  </span>
                  <details>
                    <summary>Cambiar contraseña</summary>
                    <form action={resetCompanyUserPassword} className="smallActionForm">
                      <input type="hidden" name="empresa_id" value={company.id} />
                      <input type="hidden" name="usuario_id" value={user.id} />
                      <input name="password" type="password" minLength={8} placeholder="Nueva contraseña" required />
                      <button type="submit">Guardar</button>
                    </form>
                  </details>
                  <form action={setCompanyUserStatus}>
                    <input type="hidden" name="empresa_id" value={company.id} />
                    <input type="hidden" name="usuario_id" value={user.id} />
                    <input type="hidden" name="activo" value={String(!user.activo)} />
                    <button className="buttonSecondary" type="submit">
                      {user.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>
              </article>
            )) : (
              <div className="emptyState">
                <h2>No hay usuarios</h2>
                <p>Crea el primer administrador de esta empresa.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
