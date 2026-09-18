import { checkSupabaseConnection } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function getConnectionState() {
  try {
    await checkSupabaseConnection();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export default async function HomePage() {
  const connection = await getConnectionState();

  return (
    <main className="shell">
      <section className="card">
        <div className="brand">PETS</div>
        <p className="eyebrow">Panel administrativo</p>
        <h1>Base segura para gestionar propietarios y mascotas</h1>
        <p className="description">
          La aplicación ya está preparada para comunicarse con Supabase desde
          el servidor de Vercel. La clave administrativa nunca se envía al
          navegador.
        </p>

        <div className={`status ${connection.ok ? "success" : "error"}`}>
          <span className="statusDot" aria-hidden="true" />
          <div>
            <strong>
              {connection.ok
                ? "Conexión con Supabase activa"
                : "No fue posible conectar con Supabase"}
            </strong>
            <p>
              {connection.ok
                ? "Vercel puede acceder de forma privada al proyecto."
                : "Revisa SUPABASE_URL y SUPABASE_SECRET_KEY en Vercel y vuelve a desplegar."}
            </p>
          </div>
        </div>

        <div className="nextStep">
          <span>Próximo paso</span>
          <p>
            Configurar el acceso de administradores y conectar las tablas que
            se editarán desde este panel.
          </p>
        </div>
      </section>
    </main>
  );
}
