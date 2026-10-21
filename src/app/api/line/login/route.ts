import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/server/email";
import { lineLoginEnabled, loginUrl } from "@/lib/server/line";

export async function GET(req: Request) {
  if (!lineLoginEnabled()) return NextResponse.redirect(`${siteUrl()}/?line=disabled`);
  const back = new URL(req.url).searchParams.get("back") || "/";
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(loginUrl(state, `${siteUrl()}/api/line/callback`));
  res.cookies.set("yw_line_state", JSON.stringify({ state, back: back.startsWith("/") ? back : "/" }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
