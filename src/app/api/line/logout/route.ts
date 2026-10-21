import { NextResponse } from "next/server";
import { LINE_COOKIE } from "@/lib/server/signed-cookie";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(LINE_COOKIE);
  return res;
}
