import { NextResponse } from "next/server";
import { fileExt } from "@/lib/constants";
import { bad } from "@/lib/server/http";
import { getItems, getOrderByToken, signedUrls } from "@/lib/server/orders";

/** รายการจากออเดอร์เดิม สำหรับปุ่ม "สั่งซ้ำแบบเดิม" */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) return bad("ไม่พบออเดอร์", 404);
  const items = await getItems(order.id);
  const previews = await signedUrls(items.map((i) => i.preview_path), 60 * 60 * 24);
  return NextResponse.json({
    orderNo: order.order_no,
    customer: { name: order.customer_name, phone: order.customer_phone, address: order.address },
    items: items.map((i) => ({
      itemId: i.id,
      available: Boolean(i.file_path),
      fileName: i.file_name,
      fileSize: i.file_size,
      fileType: fileExt(i.file_name),
      previewUrl: i.preview_path ? (previews[i.preview_path] ?? null) : null,
      check: i.check_result,
      product: i.product,
      finish: i.finish,
      qty: i.qty,
      shape: i.shape,
      widthMm: i.width_mm === null ? null : Number(i.width_mm),
      heightMm: i.height_mm === null ? null : Number(i.height_mm),
      trim: i.trim ?? null,
      prevApproved: i.fix_service || i.accept_risk,
      prevFixed: i.fix_service,
    })),
  });
}
