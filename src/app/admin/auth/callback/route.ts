import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/server";

/** รับลิงก์จากอีเมล (เข้าสู่ระบบ / ตั้งรหัสผ่าน) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/admin";
  if (code) {
    const supa = await authClient();
    await supa.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next.startsWith("/admin") ? next : "/admin", url.origin));
}
