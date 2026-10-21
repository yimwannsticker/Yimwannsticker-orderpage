-- Yimwann Sticker: โครงสร้างฐานข้อมูล
-- ทุกตารางเปิด RLS และไม่มี policy = ปิดการเข้าถึงจาก anon key ทั้งหมด
-- แอปเข้าถึงผ่าน server ด้วย service role เท่านั้น

create extension if not exists pgcrypto;

-- ตั้งค่าร้าน (แถวเดียว)
create table public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id, data) values (1, '{}'::jsonb) on conflict do nothing;

-- พนักงานหลังบ้าน
create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin', 'graphic')),
  created_at timestamptz not null default now()
);

-- ลูกค้า (ระบุตัวด้วยเบอร์โทร)
create table public.customers (
  phone text primary key,
  name text,
  line_user_id text,
  points_adjustment int not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ไฟล์ที่อัปโหลดเข้ามาแล้ว (ก่อนผูกกับออเดอร์)
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  kind text not null check (kind in ('artwork', 'preview', 'slip')),
  file_name text not null,
  size bigint not null default 0,
  check_result jsonb,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index uploads_unused_idx on public.uploads (created_at) where not used;

create sequence public.order_no_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('YW' || nextval('public.order_no_seq')),
  token text not null unique,
  status text not null default 'pending_slip'
    check (status in ('pending_slip', 'paid', 'producing', 'shipped', 'cancelled')),
  customer_phone text not null references public.customers (phone) on update cascade,
  customer_name text not null,
  address jsonb not null,
  line_user_id text,
  -- จำนวนแผ่นที่จ่ายเงิน (ไม่รวมแผ่นแถม) ใช้นับยอดสะสม
  total_sheets int not null,
  free_sheets int not null default 0,
  subtotal numeric(10, 2) not null,
  fix_fee_total numeric(10, 2) not null default 0,
  shipping_fee numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  -- เรทราคาและเงื่อนไข ณ ตอนสั่ง
  pricing_snapshot jsonb not null,
  slip_path text,
  slip_uploaded_at timestamptz,
  slip_rejected_reason text,
  slip_verify jsonb,
  paid_at timestamptz,
  producing_at timestamptz,
  shipped_at timestamptz,
  cancelled_at timestamptz,
  carrier text,
  tracking_no text,
  line_notified_at timestamptz,
  needs_attention boolean not null default true,
  attention_note text,
  files_deleted_at timestamptz,
  customer_note text,
  admin_note text,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_phone_idx on public.orders (customer_phone);
create index orders_attention_idx on public.orders (needs_attention) where needs_attention;
create index orders_shipped_idx on public.orders (shipped_at) where files_deleted_at is null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  position int not null,
  file_path text,
  file_name text not null,
  file_size bigint not null default 0,
  preview_path text,
  check_result jsonb,
  accept_risk boolean not null default false,
  fix_service boolean not null default false,
  fix_fee numeric(10, 2) not null default 0,
  product text not null check (product in ('paper', 'pp')),
  finish text not null check (finish in ('gloss', 'matte', 'clear')),
  qty int not null check (qty > 0),
  free_qty int not null default 0 check (free_qty >= 0),
  unit_price numeric(10, 2) not null,
  line_total numeric(10, 2) not null,
  reupload_requested boolean not null default false,
  reupload_reason text,
  reuploaded_at timestamptz,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id, position);

-- updated_at อัตโนมัติ
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

-- ยอดสะสม = แผ่นที่ชำระแล้วทุกออเดอร์ + ยอดที่แอดมินปรับ
create or replace view public.customer_points with (security_invoker = true) as
select
  c.phone,
  c.points_adjustment
    + coalesce(sum(o.total_sheets) filter (where o.status in ('paid', 'producing', 'shipped')), 0)::int as points,
  coalesce(sum(o.total_sheets) filter (where o.status = 'pending_slip'), 0)::int as pending_sheets,
  count(o.id) filter (where o.status <> 'cancelled')::int as order_count
from public.customers c
left join public.orders o on o.customer_phone = c.phone
group by c.phone, c.points_adjustment;

alter table public.settings enable row level security;
alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.uploads enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.customer_points from anon, authenticated;

-- Storage: bucket ส่วนตัว จำกัดขนาดไฟล์ 200MB
-- (Supabase แพ็กเกจฟรีจำกัดไฟล์ละ 50MB ทั้งโปรเจกต์ ต้องอัปเกรดเป็น Pro ถึงจะรับ 200MB ได้)
insert into storage.buckets (id, name, public, file_size_limit)
values ('order-files', 'order-files', false, 209715200)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
