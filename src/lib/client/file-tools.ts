"use client";

import { fileExt } from "../constants";
import { rasterCheck } from "../check/rules";
import type { CheckResult } from "../types";

/** อ่านขนาดและโหมดสีจาก header ของ JPG/PNG (ไม่ต้องถอดรหัสรูปทั้งไฟล์) */
export async function readImageHeader(
  file: File,
): Promise<{ width: number; height: number; colorMode: string; hasAlpha: boolean } | null> {
  const buf = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
  const ext = fileExt(file.name);
  if (ext === "png" || (buf[0] === 0x89 && buf[1] === 0x50)) {
    if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
    const dv = new DataView(buf.buffer);
    const colorType = buf[25];
    return {
      width: dv.getUint32(16),
      height: dv.getUint32(20),
      colorMode: colorType === 0 || colorType === 4 ? "Grayscale" : "RGB",
      hasAlpha: colorType === 4 || colorType === 6,
    };
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    const len = (buf[i + 2] << 8) | buf[i + 3];
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) {
      const height = (buf[i + 5] << 8) | buf[i + 6];
      const width = (buf[i + 7] << 8) | buf[i + 8];
      const comps = buf[i + 9];
      return { width, height, colorMode: comps === 4 ? "CMYK" : comps === 1 ? "Grayscale" : "RGB", hasAlpha: false };
    }
    i += 2 + len;
  }
  return null;
}

export async function checkImageInBrowser(file: File): Promise<CheckResult> {
  const h = await readImageHeader(file);
  if (!h || !h.width || !h.height) {
    return {
      level: "red",
      title: "ต้องแก้ไฟล์",
      issues: [{ level: "red", message: "เปิดไฟล์รูปไม่ได้ ไฟล์อาจเสียหาย กรุณาบันทึกเป็น JPG หรือ PNG ใหม่" }],
      info: { kind: fileExt(file.name) },
      checkedBy: "browser",
    };
  }
  return rasterCheck(h.width, h.height, h.colorMode, "browser", fileExt(file.name), h.hasAlpha);
}

/** ตรวจไฟล์ทุกชนิดใน browser (PDF/AI/PSD โหลดตัวตรวจเมื่อจำเป็น) */
export async function checkFileInBrowser(file: File): Promise<CheckResult> {
  const ext = fileExt(file.name);
  if (["jpg", "jpeg", "png"].includes(ext)) return checkImageInBrowser(file);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (ext === "psd") {
      const { checkPsd } = await import("../check/psd-check");
      return checkPsd(bytes, "browser");
    }
    const { checkPdfLike } = await import("../check/pdf-check");
    return await checkPdfLike(bytes, ext === "ai" ? "ai" : "pdf", "browser");
  } catch (e) {
    console.warn("check failed", e);
    return {
      level: "yellow",
      title: "รอกราฟิกตรวจ",
      issues: [{ level: "yellow", message: "ระบบตรวจไฟล์นี้อัตโนมัติไม่ได้ (ไฟล์อาจใหญ่เกินไปสำหรับเครื่องนี้) กราฟิกจะตรวจให้ภายหลัง" }],
      info: { kind: ext, needsManualReview: true },
      checkedBy: "browser",
    };
  }
}

const PREVIEW_MAX = 720;

function canvasToOutputs(canvas: HTMLCanvasElement) {
  return new Promise<{ blob: Blob; dataUrl: string } | null>((resolve) => {
    // รูปเล็กสำหรับเก็บใน browser (กลับมาแก้ออเดอร์ได้)
    const small = document.createElement("canvas");
    const scale = Math.min(1, 320 / Math.max(canvas.width, canvas.height));
    small.width = Math.max(1, Math.round(canvas.width * scale));
    small.height = Math.max(1, Math.round(canvas.height * scale));
    const sctx = small.getContext("2d")!;
    sctx.fillStyle = "#fff";
    sctx.fillRect(0, 0, small.width, small.height);
    sctx.drawImage(canvas, 0, 0, small.width, small.height);
    const dataUrl = small.toDataURL("image/jpeg", 0.7);
    canvas.toBlob((blob) => resolve(blob ? { blob, dataUrl } : null), "image/jpeg", 0.82);
  });
}

function drawSource(src: CanvasImageSource, w: number, h: number) {
  const scale = Math.min(1, PREVIEW_MAX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function imagePreview(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return drawSource(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pdfPreview(file: File) {
  // ใช้ legacy build เพื่อรองรับ browser มือถือรุ่นเก่า
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = PREVIEW_MAX / Math.max(vp1.width, vp1.height);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    return canvas;
  } finally {
    await task.destroy();
  }
}

async function psdPreview(file: File) {
  const { readPsd } = await import("ag-psd");
  const psd = readPsd(await file.arrayBuffer(), {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    useRawThumbnail: true,
  });
  const raw = psd.imageResources?.thumbnailRaw;
  if (!raw?.data?.length) return null;
  return imagePreview(new Blob([raw.data as BlobPart], { type: "image/jpeg" }));
}

/** สร้างรูปตัวอย่าง: blob สำหรับอัปโหลดให้ร้านดู + dataUrl เล็กๆ สำหรับแสดงในหน้าลูกค้า */
export async function makePreview(file: File) {
  const ext = fileExt(file.name);
  const mb = file.size / 1024 / 1024;
  try {
    let canvas: HTMLCanvasElement | null = null;
    if (ext === "jpg" || ext === "jpeg" || ext === "png") canvas = await imagePreview(file);
    else if ((ext === "pdf" || ext === "ai") && mb <= 150) canvas = await pdfPreview(file);
    else if (ext === "psd" && mb <= 150) canvas = await psdPreview(file);
    return canvas ? await canvasToOutputs(canvas) : null;
  } catch (e) {
    console.warn("preview failed", e);
    return null;
  }
}

/** อัปโหลดเข้า Storage ผ่าน signed URL พร้อมแสดงเปอร์เซ็นต์ */
export async function uploadFile(
  file: Blob,
  fileName: string,
  kind: "artwork" | "preview" | "slip",
  onProgress?: (pct: number) => void,
): Promise<string> {
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, fileName, size: file.size }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "อัปโหลดไม่สำเร็จ");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", json.signedUrl);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.status === 413 ? "ไฟล์ใหญ่เกินที่ระบบรับได้" : "อัปโหลดไม่สำเร็จ กรุณาลองใหม่"));
    xhr.onerror = () => reject(new Error("อินเทอร์เน็ตขัดข้อง อัปโหลดไม่สำเร็จ กรุณาลองใหม่"));
    xhr.send(file);
  });
  return json.uploadId as string;
}

export async function requestCheck(uploadId: string, clientCheck: CheckResult | null): Promise<CheckResult> {
  const res = await fetch("/api/check-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, clientCheck }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "ตรวจไฟล์ไม่สำเร็จ");
  return json.result as CheckResult;
}

/** อัปโหลดไฟล์งาน + รูปตัวอย่าง + ตรวจไฟล์ ครบในฟังก์ชันเดียว */
export async function processArtwork(
  file: File,
  onUpdate: (u: { progress?: number; phase?: "uploading" | "checking"; previewUrl?: string }) => void,
) {
  const ext = fileExt(file.name);
  const isImage = ["jpg", "jpeg", "png"].includes(ext);
  // ไฟล์ PDF/AI/PSD ใช้หน่วยความจำเยอะ ทำทีละอย่างเพื่อไม่ให้มือถือค้าง
  const [preview, clientCheck] = isImage
    ? await Promise.all([makePreview(file), checkImageInBrowser(file)])
    : [await makePreview(file), await checkFileInBrowser(file)];
  if (preview) onUpdate({ previewUrl: preview.dataUrl });
  const uploadId = await uploadFile(file, file.name, "artwork", (p) => onUpdate({ progress: p }));
  const previewUploadId = preview ? await uploadFile(preview.blob, "preview.jpg", "preview").catch(() => null) : null;
  onUpdate({ phase: "checking" });
  const check = await requestCheck(uploadId, clientCheck);
  return { uploadId, previewUploadId, check, previewUrl: preview?.dataUrl ?? null };
}
