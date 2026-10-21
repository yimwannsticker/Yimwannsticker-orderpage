import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseUrl } from "./url";

/** client ที่ผูกกับ session ของผู้ใช้ (ใช้แค่ระบบล็อกอินหลังบ้าน) */
export async function authClient() {
  const store = await cookies();
  return createServerClient(supabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // เรียกจาก Server Component ตั้ง cookie ไม่ได้ ให้ proxy เป็นคนรีเฟรชแทน
        }
      },
    },
  });
}
