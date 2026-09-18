# PETS

Aplicación administrativa para gestionar propietarios y mascotas.

## Variables de entorno

Configura estas variables únicamente en Vercel o en un archivo local `.env.local` que nunca se suba a GitHub:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

`SUPABASE_SECRET_KEY` tiene privilegios elevados y solo se utiliza en módulos del servidor. Nunca debe llevar el prefijo `NEXT_PUBLIC_` ni utilizarse desde componentes del navegador.

## Comandos

```bash
npm install
npm run dev
npm run build
```

La ruta `/api/health/supabase` valida la conexión sin devolver datos, nombres de tablas ni credenciales.
