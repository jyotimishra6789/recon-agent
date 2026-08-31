import React, { useState, useEffect } from "react";
import { api } from "../api";

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
    return <div className="p-6 text-center">Loading orchestration data...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded">
        Error: {error}
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">🎯 Orchestration Insights</h2>
        <button
          onClick={fetchOrchestrationData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      {/* Overall Summary */}
      {strategyStats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-600 font-semibold">Total Attempts</div>
            <div className="text-3xl font-bold text-blue-700">
              {strategyStats.summary.total_attempts}
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
            <div className="text-sm text-green-600 font-semibold">Total Successes</div>
            <div className="text-3xl font-bold text-green-700">
              {strategyStats.summary.total_successes}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
            <div className="text-sm text-purple-600 font-semibold">Overall Success Rate</div>
            <div className="text-3xl font-bold text-purple-700">
              {strategyStats.summary.overall_success_rate}%
            </div>
          </div>
        </div>
      )}

      {/* Strategy Performance */}
      {strategyStats && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">📊 Strategy Performance</h3>
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
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{strategy.icon}</span>
                    <span className="font-semibold text-sm">{strategy.label}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-gray-600">
                      Attempts: <strong>{stats.attempts}</strong>
                    </div>
                    <div className="text-gray-600">
                      Successes: <strong>{stats.successes}</strong>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isHighPerforming ? "bg-green-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${successRate}%` }}
                        />
                      </div>
                      <span className="font-bold text-sm">{successRate}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Model Usage Distribution */}
      {modelUsage && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">🤖 AI Model Usage</h3>
          <div className="space-y-3">
            {modelUsage.model_distribution.map((model) => (
              <div key={model.model} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium capitalize">{model.model}</span>
                  <span className="text-sm text-gray-600">
                    {model.count} decisions ({model.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      model.model === "gemini"
                        ? "bg-red-500"
                        : model.model === "adaptive"
                        ? "bg-purple-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${model.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200 text-sm text-blue-700">
            <strong>Total Decisions:</strong> {modelUsage.total_decisions}
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
      <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
        <div className="font-semibold text-indigo-900 mb-2">
          ℹ️ How Multi-Orchestration Works
        </div>
        <div className="text-sm text-indigo-800 space-y-2">
          <p>
            <strong>Stage 1:</strong> Tries deterministic matching first (fastest).
            If confidence ≥95%, stops here.
          </p>
          <p>
            <strong>Stage 2:</strong> If deterministic uncertain, tries adaptive
            patterns. If confidence ≥85%, stops here.
          </p>
          <p>
            <strong>Stage 3:</strong> If still uncertain, uses LLM fuzzy matching
            for deeper analysis. If confidence ≥70%, stops here.
          </p>
          <p>
            <strong>Stage 4:</strong> Combines all signals using hybrid scoring to
            produce final decision.
          </p>
          <p className="mt-3 font-semibold">
            🎯 Result: Fast for simple matches, intelligent for complex ones!
          </p>
        </div>
      </div>
    </div>
  );
}
