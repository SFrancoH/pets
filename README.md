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

Ejecuta `supabase/migrations/001_saas_core.sql` en el SQL Editor de Supabase. La migración crea las tablas `empresas`, `usuarios` y `mascotas`, activa RLS y garantiza que solo pueda existir un `super_admin`.

## Comandos

```bash
npm install
npm run dev
npm run build
```

La ruta `/api/health/supabase` valida la conexión sin devolver datos, nombres de tablas ni credenciales.
