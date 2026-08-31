# Orchestration Agent Quickstart

## 🚀 30-Second Overview

The **Multi-Orchestration Agent** automatically chooses the best reconciliation strategy for each transaction:

```
💰 Transaction In
    ↓
🎯 Orchestrator decides best strategy
    ├─ ⚙️ Deterministic? (Fast, 95% confidence)
    ├─ 🎯 Adaptive pattern? (Smart, 85% confidence)
    ├─ 🤖 LLM fuzzy? (Intelligent, 70% confidence)
    └─ 🔀 Hybrid? (Best effort, 60% confidence)
    ↓
✅ Match or 🚩 Flag for review
    ↓
📊 Track strategy performance
```

---

## ⚡ Quick Start

### 1. Start the System

```bash
cd c:\Users\jyoti\recon-agent

# Terminal 1: Backend
cd backend
py main.py

# Terminal 2: Frontend  
cd frontend
npm start
```

### 2. Run Reconciliation

1. Open http://localhost:3000
2. Click **"Reconcile"** button
3. Wait for processing

### 3. View Orchestration Metrics

1. Click **"Orchestration"** tab
2. See which strategies were used
3. Check overall success rate

---

## 📊 Dashboard Overview

### Orchestration Tab Shows:

**Summary Cards:**
- Total Attempts: All decisions made
- Total Successes: Matches found
- Success Rate: %age automated

**Strategy Cards (5 Strategies):**
- ⚙️ **Deterministic**: Exact amount+date matching (fastest)
- 🎯 **Adaptive**: Fee/delay pattern recognition
- 🤖 **LLM Fuzzy**: Gemini AI-powered matching
- 🔀 **Hybrid**: Combined signal scoring
- 💰 **Tax**: Tax calculation verification

**Model Usage Chart:**
Shows which model did the work:
- Deterministic %: No API calls (FREE)
- Adaptive %: Fast patterns
- Gemini %: AI calls (counts toward quota)
- Hybrid %: Signal combination

---

## 🎯 Strategy Details

### Deterministic (⚙️) - Fastest

**When it's used:**
```
Amount difference ≤ ₹0.01 AND Date drift ≤ 3 days
```

**Speed:** 1-2ms
**Cost:** FREE (no API calls)
**Confidence:** 85-100%

**Example:**
```
Bank: ₹1000.00 on 2024-01-15 ✓
Ledger: ₹1000.00 on 2024-01-15 ✓
→ MATCH (Deterministic, 100%)
```

### Adaptive (🎯) - Smart

**When it's used:**
After deterministic fails, recognizes learned patterns:

1. **Fee Deduction**: 
```
Settlement ₹1000 → Bank ₹990 (₹10 fee)
→ MATCH (Adaptive, 90%)
```

2. **Settlement Delay**:
```
Invoice: 2024-01-01
Bank clears: 2024-01-05 (4-day delay)
±3% variance accepted
→ MATCH (Adaptive, 80%)
```

**Speed:** 5-10ms
**Cost:** FREE (no API calls)
**Confidence:** 80-90%

### LLM Fuzzy (🤖) - Intelligent

**When it's used:**
When deterministic & adaptive fail, uses Gemini to:
- Analyze descriptions
- Match fuzzy references
- Detect typos/name variations

**Example:**
```
Bank: "INVOICE 12345 from ACME"
Ledger: "Invoice 12346 - Acme Corp"
→ Gemini detects typo
→ MATCH (LLM, 75%)
```

**Speed:** 200-500ms
**Cost:** ~$0.0001 per call
**Confidence:** 70-80%
**Note:** Only used when needed (not for every transaction)

### Hybrid (🔀) - Best Effort

**When it's used:**
Combines multiple weak signals:
```
Amount variance: 2% → Score 80
Date drift: 2 days → Score 80
Combined: 80% confidence
→ MATCH (Hybrid, 80%)
```

**Speed:** 1ms
**Cost:** FREE
**Confidence:** 60-80%

### Tax (💰) - Specialized

**When it's used:**
Tax records only. Validates:
1. Tax calculation correct (base × rate / 100 = tax ±₹0.10)
2. Invoice associated correctly
3. Date aligned (≤3 days)

**Example:**
```
Base: ₹1000, Rate: 18% (GST)
Expected: ₹180.00
Actual: ₹180.00
→ MATCH (Tax, 100%)
```

**Speed:** <2ms
**Cost:** FREE
**Confidence:** 85-100%

---

## 📈 Understanding Metrics

### Success Rate Formula
```
Success Rate = (Successful Matches / Total Attempts) × 100
```

**Interpretation:**
- 95%+ = Excellent (good data quality)
- 80-95% = Good (some edge cases)
- 70-80% = Fair (needs human review)
- <70% = Poor (investigate data quality)

### Strategy Ranking

**Fastest to Slowest:**
1. ⚙️ Deterministic (1-2ms) ✅
2. 🔀 Hybrid (1ms) ✅
3. 🎯 Adaptive (5-10ms) ✅
4. 💰 Tax (<2ms) ✅
5. 🤖 LLM Fuzzy (200-500ms) 🌐

**Most to Least API Calls:**
1. 🤖 LLM Fuzzy (1 Gemini call each) 📊
2. All others (0 API calls) 🎯

---

## 🔧 API Endpoints

### Get Strategy Stats
```bash
curl http://localhost:8000/orchestration/strategy-stats
```

**Response:**
```json
{
  "strategies": {
    "deterministic": {"attempts": 420, "successes": 420, "success_rate": 100},
    "adaptive": {"attempts": 50, "successes": 45, "success_rate": 90},
    "llm_fuzzy": {"attempts": 20, "successes": 15, "success_rate": 75},
    "hybrid": {"attempts": 30, "successes": 18, "success_rate": 60},
    "tax": {"attempts": 8, "successes": 8, "success_rate": 100}
  },
  "summary": {
    "total_attempts": 528,
    "total_successes": 506,
    "overall_success_rate": 95.8
  }
}
```

### Get Model Usage
```bash
curl http://localhost:8000/orchestration/model-usage
```

**Response:**
```json
{
  "model_distribution": [
    {"model": "deterministic", "count": 420, "percentage": 79.5},
    {"model": "adaptive", "count": 45, "percentage": 8.5},
    {"model": "gemini", "count": 15, "percentage": 2.8},
    {"model": "hybrid", "count": 18, "percentage": 3.4}
  ],
  "total_decisions": 528
}
```

---

## 🐛 Troubleshooting

### Problem: Low Success Rate
**Solution:**
1. Check data quality (amounts, dates)
2. Verify API key if using Gemini
3. Adjust thresholds in `orchestration_agent.py`

### Problem: Gemini Not Being Used
**Solution:**
1. Check GOOGLE_API_KEY is set
2. Verify API quota not exceeded
3. Check logs for errors

### Problem: All Matches Are Deterministic
**Solution:**
This is GOOD! Means:
- High data quality ✅
- No API calls needed ✅
- Fast processing ✅

---

## 💡 Pro Tips

### Tip 1: Monitor Strategy Effectiveness
Check dashboard regularly. If LLM has low success rate, deterministic might be too strict.

### Tip 2: Cost Optimization
- Deterministic matches = Free
- Gemini calls = ~$0.0001 each
- Goal: Keep deterministic at 70-80%, minimize Gemini

### Tip 3: Data Quality First
Best results when:
- Amounts match within ₹0.01
- Dates within 3 days
- Consistent naming (Acme vs ACME)

### Tip 4: Use Tax Strategy
If reconciling tax records:
1. Verify base amounts match invoice
2. Check tax rate is correct
3. Let tax strategy validate calculation

---

## 🚀 Next Steps

### 1. Review Orchestration Guide
See [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md) for detailed architecture

### 2. Tune for Your Data
```python
# Edit backend/orchestration_agent.py thresholds
DETERMINISTIC_THRESHOLD = 95   # Strict
ADAPTIVE_THRESHOLD = 85        # Balanced
LLM_FUZZY_THRESHOLD = 70       # Liberal
```

### 3. Monitor Over Time
- Check metrics weekly
- Track success rate trends
- Adjust thresholds if needed

### 4. Integrate with Workflows
- Auto-flag low-confidence matches
- Route ambiguous to human reviewers
- Track resolution patterns

---

## 📚 Key Concepts

**Cascade Pattern:** Try fast strategies first, use complex ones only when needed

**Confidence Score:** 0-100, higher = more sure about match

**Success Rate:** % of attempts that found matches (not error rate)

**Strategy Selection:** Automatic based on data characteristics

**Graceful Fallback:** Works even if Gemini unavailable

---

## ✅ Success Criteria

When orchestration is working well:
- ✅ Deterministic handles 70-80% of transactions
- ✅ Overall success rate >85%
- ✅ <5% transactions need Gemini
- ✅ All decisions logged with reasoning
- ✅ Dashboard shows clear pattern

---

## 🎓 Learn More

1. **Detailed Guide:** See [ORCHESTRATION_GUIDE.md](ORCHESTRATION_GUIDE.md)
2. **Source Code:** See [backend/orchestration_agent.py](backend/orchestration_agent.py)
3. **Frontend Dashboard:** See [frontend/src/components/OrchestrationInsights.jsx](frontend/src/components/OrchestrationInsights.jsx)
4. **Integration:** See [backend/matching_engine.py](backend/matching_engine.py)

---

## 🤝 Questions?

- **How confident is each match?** Check "Confidence" column in matches table
- **Why did it use that strategy?** Check audit log for reasoning
- **Can I customize strategies?** Yes, edit `orchestration_agent.py`
- **What if Gemini API is down?** Falls back to deterministic/adaptive automatically
- **How much does it cost?** Only ₹0.0001 per match (mostly free deterministic)

---

## 🎉 You're Ready!

Your reconciliation system now has intelligent, multi-strategy matching with:
- ⚙️ Deterministic speed
- 🎯 Adaptive intelligence
- 🤖 LLM sophistication
- 🔀 Hybrid robustness
- 💰 Tax expertise

**Start matching! Click "Reconcile" button in the app.**
