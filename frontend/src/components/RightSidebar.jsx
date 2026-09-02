import React, { useState, useRef, useEffect } from "react";
import styles from "./RightSidebar.module.css";
import { api } from "../api";

const STARTER_PROMPTS = [
  "Why are there open exceptions?",
  "Show tax matches for August",
  "Total unresolved amount?",
];

export default function RightSidebar() {
  const [messages, setMessages] = useState([
    { id: 1, type: "assistant", text: "Ask anything about your reconciliation data." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (question) => {
    const q = question ?? input;
    if (!q.trim() || busy) return;

    setMessages((m) => [...m, { id: Date.now(), type: "user", text: q }]);
    setInput("");
    setBusy(true);

    const botId = Date.now() + 1;
    setMessages((m) => [...m, { id: botId, type: "assistant", text: "", status: "Thinking..." }]);

    try {
      await api.askQuestionStream(q, (event, payload) => {
        if (event === "reasoning") {
          setMessages((m) => m.map((msg) => (msg.id === botId ? { ...msg, status: payload.text } : msg)));
        }
        if (event === "tool_call" && payload.status === "started") {
          setMessages((m) => m.map((msg) => (msg.id === botId ? { ...msg, status: `Using ${payload.name}...` } : msg)));
        }
        if (event === "text") {
          setMessages((m) => m.map((msg) =>
            msg.id === botId ? { ...msg, text: msg.text + payload.delta, status: null } : msg
          ));
        }
        if (event === "done") {
          setMessages((m) => m.map((msg) => {
            if (msg.id !== botId) return msg;
            try {
              const structured = JSON.parse(msg.text);
              return { ...msg, text: structured.answer || msg.text, status: null };
            } catch {
              return { ...msg, status: null };
            }
          }));
        }
      });
    } catch (e) {
      setMessages((m) => m.map((msg) =>
        msg.id === botId ? { ...msg, text: `Error: ${e.message}`, status: null } : msg
      ));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.sidebar}>
      {/* AI Assistant Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.badge}>AI Assistant</span>
          <span className={styles.betaLabel}>Beta</span>
        </div>
        <p className={styles.sectionSubtitle}>Ask anything about your finances</p>

        {/* Message List */}
        <div className={styles.messageList} ref={listRef}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${msg.type === "user" ? styles.userMessage : styles.assistantMessage}`}
            >
              {msg.type === "assistant" && <span className={styles.messageIcon}>✦</span>}
              <span>{msg.status ? msg.status : (msg.text || "…")}</span>
            </div>
          ))}
        </div>

        {/* Starter prompts */}
        {messages.length <= 1 && (
          <div className={styles.messageList} style={{ marginBottom: 12, maxHeight: "none" }}>
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                className={`${styles.message} ${styles.assistantMessage}`}
                style={{ cursor: "pointer", border: "none", width: "100%", textAlign: "left" }}
                onClick={() => send(p)}
                disabled={busy}
              >
                <span className={styles.messageIcon}>❓</span>
                <span>{p}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className={styles.inputBox}>
          <input
            type="text"
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            className={styles.input}
            disabled={busy}
          />
          <button onClick={() => send()} className={styles.sendButton} disabled={busy}>
            {busy ? "…" : "▶"}
          </button>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Quick Actions</h4>
        <button className={styles.actionButton}>
          <span className={styles.actionIcon}>📤</span>
          <span>Upload Receipt / Statement</span>
        </button>
        <button className={styles.actionButton}>
          <span className={styles.actionIcon}>▶</span>
          <span>Start New Reconciliation</span>
        </button>
        <button className={styles.actionButton}>
          <span className={styles.actionIcon}>📊</span>
          <span>Export Report</span>
        </button>
        <button className={styles.actionButton}>
          <span className={styles.actionIcon}>📈</span>
          <span>Generate Cash Forecast</span>
        </button>
      </div>

      {/* Data Clarity Card */}
      <div className={styles.clarityCard}>
        <h4 className={styles.clarityTitle}>Turn data into clarity</h4>
        <p className={styles.clarityText}>
          AI-powered reconciliation for modern finance teams.
        </p>
      </div>
    </div>
  );
}