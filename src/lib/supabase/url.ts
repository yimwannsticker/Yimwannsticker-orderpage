/**
 * URL ของโปรเจกต์ Supabase ใช้เฉพาะส่วนโดเมน
 * (กันกรณีคัดลอกมาพร้อม /rest/v1/ หรือ / ท้าย ซึ่งทำให้ล็อกอินขึ้น "Invalid path specified in request URL")
 */
export function supabaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}
