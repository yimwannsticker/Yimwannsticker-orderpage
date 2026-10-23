"use client";

/** ย่อรูปให้ด้านยาวไม่เกิน max (WebP เก็บพื้นหลังโปร่งใสได้ ไฟล์เล็ก) */
export async function resizeImage(file: Blob, max: number, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (blob && blob.type === "image/webp") return blob;
  // browser เก่าที่ทำ WebP ไม่ได้
  return (await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png")))!;
}

export interface UploadedImage {
  path: string;
  thumb: string;
  /** ลิงก์ดูตัวอย่างในเครื่อง (ก่อนบันทึก) */
  url: string;
}

/** ย่อรูปเป็น 2 ขนาด (เต็ม + ย่อ) แล้วอัปโหลดเข้า R2 */
export async function uploadImages(files: File[], opts: { max?: number; thumb?: number } = {}): Promise<UploadedImage[]> {
  const blobs = await Promise.all(
    files.map(async (f) => {
      const [full, small] = await Promise.all([resizeImage(f, opts.max ?? 1600), resizeImage(f, opts.thumb ?? 480, 0.8)]);
      return [full, small] as const;
    }),
  );
  const res = await fetch("/api/admin/catalog-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: blobs.flatMap(([a, b]) => [{ type: a.type }, { type: b.type }]) }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "อัปโหลดรูปไม่สำเร็จ");
  const slots = json.files as { path: string; signedUrl: string }[];
  const flat = blobs.flatMap(([a, b]) => [a, b]);
  await Promise.all(
    flat.map(async (b, i) => {
      const r = await fetch(slots[i].signedUrl, { method: "PUT", body: b, headers: { "Content-Type": b.type } });
      if (!r.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
    }),
  );
  return blobs.map(([a], i) => ({ path: slots[i * 2].path, thumb: slots[i * 2 + 1].path, url: URL.createObjectURL(a) }));
}

/** ชื่อลายจากชื่อไฟล์ เช่น "33-01 ดอกไม้ชมพู.png" → "ดอกไม้ชมพู" (ตัดรหัสนำหน้าออก เพราะมี SKU แยกแล้ว) */
export function nameFromFile(name: string) {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").trim();
  const noCode = base.replace(/^[a-z0-9]+-\d+\s*[-.]?\s*/i, "").trim();
  return (noCode || base).slice(0, 100) || "ลายใหม่";
}
