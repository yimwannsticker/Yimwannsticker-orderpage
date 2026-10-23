export type ProductKey = "paper" | "pp";
export type Finish = "gloss" | "matte" | "clear";

export type CheckLevel = "green" | "yellow" | "red";

/** รูปทรงไดคัท */
export type Shape = "rect" | "circle" | "freeform";

export interface CheckIssue {
  level: CheckLevel;
  message: string;
  /** ปัญหาที่ขึ้นกับขนาดดวง/ทรงไดคัท คำนวณใหม่ทุกครั้งที่เปลี่ยนขนาด */
  code?: "dpi" | "shape" | "size";
}

export interface CheckResult {
  level: CheckLevel;
  /** ข้อความสั้นบนป้าย */
  title: string;
  issues: CheckIssue[];
  /** ข้อมูลประกอบสำหรับกราฟิก */
  info: {
    kind?: string;
    widthPx?: number;
    heightPx?: number;
    dpi?: number;
    colorMode?: string;
    pageWidthMm?: number;
    pageHeightMm?: number;
    pages?: number;
    fonts?: string[];
    missingLinks?: string[];
    minImageDpi?: number;
    hasAlpha?: boolean;
    /** ขนาดไฟล์เต็มก่อนตัดพื้นหลัง (มีเฉพาะเมื่อลูกค้าเลือกตัด) */
    fullWidthPx?: number;
    fullHeightPx?: number;
    needsManualReview?: boolean;
  };
  checkedBy: "browser" | "server";
}

export interface PriceTier {
  /** จำนวนแผ่นรวมขั้นต่ำของขั้นนี้ */
  min: number;
  paper: number;
  pp: number;
}

export interface Settings {
  shopName: string;
  sheetName: string;
  sheetWidthMm: number;
  sheetHeightMm: number;
  /** ขอบแผ่นถึงเส้นแดง (มม.) ใช้ประมาณจำนวนดวงต่อแผ่น */
  sheetMarginMm: number;
  /** พื้นที่เว้นที่มุมแผ่นสำหรับเครื่องหมายตัด (มม.) */
  cornerMarkMm: number;
  /** ระยะห่างระหว่างดวง (มม.) */
  stickerGapMm: number;
  /** ขนาดดวงเล็กสุดที่รับ (มม.) */
  minStickerMm: number;
  tiers: PriceTier[];
  minPerFile: number;
  shippingFee: number;
  freeShippingMin: number;
  promo: { enabled: boolean; every: number; free: number };
  fixFileFee: number;
  dpiGood: number;
  dpiMin: number;
  promptpayId: string;
  promptpayName: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  /** ข้อความใน LINE ตอนแจ้งเลขแทร็ค ใช้ {orderNo} {trackingNo} {carrier} ได้ */
  lineTrackingMessage: string;
  /** ข้อความนำหน้าเวลาบอทตอบสถานะ */
  lineReplyFooter: string;
  fileRetentionDays: number;
  maxFileMb: number;
  slipVerify: { enabled: boolean; provider: "slipok" | "easyslip" };
  notifyEmail: string;
  contactLine: string;
  /** ข้อความทักทายลูกค้าเก่าแบบสุ่ม ({n} = ชื่อลูกค้า) */
  welcomeMessages: string[];
  /** ข้อความขอบคุณ/อวยพรหน้าสั่งเสร็จแบบสุ่ม ({n} = ชื่อลูกค้า) */
  thankYouMessages: string[];
  /** ราคาส่งสติกเกอร์สำเร็จรูป A5: ขั้นบันไดตามจำนวนแผ่น A5 รวมทั้งตะกร้า */
  a5Tiers: A5Tier[];
  a5ShippingFee: number;
  /** A5 ครบกี่แผ่นส่งฟรี (นับแยกจาก A3+) */
  a5FreeShippingMin: number;
  /** สินค้าราคาคงที่ (การ์ด): ค่าส่งเมื่อสั่งไม่ถึงเกณฑ์ และเกณฑ์ส่งฟรี (นับเป็นชิ้น/ใบ) */
  fixedShippingFee: number;
  fixedFreeShippingUnits: number;
  /** แบนเนอร์หน้าแรก (รูปใน R2) */
  banners: Banner[];
}

export interface A5Tier {
  /** จำนวนแผ่น A5 รวมขั้นต่ำของขั้นนี้ */
  min: number;
  price: number;
}

export interface Banner {
  path: string;
  /** ลิงก์เมื่อกด (ไม่บังคับ) เช่น /p/xxx หรือ /category?c=xxx */
  link: string;
}

/** รายการในตะกร้า A5 (เก็บในเครื่องลูกค้า) */
export interface A5CartLine {
  productId: string;
  designId: string;
  sizeId: string | null;
  qty: number;
  /** สินค้าราคาคงที่ (ไม่นับเป็นแผ่น A5) ใช้แสดงผลในเครื่องเท่านั้น ราคาจริงคิดที่ server */
  fixed?: boolean;
}

/** ส่วนที่ส่งให้ฝั่งลูกค้าได้ (ไม่มีข้อมูลภายใน) */
export type PublicSettings = Omit<Settings, "notifyEmail" | "slipVerify" | "lineReplyFooter" | "lineTrackingMessage">;

export type OrderStatus = "pending_slip" | "paid" | "producing" | "shipped" | "cancelled";

export interface Address {
  line1: string;
  subdistrict: string;
  district: string;
  province: string;
  zipcode: string;
}

/** ตัดพื้นหลังรอบงาน: กรอบส่วนงานจริงเป็นสัดส่วน 0–1 ของไฟล์ */
export interface Trim {
  x: number;
  y: number;
  w: number;
  h: number;
  /** สีพื้นหลังที่ตัด (#rrggbb) หรือ "transparent" */
  color: string;
}

export interface DraftItem {
  /** id ภายใน browser */
  key: string;
  uploadId: string | null;
  previewUploadId: string | null;
  previewUrl: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: "uploading" | "checking" | "done" | "error";
  progress: number;
  error?: string;
  check: CheckResult | null;
  product: ProductKey | null;
  finish: Finish;
  qty: number;
  shape: Shape | null;
  /** ขนาดดวง (มม.) วงกลมใช้ widthMm = heightMm = เส้นผ่านศูนย์กลาง */
  widthMm: number | null;
  heightMm: number | null;
  acceptRisk: boolean;
  fixService: boolean;
  /** ลูกค้าเลือกตัดพื้นหลังรอบงาน (ใช้เฉพาะส่วนงานคิดขนาด/สัดส่วน/DPI) */
  trim?: Trim | null;
  /** สั่งซ้ำ: ใช้ไฟล์จากออเดอร์เดิม ไม่ต้องอัปโหลดใหม่ */
  source?: {
    /** มาจากปุ่มสั่งซ้ำในหน้าเช็คสถานะ */
    token?: string;
    /** มาจาก "ไฟล์ที่เคยสั่ง" (ยืนยันชื่อ + เบอร์แล้ว) */
    grant?: string;
    itemId: string;
    orderNo: string;
    prevApproved: boolean;
    prevFixed: boolean;
  } | null;
}
