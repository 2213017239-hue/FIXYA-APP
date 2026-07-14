-- ============================================================
-- Oficios60minutos — Esquema de base de datos para Supabase
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

-- Un admin puede editar el perfil de cualquiera (lo necesita para
-- aprobar la verificación de identidad de un técnico).
drop policy if exists "Un admin puede editar cualquier perfil" on public.profiles;
create policy "Un admin puede editar cualquier perfil"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Columnas nuevas: foto de perfil, varias especialidades, e insignia de
-- verificado. Si tu tabla ya existía de una versión anterior, esto la
-- actualiza sin borrar ningún dato.
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists specialties text[] not null default '{}';
alter table public.profiles add column if not exists verified boolean not null default false;
alter table public.profiles add column if not exists review_count int not null default 0;
alter table public.profiles add column if not exists jobs_completed int not null default 0;
alter table public.profiles alter column rating drop default;
alter table public.profiles alter column rating drop not null;

-- Crea automáticamente un perfil cada vez que alguien se registra
-- (toma el nombre y el rol que se mandan desde el formulario de registro)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'cliente'),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', '')
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
-- STORAGE: bucket público para las fotos de perfil
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Fotos de perfil visibles públicamente" on storage.objects;
create policy "Fotos de perfil visibles públicamente"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Cada quien sube su propia foto de perfil" on storage.objects;
create policy "Cada quien sube su propia foto de perfil"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Cada quien reemplaza su propia foto de perfil" on storage.objects;
create policy "Cada quien reemplaza su propia foto de perfil"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- TABLA: verifications
-- Verificación de identidad de los técnicos (ej. INE). El documento
-- NUNCA es público: solo el propio técnico y un admin pueden verlo.
-- ============================================================
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.profiles(id) on delete cascade,
  document_url text not null,
  address_proof_url text,
  status text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Si la tabla ya existía de una versión anterior, agrega el comprobante
-- de domicilio (no borra ningún dato).
alter table public.verifications add column if not exists address_proof_url text;

alter table public.verifications enable row level security;

drop policy if exists "Un técnico ve sus verificaciones, admin ve todas" on public.verifications;
create policy "Un técnico ve sus verificaciones, admin ve todas"
  on public.verifications for select
  using (
    auth.uid() = technician_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Un técnico sube su propia verificación" on public.verifications;
create policy "Un técnico sube su propia verificación"
  on public.verifications for insert
  with check (auth.uid() = technician_id);

drop policy if exists "Solo un admin aprueba o rechaza verificaciones" on public.verifications;
create policy "Solo un admin aprueba o rechaza verificaciones"
  on public.verifications for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ============================================================
-- COLUMNA: profiles.verified_specialties
-- Especialidades que el técnico realmente comprobó con fotos y que
-- un admin aprobó. Solo estas categorías reciben solicitudes nuevas
-- (a diferencia de "specialties", que es lo que el técnico dice hacer).
-- ============================================================
alter table public.profiles add column if not exists verified_specialties text[] not null default '{}';

-- ============================================================
-- TABLA: skill_verifications
-- Un técnico sube una foto que demuestre su habilidad en una
-- categoría (ej. una foto de un trabajo de plomería terminado, un
-- certificado, herramientas, etc.). Un admin la aprueba o rechaza.
-- No es obligatorio verificar todas las categorías — solo se le
-- envían solicitudes nuevas de las que sí tiene aprobadas.
-- ============================================================
create table if not exists public.skill_verifications (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  photo_url text not null,
  status text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (technician_id, category)
);

alter table public.skill_verifications enable row level security;

drop policy if exists "Un técnico ve sus verificaciones de habilidad, admin ve todas" on public.skill_verifications;
create policy "Un técnico ve sus verificaciones de habilidad, admin ve todas"
  on public.skill_verifications for select
  using (
    auth.uid() = technician_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Un técnico sube o actualiza su propia verificación de habilidad" on public.skill_verifications;
create policy "Un técnico sube o actualiza su propia verificación de habilidad"
  on public.skill_verifications for insert
  with check (auth.uid() = technician_id);

drop policy if exists "Un técnico actualiza su propia verificación de habilidad" on public.skill_verifications;
create policy "Un técnico actualiza su propia verificación de habilidad"
  on public.skill_verifications for update
  using (auth.uid() = technician_id);

drop policy if exists "Solo un admin aprueba o rechaza habilidades" on public.skill_verifications;
create policy "Solo un admin aprueba o rechaza habilidades"
  on public.skill_verifications for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ============================================================
-- STORAGE: bucket PRIVADO para documentos de identidad (INE, etc.)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

drop policy if exists "Un técnico sube su propio documento de identidad" on storage.objects;
create policy "Un técnico sube su propio documento de identidad"
  on storage.objects for insert
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Un técnico ve su documento, admin ve todos" on storage.objects;
create policy "Un técnico ve su documento, admin ve todos"
  on storage.objects for select
  using (
    bucket_id = 'verification-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

-- ============================================================
-- TABLA: reviews
-- Calificación real que el cliente deja después de que un servicio
-- se marca como completado. El rating público del técnico (perfiles)
-- se recalcula solo, automáticamente, con un trigger — nunca es un
-- número inventado.
-- ============================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  technician_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (service_request_id)
);

alter table public.reviews enable row level security;

drop policy if exists "Las reseñas son visibles públicamente" on public.reviews;
create policy "Las reseñas son visibles públicamente"
  on public.reviews for select
  using (true);

drop policy if exists "Un cliente reseña su propia solicitud completada" on public.reviews;
create policy "Un cliente reseña su propia solicitud completada"
  on public.reviews for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id and sr.client_id = auth.uid() and sr.status = 'completada'
    )
  );

-- Recalcula el rating y el número de reseñas del técnico cada vez
-- que se guarda una reseña nueva (nunca un número inventado).
create or replace function public.update_technician_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set
    rating = (select round(avg(rating)::numeric, 1) from public.reviews where technician_id = new.technician_id),
    review_count = (select count(*) from public.reviews where technician_id = new.technician_id)
  where id = new.technician_id;
  return new;
end;
$$;

drop trigger if exists on_review_created on public.reviews;
create trigger on_review_created
  after insert on public.reviews
  for each row execute procedure public.update_technician_rating();

-- Si ya tenías técnicos de antes con el "5.0" fijo de ejemplo, esto lo
-- limpia para los que todavía no tienen ninguna reseña real (no borra
-- reseñas ni afecta a quien ya tiene calificaciones de verdad).
update public.profiles set rating = null, review_count = 0
where role = 'tecnico' and not exists (select 1 from public.reviews where technician_id = profiles.id);

-- Actualizar automáticamente los trabajos completados del técnico
create or replace function public.update_technician_jobs_completed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'completada' and (old.status is null or old.status != 'completada') and new.technician_id is not null then
    update public.profiles set
      jobs_completed = (select count(*) from public.service_requests where technician_id = new.technician_id and status = 'completada')
    where id = new.technician_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_request_completed on public.service_requests;
create trigger on_request_completed
  after update on public.service_requests
  for each row execute procedure public.update_technician_jobs_completed();

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
  address text,
  description text,
  status text not null default 'confirmada' check (status in ('confirmada','aceptada','completada','cancelada')),
  price_min numeric not null,
  price_max numeric not null,
  visit_fee numeric not null default 150,
  final_price numeric,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now()
);

-- Si la tabla ya existía de una versión anterior, agrega las columnas
-- nuevas (no borra ningún dato).
alter table public.service_requests add column if not exists address text;
alter table public.service_requests add column if not exists description text;
alter table public.service_requests add column if not exists visit_fee numeric not null default 150;
alter table public.service_requests add column if not exists final_price numeric;
alter table public.service_requests add column if not exists latitude numeric;
alter table public.service_requests add column if not exists longitude numeric;
alter table public.service_requests add column if not exists photo_url text;
alter table public.service_requests add column if not exists tech_justification text;
alter table public.service_requests add column if not exists security_pin text;
alter table public.service_requests add column if not exists pin_verified boolean default false;
alter table public.service_requests add column if not exists timer_started_at timestamptz;

-- Si la tabla ya existía de una versión anterior, actualiza la lista de
-- estados permitidos para incluir 'aceptada' (no borra ninguna fila).
alter table public.service_requests drop constraint if exists service_requests_status_check;
alter table public.service_requests add constraint service_requests_status_check
  check (status in ('confirmada','aceptada','completada','cancelada'));

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

-- Un técnico ve las solicitudes abiertas SOLO de las categorías donde
-- ya tiene su habilidad verificada y aprobada, y también las que ya
-- son suyas (una vez que el cliente lo elige).
drop policy if exists "Técnicos ven solicitudes sin asignar y las suyas" on public.service_requests;
drop policy if exists "Técnicos ven solicitudes abiertas y las suyas" on public.service_requests;
drop policy if exists "Técnicos ven solicitudes de sus categorías verificadas" on public.service_requests;
create policy "Técnicos ven solicitudes de sus categorías verificadas"
  on public.service_requests for select
  using (
    auth.uid() = technician_id
    or (
      status = 'confirmada'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
        and service_requests.category = any(p.verified_specialties)
      )
    )
  );

-- Un cliente solo puede crear solicitudes a su propio nombre
drop policy if exists "Un cliente crea sus propias solicitudes" on public.service_requests;
create policy "Un cliente crea sus propias solicitudes"
  on public.service_requests for insert
  with check (auth.uid() = client_id);

-- Ya NO existe una política de "el primer técnico que acepta se la queda":
-- ahora los técnicos ofertan (tabla service_offers) y es el CLIENTE quien
-- elige. Por eso el cliente necesita permiso para actualizar su propia
-- solicitud (para asignar el técnico elegido).
drop policy if exists "Un técnico acepta una solicitud sin asignar" on public.service_requests;
drop policy if exists "Un cliente elige al técnico de su solicitud" on public.service_requests;
create policy "Un cliente elige al técnico de su solicitud"
  on public.service_requests for update
  using (auth.uid() = client_id);

-- ============================================================
-- TABLA: service_offers
-- Cada técnico puede mandar SU PROPIA oferta (precio) a una solicitud
-- abierta. El cliente ve todas las ofertas recibidas y elige una —
-- ahí es cuando la solicitud se asigna de verdad a ese técnico.
-- ============================================================
create table if not exists public.service_offers (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  technician_id uuid not null references public.profiles(id) on delete cascade,
  offer_price numeric not null,
  client_counter_price numeric,
  status text not null default 'pendiente' check (status in ('pendiente','contraoferta','elegida','rechazada')),
  created_at timestamptz not null default now(),
  unique (service_request_id, technician_id)
);

alter table public.service_offers enable row level security;
alter table public.service_offers add column if not exists justification text;
alter table public.service_requests add column if not exists tech_justification text;

drop policy if exists "Ver ofertas: propio técnico, cliente dueño, admin" on public.service_offers;
create policy "Ver ofertas: propio técnico, cliente dueño, admin"
  on public.service_offers for select
  using (
    auth.uid() = technician_id
    or exists (select 1 from public.service_requests sr where sr.id = service_request_id and sr.client_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Un técnico crea su propia oferta" on public.service_offers;
create policy "Un técnico crea su propia oferta"
  on public.service_offers for insert
  with check (auth.uid() = technician_id);

drop policy if exists "Técnico actualiza su propia oferta" on public.service_offers;
create policy "Técnico actualiza su propia oferta"
  on public.service_offers for update
  using (auth.uid() = technician_id);

drop policy if exists "Cliente actualiza ofertas de sus solicitudes" on public.service_offers;
create policy "Cliente actualiza ofertas de sus solicitudes"
  on public.service_offers for update
  using (exists (select 1 from public.service_requests sr where sr.id = service_request_id and sr.client_id = auth.uid()));

