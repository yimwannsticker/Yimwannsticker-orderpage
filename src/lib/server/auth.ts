import "server-only";
import { redirect } from "next/navigation";
import { db } from "../supabase/admin";
import { authClient } from "../supabase/server";

export type Role = "admin" | "graphic";

export interface Staff {
  userId: string;
  email: string;
  role: Role;
}

export async function getStaff(): Promise<Staff | null> {
  const supa = await authClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return null;
  const { data } = await db().from("staff").select("role, email").eq("user_id", user.id).maybeSingle();
  if (data) return { userId: user.id, email: data.email, role: data.role as Role };

  // คนแรกที่ล็อกอินด้วยอีเมลใน ADMIN_EMAILS จะได้สิทธิ์แอดมินอัตโนมัติ
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && admins.includes(user.email.toLowerCase())) {
    await db().from("staff").upsert({ user_id: user.id, email: user.email, role: "admin" });
    return { userId: user.id, email: user.email, role: "admin" };
  }
  return null;
}

/** ใช้ในหน้า/แอคชันหลังบ้าน ถ้าไม่มีสิทธิ์จะเด้งไปหน้าล็อกอิน */
export async function requireStaff(role?: Role): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  if (role === "admin" && staff.role !== "admin") redirect("/admin");
  return staff;
}
