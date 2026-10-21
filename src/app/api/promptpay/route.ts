import generatePayload from "promptpay-qr";
import QRCode from "qrcode";
import { getSettings } from "@/lib/server/settings";

/** QR พร้อมเพย์ใส่ยอดเงินอัตโนมัติ (PNG) */
export async function GET(req: Request) {
  const amount = Number(new URL(req.url).searchParams.get("amount"));
  const { promptpayId } = await getSettings();
  if (!promptpayId || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return new Response("not available", { status: 404 });
  }
  const payload = generatePayload(promptpayId.replace(/\D/g, ""), { amount: Math.round(amount * 100) / 100 });
  const png = await QRCode.toBuffer(payload, { width: 600, margin: 2, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="promptpay-${amount}.png"`,
    },
  });
}
