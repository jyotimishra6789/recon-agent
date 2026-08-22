import React from "react";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts.replace(" ", "T") + "Z");
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function summarize(action, details) {
  if (!details) return "";
  switch (action) {
    case "match_success":
      return `${details.bank || ""} → ${details.invoice || details.order || ""} · ${details.reason || ""}`;
    case "match_attempt":
      return `${details.bank || ""} checked against ${(details.candidates || []).length} candidate(s)`;
    case "exception_flagged":
      return details.note || "Unresolved sweep";
    case "exception_resolved":
      return `#${details.exception_id} marked resolved — ${details.reason || ""}`;
    default:
      return JSON.stringify(details).slice(0, 80);
  }
}

export default function AuditTrail({ log }) {
  if (!log || log.length === 0) {
    return <div className="panel"><div className="empty-state">Audit trail will appear here once reconciliation runs.</div></div>;
  }

  return (
    <div className="panel">
      <div className="ledger-tape">
        {log.map((entry) => (
          <div className="ledger-entry" key={entry.id}>
            <span className="ledger-time">{formatTime(entry.timestamp)}</span>
            <span className={`ledger-action ${entry.action}`}>{entry.action.replace(/_/g, " ")}</span>
            <span className="ledger-detail" title={summarize(entry.action, entry.details)}>
              {summarize(entry.action, entry.details)}
            </span>
            {entry.tier && <span className="ledger-tier">{entry.tier}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
