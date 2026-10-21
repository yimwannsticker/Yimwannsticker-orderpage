/**
 * คำนวณจำนวนดวงต่อแผ่น ตามวิธีของ Sheet Yield Calculator ของร้าน
 * - เว้นขอบแผ่น (เส้นแดง) แล้ววางดวงเป็นตารางกึ่งกลาง เว้นระยะห่างระหว่างดวง
 * - เว้นพื้นที่สี่เหลี่ยมที่มุมทั้ง 4 สำหรับเครื่องหมายตัด (แถวที่ชนมุมจะลดจำนวนดวงแล้วจัดกึ่งกลางใหม่)
 * - เศษพื้นที่บน/ล่างที่ไม่พอวางอีกแถว ลองวางดวงแบบหมุน 90° เพิ่ม
 * - สี่เหลี่ยม: ลองหมุนทั้งตาราง 90° ด้วย เลือกแบบที่ได้มากกว่า
 * - วงกลม: ลองเรียงแบบสลับแถว (รังผึ้ง) ด้วย
 */
const EPS = 1e-6;

export interface LayoutParams {
  sheetW: number;
  sheetH: number;
  /** ขอบแผ่นถึงเส้นแดง (มม.) */
  margin: number;
  /** ระยะห่างระหว่างดวง (มม.) */
  gap: number;
  /** ขนาดพื้นที่เว้นที่มุม สำหรับเครื่องหมายตัด (มม.) 0 = ไม่เว้น */
  cornerR: number;
}

interface Area {
  ux0: number;
  uy0: number;
  ux1: number;
  uy1: number;
}

function inCornerZone(x0: number, y0: number, x1: number, y1: number, a: Area, r: number) {
  if (r <= 0) return false;
  const zones = [
    [a.ux0, a.uy0, a.ux0 + r, a.uy0 + r],
    [a.ux1 - r, a.uy0, a.ux1, a.uy0 + r],
    [a.ux0, a.uy1 - r, a.ux0 + r, a.uy1],
    [a.ux1 - r, a.uy1 - r, a.ux1, a.uy1],
  ];
  return zones.some(([zx0, zy0, zx1, zy1]) => x0 < zx1 - EPS && x1 > zx0 + EPS && y0 < zy1 - EPS && y1 > zy0 + EPS);
}

/** จำนวนดวงในแถวที่ไม่ชนพื้นที่มุม (ไล่ลดจำนวนแล้วจัดกึ่งกลางใหม่) */
function bestCenteredRow(y: number, w: number, h: number, maxCols: number, gap: number, a: Area, r: number) {
  const usableW = a.ux1 - a.ux0;
  for (let n = maxCols; n >= 0; n--) {
    const gridW = n > 0 ? n * w + (n - 1) * gap : 0;
    const startX = a.ux0 + (usableW - gridW) / 2;
    let clear = true;
    for (let c = 0; c < n && clear; c++) {
      const x0 = startX + c * (w + gap);
      if (inCornerZone(x0, y, x0 + w, y + h, a, r)) clear = false;
    }
    if (clear) return n;
  }
  return 0;
}

/** ตารางหลัก + แถวเสริมแบบหมุน 90° ในเศษพื้นที่บน/ล่าง */
function mixedLayout(a: Area, pw: number, ph: number, gap: number, r: number, forceRows?: number) {
  const usableW = a.ux1 - a.ux0;
  const usableH = a.uy1 - a.uy0;
  const maxCols = Math.max(0, Math.floor((usableW + gap + EPS) / (pw + gap)));
  const maxRows = Math.max(0, Math.floor((usableH + gap + EPS) / (ph + gap)));
  const cols = maxCols;
  const rows = forceRows !== undefined ? Math.min(forceRows, maxRows) : maxRows;
  const gridH = rows > 0 ? rows * ph + (rows - 1) * gap : 0;

  const sw2 = ph;
  const sh2 = pw;
  const leftover = usableH - gridH;
  const extraRows = rows > 0 && sh2 > 0 && leftover + EPS >= sh2 + gap ? Math.floor((leftover + EPS) / (sh2 + gap)) : 0;
  const bottomRows = Math.ceil(extraRows / 2);
  const topRows = extraRows - bottomRows;
  const extraCols = extraRows > 0 ? Math.max(0, Math.floor((usableW + gap + EPS) / (sw2 + gap))) : 0;
  const totalH = topRows * (sh2 + gap) + gridH + bottomRows * (sh2 + gap);

  let count = 0;
  let y = a.uy0 + (usableH - totalH) / 2;
  for (let i = 0; i < topRows; i++) {
    if (i > 0) y += gap;
    count += bestCenteredRow(y, sw2, sh2, extraCols, gap, a, r);
    y += sh2;
  }
  if (topRows > 0) y += gap;
  for (let i = 0; i < rows; i++) {
    if (i > 0) y += gap;
    count += bestCenteredRow(y, pw, ph, cols, gap, a, r);
    y += ph;
  }
  if (bottomRows > 0) y += gap;
  for (let i = 0; i < bottomRows; i++) {
    if (i > 0) y += gap;
    count += bestCenteredRow(y, sw2, sh2, extraCols, gap, a, r);
    y += sh2;
  }
  return { count, rows };
}

/** บางครั้งวางแถวหลักน้อยลง 1 แถว แล้วได้แถวเสริมมากกว่า */
function bestGrid(a: Area, pw: number, ph: number, gap: number, r: number) {
  const base = mixedLayout(a, pw, ph, gap, r);
  if (base.rows <= 0) return base.count;
  return Math.max(base.count, mixedLayout(a, pw, ph, gap, r, base.rows - 1).count);
}

function hexVariant(a: Area, D: number, gap: number, r: number, cols: number, dx: number, forceRows?: number) {
  if (D <= 0 || cols <= 0) return { count: 0, rows: 0 };
  const usableW = a.ux1 - a.ux0;
  const usableH = a.uy1 - a.uy0;
  const P = D + gap;
  const gridWFull = cols * D + (cols - 1) * gap;
  const offsetCols = Math.max(0, Math.floor((usableW - dx + gap + EPS) / P));
  const gridWOffset = offsetCols > 0 ? offsetCols * D + (offsetCols - 1) * gap : 0;
  const overallW = Math.max(gridWFull, dx + gridWOffset);
  const shift = a.ux0 + (usableW - overallW) / 2;

  const v = Math.sqrt(Math.max(0, P * P - dx * dx));
  const maxRows = usableH + EPS >= D ? Math.floor((usableH - D + EPS) / v) + 1 : 0;
  const rows = forceRows !== undefined ? Math.min(forceRows, maxRows) : maxRows;
  const blockH = rows > 0 ? (rows - 1) * v + D : 0;
  const startY = a.uy0 + (usableH - blockH) / 2;

  let count = 0;
  for (let row = 0; row < rows; row++) {
    const isOffset = row % 2 === 1;
    const n = isOffset ? offsetCols : cols;
    const x = isOffset ? shift + dx : shift;
    const y0 = startY + row * v;
    for (let c = 0; c < n; c++) {
      const x0 = x + c * P;
      if (!inCornerZone(x0, y0, x0 + D, y0 + D, a, r)) count++;
    }
  }
  return { count, rows };
}

/** วงกลมเรียงสลับแถว ลองหลายจำนวนคอลัมน์/ระยะเยื้อง/จำนวนแถว เลือกที่ได้มากสุด */
function bestHex(a: Area, D: number, gap: number, r: number) {
  if (D <= 0) return 0;
  const usableW = a.ux1 - a.ux0;
  const P = D + gap;
  const fullColsMax = Math.max(0, Math.floor((usableW + gap + EPS) / P));
  let best = 0;
  for (const cols of new Set([fullColsMax, fullColsMax - 1].filter((c) => c >= 0))) {
    const gridWFull = cols * D + (cols - 1) * gap;
    const maxUniformDx = Math.max(0, usableW - gridWFull);
    for (const dx of new Set([P / 2, Math.min(P / 2, maxUniformDx)])) {
      const base = hexVariant(a, D, gap, r, cols, dx);
      best = Math.max(best, base.count);
      if (base.rows > 0) best = Math.max(best, hexVariant(a, D, gap, r, cols, dx, base.rows - 1).count);
    }
  }
  return best;
}

/** จำนวนดวงต่อแผ่น */
export function piecesPerSheet(w: number, h: number, circle: boolean, p: LayoutParams) {
  if (!(w > 0 && h > 0 && p.sheetW > 0 && p.sheetH > 0)) return 0;
  const usableW = p.sheetW - 2 * p.margin;
  const usableH = p.sheetH - 2 * p.margin;
  if (usableW <= 0 || usableH <= 0) return 0;
  const a: Area = { ux0: p.margin, uy0: p.margin, ux1: p.margin + usableW, uy1: p.margin + usableH };
  if (circle) {
    const d = w;
    return Math.max(bestGrid(a, d, d, p.gap, p.cornerR), bestHex(a, d, p.gap, p.cornerR));
  }
  return Math.max(bestGrid(a, w, h, p.gap, p.cornerR), bestGrid(a, h, w, p.gap, p.cornerR));
}
