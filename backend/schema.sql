-- =========================================================
-- Reconciliation Agent - Database Schema
-- Track 04: AI Finance Controller
-- =========================================================

DROP TABLE IF EXISTS bank_txns;
DROP TABLE IF EXISTS settlement_txns;
DROP TABLE IF EXISTS ledger_txns;
DROP TABLE IF EXISTS tax_txns;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS match_members;
DROP TABLE IF EXISTS exceptions;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS exception_patterns;
DROP TABLE IF EXISTS receipt_memory;
DROP TABLE IF EXISTS finance_policies;
DROP TABLE IF EXISTS finance_memory;

-- Source 1: Bank statement (raw bank feed)
CREATE TABLE bank_txns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_id TEXT NOT NULL UNIQUE,
    txn_date TEXT NOT NULL,        -- ISO format YYYY-MM-DD
    amount REAL NOT NULL,          -- in rupees
    description TEXT
);

-- Source 2: Razorpay settlement report
CREATE TABLE settlement_txns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL UNIQUE,
    settle_date TEXT NOT NULL,
    amount REAL NOT NULL,          -- amount AFTER fee deduction
    gross_amount REAL,             -- amount BEFORE fee deduction (may be null)
    fee REAL DEFAULT 0
);

-- Source 3: Company's internal accounting ledger
CREATE TABLE ledger_txns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT NOT NULL UNIQUE,
    invoice_date TEXT NOT NULL,
    amount REAL NOT NULL,
    customer_name TEXT
);

-- Source 4: Tax records (GST, VAT, income tax, etc.)
CREATE TABLE tax_txns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_id TEXT NOT NULL UNIQUE,
    invoice_id TEXT NOT NULL,           -- reference to ledger invoice
    tax_date TEXT NOT NULL,              -- ISO format YYYY-MM-DD
    tax_type TEXT NOT NULL,             -- 'GST', 'VAT', 'Income_Tax', 'Other'
    tax_rate REAL NOT NULL,             -- percentage (e.g., 18.0 for 18% GST)
    base_amount REAL NOT NULL,          -- amount on which tax is calculated
    tax_amount REAL NOT NULL,           -- calculated tax amount
    description TEXT
);

-- Resolved matches across sources (the "success" output)
CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_ref_id TEXT,
    order_id TEXT,
    invoice_id TEXT,
    tax_id TEXT,                       -- for tax matches
    match_amount REAL,
    confidence_score REAL NOT NULL,     -- 0-100
    match_tier TEXT NOT NULL,           -- 'tier1_exact' | 'tier1_split' | 'tier2_llm' | 'tier1_tax'
    match_type TEXT NOT NULL DEFAULT 'one_to_one',
    strategy TEXT DEFAULT 'deterministic',  -- which orchestration strategy: deterministic|adaptive|llm_fuzzy|hybrid|tax
    model TEXT DEFAULT 'fallback',          -- which model provider: gemini|local|fallback
    reason TEXT,                        -- human-readable explanation
    counterfactual TEXT,
    matched_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE match_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    source_table TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (match_id) REFERENCES matches(id)
);

-- Unresolved / flagged records
CREATE TABLE exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_table TEXT NOT NULL,         -- 'bank' | 'settlement' | 'ledger'
    source_ref TEXT NOT NULL,           -- ref_id / order_id / invoice_id
    amount REAL,
    txn_date TEXT,
    exception_reason TEXT NOT NULL,     -- 'amount_mismatch_unexplained' | 'missing_counterpart' | 'duplicate' | 'unresolved'
    status TEXT DEFAULT 'open',         -- 'open' | 'resolved'
    resolved_reason TEXT,               -- filled when a human resolves it
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Full audit trail - every decision the system makes, explainable & timestamped
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,               -- 'match_attempt' | 'match_success' | 'exception_flagged' | 'exception_resolved'
    details TEXT NOT NULL,              -- JSON blob with full context
    tier TEXT,                          -- which tier/engine made the decision
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Self-learning memory: patterns from human-resolved exceptions,
-- so similar future mismatches can be auto-suggested
CREATE TABLE exception_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL,         -- e.g. 'fee_deduction', 'settlement_delay'
    amount_diff_min REAL,
    amount_diff_max REAL,
    date_diff_days INTEGER,
    resolution_reason TEXT NOT NULL,
    times_seen INTEGER DEFAULT 1,
    trust_score REAL DEFAULT 50,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE receipt_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_ref TEXT NOT NULL UNIQUE,
    merchant TEXT NOT NULL,
    amount REAL NOT NULL,
    receipt_date TEXT NOT NULL,
    category TEXT,
    status TEXT DEFAULT 'queued',
    is_expense INTEGER DEFAULT 1,                  -- 1 for expense, 0 for other
    context TEXT,
    receipt_filename TEXT,
    receipt_text TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE finance_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_name TEXT NOT NULL UNIQUE,
    policy_text TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO finance_policies (policy_name, policy_text) VALUES
('match_tolerance', 'Exact amount matches allow a tolerance of 0.01 rupees and a date window of 3 days.'),
('exception_review', 'Unresolved amount mismatches require human review before reconciliation status is resolved.'),
('audit_requirement', 'Every automated reconciliation status change must include a reason and an audit event.'),
('ai_guardrails', 'AI cannot approve transactions over 10000 rupees, low-confidence decisions, suspicious exceptions, or amount mismatches without human review.');

CREATE TABLE finance_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    vendor TEXT,
    memory_type TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);