-- ลูกค้าเลือกตัดพื้นหลังสีพื้นรอบงาน: ส่วนที่ใช้จริง (สัดส่วน 0–1 ของไฟล์) + สีพื้นหลัง
alter table public.order_items
  add column if not exists trim jsonb;
