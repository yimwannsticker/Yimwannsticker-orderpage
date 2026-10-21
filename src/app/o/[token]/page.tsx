import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckBadge, CopyButton } from "@/components/ui";
import { STATUS_FLOW, STATUS_LABEL, carrierInfo, productLabel, shapeLabel, trackingUrl } from "@/lib/constants";
import { sizeText } from "@/lib/sticker-size";
import { baht, formatAddress, thaiDate } from "@/lib/format";
import { toNextFree } from "@/lib/pricing";
import { getItems, getOrderByToken, getPoints, signedUrls } from "@/lib/server/orders";
import { getSettings, toPublic } from "@/lib/server/settings";
import { ReuploadButton, SlipReupload } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "สถานะออเดอร์ | Yimwann Sticker", robots: { index: false } };

export default async function OrderStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const [items, settings, pts] = await Promise.all([getItems(order.id), getSettings(), getPoints(order.customer_phone)]);
  const previews = await signedUrls(items.map((i) => i.preview_path));
  const pub = toPublic(settings);
  const idx = STATUS_FLOW.indexOf(order.status);
  const needFiles = items.filter((i) => i.reupload_requested);
  const times: Record<string, string | null> = {
    pending_slip: order.created_at,
    paid: order.paid_at,
    producing: order.producing_at,
    shipped: order.shipped_at,
  };
  const trackUrl = order.tracking_no ? trackingUrl(order.carrier, order.tracking_no) : null;

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Link href="/" className="text-sm text-brand-600">
        ← สั่งพิมพ์เพิ่ม
      </Link>
      <div className="card">
        <p className="text-sm text-muted">เลขออเดอร์</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-wide">{order.order_no}</h1>
          <CopyButton text={order.order_no} />
        </div>
        <p className="mt-1 text-sm text-muted">สั่งเมื่อ {thaiDate(order.created_at)}</p>
        <p className="mt-2 text-xs text-muted">บันทึกลิงก์หน้านี้ไว้เพื่อกลับมาเช็คสถานะได้ตลอด</p>
        {items.some((i) => i.file_path) ? (
          <Link href={`/?reorder=${encodeURIComponent(token)}`} className="btn-secondary mt-3 w-full">
            ↻ สั่งซ้ำแบบเดิม (ไม่ต้องส่งไฟล์ใหม่)
          </Link>
        ) : (
          order.files_deleted_at && <p className="mt-2 text-xs text-muted">ไฟล์ของออเดอร์นี้ถูกลบตามระยะเวลาเก็บแล้ว ถ้าจะสั่งซ้ำกรุณาอัปโหลดไฟล์ใหม่</p>
        )}
      </div>

      {order.status === "cancelled" ? (
        <div className="card bg-bad-bg text-bad">ออเดอร์นี้ถูกยกเลิก {order.admin_note ? `— ${order.admin_note}` : ""}</div>
      ) : (
        <div className="card">
          <h2 className="mb-3 font-bold">สถานะ</h2>
          <ol className="space-y-0">
            {STATUS_FLOW.map((s, i) => {
              const done = i <= idx;
              return (
                <li key={s} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                        done ? "bg-brand-500 text-white" : "bg-gray-100 text-muted"
                      } ${i === idx ? "ring-4 ring-brand-100" : ""}`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {i < STATUS_FLOW.length - 1 && <span className={`w-0.5 flex-1 ${i < idx ? "bg-brand-500" : "bg-gray-200"}`} />}
                  </div>
                  <div className="pb-5">
                    <p className={done ? "font-semibold" : "text-muted"}>{STATUS_LABEL[s]}</p>
                    {done && times[s] && <p className="text-xs text-muted">{thaiDate(times[s])}</p>}
                  </div>
                </li>
              );
            })}
          </ol>

          {order.status === "shipped" && order.tracking_no && (
            <div className="rounded-2xl bg-ok-bg p-4">
              <p className="text-sm text-muted">{carrierInfo(order.carrier)?.label ?? order.carrier}</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xl font-bold tracking-wide">{order.tracking_no}</p>
                <CopyButton text={order.tracking_no} />
              </div>
              {trackUrl && (
                <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-3 w-full">
                  ติดตามพัสดุ
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {order.status === "pending_slip" && order.slip_rejected_reason && (
        <div className="card space-y-3 border-bad/30">
          <p className="font-bold text-bad">ร้านแจ้งว่าสลิปมีปัญหา</p>
          <p className="text-sm">{order.slip_rejected_reason}</p>
          <p className="text-sm text-muted">ยอดที่ต้องชำระ {baht(Number(order.total))}</p>
          <SlipReupload token={token} settings={pub} amount={Number(order.total)} />
        </div>
      )}

      {needFiles.length > 0 && (
        <div className="card space-y-3 border-warn/40 bg-warn-bg/40">
          <p className="font-bold text-warn">ร้านขอให้ส่งไฟล์ใหม่</p>
          {needFiles.map((i) => (
            <div key={i.id} className="rounded-2xl bg-white p-3">
              <p className="text-sm font-medium">
                ไฟล์ที่ {i.position}: {i.file_name}
              </p>
              {i.reupload_reason && <p className="mt-1 text-sm">เหตุผล: {i.reupload_reason}</p>}
              <div className="mt-2">
                <ReuploadButton
                  token={token}
                  itemId={i.id}
                  settings={pub}
                  size={i.shape && i.width_mm ? { shape: i.shape, widthMm: Number(i.width_mm), heightMm: Number(i.height_mm) } : null}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="font-bold">รายการ</h2>
        {items.map((i) => (
          <div key={i.id} className="flex gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-50">
              {i.preview_path && previews[i.preview_path] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[i.preview_path]} alt="" className="h-full w-full object-contain" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">{i.file_name}</p>
              <p className="text-muted">{productLabel(i.product, i.finish)}</p>
              {i.shape && (
                <p className="text-muted">
                  ไดคัท{shapeLabel(i.shape)} {sizeText({ shape: i.shape, widthMm: Number(i.width_mm), heightMm: Number(i.height_mm) })}
                </p>
              )}
              <p className="text-muted">
                {i.qty} แผ่น × {baht(Number(i.unit_price))}
                {i.free_qty > 0 && <span className="text-ok"> + แถม {i.free_qty}</span>}
              </p>
              {i.check_result && !i.reupload_requested && (
                <div className="mt-1">
                  <CheckBadge level={i.check_result.level} title={i.check_result.title} />
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="space-y-1 border-t border-line pt-3 text-sm">
          {Number(order.fix_fee_total) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">ค่าแก้ไฟล์</span>
              <span>{baht(Number(order.fix_fee_total))}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted">ค่าส่ง</span>
            <span>{Number(order.shipping_fee) ? baht(Number(order.shipping_fee)) : "ส่งฟรี"}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>ยอดรวม</span>
            <span>{baht(Number(order.total))}</span>
          </div>
        </div>
      </div>

      <div className="card text-sm">
        <h2 className="mb-1 font-bold">จัดส่งถึง</h2>
        <p>
          {order.customer_name} · {order.customer_phone}
        </p>
        <p className="text-muted">{formatAddress(order.address)}</p>
      </div>

      {settings.promo.enabled && (
        <div className="card border-brand-200 bg-brand-50/50 text-sm">
          <p className="font-bold">🎁 ยอดสะสมโปร {settings.promo.every} แถม {settings.promo.free}</p>
          <p className="mt-1">
            ยอดสะสมปัจจุบัน <b>{pts.points}</b> แผ่น
            {pts.pending > 0 && <span className="text-muted"> (รอตรวจสลิปอีก {pts.pending} แผ่น)</span>}
          </p>
          <p className="text-brand-700">
            สะสมอีก {toNextFree(settings.promo, pts.points + pts.pending)} แผ่น รับฟรี {settings.promo.free} แผ่น
          </p>
        </div>
      )}
    </main>
  );
}
