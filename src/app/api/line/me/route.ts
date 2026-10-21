import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { lineLoginEnabled } from "@/lib/server/line";
import { LINE_COOKIE, verify, type LineSession } from "@/lib/server/signed-cookie";

export async function GET() {
  const store = await cookies();
  const s = verify<LineSession>(store.get(LINE_COOKIE)?.value);
  return NextResponse.json({ enabled: lineLoginEnabled(), user: s ? { name: s.name, picture: s.picture } : null });
}
