/**
 * Pharmacy partner burst — concurrent order status / list calls.
 *
 * Uses partner API key + HMAC headers when provided. Without HMAC, expect 401
 * (still useful to measure auth path load). For retry-path stress, use partner
 * dashboard retry after seeding failed webhook_deliveries.
 *
 * Env:
 *   BASE_URL
 *   PARTNER_API_KEY
 *   PARTNER_TIMESTAMP + PARTNER_SIGNATURE (optional; compute offline)
 *   ORDER_ID (for status posts)
 *   PHARMACY_VUS (default 30), PHARMACY_DURATION (default "30s")
 *   MODE=list|status|retry (default list)
 *   DELIVERY_ID (for MODE=retry)
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:5000";
const MODE = (__ENV.MODE || "list").toLowerCase();
const VUS = Number(__ENV.PHARMACY_VUS || 30);
const latency = new Trend("pharmacy_latency_ms");

export const options = {
  scenarios: {
    burst: {
      executor: "constant-vus",
      vus: VUS,
      duration: __ENV.PHARMACY_DURATION || "30s",
    },
  },
  thresholds: {
    pharmacy_latency_ms: ["p(95)<1500"],
  },
};

function partnerHeaders() {
  const h = {
    "Content-Type": "application/json",
    "X-Api-Key": __ENV.PARTNER_API_KEY || "",
  };
  if (__ENV.PARTNER_TIMESTAMP) {
    h["X-Timestamp"] = __ENV.PARTNER_TIMESTAMP;
  }
  if (__ENV.PARTNER_SIGNATURE) {
    h["X-Signature"] = __ENV.PARTNER_SIGNATURE;
  }
  return h;
}

export default function () {
  let res;
  if (MODE === "status") {
    const orderId = __ENV.ORDER_ID || "0";
    res = http.post(
      `${BASE}/api/v1/partner/pharmacy/orders/${orderId}/status`,
      JSON.stringify({ status: "processing", note: "loadtest" }),
      { headers: partnerHeaders(), tags: { name: "pharmacy_status" } }
    );
  } else if (MODE === "retry") {
    const id = __ENV.DELIVERY_ID || "0";
    res = http.post(`${BASE}/api/partner/dashboard/webhooks/${id}/retry`, null, {
      headers: partnerHeaders(),
      tags: { name: "pharmacy_webhook_retry" },
    });
  } else {
    res = http.get(`${BASE}/api/v1/partner/pharmacy/orders`, {
      headers: partnerHeaders(),
      tags: { name: "pharmacy_orders_list" },
    });
  }

  latency.add(res.timings.duration);
  check(res, {
    "auth or success (not 5xx)": (r) => r.status < 500,
  });
  sleep(0.2);
}
