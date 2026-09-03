import React, { useEffect, useState } from "react";
import { api } from "../api";

const PIPELINE_STAGES = [
  {
    number: 1,
    id: "deterministic",
    label: "Deterministic",
    
    confidence: "≥ 95%",
    description: "Fast rule-based matching on exact amounts, references and date tolerance.",
    color: "#3b82f6",
  },
  {
    number: 2,
    id: "adaptive",
    label: "Adaptive",
  
    confidence: "≥ 85%",
    description: "Learned patterns — fees, settlement delays, recurring behaviors.",
    color: "#8b5cf6",
  },
  {
    number: 3,
    id: "llm_fuzzy",
    label: "LLM Fuzzy",
  
    confidence: "≥ 70%",
    description: "Gemini reads descriptions and ambiguous context — only when the first two can't confidently resolve it.",
    color: "#ec4899",
  },
  {
    number: 4,
    id: "hybrid",
    label: "Hybrid",
   
    confidence: "Final",
    description: "Combines amount, date and contextual signals as a last decision layer.",
    color: "#f59e0b",
  },
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function getSuccessRate(stats) {
  if (!stats) return 0;
  if (stats.success_rate !== undefined && stats.success_rate !== null) {
    return Number(stats.success_rate) || 0;
  }
  const attempts = Number(stats.attempts || 0);
  const successes = Number(stats.successes || 0);
  if (!attempts) return 0;
  return Number(((successes / attempts) * 100).toFixed(1));
}

function getStrategyStats(strategyStats, strategyId) {
  return strategyStats?.strategies?.[strategyId] || null;
}

export default function OrchestrationInsights() {
  const [strategyStats, setStrategyStats] = useState(null);
  const [modelUsage, setModelUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState("deterministic");
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStage, setDemoStage] = useState(0);

  useEffect(() => {
    fetchOrchestrationData();
  }, []);

  const fetchOrchestrationData = async () => {
    setError(null);
    try {
      setRefreshing(true);
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
      setRefreshing(false);
    }
  };

  const runOrchestrationDemo = () => {
    if (demoRunning) return;
    setDemoRunning(true);
    setDemoStage(0);
    let currentStage = 0;
    const interval = setInterval(() => {
      currentStage += 1;
      setDemoStage(currentStage);
      setSelectedStrategy(PIPELINE_STAGES[currentStage - 1]?.id || "deterministic");
      if (currentStage >= PIPELINE_STAGES.length) {
        clearInterval(interval);
        setTimeout(() => {
          setDemoRunning(false);
          setDemoStage(0);
        }, 1000);
      }
    }, 800);
  };

  if (loading) {
    return <div className="empty-state">Loading orchestration data…</div>;
  }

  if (error) {
    return (
      <div className="error-banner">
        ⚠️ Unable to load orchestration data — {error}
        <button className="filters-btn" style={{ marginLeft: 12 }} onClick={fetchOrchestrationData}>Try again</button>
      </div>
    );
  }

  const summary = strategyStats?.summary || {};
  const totalAttempts = Number(summary.total_attempts || 0);
  const totalSuccesses = Number(summary.total_successes || 0);
  const overallSuccessRate =
    summary.overall_success_rate !== undefined
      ? Number(summary.overall_success_rate)
      : totalAttempts
      ? Number(((totalSuccesses / totalAttempts) * 100).toFixed(1))
      : 0;

  const selected = PIPELINE_STAGES.find((s) => s.id === selectedStrategy) || PIPELINE_STAGES[0];
  const selectedStats = getStrategyStats(strategyStats, selectedStrategy);
  const modelDistribution = modelUsage?.model_distribution || [];

  const llmAvoided = strategyStats?.optimization?.cache_hits ?? strategyStats?.cache_hits ?? 0;
  const tokensSaved = strategyStats?.optimization?.tokens_saved ?? strategyStats?.tokens_saved ?? 0;
  const costSaved = strategyStats?.optimization?.cost_savings ?? strategyStats?.cost_savings ?? "0.00";

  return (
    <div className="orch-page">
      <div className="orch-header">
        <div>
          <div className="orch-header-title"><span></span><h2>Orchestration</h2></div>
          <p>The decision engine picks the simplest reliable strategy first.</p>
        </div>
        <div className="orch-header-actions">
          <button className="run-btn" onClick={runOrchestrationDemo} disabled={demoRunning}>
            <span>▶</span>{demoRunning ? "Running…" : "Run demo"}
          </button>
          <button className="filters-btn" onClick={fetchOrchestrationData} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      <div className="orch-kpi-strip">
        <div className="kpi-chip"><b>{formatNumber(totalAttempts)}</b><span>Evaluated</span></div>
        <div className="kpi-chip"><b>{formatNumber(totalSuccesses)}</b><span>Matched</span></div>
        <div className="kpi-chip highlight"><b>{overallSuccessRate}%</b><span>Success rate</span></div>
      </div>

      <section className="panel orch-pipeline-panel">
        <div className="panel-heading orch-pipeline-heading">
          <span className="section-title">How it thinks — tap a step</span>
          <span className="beta-badge" style={{ background: "var(--surface-soft)", color: "var(--ink-soft)" }}>Cost-aware AI</span>
        </div>

        <div className="pipeline-row">
          {PIPELINE_STAGES.map((stage, i) => {
            const isActive = demoStage === stage.number;
            const isDone = demoRunning && demoStage > stage.number;
            const isSelected = selectedStrategy === stage.id;
            return (
              <React.Fragment key={stage.id}>
                <button
                  className={`pipeline-card ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""} ${isSelected ? "is-selected" : ""}`}
                  style={{ "--stage-color": stage.color }}
                  onClick={() => setSelectedStrategy(stage.id)}
                >
                  <div className="pipeline-card-top">
                    <span className="pipeline-card-icon">{isDone ? "✓" : stage.icon}</span>
                    <small>Step {stage.number}</small>
                  </div>
                  <b>{stage.label}</b>
                  <span className="pipeline-card-conf">{stage.confidence}</span>
                </button>
                {i < PIPELINE_STAGES.length - 1 && <span className="pipeline-arrow">→</span>}
              </React.Fragment>
            );
          })}
        </div>

        {demoRunning && (
          <div className="demo-status">
            <i className="demo-dot" />Evaluating transaction — trying {selected.label}…
          </div>
        )}

        <div className="pipeline-detail" style={{ "--stage-color": selected.color }}>
          <span className="pipeline-detail-icon">{selected.icon}</span>
          <div>
            <div className="pipeline-detail-heading">
              <b>{selected.label}</b>
              {selectedStats && <span className="badge tier1">{getSuccessRate(selectedStats)}% success</span>}
            </div>
            <p>{selected.description}</p>
            {selectedStats && (
              <div className="pipeline-detail-stats">
                <span>Attempts <b>{formatNumber(selectedStats.attempts)}</b></span>
                <span>Successes <b>{formatNumber(selectedStats.successes)}</b></span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="orch-bottom-grid">
        <section className="panel">
          <div className="panel-heading"><span className="section-title">AI decision mix</span></div>
          <div className="model-mix">
            {modelDistribution.length > 0 ? (
              modelDistribution.map((model) => (
                <div key={model.model} className="model-mix-row">
                  <div className="model-mix-label"><span>{model.model}</span><small>{formatNumber(model.count)} · {model.percentage}%</small></div>
                  <div className="confidence-bar"><div className="confidence-bar-fill" style={{ width: `${Math.min(Math.max(Number(model.percentage || 0), 0), 100)}%` }} /></div>
                </div>
              ))
            ) : (
              <div className="empty-state">No model distribution data.</div>
            )}
          </div>
        </section>

        <section className="panel efficiency-panel">
          <div className="panel-heading"><span className="section-title">Efficiency</span></div>
          <div className="efficiency-grid">
            <div><b>{formatNumber(llmAvoided)}</b><span>LLM calls avoided</span></div>
            <div><b>{formatNumber(tokensSaved)}</b><span>Tokens saved</span></div>
            <div><b>${costSaved}</b><span>Cost saved</span></div>
          </div>
        </section>
      </div>

      <div className="judge-banner">
        <span className="judge-badge">💡 Judge takeaway</span>
        <h3>Don't use AI for everything. Use AI when it matters.</h3>
        <p>Cheap deterministic rules first, adaptive logic next, LLM reasoning only for genuinely ambiguous transactions — fast, measurable, cost-efficient.</p>
      </div>
    </div>
  );
}