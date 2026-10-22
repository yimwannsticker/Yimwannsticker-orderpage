import { NextResponse } from "next/server";
import { addressKey } from "@/lib/format";
import { nameMatches } from "@/lib/name-match";
import { resolveCustomer } from "@/lib/server/customer-lookup";
import { rememberMe } from "@/lib/server/me";
import { bad, readJson } from "@/lib/server/http";

const MAX_ADDRESSES = 5;

/** ที่อยู่ที่ลูกค้าเก่าเคยใช้ (ยืนยันด้วยชื่อผู้รับ + เบอร์โทร) ไม่ซ้ำกัน ล่าสุดก่อน */
export async function POST(req: Request) {
  const v = await resolveCustomer(req, await readJson<{ name: string; phone: string }>(req));
  if (!v.ok) return bad(v.error, v.status);

  const seen = new Map<string, { address: (typeof v.orders)[number]["address"]; date: string; times: number }>();
  // เฉพาะออเดอร์ที่ส่งถึงชื่อผู้รับคนนี้
  for (const o of v.orders.filter((o) => nameMatches(v.name, o.customer_name))) {
    if (!o.address?.line1?.trim()) continue;
    const key = addressKey(o.address);
    const cur = seen.get(key);
    if (cur) cur.times++;
    else seen.set(key, { address: o.address, date: o.created_at, times: 1 });
  }
  return rememberMe(NextResponse.json({ addresses: [...seen.values()].slice(0, MAX_ADDRESSES) }), v.phone, v.fullName);
}
