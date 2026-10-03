import "server-only";
import crypto from "crypto";

// The 4-digit code a customer gives the rider to confirm a delivery. It's
// derived from the order id with a server-only key, so it never has to be
// stored in plain text: deliveries.delivery_otp_hash holds only its HMAC
// (checked by verifyDeliveryOtp), and the order's owner can be shown it again
// on their tracking page. Riders never see it.

const secret = () => {
  const s = process.env.OTP_HMAC_SECRET;
  if (!s) throw new Error("OTP_HMAC_SECRET is not set");
  return s;
};

export function deliveryOtp(orderId: string) {
  const n = crypto.createHmac("sha256", secret()).update(`delivery-otp-v2:${orderId}`).digest().readUInt32BE(0);
  return String(n % 10000).padStart(4, "0");
}

export function hashOtp(otp: string, orderId: string) {
  return crypto.createHmac("sha256", secret()).update(`${orderId}:${otp}`).digest("hex");
}
