"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { createConsultation } from "@/app/mascotas/[id]/actions";
import {
  administrationRoutes,
  medicationFrequencies,
  medications as medicationCatalog,
  procedureTypes
} from "@/lib/clinical-catalogs";

const modules = [
  ["historia", "Historia del paciente"],
  ["consulta-control", "Consulta y control"],
  ["formula", "Fórmula y remisión"],
  ["procedimientos", "Procedimientos"],
  ["vacunacion", "Vacunación"],
  ["desparasitacion", "Desparasitación"],
  ["estetica", "Estética"],
  ["guarderia", "Guardería"],
  ["seguimiento", "Seguimiento"],
  ["consentimientos", "Consentimientos"]
];

const systems = [
  ["organos_sentidos", "Órganos de los sentidos"],
  ["ganglios_linfaticos", "Ganglios linfáticos"],
  ["sistema_respiratorio", "Sistema respiratorio"],
  ["sistema_cardiovascular", "Sistema cardiovascular"],
  ["sistema_digestivo", "Sistema digestivo"],
  ["sistema_musculo_esqueletico", "Sistema músculo esquelético"],
  ["piel_pelaje", "Piel y pelaje"],
  ["sistema_neurologico", "Sistema neurológico"],
  ["sistema_urinario", "Sistema urinario"],
  ["sistema_reproductivo", "Sistema reproductivo"]
];

const narrativeSections = [
  ["lista_problemas", "Lista de problemas"],
  ["diagnostico_diferencial", "Diagnóstico diferencial"],
  ["diagnostico_presuntivo", "Diagnóstico presuntivo"],
  ["examenes_laboratorio", "Exámenes de laboratorio solicitados"],
  ["imagenes_diagnosticas", "Imágenes diagnósticas"],
  ["diagnostico_definitivo", "Diagnóstico definitivo"],
  ["tratamiento", "Tratamiento"],
  ["pronostico", "Pronóstico"],
  ["notas", "Notas"]
];

const systemLabels = Object.fromEntries(systems);

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(new Date(value));
}

function responsibilityText(name) {
  return `El propietario no cuenta con los recursos económicos y/o no acepta que se realicen las pruebas paraclínicas necesarias para instaurar una terapia, y/o no acepta hospitalización en caso de que se requiera. Por lo tanto, el Dr. ${name} no se hace responsable del paciente, en virtud de que el propietario y/o usuario del servicio no puede cumplir con las recomendaciones indicadas. De esta manera, el propietario y/o usuario del servicio acepta la responsabilidad del paciente.`;
}

function SubmitConsultationButton({ disabled }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? <span className="buttonSpinner" aria-hidden="true" /> : null}
      {pending ? "Guardando consulta..." : "Guardar consulta"}
    </button>
  );
}

function ReadonlyField({ label, value }) {
  return (
    <label>
      <span>{label}</span>
      <input value={value || "Sin información"} readOnly />
    </label>
  );
}

function newMedicationRow(id) {
  return {
    id,
    medicamento: "",
    medicamento_otro: "",
    dosis_terapeutica: "",
    via_administracion: "",
    via_administracion_otra: "",
    frecuencia: "",
    frecuencia_otra: "",
    cantidad_total: "1"
  };
}

function ProcedureBlock({ pet, actor, recordedAt }) {
  const [enabled, setEnabled] = useState("si");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [medicationRows, setMedicationRows] = useState([newMedicationRow(1)]);
  const homeTreatmentSelected = selectedTypes.includes("Tratamiento farmacológico en casa");

  function toggleType(type, checked) {
    setSelectedTypes((current) => checked
      ? [...current, type]
      : current.filter((value) => value !== type));
  }

  function updateMedication(id, field, value) {
    setMedicationRows((current) => current.map((row) => (
      row.id === id ? { ...row, [field]: value } : row
    )));
  }

  function addMedication() {
    setMedicationRows((current) => [
      ...current,
      newMedicationRow(Math.max(...current.map((row) => row.id), 0) + 1)
    ]);
  }

  function removeMedication(id) {
    setMedicationRows((current) => current.length > 1
      ? current.filter((row) => row.id !== id)
      : current);
  }

  return (
    <details className="clinicalBlock" open>
      <summary>Procedimientos</summary>
      <div className="clinicalBlockContent procedureBlockContent">
        <fieldset className="procedureToggle">
          <legend>¿Se realizaron procedimientos?</legend>
          <div className="radioRow">
            <label>
              <input
                type="radio"
                name="procedimientos_habilitados"
                value="si"
                checked={enabled === "si"}
                onChange={() => setEnabled("si")}
              />
              Sí
            </label>
            <label>
              <input
                type="radio"
                name="procedimientos_habilitados"
                value="no"
                checked={enabled === "no"}
                onChange={() => {
                  setEnabled("no");
                  setSelectedTypes([]);
                }}
              />
              No
            </label>
          </div>
        </fieldset>

        {enabled === "si" ? (
          <>
            <div className="formGrid procedureMetaGrid">
              <label>
                <span>Área de consulta</span>
                <select name="area_consulta" defaultValue="" required>
                  <option value="" disabled>Selecciona una opción</option>
                  <option value="Medicación">Medicación</option>
                  <option value="Hospitalización">Hospitalización</option>
                </select>
              </label>
              <label>
                <span>Valor total del servicio</span>
                <input name="valor_total_servicio" type="number" min="0" step="0.01" defaultValue="0" />
              </label>
            </div>

            <fieldset className="procedureChoices">
              <legend>Tipo de procedimiento</legend>
              <div className="procedureChoiceGrid">
                {procedureTypes.map((type) => (
                  <label key={type}>
                    <input
                      type="checkbox"
                      name="tipos_procedimiento"
                      value={type}
                      checked={selectedTypes.includes(type)}
                      onChange={(event) => toggleType(type, event.target.checked)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="stackedField">
              <span>Observaciones</span>
              <textarea name="observaciones_procedimiento" rows="4" />
            </label>

            {homeTreatmentSelected ? (
              <section className="prescriptionCard" aria-labelledby="prescription-title">
                <div className="prescriptionHeading">
                  <div>
                    <p className="eyebrow">Tratamiento farmacológico en casa</p>
                    <h3 id="prescription-title">Registrar fórmula</h3>
                  </div>
                  <span>Médico veterinario: <strong>{actor.nombre}</strong></span>
                </div>

                <div className="prescriptionPatientGrid">
                  <ReadonlyField label="Número de historia" value={pet.numero_carnet} />
                  <ReadonlyField label="Fecha de registro" value={formatDateTime(recordedAt)} />
                  <ReadonlyField label="Propietario" value={pet.propietarios?.join(", ")} />
                  <ReadonlyField label="Mascota" value={pet.nombre} />
                  <ReadonlyField label="Especie" value={pet.especie} />
                  <ReadonlyField label="Raza" value={pet.raza} />
                  <ReadonlyField label="Sexo" value={pet.sexo} />
                  <ReadonlyField label="Peso actual" value={pet.peso_kg !== null ? `${pet.peso_kg} kg` : null} />
                </div>

                <label className="stackedField prescriptionDescription">
                  <span>Descripción</span>
                  <textarea name="formula_descripcion" rows="4" placeholder="Indicaciones generales para el tratamiento en casa" />
                </label>

                <input
                  type="hidden"
                  name="formula_medicamentos"
                  value={JSON.stringify(medicationRows.map(({ id, ...row }) => row))}
                />

                <div className="medicationList">
                  {medicationRows.map((row, index) => (
                    <div className="medicationRow" key={row.id}>
                      <div className="medicationRowHeading">
                        <strong>Medicamento {index + 1}</strong>
                        {medicationRows.length > 1 ? (
                          <button
                            className="removeMedicationButton"
                            type="button"
                            onClick={() => removeMedication(row.id)}
                            aria-label={`Eliminar medicamento ${index + 1}`}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                      <div className="medicationFields">
                        <label className="medicationNameField">
                          <span>Medicamento</span>
                          <select
                            value={row.medicamento}
                            onChange={(event) => updateMedication(row.id, "medicamento", event.target.value)}
                            required
                          >
                            <option value="" disabled>Selecciona un medicamento</option>
                            {medicationCatalog.map((medication) => (
                              <option key={medication} value={medication}>{medication}</option>
                            ))}
                          </select>
                        </label>
                        {row.medicamento === "Otro" ? (
                          <label>
                            <span>Otro medicamento</span>
                            <input
                              value={row.medicamento_otro}
                              onChange={(event) => updateMedication(row.id, "medicamento_otro", event.target.value)}
                              placeholder="Nombre del medicamento"
                              required
                            />
                          </label>
                        ) : null}
                        <label>
                          <span>Dosis terapéutica</span>
                          <input
                            value={row.dosis_terapeutica}
                            onChange={(event) => updateMedication(row.id, "dosis_terapeutica", event.target.value)}
                            placeholder="Ej. 1 tableta"
                            required
                          />
                        </label>
                        <label>
                          <span>Vía de administración</span>
                          <select
                            value={row.via_administracion}
                            onChange={(event) => updateMedication(row.id, "via_administracion", event.target.value)}
                            required
                          >
                            <option value="" disabled>Selecciona la vía</option>
                            {administrationRoutes.map((route) => <option key={route} value={route}>{route}</option>)}
                          </select>
                        </label>
                        {row.via_administracion === "Otra" ? (
                          <label>
                            <span>Otra vía</span>
                            <input
                              value={row.via_administracion_otra}
                              onChange={(event) => updateMedication(row.id, "via_administracion_otra", event.target.value)}
                              placeholder="Especifica la vía"
                              required
                            />
                          </label>
                        ) : null}
                        <label>
                          <span>Frecuencia</span>
                          <select
                            value={row.frecuencia}
                            onChange={(event) => updateMedication(row.id, "frecuencia", event.target.value)}
                            required
                          >
                            <option value="" disabled>Selecciona la frecuencia</option>
                            {medicationFrequencies.map((frequency) => (
                              <option key={frequency} value={frequency}>{frequency}</option>
                            ))}
                          </select>
                        </label>
                        {row.frecuencia === "Otra" ? (
                          <label>
                            <span>Otra frecuencia</span>
                            <input
                              value={row.frecuencia_otra}
                              onChange={(event) => updateMedication(row.id, "frecuencia_otra", event.target.value)}
                              placeholder="Especifica la frecuencia"
                              required
                            />
                          </label>
                        ) : null}
                        <label>
                          <span>Cantidad total</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={row.cantidad_total}
                            onChange={(event) => updateMedication(row.id, "cantidad_total", event.target.value)}
                            required
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="addMedicationButton" type="button" onClick={addMedication}>
                  + Agregar otro medicamento
                </button>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </details>
  );
}

function ClinicalForm({
  pet,
  veterinarians,
  actor,
  recordedAt,
  procedureSchemaReady,
  onCancel
}) {
  const [foodType, setFoodType] = useState("");
  const [stoolType, setStoolType] = useState("");
  const [observation, setObservation] = useState("no");
  const [systemStatus, setSystemStatus] = useState(
    () => Object.fromEntries(systems.map(([key]) => [key, "Normal"]))
  );
  const action = useMemo(() => createConsultation.bind(null, pet.id), [pet.id]);
  const defaultVeterinarianId = veterinarians.some((vet) => vet.id === actor.id)
    ? actor.id
    : veterinarians[0]?.id || "";

  return (
    <form action={action} className="clinicalForm">
      <div className="clinicalFormHeading">
        <div>
          <p className="eyebrow">Historia clínica</p>
          <h2>Nueva consulta o control</h2>
          <p>Fecha de registro: <strong>{formatDateTime(recordedAt)}</strong></p>
        </div>
        <button className="buttonSecondary" type="button" onClick={onCancel}>Cancelar</button>
      </div>

      <details className="clinicalBlock" open>
        <summary>Datos de la mascota</summary>
        <div className="clinicalBlockContent patientDataBlock">
          <ReadonlyField label="Nombre" value={pet.nombre} />
          <ReadonlyField label="Número de carnet" value={pet.numero_carnet} />
          <ReadonlyField label="Especie" value={pet.especie} />
          <ReadonlyField label="Raza" value={pet.raza} />
          <ReadonlyField label="Sexo" value={pet.sexo} />
          <ReadonlyField label="Fecha de nacimiento" value={pet.fecha_nacimiento_formateada} />
          <ReadonlyField label="Estado reproductivo" value={pet.estado_reproductivo} />
          <ReadonlyField label="Color" value={pet.color} />
          <ReadonlyField label="Peso registrado" value={pet.peso_kg !== null ? `${pet.peso_kg} kg` : null} />
        </div>
      </details>

      <details className="clinicalBlock" open>
        <summary>Motivo de consulta</summary>
        <div className="clinicalBlockContent formGrid">
          <label>
            <span>Tipo de servicio</span>
            <select name="tipo_servicio" required defaultValue="">
              <option value="" disabled>Selecciona una opción</option>
              <option value="Consulta">Consulta</option>
              <option value="Control">Control</option>
            </select>
          </label>
          <label>
            <span>Médico veterinario</span>
            <select name="medico_veterinario_id" required defaultValue={defaultVeterinarianId}>
              {!veterinarians.length ? <option value="">No hay veterinarios activos</option> : null}
              {veterinarians.map((vet) => (
                <option key={vet.id} value={vet.id}>{vet.nombre}</option>
              ))}
            </select>
          </label>
          <label className="fullField">
            <span>Motivo de cita</span>
            <textarea name="motivo_cita" rows="3" />
          </label>
          <label className="fullField">
            <span>Anamnesis</span>
            <textarea
              name="anamnesis"
              rows="4"
              placeholder="¿En qué estado inicial se encuentra la mascota al llegar a la cita?"
            />
          </label>
          <label>
            <span>Tipo de alimento</span>
            <select name="tipo_alimento" value={foodType} onChange={(event) => setFoodType(event.target.value)}>
              <option value="">Selecciona una opción</option>
              <option value="Concentrado">Concentrado</option>
              <option value="Dieta BARF">Dieta BARF</option>
              <option value="Enlatado">Enlatado</option>
              <option value="Otro">Otro</option>
            </select>
          </label>
          {foodType === "Otro" ? (
            <label>
              <span>Otro tipo de alimento</span>
              <input name="tipo_alimento_otro" placeholder="Especifica el alimento" />
            </label>
          ) : null}
          <label className="fullField">
            <span>Ración</span>
            <textarea name="racion" rows="2" placeholder="¿Cómo es la ración que se le da?" />
          </label>
          <label>
            <span>Orina</span>
            <input name="orina" placeholder="Estado de la orina" />
          </label>
          <label>
            <span>Heces</span>
            <select name="heces" value={stoolType} onChange={(event) => setStoolType(event.target.value)}>
              <option value="">Selecciona una opción</option>
              <option value="Normal">Normal</option>
              <option value="Blando">Blando</option>
              <option value="Pastoso">Pastoso</option>
              <option value="Líquido">Líquido</option>
              <option value="Otro">Otro</option>
            </select>
          </label>
          {stoolType === "Otro" ? (
            <label>
              <span>Otro estado de las heces</span>
              <input name="heces_otro" placeholder="Especifica el estado" />
            </label>
          ) : null}
        </div>
      </details>

      <details className="clinicalBlock" open>
        <summary>Examen clínico</summary>
        <div className="clinicalBlockContent">
          <div className="formGrid clinicalMeasurements">
            <label><span>F.C.</span><input name="frecuencia_cardiaca" type="number" min="0" placeholder="Frecuencia cardiaca" /></label>
            <label><span>F.R.</span><input name="frecuencia_respiratoria" type="number" min="0" placeholder="Frecuencia respiratoria" /></label>
            <label><span>Temp. (°C)</span><input name="temperatura_c" type="number" min="20" max="50" step="0.1" placeholder="Temperatura actual" /></label>
            <label><span>TLLC</span><input name="tllc_segundos" type="number" min="0" step="0.1" placeholder="Tiempo de llenado capilar" /></label>
            <label><span>Pulso</span><input name="pulso" placeholder="Pulso" /></label>
            <label><span>Peso actual (kg)</span><input name="peso_actual_kg" type="number" min="0" step="0.01" defaultValue={pet.peso_kg ?? ""} placeholder="Peso actual" /></label>
            <label><span>Actitud</span><input name="actitud" placeholder="Decaído, adormecido, etc." /></label>
            <label><span>C/C</span><input name="condicion_corporal" placeholder="Condición corporal: gordo, flaco, etc." /></label>
          </div>

          <div className="systemsGrid">
            {systems.map(([key, label]) => (
              <fieldset className={systemStatus[key] === "Anormal" ? "systemAssessment isAbnormal" : "systemAssessment"} key={key}>
                <legend>{label}</legend>
                <div className="radioRow">
                  {["Normal", "Anormal"].map((status) => (
                    <label key={status}>
                      <input
                        type="radio"
                        name={`sistema_${key}_estado`}
                        value={status}
                        checked={systemStatus[key] === status}
                        onChange={() => setSystemStatus((current) => ({ ...current, [key]: status }))}
                      />
                      {status}
                    </label>
                  ))}
                </div>
                {systemStatus[key] === "Anormal" ? (
                  <textarea
                    name={`sistema_${key}_detalle`}
                    rows="2"
                    placeholder={`Describe la alteración en ${label.toLowerCase()}`}
                  />
                ) : null}
              </fieldset>
            ))}
          </div>

          <label className="stackedField">
            <span>Comentarios y observaciones</span>
            <textarea name="comentarios_observaciones" rows="4" />
          </label>
        </div>
      </details>

      {narrativeSections.slice(0, 5).map(([name, label]) => (
        <details className="clinicalBlock" key={name}>
          <summary>{label}</summary>
          <div className="clinicalBlockContent">
            <label className="stackedField">
              <span>Descripción</span>
              <textarea name={name} rows="5" />
            </label>
          </div>
        </details>
      ))}

      {procedureSchemaReady ? (
        <ProcedureBlock pet={pet} actor={actor} recordedAt={recordedAt} />
      ) : (
        <div className="formAlert">
          El bloque Procedimientos estará disponible cuando se complete la actualización de la tabla clínica.
        </div>
      )}

      {narrativeSections.slice(5).map(([name, label]) => (
        <details className="clinicalBlock" key={name}>
          <summary>{label}</summary>
          <div className="clinicalBlockContent">
            <label className="stackedField">
              <span>Descripción</span>
              <textarea name={name} rows="5" />
            </label>
          </div>
        </details>
      ))}

      <details className="clinicalBlock">
        <summary>Observaciones de responsabilidad</summary>
        <div className="clinicalBlockContent">
          <fieldset className="observationChoice">
            <legend>¿Habilitar observación?</legend>
            <div className="radioRow">
              <label><input type="radio" name="habilitar_observacion" value="si" checked={observation === "si"} onChange={() => setObservation("si")} />Sí</label>
              <label><input type="radio" name="habilitar_observacion" value="no" checked={observation === "no"} onChange={() => setObservation("no")} />No</label>
            </div>
          </fieldset>
          <p className="registeredDoctor">Profesional que registra la historia clínica: <strong>{actor.nombre}</strong></p>
          {observation === "si" ? <div className="responsibilityNotice">{responsibilityText(actor.nombre)}</div> : null}
        </div>
      </details>

      {!veterinarians.length ? (
        <div className="formAlert">No hay médicos veterinarios activos para esta empresa. Crea un veterinario antes de guardar la consulta.</div>
      ) : null}

      <div className="clinicalFormActions">
        <button className="buttonSecondary" type="button" onClick={onCancel}>Cancelar</button>
        <SubmitConsultationButton disabled={!veterinarians.length} />
      </div>
    </form>
  );
}

function HistoryValue({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{String(value)}</dd>
    </div>
  );
}

function ProcedureHistory({ consultation }) {
  const medicationRows = Array.isArray(consultation.formula_medicamentos)
    ? consultation.formula_medicamentos
    : [];
  const selectedTypes = Array.isArray(consultation.tipos_procedimiento)
    ? consultation.tipos_procedimiento
    : [];

  if (!consultation.procedimientos_habilitados) {
    return consultation.procedimientos
      ? <dl className="historyNarratives"><HistoryValue label="Procedimientos" value={consultation.procedimientos} /></dl>
      : null;
  }

  const serviceValue = consultation.valor_total_servicio === null
    ? null
    : new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(consultation.valor_total_servicio);

  return (
    <section className="procedureHistory">
      <h3>Procedimientos</h3>
      <dl className="historyDetailGrid">
        <HistoryValue label="Área de consulta" value={consultation.area_consulta} />
        <HistoryValue label="Tipos de procedimiento" value={selectedTypes.join(", ")} />
        <HistoryValue label="Valor total del servicio" value={serviceValue} />
        <HistoryValue label="Observaciones" value={consultation.observaciones_procedimiento} />
      </dl>

      {medicationRows.length ? (
        <div className="prescriptionHistory">
          <h4>Fórmula para tratamiento en casa</h4>
          {consultation.formula_descripcion ? <p>{consultation.formula_descripcion}</p> : null}
          <div className="medicationHistoryList">
            {medicationRows.map((row, index) => (
              <article key={`${row.medicamento}-${index}`}>
                <strong>{row.medicamento === "Otro" ? row.medicamento_otro : row.medicamento}</strong>
                <span>Dosis: {row.dosis_terapeutica}</span>
                <span>Vía: {row.via_administracion === "Otra" ? row.via_administracion_otra : row.via_administracion}</span>
                <span>Frecuencia: {row.frecuencia === "Otra" ? row.frecuencia_otra : row.frecuencia}</span>
                <span>Cantidad total: {row.cantidad_total}</span>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ConsultationHistory({ consultations }) {
  if (!consultations.length) {
    return (
      <div className="emptyState clinicalEmpty">
        <h2>Aún no hay consultas o controles</h2>
        <p>Crea la primera historia clínica de esta mascota con el botón “Nueva consulta”.</p>
      </div>
    );
  }

  return (
    <div className="consultationHistory">
      {consultations.map((consultation) => {
        const abnormalSystems = Object.entries(consultation.revision_sistemas || {})
          .filter(([, value]) => value?.estado === "Anormal");
        return (
          <details className="consultationCard" key={consultation.id}>
            <summary>
              <span>
                <strong>{consultation.tipo_servicio}</strong>
                <small>{formatDateTime(consultation.fecha_registro)}</small>
              </span>
              <span className="historyDoctor">{consultation.medico_veterinario_nombre}</span>
            </summary>
            <div className="consultationCardContent">
              <dl className="historyDetailGrid">
                <HistoryValue label="Motivo de cita" value={consultation.motivo_cita} />
                <HistoryValue label="Anamnesis" value={consultation.anamnesis} />
                <HistoryValue label="Alimentación" value={[consultation.tipo_alimento, consultation.tipo_alimento_otro].filter(Boolean).join(": ")} />
                <HistoryValue label="Ración" value={consultation.racion} />
                <HistoryValue label="Orina" value={consultation.orina} />
                <HistoryValue label="Heces" value={[consultation.heces, consultation.heces_otro].filter(Boolean).join(": ")} />
                <HistoryValue label="F.C." value={consultation.frecuencia_cardiaca} />
                <HistoryValue label="F.R." value={consultation.frecuencia_respiratoria} />
                <HistoryValue label="Temperatura" value={consultation.temperatura_c !== null ? `${consultation.temperatura_c} °C` : null} />
                <HistoryValue label="TLLC" value={consultation.tllc_segundos !== null ? `${consultation.tllc_segundos} s` : null} />
                <HistoryValue label="Pulso" value={consultation.pulso} />
                <HistoryValue label="Peso actual" value={consultation.peso_actual_kg !== null ? `${consultation.peso_actual_kg} kg` : null} />
                <HistoryValue label="Actitud" value={consultation.actitud} />
                <HistoryValue label="Condición corporal" value={consultation.condicion_corporal} />
              </dl>

              {abnormalSystems.length ? (
                <div className="abnormalSummary">
                  <h3>Hallazgos anormales</h3>
                  {abnormalSystems.map(([key, value]) => (
                    <div key={key}><strong>{systemLabels[key] || key}:</strong> {value.detalle || "Sin descripción"}</div>
                  ))}
                </div>
              ) : null}

              <dl className="historyNarratives">
                <HistoryValue label="Comentarios y observaciones" value={consultation.comentarios_observaciones} />
                {narrativeSections.map(([name, label]) => (
                  <HistoryValue label={label} value={consultation[name]} key={name} />
                ))}
              </dl>

              <ProcedureHistory consultation={consultation} />

              {consultation.habilitar_observacion ? (
                <div className="responsibilityNotice">{responsibilityText(consultation.medico_registra_nombre)}</div>
              ) : null}
              <p className="historyRegisteredBy">Registrada por <strong>{consultation.medico_registra_nombre}</strong></p>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export default function ConsultationControlPanel({
  pet,
  veterinarians,
  actor,
  consultations,
  historyAvailable,
  procedureSchemaReady,
  recordedAt,
  initialModule,
  initialView,
  success,
  error
}) {
  const [selectedModule, setSelectedModule] = useState(initialModule);
  const [view, setView] = useState(initialView);

  function selectModule(key) {
    if (key === "historia" || key === "consulta-control") {
      setSelectedModule(key);
      if (key === "consulta-control") setView("history");
    }
  }

  return (
    <>
      <nav className="clinicalModules" aria-label="Módulos clínicos">
        {modules.map(([key, label]) => {
          const enabled = key === "historia" || key === "consulta-control";
          return (
            <button
              className={selectedModule === key ? "active" : ""}
              type="button"
              key={key}
              disabled={!enabled}
              title={!enabled ? "Este módulo se configurará después" : undefined}
              onClick={() => selectModule(key)}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {selectedModule === "consulta-control" ? (
        <section className="consultationWorkspace">
          {success === "consulta_creada" && view === "history" ? (
            <div className="successAlert">La consulta clínica se guardó correctamente.</div>
          ) : null}
          {error ? (
            <div className="formAlert">
              {error === "medico"
                ? "El médico seleccionado no está disponible para esta empresa."
                : error === "datos_requeridos"
                  ? "Selecciona el tipo de servicio y el médico veterinario."
                  : error === "procedimientos"
                    ? "Selecciona el área de consulta del bloque Procedimientos."
                    : error === "formula"
                      ? "Completa todos los datos de los medicamentos de la fórmula."
                      : error === "actualizar_bd"
                        ? "Completa la actualización de la tabla clínica antes de guardar procedimientos."
                  : "No fue posible guardar la consulta. Verifica que la tabla clínica esté activa en Supabase."}
            </div>
          ) : null}

          {view === "new" ? (
            <ClinicalForm
              pet={pet}
              veterinarians={veterinarians}
              actor={actor}
              recordedAt={recordedAt}
              procedureSchemaReady={procedureSchemaReady}
              onCancel={() => setView("history")}
            />
          ) : (
            <>
              <div className="consultationToolbar">
                <div>
                  <p className="eyebrow">Historia clínica</p>
                  <h2>Consultas y controles</h2>
                  <p>Registros asociados a {pet.nombre}.</p>
                </div>
                <div className="consultationActions">
                  <button type="button" onClick={() => setView("new")}>Nueva consulta</button>
                  <button className="buttonSecondary" type="button" disabled title="La agenda se configurará en el siguiente paso">Agendar cita</button>
                </div>
              </div>
              {!historyAvailable ? (
                <div className="formAlert">La tabla de consultas todavía no está activa en Supabase.</div>
              ) : (
                <ConsultationHistory consultations={consultations} />
              )}
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
