const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
const STREAM_URL = process.env.REACT_APP_AI_API_URL ||
  `${BASE_URL}/qa/stream`;

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
  askQuestionStream: async (question, onEvent) => {
    const res = await fetch(STREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Request failed: ${res.status}`);
    }
    if (!res.body) throw new Error("Streaming responses are not supported by this connection");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (STREAM_URL === "/api/chat") {
        if (value) onEvent("text", { delta: decoder.decode(value, { stream: !done }) });
        if (done) onEvent("done", { source: "gemini" });
        if (done) break;
        continue;
      }
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      events.forEach((chunk) => {
        const event = chunk.match(/^event: (.+)$/m)?.[1];
        const data = chunk.match(/^data: (.+)$/m)?.[1];
        if (event && data) onEvent(event, JSON.parse(data));
      });
      if (done) break;
    }
  },
  getExceptionPatterns: () => request("/exception-patterns"),
  runStressTest: (sizes) =>
    request("/stress-test", { method: "POST", body: JSON.stringify({ sizes }) }),
  uploadReceipt: async (file, amount, receiptDate) => {
    const form = new FormData();
    form.append("file", file);
    if (amount) form.append("amount", amount);
    if (receiptDate) form.append("receipt_date", receiptDate);
    const res = await fetch(`${BASE_URL}/receipts/upload`, { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.detail || `Request failed: ${res.status}`);
    return body;
  },
};