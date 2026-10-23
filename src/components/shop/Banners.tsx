"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** แบนเนอร์เลื่อนอัตโนมัติ (ปัดเลื่อนเองได้) */
export function Banners({ items }: { items: { url: string; link: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el || document.visibilityState !== "visible") return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % items.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((b, idx) => {
          // eslint-disable-next-line @next/next/no-img-element
          const img = <img src={b.url} alt={`แบนเนอร์ ${idx + 1}`} className="aspect-[2/1] w-full object-cover" loading={idx ? "lazy" : "eager"} />;
          return (
            <div key={idx} className="w-full shrink-0 snap-center">
              {b.link ? <Link href={b.link}>{img}</Link> : img}
            </div>
          );
        })}
      </div>
      {items.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {items.map((_, idx) => (
            <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
