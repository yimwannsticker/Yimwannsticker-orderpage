import { BottomNav } from "@/components/shop/BottomNav";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto min-h-screen max-w-xl pb-24">{children}</div>
      <BottomNav />
    </>
  );
}
