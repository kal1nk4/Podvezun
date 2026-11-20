-- Таблица активных заявок водителей и пассажиров для «Подвезнун» (Харьков)
-- Выполните этот скрипт в Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('driver', 'passenger')),
  author_id text not null,
  author_name text not null,
  author_username text,
  author_photo_url text,
  from_name text not null,
  from_lat double precision not null,
  from_lng double precision not null,
  to_name text not null,
  to_lat double precision not null,
  to_lng double precision not null,
  departure_label text not null,
  price_uah integer not null default 0 check (price_uah >= 0 and price_uah <= 5000),
  seats integer not null default 1 check (seats >= 1 and seats <= 4),
  comment text not null default '',
  created_at timestamptz not null default now()
);

-- Индекс для быстрой выборки свежих заявок (за последние 3 часа)
create index if not exists rides_created_at_idx on public.rides (created_at desc);
create index if not exists rides_author_id_idx on public.rides (author_id);

-- Включаем Row Level Security (RLS)
alter table public.rides enable row level security;

-- Разрешаем чтение активных заявок (не старше 3 часов) всем пользователям Mini App
create policy "Public read active rides"
  on public.rides
  for select
  using (created_at >= now() - interval '3 hours');

-- Разрешаем публикацию заявок через anon key (в продакшене можно усилить проверкой Telegram initData через Edge Function)
create policy "Public insert rides"
  on public.rides
  for insert
  with check (true);

-- Разрешаем удаление заявки (клиент фильтрует по author_id; для строгой проверки используйте Edge Function с initData)
create policy "Public delete rides"
  on public.rides
  for delete
  using (true);

-- Включаем Realtime для мгновенного обновления карты и ленты
alter publication supabase_realtime add table public.rides;
