-- ===========================================================================
-- IMPRENTA SANCHEZ — Estructura y seguridad para Supabase
-- ===========================================================================
-- Ejecuta este archivo en Supabase > SQL Editor > New query > Run.
-- Después ejecuta seed.sql para cargar los datos actuales de la imprenta.
-- Puedes volver a ejecutarlo sin borrar datos: usa IF NOT EXISTS y
-- reemplaza las políticas con el mismo nombre.
-- ===========================================================================

create extension if not exists pgcrypto;

-- -------------------------------- Tablas ----------------------------------

create table if not exists public.site_settings (
  id    text primary key default 'main',
  value jsonb not null default '{}'::jsonb
);

create table if not exists public.services (
  id          text primary key,
  title       text not null,
  description text not null default '',
  icon        text not null default 'default',
  image       text not null default '',
  position    integer not null default 0
);

create table if not exists public.products (
  id          text primary key,
  name        text not null,
  description text not null default '',
  image       text not null default '',
  badge       text not null default '',
  position    integer not null default 0
);

create table if not exists public.reviews (
  id      text primary key,
  name    text not null check (char_length(name) between 2 and 80),
  text    text not null check (char_length(text) between 8 and 1200),
  rating  integer not null default 5 check (rating between 1 and 5),
  status  text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  date    timestamptz not null default now()
);

create index if not exists reviews_status_date_idx on public.reviews (status, date desc);

-- ------------------------------ Permisos ----------------------------------

alter table public.site_settings enable row level security;
alter table public.services      enable row level security;
alter table public.products      enable row level security;
alter table public.reviews       enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.services, public.products to anon;
grant select, insert on public.reviews to anon;
grant all on public.site_settings, public.services, public.products, public.reviews to authenticated;

-- -------------------------- Políticas públicas -----------------------------

-- Cualquier visitante puede leer los datos del negocio y el catálogo.
drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon using (true);

drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select to anon using (true);

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon using (true);

-- El visitante solo ve reseñas aprobadas y solo puede enviar nuevas pendientes.
drop policy if exists reviews_public_approved on public.reviews;
create policy reviews_public_approved on public.reviews
  for select to anon using (status = 'approved');

drop policy if exists reviews_public_insert on public.reviews;
create policy reviews_public_insert on public.reviews
  for insert to anon with check (
    status = 'pending'
    and char_length(name) between 2 and 80
    and char_length(text) between 8 and 1200
    and rating between 1 and 5
  );

-- --------------------------- Políticas del panel ---------------------------

drop policy if exists site_settings_admin_all on public.site_settings;
create policy site_settings_admin_all on public.site_settings
  for all to authenticated using (true) with check (true);

drop policy if exists services_admin_all on public.services;
create policy services_admin_all on public.services
  for all to authenticated using (true) with check (true);

drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products
  for all to authenticated using (true) with check (true);

drop policy if exists reviews_admin_all on public.reviews;
create policy reviews_admin_all on public.reviews
  for all to authenticated using (true) with check (true);

-- ----------------------- Storage para imágenes -----------------------------

insert into storage.buckets (id, name, public)
values ('imagenes', 'imagenes', true)
on conflict (id) do update set public = true;

drop policy if exists imagenes_public_read on storage.objects;
create policy imagenes_public_read on storage.objects
  for select using (bucket_id = 'imagenes');

drop policy if exists imagenes_admin_insert on storage.objects;
create policy imagenes_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'imagenes');

drop policy if exists imagenes_admin_update on storage.objects;
create policy imagenes_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'imagenes') with check (bucket_id = 'imagenes');

drop policy if exists imagenes_admin_delete on storage.objects;
create policy imagenes_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'imagenes');

-- Fin del archivo.
