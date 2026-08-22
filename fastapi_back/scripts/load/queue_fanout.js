/**
 * Queue fan-out — many clients poll live queue (current production pattern).
 *
 * Measures API pressure from Flutter/Admin polling before Socket.IO rollout.
 *
 * Env:
 *   BASE_URL, AUTH_TOKEN, APPOINTMENT_ID
 *   QUEUE_VUS (default 100), QUEUE_DURATION (default "60s")
 *   ROLE=user|doctor|reception (default user)
 *   DOCTOR_TOKEN / RECEPTION_TOKEN when ROLE != user
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:5000";
const ROLE = (__ENV.ROLE || "user").toLowerCase();
const APPT = __ENV.APPOINTMENT_ID || "";
const VUS = Number(__ENV.QUEUE_VUS || 100);
const latency = new Trend("queue_poll_latency_ms");

export const options = {
  scenarios: {
    fanout: {
      executor: "constant-vus",
      vus: VUS,
      duration: __ENV.QUEUE_DURATION || "60s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    queue_poll_latency_ms: ["p(95)<800"],
  },
};

function authHeader() {
  if (ROLE === "doctor") {
    const t = __ENV.DOCTOR_TOKEN || __ENV.AUTH_TOKEN || "";
    return { token: t, dtoken: t, Authorization: `Bearer ${t}` };
  }
  if (ROLE === "reception") {
    const t = __ENV.RECEPTION_TOKEN || __ENV.AUTH_TOKEN || "";
    return { token: t, rtoken: t, Authorization: `Bearer ${t}` };
  }
  const t = __ENV.AUTH_TOKEN || "";
  return { token: t, Authorization: `Bearer ${t}` };
}

function url() {
  if (ROLE === "doctor") {
    return `${BASE}/api/doctor/queue-status`;
  }
  if (ROLE === "reception") {
    return `${BASE}/api/reception/queue`;
  }
  if (!APPT) {
    throw new Error("APPOINTMENT_ID is required for ROLE=user");
  }
  return `${BASE}/api/user/appointments/${APPT}/queue-live`;
}

export default function () {
  const res = http.get(url(), {
    headers: authHeader(),
    tags: { name: "queue_poll" },
  });
  latency.add(res.timings.duration);
  check(res, {
    "queue poll ok": (r) => r.status === 200 || r.status === 401 || r.status === 403,
    "not 5xx": (r) => r.status < 500,
  });
  // Mimic Flutter ~8s poll with jitter under load (compressed for test)
  sleep(Number(__ENV.POLL_SLEEP || 0.5));
}
