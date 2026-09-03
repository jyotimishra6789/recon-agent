import React from "react";

export default function SummaryCards({ reconcileResult, timeSaved }) {
  const matched = reconcileResult?.matched ?? "—";
  const totalBank = reconcileResult?.total_bank_records ?? "—";
  const exceptions = reconcileResult?.exceptions ?? "—";
  const pctSaved = timeSaved?.time_saved_percent ?? "—";
  const manualMin = timeSaved?.estimated_manual_time_minutes;
  const durationMs = reconcileResult?.duration_ms;

  return (
    <div className="summary-grid">
      <div className="stat-card">
        <div className="stat-card-top">
          <span className="stat-icon blue">🤝</span>
        </div>
        <div className="stat-label">Total Reconciled</div>
        <div className="stat-value success">{matched}</div>
        <div className="stat-note">of {totalBank} records</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-top">
          <span className="stat-icon red">⚠</span>
        </div>
        <div className="stat-label">Open Exceptions</div>
        <div className="stat-value warn">{exceptions}</div>
        <div className="stat-note">needs review</div>
      </div>

      <div className="stat-card">
        <div className="stat-card-top">
          <span className="stat-icon blue">◔</span>
        </div>
        <div className="stat-label">Time Saved</div>
        <div className="stat-value accent">{pctSaved}{pctSaved !== "—" ? "%" : ""}</div>
        <div className="stat-note">
          {manualMin ? `~${manualMin} min manual vs ~10 sec automated` : "vs manual process"}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card-top">
          <span className="stat-icon green">₹</span>
        </div>
        <div className="stat-label">Pipeline</div>
        <div className="stat-value">{durationMs != null ? `${durationMs} ms` : "Tier 1+2"}</div>
        <div className="stat-note">SQL + LLM fallback</div>
      </div>
    </div>
  );
}
