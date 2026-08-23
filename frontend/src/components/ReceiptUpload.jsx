import React, { useState } from "react";
import { api } from "../api";

export default function ReceiptUpload() {
  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await api.uploadReceipt(file, amount, receiptDate);
      setStatus(result.status === "queued" ? "Queued for reconciliation" : "Not classified as an expense");
      setFile(null);
      event.target.reset();
    } catch (error) {
      setStatus(`Upload failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="receipt-upload" onSubmit={submit}>
      <div className="section-title">Receipt Inbox</div>
      <div className="receipt-upload-row">
        <input type="file" accept="image/*,.pdf,.txt" onChange={(event) => setFile(event.target.files[0])} />
        <input type="number" min="0" step="0.01" placeholder="Amount (optional)" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
        <button type="submit" disabled={!file || busy}>{busy ? "Processing..." : "Upload receipt"}</button>
      </div>
      {status && <div className="receipt-upload-status">{status}</div>}
    </form>
  );
}