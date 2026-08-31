"""
Matching Engine - Track 04 core logic with Multi-Orchestration Agent

Tier 1: deterministic SQL-based exact matching (amount + date window)
Tier 1.5: adaptive pattern matching using learned patterns
Tier 2: LLM-assisted matching for near-misses
Tier 3: Hybrid approach combining multiple signals

Every decision is written to audit_log with strategy used.
"""

import sqlite3
import json
import os
import time
from datetime import datetime, date
from google import genai
from orchestration_agent import ReconciliationOrchestrator, ReconciliationContext

DB_PATH = os.path.join(os.path.dirname(__file__), "recon.db")
DATE_WINDOW_DAYS = 3          # how far apart dates can be and still be "near"
AMOUNT_EXACT_TOL = 0.01       # rupees - float rounding tolerance for "exact"


def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.row_factory = sqlite3.Row
    return conn


# Global orchestrator instance
orchestrator = None

def get_orchestrator():
    """Get or create global orchestrator instance"""
    global orchestrator
    if orchestrator is None:
        orchestrator = ReconciliationOrchestrator()
    return orchestrator


def log_audit(conn, action, details, tier=None):
    conn.execute(
        "INSERT INTO audit_log (action, details, tier) VALUES (?, ?, ?)",
        (action, json.dumps(details, default=str), tier),
    )


def days_between(d1: str, d2: str) -> int:
    return abs((date.fromisoformat(d1) - date.fromisoformat(d2)).days)


def get_pattern_trust(conn, pattern_type: str):
    """Look up how much the system currently trusts a resolved-exception
    pattern (rises each time a human confirms it again via /resolve)."""
    row = conn.execute(
        "SELECT trust_score, times_seen FROM exception_patterns WHERE pattern_type = ?",
        (pattern_type,),
    ).fetchone()
    return (row["trust_score"], row["times_seen"]) if row else (None, 0)


def counterfactual_note(drift_days: int, fee: float, gross_amount: float | None):
    """
    Explain the BOUNDARY of a match, not just that it matched -- e.g. what
    would have made the system reject it. This is what makes a decision
    'explainable' rather than just 'correct'.
    """
    bits = []
    if drift_days:
        bits.append(f"would have been rejected if settlement drift exceeded {DATE_WINDOW_DAYS} days (actual: {drift_days})")
    if fee and gross_amount:
        fee_pct = fee / gross_amount * 100
        bits.append(f"fee was {fee_pct:.1f}% of gross — flagged if it had exceeded 5%")
    if not bits:
        bits.append(f"exact amount + same-day match — no tolerance was needed")
    return "; ".join(bits)


# ---------------------------------------------------------------------
# TIER 1: exact / near-exact deterministic matching
# ---------------------------------------------------------------------
def run_tier1(conn):
    """
    Try to link bank <-> settlement <-> ledger rows that are an exact
    (or near-exact, within DATE_WINDOW_DAYS) amount + date match.
    Now using ReconciliationOrchestrator for intelligent decision making.
    """
    orchestrator = get_orchestrator()
    bank_rows = conn.execute("SELECT * FROM bank_txns").fetchall()
    settlement_rows = conn.execute("SELECT * FROM settlement_txns").fetchall()
    ledger_rows = conn.execute("SELECT * FROM ledger_txns").fetchall()

    matched_bank_ids, matched_settle_ids, matched_ledger_ids = set(), set(), set()

    for b in bank_rows:
        if b["ref_id"] in matched_bank_ids:
            continue
        # find a settlement row with matching amount within date window
        best_s = None
        for s in settlement_rows:
            if s["order_id"] in matched_settle_ids:
                continue
            if abs(s["amount"] - b["amount"]) <= AMOUNT_EXACT_TOL and \
               days_between(b["txn_date"], s["settle_date"]) <= DATE_WINDOW_DAYS:
                best_s = s
                break
        if not best_s:
            continue

        best_l = None
        # ledger typically books the GROSS amount, so check both gross and net
        for l in ledger_rows:
            if l["invoice_id"] in matched_ledger_ids:
                continue
            candidate_amounts = [best_s["amount"], best_s["gross_amount"] or best_s["amount"]]
            if any(abs(l["amount"] - amt) <= AMOUNT_EXACT_TOL for amt in candidate_amounts) and \
               days_between(b["txn_date"], l["invoice_date"]) <= DATE_WINDOW_DAYS:
                best_l = l
                break
        if not best_l:
            continue

        # Use orchestrator to make the decision
        context = ReconciliationContext(
            bank_record=dict(b),
            ledger_record=dict(best_l),
            settlement_record=dict(best_s) if best_s else None,
        )
        decision = orchestrator.orchestrate(context)
        
        if not decision.matched:
            continue

        # Store with strategy metadata
        conn.execute(
            """INSERT INTO matches (bank_ref_id, order_id, invoice_id, match_amount,
               confidence_score, match_tier, match_type, strategy, model, reason, counterfactual)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (b["ref_id"], best_s["order_id"], best_l["invoice_id"], b["amount"],
             decision.confidence, "tier1_exact", "one_to_one", 
             decision.strategy.value, decision.model.value,
             decision.reason, decision.counterfactual),
        )
        log_audit(conn, "match_success",
                  {"bank": b["ref_id"], "order": best_s["order_id"], "invoice": best_l["invoice_id"],
                   "confidence": decision.confidence, "strategy": decision.strategy.value, 
                   "reason": decision.reason},
                  tier="tier1_exact")

        matched_bank_ids.add(b["ref_id"])
        matched_settle_ids.add(best_s["order_id"])
        matched_ledger_ids.add(best_l["invoice_id"])

    return matched_bank_ids, matched_settle_ids, matched_ledger_ids


# ---------------------------------------------------------------------
# SPLIT / BATCH SETTLEMENT MATCHING (many-to-one / one-to-many)
# ---------------------------------------------------------------------
def run_split_match(conn, matched_bank_ids, matched_settle_ids, matched_ledger_ids,
                     max_group_size=4, amount_tol=0.02):
    """
    Handles the case most teams won't bother with: a single invoice paid
    in installments (many bank credits -> one ledger entry), or a single
    bank credit that's actually a BATCHED payout covering several
    invoices (one bank credit -> many ledger entries).

    Approach: for each still-unmatched ledger row, look for a small
    combination (2..max_group_size) of unmatched bank rows within a
    nearby date window whose amounts sum to it (within amount_tol). This
    is deliberately bounded (small group size, narrow date window) so it
    stays fast and doesn't produce spurious matches.
    """
    bank_rows = [r for r in conn.execute("SELECT * FROM bank_txns").fetchall()
                 if r["ref_id"] not in matched_bank_ids]
    ledger_rows = [r for r in conn.execute("SELECT * FROM ledger_txns").fetchall()
                   if r["invoice_id"] not in matched_ledger_ids]

    from itertools import combinations

    for l in ledger_rows:
        if l["invoice_id"] in matched_ledger_ids:
            continue
        # candidate pool: unmatched bank rows within a 5-day window of the invoice
        pool = [b for b in bank_rows
                if b["ref_id"] not in matched_bank_ids
                and days_between(b["txn_date"], l["invoice_date"]) <= 5]
        if len(pool) < 2:
            continue

        found_group = None
        for group_size in range(2, min(max_group_size, len(pool)) + 1):
            for combo in combinations(pool, group_size):
                total = sum(b["amount"] for b in combo)
                if abs(total - l["amount"]) <= amount_tol:
                    found_group = combo
                    break
            if found_group:
                break
        if not found_group:
            continue

        confidence = 90  # slightly below a clean 1:1 match — combinatorial matches carry more risk
        member_refs = ", ".join(b["ref_id"] for b in found_group)
        reason = f"Split settlement: {len(found_group)} bank credits ({member_refs}) sum to invoice amount"
        cf_note = (f"would have been rejected if the {len(found_group)}-way sum differed "
                   f"by more than ₹{amount_tol:.2f}, or any leg fell outside a 5-day window")

        cur = conn.execute(
            """INSERT INTO matches (bank_ref_id, order_id, invoice_id, match_amount,
               confidence_score, match_tier, match_type, strategy, model, reason, counterfactual)
               VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (l["invoice_id"], l["amount"], confidence, "tier1_split", "many_to_one", 
             "adaptive", "fallback", reason, cf_note),
        )
        match_id = cur.lastrowid
        for b in found_group:
            conn.execute(
                "INSERT INTO match_members (match_id, source_table, source_ref, amount) VALUES (?, 'bank', ?, ?)",
                (match_id, b["ref_id"], b["amount"]),
            )
            matched_bank_ids.add(b["ref_id"])
        conn.execute(
            "INSERT INTO match_members (match_id, source_table, source_ref, amount) VALUES (?, 'ledger', ?, ?)",
            (match_id, l["invoice_id"], l["amount"]),
        )
        matched_ledger_ids.add(l["invoice_id"])

        log_audit(conn, "match_success",
                  {"invoice": l["invoice_id"], "members": member_refs, "confidence": confidence, "reason": reason},
                  tier="tier1_split")

    return matched_bank_ids, matched_settle_ids, matched_ledger_ids


# ---------------------------------------------------------------------
# TIER 2: LLM-assisted matching for leftovers (bounded, structured output)
# ---------------------------------------------------------------------
TIER2_SYSTEM_PROMPT = """You are a financial reconciliation assistant. You will be given
ONE unmatched bank transaction and a short list of candidate ledger/settlement records.
Decide if any candidate is very likely the SAME underlying transaction, accounting only for:
- payment gateway fee deductions (typically 1.5-3% of the gross amount)
- settlement timing delays (1-3 days)
- minor rounding/typo differences (a few rupees)

Respond with ONLY a JSON object, no other text:
{"match_index": <int index of the matching candidate, or -1 if none>,
 "confidence": <int 0-100>,
 "reason": "<one short sentence explaining the decision>"}

If nothing is a plausible match, return match_index -1 with confidence 0.
Never invent a match you are not reasonably confident about.
"""


def call_llm_for_match(bank_row, candidates):
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    candidate_desc = "\n".join(
        f"[{i}] amount=₹{c['amount']}, date={c.get('invoice_date') or c.get('settle_date')}, "
        f"id={c.get('invoice_id') or c.get('order_id')}"
        for i, c in enumerate(candidates)
    )
    user_prompt = (
        f"Bank transaction: amount=₹{bank_row['amount']}, date={bank_row['txn_date']}, "
        f"ref={bank_row['ref_id']}\n\nCandidates:\n{candidate_desc}"
    )
    resp = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=TIER2_SYSTEM_PROMPT + "\n" + user_prompt,
    )
    text = resp.text.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"match_index": -1, "confidence": 0, "reason": "LLM response unparseable"}


def run_tier2(conn, matched_bank_ids, matched_settle_ids, matched_ledger_ids):
    bank_rows = [r for r in conn.execute("SELECT * FROM bank_txns").fetchall()
                 if r["ref_id"] not in matched_bank_ids]
    ledger_rows = [r for r in conn.execute("SELECT * FROM ledger_txns").fetchall()
                   if r["invoice_id"] not in matched_ledger_ids]
    settlement_rows = [r for r in conn.execute("SELECT * FROM settlement_txns").fetchall()
                       if r["order_id"] not in matched_settle_ids]

    for b in bank_rows:
        if b["ref_id"] in matched_bank_ids:
            continue
        # Keep a plausible settlement leg with a fuzzy bank-to-ledger match.
        settlement_candidates = [
            s for s in settlement_rows
            if s["order_id"] not in matched_settle_ids
            and abs(s["amount"] - b["amount"]) / max(b["amount"], 1) < 0.06
            and days_between(b["txn_date"], s["settle_date"]) <= 5
        ]
        best_settlement = min(
            settlement_candidates,
            key=lambda s: (abs(s["amount"] - b["amount"]), days_between(b["txn_date"], s["settle_date"])),
            default=None,
        )

        # candidate pool: ledger rows within +/- ~5% amount and +/-5 days
        candidates = [
            l for l in ledger_rows
            if l["invoice_id"] not in matched_ledger_ids
            and abs(l["amount"] - b["amount"]) / max(b["amount"], 1) < 0.06
            and days_between(b["txn_date"], l["invoice_date"]) <= 5
        ]
        if not candidates:
            continue

        try:
            result = call_llm_for_match(b, [dict(c) for c in candidates])
        except Exception as e:
            # LLM unavailable/misconfigured (e.g. missing API key) — degrade
            # gracefully to "unresolved" rather than crashing the whole run.
            log_audit(conn, "match_attempt",
                      {"bank": b["ref_id"], "error": str(e)}, tier="tier2_llm")
            continue
        log_audit(conn, "match_attempt",
                  {"bank": b["ref_id"], "candidates": [c["invoice_id"] for c in candidates],
                   "llm_result": result}, tier="tier2_llm")

        if result.get("match_index", -1) == -1 or result.get("confidence", 0) < 60:
            continue

        matched_l = candidates[result["match_index"]]
        cf_note = (f"would have been rejected below 60% LLM confidence "
                   f"or if amount diverged beyond ~6% (actual model confidence: {result['confidence']}%)")
        conn.execute(
            """INSERT INTO matches (bank_ref_id, order_id, invoice_id, match_amount,
               confidence_score, match_tier, match_type, strategy, model, reason, counterfactual)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (b["ref_id"], best_settlement["order_id"] if best_settlement else None,
             matched_l["invoice_id"], b["amount"],
             result["confidence"], "tier2_llm", "one_to_one", "llm_fuzzy", "gemini", 
             result["reason"], cf_note),
        )
        log_audit(conn, "match_success",
                  {"bank": b["ref_id"], "invoice": matched_l["invoice_id"],
                   "confidence": result["confidence"], "reason": result["reason"]},
                  tier="tier2_llm")
        matched_bank_ids.add(b["ref_id"])
        if best_settlement:
            matched_settle_ids.add(best_settlement["order_id"])
        matched_ledger_ids.add(matched_l["invoice_id"])

    return matched_bank_ids, matched_settle_ids, matched_ledger_ids


# ---------------------------------------------------------------------
# Exception flagging for everything still unmatched
# ---------------------------------------------------------------------
def flag_exceptions(conn, matched_bank_ids, matched_settle_ids, matched_ledger_ids):
    for row in conn.execute("SELECT * FROM bank_txns").fetchall():
        if row["ref_id"] not in matched_bank_ids:
            conn.execute(
                """INSERT INTO exceptions (source_table, source_ref, amount, txn_date, exception_reason)
                   VALUES (?, ?, ?, ?, ?)""",
                ("bank", row["ref_id"], row["amount"], row["txn_date"], "missing_counterpart"),
            )
    for row in conn.execute("SELECT * FROM settlement_txns").fetchall():
        if row["order_id"] not in matched_settle_ids:
            conn.execute(
                """INSERT INTO exceptions (source_table, source_ref, amount, txn_date, exception_reason)
                   VALUES (?, ?, ?, ?, ?)""",
                ("settlement", row["order_id"], row["amount"], row["settle_date"], "missing_counterpart"),
            )
    for row in conn.execute("SELECT * FROM ledger_txns").fetchall():
        if row["invoice_id"] not in matched_ledger_ids:
            conn.execute(
                """INSERT INTO exceptions (source_table, source_ref, amount, txn_date, exception_reason)
                   VALUES (?, ?, ?, ?, ?)""",
                ("ledger", row["invoice_id"], row["amount"], row["invoice_date"], "missing_counterpart"),
            )
    log_audit(conn, "exception_flagged", {"note": "final unresolved sweep complete"})


# ---------------------------------------------------------------------
# TAX MATCHING - Match tax records to invoices and bank transactions
# ---------------------------------------------------------------------
def run_tax_match(conn, matched_tax_ids=None):
    """
    Match tax records (GST, VAT, Income Tax, etc.) to invoices using orchestrator's tax strategy.
    
    Approach:
    - Use orchestrator.try_tax_match() for intelligent validation
    - Verify tax calculation, invoice association, and date alignment
    - Track strategy used for each match
    """
    orchestrator = get_orchestrator()
    if matched_tax_ids is None:
        matched_tax_ids = set()
    
    tax_rows = conn.execute("SELECT * FROM tax_txns").fetchall()
    if not tax_rows:
        return matched_tax_ids
    
    ledger_rows = conn.execute("SELECT * FROM ledger_txns").fetchall()
    ledger_by_id = {l["invoice_id"]: l for l in ledger_rows}
    
    for t in tax_rows:
        if t["tax_id"] in matched_tax_ids:
            continue
        
        # Find corresponding ledger invoice
        ledger = ledger_by_id.get(t["invoice_id"])
        if not ledger:
            log_audit(conn, "match_attempt",
                      {"tax_id": t["tax_id"], "error": "ledger_not_found"}, tier="tier1_tax")
            continue
        
        # Use orchestrator's tax strategy
        context = ReconciliationContext(
            bank_record={},  # Not applicable for tax validation
            ledger_record=dict(ledger),
            tax_record=dict(t),
        )
        decision = orchestrator.try_tax_match(context)
        
        if not decision.matched:
            continue
        
        conn.execute(
            """INSERT INTO matches (tax_id, invoice_id, match_amount, confidence_score, 
               match_tier, match_type, strategy, model, reason, counterfactual)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (t["tax_id"], t["invoice_id"], t["tax_amount"], decision.confidence, 
             "tier1_tax", "tax_match", decision.strategy.value, decision.model.value,
             decision.reason, decision.counterfactual),
        )
        log_audit(conn, "match_success",
                  {"tax_id": t["tax_id"], "invoice_id": t["invoice_id"], 
                   "tax_type": t["tax_type"], "confidence": decision.confidence, 
                   "strategy": decision.strategy.value, "reason": decision.reason},
                  tier="tier1_tax")
        
        matched_tax_ids.add(t["tax_id"])
    
    return matched_tax_ids


# ---------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------
def run_reconciliation():
    started = time.perf_counter()
    conn = get_conn()
    conn.execute("DELETE FROM matches")
    conn.execute("DELETE FROM match_members")
    conn.execute("DELETE FROM exceptions")
    conn.execute("DELETE FROM audit_log")

    t1 = run_tier1(conn)
    t_split = run_split_match(conn, *t1)
    t2 = run_tier2(conn, *t_split)
    matched_tax_ids = run_tax_match(conn)
    flag_exceptions(conn, *t2)

    conn.commit()

    source_counts = {
        table: conn.execute(f"SELECT COUNT(*) c FROM {table}").fetchone()["c"]
        for table in ("bank_txns", "settlement_txns", "ledger_txns", "tax_txns")
    }
    total_bank = source_counts["bank_txns"]
    matched_bank_records = len(t2[0])
    matched_tax_records = len(matched_tax_ids)
    match_count = conn.execute("SELECT COUNT(*) c FROM matches").fetchone()["c"]
    exceptions = conn.execute("SELECT COUNT(*) c FROM exceptions").fetchone()["c"]
    unresolved_amounts = {
        row["source_table"]: round(row["total_amount"] or 0, 2)
        for row in conn.execute(
            "SELECT source_table, SUM(amount) total_amount FROM exceptions GROUP BY source_table"
        ).fetchall()
    }
    by_tier = {
        row["match_tier"]: row["c"]
        for row in conn.execute("SELECT match_tier, COUNT(*) c FROM matches GROUP BY match_tier").fetchall()
    }

    # Get orchestration statistics
    orchestrator = get_orchestrator()
    strategy_stats = orchestrator.get_strategy_stats()
    
    conn.close()
    return {
        "total_bank_records": total_bank,
        "matched": matched_bank_records,
        "match_count": match_count,
        "exceptions": exceptions,
        "match_rate": round(matched_bank_records / total_bank * 100, 1) if total_bank else 0,
        "by_tier": by_tier,
        "source_counts": source_counts,
        "tax_matches": matched_tax_records,
        "unresolved_amounts": unresolved_amounts,
        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
        "strategy_stats": strategy_stats,  # Orchestrator performance metrics
    }


if __name__ == "__main__":
    print(json.dumps(run_reconciliation(), indent=2))