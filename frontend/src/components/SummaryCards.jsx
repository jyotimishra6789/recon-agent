import React from "react";

export default function SummaryCards({ reconcileResult, timeSaved }) {
  const matchRate = reconcileResult?.match_rate ?? "—";
  const matched = reconcileResult?.matched ?? "—";
  const exceptions = reconcileResult?.exceptions ?? "—";
  const pctSaved = timeSaved?.time_saved_percent ?? "—";
  const manualMin = timeSaved?.estimated_manual_time_minutes;
  const durationMs = reconcileResult?.duration_ms;

  return (
    <div className="summary-grid">
      <div className="stat-card">
        <div className="stat-label">Match Rate</div>
        <div className="stat-value success">{matchRate}{matchRate !== "—" ? "%" : ""}</div>
        <div className="stat-note">{matched} of {reconcileResult?.total_bank_records ?? "—"} records auto-reconciled</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Open Exceptions</div>
        <div className="stat-value warn">{exceptions}</div>
        <div className="stat-note">Flagged for human review, honestly reported</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Time Saved</div>
        <div className="stat-value accent">{pctSaved}{pctSaved !== "—" ? "%" : ""}</div>
        <div className="stat-note">
          {manualMin ? `~${manualMin} min manual vs ~10 sec automated` : "Run reconciliation to calculate"}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Pipeline</div>
        <div className="stat-value">{durationMs != null ? `${durationMs} ms` : "Tier 1+2"}</div>
        <div className="stat-note">Measured batch runtime · SQL + LLM fallback</div>
      </div>
    </div>
  );
}
