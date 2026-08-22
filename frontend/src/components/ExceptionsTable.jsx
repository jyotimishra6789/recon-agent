import React, { useState } from "react";
import { api } from "../api";

const PATTERN_OPTIONS = [
  { value: "", label: "Select reason…" },
  { value: "fee_deduction", label: "Fee deduction" },
  { value: "settlement_delay", label: "Settlement delay" },
  { value: "duplicate_entry", label: "Duplicate entry" },
  { value: "genuine_mismatch", label: "Genuine mismatch (write-off)" },
];

export default function ExceptionsTable({ exceptions, onResolved }) {
  const [resolvingId, setResolvingId] = useState(null);
  const [pattern, setPattern] = useState("");
  const [busy, setBusy] = useState(false);

  if (!exceptions || exceptions.length === 0) {
    return <div className="panel"><div className="empty-state">No open exceptions — everything's reconciled or nothing has run yet.</div></div>;
  }

  const handleResolve = async (id) => {
    if (!pattern) return;
    setBusy(true);
    try {
      const label = PATTERN_OPTIONS.find((p) => p.value === pattern)?.label || pattern;
      await api.resolveException(id, label, pattern);
      setResolvingId(null);
      setPattern("");
      onResolved();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Reference</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Reason</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {exceptions.map((e) => (
            <tr key={e.id}>
              <td style={{ textTransform: "capitalize" }}>{e.source_table}</td>
              <td>{e.source_ref}</td>
              <td>₹{Number(e.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              <td>{e.txn_date}</td>
              <td><span className="badge exception">{e.exception_reason.replace(/_/g, " ")}</span></td>
              <td>
                {resolvingId === e.id ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select
                      className="resolve-select"
                      value={pattern}
                      onChange={(ev) => setPattern(ev.target.value)}
                    >
                      {PATTERN_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <button
                      disabled={!pattern || busy}
                      onClick={() => handleResolve(e.id)}
                      className="resolve-confirm"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setResolvingId(e.id)}
                    style={{
                      background: "none", border: "1px solid var(--line)", color: "var(--text-dim)",
                      borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer",
                      fontFamily: "var(--sans)",
                    }}
                  >
                    Resolve
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
