import crypto from "node:crypto";
import Razorpay from "razorpay";

export const HOLD_MINUTES = 10;

export function getRazorpay(){
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if(!keyId|| !keySecret) throw new Error("Razorpay keys are not configured");
    return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId, keySecret };
}
function safeEqual(a: string, b: string) {
    const x = Buffer.from(a, "utf8");
    const y = Buffer.from(b, "utf8");
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Checks the signature Razorpay Checkout returns to the browser
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;
    const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    return safeEqual(expected, signature);
}

//checks the signature on webhook requests(computed over the raw body)
export function verifyWebhookSignature(rawBody: string, signature: string){
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if(!secret) return false;
    const  expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEqual(expected, signature);
}

