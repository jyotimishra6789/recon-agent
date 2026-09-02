import React, { useEffect, useState } from "react";
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
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">
            Loading orchestration insights...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 p-5 bg-red-50 border border-red-200 rounded-xl">
        <div className="font-semibold text-red-700 mb-1">
          Unable to load orchestration data
        </div>
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchOrchestrationData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const summary = strategyStats?.summary || {};

  const strategies = [
    {
      id: "deterministic",
      name: "Deterministic",
      icon: "⚙️",
      description: "Exact amount + date rules",
      color: "blue",
    },
    {
      id: "adaptive",
      name: "Adaptive",
      icon: "🎯",
      description: "Pattern-based matching",
      color: "purple",
    },
    {
      id: "llm_fuzzy",
      name: "LLM Fuzzy",
      icon: "🤖",
      description: "AI for ambiguous cases",
      color: "pink",
    },
    {
      id: "hybrid",
      name: "Hybrid",
      icon: "🔀",
      description: "Multi-signal scoring",
      color: "amber",
    },
    {
      id: "tax",
      name: "Tax",
      icon: "💰",
      description: "Tax-specific reconciliation",
      color: "emerald",
    },
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: {
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-700",
        bar: "bg-blue-500",
        light: "bg-blue-100",
      },
      purple: {
        bg: "bg-purple-50",
        border: "border-purple-200",
        text: "text-purple-700",
        bar: "bg-purple-500",
        light: "bg-purple-100",
      },
      pink: {
        bg: "bg-pink-50",
        border: "border-pink-200",
        text: "text-pink-700",
        bar: "bg-pink-500",
        light: "bg-pink-100",
      },
      amber: {
        bg: "bg-amber-50",
        border: "border-amber-200",
        text: "text-amber-700",
        bar: "bg-amber-500",
        light: "bg-amber-100",
      },
      emerald: {
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        text: "text-emerald-700",
        bar: "bg-emerald-500",
        light: "bg-emerald-100",
      },
    };

    return colors[color] || colors.blue;
  };

  const totalAttempts = Number(summary.total_attempts || 0);
  const totalSuccesses = Number(summary.total_successes || 0);
  const successRate = Number(summary.overall_success_rate || 0);

  const optimization = strategyStats?.optimization || {};

  const cacheHits = Number(
    optimization.llm_cache_hits_prevented || 0
  );

  const tokenSavedText =
    optimization.token_reduction_estimate || "0";

  const costSavings =
    optimization.cost_savings_estimate || "$0";

  const llmReduction =
    optimization.llm_calls_reduced_by || "0";

  return (
    <div className="p-6 space-y-6 bg-[#f7f9fc] min-h-full">

      {/* =========================================================
          HEADER
      ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🎯</span>
            <h1 className="text-2xl font-bold text-gray-900">
              Orchestration
            </h1>
          </div>

          <p className="text-sm text-gray-500">
            Intelligent routing that uses the simplest strategy first
            and escalates only when necessary.
          </p>
        </div>

        <button
          onClick={fetchOrchestrationData}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg
                     text-sm font-medium text-gray-700 hover:bg-gray-50
                     transition shadow-sm"
        >
          ↻ Refresh
        </button>
      </div>


      {/* =========================================================
          HERO / KEY METRICS
      ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Total attempts */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Reconciliation Tasks
              </p>

              <p className="text-3xl font-bold text-gray-900 mt-2">
                {totalAttempts}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Total orchestration attempts
              </p>
            </div>

            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl">
              📊
            </div>
          </div>
        </div>


        {/* Successful */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Successfully Resolved
              </p>

              <p className="text-3xl font-bold text-gray-900 mt-2">
                {totalSuccesses}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Automatically reconciled
              </p>
            </div>

            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-xl">
              ✓
            </div>
          </div>
        </div>


        {/* Success rate */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Orchestration Success
              </p>

              <p className="text-3xl font-bold text-gray-900 mt-2">
                {successRate}%
              </p>

              <p className="text-xs text-gray-500 mt-1">
                End-to-end success rate
              </p>
            </div>

            <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-xl">
              🎯
            </div>
          </div>

          <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{
                width: `${Math.min(Math.max(successRate, 0), 100)}%`,
              }}
            />
          </div>
        </div>
      </div>


      {/* =========================================================
          MAIN ORCHESTRATION PIPELINE
      ========================================================= */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                How Recon Decides
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Progressive escalation keeps simple matches fast and
                reserves AI for difficult cases.
              </p>
            </div>

            <span className="hidden md:inline-flex px-3 py-1.5 rounded-full
                             bg-blue-50 text-blue-700 text-xs font-semibold">
              Multi-strategy engine
            </span>
          </div>
        </div>


        <div className="p-5">

          {/* Pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">

            {/* Stage 1 */}
            <div className="relative">
              <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 h-full">

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    ⚙️
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-blue-600">
                      STAGE 01
                    </p>

                    <p className="font-semibold text-gray-900">
                      Deterministic
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  Exact amount, reference and date matching.
                </p>

                <div className="mt-4 pt-3 border-t border-blue-200">
                  <span className="text-xs font-semibold text-blue-700">
                    Fastest path
                  </span>
                </div>
              </div>
            </div>


            {/* Stage 2 */}
            <div className="relative">
              <div className="border border-purple-200 bg-purple-50 rounded-xl p-4 h-full">

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    🎯
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-purple-600">
                      STAGE 02
                    </p>

                    <p className="font-semibold text-gray-900">
                      Adaptive
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  Handles fees, settlement delays and learned patterns.
                </p>

                <div className="mt-4 pt-3 border-t border-purple-200">
                  <span className="text-xs font-semibold text-purple-700">
                    Pattern aware
                  </span>
                </div>
              </div>
            </div>


            {/* Stage 3 */}
            <div className="relative">
              <div className="border border-pink-200 bg-pink-50 rounded-xl p-4 h-full">

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    🤖
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-pink-600">
                      STAGE 03
                    </p>

                    <p className="font-semibold text-gray-900">
                      LLM Fuzzy
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  Uses AI only when deterministic and adaptive matching
                  are uncertain.
                </p>

                <div className="mt-4 pt-3 border-t border-pink-200">
                  <span className="text-xs font-semibold text-pink-700">
                    AI escalation
                  </span>
                </div>
              </div>
            </div>


            {/* Stage 4 */}
            <div className="relative">
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 h-full">

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    🔀
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-amber-600">
                      STAGE 04
                    </p>

                    <p className="font-semibold text-gray-900">
                      Hybrid
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  Combines multiple signals when no single strategy is
                  confident enough.
                </p>

                <div className="mt-4 pt-3 border-t border-amber-200">
                  <span className="text-xs font-semibold text-amber-700">
                    Final decision
                  </span>
                </div>
              </div>
            </div>

          </div>


          {/* Decision rule */}
          <div className="mt-5 bg-gray-50 border border-gray-200 rounded-lg p-4">

            <div className="flex items-start gap-3">
              <div className="text-lg">💡</div>

              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Core orchestration principle
                </p>

                <p className="text-xs text-gray-600 mt-1">
                  Start with deterministic rules → escalate to adaptive
                  matching → use AI only for ambiguous cases → combine
                  signals when required.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>


      {/* =========================================================
          STRATEGY PERFORMANCE
      ========================================================= */}
      {strategyStats && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">

          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              Strategy Performance
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Which reconciliation strategy is actually doing the work?
            </p>
          </div>

          <div className="divide-y divide-gray-100">

            {strategies.map((strategy) => {
              const stats =
                strategyStats?.strategies?.[strategy.id];

              if (!stats) return null;

              const attempts = Number(stats.attempts || 0);
              const successes = Number(stats.successes || 0);
              const rate = Number(stats.success_rate || 0);

              const colors = getColorClasses(strategy.color);

              return (
                <div
                  key={strategy.id}
                  className="p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">

                    {/* Strategy name */}
                    <div className="flex items-center gap-3 md:w-64">

                      <div
                        className={`w-10 h-10 rounded-lg ${colors.bg}
                                    flex items-center justify-center text-lg`}
                      >
                        {strategy.icon}
                      </div>

                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {strategy.name}
                        </p>

                        <p className="text-xs text-gray-500">
                          {strategy.description}
                        </p>
                      </div>

                    </div>


                    {/* Attempts */}
                    <div className="md:w-28">
                      <p className="text-xs text-gray-400">
                        Attempts
                      </p>

                      <p className="font-semibold text-gray-900">
                        {attempts}
                      </p>
                    </div>


                    {/* Successes */}
                    <div className="md:w-28">
                      <p className="text-xs text-gray-400">
                        Successes
                      </p>

                      <p className="font-semibold text-emerald-600">
                        {successes}
                      </p>
                    </div>


                    {/* Progress */}
                    <div className="flex-1">

                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-gray-500">
                          Success rate
                        </span>

                        <span className="text-xs font-bold text-gray-800">
                          {rate}%
                        </span>
                      </div>

                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors.bar} rounded-full transition-all`}
                          style={{
                            width: `${Math.min(
                              Math.max(rate, 0),
                              100
                            )}%`,
                          }}
                        />
                      </div>

                    </div>

                  </div>
                </div>
              );
            })}

          </div>
        </div>
      )}


      {/* =========================================================
          AI EFFICIENCY / OPTIMIZATION
      ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* AI Usage */}
        {modelUsage?.model_distribution && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">

            <div className="flex items-center justify-between mb-5">

              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  AI Decision Mix
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  How the orchestration engine distributes decisions.
                </p>
              </div>

              <div className="text-xl">
                🤖
              </div>

            </div>


            <div className="space-y-4">

              {modelUsage.model_distribution.map((model) => {

                const percentage = Number(model.percentage || 0);

                return (
                  <div key={model.model}>

                    <div className="flex justify-between items-center mb-1.5">

                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {model.model}
                      </span>

                      <span className="text-xs font-semibold text-gray-500">
                        {model.count} · {percentage}%
                      </span>

                    </div>

                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">

                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{
                          width: `${Math.min(
                            Math.max(percentage, 0),
                            100
                          )}%`,
                        }}
                      />

                    </div>

                  </div>
                );
              })}

            </div>


            <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between">

              <span className="text-xs text-gray-500">
                Total decisions
              </span>

              <span className="text-sm font-bold text-gray-900">
                {modelUsage.total_decisions || 0}
              </span>

            </div>

          </div>
        )}


        {/* Optimization */}
        <div className="bg-gradient-to-br from-emerald-50 to-green-50
                        border border-emerald-200 rounded-xl shadow-sm p-5">

          <div className="flex items-center justify-between mb-5">

            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                AI Efficiency
              </h2>

              <p className="text-xs text-gray-600 mt-1">
                Cost and token optimization from smart routing.
              </p>
            </div>

            <div className="text-xl">
              ⚡
            </div>

          </div>


          <div className="grid grid-cols-2 gap-3">

            {/* Cache */}
            <div className="bg-white/80 border border-emerald-100 rounded-lg p-4">
              <p className="text-xs text-gray-500">
                LLM calls avoided
              </p>

              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {cacheHits}
              </p>

              <p className="text-[11px] text-gray-500 mt-1">
                Cache hits
              </p>
            </div>


            {/* Tokens */}
            <div className="bg-white/80 border border-emerald-100 rounded-lg p-4">
              <p className="text-xs text-gray-500">
                Tokens saved
              </p>

              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {tokenSavedText}
              </p>

              <p className="text-[11px] text-gray-500 mt-1">
                Estimated reduction
              </p>
            </div>


            {/* Cost */}
            <div className="bg-white/80 border border-emerald-100 rounded-lg p-4">
              <p className="text-xs text-gray-500">
                Cost savings
              </p>

              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {costSavings}
              </p>

              <p className="text-[11px] text-gray-500 mt-1">
                Per 100 transactions
              </p>
            </div>


            {/* LLM reduction */}
            <div className="bg-white/80 border border-emerald-100 rounded-lg p-4">
              <p className="text-xs text-gray-500">
                LLM reduction
              </p>

              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {llmReduction}
              </p>

              <p className="text-[11px] text-gray-500 mt-1">
                Fewer API calls
              </p>
            </div>

          </div>


          {/* Key takeaway */}
          <div className="mt-4 p-3 bg-emerald-100/70 rounded-lg">

            <p className="text-xs text-emerald-800">
              <span className="font-bold">
                Why this matters:
              </span>{" "}
              Recon does not send every transaction to an LLM. It
              escalates intelligently, keeping reconciliation fast,
              cheaper and scalable.
            </p>

          </div>

        </div>

      </div>


      {/* =========================================================
          JUDGE-FRIENDLY TAKEAWAY
      ========================================================= */}
      <div className="bg-gray-900 rounded-xl p-5 shadow-sm">

        <div className="flex flex-col md:flex-row md:items-center
                        md:justify-between gap-4">

          <div>

            <div className="flex items-center gap-2">
              <span className="text-lg">🚀</span>

              <h2 className="text-base font-semibold text-white">
                Why our orchestration is different
              </h2>
            </div>

            <p className="text-sm text-gray-400 mt-2 max-w-2xl">
              Simple transactions are resolved with deterministic
              rules, while ambiguous transactions automatically
              escalate to smarter strategies. This gives us the
              accuracy of AI without paying the cost of AI on every
              transaction.
            </p>

          </div>


          <div className="flex-shrink-0">

            <div className="px-4 py-3 rounded-lg bg-white/10 border border-white/10">

              <p className="text-[10px] uppercase tracking-wider text-gray-400">
                Engine principle
              </p>

              <p className="text-sm font-semibold text-white mt-1">
                Fast → Adaptive → AI
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}