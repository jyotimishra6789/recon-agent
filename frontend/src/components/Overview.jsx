import React, { useState, useEffect } from "react";
import { api } from "../api";
import styles from "./Overview.module.css";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [matches, exceptions, auditLog, timeSaved] = await Promise.all([
          api.getMatches(),
          api.getExceptions("open"),
          api.getAuditLog(),
          api.getTimeSaved(),
        ]);

        setData({
          reconciled: matches.length,
          exceptions: exceptions.length,
          timeSaved: timeSaved || "2.4 hrs",
          balance: "₹11,10,143.29",
          matches,
          exceptions,
          auditLog,
        });
      } catch (error) {
        console.error("Failed to load overview data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Generate chart data for last 7 days
  const chartData = [
    { date: "19 Aug", matched: 18, exceptions: 2 },
    { date: "20 Aug", matched: 22, exceptions: 3 },
    { date: "21 Aug", matched: 19, exceptions: 1 },
    { date: "22 Aug", matched: 28, exceptions: 4 },
    { date: "23 Aug", matched: 21, exceptions: 2 },
    { date: "24 Aug", matched: 32, exceptions: 5 },
    { date: "Today", matched: 25, exceptions: 3 },
  ];

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.greeting}>Good morning, Alex ☀️</h1>
          <p className={styles.subtitle}>
            Here's what's happening with your reconciliation workspace.
          </p>
        </div>
        <div className={styles.quote}>
          "Accurate books. A clearer tomorrow."
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <div className={styles.cardIcon}>📋</div>
          <div className={styles.cardLabel}>Total Reconciled</div>
          <div className={styles.cardValue}>
            {data?.reconciled || "53"}
            <span className={styles.cardChange}>↑ +12%</span>
          </div>
          <div className={styles.cardSubtext}>of 68 records</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardIcon}>⚠️</div>
          <div className={styles.cardLabel}>Open Exceptions</div>
          <div className={styles.cardValue}>
            {data?.exceptions || "15"}
            <span className={styles.cardChange} style={{ color: "#ef4444" }}>
              ↑ +3
            </span>
          </div>
          <div className={styles.cardSubtext}>needs review</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardIcon}>⏱️</div>
          <div className={styles.cardLabel}>Time Saved</div>
          <div className={styles.cardValue}>
            2.4 hrs
            <span className={styles.cardChange}>↑ +40%</span>
          </div>
          <div className={styles.cardSubtext}>vs manual process</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardIcon}>💰</div>
          <div className={styles.cardLabel}>Projected Balance</div>
          <div className={styles.cardValue}>₹11,10,143.29</div>
          <div className={styles.cardSubtext} style={{ color: "#10b981" }}>
            ↑ +5% as of 25 Aug 2026
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className={styles.chartsSection}>
        {/* Reconciliation Volume */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Reconciliation Volume</h3>
            <p className={styles.chartSubtitle}>Matches vs Exceptions (Last 7 Days)</p>
            <select className={styles.timeFilter}>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: "#f3f4f6", border: "none", borderRadius: "8px" }} />
              <Legend />
              <Bar dataKey="matched" fill="#3b82f6" name="Matched" radius={[8, 8, 0, 0]} />
              <Bar dataKey="exceptions" fill="#f97316" name="Exceptions" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Data Sources */}
        <div className={styles.dataSourcesCard}>
          <div className={styles.chartHeader}>
            <h3>Data Sources</h3>
            <a href="#" className={styles.viewAll}>View all</a>
          </div>
          <div className={styles.sourceList}>
            <div className={styles.sourceItem}>
              <div className={styles.sourceIcon}>🏦</div>
              <div className={styles.sourceInfo}>
                <div className={styles.sourceName}>Bank</div>
                <div className={styles.sourceCount}>57 records</div>
              </div>
              <div className={styles.sourceBadge} style={{ backgroundColor: "#d1fae5", color: "#059669" }}>
                Connected
              </div>
            </div>
            <div className={styles.sourceItem}>
              <div className={styles.sourceIcon}>⇄</div>
              <div className={styles.sourceInfo}>
                <div className={styles.sourceName}>Settlement</div>
                <div className={styles.sourceCount}>58 records</div>
              </div>
              <div className={styles.sourceBadge} style={{ backgroundColor: "#d1fae5", color: "#059669" }}>
                Connected
              </div>
            </div>
            <div className={styles.sourceItem}>
              <div className={styles.sourceIcon}>📊</div>
              <div className={styles.sourceInfo}>
                <div className={styles.sourceName}>Ledger</div>
                <div className={styles.sourceCount}>65 records</div>
              </div>
              <div className={styles.sourceBadge} style={{ backgroundColor: "#d1fae5", color: "#059669" }}>
                Connected
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className={styles.transactionsCard}>
        <div className={styles.tableHeader}>
          <h3>Recent Transactions</h3>
          <div className={styles.tabs}>
            <button className={styles.tab + " " + styles.active}>Recent Transactions</button>
            <button className={styles.tab}>Exceptions (15)</button>
            <button className={styles.tab}>Tax Matches</button>
            <button className={styles.tab}>Audit Trail</button>
          </div>
          <div className={styles.searchBox}>
            <span>🔍</span>
            <input type="text" placeholder="Search records..." />
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>BANK REF</th>
              <th>ORDER ID</th>
              <th>INVOICE ID</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
              <th>CONFIDENCE</th>
              <th>TIER</th>
              <th>REASON</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {[
              { ref: "TXN10002", order: "ORD5002", invoice: "INV9002", amount: "₹11,758.37", confidence: "100%" },
              { ref: "TXN10004", order: "ORD5004", invoice: "INV9004", amount: "₹15,574.83", confidence: "100%" },
              { ref: "TXN10005", order: "ORD5005", invoice: "INV9005", amount: "₹17,178.70", confidence: "100%" },
              { ref: "TXN10006", order: "ORD5006", invoice: "INV9006", amount: "₹2,469.53", confidence: "100%" },
              { ref: "TXN10007", order: "ORD5007", invoice: "INV9007", amount: "₹9,341.50", confidence: "100%" },
            ].map((row) => (
              <tr key={row.ref}>
                <td className={styles.cellMono}>{row.ref}</td>
                <td className={styles.cellMono}>{row.order}</td>
                <td className={styles.cellMono}>{row.invoice}</td>
                <td className={styles.cellAmount}>{row.amount}</td>
                <td>
                  <span className={styles.badge + " " + styles.badgeGreen}>● Matched</span>
                </td>
                <td>
                  <div className={styles.confidenceBar}>
                    <div className={styles.confidenceFill}></div>
                  </div>
                </td>
                <td className={styles.cellSmall}>Tier 1 - SQL</td>
                <td className={styles.cellSmall}>Exact amount match</td>
                <td className={styles.cellAction}>View</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
