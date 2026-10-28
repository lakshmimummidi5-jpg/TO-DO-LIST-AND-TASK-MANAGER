-- TaskFlow Supabase schema
-- Run this script in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text,
  due_date date,
  priority text not null default 'medium'
    check (priority in ('someday', 'low', 'medium', 'high', 'urgent')),
  category text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep the expanded priority set compatible when this schema is re-run on an older table.
alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check
  check (priority in ('someday', 'low', 'medium', 'high', 'urgent'));

create index if not exists tasks_due_date_idx on public.tasks(due_date);
create index if not exists tasks_completed_idx on public.tasks(completed);
create index if not exists tasks_priority_idx on public.tasks(priority);
create index if not exists tasks_created_at_idx on public.tasks(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- Row Level Security is enabled. This starter app accesses the table through
-- the Node backend using SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- Never put the service-role key in frontend JavaScript or commit it to Git.
alter table public.tasks enable row level security;
