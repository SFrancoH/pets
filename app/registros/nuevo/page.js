import Link from "next/link";

import CarnetGenerator from "@/components/carnet-generator";
import DashboardHeader from "@/components/dashboard-header";
import { requireOperationalProfile } from "@/lib/operational";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createPendingPetRegistration } from "./actions";

const documentTypes = [
  "Cédula de ciudadania",
  "Cédula extranjera",
  "NIT",
  "RUT",
  "CURP",
  "Tarjeta de identidad nacional",
  "Pasaporte",
  "Documento de identidad internacional"
];

const errorMessages = {
  empresa: "Selecciona una empresa válida.",
  propietario: "Completa nombre, WhatsApp y correo electrónico del propietario.",
  mascota: "Completa nombre, especie y número de carnet de la mascota.",
  carnet: "El carnet debe contener exactamente 14 números.",
  carnet_repetido: "Ese número de carnet ya está en uso. Genera uno nuevo.",
  documento: "Completa el tipo y el número de documento.",
  notificaciones: "Selecciona Sí o No en ambos permisos de recordatorios.",
  integracion: "La empresa todavía no tiene configurado su formulario de confirmación.",
  guardar: "No fue posible guardar el registro pendiente. Inténtalo nuevamente."
};

export default async function NewRegistrationPage({ searchParams }) {
  const profile = await requireOperationalProfile();
  const params = await searchParams;
  const admin = getSupabaseAdmin();
  const companies = profile.rol === "super_admin"
    ? (await admin.from("empresas").select("id, nombre").eq("activa", true).order("nombre")).data || []
    : [];

  return (
    <main className="dashboardShell">
      <DashboardHeader profile={profile} context={profile.rol === "super_admin" ? "Superadministrador" : "Operación"} active="registro" />
      <section className="dashboardContent registrationContent">
        <Link className="backLink" href="/mascotas">← Volver a mascotas</Link>
        <p className="eyebrow">Nuevo registro</p>
        <h1>Propietario y mascota</h1>
        <p className="description">Guarda la mascota en PETS y revisa los datos del propietario antes de confirmar su creación.</p>

        {params?.error ? <div className="formAlert">{errorMessages[params.error] || errorMessages.guardar}</div> : null}

        <form action={createPendingPetRegistration} className="registrationForm">
          {profile.rol === "super_admin" ? (
            <section className="registrationSection">
              <h2>Empresa</h2>
              <label>Empresa<select name="empresa_id" required defaultValue=""><option value="" disabled>Selecciona una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.nombre}</option>)}</select></label>
            </section>
          ) : null}

          <section className="registrationSection">
            <div className="sectionHeading"><div><span>1</span><h2>Datos del propietario</h2></div><small>Estos datos pasarán al formulario de confirmación.</small></div>
            <div className="registrationGrid">
              <label>Nombre<input name="nombre" maxLength={80} required /></label>
              <label>Apellido<input name="apellido" maxLength={80} /></label>
              <label>WhatsApp<input name="whatsapp" type="tel" maxLength={40} required /></label>
              <label>Teléfono alterno<input name="telefono" type="tel" maxLength={40} /></label>
              <label>Correo electrónico<input name="correo_electronico" type="email" maxLength={160} required /></label>
              <label>Ciudad<input name="ciudad" maxLength={100} /></label>
              <label className="fullField">Dirección<input name="direccion" maxLength={220} /></label>
              <label>Tipo de documento<select name="tipo_documento" required defaultValue=""><option value="" disabled>Selecciona una opción</option>{documentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Número de documento<input name="numero_documento" maxLength={80} required /></label>
              <fieldset className="choiceField"><legend>¿Acepta recordatorios por correo electrónico?</legend><label><input type="radio" name="notificacion_email" value="Si" required /> Sí</label><label><input type="radio" name="notificacion_email" value="No" required /> No</label></fieldset>
              <fieldset className="choiceField"><legend>¿Acepta recordatorios por WhatsApp?</legend><label><input type="radio" name="notificacion_whatsapp" value="Si" required /> Sí</label><label><input type="radio" name="notificacion_whatsapp" value="No" required /> No</label></fieldset>
            </div>
          </section>

          <section className="registrationSection">
            <div className="sectionHeading"><div><span>2</span><h2>Datos de la mascota</h2></div><small>La mascota se guardará únicamente en PETS.</small></div>
            <div className="registrationGrid">
              <label>Nombre<input name="mascota_nombre" maxLength={120} required /></label>
              <label>Especie<input name="especie" maxLength={80} required /></label>
              <label>Raza<input name="raza" maxLength={120} /></label>
              <label>Sexo<select name="sexo" defaultValue=""><option value="">Selecciona una opción</option><option>Hembra</option><option>Macho</option><option>Sin determinar</option></select></label>
              <label>Fecha de nacimiento<input name="fecha_nacimiento" type="date" /></label>
              <label>Color<input name="color" maxLength={80} /></label>
              <label>Peso (kg)<input name="peso_kg" type="number" min="0" step="0.01" /></label>
              <label>Temperamento<input name="temperamento" maxLength={120} /></label>
              <label>Estado reproductivo<input name="estado_reproductivo" maxLength={100} /></label>
              <label>Número de partos<input name="numero_partos" type="number" min="0" step="1" /></label>
              <label className="carnetField">Número de carnet<div><input id="numero_carnet" name="numero_carnet" inputMode="numeric" pattern="[0-9]{14}" maxLength={14} required /><CarnetGenerator /></div><small>Formato automático: día, mes, año, hora, minuto y segundo de Bogotá.</small></label>
            </div>
          </section>

          <div className="registrationActions"><Link className="secondaryLink" href="/mascotas">Cancelar</Link><button type="submit">Continuar a confirmación</button></div>
        </form>
      </section>
    </main>
  );
}
