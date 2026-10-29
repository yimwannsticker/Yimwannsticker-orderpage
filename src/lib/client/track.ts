/**
 * ส่งเหตุการณ์ให้ Google Analytics · ใส่ลง dataLayer ตรง (แบบเดียวกับ gtag)
 * จึงไม่หายแม้สคริปต์ GA ยังโหลดไม่เสร็จ · ร้านไม่เปิด GA ก็แค่ค้างอยู่ในหน้า ไม่ส่งไปไหน
 */
export function track(event: string, params: Record<string, unknown>) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    // gtag.js อ่านค่าเป็น arguments object เท่านั้น
    const gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    } as (...args: unknown[]) => void;
    gtag("event", event, { currency: "THB", ...params });
  } catch {
    // ไม่ให้สถิติทำให้หน้าเว็บพัง
  }
}
