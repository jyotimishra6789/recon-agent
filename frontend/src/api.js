const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getHealth: () => request("/health"),
  getSummary: () => request("/stats/summary"),
  reconcile: () => request("/reconcile", { method: "POST" }),
  getMatches: () => request("/matches"),
  getExceptions: (status = "open") => request(`/exceptions?status=${status}`),
  resolveException: (id, resolution_reason, pattern_type) =>
    request(`/exceptions/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution_reason, pattern_type }),
    }),
  getAuditLog: () => request("/audit-log"),
  getTimeSaved: () => request("/stats/time-saved"),
  askQuestion: (question) =>
    request("/qa", { method: "POST", body: JSON.stringify({ question }) }),
  getExceptionPatterns: () => request("/exception-patterns"),
  runStressTest: (sizes) =>
    request("/stress-test", { method: "POST", body: JSON.stringify({ sizes }) }),
};