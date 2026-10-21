import Link from "next/link";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/constants";
import { baht, normalizePhone, thaiDate } from "@/lib/format";
import { requireStaff } from "@/lib/server/auth";
import { getPoints } from "@/lib/server/orders";
import { db } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/types";
import { PointsForm } from "./client";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  await requireStaff("admin");
  const sp = await searchParams;
  const phone = normalizePhone(sp.phone ?? "");

  const customer = phone
    ? (await db().from("customers").select("*").eq("phone", phone).maybeSingle()).data
    : null;
  const [orders, points, recent] = await Promise.all([
    customer
      ? db()
          .from("orders")
          .select("id, order_no, status, total, total_sheets, free_sheets, created_at")
          .eq("customer_phone", phone)
          .order("created_at", { ascending: false })
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    customer ? getPoints(phone) : Promise.resolve(null),
    !phone
      ? db()
          .from("customer_points")
          .select("phone, points, order_count")
          .order("points", { ascending: false })
          .limit(30)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ลูกค้า</h1>
      <form className="flex gap-2" action="/admin/customers">
        <input name="phone" defaultValue={sp.phone} className="input" inputMode="tel" placeholder="ค้นด้วยเบอร์โทร" />
        <button className="btn-secondary">ค้นหา</button>
      </form>

      {phone && !customer && <p className="card text-muted">ไม่พบลูกค้าเบอร์นี้</p>}

      {customer && points && (
        <>
          <div className="card space-y-2">
            <p className="text-lg font-bold">
              {customer.name} · {customer.phone}
            </p>
            {customer.line_user_id && <p className="text-sm text-ok">✓ เชื่อม LINE แล้ว</p>}
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="ยอดสะสม" value={`${points.points}`} />
              <Stat label="รอตรวจสลิป" value={`${points.pending}`} />
              <Stat label="ปรับโดยแอดมิน" value={`${customer.points_adjustment > 0 ? "+" : ""}${customer.points_adjustment}`} />
            </div>
            <PointsForm phone={customer.phone} adjustment={customer.points_adjustment} note={customer.note ?? ""} />
          </div>
          <div className="card">
            <h2 className="mb-2 font-bold">ประวัติออเดอร์ ({orders.length})</h2>
            <div className="divide-y divide-line">
              {orders.map((o) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-brand-50/40">
                  <span>
                    <b>{o.order_no}</b> <span className="text-muted">{thaiDate(o.created_at)}</span>
                  </span>
                  <span className="text-muted">
                    {o.total_sheets} แผ่น{o.free_sheets ? ` +${o.free_sheets}` : ""} · {baht(Number(o.total))}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[o.status as OrderStatus]}`}>
                    {STATUS_LABEL[o.status as OrderStatus]}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {!phone && (
        <div className="card">
          <h2 className="mb-2 font-bold">ลูกค้ายอดสะสมสูงสุด</h2>
          <div className="divide-y divide-line">
            {recent.map((c) => (
              <Link key={c.phone} href={`/admin/customers?phone=${c.phone}`} className="flex justify-between py-2 text-sm hover:bg-brand-50/40">
                <span>{c.phone}</span>
                <span className="text-muted">
                  {c.points} แผ่น · {c.order_count} ออเดอร์
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-3">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
