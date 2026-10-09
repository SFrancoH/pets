# PETS — Bitácora técnica y decisiones de arquitectura

> Actualizado: 2026-10-08 | Repositorio: `SFrancoH/pets` | Referencia: rama `main`, commit `f9f0bb744bc5da47f7907a484167cc1b14579dbc`
>
> **Convención de estado:** `IMPLEMENTADO EN CÓDIGO` significa que existe lógica en GitHub, **no** que esté probado en producción ni que la migración se haya ejecutado en Supabase. `PENDIENTE` indica cambios todavía no realizados. `DECIDIDO` indica un requisito obligatorio para implementaciones futuras.

## 1. Objetivo y forma de mantener esta bitácora

Fuente de contexto acumulativo del SaaS veterinario multiempresa PETS. Actualizar en el **mismo commit o PR** que modifique la plataforma, indicando fecha, cambio, archivos, motivo, decisión, migración SQL, pruebas y pendientes. No confundir planes con implementaciones. No documentar secretos, tokens, contraseñas ni datos personales de pacientes.

### Plantilla para futuros registros

```md
### AAAA-MM-DD — Título del cambio
- Estado: PENDIENTE | IMPLEMENTADO EN CÓDIGO | VALIDADO EN BD | PROBADO
- Motivo:
- Decisión/regla afectada:
- Archivos:
- Migración SQL: ninguna | ruta (aplicar manualmente primero)
- Comportamiento anterior → nuevo:
- Pruebas realizadas / resultado:
- Pendientes y riesgos:
- Commit/PR:
```

## 2. Contexto arquitectónico confirmado en repositorio

- Frontend y backend: Next.js App Router, React; acciones de servidor en `app/**/actions.js` y rutas API en `app/api`.
- Base de datos: Supabase (Postgres); cliente privilegiado únicamente en servidor mediante `getSupabaseAdmin`. No exponer la clave privilegiada.
- SaaS por empresa (`empresa_id`), con roles `super_admin`, `empresa_admin` y `veterinario`. Verificar el perfil en servidor y el alcance por empresa en cada acceso.
- Entidades verificadas por migraciones: `empresas`, `usuarios`, `mascotas`, `propietarios`, `propietarios_mascotas`, `consultas_controles`, `integraciones_contacto`, `registros_mascotas_pendientes`.
- El estado real de la base de datos desplegada **no** fue consultado: la presencia de una migración en GitHub no demuestra que ya se ejecutó.

## 3. Reglas y decisiones obligatorias

| ID | Regla/decisión | Motivo | Estado |
|---|---|---|---|
| ADR-001 | PETS es la fuente primaria de propietarios, mascotas e historias clínicas; los formularios nativos guardan directamente en Supabase vía servidor. | Eliminar dependencia del formulario externo. | DECIDIDO; registro pendiente de migración |
| ADR-002 | Prohibido redirigir a enlaces de formularios externos para registrar datos; no construir URLs de precarga ni enviar datos por query string a formularios. | Privacidad, consistencia y experiencia. | DECIDIDO; código antiguo aún presente |
| ADR-003 | La integración con el CRM se realiza, cuando sea necesaria, por API/webhook autenticado, **después** de confirmar el guardado local. | Desacoplamiento de sistemas. | DECIDIDO; por implementar |
| ADR-004 | Fallo de CRM no revierte el registro clínico. Registrar estado del envío, errores y permitir reintentos idempotentes. | Resiliencia y prevención de duplicados. | DECIDIDO; por implementar |
| ADR-005 | Reutilizar tablas existentes antes de crear otra. Si hace falta DDL, entregar primero SQL versionado y confirmar que se ejecutó antes de activar código dependiente. | Evitar tablas redundantes y errores de esquema. | DECIDIDO |
| ADR-006 | Cada escritura/lectura operativa valida sesión, rol y `empresa_id` del recurso **en servidor**. No confiar en el identificador enviado desde el navegador. | Aislamiento multiempresa. | Patrón implementado; requiere pruebas |
| ADR-007 | Los registros clínicos deben conservar médico responsable, autor, fecha/hora del servidor y asociación a mascota y empresa. | Trazabilidad clínica. | IMPLEMENTADO EN CÓDIGO |
| ADR-008 | El `super_admin` es único, los administradores de empresa gestionan usuarios de su empresa. | Jerarquía de permisos. | Revisar migración 001 para garantías |
| ADR-009 | No guardar archivos binarios en columnas de texto o JSON; cuando haya adjuntos utilizar Supabase Storage privado y metadatos con `empresa_id`, `mascota_id` y `consulta_id`. | Control de acceso y rendimiento. | DECIDIDO; adjuntos pendientes |
| ADR-010 | El número de carnet usa formato de 14 dígitos `ddmmaaaaHHMMSS` en hora de Bogotá, pero se debe proteger la unicidad por empresa en la base de datos. | Identificación y colisiones. | Generador existente; validar concurrencia |

## 4. Línea histórica recuperada (commits)

| Fecha (UTC) | Commit abreviado | Cambio reportado por GitHub |
|---|---|---|
| 2026-09-18 | `90a0893` | Ampliación de campos de mascota |
| 2026-09-18 | `9da5d74` | Propietarios y relación con mascotas |
| 2026-09-18 | `9598c3d` | Administración de usuarios por empresa |
| 2026-09-18 | `4266910` | Controles para mostrar/ocultar contraseña |
| 2026-09-18 | `24a87be` | Registros operativos de mascotas y propietarios |
| 2026-09-18 | `dd8ba3f` | Importación CSV desde Hopspet |
| 2026-09-18 | `b94a0b4` | Progreso visible en importaciones |
| 2026-09-18 | `20cf1f9` | Historial de consultas y controles |
| 2026-09-18 | `b2b56a4` | Ajustes de acceso embebido |
| 2026-09-18 | `a58dfdf` | Eliminación de aviso sobre acceso embebido |
| 2026-09-18 | `8bb6989` | Procedimientos y fórmula farmacológica |
| 2026-09-18 | `f9f0bb7` | Flujo de registro y confirmación de propietario y mascota |

Esta tabla se basa en mensajes de commits; no sustituye una revisión de pruebas ni de despliegues.

## 5. Nueva consulta — diagnóstico exacto

**Estado: IMPLEMENTADO EN CÓDIGO; pendiente prueba extremo a extremo en Supabase.**

- Vista: `components/consultation-control-panel.js`. Formulario `ClinicalForm`, `<form action={action}>` y botón `Guardar consulta`.
- Escritura: `app/mascotas/[id]/actions.js` función `createConsultation(petId, formData)`.
- Lectura de historia: `app/mascotas/[id]/page.js`, consulta por `empresa_id`, `mascota_id`, ordenada por `fecha_registro` descendente.
- Tabla existente: `public.consultas_controles`, creada por `supabase/migrations/002_consultas_controles.sql`.
- Campos de procedimientos/fórmula: añadidos por `supabase/migrations/003_procedimientos_formula.sql`.
- La acción valida usuario, empresa, mascota, médico, tipo de consulta, catálogos y medicamentos, e inserta mediante `admin.from("consultas_controles").insert(row)`.
- Los campos capturados incluyen motivo, anamnesis, alimentación, ración, orina, heces, mediciones clínicas, revisión por sistemas (JSONB), diagnósticos, exámenes, procedimientos, fórmula, tratamiento, pronóstico, notas, autor y veterinario.
- La vista comprueba de forma indirecta la disponibilidad del esquema de procedimientos; la acción incluye compatibilidad para el esquema antiguo **solamente cuando no se seleccionan procedimientos**. No tomar esto como validación de una migración efectivamente aplicada.
- `fecha_registro` se asigna por defecto en base de datos (`now()`); la fecha que ve el formulario es orientativa.
- El formulario guarda **datos estructurados**, no archivos adjuntos. Para PDF, imágenes o documentos clínicos se requerirá Storage privado y un diseño posterior de metadatos. No confundir registros con archivos.

### Verificación obligatoria antes de añadir nuevas tablas

1. Comprobar en Supabase que existe `public.consultas_controles` y que se ejecutaron `002` y `003`.
2. Probar consulta simple; verificar fila nueva, `empresa_id`, `mascota_id`, `registrada_por`, `fecha_registro`.
3. Probar consulta con procedimientos y varios medicamentos; verificar JSONB y `tipos_procedimiento`.
4. Verificar historial al recargar, rechazo de acceso entre empresas y manejo de errores.
5. Si falta el esquema, aplicar las migraciones **existentes**, no duplicar la tabla.

SQL de comprobación (solo lectura):

```sql
select to_regclass('public.consultas_controles') as tabla_consultas;
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'consultas_controles'
order by ordinal_position;
```

## 6. Registro propietario y mascota — sustitución del formulario externo

**Estado: PENDIENTE DE IMPLEMENTACIÓN.**

### Comportamiento actual encontrado

1. `app/registros/nuevo/page.js` presenta formulario PETS.
2. `app/registros/nuevo/actions.js` guarda un `registro_mascotas_pendientes`, pero requiere `integraciones_contacto` activa.
3. `app/registros/[id]/confirmar/page.js` construye URL del formulario externo con datos por query string.
4. `components/registration-confirmation.js` participa en confirmación.
5. `app/api/integraciones/contactos/[token]/route.js` procesa el webhook.
6. Migración `004_registro_contacto_mascota.sql` contiene una función RPC para finalizar el proceso después del webhook.
7. `docs/configuracion-formulario-contactos.md` describe el flujo **obsoleto**; conservar como referencia histórica identificada como no vigente, nunca como instrucción activa.

### Comportamiento nuevo requerido

1. Usuario autenticado llena el formulario **dentro de PETS**.
2. Servidor valida rol/empresa, propietario, mascota, consentimiento de notificaciones, carnet y unicidad.
3. En **una transacción atómica** crear o reutilizar propietario de la empresa, crear mascota y asociarlos en `propietarios_mascotas`. Usar una función PostgreSQL segura o transacción equivalente en servidor, sin insertar parcialmente mediante acciones independientes.
4. Devolver identificadores locales y confirmar éxito solo tras `COMMIT`.
5. Si la empresa tiene integración CRM, preparar una operación de sincronización **asíncrona/reintentable** mediante API/webhook con credenciales en servidor; jamás bloquear el registro local.
6. No registrar duplicados: usar identificador local estable/idempotency key y almacenar el identificador externo `crm_contacto_id` cuando exista.
7. Retirar dependencia de `formulario_url`, URL prellenada y pantalla de confirmación externa. Revisar usos restantes antes de eliminar endpoints o columnas para no romper integraciones vigentes.
8. Mantener historial/auditoría de fallos y reintentos de CRM; no volcar datos personales en logs.

**No implementar un borrado directo de `integraciones_contacto` o `registros_mascotas_pendientes` sin plan de migración y revisión de datos históricos.** Puede reutilizarse `integraciones_contacto` rediseñada para configuración API/webhook, y una tabla de outbox si se necesita entrega fiable.

## 7. Tareas priorizadas

| Prioridad | Estado | Trabajo | Criterio de aceptación |
|---|---|---|---|
| P0 | PENDIENTE | Verificar Supabase contra migraciones 001–004 | Estructura real y migraciones ejecutadas confirmadas |
| P0 | PENDIENTE | Sustituir registro externo por alta transaccional en Supabase | Propietario, mascota y relación guardados sin CRM |
| P0 | PENDIENTE | Retirar redirecciones y referencias de formulario externo | Ningún flujo nativo exige URL externa |
| P0 | PENDIENTE | Probar `Nueva consulta` en base de datos real | Persistencia, historial y permisos verificados |
| P1 | PENDIENTE | Diseñar y probar integración API/webhook por empresa | Reintentos idempotentes y estados observables |
| P1 | PENDIENTE | Fortalecer restricciones de unicidad y aislamiento | Sin duplicación ni acceso entre empresas |
| P1 | PENDIENTE | Evaluar edición/auditoría e inmutabilidad clínica | Cambios identificables por usuario y fecha |
| P2 | PENDIENTE | Archivos clínicos adjuntos | Storage privado, metadatos y acceso por empresa |
| P2 | PENDIENTE | Revisar módulos aún no verificados | Agenda, vacunas, desparasitación, remisiones, etc. |

## 8. Registro de decisión — 2026-10-08

### Unificar fuente primaria y actualizar flujo CRM
- **Motivo:** el negocio elimina totalmente el uso de formularios externos.
- **Antes:** alta provisional + formulario enlazado + webhook de confirmación.
- **Después (requisito):** guardado directo PETS → Supabase; eventual sincronización CRM por API/webhook.
- **Archivos a cambiar:** `app/registros/nuevo/actions.js`, `app/registros/nuevo/page.js`, `app/registros/[id]/confirmar/page.js`, `components/registration-confirmation.js`, módulos de configuración de integraciones, pruebas y migraciones necesarias.
- **Estado:** decisión documentada; no aplicada al código de registro.
- **Riesgo:** la base existente depende de una función RPC de confirmación por token; reemplazarla requiere transacción local sin deshabilitar registros históricos.

### Persistencia de Nueva consulta
- **Motivo:** confirmar que toda consulta queda guardada en Supabase.
- **Hallazgo:** ya existe acción de inserción y tabla `consultas_controles`; no corresponde crear otra tabla para esos datos.
- **Estado:** implementación presente; verificación en Supabase y pruebas pendientes.
- **SQL nuevo requerido:** ninguno para los campos presentes en migraciones 002 y 003, siempre que ya estén aplicadas.

## 9. Referencias técnicas

- `supabase/migrations/001_saas_core.sql`: esquema base y permisos.
- `supabase/migrations/002_consultas_controles.sql`: tabla clínica, FK e índices y RLS.
- `supabase/migrations/003_procedimientos_formula.sql`: columnas de procedimientos y medicamentos.
- `supabase/migrations/004_registro_contacto_mascota.sql`: flujo heredado de confirmación.
- `app/mascotas/[id]/actions.js`: creación de consulta.
- `components/consultation-control-panel.js`: captura e historial clínico.
- `app/registros/nuevo/actions.js`: registro provisional actual.
- `app/api/integraciones/contactos/[token]/route.js`: webhook heredado.

**Regla de mantenimiento:** toda modificación futura debe actualizar esta bitácora, indicar una decisión si cambia arquitectura, enlazar migración SQL cuando proceda y marcar explícitamente qué se implementó, qué se probó y qué sigue pendiente.


## 10. Registro de cambios — 2026-10-08 — Formularios clínicos parciales y SEDE

- **Estado:** IMPLEMENTADO EN CÓDIGO; pendiente de validación manual en el Supabase desplegado, prueba UI y build.
- **Motivo:** el formulario bloqueaba el envío al marcar procedimientos como realizados de forma predeterminada; además, se necesita visualizar la sede/origen de mascotas y propietarios desde la columna `fuente`.
- **Decisión ADR-011:** "SEDE" es una etiqueta de interfaz asociada al atributo `fuente` de cada registro, **no** sustituye `empresa_id` ni sus restricciones de aislamiento multiempresa.
- **Decisión ADR-012:** un dato clínico sin evaluar debe quedar ausente de `revision_sistemas`; no registrar automáticamente "Normal". Solo el tipo de servicio y el veterinario son obligatorios para una consulta básica. Los campos de procedimientos/medicación son obligatorios únicamente si el usuario activa esos módulos.
- **Antes → después (consulta):** `procedimientos_habilitados` comenzaba en `si` y obligaba a escoger `area_consulta` incluso sin procedimientos → inicia en `no` y permite una consulta parcial. Los diez sistemas comenzaban en "Normal" → comienzan en "No evaluado" y únicamente se almacenan "Normal" o "Anormal" si el usuario los selecciona.
- **Antes → después (SEDE):** listado condicionado "Empresa" visible solo a superadmin → columna `SEDE` visible para todos los roles autorizados y alimentada por `fuente`; las fichas individuales muestran SEDE y el detalle de propietarios lo sitúa después de Tags; la ficha de mascotas lo incluye en Información general.
- **Importaciones:** nuevas filas importadas aceptan columnas del archivo llamadas `fuente` o `sede`; se preserva un valor existente del grupo al combinar filas del mismo propietario.
- **Exportaciones:** Excel de mascotas y propietarios contiene ahora columna `SEDE`.
- **SQL:** `supabase/migrations/005_fuente_sede.sql` añade las dos columnas con `IF NOT EXISTS`; es seguro si ya fueron creadas manualmente. Las tablas SQL aportadas por el usuario no muestran `fuente`, pese a que informó que las columnas ya existen. Confirmar el esquema real antes de desplegar. **No ejecutar nuevamente los `CREATE TABLE` copiados del editor de Supabase**.
- **Archivos de código modificados:** `components/consultation-control-panel.js`, `app/mascotas/[id]/actions.js`, `app/propietarios/page.js`, `app/mascotas/page.js`, `app/propietarios/[id]/page.js`, `app/mascotas/[id]/page.js`, `app/propietarios/actions.js`, `app/mascotas/actions.js`, `app/api/export/propietarios/route.js`, `app/api/export/mascotas/route.js`.
- **Pruebas pendientes:** guardar consulta solo con tipo y médico, guardar consulta completa con procedimientos y medicamentos, marcar parcialmente los sistemas, verificar `revision_sistemas`, datos `fuente` reales en ambas tablas, columnas SEDE en listas/fichas/Excel, imports desde archivos con columnas fuente/sede, alcance por empresa. Compilar y ejecutar pruebas automatizadas antes de pasar a producción.
- **Pendiente de integración:** cuando se reemplace el registro externo por un alta nativa, permitir establecer `fuente` en el formulario y escribirla tanto en propietario como en mascota, sin transferir valores de otras empresas.
- **Importante:** no se ha modificado en este cambio el antiguo flujo de creación de registros mediante formulario externo; continúa listado como prioridad P0.


## 11. Registro de cambios — 2026-10-09 — Ediciones, sedes, catálogos e historial

**Estado:** IMPLEMENTADO EN CÓDIGO. **SIN VALIDACIÓN EN SUPABASE DESPLEGADO NI BUILD DE NEXT.JS** al momento de registrar este cambio. Migraciones 006–008 deben ejecutarse en orden antes de activar las nuevas rutas. Conservar esta distinción en informes.

### ADR-013 — Edición explícita por registro

- Se agrega edición y botón **Actualizar datos** en fichas de mascotas y propietarios, y **Editar consulta** en cada historia clínica.
- La edición de consultas reutiliza el **mismo formulario de creación**, prellenado. Fuera del modo edición, se muestra como solo lectura, sin permitir alterar los campos.
- Al guardar se realiza UPDATE del registro original, no se crean duplicados. En consultas se conserva autor y fecha originales; `updated_at` se actualiza con el trigger existente; `ultima_edicion_por` identifica al editor.
- La tabla restringida `auditoria_ediciones_pets` (migración 008) almacena anteriores y nuevos de cada UPDATE en consultas, mascotas y propietarios. Su acceso no se expone en el navegador.
- Reglas: validar permisos de sesión y `empresa_id` en el servidor para cada UPDATE; las asociaciones de empresa y mascota de la consulta no se sobrescriben desde formularios.

### ADR-014 — Catálogos centralizados

- Archivo `lib/pet-catalogs.js` contiene sedes, especies, razas, temperamentos, estados reproductivos, tamaños y estados de mascota.
- Sedes admitidas en nuevas altas: `SEDE NORTE` y `SEDE SUR`; etiqueta visible **SEDE**, dato guardado en `fuente` de propietario y mascota.
- Estado reproductivo normalizado a `Entero`, `Castrado / Esterilizado`, `Desconocido`; se interpreta la expresión recibida «Castrado Esterilazdo» como un único valor.
- Los formularios de edición aceptan conservar valores históricos no incluidos en los catálogos, evitando borrar datos importados. Nuevos registros deben usar las opciones vigentes.
- Tamaño se agrega a `mascotas.tamano` por migración 006. Edición del estado admite `Activo`, `Inactivo`, `Fallecido` y la visualización debe reflejar este valor.
- Importación masiva de mascotas permite columna `tamano` o `tamaño`; continúa admitiendo `fuente` o `sede`.

### ADR-015 — Registro nuevo directo a Supabase sin formulario enlazado

- `app/registros/nuevo/page.js` permite seleccionar sede y catálogos, guardando por acción `createPetRegistration` de `app/registros/nuevo/actions.js`.
- La acción invoca `public.registrar_propietario_mascota_pets` (SQL 006): una **transacción de base de datos** valida empresa/usuario, reutiliza propietario por documento si existe, inserta mascota y asocia mediante `propietarios_mascotas`.
- En caso de propietario previamente existente, se conserva su registro, incluido `fuente`; la nueva mascota recibe la sede seleccionada. Actualizar un propietario debe ser una edición separada y explícita.
- La acción **ya no redirige al formulario externo** ni exige integración activa. El CRM futuro se integrará mediante API/webhook; el envío externo todavía NO está implementado.
- Las antiguas páginas de confirmación, configuración e integración se conservan únicamente como código heredado y requieren desactivación ordenada; no son parte de la nueva ruta de registro.

### ADR-016 — Índice unificado y paginación de 50 eventos

- Se crea `public.eventos_mascota` por migración SQL 007: referencia a mascota/empresa, tipo de módulo, consulta asociada, fecha y resumen.
- Un disparador replica altas, cambios y eliminaciones de `consultas_controles` en el índice; la migración rellena registros antiguos. Cada consulta genera un evento «Consulta y control», y uno adicional de «Procedimientos» y/o «Fórmula y remisión» cuando corresponda.
- `ultimos_eventos_mascota_pets` obtiene un máximo de un evento por módulo. La interfaz muestra nueve módulos, su último registro y «Ver más».
- La vista ampliada pagina **50 eventos globales por página**, ordenados del más nuevo al más antiguo, y permite filtrar con `desde` y `hasta` incluidos en los enlaces de paginación.
- Los detalles de una consulta se consultan únicamente para los registros de la página y se presentan mediante formulario de solo lectura, con edición individual.
- Vacunación, desparasitación, estética, guardería, seguimiento y consentimientos **todavía no tienen flujos operativos propios**. El índice ya admite eventos de estos módulos, pero crear y editar sus datos concretos queda PENDIENTE. No generar datos simulados.
- Para fechas se interpreta la búsqueda en zona `America/Bogota` (-05:00).

### Archivos agregados

- `lib/pet-catalogs.js`
- `components/pet-edit-form.js`, `components/owner-edit-form.js`
- `app/mascotas/[id]/profile-actions.js`, `app/propietarios/[id]/actions.js`
- `supabase/migrations/006_registro_directo_y_tamano.sql`
- `supabase/migrations/007_historial_unificado.sql`
- `supabase/migrations/008_auditoria_ediciones.sql`

### Archivos actualizados

- `app/mascotas/[id]/page.js`, `app/mascotas/[id]/actions.js`
- `app/propietarios/[id]/page.js`
- `components/consultation-control-panel.js`
- `app/registros/nuevo/page.js`, `app/registros/nuevo/actions.js`
- `app/mascotas/page.js`, `app/mascotas/actions.js`
- `app/globals.css`

### Validación y pendientes

- **Hecho:** comprobaciones estáticas de presencia de cambios y parámetros en el repositorio.
- **Pendiente P0:** ejecutar migraciones SQL 006, 007, 008 en orden (005 opcional si `fuente` ya existe), verificar estado de las funciones y tablas.
- **Pendiente P0:** `npm install && npm run build` y pruebas de formulario en entorno de desarrollo/despliegue.
- **Pendiente P0:** probar nuevo registro (propietario existente y nuevo; mismo documento en otra empresa; carnet duplicado); nuevos campos y permisos; consultas editadas y persistencia de todos los campos.
- **Pendiente P0:** probar auditoría de tres entidades y sincronización del índice de eventos (crear, modificar, paginar, filtrar).
- **Pendiente P1:** crear formularios y persistencia de los módulos todavía deshabilitados y vincular sus eventos al índice.
- **Pendiente P1:** integración CRM post-commit por API/webhook con cola, idempotencia, reintentos; retiro seguro del flujo heredado.
- **Pendiente P1:** mostrar de forma filtrada las revisiones de auditoría para usuarios con autorización expresa, definir retención.
- **Pendiente P2:** pruebas E2E automatizadas y ajustes de UX para campos opcionales de formularios clínicos.

### Regla para el despliegue

No desplegar frontend ni acciones que dependan de `tamano`, `registrar_propietario_mascota_pets`, `eventos_mascota`, `ultimos_eventos_mascota_pets`, `ultima_edicion_por` o `auditoria_ediciones_pets` antes de aplicar y verificar las migraciones 006–008. Todas las funciones con `SECURITY DEFINER` quedan ejecutables solo con `service_role` y las claves secretas permanecen exclusivamente en servidor.


## 12. Correcciones — 2026-10-09 — desplegables, visualización de SEDE y migración 007

### SQL 007: error PostgreSQL 42601 en línea 97
- **Detectado:** la función `ultimos_eventos_mascota_pets` tenía `as $` / `$;` (delimitadores inválidos).
- **Solución implementada:** usar delimitadores coincidentes `as $pets_recent$` y `$pets_recent$;` en `supabase/migrations/007_historial_unificado.sql`.
- **Motivo:** SQL inválido en el archivo subido; PostgreSQL rechazaba el script. El código de la función `sincronizar_eventos_consulta` anterior usa delimitadores válidos `$$`.
- **Estado:** CORREGIDO EN GITHUB. PENDIENTE ejecutar script completo en Supabase y comprobar tablas, función y backfill. La migración está envuelta en transacción y está diseñada para poder reintentarse.

### Formularios: precisión de catálogos
- **Revisión:** los select de Nuevo registro (`app/registros/nuevo/page.js`) y Edición de mascota (`components/pet-edit-form.js`) ya importaban los catálogos, pero tenían dos valores diferentes a los solicitados.
- **Cambio:** dividir `Castrado / Esterilizado` en opciones independientes `Castrado` y `Esterilizado`; usar `independiente` en la opción de temperamento. Persisten `Entero`, `Desconocido` y el resto de los catálogos ya configurados.
- **Compatibilidad:** la edición conserva el valor histórico si no está entre las opciones nuevas (p.ej. `Castrado / Esterilizado`).
- **Motivo de riesgo:** si los selects siguen sin verse en la app desplegada pese a estar en la rama principal, verificar que el despliegue de Vercel corresponde a `main` actualizado. No se ha podido inspeccionar el despliegue en vivo.
- **Estado:** CORREGIDO EN GITHUB; interfaz desplegada no verificada.

### SEDE: lectura del campo `fuente`
- **Revisión:** las consultas de listas y fichas leen `fuente` (singular); ese es el nombre correcto según el DDL de Supabase compartido. No debe sustituirse por `empresas.nombre`.
- **Corrección:** helper `lib/sede-display.js` para mostrar el valor de `fuente` sin inventarlo; celdas sin valor indican `Sin sede registrada`. Las listas de mascotas/propietarios ahora exhiben un error visible si falla la lectura del backend en lugar de aparentar una tabla vacía. Las fichas registran el error de Supabase y no lo confunden con un registro inexistente.
- **Requisito de comprobación de datos:** comprobar valores agrupados de `fuente` tanto en `mascotas` como en `propietarios`; añadir la columna con `ALTER TABLE` no rellena los registros antiguos.
- **No hacer:** asignar `SEDE SUR` o `SEDE NORTE` automáticamente a todas las filas nulas, ni copiar la sede del propietario a una mascota sin verificar la correspondencia.
- **Estado:** CORREGIDO EN GITHUB. PENDIENTE inspección de valores reales y deploy.

### Verificación y seguimiento
- Verificar SQL 007 completo en el editor Supabase, incluida su función en líneas 93–102.
- Revisar carga de módulos, filtros y cronología de la mascota después de la migración.
- Crear propietario/mascota desde formulario para verificar nuevos valores de dropdown y `fuente`.
- Consultar datos actuales mediante agregación `GROUP BY fuente` sin exponer PII y comparar lo almacenado con la UI.
- Recompilar y validar que Vercel desplegó el último commit de `main`.
