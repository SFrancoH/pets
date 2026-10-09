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
