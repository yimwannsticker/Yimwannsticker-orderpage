import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { getSettings } from "@/lib/server/settings";
import "./globals.css";

const thai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "สั่งพิมพ์สติกเกอร์ | Yimwann Sticker",
  description: "สติกเกอร์สำเร็จรูป A5 และสั่งพิมพ์ไฟล์ของคุณเอง A3+ เลือก ชำระเงิน จบในหน้าเดียว",
  openGraph: {
    siteName: "Yimwann Sticker",
    locale: "th_TH",
    type: "website",
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "Yimwann Sticker" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#006a52",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ga = await getSettings()
    .then((s) => s.gaMeasurementId)
    .catch(() => "");
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        {/^G-[A-Z0-9]{4,15}$/.test(ga) && <Analytics id={ga} />}
      </body>
    </html>
  );
}
