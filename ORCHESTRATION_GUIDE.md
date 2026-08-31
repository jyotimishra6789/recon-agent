# Multi-Orchestration Agent for Financial Reconciliation

## Overview

The **Multi-Orchestration Agent** is an intelligent routing system that coordinates multiple reconciliation strategies to match financial transactions with maximum efficiency and accuracy. It uses a cascade pattern to try the fastest/simplest approach first, then progressively uses more sophisticated AI-powered methods when needed.

**Key Philosophy:** Fast for simple matches, intelligent for complex ones.

---

## Architecture

### Strategy Cascade

The orchestrator uses a **5-stage cascade decision tree**:

```
Stage 1: Deterministic (Exact matching)
├─ Check amount: ≤₹0.01 difference ✓
├─ Check date: ≤3 days drift ✓
└─ Confidence ≥95%? → RETURN MATCH

Stage 2: Adaptive (Pattern-based)
├─ Check fee deduction patterns (1.5-3%)
├─ Check settlement delay patterns (1-5 days)
└─ Confidence ≥85%? → RETURN MATCH

Stage 3: LLM Fuzzy (Gemini-powered)
├─ Analyze descriptions, references
├─ Match typos/formatting differences
└─ Confidence ≥70%? → RETURN MATCH

Stage 4: Hybrid (Signal combination)
├─ Weighted score: amount (50%) + date (50%)
└─ Return best effort decision

Stage 5: Return decision (matched or flagged for review)
```

### Strategy Components

#### 1. Deterministic (⚙️)

**Purpose:** Fast, high-precision matching for straightforward transactions.

**Rules:**
- Amount difference ≤ ₹0.01 (currency rounding tolerance)
- Date window ≤ 3 days
- Both conditions must pass

**Confidence:** 85-100% (depends on date alignment)

**Use Cases:**
- Exact amount matches same day → 100% confidence
- Amount matches with 1-2 day drift → 90-95% confidence
- Amount matches with 3-day drift → 85% confidence

**Example:**
```json
{
  "bank_amount": 1000.00,
  "bank_date": "2024-01-15",
  "ledger_amount": 1000.00,
  "ledger_date": "2024-01-15",
  "result": "MATCHED (Deterministic, 100% confidence)"
}
```

#### 2. Adaptive (🎯)

**Purpose:** Recognize common business patterns that violate exact matching rules.

**Patterns:**

a) **Fee Deduction Pattern**
```
If: settlement.gross_amount - settlement.fee = bank.amount
Then: Match with fee noted
Confidence: 90%
Example: Invoice ₹1000 → Gateway fee ₹15 → Bank receives ₹985
```

b) **Settlement Delay Pattern**
```
If: amount matches within ±3% AND date drift 1-5 days
Then: Likely normal settlement processing
Confidence: 80-85%
Example: Invoice 2024-01-01 → Bank clears 2024-01-05
```

c) **Split Settlement Pattern**
```
If: Multiple settlement legs sum to single bank transaction
Then: Aggregate match
Confidence: 75-85%
```

**Use Cases:**
- E-commerce: Gateway fee detection
- B2B: Inter-account settlement delays
- Multi-leg: Batch processing consolidation

#### 3. LLM Fuzzy (🤖)

**Purpose:** Handle ambiguous cases using AI-powered reasoning.

**Uses Gemini 3.6-Flash Model:**

```python
{
  "inputs": [
    "Bank transaction ref_id, amount, date, description",
    "Ledger entry invoice_id, amount, date, customer_name"
  ],
  "tasks": [
    "Analyze descriptions for semantic similarity",
    "Match partial/typo-containing references", 
    "Detect patterns (invoice numbers, customer names)",
    "Make judgment calls on borderline cases"
  ],
  "output": "Match decision with confidence 0-100"
}
```

**Confidence Ranges:**
- High confidence (75-100): Clear description match, aligned references
- Medium confidence (50-75): Partial matches, minor variations
- Low confidence (<50): Ambiguous or conflicting signals

**Example:**
```
Bank: "INVOICE-12345 from Acme Corp"
Ledger: "Invoice 12346 - ACME Corp"
Result: Potential typo in invoice number (+10% variance)
Decision: Match with 75% confidence
```

**Fallback:** If Gemini API unavailable or fails, cascade continues to Hybrid.

#### 4. Hybrid (🔀)

**Purpose:** Combine multiple weak signals when other strategies fail.

**Scoring:**
```
Amount Score = max(0, 100 - (variance * 1000))
Date Score = max(0, 100 - (drift_days * 10))

Combined Score = (Amount_Score × 0.5) + (Date_Score × 0.5)

Decision = "MATCH" if Combined_Score ≥ 60, else "FLAG"
```

**Example:**
```
Amount variance: 2.5% → Score = 75
Date drift: 4 days → Score = 60
Combined: (75 × 0.5) + (60 × 0.5) = 67.5 → MATCH
```

#### 5. Tax (💰)

**Purpose:** Tax-specific validation with calculation verification.

**Rules:**
```
Validation Checklist:
1. Tax calculation: base_amount × rate / 100 = tax_amount (±₹0.10)
2. Invoice association: tax.invoice_id = ledger.invoice_id
3. Date alignment: date drift ≤ 3 days
4. Tax type validation: GST/VAT/Income_Tax recognized
```

**Example:**
```
Base: ₹1000, Rate: 18% (GST)
Expected Tax: 1000 × 0.18 = ₹180.00
Actual Tax: ₹180.02
Difference: ₹0.02 < ₹0.10 ✓ VERIFIED

Result: Tax match with 100% confidence
```

---

## Performance Metrics

### Per-Strategy Statistics

The orchestrator tracks:

```python
{
  "strategy": {
    "attempts": 42,           # How many times tried
    "successes": 38,          # How many matched
    "success_rate": 90.5,     # Percentage
    "avg_confidence": 91.2,   # Average confidence of successes
  }
}
```

### Expected Performance

**Typical Distribution (100 transactions):**
```
Deterministic: 70-80 matches (1-2ms each, 100% precision)
Adaptive: 10-15 matches (5-10ms each, 85% precision)
LLM Fuzzy: 5-10 matches (200-500ms each, 75% precision)
Hybrid: 2-5 matches (1ms, ~60% precision)
Flagged: 5-10 transactions (manual review)
```

**Cost Analysis:**
- Deterministic: 0 API calls, ~1ms latency
- Adaptive: 0 API calls, ~5ms latency
- LLM Fuzzy: 1 Gemini call (~$0.0001), ~300ms latency
- Hybrid: 0 API calls, ~1ms latency

**Result:** 70-80% of transactions resolved with zero API calls!

---

## API Endpoints

### Get Strategy Statistics

**Endpoint:** `GET /orchestration/strategy-stats`

**Response:**
```json
{
  "timestamp": "2024-01-20T10:30:00Z",
  "strategies": {
    "deterministic": {
      "attempts": 450,
      "successes": 420,
      "success_rate": 93.3
    },
    "adaptive": {
      "attempts": 80,
      "successes": 68,
      "success_rate": 85.0
    },
    "llm_fuzzy": {
      "attempts": 25,
      "successes": 18,
      "success_rate": 72.0
    },
    "hybrid": {
      "attempts": 45,
      "successes": 27,
      "success_rate": 60.0
    },
    "tax": {
      "attempts": 8,
      "successes": 8,
      "success_rate": 100.0
    }
  },
  "summary": {
    "total_attempts": 608,
    "total_successes": 541,
    "overall_success_rate": 88.9
  }
}
```

### Get Model Usage

**Endpoint:** `GET /orchestration/model-usage`

**Response:**
```json
{
  "timestamp": "2024-01-20T10:30:00Z",
  "model_distribution": [
    {
      "model": "deterministic",
      "count": 420,
      "percentage": 69.2
    },
    {
      "model": "adaptive",
      "count": 68,
      "percentage": 11.2
    },
    {
      "model": "gemini",
      "count": 18,
      "percentage": 2.9
    },
    {
      "model": "hybrid",
      "count": 27,
      "percentage": 4.4
    }
  ],
  "total_decisions": 608
}
```

---

## Frontend Dashboard

### Orchestration Insights Tab

**Displays:**

1. **Summary Cards**
   - Total Attempts: All reconciliation decisions attempted
   - Total Successes: Matches found
   - Overall Success Rate: Percentage

2. **Strategy Performance Grid**
   - Individual cards for each strategy
   - Attempts, Successes, Success Rate
   - Color-coded: Green (>80%), Gray (<80%)
   - Visual confidence bar chart

3. **AI Model Usage Distribution**
   - Pie/bar chart of model usage
   - Deterministic %: No API calls needed
   - Adaptive %: Pattern-based (fast)
   - Gemini %: AI-powered matching
   - Hybrid %: Signal combination

4. **Strategy Explanations**
   - Deterministic: Exact matching details
   - Adaptive: Pattern recognition info
   - LLM Fuzzy: Gemini analysis details
   - Hybrid: Signal weighting explanation

5. **How It Works**
   - Visual cascade diagram
   - Confidence thresholds
   - When each strategy activates

---

## Configuration

### Strategy Thresholds

Edit `orchestration_agent.py` to tune:

```python
# Confidence thresholds for returning early
DETERMINISTIC_THRESHOLD = 95      # Must be very sure
ADAPTIVE_THRESHOLD = 85           # Pattern confidence
LLM_FUZZY_THRESHOLD = 70          # AI analysis
HYBRID_THRESHOLD = 60             # Signal combination

# Amount/Date tolerances
AMOUNT_EXACT_TOL = 0.01           # ₹ difference
DATE_WINDOW = 3                   # Days
FEE_TOLERANCE = 0.03              # ±3% for fee patterns
SETTLEMENT_DELAY_WINDOW = 5       # Days
```

### Gemini Configuration

```python
# Environment variables
GOOGLE_API_KEY = "sk-..."
GOOGLE_GENERATIVE_AI_API_KEY = "sk-..."

# Model selection
MODEL = "gemini-3.6-flash"       # Fast, cheap LLM
```

### Fallback Behavior

If Gemini API fails:
1. LLM Fuzzy strategy is skipped
2. Cascade continues to Hybrid
3. System still produces match decision
4. No transaction gets stuck

---

## Usage Example

### Python Integration

```python
from orchestration_agent import ReconciliationOrchestrator, ReconciliationContext

# Initialize orchestrator
orchestrator = ReconciliationOrchestrator()

# Create context
context = ReconciliationContext(
    bank_record={
        "ref_id": "BANK_001",
        "amount": 990.00,
        "txn_date": "2024-01-15",
        "description": "Payment to Acme"
    },
    ledger_record={
        "invoice_id": "INV_001", 
        "amount": 1000.00,
        "invoice_date": "2024-01-15",
        "customer_name": "Acme Corp"
    },
    settlement_record={
        "order_id": "ORD_001",
        "amount": 990.00,
        "settle_date": "2024-01-15",
        "fee": 10.00,
        "gross_amount": 1000.00
    }
)

# Get orchestrated decision
decision = orchestrator.orchestrate(context)

# Handle result
if decision.matched:
    print(f"✅ Matched via {decision.strategy.value}")
    print(f"   Confidence: {decision.confidence}%")
    print(f"   Reason: {decision.reason}")
    print(f"   Metadata: {decision.metadata}")
else:
    print(f"❌ No match")
    print(f"   Reason: {decision.reason}")

# Get statistics
stats = orchestrator.get_strategy_stats()
print(f"Strategy performance: {stats}")
```

### API Integration

```javascript
// Frontend example
async function showOrchestrationMetrics() {
  const stats = await api.getStrategyStats();
  const usage = await api.getModelUsage();
  
  console.log("Strategy Performance:", stats.strategies);
  console.log("Model Usage:", usage.model_distribution);
  console.log("Overall Success Rate:", stats.summary.overall_success_rate + "%");
}
```

---

## Troubleshooting

### Issue: Low Strategy Success Rate

**Check:**
1. Are thresholds too strict? Lower `DETERMINISTIC_THRESHOLD` to 90%
2. Is data quality poor? Run data validation first
3. Are date formats inconsistent? Normalize dates
4. Are amounts including/excluding fees inconsistently? Audit data source

### Issue: Gemini API Unavailable

**Behavior:** System falls back to Hybrid matching (works but less intelligent)

**Fix:**
1. Check GOOGLE_API_KEY environment variable
2. Verify API quota not exceeded
3. Check internet connectivity
4. Review Gemini API status page

**Fallback Status:**
```json
{
  "matched": false,
  "strategy": "hybrid",
  "model": "fallback",
  "reason": "Gemini API not configured",
  "confidence": 45
}
```

### Issue: Cascading Only to Deterministic

**Likely Cause:** Data quality too strict, or deterministic matching rate artificially high

**Debug:**
1. Check `AMOUNT_EXACT_TOL` setting (increase from 0.01 to 0.05)
2. Check `DATE_WINDOW` setting (increase from 3 to 5 days)
3. Run statistics: How many "false negatives" in deterministic?

---

## Performance Tuning

### Optimize for Speed

```python
# Skip expensive strategies
ENABLE_LLM_FUZZY = False          # Disable Gemini calls
DETERMINISTIC_THRESHOLD = 85      # Lower bar for early return
ADAPTIVE_ATTEMPTS_ONLY = True     # Skip to adaptive faster
```

### Optimize for Accuracy

```python
ENABLE_LLM_FUZZY = True           # Use Gemini for all ambiguous
DETERMINISTIC_THRESHOLD = 99      # Very strict deterministic
ADAPTIVE_THRESHOLD = 95           # Strict adaptive
HYBRID_THRESHOLD = 75             # Lower bar for hybrid
```

### Optimize for Cost

```python
# Minimize API calls
DETERMINISTIC_THRESHOLD = 95      # Return fast without API
ADAPTIVE_THRESHOLD = 90           # Use patterns before Gemini
ENABLE_LLM_FUZZY = True           # Use sparingly
# Result: ~70-80% matches without Gemini
```

---

## Metrics to Track

**Key Performance Indicators (KPIs):**

1. **Match Rate:** Matched / Total = % of transactions auto-reconciled
2. **Precision:** True Matches / All Matched = Accuracy of automated matches
3. **Recall:** True Matches / Total Matches = Coverage of correct matches
4. **Time Saved:** (Manual Review Time - Automated Time) × Transaction Count
5. **Cost Per Match:** (API Costs) / Matched Transactions
6. **API Usage:** Gemini calls / Total transactions = Efficiency ratio

**Target Goals:**
```
Match Rate: 90%+ (only 10% need human review)
Precision: 95%+ (minimize false positives)
Recall: 98%+ (catch most real matches)
Cost Per Match: <$0.0001 (mostly free deterministic)
API Usage: 5-10% (reserve Gemini for ambiguous)
```

---

## Advanced Features

### Custom Strategy Implementation

Extend by creating new strategy:

```python
def _try_custom_strategy(self, context: ReconciliationContext) -> MatchDecision:
    """Your custom matching logic here"""
    # Your logic...
    return MatchDecision(
        matched=result,
        confidence=score,
        strategy=MatchStrategy.CUSTOM,
        model=ModelProvider.LOCAL,
        reason="Your explanation",
        counterfactual="Your boundary conditions"
    )
```

### A/B Testing Strategies

Compare which strategy works best for your data:

```python
results = {
    "deterministic": {"successes": 420, "total": 450, "rate": 93.3},
    "adaptive": {"successes": 68, "total": 80, "rate": 85.0},
    "llm_fuzzy": {"successes": 18, "total": 25, "rate": 72.0},
}

# Winner by success rate
best_strategy = max(results, key=lambda x: results[x]["rate"])
print(f"Best strategy: {best_strategy}")
```

### Pattern Learning

Track human resolutions to improve adaptive patterns:

```python
# When human resolves a match:
# 1. Extract pattern (fee amount, date drift, etc.)
# 2. Store in exception_patterns table
# 3. Increase trust_score each time confirmed
# 4. Adaptive strategy learns from corrections
```

---

## Summary

The Multi-Orchestration Agent provides:

✅ **Fast Reconciliation**: 70-80% matches in <2ms via deterministic
✅ **Intelligent Routing**: Automatically escalates complexity
✅ **Cost Optimized**: Minimal API calls (5-10% need Gemini)
✅ **Audit Trail**: Every match includes strategy + reasoning
✅ **Graceful Fallback**: Works even if Gemini unavailable
✅ **Performance Metrics**: Dashboard visibility into strategy effectiveness
✅ **Scalable**: Works from 10s to 1000s of transactions

**Result:** Automated, intelligent financial reconciliation with human-level accuracy and machine-level speed.
