-- งานตั้งเวลาเขียนแถวนี้ทุกครั้งที่ทำงาน กัน Supabase แพ็กเกจฟรีพักโปรเจกต์เพราะไม่มีการใช้งาน
create table if not exists public.app_heartbeat (
  id int primary key default 1 check (id = 1),
  at timestamptz not null default now()
);
alter table public.app_heartbeat enable row level security;
