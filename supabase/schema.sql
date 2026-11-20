-- Таблица активных заявок водителей и пассажиров для «Подвезун» (Харьков)
-- Выполните этот скрипт в Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('driver', 'passenger')),
  author_id text not null,
  creator_telegram_id bigint,
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
  tags text[] not null default '{}',
  expires_at timestamptz not null default (now() + interval '3 hours'),
  created_at timestamptz not null default now()
);

-- Индексы для быстрой выборки свежих заявок
create index if not exists rides_created_at_idx on public.rides (created_at desc);
create index if not exists rides_expires_at_idx on public.rides (expires_at desc);
create index if not exists rides_author_id_idx on public.rides (author_id);

-- Включаем Row Level Security (RLS)
alter table public.rides enable row level security;

-- Разрешаем чтение активных заявок всем пользователям Mini App
create policy "Public read active rides"
  on public.rides
  for select
  using (coalesce(expires_at, created_at + interval '3 hours') >= now());

-- Разрешаем публикацию заявок через anon key (в продакшене можно усилить проверкой Telegram initData через Edge Function)
create policy "Public insert rides"
  on public.rides
  for insert
  with check (true);

-- Разрешаем обновление мест и продление своей заявки
create policy "Public update rides"
  on public.rides
  for update
  using (true)
  with check (true);

-- Разрешаем удаление заявки (клиент фильтрует по author_id; для строгой проверки используйте Edge Function с initData)
create policy "Public delete rides"
  on public.rides
  for delete
  using (true);

-- Таблица подписок радара попутчиков (для опциональных уведомлений через Telegram-бота)
create table if not exists public.route_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  from_name text not null,
  to_name text not null,
  role text not null default 'all' check (role in ('all', 'driver', 'passenger')),
  created_at timestamptz not null default now()
);

alter table public.route_alerts enable row level security;
create policy "Public manage route alerts"
  on public.route_alerts
  for all
  using (true)
  with check (true);

-- Лёгкие профили пользователей на базе Telegram WebApp
create table if not exists public.profiles (
  telegram_id bigint primary key,
  first_name text not null,
  username text,
  role text not null default 'driver' check (role in ('driver', 'passenger', 'both')),
  car_info text not null default '',
  bio text not null default '',
  completed_rides integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Public read and upsert profiles"
  on public.profiles
  for all
  using (true)
  with check (true);

-- Быстрые теги доверия после поездки
create table if not exists public.ride_feedback (
  id uuid primary key default gen_random_uuid(),
  ride_id text not null,
  from_telegram_id bigint not null,
  to_telegram_id bigint not null,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (ride_id, from_telegram_id)
);

alter table public.ride_feedback enable row level security;
create policy "Public manage ride feedback"
  on public.ride_feedback
  for all
  using (true)
  with check (true);

-- Включаем Realtime для мгновенного обновления карты и ленты
alter publication supabase_realtime add table public.rides;

