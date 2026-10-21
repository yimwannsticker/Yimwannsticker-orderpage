import type { Finish, OrderStatus, ProductKey, Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  shopName: "Yimwann Sticker",
  sheetName: "A3+",
  sheetWidthMm: 330,
  sheetHeightMm: 483,
  tiers: [
    { min: 5, paper: 30, pp: 35 },
    { min: 10, paper: 25, pp: 29 },
    { min: 50, paper: 24, pp: 28 },
    { min: 100, paper: 22, pp: 26 },
    { min: 300, paper: 19, pp: 23 },
  ],
  minPerFile: 5,
  shippingFee: 50,
  freeShippingMin: 20,
  promo: { enabled: true, every: 100, free: 5 },
  fixFileFee: 50,
  dpiGood: 300,
  dpiMin: 150,
  promptpayId: "",
  promptpayName: "",
  bankName: "",
  bankAccountNo: "",
  bankAccountName: "",
  lineTrackingMessage: "ออเดอร์ {orderNo} จัดส่งแล้ว 🎉\nขนส่ง: {carrier}\nเลขพัสดุ: {trackingNo}",
  lineReplyFooter: "ขอบคุณที่อุดหนุน Yimwann Sticker ค่ะ",
  fileRetentionDays: 90,
  maxFileMb: 200,
  slipVerify: { enabled: false, provider: "slipok" },
  notifyEmail: "",
  contactLine: "",
};

export const PRODUCTS: Record<ProductKey, { label: string; description: string }> = {
  paper: {
    label: "สติกเกอร์กระดาษ ขาวเงา",
    description: "เนื้อกระดาษ ฉีกได้ สำหรับสินค้าทั่วไป กันน้ำหยดและความชื้นได้เล็กน้อย",
  },
  pp: {
    label: "สติกเกอร์ PP",
    description: "เนื้อพลาสติก กันน้ำ 100% ฉีกขาดยาก สำหรับสินค้าแช่เย็น แช่น้ำ",
  },
};

export const PP_FINISHES: { key: Finish; label: string }[] = [
  { key: "matte", label: "ขาวด้าน" },
  { key: "gloss", label: "ขาวเงา" },
  { key: "clear", label: "ใส" },
];

export function productLabel(product: ProductKey, finish: Finish) {
  if (product === "paper") return PRODUCTS.paper.label;
  const f = PP_FINISHES.find((x) => x.key === finish);
  return `${PRODUCTS.pp.label} ${f?.label ?? ""}`.trim();
}

export const STATUS_FLOW: OrderStatus[] = ["pending_slip", "paid", "producing", "shipped"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_slip: "รอตรวจสลิป",
  paid: "ชำระแล้ว",
  producing: "กำลังผลิต",
  shipped: "จัดส่งแล้ว",
  cancelled: "ยกเลิก",
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_slip: "bg-warn-bg text-warn",
  paid: "bg-blue-50 text-blue-700",
  producing: "bg-purple-50 text-purple-700",
  shipped: "bg-ok-bg text-ok",
  cancelled: "bg-gray-100 text-muted",
};

export const CARRIERS = [
  { key: "thaipost", label: "ไปรษณีย์ไทย", url: "https://track.thailandpost.co.th/?trackNumber={t}" },
  { key: "flash", label: "Flash Express", url: "https://www.flashexpress.co.th/fle/tracking?se={t}" },
  { key: "jt", label: "J&T Express", url: "https://www.jtexpress.co.th/service/track?billcode={t}" },
  { key: "kerry", label: "Kerry Express (KEX)", url: "https://th.kex-express.com/th/track/?track={t}" },
  { key: "spx", label: "SPX Express", url: "https://spx.co.th/track?{t}" },
  { key: "dhl", label: "DHL", url: "https://www.dhl.com/th-th/home/tracking.html?tracking-id={t}" },
] as const;

export type CarrierKey = (typeof CARRIERS)[number]["key"];

export function carrierInfo(key: string | null | undefined) {
  return CARRIERS.find((c) => c.key === key) ?? null;
}

export function trackingUrl(carrier: string | null | undefined, trackingNo: string) {
  const c = carrierInfo(carrier);
  if (!c) return null;
  return c.url.replace("{t}", encodeURIComponent(trackingNo));
}

export const ACCEPTED_EXT = ["jpg", "jpeg", "png", "pdf", "ai", "psd"] as const;
export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.pdf,.ai,.psd,image/jpeg,image/png,application/pdf";

export function fileExt(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export const STORAGE_BUCKET = "order-files";

const CARRIER_ALIASES: [RegExp, CarrierKey][] = [
  [/ไปรษณีย์|thai\s*post|thailand\s*post|thaipost|ems|^th$/i, "thaipost"],
  [/flash|แฟลช/i, "flash"],
  [/j\s*&\s*t|^jt$|เจแอนด์ที/i, "jt"],
  [/kerry|kex|เคอรี่/i, "kerry"],
  [/spx|shopee|ช้อปปี้/i, "spx"],
  [/dhl/i, "dhl"],
];

/** แปลงชื่อขนส่งจากไฟล์ CSV/Excel เป็นรหัสขนส่ง */
export function resolveCarrier(input: string | null | undefined): CarrierKey | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  const exact = CARRIERS.find((c) => c.key === v.toLowerCase());
  if (exact) return exact.key;
  return CARRIER_ALIASES.find(([re]) => re.test(v))?.[1] ?? null;
}
