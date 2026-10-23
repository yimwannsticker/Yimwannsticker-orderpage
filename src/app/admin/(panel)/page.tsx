import Link from "next/link";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/constants";
import { baht, thaiDate } from "@/lib/format";
import { requireStaff } from "@/lib/server/auth";
import { getQuota } from "@/lib/server/line";
import { db } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/types";
import { PrintSelected } from "./print-select";

const FILTERS: { key: string; label: string }[] = [
  { key: "active", label: "ต้องทำ" },
  { key: "pending_slip", label: STATUS_LABEL.pending_slip },
  { key: "paid", label: STATUS_LABEL.paid },
  { key: "producing", label: STATUS_LABEL.producing },
  { key: "shipped", label: STATUS_LABEL.shipped },
  { key: "cancelled", label: STATUS_LABEL.cancelled },
  { key: "all", label: "ทั้งหมด" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; q?: string; attention?: string; page?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const status = sp.status ?? "active";
  const asc = sp.sort === "asc";
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = 30;
  const isAdmin = staff.role === "admin";

  let query = db()
    .from("orders")
    .select("id, order_no, status, customer_name, customer_phone, total, total_sheets, free_sheets, a5_sheets, needs_attention, attention_note, created_at, order_items(count)", {
      count: "exact",
    })
    .order("created_at", { ascending: asc })
    .range((page - 1) * perPage, page * perPage - 1);
  if (status === "active") query = query.in("status", isAdmin ? ["pending_slip", "paid", "producing"] : ["paid", "producing"]);
  else if (status !== "all") query = query.eq("status", status);
  if (sp.attention) query = query.eq("needs_attention", true);
  const q = (sp.q ?? "").trim();
  if (q) {
    const safe = q.replace(/[,()%]/g, "");
    query = query.or(`order_no.ilike.%${safe}%,customer_phone.ilike.%${safe.replace(/\D/g, "") || safe}%,customer_name.ilike.%${safe}%`);
  }
  const [{ data: orders, count }, quota] = await Promise.all([query, isAdmin ? getQuota() : Promise.resolve(null)]);

  const link = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { status, sort: asc ? "asc" : undefined, q: q || undefined, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `/admin?${u}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">ออเดอร์</h1>
        {quota && (
          <p className="rounded-xl bg-white px-3 py-1.5 text-sm text-muted ring-1 ring-line">
            โควตา LINE เดือนนี้: <b className="text-ink">{quota.used}</b>
            {quota.limit !== null ? ` / ${quota.limit}` : ""} ข้อความ
          </p>
        )}
      </div>

      <form className="flex gap-2" action="/admin">
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={q} placeholder="ค้นเลขออเดอร์ ชื่อ หรือเบอร์โทร" className="input" />
        <button className="btn-secondary">ค้นหา</button>
      </form>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {FILTERS.filter((f) => isAdmin || !["pending_slip", "cancelled"].includes(f.key)).map((f) => (
          <Link
            key={f.key}
            href={link({ status: f.key, page: undefined })}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              status === f.key ? "bg-brand-500 text-white" : "bg-white ring-1 ring-line"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <Link href={link({ sort: asc ? undefined : "asc" })} className="ml-auto whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-line">
          {asc ? "เก่าสุดก่อน ↑" : "ใหม่สุดก่อน ↓"}
        </Link>
      </div>

      {!orders?.length && <p className="card text-center text-muted">ไม่มีออเดอร์</p>}
      {/* เลือกหลายออเดอร์ → พิมพ์ใบรายการสินค้ารวมเป็น PDF ไฟล์เดียว */}
      {!!orders?.length && <PrintSelected />}

      {/* มือถือ: การ์ด / จอใหญ่: ตาราง */}
      <div className="grid gap-2 md:hidden">
        {orders?.map((o) => (
          <div key={o.id} className="card flex items-start gap-3 !p-4">
            <input type="checkbox" form="print-orders" name="ids" value={o.id} aria-label={`เลือก ${o.order_no}`} className="mt-1 h-5 w-5 shrink-0 accent-brand-500" />
            <Link href={`/admin/orders/${o.id}`} className="block min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">
                  {o.order_no}
                  {o.needs_attention && <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-brand-500 align-middle" />}
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[o.status as OrderStatus]}`}>
                  {STATUS_LABEL[o.status as OrderStatus]}
                </span>
              </div>
              <p className="mt-1 text-sm">
                {o.customer_name} · {o.customer_phone}
              </p>
              <p className="text-sm text-muted">
                {o.a5_sheets ? `A5 ${o.a5_sheets} แผ่น · ` : ""}
                {(o.order_items as unknown as { count: number }[])[0]?.count ?? 0} ไฟล์ · {o.total_sheets} แผ่น
                {o.free_sheets ? ` +แถม ${o.free_sheets}` : ""}
                {isAdmin && ` · ${baht(Number(o.total))}`}
              </p>
              <p className="text-xs text-muted">{thaiDate(o.created_at)}</p>
              {o.needs_attention && o.attention_note && <p className="mt-1 text-xs font-medium text-brand-600">{o.attention_note}</p>}
            </Link>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-muted">
            <tr>
              <th className="w-10 py-2 pl-4" />
              <th className="px-4 py-2 font-medium">ออเดอร์</th>
              <th className="px-4 py-2 font-medium">วันที่</th>
              <th className="px-4 py-2 font-medium">ลูกค้า</th>
              <th className="px-4 py-2 font-medium">จำนวน</th>
              {isAdmin && <th className="px-4 py-2 text-right font-medium">ยอด</th>}
              <th className="px-4 py-2 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o) => (
              <tr key={o.id} className="border-t border-line hover:bg-brand-50/40">
                <td className="py-2.5 pl-4">
                  <input type="checkbox" form="print-orders" name="ids" value={o.id} aria-label={`เลือก ${o.order_no}`} className="h-4 w-4 accent-brand-500" />
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/orders/${o.id}`} className="font-bold text-brand-600 hover:underline">
                    {o.order_no}
                  </Link>
                  {o.needs_attention && (
                    <span className="ml-2 rounded-full bg-brand-500 px-2 py-0.5 text-xs text-white" title={o.attention_note ?? ""}>
                      ใหม่
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted">{thaiDate(o.created_at)}</td>
                <td className="px-4 py-2.5">
                  {o.customer_name}
                  <span className="block text-xs text-muted">{o.customer_phone}</span>
                </td>
                <td className="px-4 py-2.5">
                  {o.a5_sheets ? <span className="block">A5 {o.a5_sheets} แผ่น</span> : null}
                  {((o.order_items as unknown as { count: number }[])[0]?.count ?? 0) > 0 && (
                    <>
                      {o.total_sheets} แผ่น{o.free_sheets ? ` +${o.free_sheets}` : ""}
                      <span className="block text-xs text-muted">{(o.order_items as unknown as { count: number }[])[0]?.count ?? 0} ไฟล์</span>
                    </>
                  )}
                </td>
                {isAdmin && <td className="px-4 py-2.5 text-right">{baht(Number(o.total))}</td>}
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[o.status as OrderStatus]}`}>
                    {STATUS_LABEL[o.status as OrderStatus]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(count ?? 0) > perPage && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link className="btn-secondary btn-sm" href={link({ page: String(page - 1) })}>
              ก่อนหน้า
            </Link>
          )}
          <span className="self-center text-sm text-muted">
            หน้า {page} / {Math.ceil((count ?? 0) / perPage)}
          </span>
          {page * perPage < (count ?? 0) && (
            <Link className="btn-secondary btn-sm" href={link({ page: String(page + 1) })}>
              ถัดไป
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
