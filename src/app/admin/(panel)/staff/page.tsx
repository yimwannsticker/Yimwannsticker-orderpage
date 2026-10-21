import { requireStaff } from "@/lib/server/auth";
import { db } from "@/lib/supabase/admin";
import { StaffManager } from "./client";

export default async function StaffPage() {
  const me = await requireStaff("admin");
  const { data } = await db().from("staff").select("user_id, email, role").order("created_at");
  return <StaffManager me={me.userId} staff={(data ?? []) as { user_id: string; email: string; role: "admin" | "graphic" }[]} />;
}
