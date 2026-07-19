-- ── THE WILL OF FOCUS: Database Schema ──
-- Run this once in Supabase Dashboard → SQL Editor → New Query → Run

-- Each user gets one profile row, created automatically on signup
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  total_exp numeric not null default 0,
  coins numeric not null default 0,
  current_streak int not null default 0,
  last_study_date date,
  created_at timestamp with time zone default now()
);

-- Every logged study session becomes one row here
create table if not exists study_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  hours numeric not null check (hours > 0),
  logged_date date not null default current_date,
  note text,
  created_at timestamp with time zone default now()
);

-- Row Level Security: users can only see/edit their own data,
-- but everyone in the app can see everyone's profile (needed for
-- party/leaderboard features later)
alter table profiles enable row level security;
alter table study_logs enable row level security;

create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Study logs are viewable by everyone"
  on study_logs for select using (true);

create policy "Users can insert their own study logs"
  on study_logs for insert with check (auth.uid() = user_id);

-- Auto-create a profile row the moment someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
