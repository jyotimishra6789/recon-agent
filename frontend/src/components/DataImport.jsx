import React, { useState } from "react";
import { api } from "../api";

const SOURCES = [
  { key: "bank", label: "Bank statement", columns: "ref_id, txn_date, amount, description" },
  { key: "settlement", label: "Settlement report", columns: "order_id, settle_date, amount, gross_amount, fee" },
  { key: "ledger", label: "Ledger", columns: "invoice_id, invoice_date, amount, customer_name" },
  { key: "tax", label: "Tax records", columns: "tax_id, invoice_id, tax_date, tax_type, tax_rate, base_amount, tax_amount, description" },
];

export default function DataImport({ onImported }) {
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState(null);

  const pickedCount = Object.values(files).filter(Boolean).length;

  const setFile = (key, file) => setFiles((prev) => ({ ...prev, [key]: file || null }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy || pickedCount === 0) return;
    setBusy(true);
    setStatus("Importing...");
    setResults(null);
    const summary = [];
    try {
      for (const { key, label } of SOURCES) {
        const file = files[key];
        if (!file) continue;
        setStatus(`Importing ${label}...`);
        const result = await api.importSource(key, file);
        summary.push({ label, rows: result.rows_imported, skipped: result.rows_skipped });
      }
      setStatus("Running reconciliation...");
      await api.reconcile();
      setResults(summary);
      setStatus("Import complete — reconciliation ran on your data.");
      setFiles({});
      event.target.reset();
      onImported?.();
    } catch (error) {
      setStatus(`Import failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="data-import" onSubmit={submit}>
      <div className="section-title">Import Your Own Data</div>
      <div className="data-import-grid">
        {SOURCES.map(({ key, label, columns }) => (
          <label key={key} className="data-import-slot">
            <span className="data-import-label">{label}</span>
            <input
              type="file"
              accept=".csv"
              onChange={(event) => setFile(key, event.target.files[0])}
            />
            <span className="data-import-hint" title={columns}>Columns: {columns}</span>
          </label>
        ))}
      </div>
      <div className="data-import-actions">
        <button type="submit" disabled={pickedCount === 0 || busy}>
          {busy ? "Working..." : `Import & Run Reconciliation${pickedCount ? ` (${pickedCount})` : ""}`}
        </button>
        {status && <span className="receipt-upload-status">{status}</span>}
      </div>
      {results && (
        <ul className="data-import-results">
          {results.map((r) => (
            <li key={r.label}>
              {r.label}: {r.rows} imported{r.skipped ? `, ${r.skipped} skipped` : ""}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}