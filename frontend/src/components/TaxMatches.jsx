import React, { useState, useEffect } from "react";
import { api } from "../api";
import {
  PieChart,
  Pie,
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
  Cell,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

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
    return <div className="p-6 text-center text-gray-600">Loading tax data...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg border border-red-200">
        ⚠️ Error: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">📋 Tax Reconciliation Dashboard</h2>
        <button
          onClick={fetchTaxData}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Enhanced Summary Cards */}
      {taxSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm text-blue-600 font-semibold uppercase tracking-wide">Total Tax Records</div>
            <div className="text-4xl font-bold text-blue-700 mt-2">
              {taxSummary.total_tax_records}
            </div>
            <div className="text-xs text-blue-500 mt-2">Tax records tracked</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm text-green-600 font-semibold uppercase tracking-wide">✅ Matched Records</div>
            <div className="text-4xl font-bold text-green-700 mt-2">
              {taxSummary.matched_tax_records}
            </div>
            <div className="text-xs text-green-500 mt-2">Successfully reconciled</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm text-purple-600 font-semibold uppercase tracking-wide">📊 Match Rate</div>
            <div className="text-4xl font-bold text-purple-700 mt-2">
              {taxSummary.match_rate}%
            </div>
            <div className="text-xs text-purple-500 mt-2">Reconciliation success</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm text-orange-600 font-semibold uppercase tracking-wide">💰 Total Tax Amount</div>
            <div className="text-3xl font-bold text-orange-700 mt-2">
              ₹{taxSummary.matched_tax_amount.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-orange-500 mt-2">Tax value matched</div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {taxSummary && taxSummary.tax_by_type.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart - Tax Distribution by Type */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">📊 Tax Type Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
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
          </div>

          {/* Bar Chart - Tax Amount by Type */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">💰 Tax Amount by Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={taxSummary.tax_by_type}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="tax_type" />
                <YAxis />
                <Tooltip
                  formatter={(value) =>
                    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                  }
                />
                <Bar dataKey="total_amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tax by Type - Enhanced Table */}
      {taxSummary && taxSummary.tax_by_type.length > 0 && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">📋 Tax Breakdown by Type</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Tax Type</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Count</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">% of Total</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Amount</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Avg Amount</th>
                </tr>
              </thead>
              <tbody>
                {taxSummary.tax_by_type.map((t, idx) => (
                  <tr
                    key={t.tax_type}
                    className="border-b hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTaxType(selectedTaxType === t.tax_type ? null : t.tax_type)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        ></div>
                        <span className="font-medium text-gray-900">{t.tax_type}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">{t.count}</td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {((t.count / taxSummary.total_tax_records) * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-gray-900">
                      ₹{t.total_amount.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      ₹{(t.total_amount / t.count).toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tax Matches Table - Enhanced */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">
          🔍 Tax Matches Details ({taxMatches.length})
        </h3>
        {taxMatches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No tax matches found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Tax ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Tax Type</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Rate (%)</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Base Amount</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Tax Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Invoice</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Confidence</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Reason</th>
                </tr>
              </thead>
              <tbody>
                {taxMatches.map((match) => (
                  <tr key={match.tax_id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-blue-600">{match.tax_id}</td>
                    <td className="py-3 px-4">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                        {match.tax_type}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-gray-900">{match.tax_rate}%</td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      ₹{match.base_amount.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-orange-600">
                      ₹{match.tax_amount.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600 font-mono">{match.invoice_id}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          match.confidence_score >= 95
                            ? "bg-green-100 text-green-800"
                            : match.confidence_score >= 80
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {match.confidence_score}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">{match.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
