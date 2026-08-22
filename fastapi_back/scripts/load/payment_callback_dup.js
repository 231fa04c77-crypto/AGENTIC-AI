/**
 * Payment duplicate callback — fires the same Razorpay webhook payload many times.
 *
 * Pass criteria: payment claim remains idempotent (single fulfillment).
 * Requires a valid X-Razorpay-Signature for your staging secret, or set
 * SKIP_SIGNATURE_CHECK only if your staging build temporarily allows it
 * (do NOT disable in production).
 *
 * Env:
 *   BASE_URL
 *   RAZORPAY_ORDER_ID
 *   RAZORPAY_PAYMENT_ID (optional)
 *   RAZORPAY_WEBHOOK_SIGNATURE — required for real verify
 *   PAYMENT_VUS (default 20), PAYMENT_DURATION (default "10s")
 *   PAYMENT_PAYLOAD_JSON — optional full webhook body override
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:5000";
const ORDER = __ENV.RAZORPAY_ORDER_ID || "";
const PAYMENT = __ENV.RAZORPAY_PAYMENT_ID || "pay_loadtest_dup";
const SIG = __ENV.RAZORPAY_WEBHOOK_SIGNATURE || "";
const VUS = Number(__ENV.PAYMENT_VUS || 20);

const accepted = new Counter("payment_webhook_accepted");
const rejected = new Counter("payment_webhook_rejected");

export const options = {
  scenarios: {
    dup: {
      executor: "constant-vus",
      vus: VUS,
      duration: __ENV.PAYMENT_DURATION || "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.95"],
  },
};

function payload() {
  if (__ENV.PAYMENT_PAYLOAD_JSON) {
    return __ENV.PAYMENT_PAYLOAD_JSON;
  }
  if (!ORDER) {
    throw new Error("RAZORPAY_ORDER_ID or PAYMENT_PAYLOAD_JSON required");
  }
  return JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: PAYMENT,
          order_id: ORDER,
          status: "captured",
          amount: 10000,
          currency: "INR",
        },
      },
      order: {
        entity: {
          id: ORDER,
        },
      },
    },
  });
}

export default function () {
  const body = payload();
  const headers = {
    "Content-Type": "application/json",
    "X-Razorpay-Signature": SIG || "invalid-for-unsigned-staging",
  };
  const res = http.post(`${BASE}/api/payments/webhook`, body, {
    headers,
    tags: { name: "payment_webhook_dup" },
  });

  if (res.status >= 200 && res.status < 300) {
    accepted.add(1);
  } else {
    rejected.add(1);
  }

  check(res, {
    "not 5xx under duplicate storm": (r) => r.status < 500,
  });
  sleep(0.05);
}

export function handleSummary(data) {
  return {
    stdout:
      "\nAfter run: query payment_transactions for RAZORPAY_ORDER_ID — status must be fulfilled exactly once.\n" +
      "See payment_transaction_model claim FOR UPDATE (good pattern).\n",
  };
}
