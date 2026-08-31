# Orchestration Agent - System Architecture

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  App.jsx - Main Application                                   │    │
│  │  ├─ Tabs: [Matches] [Tax Matches] [Orchestration] [Exceptions]│    │
│  │  └─ State: matches, exceptions, auditLog                      │    │
│  └────────────────────────────────────────────────────────────────┘    │
│         ↑                    ↑                    ↑                     │
│         │                    │                    │                     │
│  ┌──────┴──┐      ┌──────────┴─────┐   ┌────────┴────────────┐        │
│  │Matches  │      │  TaxMatches    │   │OrchestrationInsights│       │
│  │Table    │      │  Component     │   │   Component         │       │
│  └──────┬──┘      └────────┬───────┘   └────────┬────────────┘       │
│         │                   │                    │                     │
└─────────┼───────────────────┼────────────────────┼─────────────────────┘
          │                   │                    │
          └─────────────┬─────┴─────────┬──────────┘
                        ↓               ↓
                    API Calls    ┌──────────────────┐
                                 │  api.js          │
                                 ├─ Base URL        │
                                 ├─ Methods         │
                                 └─ Error handling  │
                                        ↓
              ┌─────────────────────────┼──────────────────────┐
              │                         │                      │
              ↓                         ↓                      ↓
    /reconcile          /orchestration/strategy-stats  /orchestration/model-usage
              │                         │                      │
              └─────────────┬───────────┴──────────┬───────────┘
                            ↓                      ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND (main.py)                            │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Endpoints:                                                     │    │
│  │ ├─ POST /reconcile              → run_reconciliation()        │    │
│  │ ├─ GET /orchestration/strategy-stats → get_strategy_stats()  │    │
│  │ ├─ GET /orchestration/model-usage   → get_model_usage()     │    │
│  │ └─ ... (other endpoints)                                      │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                            ↓                                            │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Orchestration Layer                                            │    │
│  │ (matching_engine.py)                                           │    │
│  │                                                                │    │
│  │ run_reconciliation()                                           │    │
│  │ ├─ Calls: run_tier1()                                         │    │
│  │ ├─ Calls: run_split_match()                                   │    │
│  │ ├─ Calls: run_tier2()                                         │    │
│  │ ├─ Calls: run_tax_match()                                     │    │
│  │ └─ Returns: summary with orchestration stats                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                            ↓                                            │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ ReconciliationOrchestrator                                     │    │
│  │ (orchestration_agent.py)                                       │    │
│  │                                                                │    │
│  │ orchestrate(context: ReconciliationContext)                   │    │
│  │ ├─ try_deterministic()  → confidence ≥ 95% → return          │    │
│  │ ├─ try_adaptive()       → confidence ≥ 85% → return          │    │
│  │ ├─ try_llm_fuzzy()      → confidence ≥ 70% → return          │    │
│  │ ├─ try_hybrid()         → best effort       → return          │    │
│  │ └─ try_tax_match()      → special case      → return          │    │
│  │                                                                │    │
│  │ get_strategy_stats()    → performance metrics                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                            ↓                                            │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ AI Model Providers                                             │    │
│  │ ├─ Gemini (genai client)                                       │    │
│  │ ├─ Local (pattern matching)                                    │    │
│  │ └─ Fallback (deterministic logic)                              │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                            ↓                                            │
└─────────────────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
   ┌─────────────┐                    ┌──────────────────┐
   │  SQLite DB  │                    │  Gemini API      │
   │ (recon.db)  │                    │  (genai)         │
   │             │                    │                  │
   │ Tables:     │                    │ - LLM Fuzzy      │
   │ ├─ bank     │                    │ - Descriptions   │
   │ ├─ ledger   │                    │ - References     │
   │ ├─ settle   │                    │ - Context        │
   │ ├─ tax      │                    │                  │
   │ ├─ matches  │                    └──────────────────┘
   │ └─ audit    │
   └─────────────┘
```

---

## 🔄 Data Flow Sequence

```
1. USER ACTION
   └─> Click "Reconcile" button
   
2. FRONTEND CALL
   └─> api.reconcile()
   └─> POST /reconcile
   
3. BACKEND PROCESSING
   └─> main.py: reconcile() endpoint
   └─> matching_engine.run_reconciliation()
   └─> For each bank transaction:
       ├─> Create ReconciliationContext
       ├─> Call orchestrator.orchestrate(context)
       ├─> Get MatchDecision
       └─> Store in database

4. ORCHESTRATOR DECISION TREE
   ┌─> orchestrate(context)
   │
   ├─→ Try Deterministic
   │   ├─ Check: amount ≤ ₹0.01 difference
   │   ├─ Check: date ≤ 3 days drift
   │   └─ If PASS: return MatchDecision(matched=true, confidence=85-100%)
   │
   ├─→ Try Adaptive
   │   ├─ Check: fee deduction pattern
   │   ├─ Check: settlement delay pattern
   │   └─ If MATCH: return MatchDecision(matched=true, confidence=75-90%)
   │
   ├─→ Try LLM Fuzzy (if Gemini available)
   │   ├─ Call: Gemini API with prompt
   │   ├─ Analyze: descriptions, references, amounts
   │   └─ If MATCH: return MatchDecision(matched=true, confidence=50-80%)
   │
   ├─→ Try Hybrid
   │   ├─ Score: amount variance
   │   ├─ Score: date drift
   │   ├─ Combine: weighted average
   │   └─ If ≥60%: return MatchDecision(matched=true, confidence=60%)
   │
   └─→ Return final MatchDecision

5. RESULT STORAGE
   └─> Insert into matches table:
       ├─ match_id (UUID)
       ├─ bank_id, ledger_id, settlement_id, tax_id
       ├─ match_tier (from strategy)
       ├─ confidence (from decision)
       ├─ reason (from decision)
       ├─ strategy (DETERMINISTIC, ADAPTIVE, etc.)
       └─ timestamp

6. STATISTICS COLLECTION
   └─> Update strategy_stats in orchestrator:
       ├─ deterministic: +1 attempt, +1 success
       ├─ adaptive: +0 attempt
       ├─ llm_fuzzy: +0 attempt
       ├─ hybrid: +0 attempt
       └─ success_rate = successes / attempts

7. RESPONSE TO FRONTEND
   └─> Return summary:
       ├─ Total matches found
       ├─ Exceptions flagged
       ├─ Strategy performance stats
       └─ Confidence distribution

8. FRONTEND UPDATE
   └─> Update state with results
   └─> Render:
       ├─ Matches table with strategy column
       ├─ Tax matches (if any)
       ├─ Orchestration dashboard with charts
       └─ Exceptions for manual review
```

---

## 🎯 Strategy Selection Logic

```
                    Input: ReconciliationContext
                             (bank + ledger + settlement + tax)
                                     ↓
                    ┌─────────────────────────────────┐
                    │ Has settlement record?          │
                    └──────┬──────────────────┬────────┘
                           │ NO               │ YES
                           ↓                  ↓
                    Deterministic        Check Patterns
                    Only                 (Adaptive)
                           │                  │
                    ┌──────┴──────────────────┴──────┐
                    ↓                                ↓
              Exact Match?                  Pattern Found?
         (amount + date both OK)         (fee or delay pattern)
              /          \                     /         \
            YES           NO                YES           NO
            ↓              ↓                 ↓             ↓
         RETURN      Continue          RETURN      Continue to
       (Deterministic)  ↓              (Adaptive)   LLM/Hybrid
                        │                           ↓
                        └───────────────┬───────────┘
                                        ↓
                    ┌─────────────────────────────────┐
                    │ Gemini API available?           │
                    └──────┬──────────────────┬────────┘
                           │ YES              │ NO
                           ↓                  ↓
                        LLM Fuzzy         Hybrid Scoring
                           │                  │
                    ┌──────┴──────────────────┴──────┐
                    ↓                                ↓
                 LLM Match?                    Confidence
               /         \                      ≥ 60%?
             YES          NO                    /     \
             ↓             ↓                   YES    NO
          RETURN      Fallback to         RETURN   FLAG FOR
        (LLM Fuzzy)    Hybrid            (Hybrid)  REVIEW
                        ↓
                    Combine Signals
                    ↓
                 Return Decision
```

---

## 📊 Data Structures

### ReconciliationContext
```python
@dataclass
class ReconciliationContext:
    bank_record: Dict[str, Any]           # From bank_txns table
    ledger_record: Dict[str, Any]         # From ledger_txns table
    settlement_record: Optional[Dict]     # From settlement_txns table
    tax_record: Optional[Dict]            # From tax_txns table
    amount_diff: float                    # Pre-calculated difference
    date_drift: int                       # Pre-calculated days
    confidence_hints: Dict[str, float]    # Prior hints about confidence
```

### MatchDecision
```python
@dataclass
class MatchDecision:
    matched: bool                      # Was it a match?
    confidence: float                  # 0-100 confidence score
    strategy: MatchStrategy            # Which strategy matched
    model: ModelProvider               # Which model provider
    reason: str                        # Human-readable why
    counterfactual: str                # Why boundary conditions mattered
    metadata: Dict[str, Any]           # Strategy-specific details
    
    # Available for database storage
    def to_dict() → Dict
```

### Strategy Statistics
```json
{
  "strategy_name": {
    "attempts": 450,              // Total times tried
    "successes": 420,             // Successful matches
    "success_rate": 93.3,         // Percentage
    "avg_confidence": 91.5,       // Average confidence of successes
    "min_confidence": 85,         // Lowest success confidence
    "max_confidence": 100         // Highest success confidence
  }
}
```

---

## 🔌 Integration Points

### 1. Matching Engine Integration
```python
# backend/matching_engine.py
from orchestration_agent import ReconciliationOrchestrator, ReconciliationContext

# Initialize
orchestrator = get_orchestrator()

# Use in run_reconciliation()
for bank_record in bank_records:
    for ledger_record in ledger_records:
        context = ReconciliationContext(
            bank_record=bank_record,
            ledger_record=ledger_record,
            settlement_record=settlement,
            tax_record=tax,
        )
        decision = orchestrator.orchestrate(context)
        # Store decision in database
```

### 2. API Endpoints
```python
# backend/main.py
@app.get("/orchestration/strategy-stats")
def get_strategy_stats():
    from matching_engine import get_orchestrator
    orch = get_orchestrator()
    return orch.get_strategy_stats()

@app.get("/orchestration/model-usage")
def get_model_usage():
    # Query audit_log for strategy distribution
    # Return model usage percentages
```

### 3. Frontend API Client
```javascript
// frontend/src/api.js
const api = {
    getStrategyStats: () => request("/orchestration/strategy-stats"),
    getModelUsage: () => request("/orchestration/model-usage"),
    // ... other methods
}
```

### 4. Frontend Component
```javascript
// frontend/src/components/OrchestrationInsights.jsx
export default function OrchestrationInsights() {
    const [strategyStats, setStrategyStats] = useState(null)
    const [modelUsage, setModelUsage] = useState(null)
    
    // Fetch on mount
    // Display strategy cards, charts, explanations
}
```

---

## 🔐 Confidence Scoring

```
┌─────────────────────────────────────────┐
│ Confidence Score Interpretation         │
├─────────────────────────────────────────┤
│  95-100% │ Very High   │ Trust completely
│  85-95%  │ High        │ Likely correct
│  75-85%  │ Medium      │ Probably correct
│  60-75%  │ Low         │ Possible match
│  <60%    │ Very Low    │ Flag for review
└─────────────────────────────────────────┘

By Strategy:
├─ Deterministic: 85-100%
├─ Adaptive: 75-90%
├─ LLM Fuzzy: 50-80%
├─ Hybrid: 60-80%
└─ Tax: 85-100%
```

---

## 📈 Performance Timeline

```
Stage 1 (Deterministic)
├─ Time: 1-2ms
├─ Cost: FREE (no API)
├─ Success Rate: 70-80% of all
└─ Impact: Largest batch

Stage 2 (Adaptive)
├─ Time: 5-10ms
├─ Cost: FREE (no API)
├─ Success Rate: 10-15% of all
└─ Impact: Pattern matches

Stage 3 (LLM Fuzzy)
├─ Time: 200-500ms
├─ Cost: ~$0.0001 per call
├─ Success Rate: 5-10% of all
└─ Impact: Ambiguous cases

Stage 4 (Hybrid)
├─ Time: 1ms
├─ Cost: FREE (no API)
├─ Success Rate: 2-5% of all
└─ Impact: Edge cases

Remaining
├─ Status: FLAGGED
├─ Impact: 5-10% for manual review
└─ Next: Human review, learn from resolution
```

---

## 🎓 How It All Works Together

```
1. INITIALIZATION
   └─ Backend starts, creates ReconciliationOrchestrator
   └─ Loads Gemini API key if available
   └─ Initializes strategy_stats tracking

2. USER INITIATES RECONCILIATION
   └─ Frontend: Click "Reconcile" button
   └─ API: POST /reconcile
   └─ Backend: matching_engine.run_reconciliation()

3. ORCHESTRATOR PROCESSES EACH PAIR
   └─ For each (bank, ledger) pair:
      ├─ Create ReconciliationContext
      ├─ Call orchestrator.orchestrate()
      ├─ Orchestrator cascades through strategies
      └─ Get MatchDecision with strategy + confidence

4. STRATEGY CASCADE
   └─ Deterministic (1-2ms)
      └─ If no match: Adaptive (5-10ms)
         └─ If no match: LLM (200-500ms)
            └─ If no match: Hybrid (1ms)
               └─ Return decision

5. STORE RESULTS
   └─ Insert into matches table:
      ├─ match_id
      ├─ transaction IDs
      ├─ matched (true/false)
      ├─ confidence
      ├─ strategy used
      └─ reasoning

6. TRACK STATISTICS
   └─ Update strategy_stats:
      ├─ attempts++
      ├─ successes++ (if matched)
      └─ success_rate = successes/attempts

7. RETURN TO FRONTEND
   └─ Summary with:
      ├─ Total matches found
      ├─ Strategy breakdown
      ├─ Confidence distribution
      └─ Model usage stats

8. FRONTEND DISPLAYS
   └─ Matches tab: List all matches
   └─ Tax tab: Tax-specific matches
   └─ Orchestration tab: Strategy metrics
   └─ Exceptions tab: Flagged for review
```

---

## 🚀 Key Advantages

✅ **Efficient Cascading**: Fast for simple, smart for complex
✅ **Cost Optimized**: 70-80% free deterministic matches
✅ **AI-Powered**: Gemini only when needed
✅ **Auditable**: Every match logged with strategy + reasoning
✅ **Scalable**: Works from 10s to 1000s of transactions
✅ **Resilient**: Falls back gracefully if APIs unavailable
✅ **Measurable**: Dashboard shows strategy effectiveness
✅ **Learnable**: Can adapt thresholds based on performance

---

## 🔍 Debugging Points

To debug orchestration flow, check:

1. **Strategy Selection**: Which strategy was chosen?
   → Check `decision.strategy` in database

2. **Confidence Score**: Was it high enough?
   → Check `decision.confidence` vs threshold

3. **Reasoning**: Why was decision made?
   → Check `decision.reason` in audit_log

4. **Counterfactual**: What would change the decision?
   → Check `decision.counterfactual`

5. **Metadata**: Strategy-specific details?
   → Check `decision.metadata`

6. **Model Used**: Which AI provider?
   → Check `decision.model` (Gemini/Local/Fallback)

---

This architecture enables intelligent, efficient, auditable financial reconciliation at scale!
