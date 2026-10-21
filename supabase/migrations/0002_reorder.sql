-- สั่งซ้ำแบบเดิม: รายการที่ใช้ไฟล์จากออเดอร์ก่อน
alter table public.order_items
  add column if not exists reorder_of uuid references public.order_items (id) on delete set null;
create index if not exists order_items_file_path_idx on public.order_items (file_path);
