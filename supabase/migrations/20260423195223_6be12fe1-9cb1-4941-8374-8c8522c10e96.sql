create table if not exists public.call_brief_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id uuid,
  name text not null,
  purpose text,
  brief text not null,
  enhanced text,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_call_brief_templates_user on public.call_brief_templates(user_id, updated_at desc);

alter table public.call_brief_templates enable row level security;

create policy "cbt_owner_select" on public.call_brief_templates
  for select to authenticated using (user_id = auth.uid());
create policy "cbt_owner_insert" on public.call_brief_templates
  for insert to authenticated with check (user_id = auth.uid());
create policy "cbt_owner_update" on public.call_brief_templates
  for update to authenticated using (user_id = auth.uid());
create policy "cbt_owner_delete" on public.call_brief_templates
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.touch_call_brief_templates()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_call_brief_templates on public.call_brief_templates;
create trigger trg_touch_call_brief_templates before update on public.call_brief_templates
  for each row execute function public.touch_call_brief_templates();