import Link from "next/link";
import { getSettings } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "นโยบายความเป็นส่วนตัว | Yimwann Sticker" };

export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <main className="mx-auto max-w-xl px-4 py-8 leading-relaxed">
      <Link href="/" className="text-sm text-brand-600">
        ← กลับไปหน้าสั่งพิมพ์
      </Link>
      <h1 className="mt-3 text-2xl font-bold">นโยบายความเป็นส่วนตัว</h1>
      <div className="card mt-4 space-y-4 text-sm">
        <section>
          <h2 className="font-semibold">ข้อมูลที่เราเก็บ</h2>
          <p>ชื่อ เบอร์โทร ที่อยู่จัดส่ง ไฟล์งานที่อัปโหลด สลิปการโอนเงิน และ LINE ID (เฉพาะกรณีที่คุณเลือกเข้าสู่ระบบด้วย LINE)</p>
        </section>
        <section>
          <h2 className="font-semibold">ใช้เพื่ออะไร</h2>
          <p>เพื่อผลิตและจัดส่งสินค้า ตรวจสอบการชำระเงิน แจ้งสถานะและเลขพัสดุ และนับยอดสะสมโปรโมชั่น เราไม่ขายหรือส่งต่อข้อมูลให้ผู้อื่น ยกเว้นบริษัทขนส่งเพื่อจัดส่งสินค้า</p>
        </section>
        <section>
          <h2 className="font-semibold">เก็บนานแค่ไหน</h2>
          <p>
            ไฟล์งานและสลิปจะถูกลบอัตโนมัติหลังจัดส่งสินค้า {s.fileRetentionDays} วัน ส่วนข้อมูลออเดอร์ (ชื่อ เบอร์ ที่อยู่ รายการสินค้า) เก็บไว้เป็นประวัติการขายและยอดสะสม
          </p>
        </section>
        <section>
          <h2 className="font-semibold">สิทธิของคุณ</h2>
          <p>คุณขอดู แก้ไข หรือขอให้ลบข้อมูลของคุณได้ โดยติดต่อร้าน{s.contactLine ? ` ทาง LINE ${s.contactLine}` : ""}</p>
        </section>
      </div>
    </main>
  );
}
