import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/server/email";
import { exchangeCode } from "@/lib/server/line";
import { LINE_COOKIE, sign } from "@/lib/server/signed-cookie";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = await cookies();
  let saved: { state: string; back: string } | null = null;
  try {
    saved = JSON.parse(store.get("yw_line_state")?.value ?? "null");
  } catch {}
  const back = saved?.back ?? "/";
  const code = url.searchParams.get("code");
  if (!code || !saved || saved.state !== url.searchParams.get("state")) {
    return NextResponse.redirect(`${siteUrl()}${back}${back.includes("?") ? "&" : "?"}line=failed`);
  }
  try {
    const profile = await exchangeCode(code, `${siteUrl()}/api/line/callback`);
    const res = NextResponse.redirect(`${siteUrl()}${back}${back.includes("?") ? "&" : "?"}line=ok`);
    res.cookies.set(
      LINE_COOKIE,
      sign({ userId: profile.userId, name: profile.displayName, picture: profile.pictureUrl }),
      { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" },
    );
    res.cookies.delete("yw_line_state");
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(`${siteUrl()}${back}${back.includes("?") ? "&" : "?"}line=failed`);
  }
}
