"""
FastAPI backend for the Reconciliation Agent (Track 04: AI Finance Controller)

Endpoints:
  POST /reconcile        -> run the full pipeline, return summary
  GET  /matches           -> list all matches with confidence scores
  GET  /exceptions        -> list unresolved exceptions
  POST /exceptions/{id}/resolve  -> human resolves an exception (feeds self-learning memory)
  GET  /audit-log         -> full explainable audit trail
  GET  /stats/time-saved  -> business-impact calculator
  POST /qa                -> natural-language Q&A over the reconciliation data
"""

import sqlite3
import json
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from anthropic import Anthropic

from matching_engine import run_reconciliation, get_conn, log_audit

app = FastAPI(title="Reconciliation Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- assumption used for the business-impact calculator ----
MANUAL_MINUTES_PER_RECORD = 2.5  # industry-rough estimate for manual recon per line item
last_reconcile_result = None


@app.get("/health")
def health():
    """Keyless health check for a dashboard, demo script, or free monitor."""
    conn = get_conn()
    try:
        tables = {
            table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in ("bank_txns", "settlement_txns", "ledger_txns")
        }
    except sqlite3.Error:
        tables = {}
    finally:
        conn.close()
    return {"status": "ok", "service": "reconciliation-agent", "source_counts": tables}


@app.post("/reconcile")
def reconcile():
    global last_reconcile_result
    result = run_reconciliation()
    last_reconcile_result = result
    return result


@app.get("/stats/summary")
def summary():
    """Return the latest batch metrics without requiring an LLM or API key."""
    conn = get_conn()
    try:
        source_counts = {
            table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in ("bank_txns", "settlement_txns", "ledger_txns")
        }
        open_exceptions = conn.execute(
            "SELECT COUNT(*) FROM exceptions WHERE status = 'open'"
        ).fetchone()[0]
    except sqlite3.Error as e:
        conn.close()
        raise HTTPException(503, f"Database is not initialized: {e}")
    conn.close()
    return {
        "source_counts": source_counts,
        "open_exceptions": open_exceptions,
        "last_reconcile": last_reconcile_result,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/matches")
def list_matches():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM matches ORDER BY confidence_score DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/exceptions")
def list_exceptions(status: str = "open"):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM exceptions WHERE status = ? ORDER BY created_at DESC", (status,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


class ResolveExceptionRequest(BaseModel):
    resolution_reason: str
    pattern_type: str | None = None  # e.g. "fee_deduction", "settlement_delay"


@app.post("/exceptions/{exception_id}/resolve")
def resolve_exception(exception_id: int, body: ResolveExceptionRequest):
    conn = get_conn()
    row = conn.execute("SELECT * FROM exceptions WHERE id = ?", (exception_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Exception not found")

    conn.execute(
        "UPDATE exceptions SET status = 'resolved', resolved_reason = ? WHERE id = ?",
        (body.resolution_reason, exception_id),
    )

    # self-learning memory: remember this resolution pattern, and let
    # trust rise the more times a human confirms the same pattern
    # (adaptive threshold - feeds run_tier1's confidence boost logic)
    if body.pattern_type:
        existing = conn.execute(
            "SELECT * FROM exception_patterns WHERE pattern_type = ?", (body.pattern_type,)
        ).fetchone()
        if existing:
            new_trust = min(99, existing["trust_score"] + 5)
            conn.execute(
                "UPDATE exception_patterns SET times_seen = times_seen + 1, trust_score = ? WHERE id = ?",
                (new_trust, existing["id"]),
            )
        else:
            conn.execute(
                """INSERT INTO exception_patterns (pattern_type, resolution_reason, times_seen, trust_score)
                   VALUES (?, ?, 1, 50)""",
                (body.pattern_type, body.resolution_reason),
            )

    log_audit(conn, "exception_resolved",
              {"exception_id": exception_id, "reason": body.resolution_reason,
               "pattern_type": body.pattern_type})
    conn.commit()
    conn.close()
    return {"status": "resolved", "exception_id": exception_id}


@app.get("/audit-log")
def audit_log(limit: int = 200):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["details"] = json.loads(d["details"])
        except (TypeError, json.JSONDecodeError):
            pass
        out.append(d)
    return out


@app.get("/stats/time-saved")
def time_saved():
    conn = get_conn()
    total_records = conn.execute("SELECT COUNT(*) c FROM bank_txns").fetchone()["c"]
    matched = conn.execute("SELECT COUNT(*) c FROM matches").fetchone()["c"]
    conn.close()

    manual_minutes = total_records * MANUAL_MINUTES_PER_RECORD
    automated_seconds = (last_reconcile_result or {}).get("duration_ms", 0) / 1000
    manual_seconds = manual_minutes * 60
    pct_saved = round((1 - automated_seconds / manual_seconds) * 100, 2) if manual_seconds else 0

    return {
        "total_records": total_records,
        "matched_automatically": matched,
        "estimated_manual_time_minutes": round(manual_minutes, 1),
        "automated_time_seconds": automated_seconds,
        "time_saved_percent": pct_saved,
        "assumption": f"{MANUAL_MINUTES_PER_RECORD} min/record manual reconciliation (industry estimate); automated time is measured per run",
    }


@app.get("/exception-patterns")
def exception_patterns():
    """Expose the adaptive-trust table — shows how the system's confidence
    in recurring exception patterns grows as humans confirm them."""
    conn = get_conn()
    rows = conn.execute("SELECT * FROM exception_patterns ORDER BY trust_score DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/matches/{match_id}/members")
def match_members(match_id: int):
    """For split/batch matches — returns the individual bank/ledger legs
    that were combined into this one match group."""
    conn = get_conn()
    rows = conn.execute("SELECT * FROM match_members WHERE match_id = ?", (match_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


class StressTestRequest(BaseModel):
    sizes: list[int] = [50, 200, 1000, 5000]


@app.post("/stress-test")
def stress_test(body: StressTestRequest):
    """
    Runs the naive-Python-vs-C++ matching benchmark at increasing batch
    sizes and returns the comparison. This is the live 'proves it scales'
    demo moment — the C++ hash-bucket matcher stays roughly linear while
    the naive nested-loop approach (what most teams will ship) degrades
    quadratically.
    """
    from stress_test import run_stress_suite
    try:
        results = run_stress_suite(tuple(body.sizes))
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    return {"results": results}


# ---------------------------------------------------------------------
# NL Q&A chatbot - Claude translates question -> SQL -> answer
# ---------------------------------------------------------------------
QA_SYSTEM_PROMPT = """You are a SQL assistant for a financial reconciliation database.
Schema:
  bank_txns(ref_id, txn_date, amount, description)
  settlement_txns(order_id, settle_date, amount, gross_amount, fee)
  ledger_txns(invoice_id, invoice_date, amount, customer_name)
  matches(bank_ref_id, order_id, invoice_id, match_amount, confidence_score, match_tier, match_type, reason, counterfactual, matched_at)
    -- match_tier: 'tier1_exact' | 'tier1_split' | 'tier2_llm'
    -- match_type: 'one_to_one' | 'many_to_one' | 'one_to_many'
  match_members(match_id, source_table, source_ref, amount)  -- legs of split/batch matches
  exceptions(source_table, source_ref, amount, txn_date, exception_reason, status, resolved_reason, created_at)
  exception_patterns(pattern_type, times_seen, trust_score, resolution_reason)  -- adaptive learning memory

Given a user question in English or Hinglish, respond with ONLY a JSON object:
{"sql": "<a single read-only SELECT query answering the question>", "explanation": "<one short sentence>"}

Rules:
- Only SELECT statements. Never write/alter/delete.
- Use standard SQLite syntax.
- If the question cannot be answered from this schema, return {"sql": null, "explanation": "..."}
"""


class QARequest(BaseModel):
    question: str


def run_local_qa(question: str):
    """Answer common dashboard questions without an external AI key."""
    normalized = question.lower().strip()
    queries = None
    explanation = None

    if "unresolved" in normalized and "amount" in normalized:
        queries = (
            "SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total_unresolved_amount "
            "FROM exceptions WHERE status = 'open'",
            "Total amount still unresolved across open exceptions.",
        )
    elif "reason" in normalized and ("most" in normalized or "many" in normalized):
        queries = (
            "SELECT exception_reason, COUNT(*) AS exception_count "
            "FROM exceptions WHERE status = 'open' "
            "GROUP BY exception_reason ORDER BY exception_count DESC LIMIT 1",
            "The exception reason occurring most often in the open queue.",
        )
    elif "llm" in normalized or "language model" in normalized:
        queries = (
            "SELECT COUNT(*) AS llm_match_count FROM matches WHERE match_tier = 'tier2_llm'",
            "Number of matches made by the LLM-assisted tier.",
        )
    elif "matched" in normalized and "today" in normalized:
        queries = (
            "SELECT ROUND(COALESCE(SUM(match_amount), 0), 2) AS matched_amount_today "
            "FROM matches WHERE date(matched_at) = date('now')",
            "Total value matched on the current date according to the audit timestamp.",
        )

    if not queries:
        return None

    sql, explanation = queries
    conn = get_conn()
    rows = [dict(row) for row in conn.execute(sql).fetchall()]
    conn.close()
    return {"question": question, "sql": sql, "explanation": explanation, "result": rows, "source": "local"}


@app.post("/qa")
def qa(body: QARequest):
    local_answer = run_local_qa(body.question)
    if local_answer:
        return local_answer

    if not os.getenv("ANTHROPIC_API_KEY"):
        return {
            "answer": "This question needs the optional AI provider. Try one of the suggested questions, or configure ANTHROPIC_API_KEY for free-form queries.",
            "sql": None,
            "source": "local",
        }

    try:
        client = Anthropic()
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            system=QA_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": body.question}],
        )
    except Exception:
        return {
            "answer": "The AI provider is unavailable. Try one of the suggested questions, which work locally without an API key.",
            "sql": None,
            "source": "local",
        }
    text = resp.content[0].text.strip().replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(500, "Could not parse LLM response into a query")

    if not parsed.get("sql"):
        return {"answer": parsed.get("explanation", "I can't answer that from this data."), "sql": None}

    sql = parsed["sql"].strip()
    if not sql.lower().startswith("select"):
        raise HTTPException(400, "Only read-only questions are supported")

    conn = get_conn()
    try:
        rows = [dict(r) for r in conn.execute(sql).fetchall()]
    except sqlite3.Error as e:
        conn.close()
        raise HTTPException(400, f"Query failed: {e}")
    conn.close()

    return {"question": body.question, "sql": sql, "explanation": parsed.get("explanation"), "result": rows}


@app.get("/")
def root():
    return {"status": "ok", "service": "Reconciliation Agent API"}