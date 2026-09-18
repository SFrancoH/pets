# Configuración del formulario de propietarios

El formulario externo contiene únicamente datos del propietario. Los datos de la mascota se guardan en PETS y nunca se envían como campos de contacto.

## Campos y Query Keys

| Campo visible | Tipo | Query Key | Requerido |
| --- | --- | --- | --- |
| Nombre | Una línea | `nombre` | Sí |
| Apellido | Una línea | `apellido` | No |
| WhatsApp | Teléfono | `phone` | Sí |
| Teléfono alterno | Teléfono | `telefono` | No |
| Correo electrónico | Email | `correo_electronico` | Sí |
| Ciudad | Una línea | `ciudad` | No |
| Dirección | Una línea | `direccion` | No |
| Tipo de documento | Lista desplegable | `tipo_de_documento` | Sí |
| Número de documento | Una línea | `numero_de_documento` | Sí |
| ¿El propietario acepta recibir recordatorios por correo electrónico? | Opción Sí / No | `notificacion_email` | Sí |
| ¿El propietario acepta recibir recordatorios por WhatsApp? | Opción Sí / No | `notificacion_whatsapp` | Sí |
| Identificador PETS | Campo oculto | `pets_registro_id` | Sí |

La clave `numero_de_documento` debe escribirse sin tilde. El identificador `pets_registro_id` debe conservarse oculto y enviarse junto con el formulario.

## Opciones de tipo de documento

- Cédula de ciudadania
- Cédula extranjera
- NIT
- RUT
- CURP
- Tarjeta de identidad nacional
- Pasaporte
- Documento de identidad internacional

## Confirmación

El texto del botón final debe ser **Confirmar creación**.

Después de enviar el formulario, el flujo debe ejecutar una solicitud `POST` a la URL privada que aparece en PETS dentro de **Empresas → empresa seleccionada → Formulario conectado**.

El cuerpo debe enviarse como JSON:

```json
{
  "pets_registro_id": "{{pets_registro_id}}",
  "contact_id": "{{contact.id}}",
  "nombre": "{{nombre}}",
  "apellido": "{{apellido}}",
  "whatsapp": "{{phone}}",
  "telefono": "{{telefono}}",
  "correo_electronico": "{{correo_electronico}}",
  "ciudad": "{{ciudad}}",
  "direccion": "{{direccion}}",
  "tipo_de_documento": "{{tipo_de_documento}}",
  "numero_de_documento": "{{numero_de_documento}}",
  "notificacion_email": "{{notificacion_email}}",
  "notificacion_whatsapp": "{{notificacion_whatsapp}}"
}
```

Los marcadores deben seleccionarse desde el constructor del flujo para que correspondan a los valores reales del contacto y de los campos personalizados.
