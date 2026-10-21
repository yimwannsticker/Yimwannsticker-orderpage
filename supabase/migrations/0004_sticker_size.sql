-- ขนาดดวงและทรงไดคัทต่อรายการ
alter table public.order_items
  add column if not exists shape text check (shape in ('rect', 'circle', 'freeform')),
  add column if not exists width_mm numeric(6, 1),
  add column if not exists height_mm numeric(6, 1),
  add column if not exists per_sheet int;
