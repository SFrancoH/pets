-- PETS | 2026-10-08
-- Campo de sede/origen almacenado como fuente en propietarios y mascotas.
-- Idempotente: preserva los valores existentes si la columna ya fue creada en Supabase.
-- Requiere que las tablas de la migración 001 ya existan.

begin;

alter table public.propietarios
  add column if not exists fuente text;

alter table public.mascotas
  add column if not exists fuente text;

commit;
