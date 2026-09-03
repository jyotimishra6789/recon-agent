import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api";
import SummaryCards from "./components/SummaryCards";
import MatchesTable from "./components/MatchesTable";
import ExceptionsTable from "./components/ExceptionsTable";
import AuditTrail from "./components/AuditTrail";
import ChatbotQA from "./components/ChatbotQA";
import CloseControl from "./components/CloseControl";
import ReceiptUpload from "./components/ReceiptUpload";
import DataImport from "./components/DataImport";
import CashForecast from "./components/CashForecast";
import TaxMatches from "./components/TaxMatches";
import OrchestrationInsights from "./components/OrchestrationInsights";

const TABS = [
  { id: "matches", label: "Matches" },
  { id: "tax", label: "Tax Matches" },
  { id: "orchestration", label: "Orchestration" },
  { id: "exceptions", label: "Exceptions" },
  { id: "audit", label: "Audit Trail" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("matches");
  const workAreaRef = useRef(null);

  // Sidebar nav items map to real tabs in the work-area table below.
  // Clicking one both switches the tab and scrolls it into view, since
  // the tabs live further down the page than the sidebar click target.
  const goToTab = (tabId) => {
    setActiveTab(tabId);
    workAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const [chatOpen, setChatOpen] = useState(false);
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

  const handleNewPeriod = () => {
    const reopenedAt = new Date().toISOString();
    const nextCloseState = { reviewer: "", notes: "", signedOffAt: null };
    setCloseState(nextCloseState);
    localStorage.removeItem("recon-period-close");
    setAuditLog((current) => [
      {
        id: `period-${reopenedAt}`,
        timestamp: reopenedAt,
        action: "new_period_started",
        tier: "CONTROL",
        details: { previous_sign_off: closeState.reviewer || "Unknown reviewer" },
      },
      ...current,
    ]);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">R</span><span>recon<span className="brand-accent">.ai</span></span></div>
        <div className="workspace-switcher"><span className="workspace-avatar">AC</span><span><b>Acme Corporation</b><small>Finance workspace</small></span><span className="chevron">⌄</span></div>
        <nav className="nav-list" aria-label="Main navigation">
          <span className="nav-label">Workspace</span>
          <button
            className="nav-item"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <span>▦</span>Overview
          </button>
          <button className={`nav-item ${activeTab === "matches" ? "active" : ""}`} onClick={() => goToTab("matches")}>
            <span>⇄</span>Reconciliations
          </button>
          <button className={`nav-item ${activeTab === "matches" ? "active" : ""}`} onClick={() => goToTab("matches")}>
            <span>▤</span>Transactions
          </button>
          <span className="nav-label">Control centre</span>
          <button className={`nav-item ${activeTab === "exceptions" ? "active" : ""}`} onClick={() => goToTab("exceptions")}>
            <span>◌</span>Exceptions <em>{exceptions.length || ""}</em>
          </button>
          <button className={`nav-item ${activeTab === "audit" ? "active" : ""}`} onClick={() => goToTab("audit")}>
            <span>✓</span>Audit trail
          </button>
          <button className="nav-item" disabled title="Settings isn't built yet" style={{ opacity: 0.45, cursor: "not-allowed" }}>
            <span>⚙</span>Settings
          </button>
        </nav>
        <div className="sidebar-footer"><div className="status-live"><span />All systems operational</div><small>Reconciliation Agent v1.0</small></div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Overview</strong></div>
          <div className="topbar-actions"><span className="last-sync">Last synced just now</span><button className="icon-button" aria-label="Notifications">♧</button><span className="profile">AM</span></div>
        </div>
        <div className="header">
          <div>
            <div className="header-eyebrow">Tuesday, 25 August 2026</div>
            <h1>Good morning, Alex.</h1>
            <div className="header-sub">Here is what's happening across your reconciliation workspace.</div>
          </div>
          <button className="run-btn" onClick={handleRun} disabled={running}><span>↻</span>{running ? "Reconciling…" : "Run reconciliation"}</button>
        </div>

      {error && <div className="error-banner">{error}</div>}

      <section className="source-strip panel">
        <div><span className="section-title">Active data sources</span><strong>Connected and ready to reconcile</strong></div>
        <div className="source-items"><span><i className="source-icon bank">⌁</i><b>Bank</b><small>57 records</small><mark>Ready</mark></span><span><i className="source-icon settlement">↔</i><b>Settlement</b><small>58 records</small><mark>Ready</mark></span><span><i className="source-icon ledger">▤</i><b>Ledger</b><small>65 records</small><mark>Ready</mark></span></div>
      </section>
      <div className="overview-heading"><div><span className="section-title">Reconciliation overview</span><h2>Control centre</h2></div><span className="period-pill"><span />Current period · Aug 2026</span></div>
      <SummaryCards reconcileResult={reconcileResult} timeSaved={timeSaved} />
      <CashForecast />
      <section className="trend-panel panel"><div className="trend-heading"><div><span className="section-title">Activity trend</span><h2>Reconciliation volume</h2></div><div className="trend-legend"><span className="matched-dot" />Matched <span className="exception-dot" />Exceptions <select defaultValue="7"><option value="7">Last 7 days</option></select></div></div><div className="trend-chart">{[42, 58, 48, 74, 56, 82, 67].map((height, index) => <div className="trend-day" key={index}><div className="bar-stack"><i style={{ height: `${height}%` }} /><b style={{ height: `${Math.max(8, height / 5)}%` }} /></div><small>{["19 Aug", "20 Aug", "21 Aug", "22 Aug", "23 Aug", "24 Aug", "Today"][index]}</small></div>)}</div></section>

      <CloseControl
        exceptions={exceptions}
        matches={matches}
        auditLog={auditLog}
        reconcileResult={reconcileResult}
        closeState={closeState}
        onSignOff={handleSignOff}
        onNewPeriod={handleNewPeriod}
      />

      <DataImport onImported={() => { setError(null); return refreshAll(); }} />

      <ReceiptUpload onProcessed={() => { setError(null); return refreshAll(); }} />

      <div className="work-area" ref={workAreaRef}>
        <div className="records-area">
          <div className="overview-heading records-heading"><div><span className="section-title">Reconciliation records</span><h2>Latest activity</h2></div><button className="view-all" onClick={() => setActiveTab("matches")}>View all <span>→</span></button></div>
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
          {activeTab === "tax" && <TaxMatches />}
          {activeTab === "orchestration" && <OrchestrationInsights />}
          {activeTab === "exceptions" && (
            <ExceptionsTable exceptions={exceptions} onResolved={refreshAll} />
          )}
          {activeTab === "audit" && <AuditTrail log={auditLog} />}
        </div>

      </div>
  </main>
      <button className={`chat-launcher ${chatOpen ? "is-open" : ""}`} onClick={() => setChatOpen((open) => !open)} aria-label={chatOpen ? "Close data assistant" : "Open data assistant"}><span>{chatOpen ? "×" : "✦"}</span><b>{chatOpen ? "Close assistant" : "Ask Recon"}</b></button>
      {chatOpen && (
        <div className="chat-popover">
          <div className="chat-popover-heading"><div><span className="assistant-avatar">✦</span><span><b>Recon assistant</b><small>Connected to your finance data</small></span></div><button onClick={() => setChatOpen(false)} aria-label="Close chat">×</button></div>
          <ChatbotQA />
        </div>
      )}
    </div>
  );
}