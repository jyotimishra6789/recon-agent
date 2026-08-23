import React, { useState, useEffect, useCallback } from "react";
import { api } from "./api";
import SummaryCards from "./components/SummaryCards";
import MatchesTable from "./components/MatchesTable";
import ExceptionsTable from "./components/ExceptionsTable";
import AuditTrail from "./components/AuditTrail";
import ChatbotQA from "./components/ChatbotQA";
import CloseControl from "./components/CloseControl";
import ReceiptUpload from "./components/ReceiptUpload";

const TABS = [
  { id: "matches", label: "Matches" },
  { id: "exceptions", label: "Exceptions" },
  { id: "audit", label: "Audit Trail" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("matches");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const [reconcileResult, setReconcileResult] = useState(null);
  const [timeSaved, setTimeSaved] = useState(null);
  const [matches, setMatches] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [closeState, setCloseState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("recon-period-close")) || { reviewer: "", notes: "", signedOffAt: null };
    } catch {
      return { reviewer: "", notes: "", signedOffAt: null };
    }
  });

  const refreshAll = useCallback(async () => {
    const [m, e, a, t] = await Promise.all([
      api.getMatches(),
      api.getExceptions("open"),
      api.getAuditLog(),
      api.getTimeSaved(),
    ]);
    setMatches(m);
    setExceptions(e);
    setAuditLog(a);
    setTimeSaved(t);
  }, []);

  useEffect(() => {
    refreshAll().catch(() => {}); // silent on first load if backend not up yet
  }, [refreshAll]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await api.reconcile();
      setReconcileResult(result);
      await refreshAll();
    } catch (e) {
      setError(e.message || "Failed to reach the reconciliation API. Is the backend running on :8000?");
    } finally {
      setRunning(false);
    }
  };

  const handleSignOff = ({ reviewer, notes }) => {
    const signedOffAt = new Date().toISOString();
    const nextCloseState = { reviewer, notes, signedOffAt };
    setCloseState(nextCloseState);
    localStorage.setItem("recon-period-close", JSON.stringify(nextCloseState));
    setAuditLog((current) => [
      {
        id: `close-${signedOffAt}`,
        timestamp: signedOffAt,
        action: "period_signed_off",
        tier: "CONTROL",
        details: { reviewer, notes: notes || "No additional notes" },
      },
      ...current,
    ]);
  };

  return (
    <div className="app">
      <div className="header">
        <div>
          <div className="header-eyebrow">Track 04 · AI Finance Controller</div>
          <h1>Reconciliation Agent</h1>
          <div className="header-sub">Bank ↔ Settlement ↔ Ledger, matched and explained end to end</div>
        </div>
        <button className="run-btn" onClick={handleRun} disabled={running}>
          {running ? "Reconciling…" : "Run Reconciliation"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <SummaryCards reconcileResult={reconcileResult} timeSaved={timeSaved} />

      <CloseControl
        exceptions={exceptions}
        matches={matches}
        auditLog={auditLog}
        reconcileResult={reconcileResult}
        closeState={closeState}
        onSignOff={handleSignOff}
      />

      <ReceiptUpload onProcessed={refreshAll} />

      <div className="two-col">
        <div>
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
                {t.id === "matches" && ` (${matches.length})`}
                {t.id === "exceptions" && ` (${exceptions.length})`}
              </button>
            ))}
          </div>

          {activeTab === "matches" && <MatchesTable matches={matches} />}
          {activeTab === "exceptions" && (
            <ExceptionsTable exceptions={exceptions} onResolved={refreshAll} />
          )}
          {activeTab === "audit" && <AuditTrail log={auditLog} />}
        </div>

        <div>
          <div className="section-title">Ask the Data</div>
          <ChatbotQA />
        </div>
      </div>
    </div>
  );
}
