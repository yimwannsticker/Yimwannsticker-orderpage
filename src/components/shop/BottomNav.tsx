"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart, useDraftItems } from "@/lib/client/cart";

const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L20.5 8H6" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </>
  ),
  orders: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
};

/** แถบเมนูล่างติดจอของหน้าร้าน */
export function BottomNav() {
  const path = usePathname();
  const a5 = useCart();
  const a3 = useDraftItems();
  const count = a5.length + a3.length;
  const items = [
    { href: "/", label: "หน้าแรก", icon: ICONS.home, on: path === "/" },
    { href: "/category", label: "หมวดหมู่", icon: ICONS.grid, on: path.startsWith("/category") },
    { href: "/cart", label: "ตะกร้า", icon: ICONS.cart, on: path.startsWith("/cart"), badge: count },
    { href: "/my-orders", label: "ออเดอร์ของฉัน", icon: ICONS.orders, on: path.startsWith("/my-orders") },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur" aria-label="เมนูหลัก">
      <div className="mx-auto grid max-w-xl grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            aria-current={it.on ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${it.on ? "text-brand-600" : "text-muted"}`}
          >
            <span className="relative">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {it.icon}
              </svg>
              {!!it.badge && (
                <span className="absolute -right-2.5 -top-1.5 min-w-5 rounded-full bg-accent-400 px-1 text-center text-[11px] font-bold leading-5 text-brand-700 ring-2 ring-white">
                  {it.badge > 99 ? "99+" : it.badge}
                </span>
              )}
            </span>
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
