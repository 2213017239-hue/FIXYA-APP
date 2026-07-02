-- ============================================================
-- FixYa — Esquema de base de datos para Supabase
-- ============================================================
-- Cómo usarlo:
-- 1. Entra a tu proyecto en https://supabase.com
-- 2. Ve a "SQL Editor" → "New query"
-- 3. Pega TODO este archivo y presiona "Run"
-- 4. Ve a "Storage" y confirma que se creó el bucket "portfolio"
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- TABLA: profiles
-- Un perfil por cada usuario (cliente, técnico o admin)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'cliente' check (role in ('cliente','tecnico','admin')),
  name text not null,
  phone text,
  zone text,
  specialty text,
  bio text,
  avatar_emoji text default '🧑',
  rating numeric(2,1) default 5.0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Los perfiles son visibles públicamente" on public.profiles;
create policy "Los perfiles son visibles públicamente"
  on public.profiles for select
  using (true);

drop policy if exists "Los usuarios crean su propio perfil" on public.profiles;
create policy "Los usuarios crean su propio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Los usuarios editan su propio perfil" on public.profiles;
create policy "Los usuarios editan su propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Crea automáticamente un perfil cada vez que alguien se registra
-- (toma el nombre y el rol que se mandan desde el formulario de registro)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'cliente'),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TABLA: portfolio_items
-- Trabajos anteriores que sube cada técnico
-- ============================================================
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.portfolio_items enable row level security;

drop policy if exists "El portafolio es visible públicamente" on public.portfolio_items;
create policy "El portafolio es visible públicamente"
  on public.portfolio_items for select
  using (true);

drop policy if exists "Un técnico sube solo a su propio portafolio" on public.portfolio_items;
create policy "Un técnico sube solo a su propio portafolio"
  on public.portfolio_items for insert
  with check (auth.uid() = technician_id);

drop policy if exists "Un técnico borra solo su propio trabajo" on public.portfolio_items;
create policy "Un técnico borra solo su propio trabajo"
  on public.portfolio_items for delete
  using (auth.uid() = technician_id);

-- ============================================================
-- STORAGE: bucket público para las fotos del portafolio
-- ============================================================
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

drop policy if exists "Fotos de portafolio visibles públicamente" on storage.objects;
create policy "Fotos de portafolio visibles públicamente"
  on storage.objects for select
  using (bucket_id = 'portfolio');

drop policy if exists "Técnicos suben fotos a su propia carpeta" on storage.objects;
create policy "Técnicos suben fotos a su propia carpeta"
  on storage.objects for insert
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Técnicos borran sus propias fotos" on storage.objects;
create policy "Técnicos borran sus propias fotos"
  on storage.objects for delete
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- CONVERTIR UN USUARIO EN ADMINISTRADOR
-- ============================================================
-- Por seguridad, el registro público solo permite "cliente" o "tecnico".
-- Para dar acceso de administrador a alguien, corre esto manualmente
-- (después de que esa persona ya se haya registrado normalmente):
--
--   update public.profiles set role = 'admin' where id = 'PEGA-AQUI-EL-UUID-DEL-USUARIO';
--
-- El UUID lo encuentras en Authentication → Users, dentro de tu proyecto de Supabase.

-- ============================================================
-- TABLA: service_requests
-- Cada fila = una venta real (una solicitud que un cliente confirmó
-- en el simulador). El dashboard de Admin lee esta tabla para
-- calcular GMV, comisión y servicios por categoría en tiempo real.
-- ============================================================
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  technician_id uuid references public.profiles(id) on delete set null,
  category text not null,
  status text not null default 'confirmada' check (status in ('confirmada','completada','cancelada')),
  price_min numeric not null,
  price_max numeric not null,
  created_at timestamptz not null default now()
);

alter table public.service_requests enable row level security;

-- Un cliente ve solo sus propias solicitudes; un admin las ve todas
-- (para poder calcular las métricas del dashboard).
drop policy if exists "Clientes ven sus solicitudes, admin ve todas" on public.service_requests;
create policy "Clientes ven sus solicitudes, admin ve todas"
  on public.service_requests for select
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Un cliente solo puede crear solicitudes a su propio nombre
drop policy if exists "Un cliente crea sus propias solicitudes" on public.service_requests;
create policy "Un cliente crea sus propias solicitudes"
  on public.service_requests for insert
  with check (auth.uid() = client_id);
