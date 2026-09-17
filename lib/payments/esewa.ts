import crypto from "crypto";

// Sandbox defaults so the flow works out of the box in dev. Set real
// values in production env vars before going live — see .env.example.
const PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || "EPAYTEST";
const SECRET_KEY = process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q";
const IS_LIVE = process.env.ESEWA_MODE === "live";

const FORM_URL = IS_LIVE
  ? "https://epay.esewa.com.np/api/epay/main/v2/form"
  : "https://rc-epay.esewa.com.np/api/epay/main/v2/form";

const STATUS_URL = IS_LIVE
  ? "https://epay.esewa.com.np/api/epay/transaction/status/"
  : "https://rc.esewa.com.np/api/epay/transaction/status/";

const SIGNED_FIELD_NAMES = "total_amount,transaction_uuid,product_code";

function sign(totalAmount: string, transactionUuid: string) {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${PRODUCT_CODE}`;
  return crypto.createHmac("sha256", SECRET_KEY).update(message).digest("base64");
}

/**
 * Fields for a hidden auto-submitting form POSTed to eSewa's form URL —
 * this is their integration model, a full-page redirect, not a fetch.
 * `transactionUuid` must be unique per attempt; we use the order id.
 */
export function buildEsewaFormPayload(params: {
  transactionUuid: string;
  totalAmount: number;
  successUrl: string;
  failureUrl: string;
}) {
  const totalAmount = params.totalAmount.toFixed(2);
  return {
    action: FORM_URL,
    fields: {
      amount: totalAmount,
      tax_amount: "0",
      total_amount: totalAmount,
      transaction_uuid: params.transactionUuid,
      product_code: PRODUCT_CODE,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: params.successUrl,
      failure_url: params.failureUrl,
      signed_field_names: SIGNED_FIELD_NAMES,
      signature: sign(totalAmount, params.transactionUuid),
    },
  };
}

export type EsewaStatus = "COMPLETE" | "PENDING" | "NOT_FOUND" | "CANCELED" | "FULL_REFUND" | "PARTIAL_REFUND" | "AMBIGUOUS";

/**
 * The redirect back from eSewa is NOT proof of payment on its own — it's
 * a value the browser carried, and browsers are not trusted. This calls
 * eSewa's own status API server-side, which is the only source of truth.
 */
export async function verifyEsewaTransaction(transactionUuid: string, totalAmount: number) {
  const url = new URL(STATUS_URL);
  url.searchParams.set("product_code", PRODUCT_CODE);
  url.searchParams.set("total_amount", totalAmount.toFixed(2));
  url.searchParams.set("transaction_uuid", transactionUuid);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return { status: "NOT_FOUND" as EsewaStatus, ref_id: null as string | null };

  const data = await res.json();
  return { status: data.status as EsewaStatus, ref_id: (data.ref_id as string | null) ?? null };
}

/** Decodes the base64 `data` query param eSewa appends to success_url — informational only, always re-verified via the status API before trusting it. */
export function decodeEsewaRedirect(data: string) {
  try {
    return JSON.parse(Buffer.from(data, "base64").toString("utf-8")) as {
      transaction_uuid: string;
      total_amount: string;
      status: string;
      transaction_code: string;
    };
  } catch {
    return null;
  }
}
