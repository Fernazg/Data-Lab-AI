-- DATA LAB AI — esquema de persistencia.
-- Cada tabla guarda el objeto de dominio completo en `data` (jsonb).
-- El servidor accede con la service role key; RLS activado sin políticas públicas
-- para que la clave anónima no pueda leer ni escribir nada.

create table if not exists dl_projects (
  id text primary key,
  project_id text,
  created_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists dl_tasks (
  id text primary key,
  project_id text,
  created_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists dl_activity (
  id text primary key,
  project_id text,
  created_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists dl_findings (
  id text primary key,
  project_id text,
  created_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists dl_approvals (
  id text primary key,
  project_id text,
  created_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists dl_memory (
  id text primary key,
  project_id text,
  created_at timestamptz not null default now(),
  data jsonb not null
);

create index if not exists dl_tasks_project_idx on dl_tasks (project_id);
create index if not exists dl_activity_project_idx on dl_activity (project_id);
create index if not exists dl_findings_project_idx on dl_findings (project_id);
create index if not exists dl_activity_created_idx on dl_activity (created_at);

alter table dl_projects enable row level security;
alter table dl_tasks enable row level security;
alter table dl_activity enable row level security;
alter table dl_findings enable row level security;
alter table dl_approvals enable row level security;
alter table dl_memory enable row level security;
