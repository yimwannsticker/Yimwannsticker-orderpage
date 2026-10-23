import Link from "next/link";
import { requireStaff } from "@/lib/server/auth";
import { db } from "@/lib/supabase/admin";
import { logout } from "../actions";
import { AutoRefresh } from "./ui";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const { count } = await db().from("orders").select("id", { count: "exact", head: true }).eq("needs_attention", true);
  const isAdmin = staff.role === "admin";
  const nav = [
    { href: "/admin", label: "ออเดอร์" },
    { href: "/admin/tracking-import", label: "นำเข้าเลขแทร็ค" },
    ...(isAdmin
      ? [
          { href: "/admin/shop", label: "สินค้า A5" },
          { href: "/admin/reports", label: "รายงาน" },
          { href: "/admin/customers", label: "ลูกค้า" },
          { href: "/admin/settings", label: "ตั้งค่า" },
          { href: "/admin/staff", label: "พนักงาน" },
        ]
      : []),
  ];
  return (
    <div className="min-h-screen">
      <AutoRefresh seconds={60} />
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link href="/admin" className="font-bold text-brand-600">
            Yimwann หลังบ้าน
          </Link>
          {!!count && (
            <Link href="/admin?attention=1" className="rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-bold text-white">
              ใหม่ {count}
            </Link>
          )}
          <div className="flex-1" />
          <span className="hidden text-sm text-muted sm:inline">
            {staff.email} · {isAdmin ? "แอดมิน" : "กราฟิก"}
          </span>
          <form action={logout}>
            <button className="btn-ghost btn-sm">ออกจากระบบ</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium hover:bg-brand-50">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
    </div>
  );
}
