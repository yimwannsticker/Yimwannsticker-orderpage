"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

/** Google Analytics 4 · ไม่เก็บหน้าหลังบ้าน (เปลี่ยนหน้าในเว็บ GA4 นับให้เองจาก history) */
export function Analytics({ id }: { id: string }) {
  const path = usePathname();
  const admin = path.startsWith("/admin");
  useEffect(() => {
    (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = admin;
  }, [id, admin]);
  // ไปหลังบ้านหลังโหลดแล้ว: ตัวแปร ga-disable ด้านบนหยุดเก็บให้
  if (admin) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
