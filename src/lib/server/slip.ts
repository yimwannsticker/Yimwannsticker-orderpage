import "server-only";
import type { Settings } from "../types";

export interface SlipVerifyResult {
  ok: boolean;
  provider: string;
  amount?: number;
  message?: string;
  raw?: unknown;
}

/**
 * ตรวจสลิปอัตโนมัติ (ปิดไว้เป็นค่าเริ่มต้น เปิดได้ในหน้าตั้งค่า + ใส่ API key ใน env)
 * รูปแบบ API อ้างอิงจากเอกสารของผู้ให้บริการ ควรทดสอบกับบัญชีจริงก่อนเปิดใช้
 */
export async function verifySlip(
  settings: Settings,
  file: Blob,
  expectedAmount: number,
): Promise<SlipVerifyResult | null> {
  if (!settings.slipVerify.enabled) return null;
  try {
    if (settings.slipVerify.provider === "slipok") {
      const branch = process.env.SLIPOK_BRANCH_ID;
      const key = process.env.SLIPOK_API_KEY;
      if (!branch || !key) return null;
      const form = new FormData();
      form.append("files", file, "slip.jpg");
      form.append("amount", String(expectedAmount));
      form.append("log", "true");
      const res = await fetch(`https://api.slipok.com/api/line/apikey/${branch}`, {
        method: "POST",
        headers: { "x-authorization": key },
        body: form,
      });
      const json = await res.json();
      const amount = Number(json?.data?.amount);
      return {
        ok: Boolean(json?.success) && amount === expectedAmount,
        provider: "slipok",
        amount,
        message: json?.message,
        raw: json,
      };
    }
    const key = process.env.EASYSLIP_API_KEY;
    if (!key) return null;
    const form = new FormData();
    form.append("file", file, "slip.jpg");
    const res = await fetch("https://developer.easyslip.com/api/v1/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const json = await res.json();
    const amount = Number(json?.data?.amount?.amount);
    return { ok: json?.status === 200 && amount === expectedAmount, provider: "easyslip", amount, raw: json };
  } catch (e) {
    return { ok: false, provider: settings.slipVerify.provider, message: String(e) };
  }
}
