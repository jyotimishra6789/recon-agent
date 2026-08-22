import React, { useState } from "react";

function downloadReport(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reconciliation-report-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CloseControl({ exceptions, matches, auditLog, reconcileResult, closeState, onSignOff }) {
  const [reviewer, setReviewer] = useState(closeState.reviewer || "");
  const [notes, setNotes] = useState(closeState.notes || "");
  const openExceptions = exceptions.length;
  const signedOff = Boolean(closeState.signedOffAt);
  const canSignOff = reviewer.trim().length > 1 && openExceptions === 0 && matches.length > 0;

  const exportReport = () => {
    downloadReport({
      report_type: "audit_ready_reconciliation",
      generated_at: new Date().toISOString(),
      period_status: signedOff ? "signed_off" : "in_review",
      sign_off: closeState.signedOffAt ? closeState : null,
      summary: reconcileResult || { matches: matches.length, open_exceptions: openExceptions },
      matches,
      open_exceptions: exceptions,
      audit_trail: auditLog,
    });
  };

  return (
    <section className={`close-control ${signedOff ? "is-signed-off" : ""}`}>
      <div className="close-heading">
        <div>
          <div className="section-title">Period close</div>
          <h2>{signedOff ? "Period signed off" : "Review and close this period"}</h2>
          <p>{signedOff ? `Signed by ${closeState.reviewer} · ${new Date(closeState.signedOffAt).toLocaleString()}` : "Resolve every exception, then record the responsible reviewer."}</p>
        </div>
        <div className={`close-status ${signedOff ? "complete" : openExceptions ? "blocked" : "ready"}`}>
          <span className="status-dot" />
          {signedOff ? "Closed" : openExceptions ? `${openExceptions} open exception${openExceptions === 1 ? "" : "s"}` : "Ready for sign-off"}
        </div>
      </div>
      <div className="close-metrics">
        <div><strong>{matches.length}</strong><span>matched records</span></div>
        <div><strong>{openExceptions}</strong><span>open exceptions</span></div>
        <div><strong>{auditLog.length}</strong><span>trace events</span></div>
      </div>
      {!signedOff && (
        <div className="signoff-form">
          <label>Reviewer name<input value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="e.g. A. Mehta" /></label>
          <label>Close notes <span className="optional">optional</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add context for the audit record" /></label>
          <button className="signoff-btn" disabled={!canSignOff} onClick={() => onSignOff({ reviewer: reviewer.trim(), notes: notes.trim() })}>Sign off period</button>
        </div>
      )}
      <div className="close-footer">
        <span>{signedOff ? "Immutable report snapshot includes sign-off and full audit trail." : "Export includes source matches, exceptions, and trace events."}</span>
        <button className="export-btn" onClick={exportReport}>Export audit report</button>
      </div>
    </section>
  );
}