"use client";

import dynamic from "next/dynamic";
import { Spinner } from "../ui";

// ร่างออเดอร์อยู่ใน localStorage จึง render เฉพาะฝั่ง browser
export const OrderPage = dynamic(() => import("./OrderWizard").then((m) => m.OrderWizard), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center text-brand-500">
      <Spinner className="h-8 w-8" />
    </div>
  ),
});
