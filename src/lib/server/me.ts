import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { ME_COOKIE, ME_DAYS, sign, verify, type MeSession } from "./signed-cookie";

export async function getMe(): Promise<MeSession | null> {
  const store = await cookies();
  const s = verify<MeSession>(store.get(ME_COOKIE)?.value);
  return s && s.exp > Date.now() ? s : null;
}

/** จำลูกค้าไว้ในเครื่องนี้ (ต่ออายุทุกครั้งที่ใช้) */
export function rememberMe(res: NextResponse, phone: string, name: string) {
  const exp = Date.now() + ME_DAYS * 86400_000;
  res.cookies.set(ME_COOKIE, sign({ p: phone, n: name, exp } satisfies MeSession), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ME_DAYS * 86400,
    path: "/",
  });
  return res;
}
