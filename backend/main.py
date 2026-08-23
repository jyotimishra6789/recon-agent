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
import re
import uuid
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler

try:
    from mem0 import MemoryClient
except ImportError:
    MemoryClient = None

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from matching_engine import run_reconciliation, get_conn, log_audit

app = FastAPI(title="Reconciliation Agent API")
scheduler = BackgroundScheduler(daemon=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- assumption used for the business-impact calculator ----
MANUAL_MINUTES_PER_RECORD = 2.5  # industry-rough estimate for manual recon per line item
AI_HIGH_VALUE_THRESHOLD = 10000.0
AI_MIN_APPROVAL_CONFIDENCE = 90.0
AI_SUSPICIOUS_EXCEPTIONS = {"duplicate", "amount_mismatch_unexplained", "missing_counterpart", "unresolved"}
last_reconcile_result = None


def process_pending_receipts():
    """Promote classified expenses into the ledger and run reconciliation."""
    global last_reconcile_result
    conn = get_conn()
    ensure_ai_tables(conn)
    rows = conn.execute(
        "SELECT * FROM receipt_memory WHERE status = 'queued' AND is_expense = 1"
    ).fetchall()
    promoted = 0
    for row in rows:
        invoice_id = f"EXP-{row['receipt_ref']}"
        conn.execute("""INSERT OR IGNORE INTO ledger_txns
            (invoice_id, invoice_date, amount, customer_name)
            VALUES (?, ?, ?, ?)""",
            (invoice_id, row["receipt_date"], row["amount"], row["merchant"]))
        conn.execute(
            "UPDATE receipt_memory SET status = 'processed', context = ? WHERE id = ?",
            (f"Added to reconciliation as {invoice_id}", row["id"]),
        )
        log_audit(conn, "receipt_added_to_reconciliation", {
            "receipt_ref": row["receipt_ref"], "invoice_id": invoice_id,
            "merchant": row["merchant"], "amount": row["amount"],
        }, tier="receipt_worker")
        remember_finance_context(
            f"Receipt vendor {row['merchant']} was classified as an expense for {row['amount']} and added as {invoice_id}.",
            {"vendor": row["merchant"], "receipt_ref": row["receipt_ref"], "invoice_id": invoice_id},
            "receipt",
        )
        promoted += 1
    conn.commit()
    conn.close()
    if promoted:
        last_reconcile_result = run_reconciliation()
    return {"processed": promoted, "reconciliation": last_reconcile_result if promoted else None}


@app.on_event("startup")
def start_receipt_scheduler():
    if not scheduler.running:
        scheduler.add_job(process_pending_receipts, "interval", seconds=60,
                          id="receipt-worker", replace_existing=True)
        scheduler.start()


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


@app.get("/finance/transactions/{source}/{reference}")
def finance_transaction(source: str, reference: str):
    """Fetch one source transaction for the AI finance tool chain."""
    tables = {
        "bank": ("bank_txns", "ref_id"),
        "settlement": ("settlement_txns", "order_id"),
        "ledger": ("ledger_txns", "invoice_id"),
    }
    if source not in tables:
        raise HTTPException(400, "source must be bank, settlement, or ledger")
    table, key = tables[source]
    conn = get_conn()
    row = conn.execute(f"SELECT * FROM {table} WHERE {key} = ?", (reference,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, f"{source} transaction not found")
    return {"source": source, "reference": reference, "transaction": dict(row)}


@app.get("/finance/invoices/{invoice_id}")
def finance_invoice(invoice_id: str):
    """Check the internal ledger invoice used by amount comparison."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM ledger_txns WHERE invoice_id = ?", (invoice_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Invoice not found")
    return {"invoice": dict(row)}


class FinanceCompareRequest(BaseModel):
    transaction_ref: str
    transaction_amount: float
    invoice_id: str
    invoice_amount: float
    tolerance: float = 0.01


@app.post("/finance/compare")
def finance_compare(body: FinanceCompareRequest):
    difference = round(body.transaction_amount - body.invoice_amount, 2)
    return {
        "transaction_ref": body.transaction_ref,
        "invoice_id": body.invoice_id,
        "transaction_amount": body.transaction_amount,
        "invoice_amount": body.invoice_amount,
        "difference": difference,
        "matched": abs(difference) <= body.tolerance,
        "tolerance": body.tolerance,
    }


class FinanceStatusRequest(BaseModel):
    source_ref: str
    status: str
    resolution_reason: str
    pattern_type: str | None = None
    transaction_amount: float | None = None
    invoice_amount: float | None = None
    confidence_score: float | None = None
    exception_type: str | None = None


def evaluate_ai_decision(body: FinanceStatusRequest, exception):
    """Return blocking reasons before an AI-originated status mutation."""
    reasons = []
    amounts = [value for value in (body.transaction_amount, body.invoice_amount,
                                   exception["amount"]) if value is not None]
    amount = max(amounts, default=0)
    if body.status == "resolved" and amount > AI_HIGH_VALUE_THRESHOLD:
        reasons.append(f"amount exceeds {AI_HIGH_VALUE_THRESHOLD:.0f}")
    if body.status == "resolved" and body.confidence_score is not None and body.confidence_score < AI_MIN_APPROVAL_CONFIDENCE:
        reasons.append(f"confidence is below {AI_MIN_APPROVAL_CONFIDENCE:.0f}")
    if body.status == "resolved" and body.exception_type in AI_SUSPICIOUS_EXCEPTIONS:
        reasons.append(f"exception type is {body.exception_type}")
    if body.status == "resolved" and body.transaction_amount is not None and body.invoice_amount is not None:
        if abs(body.transaction_amount - body.invoice_amount) > 0.01:
            reasons.append("transaction and invoice amounts do not match")
    return reasons


@app.post("/finance/reconciliation-status")
def update_finance_status(body: FinanceStatusRequest):
    """Update only a matching exception and write an audit event."""
    if body.status not in ("open", "resolved"):
        raise HTTPException(400, "status must be open or resolved")
    conn = get_conn()
    row = conn.execute("SELECT * FROM exceptions WHERE source_ref = ? ORDER BY id DESC LIMIT 1",
                       (body.source_ref,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Reconciliation record not found")
    guardrail_reasons = evaluate_ai_decision(body, row)
    if guardrail_reasons:
        log_audit(conn, "ai_status_blocked_by_guardrail", {
            "source_ref": body.source_ref, "requested_status": body.status,
            "reasons": guardrail_reasons,
        }, tier="ai_guardrail")
        conn.commit()
        conn.close()
        return {
            "status": "review_required", "source_ref": body.source_ref,
            "human_review_required": True, "guardrail_reasons": guardrail_reasons,
        }
    conn.execute(
        "UPDATE exceptions SET status = ?, resolved_reason = ? WHERE id = ?",
        (body.status, body.resolution_reason if body.status == "resolved" else None, row["id"]),
    )
    log_audit(conn, "ai_reconciliation_status_updated", {
        "exception_id": row["id"], "source_ref": body.source_ref,
        "status": body.status, "reason": body.resolution_reason,
    }, tier="ai_tool")
    conn.commit()
    conn.close()
    return {"status": body.status, "exception_id": row["id"], "source_ref": body.source_ref}


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
    remember_finance_context(
        f"Exception {exception_id} for {row['source_ref']} was resolved as: {body.resolution_reason}.",
        {"vendor": row["source_ref"], "exception_id": exception_id, "pattern_type": body.pattern_type},
        "exception_resolution",
    )
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
# NL Q&A chatbot - Gemini translates question -> SQL -> answer
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


class ReceiptRequest(BaseModel):
    receipt_ref: str
    merchant: str
    amount: float
    receipt_date: str
    category: str | None = None


def classify_receipt(filename: str, receipt_text: str):
    """Classify receipt metadata with Gemini, falling back to safe heuristics."""
    if os.getenv("GOOGLE_GENERATIVE_AI_API_KEY"):
        try:
            client = genai.Client(api_key=os.getenv("GOOGLE_GENERATIVE_AI_API_KEY"))
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents='Return only JSON with keys is_expense, category, merchant, amount, receipt_date. Use null for unknown values.\n'
                f"Filename: {filename}\nReceipt text: {receipt_text[:12000]}",
            )
            text = response.text.replace("```json", "").replace("```", "").strip()
            result = json.loads(text)
            if isinstance(result.get("is_expense"), bool):
                return result
        except (json.JSONDecodeError, KeyError, TypeError, IndexError):
            pass
    lower = f"{filename} {receipt_text}".lower()
    is_expense = any(term in lower for term in ("receipt", "invoice", "tax", "total", "expense", "gst"))
    return {"is_expense": is_expense, "category": "expense" if is_expense else None,
            "merchant": os.path.splitext(filename)[0], "amount": None, "receipt_date": None}


def ensure_ai_tables(conn):
    """Keep databases created before the AI workflow compatible."""
    conn.execute("""CREATE TABLE IF NOT EXISTS receipt_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_ref TEXT NOT NULL UNIQUE,
        merchant TEXT NOT NULL, amount REAL NOT NULL, receipt_date TEXT NOT NULL,
        category TEXT, status TEXT DEFAULT 'queued', context TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
    columns = {row[1] for row in conn.execute("PRAGMA table_info(receipt_memory)").fetchall()}
    for name, definition in (("receipt_filename", "TEXT"), ("receipt_text", "TEXT"), ("is_expense", "INTEGER DEFAULT 1")):
        if name not in columns:
            conn.execute(f"ALTER TABLE receipt_memory ADD COLUMN {name} {definition}")
    conn.execute("""CREATE TABLE IF NOT EXISTS finance_policies (
        id INTEGER PRIMARY KEY AUTOINCREMENT, policy_name TEXT NOT NULL UNIQUE,
        policy_text TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
    policies = (
        ("match_tolerance", "Exact amount matches allow a tolerance of 0.01 rupees and a date window of 3 days."),
        ("exception_review", "Unresolved amount mismatches require human review before reconciliation status is resolved."),
        ("audit_requirement", "Every automated reconciliation status change must include a reason and an audit event."),
        ("ai_guardrails", "AI cannot approve transactions over 10000 rupees, low-confidence decisions, suspicious exceptions, or amount mismatches without human review."),
    )
    conn.executemany("INSERT OR IGNORE INTO finance_policies (policy_name, policy_text) VALUES (?, ?)", policies)
    conn.execute("""CREATE TABLE IF NOT EXISTS finance_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, vendor TEXT,
        memory_type TEXT NOT NULL, metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")


def remember_finance_context(content: str, metadata: dict, memory_type: str):
    """Write to Mem0 when configured and always retain a local fallback."""
    if MemoryClient and os.getenv("MEM0_API_KEY"):
        try:
            client = MemoryClient(api_key=os.getenv("MEM0_API_KEY"))
            client.add([{"role": "user", "content": content}], user_id="recon-agent", metadata=metadata)
        except Exception:
            pass
    conn = get_conn()
    ensure_ai_tables(conn)
    conn.execute("INSERT INTO finance_memory (content, vendor, memory_type, metadata) VALUES (?, ?, ?, ?)",
                 (content, metadata.get("vendor"), memory_type, json.dumps(metadata, default=str)))
    conn.commit()
    conn.close()


def search_finance_memory(query: str, limit: int = 5):
    if MemoryClient and os.getenv("MEM0_API_KEY"):
        try:
            client = MemoryClient(api_key=os.getenv("MEM0_API_KEY"))
            return {"provider": "mem0", "results": client.search(query, user_id="recon-agent", limit=limit)}
        except Exception:
            pass
    terms = [term for term in re.findall(r"[a-z0-9_]+", query.lower()) if len(term) > 1]
    conn = get_conn()
    ensure_ai_tables(conn)
    rows = [dict(row) for row in conn.execute("SELECT * FROM finance_memory ORDER BY created_at DESC LIMIT 200").fetchall()]
    conn.close()
    for row in rows:
        row["relevance"] = sum(row["content"].lower().count(term) * 2 for term in terms)
        row["metadata"] = json.loads(row["metadata"] or "{}")
    rows = [row for row in rows if row["relevance"] > 0]
    rows.sort(key=lambda row: (row["relevance"], row["created_at"]), reverse=True)
    return {"provider": "local", "results": rows[:limit]}


@app.get("/memory/search")
def memory_search(query: str, limit: int = 5):
    return search_finance_memory(query, max(1, min(limit, 20)))


@app.get("/finance/search")
def finance_search(q: str, limit: int = 8):
    """Search finance records and rerank candidates before returning context."""
    query = q.strip()
    if not query or len(query) > 500:
        raise HTTPException(400, "Search query must be between 1 and 500 characters")
    limit = max(1, min(limit, 20))
    terms = [term for term in re.findall(r"[a-z0-9_]+", query.lower()) if len(term) > 1]
    conn = get_conn()
    ensure_ai_tables(conn)
    candidates = []

    def add_records(record_type, rows, fields):
        for row in rows:
            item = dict(row)
            haystack = " ".join(str(item.get(field, "")) for field in fields).lower()
            exact_hits = sum(haystack.count(term) for term in terms)
            field_hits = sum(any(term in str(item.get(field, "")).lower() for term in terms) for field in fields)
            if exact_hits or field_hits:
                item["record_type"] = record_type
                item["relevance"] = round(exact_hits * 2 + field_hits, 3)
                candidates.append(item)

    add_records("invoice", conn.execute("SELECT * FROM ledger_txns").fetchall(),
                ("invoice_id", "customer_name", "amount", "invoice_date"))
    add_records("bank_transaction", conn.execute("SELECT * FROM bank_txns").fetchall(),
                ("ref_id", "description", "amount", "txn_date"))
    add_records("settlement", conn.execute("SELECT * FROM settlement_txns").fetchall(),
                ("order_id", "amount", "gross_amount", "settle_date"))
    add_records("match", conn.execute("SELECT * FROM matches").fetchall(),
                ("bank_ref_id", "order_id", "invoice_id", "reason", "match_type"))
    add_records("exception", conn.execute("SELECT * FROM exceptions").fetchall(),
                ("source_ref", "exception_reason", "resolved_reason", "status"))
    add_records("learned_pattern", conn.execute("SELECT * FROM exception_patterns").fetchall(),
                ("pattern_type", "resolution_reason", "trust_score"))
    add_records("policy", conn.execute("SELECT * FROM finance_policies").fetchall(),
                ("policy_name", "policy_text"))
    conn.close()
    candidates.sort(key=lambda item: (item["relevance"], item.get("created_at", item.get("updated_at", ""))), reverse=True)
    return {"query": query, "results": candidates[:limit], "reranked": True}


def build_llm_context(query: str, limit: int = 6, max_chars: int = 6000):
    """Filter, summarize, deduplicate, and budget context before model use."""
    search = finance_search(query, limit=min(limit * 2, 20))
    records = []
    seen = set()
    for item in search["results"]:
        identity = (item.get("record_type"), item.get("id"), item.get("source_ref"),
                    item.get("invoice_id"), item.get("ref_id"))
        if identity in seen:
            continue
        seen.add(identity)
        allowed = {
            "record_type": item.get("record_type"), "relevance": item.get("relevance"),
            "id": item.get("id"), "ref_id": item.get("ref_id"),
            "invoice_id": item.get("invoice_id"), "order_id": item.get("order_id"),
            "amount": item.get("amount", item.get("match_amount")),
            "confidence_score": item.get("confidence_score"),
            "reason": item.get("reason", item.get("exception_reason")),
            "status": item.get("status"), "policy_text": item.get("policy_text"),
        }
        records.append({key: value for key, value in allowed.items() if value is not None})
        if len(records) >= limit:
            break
    grouped = {}
    for item in records:
        grouped[item["record_type"]] = grouped.get(item["record_type"], 0) + 1
    memories = search_finance_memory(query, min(limit, 5))["results"]
    compact_memories = [{"content": memory.get("content"), "vendor": memory.get("vendor"),
                         "memory_type": memory.get("memory_type")} for memory in memories]
    context = {"record_counts": grouped, "records": records, "previous_handling": compact_memories}
    while len(json.dumps(context, default=str)) > max_chars and context["records"]:
        context["records"].pop()
    return {"query": query, "context": context,
            "selected": len(context["records"]), "memory_selected": len(compact_memories),
            "max_chars": max_chars, "filtered": True, "summarized": True}


@app.get("/finance/context")
def finance_context(q: str, limit: int = 6, max_chars: int = 6000):
    return build_llm_context(q, max(1, min(limit, 12)), max(1000, min(max_chars, 12000)))


def retrieve_finance_context(question: str):
    """Retrieve and deterministically rerank a small context window."""
    conn = get_conn()
    ensure_ai_tables(conn)
    if any(word in question.lower() for word in ("receipt", "expense", "merchant")):
        rows = [dict(row) for row in conn.execute(
            "SELECT merchant, amount, category, status FROM receipt_memory "
            "ORDER BY created_at DESC LIMIT 5").fetchall()]
    else:
        rows = [dict(row) for row in conn.execute(
            "SELECT exception_reason, COUNT(*) AS count, ROUND(SUM(amount), 2) AS amount "
            "FROM exceptions WHERE status = 'open' GROUP BY exception_reason "
            "ORDER BY count DESC LIMIT 5").fetchall()]
    conn.close()
    terms = set(question.lower().split())
    return sorted(rows, key=lambda row: sum(term in str(row).lower() for term in terms), reverse=True)[:5]


def select_finance_tool(question: str):
    normalized = question.lower()
    if "receipt" in normalized or "expense" in normalized:
        return "search_receipt_memory"
    if "exception" in normalized or "unresolved" in normalized:
        return "get_open_exceptions"
    return "get_reconciliation_summary"


def sse(event: str, payload: dict):
    return f"event: {event}\ndata: {json.dumps(payload, default=str)}\n\n"


@app.post("/receipts/process")
def process_receipt(body: ReceiptRequest):
    """Idempotent receipt ingestion; suitable for cron or a queue worker."""
    conn = get_conn()
    ensure_ai_tables(conn)
    context = f"{body.merchant} expense {body.category or 'uncategorized'}"
    conn.execute("""INSERT INTO receipt_memory
        (receipt_ref, merchant, amount, receipt_date, category, status, context)
        VALUES (?, ?, ?, ?, ?, 'queued', ?) ON CONFLICT(receipt_ref) DO UPDATE SET
        status='queued', context=excluded.context""",
        (body.receipt_ref, body.merchant, body.amount, body.receipt_date, body.category, context))
    conn.commit()
    row = conn.execute("SELECT * FROM receipt_memory WHERE receipt_ref = ?", (body.receipt_ref,)).fetchone()
    conn.close()
    return {"status": "queued", "receipt": dict(row), "next_step": "reconcile"}


@app.post("/receipts/upload")
async def upload_receipt(file: UploadFile = File(...), amount: float | None = Form(None),
                         receipt_date: str | None = Form(None)):
    """Accept an employee receipt, classify it, and queue expense processing."""
    contents = await file.read()
    if not contents or len(contents) > 10 * 1024 * 1024:
        raise HTTPException(400, "Receipt must be non-empty and smaller than 10 MB")
    filename = file.filename or "receipt"
    receipt_text = contents.decode("utf-8", errors="ignore")
    classification = classify_receipt(filename, receipt_text)
    receipt_ref = f"RCPT-{uuid.uuid4().hex[:12]}"
    is_expense = bool(classification.get("is_expense"))
    conn = get_conn()
    ensure_ai_tables(conn)
    conn.execute("""INSERT INTO receipt_memory
        (receipt_ref, merchant, amount, receipt_date, category, status, context,
         receipt_filename, receipt_text, is_expense)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", (
        receipt_ref, classification.get("merchant") or filename,
        amount if amount is not None else classification.get("amount") or 0,
        receipt_date or classification.get("receipt_date") or datetime.now(timezone.utc).date().isoformat(),
        classification.get("category"), "queued" if is_expense else "rejected",
        "AI classified as an expense; awaiting scheduled reconciliation" if is_expense else "AI did not classify this upload as an expense",
        filename, receipt_text[:12000], int(is_expense),
    ))
    conn.commit()
    conn.close()
    return {"receipt_ref": receipt_ref, "status": "queued" if is_expense else "rejected",
            "classification": classification, "scheduled_next_run_seconds": 60}


@app.post("/receipts/process-pending")
def process_pending_receipts_endpoint():
    """Cron-friendly trigger for the same worker used by the in-process scheduler."""
    return process_pending_receipts()


@app.post("/qa/stream")
def qa_stream(body: QARequest):
    """AI SDK-friendly stream with reasoning, tools, retrieval and text."""
    question = body.question.strip()
    if not question or len(question) > 500:
        raise HTTPException(400, "Question must be between 1 and 500 characters")

    def generate():
        tool = select_finance_tool(question)
        yield sse("reasoning", {"text": "Classifying the finance question"})
        yield sse("tool_call", {"name": tool, "status": "started"})
        context = retrieve_finance_context(question)
        yield sse("context", {"items": context, "reranked": True})
        local_answer = run_local_qa(question)
        if local_answer:
            rows = local_answer.get("result", [])
            result_text = ""
            if rows:
                result_text = " " + "; ".join(
                    ", ".join(f"{key}: {value}" for key, value in row.items())
                    for row in rows[:5]
                )
            structured = {
                "answer": local_answer.get("explanation", "") + result_text,
                "matched_transaction": None, "confidence_score": None,
                "reason": "Answered from the local reconciliation database.",
                "exception_type": "none", "human_review_required": False,
                "guardrail_reasons": [],
            }
            source = "local"
        elif not os.getenv("GOOGLE_GENERATIVE_AI_API_KEY"):
            structured = {
                "answer": "Configure GOOGLE_GENERATIVE_AI_API_KEY for free-form finance questions.",
                "matched_transaction": None, "confidence_score": None,
                "reason": "Gemini is not configured.", "exception_type": "none",
                "human_review_required": False, "guardrail_reasons": [],
            }
            source = "local"
        else:
            try:
                client = genai.Client(api_key=os.getenv("GOOGLE_GENERATIVE_AI_API_KEY"))
                response = client.models.generate_content(
                    model="gemini-3.6-flash",
                    contents=QA_SYSTEM_PROMPT + "\nRetrieved context:\n" + json.dumps(context) + "\nQuestion: " + question,
                )
                text = response.text.strip().replace("```json", "").replace("```", "").strip()
                parsed = json.loads(text)
                if parsed.get("sql") and parsed["sql"].lower().startswith("select"):
                    conn = get_conn()
                    rows = [dict(row) for row in conn.execute(parsed["sql"]).fetchall()]
                    conn.close()
                    answer = parsed.get("explanation", "Here is the result.")
                    if rows:
                        answer += " " + "; ".join(", ".join(f"{key}: {value}" for key, value in row.items()) for row in rows[:5])
                else:
                    answer = parsed.get("explanation", "I cannot answer that from this data.")
                structured = {
                    "answer": answer, "matched_transaction": None,
                    "confidence_score": None, "reason": "Retrieved from the reconciliation database.",
                    "exception_type": "none", "human_review_required": False,
                    "guardrail_reasons": [],
                }
                source = "gemini"
            except Exception:
                structured = {
                    "answer": "Gemini could not produce a valid read-only answer. Try a suggested question instead.",
                    "matched_transaction": None, "confidence_score": None,
                    "reason": "The AI response failed validation.", "exception_type": "unresolved",
                    "human_review_required": True, "guardrail_reasons": ["AI response validation failed"],
                }
                source = "local"
        yield sse("tool_call", {"name": tool, "status": "completed"})
        answer = json.dumps(structured)
        for token in answer.split(" "):
            yield sse("text", {"delta": token + " "})
        yield sse("done", {"source": source, "structured": True})

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})


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

    if not os.getenv("GOOGLE_GENERATIVE_AI_API_KEY"):
        return {
            "answer": "This question needs the optional AI provider. Try one of the suggested questions, or configure GOOGLE_GENERATIVE_AI_API_KEY for free-form queries.",
            "sql": None,
            "source": "local",
        }

    try:
        client = genai.Client(api_key=os.getenv("GOOGLE_GENERATIVE_AI_API_KEY"))
        resp = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=QA_SYSTEM_PROMPT + "\nQuestion: " + body.question,
        )
    except Exception:
        return {
            "answer": "The AI provider is unavailable. Try one of the suggested questions, which work locally without an API key.",
            "sql": None,
            "source": "local",
        }
    text = resp.text.strip().replace("```json", "").replace("```", "").strip()
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