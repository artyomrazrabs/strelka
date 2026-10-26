-- Стрелка: схема базы данных.
-- Вставьте весь файл в Supabase → SQL Editor → New query и нажмите Run.

-- Профили игроков
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nick text not null unique check (nick ~ '^[a-z0-9_]{3,20}$'),
  bio text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles
  for select to authenticated using (true);

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Стрелки (вызовы)
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  opponent_id uuid references public.profiles (id) on delete set null,
  -- user: конкретному игроку, link: по ссылке (почта, соцсети), open: открытый вызов
  target text not null check (target in ('user', 'link', 'open')),
  call_text text not null check (char_length(call_text) between 1 and 200),
  category text not null check (char_length(category) between 1 and 40),
  description text check (char_length(description) <= 1000),
  mode text not null default 'offline' check (mode in ('online', 'offline')),
  place text check (char_length(place) <= 120),
  platform text check (char_length(platform) <= 60),
  starts_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'countered', 'accepted', 'declined', 'cancelled', 'done', 'conflict')),
  proposal jsonb,
  author_result text check (author_result in ('win', 'lose')),
  opponent_result text check (opponent_result in ('win', 'lose')),
  created_at timestamptz not null default now()
);

create index if not exists challenges_author_idx on public.challenges (author_id);
create index if not exists challenges_opponent_idx on public.challenges (opponent_id);
create index if not exists challenges_open_idx on public.challenges (target, status);

alter table public.challenges enable row level security;

drop policy if exists "challenges readable" on public.challenges;
create policy "challenges readable" on public.challenges
  for select to authenticated
  using (auth.uid() = author_id or auth.uid() = opponent_id or target in ('open', 'link'));

drop policy if exists "challenges insert" on public.challenges;
create policy "challenges insert" on public.challenges
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "challenges update" on public.challenges;
create policy "challenges update" on public.challenges
  for update to authenticated
  using (
    auth.uid() = author_id
    or auth.uid() = opponent_id
    or (target in ('open', 'link') and opponent_id is null and status = 'pending')
  )
  with check (auth.uid() = author_id or auth.uid() = opponent_id);

-- Защита: каждый вносит только свой результат.
-- Когда оба ответили, статус считается сам: ответы разные — засчитано, одинаковые — конфликт.
create or replace function public.challenge_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is distinct from old.author_id then
    new.author_result := old.author_result;
    new.author_id := old.author_id;
  end if;
  if auth.uid() is distinct from new.opponent_id then
    new.opponent_result := old.opponent_result;
  end if;
  -- чужой человек может только занять свободное место соперника
  if auth.uid() is distinct from old.author_id and old.opponent_id is not null
     and new.opponent_id is distinct from old.opponent_id then
    new.opponent_id := old.opponent_id;
  end if;
  if new.author_result is not null and new.opponent_result is not null then
    new.status := case when new.author_result <> new.opponent_result then 'done' else 'conflict' end;
  end if;
  return new;
end $$;

drop trigger if exists challenge_guard on public.challenges;
create trigger challenge_guard before update on public.challenges
  for each row execute function public.challenge_guard();
