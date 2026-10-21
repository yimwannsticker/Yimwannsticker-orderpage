import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckBadge, CheckDetails, CopyButton } from "@/components/ui";
import { STATUS_COLOR, STATUS_LABEL, carrierInfo, productLabel } from "@/lib/constants";
import { baht, fileSizeText, formatAddress, thaiDate } from "@/lib/format";
import { requireStaff } from "@/lib/server/auth";
import { getItems, getPoints, signedUrls, statusUrl, type OrderRow } from "@/lib/server/orders";
import { db } from "@/lib/supabase/admin";
import { AdminNote, DownloadButton, ItemActions, MarkSeen, PaymentActions, StatusActions, TrackingForm } from "./client";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const { data } = await db().from("orders").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const order = data as OrderRow;
  const isAdmin = staff.role === "admin";
  const items = await getItems(order.id);
  const [previews, slipUrls, pts] = await Promise.all([
    signedUrls(items.map((i) => i.preview_path), 60 * 60),
    isAdmin && order.slip_path ? signedUrls([order.slip_path], 60 * 60) : Promise.resolve({} as Record<string, string>),
    getPoints(order.customer_phone),
  ]);
  // รายการที่สั่งซ้ำ: ชี้กลับไปออเดอร์เดิม ให้กราฟิกหาไฟล์ที่เคยแก้ไว้ได้
  const reorderIds = items.map((i) => i.reorder_of).filter(Boolean) as string[];
  const { data: prevRows } = reorderIds.length
    ? await db().from("order_items").select("id, position, fix_service, order_id, orders(order_no)").in("id", reorderIds)
    : { data: [] };
  const prev = new Map(
    (prevRows ?? []).map((r) => [
      r.id as string,
      { orderId: r.order_id as string, position: r.position as number, fixed: r.fix_service as boolean, orderNo: (r.orders as unknown as { order_no: string } | null)?.order_no ?? "" },
    ]),
  );
  const address = formatAddress(order.address);
  // รูปแบบสำหรับวางในระบบ MyOrder: ชื่อ เบอร์ ที่อยู่ รหัสไปรษณีย์
  const myOrderText = `${order.customer_name} ${order.customer_phone} ${address}`;

  return (
    <div className="space-y-4">
      {order.needs_attention && <MarkSeen orderId={order.id} />}
      <Link href="/admin" className="text-sm text-brand-600">
        ← รายการออเดอร์
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{order.order_no}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLOR[order.status]}`}>{STATUS_LABEL[order.status]}</span>
        <span className="text-sm text-muted">สั่งเมื่อ {thaiDate(order.created_at)}</span>
        <div className="ml-auto">
          <CopyButton text={statusUrl(order.token)} label="คัดลอกลิงก์หน้าเช็คสถานะ" />
        </div>
      </div>
      {order.needs_attention && order.attention_note && (
        <p className="rounded-2xl bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">🔔 {order.attention_note}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card space-y-4">
            <h2 className="font-bold">
              ไฟล์งาน ({items.length} ไฟล์ · {order.total_sheets} แผ่น{order.free_sheets ? ` + แถม ${order.free_sheets}` : ""})
            </h2>
            {order.files_deleted_at && <p className="text-sm text-muted">ไฟล์ถูกลบอัตโนมัติแล้วเมื่อ {thaiDate(order.files_deleted_at)}</p>}
            {items.map((i) => (
              <div key={i.id} className="rounded-2xl border border-line p-3">
                <div className="flex gap-3">
                  <a
                    href={i.preview_path ? previews[i.preview_path] : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-gray-50"
                  >
                    {i.preview_path && previews[i.preview_path] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[i.preview_path]} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-muted">ไม่มีตัวอย่าง</span>
                    )}
                  </a>
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <p className="font-semibold">
                      {i.position}. {i.file_name}
                    </p>
                    <p className="text-muted">{fileSizeText(i.file_size)}</p>
                    <p>
                      <b>{productLabel(i.product, i.finish)}</b> · {i.qty} แผ่น
                      {i.free_qty > 0 && <span className="font-semibold text-ok"> + แถม {i.free_qty} แผ่น</span>}
                      <span className="text-muted"> (พิมพ์ทั้งหมด {i.qty + i.free_qty} แผ่น)</span>
                    </p>
                    {isAdmin && (
                      <p className="text-muted">
                        {baht(Number(i.unit_price))}/แผ่น = {baht(Number(i.line_total))}
                        {i.fix_service && ` + แก้ไฟล์ ${baht(Number(i.fix_fee))}`}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {i.fix_service && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">ให้ร้านแก้ไฟล์</span>}
                      {i.accept_risk && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold">ลูกค้ายอมรับความเสี่ยง</span>}
                      {i.reorder_of && prev.get(i.reorder_of) && (
                        <Link
                          href={`/admin/orders/${prev.get(i.reorder_of)!.orderId}`}
                          className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 underline"
                        >
                          ↻ สั่งซ้ำจาก {prev.get(i.reorder_of)!.orderNo} รายการที่ {prev.get(i.reorder_of)!.position}
                          {prev.get(i.reorder_of)!.fixed && " (ครั้งก่อนร้านแก้ไฟล์ให้)"}
                        </Link>
                      )}
                      {i.reupload_requested && (
                        <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn">รอลูกค้าส่งไฟล์ใหม่</span>
                      )}
                      {i.reuploaded_at && <span className="rounded-full bg-ok-bg px-2 py-0.5 text-xs font-semibold text-ok">ส่งไฟล์ใหม่ {thaiDate(i.reuploaded_at)}</span>}
                    </div>
                  </div>
                </div>
                {i.check_result && (
                  <div className="mt-3 rounded-xl bg-gray-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CheckBadge level={i.check_result.level} title={i.check_result.title} />
                      <span className="text-xs text-muted">
                        {[
                          i.check_result.info.widthPx && `${i.check_result.info.widthPx}×${i.check_result.info.heightPx}px`,
                          i.check_result.info.dpi && `${i.check_result.info.dpi} DPI (เต็มแผ่น)`,
                          i.check_result.info.colorMode,
                          i.check_result.info.pageWidthMm && `หน้า ${i.check_result.info.pageWidthMm}×${i.check_result.info.pageHeightMm}มม.`,
                          i.check_result.info.pages && `${i.check_result.info.pages} หน้า`,
                          i.check_result.info.minImageDpi && `รูปต่ำสุด ${i.check_result.info.minImageDpi} DPI`,
                          i.check_result.checkedBy === "browser" ? "ตรวจใน browser" : "ตรวจที่ server",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    <CheckDetails check={i.check_result} />
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {i.file_path && <DownloadButton path={i.file_path} label="ดาวน์โหลดไฟล์ต้นฉบับ" />}
                  <ItemActions itemId={i.id} requested={i.reupload_requested} reason={i.reupload_reason} />
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="card space-y-3">
              <h2 className="font-bold">การชำระเงิน</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <Row label={`ค่าสติกเกอร์ ${order.total_sheets} แผ่น`} value={baht(Number(order.subtotal))} />
                  {Number(order.fix_fee_total) > 0 && <Row label="ค่าแก้ไฟล์" value={baht(Number(order.fix_fee_total))} />}
                  <Row label="ค่าส่ง" value={Number(order.shipping_fee) ? baht(Number(order.shipping_fee)) : "ส่งฟรี"} />
                  <div className="flex justify-between border-t border-line pt-1 text-base font-bold">
                    <span>ยอดชำระ</span>
                    <span>{baht(Number(order.total))}</span>
                  </div>
                  <p className="pt-2 text-xs text-muted">
                    เรทตอนสั่ง: ขั้น {String((order.pricing_snapshot.tier as { min: number })?.min ?? "-")}+ แผ่น · ยอดสะสมก่อนสั่ง{" "}
                    {String(order.pricing_snapshot.prevPoints ?? 0)}
                  </p>
                  {order.slip_verify && (
                    <p className="text-xs">
                      ตรวจสลิปอัตโนมัติ: {order.slip_verify.ok ? "✅ ผ่าน" : "❌ ไม่ผ่าน"} ({String(order.slip_verify.provider)}
                      {order.slip_verify.amount !== undefined ? ` · ${String(order.slip_verify.amount)} บาท` : ""})
                    </p>
                  )}
                  {order.slip_rejected_reason && <p className="text-sm text-bad">แจ้งลูกค้าว่า: {order.slip_rejected_reason}</p>}
                </div>
                <div>
                  {order.slip_path && slipUrls[order.slip_path] ? (
                    <a href={slipUrls[order.slip_path]} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slipUrls[order.slip_path]} alt="สลิป" className="max-h-80 rounded-xl border border-line" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted">ไม่มีรูปสลิป</p>
                  )}
                  {order.slip_uploaded_at && <p className="mt-1 text-xs text-muted">ส่งสลิปเมื่อ {thaiDate(order.slip_uploaded_at)}</p>}
                </div>
              </div>
              {order.status === "pending_slip" && <PaymentActions orderId={order.id} />}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card space-y-2 text-sm">
            <h2 className="font-bold">ที่อยู่จัดส่ง</h2>
            <p className="font-medium">
              {order.customer_name} · {order.customer_phone}
            </p>
            <p>{address}</p>
            {order.line_user_id && <p className="text-xs text-ok">✓ เชื่อม LINE แล้ว (แจ้งเลขแทร็คอัตโนมัติ)</p>}
            <CopyButton text={myOrderText} label="คัดลอกที่อยู่ (MyOrder)" className="w-full" />
            {order.customer_note && <p className="rounded-xl bg-warn-bg p-2">หมายเหตุลูกค้า: {order.customer_note}</p>}
            {isAdmin && (
              <p className="text-xs text-muted">
                <Link href={`/admin/customers?phone=${order.customer_phone}`} className="underline">
                  ยอดสะสมลูกค้า {pts.points} แผ่น
                </Link>
              </p>
            )}
          </div>

          <div className="card space-y-3">
            <h2 className="font-bold">จัดส่ง</h2>
            {order.tracking_no && (
              <p className="text-sm">
                {carrierInfo(order.carrier)?.label}: <b>{order.tracking_no}</b>
                <br />
                <span className="text-muted">
                  {thaiDate(order.shipped_at)}
                  {order.line_notified_at && " · แจ้ง LINE แล้ว"}
                </span>
              </p>
            )}
            {order.status !== "cancelled" && <TrackingForm orderId={order.id} carrier={order.carrier} trackingNo={order.tracking_no} />}
          </div>

          <div className="card space-y-3">
            <h2 className="font-bold">สถานะออเดอร์</h2>
            <StatusActions orderId={order.id} status={order.status} isAdmin={isAdmin} />
          </div>

          <div className="card space-y-2">
            <h2 className="font-bold">โน้ตภายในร้าน</h2>
            <AdminNote orderId={order.id} note={order.admin_note ?? ""} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
