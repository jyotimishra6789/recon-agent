import React, { useState, useRef, useEffect } from "react";
import { api } from "../api";

const SUGGESTIONS = [
  "Total unresolved amount?",
  "Which reason has the most exceptions?",
  "How many matches used the LLM tier?",
  "Total amount matched today?",
];

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
          setMessages((m) => m.map((message, index) => index === m.length - 1
            ? { ...message, status: null } : message));
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
            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
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
