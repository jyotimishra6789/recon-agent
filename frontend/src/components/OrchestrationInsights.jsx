import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

export default function OrchestrationInsights() {
  const [strategyStats, setStrategyStats] = useState(null);
  const [modelUsage, setModelUsage] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedStrategy, setSelectedStrategy] =
    useState("deterministic");

  const [showFlow, setShowFlow] = useState(true);

  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStage, setDemoStage] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [stats, models] = await Promise.all([
        api.getStrategyStats(),
        api.getModelUsage(),
      ]);

      setStrategyStats(stats);
      setModelUsage(models);
    } catch (err) {
      setError(err.message || "Unable to load orchestration data");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------
     DEMO ORCHESTRATION FLOW
  ------------------------------------------------------------ */

  const runDemo = () => {
    if (demoRunning) return;

    setDemoRunning(true);
    setDemoStage(1);

    setTimeout(() => setDemoStage(2), 900);
    setTimeout(() => setDemoStage(3), 1800);
    setTimeout(() => setDemoStage(4), 2700);

    setTimeout(() => {
      setDemoRunning(false);
      setDemoStage(0);
    }, 3700);
  };

  /* ------------------------------------------------------------
     STRATEGIES
  ------------------------------------------------------------ */

  const strategies = [
    {
      id: "deterministic",
      name: "Deterministic",
      short: "Exact Match",
      icon: "⚙️",
      color: "#2563eb",
      bg: "#eff6ff",
      description:
        "Matches transactions using exact amount, reference and date rules.",
      threshold: "≥ 95%",
      advantage: "Fastest",
    },
    {
      id: "adaptive",
      name: "Adaptive",
      short: "Pattern Match",
      icon: "🎯",
      color: "#7c3aed",
      bg: "#f5f3ff",
      description:
        "Learns common patterns such as settlement delays and fee deductions.",
      threshold: "≥ 85%",
      advantage: "Pattern aware",
    },
    {
      id: "llm_fuzzy",
      name: "LLM Fuzzy",
      short: "AI Match",
      icon: "🤖",
      color: "#db2777",
      bg: "#fdf2f8",
      description:
        "Uses Gemini to understand descriptions, references and ambiguous context.",
      threshold: "≥ 70%",
      advantage: "Handles ambiguity",
    },
    {
      id: "hybrid",
      name: "Hybrid",
      short: "Multi-Signal",
      icon: "🔀",
      color: "#d97706",
      bg: "#fffbeb",
      description:
        "Combines amount, date and contextual signals for difficult matches.",
      threshold: "Final decision",
      advantage: "Most robust",
    },
    {
      id: "tax",
      name: "Tax",
      short: "Tax Match",
      icon: "💰",
      color: "#059669",
      bg: "#ecfdf5",
      description:
        "Specialized reconciliation logic for tax-related transactions.",
      threshold: "Tax rules",
      advantage: "Tax aware",
    },
  ];

  /* ------------------------------------------------------------
     SUMMARY
  ------------------------------------------------------------ */

  const summary = strategyStats?.summary || {};

  const totalAttempts = Number(summary.total_attempts || 0);
  const totalSuccesses = Number(summary.total_successes || 0);

  const successRate =
    Number(summary.overall_success_rate || 0);

  const selected = strategies.find(
    (s) => s.id === selectedStrategy
  );

  const selectedStats =
    strategyStats?.strategies?.[selectedStrategy] || {};

  const selectedAttempts =
    Number(selectedStats.attempts || 0);

  const selectedSuccesses =
    Number(selectedStats.successes || 0);

  const selectedRate =
    Number(selectedStats.success_rate || 0);

  /* ------------------------------------------------------------
     MOST USED STRATEGY
  ------------------------------------------------------------ */

  const mostUsed = useMemo(() => {
    if (!strategyStats?.strategies) return null;

    let best = null;

    strategies.forEach((strategy) => {
      const stats = strategyStats.strategies[strategy.id];

      if (!stats) return;

      const attempts = Number(stats.attempts || 0);

      if (!best || attempts > best.attempts) {
        best = {
          ...strategy,
          attempts,
        };
      }
    });

    return best;
  }, [strategyStats]);

  /* ------------------------------------------------------------
     LOADING
  ------------------------------------------------------------ */

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.spinner} />
        <div style={{ marginTop: 14, fontWeight: 600 }}>
          Loading orchestration engine...
        </div>
        <div style={{ color: "#94a3b8", marginTop: 4 }}>
          Analyzing reconciliation strategies
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------
     ERROR
  ------------------------------------------------------------ */

  if (error) {
    return (
      <div style={styles.errorBox}>
        <div style={{ fontSize: 30 }}>⚠️</div>

        <div>
          <strong>Unable to load orchestration data</strong>
          <p style={{ margin: "5px 0 12px" }}>{error}</p>

          <button
            onClick={loadData}
            style={styles.retryButton}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div style={styles.header}>

        <div>
          <div style={styles.eyebrow}>
            RECONCILIATION INTELLIGENCE
          </div>

          <div style={styles.titleRow}>
            <div style={styles.titleIcon}>🎯</div>

            <div>
              <h1 style={styles.title}>
                Orchestration
              </h1>

              <p style={styles.subtitle}>
                The decision engine behind every reconciliation.
              </p>
            </div>
          </div>
        </div>

        <div style={styles.headerActions}>

          <button
            onClick={runDemo}
            style={{
              ...styles.demoButton,
              opacity: demoRunning ? 0.7 : 1,
            }}
            disabled={demoRunning}
          >
            {demoRunning
              ? "Running..."
              : "▶ Run orchestration"}
          </button>

          <button
            onClick={loadData}
            style={styles.refreshButton}
          >
            ↻
          </button>

        </div>
      </div>


      {/* ======================================================
          KEY METRICS
      ====================================================== */}

      <div style={styles.metricGrid}>

        <Metric
          label="Transactions Orchestrated"
          value={totalAttempts}
          icon="📊"
          sub="Total routing attempts"
        />

        <Metric
          label="Automatically Resolved"
          value={totalSuccesses}
          icon="✓"
          sub="Successfully reconciled"
          success
        />

        <Metric
          label="Overall Success"
          value={`${successRate}%`}
          icon="🎯"
          sub="End-to-end orchestration"
          purple
        />

        <Metric
          label="Primary Strategy"
          value={mostUsed?.name || "—"}
          icon={mostUsed?.icon || "🧠"}
          sub={
            mostUsed
              ? `${mostUsed.attempts} transactions`
              : "No activity"
          }
          compact
        />

      </div>


      {/* ======================================================
          MAIN BRAIN SECTION
      ====================================================== */}

      <div style={styles.brainCard}>

        <div style={styles.sectionHeader}>

          <div>
            <div style={styles.sectionEyebrow}>
              🧠 DECISION ENGINE
            </div>

            <h2 style={styles.sectionTitle}>
              How Recon thinks
            </h2>

            <p style={styles.sectionSubtitle}>
              Start cheap and deterministic. Escalate only when
              confidence drops.
            </p>
          </div>

          <button
            onClick={() => setShowFlow(!showFlow)}
            style={styles.smallButton}
          >
            {showFlow ? "Hide flow" : "Show flow"}
          </button>

        </div>


        {showFlow && (
          <>

            {/* FLOW */}

            <div style={styles.flowContainer}>

              {strategies.slice(0, 4).map(
                (strategy, index) => {

                  const active =
                    demoStage === index + 1;

                  const stats =
                    strategyStats?.strategies?.[
                      strategy.id
                    ] || {};

                  const attempts =
                    Number(stats.attempts || 0);

                  return (
                    <React.Fragment key={strategy.id}>

                      <button
                        onClick={() =>
                          setSelectedStrategy(strategy.id)
                        }
                        style={{
                          ...styles.flowNode,
                          borderColor: active
                            ? strategy.color
                            : selectedStrategy ===
                              strategy.id
                            ? strategy.color
                            : "#e2e8f0",
                          background: active
                            ? strategy.bg
                            : "#ffffff",
                          transform: active
                            ? "translateY(-5px)"
                            : "translateY(0)",
                          boxShadow: active
                            ? `0 12px 30px ${strategy.color}25`
                            : selectedStrategy ===
                              strategy.id
                            ? `0 5px 20px ${strategy.color}15`
                            : "none",
                        }}
                      >

                        <div
                          style={{
                            ...styles.flowIcon,
                            background:
                              strategy.bg,
                          }}
                        >
                          {strategy.icon}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={styles.stageLabel}>
                            STAGE {index + 1}
                          </div>

                          <div style={styles.flowName}>
                            {strategy.name}
                          </div>

                          <div style={styles.flowDesc}>
                            {strategy.short}
                          </div>
                        </div>

                        <div style={styles.flowCount}>
                          {attempts}
                        </div>

                      </button>

                      {index < 3 && (
                        <div style={styles.arrow}>
                          →
                        </div>
                      )}

                    </React.Fragment>
                  );
                }
              )}

            </div>


            {/* DECISION BAR */}

            <div style={styles.decisionBar}>

              <div style={styles.decisionIcon}>
                ⚡
              </div>

              <div style={{ flex: 1 }}>
                <strong style={{ color: "#0f172a" }}>
                  Confidence-based escalation
                </strong>

                <div style={styles.decisionText}>
                  A transaction stops as soon as a strategy
                  reaches sufficient confidence.
                </div>
              </div>

              <div style={styles.confidencePills}>
                <span style={styles.confidencePill}>
                  Deterministic ≥95%
                </span>

                <span style={styles.confidencePill}>
                  Adaptive ≥85%
                </span>

                <span style={styles.confidencePill}>
                  AI ≥70%
                </span>
              </div>

            </div>

          </>
        )}

      </div>


      {/* ======================================================
          SELECTED STRATEGY
      ====================================================== */}

      <div
        style={{
          ...styles.detailCard,
          borderColor: selected.color + "40",
        }}
      >

        <div
          style={{
            ...styles.selectedIcon,
            background: selected.bg,
          }}
        >
          {selected.icon}
        </div>

        <div style={{ flex: 1 }}>

          <div style={styles.selectedEyebrow}>
            SELECTED STRATEGY
          </div>

          <div style={styles.selectedTitle}>
            {selected.name}
          </div>

          <div style={styles.selectedDescription}>
            {selected.description}
          </div>

          <div style={styles.tagRow}>

            <span
              style={{
                ...styles.tag,
                color: selected.color,
                background: selected.bg,
              }}
            >
              {selected.advantage}
            </span>

            <span style={styles.tag}>
              Confidence {selected.threshold}
            </span>

          </div>

        </div>


        <div style={styles.selectedStats}>

          <div>
            <div style={styles.statLabel}>
              ATTEMPTS
            </div>

            <div style={styles.statValue}>
              {selectedAttempts}
            </div>
          </div>

          <div>
            <div style={styles.statLabel}>
              SUCCESS
            </div>

            <div
              style={{
                ...styles.statValue,
                color: "#059669",
              }}
            >
              {selectedSuccesses}
            </div>
          </div>

          <div>
            <div style={styles.statLabel}>
              RATE
            </div>

            <div
              style={{
                ...styles.statValue,
                color: selected.color,
              }}
            >
              {selectedRate}%
            </div>
          </div>

        </div>

      </div>


      {/* ======================================================
          STRATEGY PERFORMANCE
      ====================================================== */}

      <div style={styles.performanceCard}>

        <div style={styles.sectionHeader}>

          <div>
            <div style={styles.sectionEyebrow}>
              📈 PERFORMANCE
            </div>

            <h2 style={styles.sectionTitle}>
              Strategy performance
            </h2>
          </div>

          <div style={styles.liveBadge}>
            <span style={styles.liveDot} />
            LIVE DATA
          </div>

        </div>


        <div style={styles.strategyList}>

          {strategies.map((strategy) => {

            const stats =
              strategyStats?.strategies?.[
                strategy.id
              ] || {};

            const attempts =
              Number(stats.attempts || 0);

            const successes =
              Number(stats.successes || 0);

            const rate =
              Number(stats.success_rate || 0);

            const isSelected =
              selectedStrategy === strategy.id;

            return (
              <button
                key={strategy.id}
                onClick={() =>
                  setSelectedStrategy(strategy.id)
                }
                style={{
                  ...styles.strategyRow,
                  background: isSelected
                    ? strategy.bg
                    : "#fff",
                  borderColor: isSelected
                    ? strategy.color + "55"
                    : "#edf2f7",
                }}
              >

                <div
                  style={{
                    ...styles.strategyIcon,
                    background: strategy.bg,
                  }}
                >
                  {strategy.icon}
                </div>

                <div style={styles.strategyName}>
                  <strong>
                    {strategy.name}
                  </strong>

                  <span>
                    {strategy.short}
                  </span>
                </div>

                <div style={styles.numberCell}>
                  <small>Attempts</small>
                  <strong>{attempts}</strong>
                </div>

                <div style={styles.numberCell}>
                  <small>Successes</small>
                  <strong style={{ color: "#059669" }}>
                    {successes}
                  </strong>
                </div>

                <div style={styles.progressContainer}>

                  <div style={styles.progressHeader}>
                    <span>Success rate</span>
                    <strong>{rate}%</strong>
                  </div>

                  <div style={styles.progressTrack}>

                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.min(
                          Math.max(rate, 0),
                          100
                        )}%`,
                        background: strategy.color,
                      }}
                    />

                  </div>

                </div>

                <div style={styles.chevron}>
                  →
                </div>

              </button>
            );
          })}

        </div>

      </div>


      {/* ======================================================
          AI + OPTIMIZATION
      ====================================================== */}

      <div style={styles.bottomGrid}>

        {/* AI USAGE */}

        <div style={styles.whiteCard}>

          <div style={styles.cardHeader}>

            <div>
              <div style={styles.sectionEyebrow}>
                🤖 AI ROUTING
              </div>

              <h2 style={styles.cardTitle}>
                Decision mix
              </h2>
            </div>

            <div style={styles.aiIcon}>
              ✨
            </div>

          </div>


          <div style={styles.modelList}>

            {modelUsage?.model_distribution?.map(
              (model) => {

                const percentage =
                  Number(model.percentage || 0);

                return (
                  <div
                    key={model.model}
                    style={styles.modelRow}
                  >

                    <div style={styles.modelTop}>

                      <span
                        style={{
                          textTransform: "capitalize",
                          fontWeight: 600,
                        }}
                      >
                        {model.model}
                      </span>

                      <span>
                        {model.count} ·{" "}
                        {percentage}%
                      </span>

                    </div>

                    <div style={styles.modelTrack}>

                      <div
                        style={{
                          ...styles.modelFill,
                          width: `${percentage}%`,
                        }}
                      />

                    </div>

                  </div>
                );
              }
            )}

          </div>


          <div style={styles.totalDecision}>

            <span>Total AI decisions</span>

            <strong>
              {modelUsage?.total_decisions || 0}
            </strong>

          </div>

        </div>


        {/* OPTIMIZATION */}

        <div style={styles.optimizationCard}>

          <div style={styles.cardHeader}>

            <div>
              <div style={styles.sectionEyebrow}>
                ⚡ EFFICIENCY
              </div>

              <h2 style={styles.cardTitle}>
                AI optimization
              </h2>
            </div>

            <div style={styles.savingsBadge}>
              SAVING
            </div>

          </div>


          <div style={styles.savingsGrid}>

            <MiniStat
              label="LLM calls avoided"
              value={
                strategyStats?.optimization
                  ?.llm_cache_hits_prevented || 0
              }
              icon="🚫"
            />

            <MiniStat
              label="Tokens saved"
              value={
                strategyStats?.optimization
                  ?.token_reduction_estimate || "0"
              }
              icon="🪙"
            />

            <MiniStat
              label="Cost savings"
              value={
                strategyStats?.optimization
                  ?.cost_savings_estimate || "$0"
              }
              icon="💰"
            />

            <MiniStat
              label="LLM reduction"
              value={
                strategyStats?.optimization
                  ?.llm_calls_reduced_by || "0"
              }
              icon="📉"
            />

          </div>


          <div style={styles.optimizationInsight}>

            <span>💡</span>

            <div>
              <strong>
                Smart routing = lower AI cost
              </strong>

              <p>
                Recon avoids sending easy transactions
                to the LLM and escalates only ambiguous
                cases.
              </p>
            </div>

          </div>

        </div>

      </div>


      {/* ======================================================
          JUDGE TAKEAWAY
      ====================================================== */}

      <div style={styles.judgeCard}>

        <div style={styles.judgeIcon}>
          🧠
        </div>

        <div style={{ flex: 1 }}>

          <div style={styles.judgeLabel}>
            THE KEY IDEA
          </div>

          <h2 style={styles.judgeTitle}>
            Don't use AI for everything.
            <span>
              Use AI when it matters.
            </span>
          </h2>

          <p style={styles.judgeText}>
            Recon starts with deterministic rules, learns from
            transaction patterns, and escalates ambiguous cases
            to AI. This gives finance teams a faster and more
            cost-efficient reconciliation engine.
          </p>

        </div>

        <div style={styles.judgeFlow}>
          <span>Rules</span>
          <b>→</b>
          <span>Patterns</span>
          <b>→</b>
          <span>AI</span>
        </div>

      </div>

    </div>
  );
}


/* ================================================================
   SMALL COMPONENTS
================================================================ */

function Metric({
  label,
  value,
  icon,
  sub,
  success,
  purple,
  compact,
}) {
  return (
    <div style={styles.metricCard}>

      <div style={styles.metricTop}>

        <div>
          <div style={styles.metricLabel}>
            {label}
          </div>

          <div
            style={{
              ...styles.metricValue,
              ...(compact
                ? { fontSize: 20 }
                : {}),
            }}
          >
            {value}
          </div>

          <div style={styles.metricSub}>
            {sub}
          </div>
        </div>

        <div
          style={{
            ...styles.metricIcon,
            background: success
              ? "#ecfdf5"
              : purple
              ? "#f5f3ff"
              : "#eff6ff",
          }}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}


function MiniStat({ label, value, icon }) {
  return (
    <div style={styles.miniStat}>

      <div style={styles.miniIcon}>
        {icon}
      </div>

      <div>
        <div style={styles.miniLabel}>
          {label}
        </div>

        <div style={styles.miniValue}>
          {value}
        </div>
      </div>

    </div>
  );
}


/* ================================================================
   STYLES
================================================================ */

const styles = {
  page: {
    padding: "28px",
    background: "#f7f9fc",
    minHeight: "100%",
    color: "#0f172a",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },

  loadingPage: {
    minHeight: 500,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    fontSize: 14,
  },

  spinner: {
    width: 38,
    height: 38,
    border: "4px solid #e2e8f0",
    borderTop: "4px solid #4f46e5",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },

  errorBox: {
    margin: 28,
    padding: 22,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 14,
    display: "flex",
    gap: 15,
    color: "#991b1b",
  },

  retryButton: {
    border: 0,
    background: "#dc2626",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 7,
    cursor: "pointer",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 24,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "1.4px",
    color: "#64748b",
    marginBottom: 8,
  },

  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  titleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  title: {
    margin: 0,
    fontSize: 27,
    letterSpacing: "-0.7px",
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  headerActions: {
    display: "flex",
    gap: 9,
  },

  demoButton: {
    border: 0,
    background:
      "linear-gradient(135deg, #4f46e5, #6366f1)",
    color: "#fff",
    padding: "11px 17px",
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    boxShadow: "0 5px 15px rgba(79,70,229,.18)",
  },

  refreshButton: {
    width: 42,
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 9,
    fontSize: 20,
    color: "#475569",
    cursor: "pointer",
  },

  metricGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 13,
    marginBottom: 18,
  },

  metricCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 13,
    padding: 17,
    boxShadow: "0 2px 8px rgba(15,23,42,.025)",
  },

  metricTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
  },

  metricLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: ".7px",
    textTransform: "uppercase",
  },

  metricValue: {
    marginTop: 7,
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: "-.5px",
  },

  metricSub: {
    marginTop: 3,
    color: "#94a3b8",
    fontSize: 11,
  },

  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
  },

  brainCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 15,
    boxShadow: "0 4px 15px rgba(15,23,42,.035)",
  },

  sectionHeader: {
    padding: "19px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
  },

  sectionEyebrow: {
    fontSize: 9,
    letterSpacing: "1.2px",
    fontWeight: 800,
    color: "#64748b",
    marginBottom: 5,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 19,
    letterSpacing: "-.3px",
  },

  sectionSubtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 12,
  },

  smallButton: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    padding: "7px 11px",
    borderRadius: 7,
    color: "#475569",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  },

  flowContainer: {
    padding: "5px 20px 20px",
    display: "flex",
    alignItems: "stretch",
    gap: 8,
  },

  flowNode: {
    flex: 1,
    minWidth: 0,
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 13,
    display: "flex",
    alignItems: "center",
    gap: 10,
    textAlign: "left",
    cursor: "pointer",
    transition: "all .25s ease",
  },

  flowIcon: {
    width: 37,
    height: 37,
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    flexShrink: 0,
  },

  stageLabel: {
    fontSize: 8,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: ".8px",
  },

  flowName: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: 750,
    color: "#0f172a",
  },

  flowDesc: {
    marginTop: 2,
    fontSize: 9,
    color: "#94a3b8",
  },

  flowCount: {
    fontSize: 14,
    fontWeight: 800,
    color: "#94a3b8",
  },

  arrow: {
    alignSelf: "center",
    color: "#cbd5e1",
    fontSize: 19,
    fontWeight: 700,
  },

  decisionBar: {
    margin: "0 20px 20px",
    padding: "11px 13px",
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: 11,
  },

  decisionIcon: {
    width: 31,
    height: 31,
    borderRadius: 8,
    background: "#fff7ed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  decisionText: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 10,
  },

  confidencePills: {
    display: "flex",
    gap: 5,
    flexWrap: "wrap",
  },

  confidencePill: {
    padding: "5px 7px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    fontSize: 8,
    fontWeight: 700,
    color: "#64748b",
  },

  detailCard: {
    background: "#fff",
    border: "1px solid",
    borderRadius: 14,
    padding: 18,
    marginBottom: 15,
    display: "flex",
    alignItems: "center",
    gap: 14,
    transition: "all .2s ease",
  },

  selectedIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  selectedEyebrow: {
    fontSize: 8,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: "1px",
  },

  selectedTitle: {
    fontSize: 18,
    fontWeight: 800,
    marginTop: 2,
  },

  selectedDescription: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 3,
    maxWidth: 600,
  },

  tagRow: {
    display: "flex",
    gap: 6,
    marginTop: 8,
  },

  tag: {
    padding: "4px 7px",
    borderRadius: 20,
    background: "#f1f5f9",
    color: "#64748b",
    fontSize: 9,
    fontWeight: 700,
  },

  selectedStats: {
    display: "flex",
    gap: 28,
    paddingLeft: 20,
    borderLeft: "1px solid #e2e8f0",
  },

  statLabel: {
    fontSize: 8,
    color: "#94a3b8",
    fontWeight: 800,
    letterSpacing: ".6px",
  },

  statValue: {
    marginTop: 3,
    fontSize: 20,
    fontWeight: 800,
  },

  performanceCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 15,
    marginBottom: 15,
    overflow: "hidden",
  },

  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 8px",
    borderRadius: 20,
    background: "#ecfdf5",
    color: "#059669",
    fontSize: 8,
    fontWeight: 800,
  },

  liveDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#10b981",
  },

  strategyList: {
    padding: "0 14px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  strategyRow: {
    width: "100%",
    border: "1px solid",
    borderRadius: 10,
    padding: "10px 11px",
    display: "flex",
    alignItems: "center",
    gap: 11,
    textAlign: "left",
    cursor: "pointer",
    transition: "all .2s ease",
  },

  strategyIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
  },

  strategyName: {
    width: 150,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 11,
  },

  numberCell: {
    width: 70,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  numberCellSmall: {
    fontSize: 8,
  },

  numberCell: {
    width: 75,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  progressContainer: {
    flex: 1,
  },

  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#94a3b8",
    marginBottom: 4,
  },

  progressTrack: {
    height: 6,
    background: "#f1f5f9",
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 10,
    transition: "width .5s ease",
  },

  chevron: {
    color: "#cbd5e1",
    fontSize: 15,
  },

  bottomGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 15,
    marginBottom: 15,
  },

  whiteCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 15,
    padding: 19,
  },

  optimizationCard: {
    background:
      "linear-gradient(135deg, #ecfdf5 0%, #f8fafc 100%)",
    border: "1px solid #bbf7d0",
    borderRadius: 15,
    padding: 19,
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  cardTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
  },

  aiIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  savingsBadge: {
    padding: "5px 8px",
    background: "#dcfce7",
    color: "#15803d",
    borderRadius: 20,
    fontSize: 8,
    fontWeight: 800,
  },

  modelList: {
    display: "flex",
    flexDirection: "column",
    gap: 13,
  },

  modelRow: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    fontSize: 10,
    color: "#64748b",
  },

  modelTop: {
    display: "flex",
    justifyContent: "space-between",
  },

  modelTrack: {
    height: 7,
    background: "#f1f5f9",
    borderRadius: 10,
    overflow: "hidden",
  },

  modelFill: {
    height: "100%",
    background:
      "linear-gradient(90deg, #6366f1, #8b5cf6)",
    borderRadius: 10,
    transition: "width .5s ease",
  },

  totalDecision: {
    marginTop: 18,
    paddingTop: 13,
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#64748b",
  },

  savingsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },

  miniStat: {
    background: "rgba(255,255,255,.8)",
    border: "1px solid #d1fae5",
    borderRadius: 9,
    padding: 10,
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  miniIcon: {
    width: 27,
    height: 27,
    borderRadius: 7,
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
  },

  miniLabel: {
    fontSize: 8,
    color: "#64748b",
  },

  miniValue: {
    fontSize: 16,
    fontWeight: 800,
    color: "#047857",
    marginTop: 2,
  },

  optimizationInsight: {
    display: "flex",
    gap: 9,
    marginTop: 12,
    padding: 10,
    background: "rgba(220,252,231,.65)",
    borderRadius: 9,
    fontSize: 10,
    color: "#166534",
  },



  judgeCard: {
    background:
      "linear-gradient(135deg, #111827, #1e293b)",
    color: "#fff",
    borderRadius: 15,
    padding: "20px 22px",
    display: "flex",
    alignItems: "center",
    gap: 15,
    boxShadow: "0 10px 30px rgba(15,23,42,.12)",
  },

  judgeIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    background: "rgba(255,255,255,.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 21,
    flexShrink: 0,
  },

  judgeLabel: {
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "1.2px",
    color: "#94a3b8",
  },

  judgeTitle: {
    margin: "4px 0",
    fontSize: 19,
    letterSpacing: "-.3px",
  },

  judgeTitleSpan: {
    color: "#a5b4fc",
  },

  judgeText: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 1.6,
    maxWidth: 680,
  },

  judgeFlow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "9px 12px",
    background: "rgba(255,255,255,.06)",
    borderRadius: 9,
    fontSize: 10,
    color: "#e2e8f0",
    whiteSpace: "nowrap",
  },
};