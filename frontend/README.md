# Reconciliation Agent — Track 04: AI Finance Controller

Bank ↔ Razorpay Settlement ↔ Internal Ledger reconciliation, with confidence-scored
matching, an honest exception list, a time-saved calculator, and a natural-language
Q&A chatbot over the data.

## Folder structure

```
recon-agent/
├── backend/        FastAPI + SQLite + matching engine (Tier 1 SQL, Tier 2 LLM)
└── frontend/        React dashboard (summary cards, matches, exceptions, audit trail, chatbot)
```

Backend and frontend are separate projects on purpose — different package managers
(pip vs npm), different dev servers (:8000 vs :3000). The frontend talks to the
backend only over HTTP, via `REACT_APP_API_URL` in `frontend/.env`.

## Running it (two terminals)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python3 generate_data.py --count 60   # regenerate synthetic data (optional, already included)
python3 load_data.py                   # loads CSVs into recon.db
export ANTHROPIC_API_KEY=your_key_here # needed for Tier 2 LLM matching + the /qa chatbot
uvicorn main:app --reload --port 8000
```

On Windows PowerShell, use `$env:ANTHROPIC_API_KEY="your_key_here"` instead.
For persistent local configuration, copy `backend/.env.example` to
`backend/.env`, replace the placeholder, install requirements again, and restart
the backend. Never commit `backend/.env` or share its contents.

Backend now runs at `http://localhost:8000`. Check `http://localhost:8000/docs`
for the interactive API explorer (FastAPI auto-generates this).

The project also has free, keyless operational endpoints:

- `GET /health` — service status and loaded source counts
- `GET /stats/summary` — latest batch summary and open exception count
- `POST /reconcile` — runs the complete reconciliation loop and returns measured runtime

Anthropic is only needed for Tier 2 fuzzy matching and natural-language Q&A. The
deterministic reconciliation path works without an API key.

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

Frontend opens at `http://localhost:3000` and talks to the backend automatically.

## Vercel deployment

Deploy `frontend` as the Vercel project root, or deploy this repository with the
root `vercel.json`. The Vercel build serves the React frontend from
`frontend/build`.

Set this Vercel environment variable before deploying:

```text
REACT_APP_API_URL=https://your-backend-host.example.com
```

The backend is a FastAPI process with SQLite-backed local state, so it should run
on a Python host such as Render, Railway, or a VM rather than as a Vercel static
function. Configure the backend's CORS policy and use its public HTTPS URL for
`REACT_APP_API_URL`. Vercel's filesystem is ephemeral, so deploying the current
SQLite backend directly there would not provide durable reconciliation state.

## Demo flow

1. Click **Run Reconciliation** — pipeline runs Tier 1 (SQL exact match) then
   Tier 2 (LLM-assisted fuzzy match) then flags whatever's left as an exception.
2. Summary cards update: match rate, open exceptions, time saved, pipeline tiers used.
3. **Matches** tab — every match with a confidence score and a plain-English reason.
4. **Exceptions** tab — resolve one manually and tag its pattern (e.g. "fee deduction")
   — this feeds the self-learning `exception_patterns` table for next time.
5. **Audit Trail** tab — full explainable log of every decision the system made.
6. **Ask the Data** panel — natural-language questions translated to SQL live.

## Criteria-to-evidence mapping

The three headline criteria are visible in the product and backed by reproducible
implementation details. Judges can use this mapping directly during the demo:

| Criterion | Where to see it | How this project satisfies it |
|---|---|---|
| **Throughput** | Run **Reconciliation**, then open the summary cards or run the stress test | The matching engine uses deterministic Tier 1 SQL/hash-bucket matching for routine records, supports split/batch relationships through `match_members`, and measures each run's `duration_ms`. The `POST /stress-test` endpoint compares the optimized matcher with a naive nested-loop baseline at increasing batch sizes. |
| **Measured accuracy** | Summary cards and **Matches** tab | The app reports the match rate from actual matched and total bank records. Each match shows a confidence score, matching tier (`Tier 1 · SQL` or `Tier 2 · LLM`), amount, and plain-language reason. The benchmark below records a reproducible local result rather than presenting an unsupported accuracy claim. |
| **Honest exception list** | **Exceptions** tab and **Open Exceptions** summary card | Records that cannot be confidently matched are explicitly flagged with source, reference, amount, date, and reason. Users resolve them with a tagged reason, and unresolved items remain visible instead of being counted as successful matches. |

### Supporting control evidence

- **Traceability:** the **Audit Trail** records match attempts, successful matches,
   flagged exceptions, and human resolutions with timestamps and details.
- **Human-in-the-loop learning:** exception resolutions update the adaptive
   `exception_patterns` table and increase trust for recurring confirmed patterns.
- **Period close:** the Period Close control blocks sign-off while exceptions remain,
   records reviewer, notes, and timestamp, and exports the summary, matches,
   exceptions, sign-off, and audit trail as an audit-ready JSON report.
- **Reproducibility:** `/health`, `/stats/summary`, `/matches`, `/exceptions`, and
   `/audit-log` expose the same operational evidence used by the dashboard.

## Notes for the demo narrative

- Don't just show the happy path — open the Exceptions tab and be upfront about
  what's still unresolved. The judging bar explicitly rewards honesty over a
  cherry-picked "everything matched" result.
- The time-saved number is based on an explicit assumption
   (`MANUAL_MINUTES_PER_RECORD` in `backend/main.py`), while automated runtime is
   measured per reconciliation run — say both out loud, don't present the manual
   estimate as a measured fact.

## Current reproducible benchmark

With `python generate_data.py --count 60`, the generator creates 57 bank rows,
58 settlement rows, and 59 ledger rows because missing-counterpart and duplicate
scenarios intentionally change source counts. A local run produced 53 matched
bank records (93.0%) and 15 source-level exceptions in 166.77 ms without LLM
access. Treat these as a reproducible demo result, not a general accuracy claim.