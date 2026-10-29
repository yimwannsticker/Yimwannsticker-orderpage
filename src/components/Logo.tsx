/** โลโก้ Yimwann Sticker (ไฟล์จาก CI ใน public/brand) */
export function Logo({ variant = "horizontal", white = false, className = "h-9" }: { variant?: "horizontal" | "stacked" | "symbol"; white?: boolean; className?: string }) {
  const file = `/brand/${variant === "horizontal" ? "logo-horizontal" : variant === "stacked" ? "logo-stacked" : "symbol"}${white ? "-white" : ""}.png`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={file} alt="Yimwann Sticker" className={`w-auto ${className}`} />;
}
