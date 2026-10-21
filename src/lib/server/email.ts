import "server-only";
import nodemailer from "nodemailer";

/**
 * แจ้งเตือนร้านทางอีเมล ใช้ SMTP (เช่น Gmail + App Password ซึ่งฟรี)
 * ถ้าไม่ได้ตั้งค่า SMTP จะข้ามไปเฉยๆ ไม่ทำให้ออเดอร์ล้ม
 */
export async function notifyShop(to: string, subject: string, text: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const recipient = to || process.env.SHOP_NOTIFY_EMAIL || user;
  if (!host || !user || !pass || !recipient) return;
  try {
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user, pass },
    });
    await transport.sendMail({ from: `Yimwann Sticker <${user}>`, to: recipient, subject, text });
  } catch (e) {
    console.error("ส่งอีเมลแจ้งเตือนไม่สำเร็จ", e);
  }
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
