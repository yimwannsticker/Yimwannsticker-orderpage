import { NextResponse } from "next/server";
import zips from "@/data/th-zip.json";

const db = zips as unknown as Record<string, [string, string, string][]>;

export async function GET(req: Request) {
  const zip = new URL(req.url).searchParams.get("zip") ?? "";
  if (!/^\d{5}$/.test(zip)) return NextResponse.json({ entries: [] });
  return NextResponse.json(
    { entries: db[zip] ?? [] },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
  );
}
