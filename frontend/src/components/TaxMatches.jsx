import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function TaxMatches() {
  const [taxMatches, setTaxMatches] = useState([]);
  const [taxSummary, setTaxSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    return <div className="p-6 text-center">Loading tax data...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tax Reconciliation</h2>
        <button
          onClick={fetchTaxData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      {/* Tax Summary Cards */}
      {taxSummary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-sm text-gray-600">Total Tax Records</div>
            <div className="text-2xl font-bold text-blue-600">
              {taxSummary.total_tax_records}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <div className="text-sm text-gray-600">Matched Records</div>
            <div className="text-2xl font-bold text-green-600">
              {taxSummary.matched_tax_records}
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <div className="text-sm text-gray-600">Match Rate</div>
            <div className="text-2xl font-bold text-purple-600">
              {taxSummary.match_rate}%
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded">
            <div className="text-sm text-gray-600">Total Tax Amount</div>
            <div className="text-2xl font-bold text-orange-600">
              ₹{taxSummary.matched_tax_amount.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tax by Type */}
      {taxSummary && taxSummary.tax_by_type.length > 0 && (
        <div className="bg-white p-4 rounded border">
          <h3 className="text-lg font-semibold mb-4">Tax Breakdown by Type</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Tax Type</th>
                <th className="text-right py-2">Count</th>
                <th className="text-right py-2">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {taxSummary.tax_by_type.map((t) => (
                <tr key={t.tax_type} className="border-b hover:bg-gray-50">
                  <td className="py-2">{t.tax_type}</td>
                  <td className="text-right py-2">{t.count}</td>
                  <td className="text-right py-2">
                    ₹{t.total_amount.toLocaleString("en-IN", {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tax Matches Table */}
      <div className="bg-white p-4 rounded border">
        <h3 className="text-lg font-semibold mb-4">
          Tax Matches ({taxMatches.length})
        </h3>
        {taxMatches.length === 0 ? (
          <p className="text-gray-500">No tax matches found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-2">Tax ID</th>
                <th className="text-left py-2 px-2">Tax Type</th>
                <th className="text-right py-2 px-2">Rate (%)</th>
                <th className="text-right py-2 px-2">Base Amount</th>
                <th className="text-right py-2 px-2">Tax Amount</th>
                <th className="text-left py-2 px-2">Invoice</th>
                <th className="text-center py-2 px-2">Confidence</th>
                <th className="text-left py-2 px-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {taxMatches.map((match) => (
                <tr key={match.tax_id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2 font-mono text-xs">{match.tax_id}</td>
                  <td className="py-2 px-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                      {match.tax_type}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2">{match.tax_rate}%</td>
                  <td className="text-right py-2 px-2">
                    ₹{match.base_amount.toLocaleString("en-IN", {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="text-right py-2 px-2 font-semibold">
                    ₹{match.tax_amount.toLocaleString("en-IN", {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2 px-2 text-xs">{match.invoice_id}</td>
                  <td className="py-2 px-2 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
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
                  <td className="py-2 px-2 text-xs text-gray-600">
                    {match.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
