import { verifyPayment } from "@/actions/payments";
import type { CheckoutInfo } from "@/lib/payment-types";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// Resolves with "paid", "dismissed", or an error message
export function runCheckout(c: CheckoutInfo): Promise<string> {
  return new Promise((resolve) => {
    const rz = new window.Razorpay({
      key: c.keyId,
      amount: c.amountPaise,
      currency: c.currency,
      order_id: c.orderId,
      name: "Medrella",
      description: `Consultation with ${c.doctorName}`,
      prefill: { name: c.patientName, email: c.patientEmail },
      theme: { color: "#0E6B58" },
      handler: async (r: any) => {
        const v = await verifyPayment(r);
        resolve(v.ok ? "paid" : v.error);
      },
      modal: { ondismiss: () => resolve("dismissed") },
    });
    rz.open();
  });
}