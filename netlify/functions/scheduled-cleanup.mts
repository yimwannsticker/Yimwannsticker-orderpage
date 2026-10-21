// งานตั้งเวลาบน Netlify: เรียก /api/cron/cleanup ทุกชั่วโมง (ลบไฟล์หมดอายุ + heartbeat ฐานข้อมูล)
export default async function handler() {
  const base = process.env.URL;
  const res = await fetch(`${base}/api/cron/cleanup`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  console.log("cleanup", res.status, await res.text());
  return new Response("ok");
}

export const config = { schedule: "@hourly" };
