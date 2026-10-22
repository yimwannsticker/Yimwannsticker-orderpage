import type { Finish, OrderStatus, ProductKey, Settings, Shape } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  shopName: "Yimwann Sticker",
  sheetName: "A3+",
  sheetWidthMm: 330,
  sheetHeightMm: 483,
  sheetMarginMm: 3,
  cornerMarkMm: 5,
  stickerGapMm: 3,
  minStickerMm: 10,
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
  fileRetentionDays: 365,
  maxFileMb: 200,
  slipVerify: { enabled: false, provider: "slipok" },
  notifyEmail: "",
  contactLine: "",
  welcomeMessages: [
    "ยินดีต้อนรับกลับค่ะ คุณ{n} 💕",
    "สวัสดีค่ะ วันนี้มีงานอะไรให้ทางร้านบริการคะ คุณ{n} 💖",
    "คุณ{n} กลับมาแล้ว! วันนี้ให้ยิ้มหวานสติกเกอร์ผลิตอะไรดีคะ ✨",
    "สวัสดีค่ะ คุณ{n} ขอบคุณที่กลับมาอุดหนุนนะคะ 🙏",
    "สวัสดีค่ะ คุณ{n} วันนี้สั่งแบบไหนดีคะ 😊",
    "คุณ{n}กลับมาแล้ว 🌷 ยิ้มหวานสติกเกอร์ยินดีให้บริการค่ะ",
  ],
  thankYouMessages: [
    "ขอบคุณที่อุดหนุนนะคะ ขอให้สติกเกอร์ไปติดแล้วขายดีเทน้ำเทท่าค่ะ 💰✨",
    "ติดสติกเกอร์ปุ๊บ ลูกค้าต่อคิวปั๊บ! ขอให้ยอดปังๆ นะคะ 🚀",
    "ขอให้ของหมดไว กำไรงามๆ รวยๆ เฮงๆ ค่ะ 🧧",
    "ยิ้มหวานสติกเกอร์ขออวยพร ขายดีทุกวัน ยอดขายพุ่งไม่หยุดค่ะ 📈",
    "แปะแล้วเฮง ติดแล้วรวย ขอให้ลูกค้าเข้าร้านไม่ขาดสายนะคะ 🍀",
    "ขอให้ขายดีจนแพ็กของไม่ทันเลยค่ะ 📦💕",
    "สาธุ 🙏 ขอให้สติกเกอร์ชุดนี้เรียกทรัพย์ เรียกลูกค้า ปังทุกออเดอร์ค่ะ ✨",
    "ขอให้เงินไหลมาเทมา ได้รีวิวห้าดาวทุกวันนะคะ ⭐⭐⭐⭐⭐",
    "ขอให้น้ำขายดี ขนมขายหมด กลับบ้านกระเป๋าตุงๆ ค่ะ 🧋🍰💸",
    "ขอให้แบรนด์ของคุณ{n}มีเสน่ห์ ลูกค้าหลงรักจนต้องกลับมาซื้อซ้ำค่ะ 💘",
  ],
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

export const SHAPES: { key: Shape; label: string; hint: string }[] = [
  { key: "rect", label: "สี่เหลี่ยม", hint: "ตัดเป็นสี่เหลี่ยมตามขนาด" },
  { key: "circle", label: "วงกลม", hint: "ตัดเป็นวงกลมตามเส้นผ่านศูนย์กลาง" },
  { key: "freeform", label: "ไดคัทตามทรง", hint: "ตัดตามรูปร่างของงาน เว้นขอบขาวเล็กน้อย" },
];

export function shapeLabel(shape: Shape | null | undefined) {
  return SHAPES.find((x) => x.key === shape)?.label ?? "-";
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
