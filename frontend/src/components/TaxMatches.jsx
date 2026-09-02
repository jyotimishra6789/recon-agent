import React, { useState, useEffect } from "react";
import { api } from "../api";
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function confClass(score) {
  if (score >= 95) return "";
  if (score >= 80) return "mid";
  return "low";
}

export default function TaxMatches() {
  const [taxMatches, setTaxMatches] = useState([]);
  const [taxSummary, setTaxSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTaxType, setSelectedTaxType] = useState(null);

  useEffect(() => {
    fetchTaxData();
  }, []);

  const fetchTaxData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [matchesRes, summaryRes] = await Promise.all([
        api.getTaxMatches(),
        api.getTaxSummary(),
      ]);
      setTaxMatches(matchesRes);
      setTaxSummary(summaryRes);
    } catch (err) {
      setError(err.message || "Failed to fetch tax data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="empty-state">Loading tax data…</div>;
  }

  if (error) {
    return <div className="error-banner">⚠️ Error: {error}</div>;
  }

  const totalTax = taxSummary?.total_tax_records ?? 0;
  const matchedTax = taxSummary?.matched_tax_records ?? 0;
  const exceptionsTax = Math.max(totalTax - matchedTax, 0);
  const matchPct = totalTax ? Math.round((matchedTax / totalTax) * 100) : 0;
  const circumference = 2 * Math.PI * 42;
  const matchedDash = totalTax ? (matchedTax / totalTax) * circumference : 0;
  const exceptionsDash = totalTax ? (exceptionsTax / totalTax) * circumference : 0;

  return (
    <div className="tax-page">
      {taxSummary && (
        <section className="panel insights-card">
          <div className="insights-heading">
            <span className="stat-icon blue">📊</span>
            <div><b>Tax Match Insights</b><small>Quick stats for the selected period</small></div>
          </div>
          <div className="insights-body">
            <div className="donut-wrap">
              <svg viewBox="0 0 100 100" className="donut-chart">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#eef1f6" strokeWidth="12" />
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke="#22a35a" strokeWidth="12"
                  strokeDasharray={`${matchedDash} ${circumference - matchedDash}`}
                  strokeDashoffset={circumference * 0.25}
                  transform="rotate(-90 50 50)" strokeLinecap="round"
                />
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke="#e2534d" strokeWidth="12"
                  strokeDasharray={`${exceptionsDash} ${circumference - exceptionsDash}`}
                  strokeDashoffset={circumference * 0.25 - matchedDash}
                  transform="rotate(-90 50 50)" strokeLinecap="round"
                />
                <text x="50" y="54" textAnchor="middle" className="donut-pct">{matchPct}%</text>
              </svg>
            </div>
            <div className="donut-legend">
              <span><i className="legend-dot matched" />Matched<b>{matchedTax}</b></span>
              <span><i className="legend-dot exceptions" />Exceptions<b>{exceptionsTax}</b></span>
              <span><i className="legend-dot pending" />Pending<b>0</b></span>
            </div>
          </div>
        </section>
      )}

      {/* Charts Section */}
      {taxSummary && taxSummary.tax_by_type.length > 0 && (
        <div className="chart-grid">
          <section className="panel chart-card">
            <h3 className="section-title">Tax type distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={taxSummary.tax_by_type}
                  dataKey="count"
                  nameKey="tax_type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {taxSummary.tax_by_type.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} records`} />
              </PieChart>
            </ResponsiveContainer>
          </section>

          <section className="panel chart-card">
            <h3 className="section-title">Tax amount by type</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={taxSummary.tax_by_type}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="tax_type" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) =>
                    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                  }
                />
                <Bar dataKey="total_amount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>
      )}

      {/* Tax by Type - table */}
      {taxSummary && taxSummary.tax_by_type.length > 0 && (
        <section className="panel">
          <div className="panel-heading"><span className="section-title">Tax breakdown by type</span></div>
          <table>
            <thead>
              <tr>
                <th>Tax Type</th>
                <th>Count</th>
                <th>% of Total</th>
                <th>Total Amount</th>
                <th>Avg Amount</th>
              </tr>
            </thead>
            <tbody>
              {taxSummary.tax_by_type.map((t, idx) => (
                <tr
                  key={t.tax_type}
                  className={selectedTaxType === t.tax_type ? "row-selected" : ""}
                  onClick={() => setSelectedTaxType(selectedTaxType === t.tax_type ? null : t.tax_type)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <span className="type-dot-row">
                      <i className="type-dot" style={{ background: COLORS[idx % COLORS.length] }} />
                      {t.tax_type}
                    </span>
                  </td>
                  <td>{t.count}</td>
                  <td>{((t.count / taxSummary.total_tax_records) * 100).toFixed(1)}%</td>
                  <td>₹{t.total_amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td>₹{(t.total_amount / t.count).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Tax Matches Details table */}
      <section className="panel">
        <div className="panel-heading"><span className="section-title">Tax matches details ({taxMatches.length})</span></div>
        {taxMatches.length === 0 ? (
          <div className="empty-state">No tax matches found</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tax ID</th>
                <th>Tax Type</th>
                <th>Rate</th>
                <th>Base Amount</th>
                <th>Tax Amount</th>
                <th>Invoice</th>
                <th>Confidence</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {taxMatches.map((match) => (
                <tr key={match.tax_id}>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{match.tax_id}</td>
                  <td><span className="badge tier1">{match.tax_type}</span></td>
                  <td>{match.tax_rate}%</td>
                  <td>₹{match.base_amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td>₹{match.tax_amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{match.invoice_id}</td>
                  <td>
                    <div className="confidence-bar-wrap">
                      <div className="confidence-bar">
                        <div className={`confidence-bar-fill ${confClass(match.confidence_score)}`} style={{ width: `${match.confidence_score}%` }} />
                      </div>
                      <span>{match.confidence_score}%</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--ink-soft)" }} title={match.reason}>{match.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}