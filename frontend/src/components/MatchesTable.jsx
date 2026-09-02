import React from "react";

function confClass(score) {
  if (score >= 90) return "";
  if (score >= 70) return "mid";
  return "low";
}

export default function MatchesTable({ matches }) {
  if (!matches || matches.length === 0) {
    return <div className="panel"><div className="empty-state">No matches yet — run reconciliation to see results.</div></div>;
  }

  return (
    <div className="panel">
      <table>
        <thead>
          <tr>
            <th>Bank Ref</th>
            <th>Order ID</th>
            <th>Invoice ID</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Confidence</th>
            <th>Tier</th>
            <th>Reason</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id}>
              <td>{m.bank_ref_id || "—"}</td>
              <td>{m.order_id || "—"}</td>
              <td>{m.invoice_id || "—"}</td>
              <td>₹{Number(m.match_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              <td><span className="status-pill matched">✓ Matched</span></td>
              <td>
                <div className="confidence-bar-wrap">
                  <div className="confidence-bar">
                    <div
                      className={`confidence-bar-fill ${confClass(m.confidence_score)}`}
                      style={{ width: `${m.confidence_score}%` }}
                    />
                  </div>
                  <span>{m.confidence_score}%</span>
                </div>
              </td>
              <td>
                <span className={`badge ${m.match_tier === "tier1_exact" ? "tier1" : "tier2"}`}>
                  {m.match_tier === "tier1_exact" ? "Tier 1 · SQL" : "Tier 2 · LLM"}
                </span>
              </td>
              <td style={{ fontFamily: "var(--sans)", color: "var(--text-dim)" }} title={m.reason}>{m.reason}</td>
              <td>
                <div className="row-actions">
                  <button className="row-view-btn">View</button>
                  <button className="row-kebab" aria-label="More actions">⋮</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
