import { NextResponse } from "next/server";
import { STATUS_LABEL, carrierInfo, trackingUrl } from "@/lib/constants";
import { reply, verifySignature } from "@/lib/server/line";
import { getPoints, statusUrl } from "@/lib/server/orders";
import { getSettings } from "@/lib/server/settings";
import { db } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/types";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

/**
 * Webhook ของ LINE OA: ลูกค้าพิมพ์เลขออเดอร์ บอทตอบสถานะด้วย reply message (ไม่เสียโควตา)
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const { events = [] } = JSON.parse(raw) as { events: LineEvent[] };
  const settings = await getSettings();

  await Promise.all(
    events.map(async (ev) => {
      if (ev.type !== "message" || ev.message?.type !== "text" || !ev.replyToken) return;
      const text = ev.message.text ?? "";
      const m = /YW\s?-?(\d{3,})/i.exec(text);
      if (!m) return; // ไม่ใช่เลขออเดอร์ ปล่อยให้แอดมินตอบเอง
      const orderNo = `YW${m[1]}`;
      const { data: o } = await db()
        .from("orders")
        .select("order_no, token, status, customer_phone, line_user_id, carrier, tracking_no, slip_rejected_reason")
        .eq("order_no", orderNo)
        .maybeSingle();
      if (!o) {
        await reply(ev.replyToken, [{ type: "text", text: `ไม่พบออเดอร์ ${orderNo} กรุณาตรวจสอบเลขออเดอร์อีกครั้งค่ะ` }]);
        return;
      }
      // แสดงรายละเอียดเต็มเฉพาะเจ้าของ (LINE เดียวกับที่สั่ง หรือพิมพ์เบอร์โทรมาด้วย)
      const digits = text.replace(/\D/g, "");
      const owner = (ev.source?.userId && ev.source.userId === o.line_user_id) || digits.includes(o.customer_phone.slice(1));
      const lines = [`ออเดอร์ ${o.order_no}`, `สถานะ: ${STATUS_LABEL[o.status as OrderStatus]}`];
      if (owner) {
        if (o.status === "shipped" && o.tracking_no) {
          lines.push(`ขนส่ง: ${carrierInfo(o.carrier)?.label ?? o.carrier}`, `เลขพัสดุ: ${o.tracking_no}`);
          const t = trackingUrl(o.carrier, o.tracking_no);
          if (t) lines.push(`ติดตามพัสดุ: ${t}`);
        }
        if (o.slip_rejected_reason) lines.push(`ร้านแจ้ง: ${o.slip_rejected_reason}`);
        const { points } = await getPoints(o.customer_phone);
        lines.push(`ยอดสะสม: ${points} แผ่น`);
        lines.push(`ดูรายละเอียด: ${statusUrl(o.token)}`);
      } else {
        lines.push("(พิมพ์เลขออเดอร์พร้อมเบอร์โทรที่ใช้สั่ง เพื่อดูรายละเอียด)");
      }
      if (settings.lineReplyFooter) lines.push("", settings.lineReplyFooter);
      await reply(ev.replyToken, [{ type: "text", text: lines.join("\n") }]);
    }),
  ).catch((e) => console.error("line webhook", e));

  return NextResponse.json({ ok: true });
}
