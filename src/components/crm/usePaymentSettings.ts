"use client";

import { useEffect, useState } from "react";
import type { PaymentSettings } from "@/lib/crm";

/** Loads the saved payment settings (QRIS image + bank accounts). */
export function usePaymentSettings(): PaymentSettings | null {
  const [payment, setPayment] = useState<PaymentSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payment")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PaymentSettings | null) => {
        if (!cancelled && data) setPayment(data);
      })
      .catch(() => {
        // keep null
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return payment;
}
