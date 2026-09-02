import React, { useState, useEffect } from "react";
import { api } from "../api";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const STRATEGY_COLORS = {
  deterministic: "#3b82f6",
  adaptive: "#8b5cf6",
  llm_fuzzy: "#ec4899",
  hybrid: "#f59e0b",
  tax: "#10b981",
};

export default function OrchestrationInsights() {
  const [strategyStats, setStrategyStats] = useState(null);
  const [modelUsage, setModelUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrchestrationData();
  }, []);

  const fetchOrchestrationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, modelRes] = await Promise.all([
        api.getStrategyStats(),
        api.getModelUsage(),
      ]);
      setStrategyStats(statsRes);
      setModelUsage(modelRes);
    } catch (err) {
      setError(err.message || "Failed to fetch orchestration data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-600">Loading orchestration data...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg border border-red-200">
        ⚠️ Error: {error}
      </div>
    );
  }

  const strategies = [
    { id: "deterministic", label: "Deterministic", color: "#3b82f6", icon: "⚙️" },
    { id: "adaptive", label: "Adaptive", color: "#8b5cf6", icon: "🎯" },
    { id: "llm_fuzzy", label: "LLM Fuzzy", color: "#ec4899", icon: "🤖" },
    { id: "hybrid", label: "Hybrid", color: "#f59e0b", icon: "🔀" },
    { id: "tax", label: "Tax", color: "#10b981", icon: "💰" },
  ];

  // Prepare data for charts
  const strategyChartData = strategies
    .map((strategy) => {
      const stats = strategyStats?.strategies[strategy.id];
      return stats
        ? {
            name: strategy.label,
            attempts: stats.attempts,
            successes: stats.successes,
            failures: stats.attempts - stats.successes,
            successRate: stats.success_rate,
          }
        : null;
    })
    .filter(Boolean);

  return (
    <div className="p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">🎯 Orchestration Insights Dashboard</h2>
        <button
          onClick={fetchOrchestrationData}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Overall Summary - Enhanced */}
      {strategyStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm text-blue-600 font-semibold uppercase tracking-wide">📊 Total Attempts</div>
            <div className="text-4xl font-bold text-blue-700 mt-2">
              {strategyStats.summary.total_attempts}
            </div>
            <div className="text-xs text-blue-500 mt-2">Reconciliation tasks</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm text-green-600 font-semibold uppercase tracking-wide">✅ Total Successes</div>
            <div className="text-4xl font-bold text-green-700 mt-2">
              {strategyStats.summary.total_successes}
            </div>
            <div className="text-xs text-green-500 mt-2">Successfully resolved</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm text-purple-600 font-semibold uppercase tracking-wide">🎯 Success Rate</div>
            <div className="text-4xl font-bold text-purple-700 mt-2">
              {strategyStats.summary.overall_success_rate}%
            </div>
            <div className="text-xs text-purple-500 mt-2">Overall performance</div>
          </div>
        </div>
      )}

      {/* Advanced Charts - Strategy Comparison */}
      {strategyStats && strategyChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attempts vs Success Bar Chart */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">📊 Attempts vs Successes by Strategy</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={strategyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="attempts" fill="#93c5fd" name="Attempts" radius={[8, 8, 0, 0]} />
                <Bar dataKey="successes" fill="#34d399" name="Successes" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Success Rate Line Chart */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">📈 Success Rate by Strategy</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={strategyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `${value}%`} />
                <Line
                  type="monotone"
                  dataKey="successRate"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ fill: "#8b5cf6", r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Success Rate (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Strategy Performance Cards - Enhanced */}
      {strategyStats && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">⚡ Strategy Performance Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {strategies.map((strategy) => {
              const stats = strategyStats.strategies[strategy.id];
              if (!stats) return null;

              const successRate = stats.success_rate;
              const isHighPerforming = successRate >= 80;

              return (
                <div
                  key={strategy.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isHighPerforming
                      ? "bg-green-50 border-green-300 shadow-md"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{strategy.icon}</span>
                    <span className="font-semibold text-sm text-gray-900">{strategy.label}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Attempts:</span>
                      <strong className="text-gray-900">{stats.attempts}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Successes:</span>
                      <strong className="text-green-600">{stats.successes}</strong>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 bg-gray-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isHighPerforming ? "bg-green-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${successRate}%` }}
                        />
                      </div>
                      <span className="font-bold text-sm text-gray-900 w-12 text-right">{successRate}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Model Usage Distribution */}
      {modelUsage && modelUsage.model_distribution && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart - Model Distribution */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">🤖 AI Model Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={modelUsage.model_distribution}
                  dataKey="count"
                  nameKey="model"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {modelUsage.model_distribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={["#ec4899", "#8b5cf6", "#3b82f6"][index % 3]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} decisions`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Model Usage Details */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">📊 Model Usage Breakdown</h3>
            <div className="space-y-4">
              {modelUsage.model_distribution.map((model, idx) => (
                <div key={model.model} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium capitalize text-gray-900">{model.model}</span>
                    <span className="text-sm font-semibold text-gray-600">
                      {model.count} ({model.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        ["bg-red-500", "bg-purple-500", "bg-blue-500"][idx % 3]
                      }`}
                      style={{ width: `${model.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700">
                <strong>Total Decisions:</strong> {modelUsage.total_decisions}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Token & Cost Savings Insights */}
      {strategyStats?.optimization && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-300 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">💰 Token Optimization Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-semibold">Cache Hits</div>
              <div className="text-2xl font-bold text-green-700 mt-1">
                {strategyStats.optimization.llm_cache_hits_prevented || 0}
              </div>
              <div className="text-xs text-green-500 mt-1">LLM calls avoided</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-semibold">Tokens Saved</div>
              <div className="text-2xl font-bold text-green-700 mt-1">
                {strategyStats.optimization.token_reduction_estimate?.split('-')[0]?.trim() || "0"}
              </div>
              <div className="text-xs text-green-500 mt-1">Estimated savings</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-semibold">Cost Savings</div>
              <div className="text-2xl font-bold text-green-700 mt-1">
                {strategyStats.optimization.cost_savings_estimate || "$0"}
              </div>
              <div className="text-xs text-green-500 mt-1">Per 100 transactions</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-semibold">LLM Reduction</div>
              <div className="text-2xl font-bold text-green-700 mt-1">
                {strategyStats.optimization.llm_calls_reduced_by || "0"}
              </div>
              <div className="text-xs text-green-500 mt-1">Fewer API calls</div>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="font-semibold text-blue-900 mb-2">⚙️ Deterministic</div>
          <p className="text-sm text-blue-800">
            Exact amount + date matching. Fastest and most precise. Used when amount
            difference is ≤₹0.01 and date drift ≤3 days.
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="font-semibold text-purple-900 mb-2">🎯 Adaptive</div>
          <p className="text-sm text-purple-800">
            Pattern-based matching using learned rules (fee deductions, settlement
            delays). Balances speed and accuracy.
          </p>
        </div>
        <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
          <div className="font-semibold text-pink-900 mb-2">🤖 LLM Fuzzy</div>
          <p className="text-sm text-pink-800">
            Gemini-powered fuzzy matching for ambiguous cases. Analyzes descriptions,
            references, and context. Higher latency but better for edge cases.
          </p>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
          <div className="font-semibold text-amber-900 mb-2">🔀 Hybrid</div>
          <p className="text-sm text-amber-800">
            Combines multiple weak signals when deterministic and adaptive fail.
            Uses weighted scoring on amount and date variance.
          </p>
        </div>
      </div>

      {/* Orchestration Info */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-lg border border-indigo-200 shadow-sm">
        <div className="font-semibold text-indigo-900 mb-3 text-lg">
          ℹ️ How Multi-Orchestration Works
        </div>
        <div className="text-sm text-indigo-800 space-y-2">
          <p>
            <strong className="text-indigo-950">Stage 1:</strong> Tries deterministic matching first (fastest).
            If confidence ≥95%, stops here.
          </p>
          <p>
            <strong className="text-indigo-950">Stage 2:</strong> If deterministic uncertain, tries adaptive
            patterns. If confidence ≥85%, stops here.
          </p>
          <p>
            <strong className="text-indigo-950">Stage 3:</strong> If still uncertain, uses LLM fuzzy matching
            for deeper analysis. If confidence ≥70%, stops here.
          </p>
          <p>
            <strong className="text-indigo-950">Stage 4:</strong> Combines all signals using hybrid scoring to
            produce final decision.
          </p>
          <p className="mt-4 font-semibold text-indigo-950 bg-indigo-100 p-2 rounded">
            🎯 Result: Fast for simple matches, intelligent for complex ones!
          </p>
        </div>
      </div>
    </div>
  );
}
