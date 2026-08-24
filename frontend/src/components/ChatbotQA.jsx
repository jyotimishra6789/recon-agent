import React, { useState, useRef, useEffect } from "react";
import { api } from "../api";

const SUGGESTIONS = [
  "Total unresolved amount?",
  "Which reason has the most exceptions?",
  "How many matches used the LLM tier?",
  "How many receipts are recorded?",
  "What are the latest receipts?",
  "Total receipt expense amount?",
  "Why was TXN10009 resolved?",
  "Show me the reconciliation report summary",
];

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function ResultDetails({ result }) {
  if (!result) return null;
  const item = Array.isArray(result) ? result[0] : result;
  if (!item || typeof item !== "object") return <span>Details: {formatValue(item)}</span>;
  const exception = item.exception;
  const match = item.match;
  const details = exception || match || item;
  const auditEvents = item.related_audit_events || [];
  const fields = Object.entries(details).filter(([key]) => key !== "details");

  return (
    <div className="chat-result-details">
      <div className="chat-detail-grid">
        {fields.map(([key, value]) => (
          <span key={key}><b>{key.replaceAll("_", " ")}</b>{formatValue(value)}</span>
        ))}
      </div>
      {auditEvents.length > 0 && (
        <div className="chat-audit-list">
          <b>Related audit activity</b>
          {auditEvents.map((event, index) => (
            <span key={`${event.timestamp}-${index}`}>
              {formatValue(event.action)} · {formatValue(event.timestamp)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatbotQA() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Ask anything about data \"what is the total unresolved amount ?\"" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  const send = async (question) => {
    const q = question ?? input;
    if (!q.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "bot", text: "", status: "Thinking..." }]);
    try {
      await api.askQuestionStream(q, (event, payload) => {
        if (event === "reasoning") {
          setMessages((m) => m.map((message, index) => index === m.length - 1
            ? { ...message, status: payload.text } : message));
        }
        if (event === "tool_call" && payload.status === "started") {
          setMessages((m) => m.map((message, index) => index === m.length - 1
            ? { ...message, status: `Using ${payload.name}...` } : message));
        }
        if (event === "text") {
          setMessages((m) => m.map((message, index) => index === m.length - 1
            ? { ...message, text: message.text + payload.delta, status: null } : message));
        }
        if (event === "done") {
          setMessages((m) => m.map((message, index) => {
            if (index !== m.length - 1) return message;
            try {
              return { ...message, structured: JSON.parse(message.text), status: null };
            } catch {
              return { ...message, status: null };
            }
          }));
        }
      });
    } catch (e) {
      setMessages((m) => m.map((message, index) => index === m.length - 1
        ? { ...message, text: `Error: ${e.message}`, status: null } : message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div className={`chat-msg ${m.role}`} key={i}>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.structured ? "" : m.text}</div>
            {m.structured && <div className="ai-structured">
              <strong>{m.structured.answer}</strong>
              {m.structured.source && <span>Source: {m.structured.source}</span>}
              <span>Confidence: {m.structured.confidence_score ?? "N/A"}</span>
              <span>Reason: {m.structured.reason}</span>
              <span>Exception: {m.structured.exception_type}</span>
              {m.structured.human_review_required && <span className="guardrail-warning">
                Human review required: {m.structured.guardrail_reasons.join("; ") || "policy check"}
              </span>}
              {m.structured.matched_transaction && <span>Match: {Object.values(m.structured.matched_transaction).filter((value) => value !== null).join(" · ")}</span>}
              {m.structured.result && <ResultDetails result={m.structured.result} />}
            </div>}
            {m.status && <div className="chat-status">{m.status}</div>}
            {m.sql && <div className="sql-line">{m.sql}</div>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-suggestions">
        {SUGGESTIONS.map((s) => (
          <span className="chat-suggestion" key={s} onClick={() => send(s)}>{s}</span>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type something…"
          disabled={busy}
        />
        <button onClick={() => send()} disabled={busy}>{busy ? "…" : "Ask"}</button>
      </div>
    </div>
  );
}
