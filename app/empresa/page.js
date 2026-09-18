import { logout } from "@/app/actions";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CompanyPage() {
  const profile = await requireProfile(["empresa_admin", "veterinario"]);
  const supabase = await createSupabaseServerClient();

  const [{ data: company }, { count: petCount }, { count: userCount }] =
    await Promise.all([
      supabase
        .from("empresas")
        .select("id, nombre, activa")
        .eq("id", profile.empresa_id)
        .single(),
      supabase
        .from("mascotas")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("usuarios")
        .select("id", { count: "exact", head: true })
    ]);

  return (
    <main className="dashboardShell">
      <header className="dashboardHeader">
        <div>
          <div className="brand">PETS</div>
          <p>{company?.nombre || "Empresa"}</p>
        </div>
        <div className="userMenu">
          <span>{profile.nombre}</span>
          <form action={logout}>
            <button className="buttonSecondary">Cerrar sesión</button>
          </form>
        </div>
      </header>

      <section className="dashboardContent">
        <p className="eyebrow">
          {profile.rol === "empresa_admin" ? "Administrador de empresa" : "Veterinario"}
        </p>
        <h1>Panel de {company?.nombre || "empresa"}</h1>
        <p className="description">
          Solo puedes consultar información perteneciente a esta empresa.
        </p>

        <div className="statsGrid">
          <article className="statCard">
            <span>Mascotas</span>
            <strong>{petCount || 0}</strong>
          </article>
          {profile.rol === "empresa_admin" ? (
            <article className="statCard">
              <span>Usuarios</span>
              <strong>{userCount || 0}</strong>
            </article>
          ) : null}
        </div>
      </section>
    </main>
  );
}
