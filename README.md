# PETS

Aplicación administrativa para gestionar propietarios y mascotas.

## Variables de entorno

Configura estas variables únicamente en Vercel o en un archivo local `.env.local` que nunca se suba a GitHub:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`SUPABASE_SECRET_KEY` tiene privilegios elevados y solo se utiliza en módulos del servidor. Nunca debe llevar el prefijo `NEXT_PUBLIC_` ni utilizarse desde componentes del navegador.

## Base de datos

Ejecuta las migraciones de `supabase/migrations` en orden numérico (001–009) en el SQL Editor de Supabase. Las migraciones 006, 007, 008 y 009 habilitan el registro nativo transaccional, el historial unificado con paginación y la auditoría de ediciones. Deben estar aplicadas **antes** de usar esas funciones en la aplicación.

La documentación operativa, las decisiones, el historial de cambios y los pendientes están en [docs/BITACORA_PETS.md](docs/BITACORA_PETS.md). El antiguo documento de formulario externo se conserva exclusivamente como referencia histórica.

## Comandos

```bash
npm install
npm run dev
npm run build
```

La ruta `/api/health/supabase` valida la conexión sin devolver datos, nombres de tablas ni credenciales.

Para **Agregar otro propietario** desde la ficha de una mascota, ejecutar también `supabase/migrations/009_asociar_propietario_mascota.sql`; añade una función de asociación por documento/teléfono con prevención de duplicados y no crea tablas nuevas.
