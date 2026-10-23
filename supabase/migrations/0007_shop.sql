-- ร้านสติกเกอร์สำเร็จรูป A5: หมวดหมู่ นักออกแบบ สินค้า ขนาด ลาย และรายการในออเดอร์

create table if not exists public.shop_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- รูปไอคอน (path ใน R2) หรือ null ใช้ตัวอักษรแรก
  icon_path text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.designers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.shop_categories (id) on delete set null,
  name text not null,
  description text not null default '',
  pieces_per_sheet int,
  material text not null default '',
  -- รหัสลายของร้าน ใช้ขึ้นต้น SKU ของแต่ละลาย เช่น 33 → 33-01
  design_code text not null default '',
  designer_id uuid references public.designers (id) on delete set null,
  -- [{ path, thumb }] รูปแรก = รูปปก
  images jsonb not null default '[]',
  badge_best boolean not null default false,
  badge_new boolean not null default false,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_products_category_idx on public.shop_products (category_id, position);

create table if not exists public.shop_product_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products (id) on delete cascade,
  name text not null,
  -- บวกเพิ่มจากราคาขั้นบันได (บาท/แผ่น)
  surcharge numeric(10, 2) not null default 0,
  position int not null default 0
);
create index if not exists shop_product_sizes_product_idx on public.shop_product_sizes (product_id, position);

create table if not exists public.shop_designs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products (id) on delete cascade,
  name text not null,
  sku text not null,
  image_path text,
  thumb_path text,
  active boolean not null default true,
  position int not null default 0
);
create index if not exists shop_designs_product_idx on public.shop_designs (product_id, position);
create unique index if not exists shop_designs_sku_idx on public.shop_designs (lower(sku));

drop trigger if exists shop_products_touch on public.shop_products;
create trigger shop_products_touch before update on public.shop_products
  for each row execute function public.touch_updated_at();

-- ยอด A5 ของออเดอร์ (total_sheets เดิมยังเป็นแผ่น A3+ อย่างเดียว ใช้นับโปรสะสม)
alter table public.orders
  add column if not exists a5_sheets int not null default 0,
  add column if not exists a5_subtotal numeric(10, 2) not null default 0;

-- รายการ A5 ในออเดอร์ (เก็บชื่อ/รหัส ณ ตอนสั่ง แก้หรือลบสินค้าทีหลังรายงานไม่เพี้ยน)
create table if not exists public.order_a5_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  position int not null,
  product_id uuid references public.shop_products (id) on delete set null,
  design_id uuid references public.shop_designs (id) on delete set null,
  size_id uuid references public.shop_product_sizes (id) on delete set null,
  product_name text not null,
  design_name text not null,
  size_name text,
  sku text not null,
  designer_id uuid references public.designers (id) on delete set null,
  designer_name text,
  thumb_path text,
  qty int not null check (qty > 0),
  unit_price numeric(10, 2) not null,
  line_total numeric(10, 2) not null,
  -- ติ๊กหยิบของตอนแพ็ก
  picked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists order_a5_items_order_idx on public.order_a5_items (order_id, position);
create index if not exists order_a5_items_product_idx on public.order_a5_items (product_id);

-- ยอดขาย (แผ่น) ต่อสินค้า จากออเดอร์ที่ไม่ยกเลิก
create or replace view public.shop_product_sold with (security_invoker = true) as
select i.product_id, sum(i.qty)::int as sold
from public.order_a5_items i
join public.orders o on o.id = i.order_id
where o.status <> 'cancelled' and i.product_id is not null
group by i.product_id;

alter table public.shop_categories enable row level security;
alter table public.designers enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_product_sizes enable row level security;
alter table public.shop_designs enable row level security;
alter table public.order_a5_items enable row level security;
revoke all on public.shop_product_sold from anon, authenticated;

-- สินค้าราคาคงที่ (เช่น การ์ดแพ็ค 25/50/100 ใบ) และชื่อตัวเลือก/หน่วยที่ตั้งเองได้
alter table public.shop_products
  add column if not exists pricing text not null default 'a5' check (pricing in ('a5', 'fixed')),
  -- ชื่อปุ่มตัวเลือก เช่น ขนาด / สี / แพ็ค
  add column if not exists option_label text not null default 'ขนาด',
  -- หน่วยที่ขาย เช่น แผ่น / แพ็ค
  add column if not exists unit_label text not null default 'แผ่น',
  -- รหัสสินค้าใน Shopee (กันนำเข้าซ้ำ)
  add column if not exists shopee_item_id text;
create unique index if not exists shop_products_shopee_idx on public.shop_products (shopee_item_id) where shopee_item_id is not null;

alter table public.shop_product_sizes
  -- ราคาต่อหน่วยของสินค้าราคาคงที่
  add column if not exists price numeric(10, 2),
  -- จำนวนชิ้นต่อหน่วย (เช่น แพ็ค 25 ใบ = 25) ใช้นับเกณฑ์ส่งฟรีของสินค้าราคาคงที่
  add column if not exists units int;

alter table public.order_a5_items
  add column if not exists pricing text not null default 'a5',
  add column if not exists units int,
  add column if not exists unit_label text;
