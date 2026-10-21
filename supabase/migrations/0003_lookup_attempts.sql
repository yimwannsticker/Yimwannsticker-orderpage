-- จำกัดจำนวนครั้งที่ลองยืนยันชื่อ + เบอร์โทร (กันเดาข้อมูลคนอื่น)
create table if not exists public.lookup_attempts (
  id bigserial primary key,
  key text not null,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists lookup_attempts_key_idx on public.lookup_attempts (key, created_at desc);
alter table public.lookup_attempts enable row level security;
